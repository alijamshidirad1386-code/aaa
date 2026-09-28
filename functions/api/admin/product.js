import { bad, buildProductDetails, getStore, json, requireAdmin, requireJson, cleanString, ensureExtendedSchema, ensureMediaSchema } from '../_shared.js';

export async function onRequestPost(context) {
  try {
    const admin = await requireAdmin(context);
    if (!admin) return bad('نیاز به ورود مدیر دارید.', 401);
    if (!context.env?.DB) return bad('اتصال Worker به Cloudflare D1 برقرار نیست.', 500);
    const b = await requireJson(context.request);
    if (!b || typeof b !== 'object') return bad('داده محصول نامعتبر است.');

    const id = cleanString(b?.id, 100) || `prod_${crypto.randomUUID()}`;
    const name = cleanString(b?.name, 180);
    const categoryId = cleanString(b?.categoryId, 100);
    if (!name || !categoryId) return bad('نام محصول و دسته‌بندی الزامی است.');

    const db = context.env.DB;
    await ensureExtendedSchema(db);
    const category = await db.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1').bind(categoryId).first();
    if (!category) return bad('دسته‌بندی انتخاب‌شده در دیتابیس وجود ندارد. ابتدا دسته‌بندی را ذخیره یا صفحه را تازه‌سازی کنید.', 409);

    const imageKey = cleanString(b?.imageKey, 200);
    if (imageKey) {
      await ensureMediaSchema(db);
      const media = await db.prepare('SELECT id FROM media_assets WHERE id = ? LIMIT 1').bind(imageKey).first();
      if (!media) return bad('تصویر انتخاب‌شده در سرور پیدا نشد. دوباره تصویر را آپلود کنید.', 409);
    }

    const originalPrice = Math.max(0, Number(b?.originalPrice) || 0);
    const discountPercent = Math.min(90, Math.max(0, Number(b?.discountPercent) || 0));
    const finalPrice = Number.isFinite(Number(b?.finalPrice)) ? Math.max(0, Number(b.finalPrice)) : Math.round(originalPrice * (1 - discountPercent / 100));
    const now = new Date().toISOString();
    const details = buildProductDetails(b?.details || b);

    await db.batch([
      db.prepare(`INSERT INTO products
        (id,name,category_id,stock_status,original_price,discount_percent,final_price,is_featured,is_best_seller,is_new,image,image_key,short_desc,full_desc,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, name, categoryId, cleanString(b?.stockStatus, 30) || 'in_stock', originalPrice, discountPercent, finalPrice,
          Boolean(b?.isFeatured) ? 1 : 0, Boolean(b?.isBestSeller) ? 1 : 0, Boolean(b?.isNew) ? 1 : 0,
          cleanString(b?.image, 500000) || (imageKey ? `/api/media/${imageKey}` : ''), imageKey,
          cleanString(b?.shortDesc, 3000), cleanString(b?.fullDesc, 15000), now, now),
      db.prepare(`INSERT INTO product_details(
        product_id,slug,brand,weight,volume,flavor,suitable_age,goals,ingredients,nutrition_analysis,country,barcode,expiry_date,
        usage_method,warranty,storage,authenticity,actual_stock,min_stock,restock_time,rating,review_count,sales_count,more_images_json,
        faq_json,related_ids_json,tags_json,consumable,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, details.slug, details.brand, details.weight, details.volume, details.flavor, details.suitableAge, details.goals,
          details.ingredients, details.nutritionAnalysis, details.country, details.barcode, details.expiryDate, details.usageMethod,
          details.warranty, details.storage, details.authenticity, details.actualStock, details.minStock, details.restockTime, details.rating,
          details.reviewCount, details.salesCount, JSON.stringify(details.moreImages), JSON.stringify(details.faq), JSON.stringify(details.relatedIds),
          JSON.stringify(details.tags), details.consumable ? 1 : 0, now, now)
    ]);

    return json({ ok: true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_PRODUCT_CREATE_ERROR', error);
    return bad('ذخیره محصول انجام نشد: ' + String(error?.message || error), 500);
  }
}
