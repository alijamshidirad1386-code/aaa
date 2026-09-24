import { bad, getStore, json, requireAdmin, requireJson, cleanString } from '../_shared.js';
export async function onRequestPost(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const b = await requireJson(context.request);
  const name = cleanString(b?.name,150); if (!name) return bad('نام دسته‌بندی الزامی است.');
  const id = cleanString(b?.id,100) || `cat_${crypto.randomUUID()}`;
  await context.env.DB.prepare(`INSERT INTO categories (id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,name,cleanString(b?.slug,160)||name,cleanString(b?.image,500000),cleanString(b?.imageKey,200),cleanString(b?.icon,80)||'fa-paw',cleanString(b?.color,120)||'from-orange-500 to-amber-500',Number(b?.sortOrder)||0,new Date().toISOString(),new Date().toISOString()).run();
  return json({ ok:true, store: await getStore(context.env.DB) });
}
