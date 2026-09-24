import { bad, cleanString, ensureReviewSchema, json, requireJson, sha256Hex } from './_shared.js';

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch (_) { return false; }
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return bad('درخواست نامعتبر است.', 403);
  const body = await requireJson(context.request);
  if (!body || typeof body !== 'object') return bad('اطلاعات ارسالی نامعتبر است.');

  // Honeypot: real users leave this empty; bots commonly populate hidden website fields.
  if (cleanString(body.website, 200)) return json({ ok: true, message: 'نظر دریافت شد.' }, 202);

  const productId = cleanString(body.productId, 120);
  const customerName = cleanString(body.customerName, 80);
  const reviewText = cleanString(body.reviewText, 2000);
  const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 5)));
  if (!productId || !customerName || reviewText.length < 5) return bad('نام، امتیاز و متن نظر الزامی است.');
  if (customerName.length < 2) return bad('نام نمایشی کوتاه است.');

  if (!context.env?.DB) return bad('اتصال فروشگاه به Cloudflare D1 برقرار نیست.', 500);
  try {
    await ensureReviewSchema(context.env.DB);
  } catch (schemaError) {
    console.error('PetRaPet review schema error:', schemaError);
    return bad('ساختار بخش نظرات در دیتابیس آماده نیست. لطفاً دوباره تلاش کنید.', 503);
  }
  let product;
  try {
    product = await context.env.DB.prepare('SELECT id FROM products WHERE id=? LIMIT 1').bind(productId).first();
  } catch (dbError) {
    console.error('PetRaPet review product lookup error:', dbError);
    return bad('خواندن اطلاعات محصول از دیتابیس انجام نشد.', 503);
  }
  if (!product) return bad('محصول پیدا نشد.', 404);

  const rawIp = context.request.headers.get('CF-Connecting-IP') || context.request.headers.get('X-Forwarded-For') || 'unknown';
  const userAgent = context.request.headers.get('User-Agent') || '';
  const fingerprint = await sha256Hex(`${rawIp}|${userAgent.slice(0,240)}`);
  const dayAgo = Date.now() - (24 * 60 * 60 * 1000);

  // The anti-spam log is deliberately best-effort: an old D1 schema must never block
  // the actual review insert. The review itself is written first as the source of truth.
  try {
    const recentForProduct = await context.env.DB.prepare('SELECT COUNT(*) AS count FROM review_submission_log WHERE fingerprint=? AND product_id=? AND created_at>?').bind(fingerprint, productId, dayAgo).first();
    if (Number(recentForProduct?.count) > 0) return bad('برای این محصول در ۲۴ ساعت اخیر یک نظر از این دستگاه ثبت شده است.', 429);
    const recentTotal = await context.env.DB.prepare('SELECT COUNT(*) AS count FROM review_submission_log WHERE fingerprint=? AND created_at>?').bind(fingerprint, dayAgo).first();
    if (Number(recentTotal?.count) >= 6) return bad('تعداد ارسال نظر در ۲۴ ساعت اخیر زیاد است. بعداً دوباره امتحان کنید.', 429);
  } catch (rateError) {
    console.warn('PetRaPet review anti-spam log unavailable:', rateError);
  }

  const now = new Date().toISOString();
  const id = `review_${crypto.randomUUID()}`;
  try {
    await context.env.DB.prepare('INSERT INTO product_reviews(id,product_id,customer_name,rating,review_text,photo_url,approved,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(id, productId, customerName, rating, reviewText, '', 0, now).run();
  } catch (insertError) {
    console.error('PetRaPet review insert error:', insertError);
    return bad('ثبت نظر در دیتابیس انجام نشد. لطفاً دوباره تلاش کنید.', 503);
  }

  try {
    await context.env.DB.prepare('INSERT INTO review_submission_log(id,fingerprint,product_id,created_at) VALUES(?,?,?,?)')
      .bind(`reviewlog_${crypto.randomUUID()}`, fingerprint, productId, Date.now()).run();
  } catch (logError) {
    console.warn('PetRaPet review log write skipped:', logError);
  }

  return json({ ok: true, pending: true, message: 'نظر شما ثبت شد و پس از بررسی فروشگاه منتشر می‌شود.' }, 202);
}
