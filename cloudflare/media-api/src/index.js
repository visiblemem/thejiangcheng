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

function prefixesFromEnv(env) {
  const value = env.FILM_PREFIXES || env.FILM_PREFIX || 'film/';
  return String(value)
    .split(',')
    .map(prefix => prefix.trim())
    .filter(Boolean)
    .map(prefix => prefix.endsWith('/') ? prefix : `${prefix}/`);
}

function matchingPrefix(key, prefixes) {
  return prefixes.find(prefix => key.startsWith(prefix)) || prefixes[0] || 'film/';
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

function categoryFromKey(key, prefix) {
  const relative = relativeKey(key, prefix);
  const parts = relative.split('/').filter(Boolean);

  // Existing R2 layout stores Film files directly under video/.
  // Treat those as generic FILM rather than using the filename as a category.
  if (prefix === 'video/' && parts.length <= 1) return 'FILM';

  const first = parts[0]?.toLowerCase() || 'film';
  if (first === 'conversation' || first === 'interview') return 'INTERVIEW';
  if (first === 'daily') return 'DAILY';
  return first.toUpperCase();
}

function mediaUrl(base, key) {
  return `${String(base || '').replace(/\/$/, '')}/${encodeObjectKey(key)}`;
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

async function filmIndex(request, env) {
  const prefixes = prefixesFromEnv(env);
  const objects = await listAcrossPrefixes(env.MEDIA, prefixes);
  const imagesByStem = new Map();

  for (const object of objects) {
    if (!IMAGE_EXTENSIONS.has(extension(object.key))) continue;
    let stem = stripExtension(object.key);
    if (stem.endsWith('.poster')) stem = stem.slice(0, -'.poster'.length);
    imagesByStem.set(stem, object.key);
  }

  const items = objects
    .filter(object => VIDEO_EXTENSIONS.has(extension(object.key)))
    .map((object, index) => {
      const meta = object.customMetadata || {};
      const prefix = matchingPrefix(object.key, prefixes);
      const sequence = sequenceFromKey(object.key, prefix);
      const category = meta.category || categoryFromKey(object.key, prefix);
      const stem = stripExtension(object.key);
      const posterKey = meta.poster || imagesByStem.get(stem) || null;
      const order = Number(meta.order || sequence || index + 1);
      const published = String(meta.published || 'true').toLowerCase() !== 'false';

      return {
        key: object.key,
        sourcePrefix: prefix,
        title: meta.title || titleFromKey(object.key, prefix),
        code: meta.code || `${category} / ${String(sequence || order).padStart(3, '0')}`,
        category,
        duration: meta.duration || '',
        orientation: meta.orientation || '',
        order,
        published,
        size: object.size,
        uploaded: object.uploaded?.toISOString?.() || null,
        contentType: object.httpMetadata?.contentType || null,
        url: mediaUrl(env.PUBLIC_MEDIA_BASE, object.key),
        poster: posterKey ? mediaUrl(env.PUBLIC_MEDIA_BASE, posterKey) : null
      };
    })
    .filter(item => item.published)
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));

  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=30, s-maxage=60');

  return new Response(JSON.stringify({
    source: 'cloudflare-r2',
    prefixes,
    count: items.length,
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
