import { bad, cleanString, ensureReviewSchema, getStore, json, requireAdmin, requireJson } from '../_shared.js';

export async function onRequestGet(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  await ensureReviewSchema(context.env.DB);
  const rows = await context.env.DB.prepare(`SELECT r.id,r.product_id AS productId,p.name AS productName,r.customer_name AS customerName,r.rating,r.review_text AS reviewText,r.created_at AS createdAt,r.approved FROM product_reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC LIMIT 100`).all();
  return json({ ok:true, reviews:rows?.results||[] });
}


export async function onRequestPost(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const b = await requireJson(context);
  const productId = cleanString(b?.productId, 100);
  const customerName = cleanString(b?.customerName, 120);
  const reviewText = cleanString(b?.reviewText, 3000);
  if (!productId || !customerName || !reviewText) return bad('محصول، نام مشتری و متن نظر الزامی است.');
  const rating = Math.min(5, Math.max(1, Math.round(Number(b?.rating) || 5)));
  const id = `review_${crypto.randomUUID()}`;
  await ensureReviewSchema(context.env.DB);
  await context.env.DB.prepare(`INSERT INTO product_reviews(id,product_id,customer_name,rating,review_text,photo_url,approved,created_at) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(id, productId, customerName, rating, reviewText, cleanString(b?.photoUrl, 500000), b?.approved === false ? 0 : 1, new Date().toISOString()).run();
  await context.env.DB.prepare(`UPDATE product_details SET review_count=(SELECT COUNT(*) FROM product_reviews WHERE product_id=? AND approved=1), rating=COALESCE((SELECT ROUND(AVG(rating),2) FROM product_reviews WHERE product_id=? AND approved=1),0), updated_at=? WHERE product_id=?`).bind(productId, productId, new Date().toISOString(), productId).run();
  return json({ ok: true, store: await getStore(context.env.DB) });
}
