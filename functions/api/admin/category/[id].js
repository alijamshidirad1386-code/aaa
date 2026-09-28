import { bad, getStore, json, requireAdmin, requireJson, cleanString, ensureBaseStoreSchema, ensureMediaSchema } from '../../_shared.js';

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
    const id = cleanString(context.params?.id, 100);
    if (!id) return bad('شناسه دسته‌بندی نامعتبر است.');
    const used = await db.prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ?').bind(id).first();
    if (Number(used?.c || 0) > 0) return bad('این دسته‌بندی هنوز محصول دارد و قابل حذف نیست.', 409);
    const result = await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    if (!Number(result?.meta?.changes ?? 0)) return bad('دسته‌بندی موردنظر در دیتابیس پیدا نشد.', 404);
    return json({ ok:true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_CATEGORY_DELETE_ERROR', error);
    return bad(`حذف دسته‌بندی انجام نشد: ${String(error?.message || error || 'خطای نامشخص').slice(0, 300)}`, 500, { errorCode: 'ADMIN_CATEGORY_DELETE_FAILED' });
  }
}

export async function onRequestPut(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const db = context.env?.DB;
    if (!db) return bad('اتصال Worker به Cloudflare D1 برقرار نیست.', 500);
    await ensureBaseStoreSchema(db);
    const b = await requireJson(context.request);
    const id = cleanString(context.params?.id, 100);
    if (!id) return bad('شناسه دسته‌بندی نامعتبر است.');
    const existing = await db.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1').bind(id).first();
    if (!existing) return bad('دسته‌بندی موردنظر در دیتابیس پیدا نشد. صفحه را تازه‌سازی کنید.', 404);

    const imageKey = cleanString(b?.imageKey, 200);
    if (imageKey) {
      await ensureMediaSchema(db);
      const media = await db.prepare('SELECT id FROM media_assets WHERE id = ? LIMIT 1').bind(imageKey).first();
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
        imageKey,
        cleanString(b?.icon,80)||'fa-paw',
        cleanString(b?.color,120)||'from-orange-500 to-amber-500',
        new Date().toISOString(),
        id
      ).run();
    return json({ ok:true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_CATEGORY_UPDATE_ERROR', error);
    return bad(`به‌روزرسانی دسته‌بندی انجام نشد: ${String(error?.message || error || 'خطای نامشخص').slice(0, 300)}`, 500, { errorCode: 'ADMIN_CATEGORY_UPDATE_FAILED' });
  }
}
