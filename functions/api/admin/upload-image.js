import { bad, json, requireAdmin, ensureBaseStoreSchema, ensureMediaSchema, isIntegerPrimaryKey, getColumnKind, getNextCompatibleTextId, extractDbError } from "../_shared.js";

const MAX_IMAGE_BYTES = 1800000; // keep a safety margin below D1's 2,000,000-byte BLOB/row limit

function detectImageMime(bytes, declared) {
  const b = new Uint8Array(bytes);
  const starts = (...values) => values.every((v, i) => b[i] === v);
  if (starts(0x52,0x49,0x46,0x46) && startsAt(8,0x57,0x45,0x42,0x50)) return 'image/webp';
  if (starts(0xFF,0xD8,0xFF)) return 'image/jpeg';
  if (starts(0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A)) return 'image/png';
  if (starts(0x47,0x49,0x46,0x38,0x37,0x61) || starts(0x47,0x49,0x46,0x38,0x39,0x61)) return 'image/gif';
  if (b.length >= 16 && String.fromCharCode(...b.slice(4,8)) === 'ftyp') {
    const brand = String.fromCharCode(...b.slice(8,12));
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return allowedDeclared(declared);
  function allowedDeclared(value) { return ['image/webp','image/jpeg','image/png','image/avif','image/gif'].includes(value) ? value : ""; }
  function startsAt(offset, ...values) { return values.every((v, i) => b[offset+i] === v); }
}

export async function onRequestPost(context) {
  if (!context.env?.DB) return bad("اتصال Worker به Cloudflare D1 برقرار نیست. Binding با نام DB را بررسی کنید.", 500);
  if (!(await requireAdmin(context))) return bad("نیاز به ورود مدیر دارید.", 401);
  const form = await context.request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return bad("فایل تصویر ارسال نشده است.");
  const declaredMime = String(file.type || "").toLowerCase();
  const allowedInput = new Set(["image/webp", "image/jpeg", "image/png", "image/avif", "image/gif"]);
  if (declaredMime && !allowedInput.has(declaredMime)) return bad("فرمت تصویر پشتیبانی نمی‌شود. JPG، PNG، WebP یا AVIF انتخاب کنید.");
  if (file.size > MAX_IMAGE_BYTES) return bad("حجم تصویر برای ذخیره در دیتابیس زیاد است. تصویر را کوچک‌تر انتخاب کنید.");

  const randomKey = crypto.randomUUID().replaceAll("-", "");
  const bytes = await file.arrayBuffer();
  const inputMime = detectImageMime(bytes, declaredMime || "image/webp");
  if (!inputMime || !allowedInput.has(inputMime)) return bad("محتوای فایل تصویر معتبر نیست. لطفاً یک JPG، PNG، WebP یا AVIF واقعی انتخاب کنید.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) return bad("حجم تصویر برای ذخیره در دیتابیس زیاد است. تصویر کوچک‌تر انتخاب کنید.");

  let key = '';
  try {
    // Make the dependent image_key columns visible before choosing an ID shape.
    // This is important for mixed legacy schemas where media_assets.id is TEXT
    // but category/product image_key is INTEGER.
    await ensureBaseStoreSchema(context.env.DB);
    await ensureMediaSchema(context.env.DB);
    const integerId = await isIntegerPrimaryKey(context.env.DB, 'media_assets', 'id');
    if (integerId) {
      const result = await context.env.DB.prepare(`
        INSERT INTO media_assets (mime_type, size_bytes, data, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(inputMime, bytes.byteLength, bytes, new Date().toISOString()).run();
      key = String(result?.meta?.last_row_id || '');
      if (!key) throw new Error('شناسه عددی تصویر پس از ذخیره‌سازی قابل دریافت نیست.');
    } else {
      const categoryImageKind = await getColumnKind(context.env.DB, 'categories', 'image_key');
      const productImageKind = await getColumnKind(context.env.DB, 'products', 'image_key');
      const needsNumericKey = [categoryImageKind, productImageKind].some(k => k === 'integer-primary-key' || k === 'integer');
      key = needsNumericKey ? await getNextCompatibleTextId(context.env.DB, 'media_assets', 'id') : randomKey;
      await context.env.DB.prepare(`
        INSERT INTO media_assets (id, mime_type, size_bytes, data, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(key, inputMime, bytes.byteLength, bytes, new Date().toISOString()).run();
    }
  } catch (error) {
    console.error('ADMIN_MEDIA_UPLOAD_ERROR', error);
    const dbError = extractDbError(error);
    return bad(`ذخیره تصویر در D1 انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_MEDIA_UPLOAD_FAILED', errorDetails: { operation: 'media.upload', database: dbError.message } });
  }

  const url = `/api/media/${key}`;
  return json({ ok: true, key, url, mimeType: inputMime, size: bytes.byteLength });
}
