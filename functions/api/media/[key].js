export async function onRequestGet(context) {
  const key = String(context.params.key || '').trim();
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(key)) return new Response('Not found', { status: 404 });

  const row = await context.env.DB
    .prepare('SELECT mime_type, size_bytes, data FROM media_assets WHERE id = ? LIMIT 1')
    .bind(key)
    .first();
  if (!row?.data) return new Response('Not found', { status: 404 });

  const mime = String(row.mime_type || 'image/webp').toLowerCase();
  const allowed = new Set([
    'image/webp',
    'image/jpeg',
    'image/png',
    'image/avif',
    'image/gif'
  ]);
  const contentType = allowed.has(mime) ? mime : 'application/octet-stream';

  // D1 may expose BLOB values as ArrayBuffer or as an ArrayBuffer view.
  // Normalize both shapes before passing the data to Response so browsers
  // always receive the actual binary image bytes, not an object/string.
  let body;
  if (row.data instanceof ArrayBuffer) {
    body = row.data;
  } else if (ArrayBuffer.isView(row.data)) {
    body = row.data.buffer.slice(row.data.byteOffset, row.data.byteOffset + row.data.byteLength);
  } else if (Array.isArray(row.data)) {
    body = new Uint8Array(row.data);
  } else {
    return new Response('Invalid media data', { status: 500 });
  }

  const size = Number(row.size_bytes) || (body.byteLength || 0);
  if (!size) return new Response('Invalid media size', { status: 500 });

  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('content-length', String(size));
  headers.set('content-disposition', 'inline');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(body, { headers });
}
