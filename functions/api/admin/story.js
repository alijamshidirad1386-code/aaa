import { bad, cleanString, ensureExtendedSchema, getStore, json, requireAdmin, requireJson } from '../_shared.js';

export async function onRequestPost(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const b = await requireJson(context);
  const customerName = cleanString(b?.customerName, 120);
  const quote = cleanString(b?.quote, 1500);
  if (!customerName || !quote) return bad('نام مشتری و متن تجربه الزامی است.');
  const id = `story_${crypto.randomUUID()}`;
  await ensureExtendedSchema(context.env.DB);
  await context.env.DB.prepare(`INSERT INTO customer_stories(id,customer_name,cat_name,photo_url,quote,approved,created_at) VALUES(?,?,?,?,?,?,?)`)
    .bind(id, customerName, cleanString(b?.catName,120), cleanString(b?.photoUrl,500000), quote, b?.approved === false ? 0 : 1, new Date().toISOString()).run();
  return json({ ok: true, store: await getStore(context.env.DB) });
}
