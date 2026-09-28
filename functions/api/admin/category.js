import { bad, getStore, json, requireAdmin, requireJson, cleanString, ensureBaseStoreSchema, ensureMediaSchema } from '../_shared.js';

function normalizeImageRef(value, imageKey) {
  const key = cleanString(imageKey, 200);
  if (key) return `/api/media/${encodeURIComponent(key)}`;
  const image = cleanString(value, 500000);
  if (!image) return '';
  if (/^https?:\/\//i.test(image) || /^\/[^\s]+$/.test(image)) return image;
  throw new Error('آدرس تصویر دسته‌بندی نامعتبر است. فقط آدرس http/https یا مسیر /api/media/... مجاز است.');
}

export async function onRequestPost(context) {
  try {
    const admin = await requireAdmin(context);
    if (!admin) return bad('نیاز به ورود مدیر دارید.', 401);
    if (!context.env?.DB) return bad('اتصال Worker به Cloudflare D1 برقرار نیست.', 500);

    const db = context.env.DB;
    await ensureBaseStoreSchema(db);
    const b = await requireJson(context.request);
    if (!b || typeof b !== 'object') return bad('داده دسته‌بندی نامعتبر است.');

    const name = cleanString(b?.name, 150);
    if (!name) return bad('نام دسته‌بندی الزامی است.');
    const id = cleanString(b?.id, 100) || `cat_${crypto.randomUUID()}`;
    const imageKey = cleanString(b?.imageKey, 200);
    if (imageKey) {
      await ensureMediaSchema(db);
      const media = await db.prepare('SELECT id FROM media_assets WHERE id = ? LIMIT 1').bind(imageKey).first();
      if (!media) return bad('تصویر انتخاب‌شده در سرور پیدا نشد. ابتدا تصویر را دوباره آپلود کنید.', 409);
    }
    const now = new Date().toISOString();
    const image = normalizeImageRef(b?.image, imageKey);
    await db.prepare(`INSERT INTO categories
      (id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(
        id,
        name,
        cleanString(b?.slug, 160) || name,
        image,
        imageKey,
        cleanString(b?.icon, 80) || 'fa-paw',
        cleanString(b?.color, 120) || 'from-orange-500 to-amber-500',
        Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : 0,
        now,
        now
      ).run();

    return json({ ok: true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_CATEGORY_CREATE_ERROR', error);
    return bad(`ذخیره دسته‌بندی انجام نشد: ${String(error?.message || error || 'خطای نامشخص').slice(0, 300)}`, 500, { errorCode: 'ADMIN_CATEGORY_CREATE_FAILED' });
  }
}
