import { bad, getStore, json, requireAdmin, requireJson, cleanString, ensureBaseStoreSchema, ensureMediaSchema, coerceDbValue, extractDbError } from '../../_shared.js';

function normalizeImageRef(value, imageKey) {
  const key = cleanString(imageKey, 200);
  if (key) return `/api/media/${encodeURIComponent(key)}`;
  const image = cleanString(value, 500000);
  if (!image) return '';
  if (/^https?:\/\//i.test(image) || /^\/[^\s]+$/.test(image)) return image;
  throw new Error('آدرس تصویر دسته‌بندی نامعتبر است. فقط آدرس http/https یا مسیر /api/media/... مجاز است.');
}

export async function onRequestDelete(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const db = context.env?.DB;
    if (!db) return bad('اتصال Worker به Cloudflare D1 برقرار نیست.', 500);
    await ensureBaseStoreSchema(db);
    const idRaw = cleanString(context.params?.id, 100);
    if (!idRaw) return bad('شناسه دسته‌بندی نامعتبر است.');
    const id = await coerceDbValue(db, 'categories', 'id', idRaw);
    const categoryColumn = await coerceDbValue(db, 'products', 'category_id', idRaw);
    const used = await db.prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ?').bind(categoryColumn).first();
    if (Number(used?.c || 0) > 0) return bad('این دسته‌بندی هنوز محصول دارد و قابل حذف نیست.', 409);
    const result = await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    if (!Number(result?.meta?.changes ?? 0)) return bad('دسته‌بندی موردنظر در دیتابیس پیدا نشد.', 404);
    return json({ ok:true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_CATEGORY_DELETE_ERROR', error);
    const dbError = extractDbError(error);
    return bad(`حذف دسته‌بندی انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_CATEGORY_DELETE_FAILED', errorDetails: { operation: 'category.delete', database: dbError.message } });
  }
}

export async function onRequestPut(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const db = context.env?.DB;
    if (!db) return bad('اتصال Worker به Cloudflare D1 برقرار نیست.', 500);
    await ensureBaseStoreSchema(db);
    const b = await requireJson(context.request);
    const idRaw = cleanString(context.params?.id, 100);
    if (!idRaw) return bad('شناسه دسته‌بندی نامعتبر است.');
    const id = await coerceDbValue(db, 'categories', 'id', idRaw);
    const existing = await db.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1').bind(id).first();
    if (!existing) return bad('دسته‌بندی موردنظر در دیتابیس پیدا نشد. صفحه را تازه‌سازی کنید.', 404);

    const imageKey = cleanString(b?.imageKey, 200);
    const dbImageKey = imageKey ? await coerceDbValue(db, 'categories', 'image_key', imageKey) : '';
    const mediaKey = imageKey ? await coerceDbValue(db, 'media_assets', 'id', imageKey) : null;
    if (imageKey) {
      await ensureMediaSchema(db);
      const media = await db.prepare('SELECT id FROM media_assets WHERE id = ? LIMIT 1').bind(mediaKey).first();
      if (!media) return bad('تصویر انتخاب‌شده در سرور پیدا نشد. ابتدا تصویر را دوباره آپلود کنید.', 409);
    }
    const name = cleanString(b?.name,150);
    if (!name) return bad('نام دسته‌بندی الزامی است.');
    const image = normalizeImageRef(b?.image, imageKey);
    await db.prepare(`UPDATE categories SET name=?, slug=?, image=?, image_key=?, icon=?, color=?, updated_at=? WHERE id=?`)
      .bind(
        name,
        cleanString(b?.slug,160) || name,
        image,
        dbImageKey,
        cleanString(b?.icon,80)||'fa-paw',
        cleanString(b?.color,120)||'from-orange-500 to-amber-500',
        new Date().toISOString(),
        id
      ).run();
    return json({ ok:true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_CATEGORY_UPDATE_ERROR', error);
    const dbError = extractDbError(error);
    return bad(`به‌روزرسانی دسته‌بندی انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_CATEGORY_UPDATE_FAILED', errorDetails: { operation: 'category.update', database: dbError.message } });
  }
}
