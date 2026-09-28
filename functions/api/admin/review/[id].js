import { bad, cleanString, ensureExtendedSchema, getStore, json, requireAdmin, coerceDbValue, extractDbError } from '../../_shared.js';

async function refreshProductRating(db, rawProductId) {
  const reviewProductId = await coerceDbValue(db, 'product_reviews', 'product_id', rawProductId);
  const detailProductId = await coerceDbValue(db, 'product_details', 'product_id', rawProductId);
  await db.prepare(`UPDATE product_details SET
    review_count=(SELECT COUNT(*) FROM product_reviews WHERE product_id=? AND approved=1),
    rating=COALESCE((SELECT ROUND(AVG(rating),2) FROM product_reviews WHERE product_id=? AND approved=1),0),
    updated_at=? WHERE product_id=?`)
    .bind(reviewProductId, reviewProductId, new Date().toISOString(), detailProductId).run();
}

export async function onRequestDelete(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const id = cleanString(context.params.id, 120);
    if (!id) return bad('شناسه نظر نامعتبر است.');
    await ensureExtendedSchema(context.env.DB);
    const row = await context.env.DB.prepare('SELECT product_id AS productId FROM product_reviews WHERE id=?').bind(id).first();
    if (!row) return bad('نظر پیدا نشد.', 404);
    await context.env.DB.prepare('DELETE FROM product_reviews WHERE id=?').bind(id).run();
    if (row?.productId != null && String(row.productId) !== '') await refreshProductRating(context.env.DB, row.productId);
    return json({ ok: true, store: await getStore(context.env.DB) });
  } catch (error) {
    const dbError = extractDbError(error);
    console.error('ADMIN_REVIEW_DELETE_ERROR', error);
    return bad(`حذف نظر انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_REVIEW_DELETE_FAILED', errorDetails: { operation: 'review.delete', database: dbError.message } });
  }
}

export async function onRequestPut(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const id = cleanString(context.params.id, 120);
    if (!id) return bad('شناسه نظر نامعتبر است.');
    const body = await context.request.json().catch(() => null);
    if (!body || typeof body !== 'object') return bad('داده نظر نامعتبر است.');
    const approved = body?.approved ? 1 : 0;
    await ensureExtendedSchema(context.env.DB);
    const row = await context.env.DB.prepare('SELECT product_id AS productId FROM product_reviews WHERE id=?').bind(id).first();
    if (!row) return bad('نظر پیدا نشد.', 404);
    await context.env.DB.prepare('UPDATE product_reviews SET approved=? WHERE id=?').bind(approved, id).run();
    if (row?.productId != null && String(row.productId) !== '') await refreshProductRating(context.env.DB, row.productId);
    return json({ ok: true, store: await getStore(context.env.DB) });
  } catch (error) {
    const dbError = extractDbError(error);
    console.error('ADMIN_REVIEW_UPDATE_ERROR', error);
    return bad(`به‌روزرسانی نظر انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_REVIEW_UPDATE_FAILED', errorDetails: { operation: 'review.update', database: dbError.message } });
  }
}
