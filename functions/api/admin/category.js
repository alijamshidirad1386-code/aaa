import { bad, getStore, json, requireAdmin, requireJson, cleanString, ensureBaseStoreSchema, ensureMediaSchema, isIntegerPrimaryKey, coerceDbValue, extractDbError, makeCompatibleTextId, makeUniqueSlug } from '../_shared.js';

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
    const imageKeyRaw = cleanString(b?.imageKey, 200);
    const imageKey = imageKeyRaw ? await coerceDbValue(db, 'categories', 'image_key', imageKeyRaw) : '';
    if (imageKeyRaw) {
      await ensureMediaSchema(db);
      const mediaKey = await coerceDbValue(db, 'media_assets', 'id', imageKeyRaw);
      const media = await db.prepare('SELECT id FROM media_assets WHERE id = ? LIMIT 1').bind(mediaKey).first();
      if (!media) return bad('تصویر انتخاب‌شده در سرور پیدا نشد. ابتدا تصویر را دوباره آپلود کنید.', 409);
    }
    const now = new Date().toISOString();
    const image = normalizeImageRef(b?.image, imageKeyRaw);
    const slug = await makeUniqueSlug(db, 'categories', cleanString(b?.slug, 160) || name, { fallback: 'category' });
    const isIntegerId = await isIntegerPrimaryKey(db, 'categories', 'id');
    let result;
    let createdId = '';
    if (isIntegerId) {
      result = await db.prepare(`INSERT INTO categories
        (name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(
          name, slug, image, imageKey,
          cleanString(b?.icon, 80) || 'fa-paw',
          cleanString(b?.color, 120) || 'from-orange-500 to-amber-500',
          Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : 0, now, now
        ).run();
    } else {
      let id = cleanString(b?.id, 100);
      if (id) id = await coerceDbValue(db, 'categories', 'id', id);
      else id = await makeCompatibleTextId(db, 'categories', 'id', 'cat_', [
        { table: 'products', column: 'category_id' }
      ]);
      createdId = id;
      result = await db.prepare(`INSERT INTO categories
        (id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .bind(
          id, name, cleanString(b?.slug, 160) || name, image, imageKey,
          cleanString(b?.icon, 80) || 'fa-paw',
          cleanString(b?.color, 120) || 'from-orange-500 to-amber-500',
          Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : 0, now, now
        ).run();
    }

    if (isIntegerId) createdId = String(result?.meta?.last_row_id || '');
    return json({ ok: true, createdId, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_CATEGORY_CREATE_ERROR', error);
    const dbError = extractDbError(error);
    return bad(`ذخیره دسته‌بندی انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_CATEGORY_CREATE_FAILED', errorDetails: { operation: 'category.create', database: dbError.message } });
  }
}
