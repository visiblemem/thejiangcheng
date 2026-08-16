const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'm4v']);
const IMAGE_EXTENSIONS = new Set(['webp', 'jpg', 'jpeg', 'png', 'avif']);

function extension(key = '') {
  const name = key.split('/').pop() || '';
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function stripExtension(key = '') {
  const dot = key.lastIndexOf('.');
  return dot === -1 ? key : key.slice(0, dot);
}

function encodeObjectKey(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function parsePrefixes(value, fallback) {
  return String(value || fallback)
    .split(',')
    .map(prefix => prefix.trim())
    .filter(Boolean)
    .map(prefix => prefix.endsWith('/') ? prefix : `${prefix}/`);
}

function videoPrefixesFromEnv(env) {
  return parsePrefixes(env.FILM_PREFIXES || env.FILM_PREFIX, 'film/,video/');
}

function imagePrefixesFromEnv(env) {
  return parsePrefixes(env.IMAGE_PREFIXES, 'pic/');
}

function contentPrefixFromEnv(env) {
  const value = String(env.FILM_CONTENT_PREFIX || 'film-meta/').trim() || 'film-meta/';
  return value.endsWith('/') ? value : `${value}/`;
}

function matchingPrefix(key, prefixes) {
  return prefixes.find(prefix => key.startsWith(prefix)) || prefixes[0] || '';
}

function relativeKey(key, prefix) {
  return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}

function titleFromKey(key, prefix) {
  const relative = relativeKey(key, prefix);
  const filename = stripExtension(relative.split('/').pop() || relative);
  return filename
    .replace(/^\d+[\s._-]*/, '')
    .replace(/\.poster$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim() || 'Untitled';
}

function sequenceFromKey(key, prefix) {
  const relative = relativeKey(key, prefix);
  const filename = relative.split('/').pop() || '';
  const match = filename.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function categoryFromKey(key, prefix, fallback = 'FILM') {
  const relative = relativeKey(key, prefix);
  const parts = relative.split('/').filter(Boolean);
  if ((prefix === 'video/' || prefix === 'pic/') && parts.length <= 1) return fallback;
  const first = parts[0]?.toLowerCase() || fallback.toLowerCase();
  if (first === 'conversation' || first === 'interview') return 'INTERVIEW';
  if (first === 'daily') return 'DAILY';
  return first.toUpperCase();
}

function mediaUrl(base, key) {
  return `${String(base || '').replace(/\/$/, '')}/${encodeObjectKey(key)}`;
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function slugFromKey(key = '') {
  return `film-${stableHash(key).toString(36)}`;
}

function randomFallbackPoster(videoKey, imageObjects) {
  if (!imageObjects.length) return null;
  return imageObjects[stableHash(videoKey) % imageObjects.length]?.key || null;
}

function autoDescription(title, category, key) {
  const generic = [
    `這是一段關於「${title}」的影像紀錄。作品保留日常裡的停頓與空氣，讓事件之外的情緒慢慢浮現。`,
    `影像從「${title}」開始，但不急著給出答案。人物、空間與時間被留在同一個畫面裡，形成一段可以反覆觀看的片刻。`,
    `「${title}」記錄一種短暫的狀態。比起完整敘事，作品更在意那些沒有被說完的情緒，以及人物與世界之間留下的距離。`,
    `這支作品以「${title}」為線索，將日常拆成幾個安靜的瞬間。畫面不試圖解釋所有事情，而是讓觀看本身成為故事的一部分。`
  ];
  const interview = [
    `「${title}」把對話當成一種觀看方式。問題與回答之間保留空白，讓人物的觀點、停頓與未完成的想法同時存在。`,
    `這是一段以對話為核心的影像。從「${title}」出發，作品不追求結論，而是留下不同觀點碰撞後產生的餘韻。`
  ];
  const pool = String(category).toUpperCase() === 'INTERVIEW' ? interview : generic;
  return pool[stableHash(key) % pool.length];
}

function defaultContentForVideo(object, prefixes) {
  const objectMeta = object.customMetadata || {};
  const prefix = matchingPrefix(object.key, prefixes);
  const title = objectMeta.title || titleFromKey(object.key, prefix);
  const category = objectMeta.category || categoryFromKey(object.key, prefix, 'FILM');
  const year = objectMeta.year || String(object.uploaded?.getUTCFullYear?.() || 2026);
  return {
    version: 1,
    videoKey: object.key,
    slug: objectMeta.slug || slugFromKey(object.key),
    title,
    year,
    description: objectMeta.description || autoDescription(title, category, object.key),
    credits: [
      { label: 'Direction', value: 'Jiang Cheng' },
      { label: 'Format', value: category },
      { label: 'Year', value: year }
    ],
    links: []
  };
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function corsHeaders(request, env) {
  const headers = new Headers();
  const origin = allowedOrigin(request, env);
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return headers;
}

async function listAll(bucket, options) {
  const objects = [];
  let cursor;
  do {
    const result = await bucket.list({
      ...options,
      cursor,
      limit: 1000,
      include: ['customMetadata', 'httpMetadata']
    });
    objects.push(...result.objects);
    cursor = result.truncated ? result.cursor : undefined;
  } while (cursor);
  return objects;
}

async function listAcrossPrefixes(bucket, prefixes) {
  const groups = await Promise.all(prefixes.map(prefix => listAll(bucket, { prefix })));
  const seen = new Set();
  const objects = [];
  for (const group of groups) {
    for (const object of group) {
      if (seen.has(object.key)) continue;
      seen.add(object.key);
      objects.push(object);
    }
  }
  return objects;
}

async function readContentRecords(bucket, prefix) {
  const objects = (await listAll(bucket, { prefix }))
    .filter(object => extension(object.key) === 'json');

  const records = await Promise.all(objects.map(async object => {
    try {
      const stored = await bucket.get(object.key);
      if (!stored) return null;
      const data = JSON.parse(await stored.text());
      if (!data?.videoKey) return null;
      return [data.videoKey, { ...data, contentKey: object.key }];
    } catch (error) {
      console.warn('film metadata parse failed', object.key, error);
      return null;
    }
  }));

  return new Map(records.filter(Boolean));
}

async function ensureContentRecords(bucket, prefix, videoObjects, videoPrefixes) {
  const records = await readContentRecords(bucket, prefix);
  const writes = [];

  for (const object of videoObjects) {
    if (records.has(object.key)) continue;
    const content = defaultContentForVideo(object, videoPrefixes);
    const contentKey = `${prefix}${content.slug}.json`;
    const stored = { ...content, contentKey };
    records.set(object.key, stored);
    writes.push(bucket.put(contentKey, JSON.stringify(content, null, 2), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { videoKey: object.key, slug: content.slug }
    }));
  }

  if (writes.length) {
    const results = await Promise.allSettled(writes);
    results.forEach(result => {
      if (result.status === 'rejected') console.error('film metadata write failed', result.reason);
    });
  }

  return records;
}

function itemFromObject(object, prefixes, env, kind, index, posterKey = null, content = null) {
  const meta = object.customMetadata || {};
  const prefix = matchingPrefix(object.key, prefixes);
  const sequence = sequenceFromKey(object.key, prefix);
  const category = meta.category || categoryFromKey(object.key, prefix, kind === 'image' ? 'IMAGE' : 'FILM');
  const order = Number(meta.order || sequence || index + 1);
  const published = String(meta.published || 'true').toLowerCase() !== 'false';
  const url = mediaUrl(env.PUBLIC_MEDIA_BASE, object.key);
  const resolvedPoster = meta.poster || posterKey;
  const title = meta.title || content?.title || titleFromKey(object.key, prefix);
  const year = meta.year || content?.year || String(object.uploaded?.getUTCFullYear?.() || 2026);
  const description = meta.description || content?.description || (kind === 'video' ? autoDescription(title, category, object.key) : '');
  const credits = Array.isArray(content?.credits) ? content.credits : [];
  const links = Array.isArray(content?.links) ? content.links : [];

  if (kind === 'video' && meta.externalUrl) {
    links.unshift({ label: meta.externalLabel || 'External Link', href: meta.externalUrl });
  }

  return {
    key: object.key,
    kind,
    sourcePrefix: prefix,
    slug: meta.slug || content?.slug || slugFromKey(object.key),
    title,
    code: meta.code || `${category} / ${String(sequence || order).padStart(3, '0')}`,
    category,
    duration: kind === 'video' ? (meta.duration || '') : '',
    orientation: meta.orientation || '',
    year,
    description,
    credits,
    links,
    contentKey: content?.contentKey || null,
    order,
    published,
    size: object.size,
    uploaded: object.uploaded?.toISOString?.() || null,
    contentType: object.httpMetadata?.contentType || null,
    url,
    poster: kind === 'image' ? url : (resolvedPoster ? mediaUrl(env.PUBLIC_MEDIA_BASE, resolvedPoster) : null)
  };
}

async function filmIndex(request, env) {
  const videoPrefixes = videoPrefixesFromEnv(env);
  const imagePrefixes = imagePrefixesFromEnv(env);
  const contentPrefix = contentPrefixFromEnv(env);
  const [videoObjects, imageObjects] = await Promise.all([
    listAcrossPrefixes(env.MEDIA, videoPrefixes),
    listAcrossPrefixes(env.MEDIA, imagePrefixes)
  ]);

  const videoFiles = videoObjects.filter(object => VIDEO_EXTENSIONS.has(extension(object.key)));
  const standaloneImages = imageObjects.filter(object => IMAGE_EXTENSIONS.has(extension(object.key)));
  const contentRecords = await ensureContentRecords(env.MEDIA, contentPrefix, videoFiles, videoPrefixes);

  // Poster priority:
  // 1. customMetadata.poster
  // 2. same-stem image beside the video, preferring .poster.*
  // 3. stable random image from pic/ as temporary fallback
  const postersByStem = new Map();
  for (const object of videoObjects) {
    if (!IMAGE_EXTENSIONS.has(extension(object.key))) continue;
    let stem = stripExtension(object.key);
    if (stem.endsWith('.poster')) stem = stem.slice(0, -'.poster'.length);
    const existing = postersByStem.get(stem);
    const isExplicitPoster = stripExtension(object.key).endsWith('.poster');
    if (!existing || isExplicitPoster) postersByStem.set(stem, object.key);
  }

  const videos = videoFiles.map((object, index) => {
    const stem = stripExtension(object.key);
    const sameStemPoster = postersByStem.get(stem) || null;
    const fallbackPoster = sameStemPoster || randomFallbackPoster(object.key, standaloneImages);
    return itemFromObject(object, videoPrefixes, env, 'video', index, fallbackPoster, contentRecords.get(object.key));
  });

  const images = standaloneImages
    .map((object, index) => itemFromObject(object, imagePrefixes, env, 'image', index));

  const items = [...videos, ...images]
    .filter(item => item.published)
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));

  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=30, s-maxage=60');

  return new Response(JSON.stringify({
    source: 'cloudflare-r2',
    videoPrefixes,
    imagePrefixes,
    contentPrefix,
    count: items.length,
    videoCount: videos.filter(item => item.published).length,
    imageCount: images.filter(item => item.published).length,
    items
  }), { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'jiangcheng-media-api' }, {
        headers: corsHeaders(request, env)
      });
    }

    if (url.pathname === '/api/film') {
      try {
        return await filmIndex(request, env);
      } catch (error) {
        console.error('film index failed', error);
        const headers = corsHeaders(request, env);
        headers.set('Content-Type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify({ error: 'Unable to list Film media.' }), {
          status: 500,
          headers
        });
      }
    }

    return new Response('Jiang Cheng Media API\nGET /api/film\nGET /health\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
};
