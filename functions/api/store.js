import { json, getStoreReadOnly, extractDbError } from './_shared.js';

export async function onRequestGet(context) {
  const startedAt = Date.now();
  try {
    if (!context.env?.DB) {
      return json({ ok: false, error: 'اتصال Worker به Cloudflare D1 برقرار نیست.', code: 'D1_BINDING_MISSING' }, 500);
    }
    const store = await getStoreReadOnly(context.env.DB);
    return json({
      ok: true,
      ...store,
      meta: { readMs: Date.now() - startedAt }
    }, 200, {
      'cache-control': 'public, max-age=3, s-maxage=8, stale-while-revalidate=60',
      'cdn-cache-control': 'public, s-maxage=8, stale-while-revalidate=60'
    });
  } catch (error) {
    console.error('STORE_READ_ERROR', error);
    const dbError = extractDbError(error);
    return json({
      ok: false,
      error: `خواندن اطلاعات فروشگاه از D1 ناموفق بود [${dbError.code || 'STORE_READ_FAILED'}]: ${dbError.message}`,
      code: dbError.code || 'STORE_READ_FAILED',
      details: { operation: 'store.read', database: dbError.message, readMs: Date.now() - startedAt }
    }, 500);
  }
}
