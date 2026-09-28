import {
  bad,
  buildProductDetails,
  getStore,
  json,
  requireAdmin,
  requireJson,
  cleanString,
  upsertProductDetails,
  ensureProductWriteSchema,
  ensureMediaSchema,
  coerceDbValue,
  extractDbError,
  makeUniqueSlug
} from '../../_shared.js';

export async function onRequestPut(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const db = context.env.DB;
    if (!db) return bad('اتصال Worker به Cloudflare D1 برقرار نیست.', 500);
    await ensureProductWriteSchema(db);

    const idRaw = cleanString(context.params.id, 100);
    if (!idRaw) return bad('شناسه محصول نامعتبر است.');
    const id = await coerceDbValue(db, 'products', 'id', idRaw);
    const b = await requireJson(context.request);
    const name = cleanString(b?.name, 180);
    const requestedCategoryId = cleanString(b?.categoryId, 100);
    if (!name || !requestedCategoryId) return bad('نام محصول و دسته‌بندی الزامی است.');

    const categoryId = await coerceDbValue(db, 'products', 'category_id', requestedCategoryId);
    const categoryExists = await db.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1')
      .bind(await coerceDbValue(db, 'categories', 'id', requestedCategoryId)).first();
    if (!categoryExists) return bad('دسته‌بندی انتخاب‌شده در دیتابیس وجود ندارد.', 409, { errorCode: 'CATEGORY_NOT_FOUND' });

    const originalPrice = Math.max(0, Number(b?.originalPrice) || 0);
    const discountPercent = Math.min(90, Math.max(0, Number(b?.discountPercent) || 0));
    const finalPrice = Number.isFinite(Number(b?.finalPrice))
      ? Math.max(0, Number(b.finalPrice))
      : Math.round(originalPrice * (1 - discountPercent / 100));

    const imageKey = cleanString(b?.imageKey, 200);
    const dbImageKey = imageKey ? await coerceDbValue(db, 'products', 'image_key', imageKey) : '';
    if (imageKey) {
      await ensureMediaSchema(db);
      const mediaKey = await coerceDbValue(db, 'media_assets', 'id', imageKey);
      const media = await db.prepare('SELECT id FROM media_assets WHERE id = ? LIMIT 1').bind(mediaKey).first();
      if (!media) return bad('تصویر انتخاب‌شده در سرور پیدا نشد. دوباره تصویر را آپلود کنید.', 409, { errorCode: 'MEDIA_NOT_FOUND' });
    }

    const image = cleanString(b?.image, 500000) || (imageKey ? `/api/media/${encodeURIComponent(imageKey)}` : '');
    const requestedSlug = cleanString(b?.slug, 160) || cleanString(b?.details?.slug, 160) || name;
    const slug = await makeUniqueSlug(db, 'products', requestedSlug, { excludeId: id, fallback: 'product' });
    const result = await db.prepare(`UPDATE products SET
      name=?, slug=?, category_id=?, stock_status=?, original_price=?, discount_percent=?, final_price=?,
      is_featured=?, is_best_seller=?, is_new=?, image=?, image_key=?, short_desc=?, full_desc=?, updated_at=?
      WHERE id=?`)
      .bind(
        name,
        categoryId,
        cleanString(b?.stockStatus, 30) || 'in_stock',
        originalPrice,
        discountPercent,
        finalPrice,
        Boolean(b?.isFeatured) ? 1 : 0,
        Boolean(b?.isBestSeller) ? 1 : 0,
        Boolean(b?.isNew) ? 1 : 0,
        image,
        dbImageKey,
        cleanString(b?.shortDesc, 3000),
        cleanString(b?.fullDesc, 15000),
        new Date().toISOString(),
        id
      ).run();

    if (!Number(result?.meta?.changes ?? 0)) return bad('محصول موردنظر پیدا نشد.', 404);
    await upsertProductDetails(db, id, buildProductDetails({ ...(b?.details || b), slug }));
    return json({ ok: true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_PRODUCT_UPDATE_ERROR', error);
    const dbError = extractDbError(error);
    return bad(`به‌روزرسانی محصول انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, {
      errorCode: dbError.code || 'ADMIN_PRODUCT_UPDATE_FAILED',
      errorDetails: { operation: 'product.update', database: dbError.message }
    });
  }
}

export async function onRequestDelete(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const db = context.env.DB;
    if (!db) return bad('اتصال Worker به Cloudflare D1 برقرار نیست.', 500);
    const idRaw = cleanString(context.params.id, 100);
    if (!idRaw) return bad('شناسه محصول نامعتبر است.');
    await ensureProductWriteSchema(db);
    const id = await coerceDbValue(db, 'products', 'id', idRaw);
    const result = await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    if (!Number(result?.meta?.changes ?? 0)) return bad('محصول موردنظر پیدا نشد.', 404);
    return json({ ok: true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_PRODUCT_DELETE_ERROR', error);
    const dbError = extractDbError(error);
    return bad(`حذف محصول انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, {
      errorCode: dbError.code || 'ADMIN_PRODUCT_DELETE_FAILED',
      errorDetails: { operation: 'product.delete', database: dbError.message }
    });
  }
}
