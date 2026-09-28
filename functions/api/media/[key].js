import { ensureMediaSchema } from '../_shared.js';

function toArrayBuffer(value) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value).buffer;
  return null;
}

export async function onRequestGet(context) {
  const key = String(context.params?.key || '').trim();
  if (!/^(?:[a-zA-Z0-9_-]{1,80})$/.test(key)) return new Response('Not found', { status: 404 });
  if (!context.env?.DB) return new Response('Media database unavailable', { status: 503 });

  try { await ensureMediaSchema(context.env.DB); } catch (error) {
    console.error('MEDIA_SCHEMA_ERROR', error);
    return new Response('Media storage unavailable', { status: 503 });
  }

  let row;
  try {
    row = await context.env.DB.prepare('SELECT mime_type, size_bytes, data FROM media_assets WHERE id = ? LIMIT 1').bind(key).first();
  } catch (error) {
    console.error('MEDIA_READ_ERROR', error);
    return new Response('Media read failed', { status: 500 });
  }
  if (!row?.data) return new Response('Not found', { status: 404 });

  let body = toArrayBuffer(row.data);
  if (!body && typeof Blob !== 'undefined' && row.data instanceof Blob) body = await row.data.arrayBuffer();
  if (!body && typeof row.data === 'string') {
    try { body = Uint8Array.from(atob(row.data), ch => ch.charCodeAt(0)).buffer; } catch (_) {}
  }
  if (!body) return new Response('Invalid media data', { status: 500 });

  const bytes = new Uint8Array(body);
  if (!bytes.byteLength) return new Response('Invalid media size', { status: 500 });

  const mime = String(row.mime_type || 'application/octet-stream').toLowerCase();
  const allowed = new Set(['image/webp','image/jpeg','image/png','image/avif','image/gif']);
  if (!allowed.has(mime)) return new Response('Unsupported media type', { status: 415 });

  const headers = new Headers({
    'content-type': mime,
    'content-length': String(bytes.byteLength),
    'content-disposition': 'inline',
    'x-content-type-options': 'nosniff',
    'cache-control': 'public, max-age=31536000, immutable',
    'etag': `"${key}"`
  });
  return new Response(bytes, { status: 200, headers });
}
