import { bad, json, requireAdmin } from "../_shared.js";

const MAX_IMAGE_BYTES = 1800000; // safely below D1's 2,000,000-byte BLOB/row limit

export async function onRequestPost(context) {
  if (!(await requireAdmin(context))) return bad("نیاز به ورود مدیر دارید.", 401);
  const form = await context.request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return bad("فایل تصویر ارسال نشده است.");
  const inputMime = String(file.type || "").toLowerCase();
  const allowedInput = new Set(["image/webp", "image/jpeg", "image/png", "image/avif", "image/gif"]);
  if (!allowedInput.has(inputMime)) return bad("فرمت تصویر پشتیبانی نمی‌شود. JPG، PNG، WebP یا AVIF انتخاب کنید.");
  if (file.size > MAX_IMAGE_BYTES) return bad("حجم تصویر برای ذخیره در دیتابیس زیاد است. تصویر را کوچک‌تر انتخاب کنید.");

  const key = crypto.randomUUID().replaceAll("-", "");
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) return bad("حجم تصویر برای ذخیره در دیتابیس زیاد است. تصویر کوچک‌تر انتخاب کنید.");

  try {
    await context.env.DB.prepare(`
      INSERT INTO media_assets (id, mime_type, size_bytes, data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(key, inputMime, bytes.byteLength, bytes, new Date().toISOString()).run();
  } catch (error) {
    console.error(error);
    return bad("ذخیره تصویر در D1 انجام نشد. مطمئن شوید جدول media_assets ساخته شده است و تصویر زیر ۲ مگابایت است.", 500);
  }

  const url = `/api/media/${key}`;
  return json({ ok: true, key, url, mimeType: inputMime, size: bytes.byteLength });
}
