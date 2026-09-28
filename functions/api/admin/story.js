import { bad, cleanString, ensureExtendedSchema, getStore, json, requireAdmin, requireJson, extractDbError } from '../_shared.js';

export async function onRequestPost(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const b = await requireJson(context.request);
    const customerName = cleanString(b?.customerName, 120);
    const quote = cleanString(b?.quote, 1500);
    if (!customerName || !quote) return bad('نام مشتری و متن تجربه الزامی است.');
    const id = `story_${crypto.randomUUID()}`;
    await ensureExtendedSchema(context.env.DB);
    await context.env.DB.prepare(`INSERT INTO customer_stories(id,customer_name,cat_name,photo_url,quote,approved,created_at) VALUES(?,?,?,?,?,?,?)`)
      .bind(id, customerName, cleanString(b?.catName,120), cleanString(b?.photoUrl,500000), quote, b?.approved === false ? 0 : 1, new Date().toISOString()).run();
    return json({ ok: true, store: await getStore(context.env.DB) });
  } catch (error) {
    const dbError = extractDbError(error);
    console.error('ADMIN_STORY_CREATE_ERROR', error);
    return bad(`ثبت تجربه مشتری انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_STORY_CREATE_FAILED', errorDetails: { operation: 'story.create', database: dbError.message } });
  }
}
