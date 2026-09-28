import { bad, cleanString, ensureExtendedSchema, getStore, json, requireAdmin, extractDbError } from '../../_shared.js';
export async function onRequestDelete(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const id = cleanString(context.params.id, 120);
    if (!id) return bad('شناسه تجربه نامعتبر است.');
    await ensureExtendedSchema(context.env.DB);
    const result = await context.env.DB.prepare('DELETE FROM customer_stories WHERE id=?').bind(id).run();
    if (!Number(result?.meta?.changes ?? 0)) return bad('تجربه موردنظر پیدا نشد.', 404);
    return json({ ok: true, store: await getStore(context.env.DB) });
  } catch (error) {
    const dbError = extractDbError(error);
    console.error('ADMIN_STORY_DELETE_ERROR', error);
    return bad(`حذف تجربه مشتری انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_STORY_DELETE_FAILED', errorDetails: { operation: 'story.delete', database: dbError.message } });
  }
}
