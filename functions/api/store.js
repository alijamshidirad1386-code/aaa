import { json, getStore } from './_shared.js';

export async function onRequestGet(context) {
  try {
    return json({ ok: true, ...(await getStore(context.env.DB)) }, 200, { 'cache-control': 'public, max-age=5, s-maxage=15, stale-while-revalidate=120', 'cdn-cache-control': 'public, s-maxage=15, stale-while-revalidate=120' });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: 'خطا در خواندن دیتابیس فروشگاه' }, 500);
  }
}
