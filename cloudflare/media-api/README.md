# Jiang Cheng Media API

This Worker turns the R2 bucket `jiangchengtest` into a small read-only content API for the Jiang Cheng website.

## Current architecture

```text
R2: jiangchengtest/film/*
        ↓
Cloudflare Worker: /api/film
        ↓
GitHub Pages: /film/
```

The Film page keeps its current bundled 16-item archive as a fallback. If the Worker API is unavailable, the existing site still works.

## R2 binding

`wrangler.jsonc` binds the existing bucket as:

```json
{
  "binding": "MEDIA",
  "bucket_name": "jiangchengtest"
}
```

The Worker only lists object metadata. Media playback continues to use the public R2 base URL configured in `PUBLIC_MEDIA_BASE`.

## Recommended object naming

The minimum requirement is to put playable video files under `film/`.

Examples:

```text
film/daily/001-首發預告.mp4
film/daily/001-首發預告.webp
film/daily/002-一個人也沒不行.mp4
film/interview/001-蔣誠-達文西.mp4
```

If an image has the same stem as a video, the API automatically treats it as that video's poster.

```text
film/daily/001-首發預告.mp4
film/daily/001-首發預告.webp
```

A `.poster` suffix is also supported:

```text
film/daily/001-首發預告.mp4
film/daily/001-首發預告.poster.webp
```

Without metadata, the API infers:

- category from the first folder below `film/`
- sequence number from the leading digits in the filename
- title from the rest of the filename
- order from the sequence number

## Optional R2 custom metadata

For more control, object custom metadata can override inferred values:

```text
title=一個普通的下午
code=DAILY / 005
duration=02:41
category=DAILY
order=5
orientation=landscape
poster=film/daily/005-一個普通的下午.webp
published=true
```

Set `published=false` to keep a video in R2 without exposing it in the API.

## Deploy

From this directory, deploy with Wrangler:

```bash
npx wrangler deploy
```

Cloudflare recommends using Wrangler configuration as the source of truth. The existing R2 bucket is attached by the `MEDIA` binding, so no R2 access key is stored in this repository.

After deployment, copy the Worker endpoint into `film/media-config.js` once:

```js
window.JC_MEDIA = Object.freeze({
  filmApi: 'https://jiangcheng-media-api.<your-workers-subdomain>.workers.dev/api/film'
});
```

After this one-time step, adding/removing published files in `jiangchengtest/film/` changes the Film API automatically; normal content additions do not require editing the Film HTML.

## Endpoints

```text
GET /health
GET /api/film
```

`/api/film` returns:

```json
{
  "source": "cloudflare-r2",
  "prefix": "film/",
  "count": 1,
  "items": [
    {
      "title": "首發預告",
      "code": "DAILY / 001",
      "url": "https://pub-...r2.dev/film/daily/001-%E9%A6%96%E7%99%BC%E9%A0%90%E5%91%8A.mp4",
      "poster": "https://pub-...r2.dev/film/daily/001-%E9%A6%96%E7%99%BC%E9%A0%90%E5%91%8A.webp"
    }
  ]
}
```

## CORS

The current config allows the production GitHub Pages origin:

```text
https://visiblemem.github.io
```

Add future production origins to `ALLOWED_ORIGINS` as a comma-separated list.
