import { bad, ensureCustomerSchema, json, requireCustomer, sameOriginRequest } from '../_shared.js';
export async function onRequestPut(context) {
  if (!sameOriginRequest(context.request)) return bad('درخواست نامعتبر است.',403);
  if (!context.env?.DB) return bad('اتصال حساب کاربری به دیتابیس برقرار نیست.',500);
  const customer=await requireCustomer(context); if(!customer) return bad('نیاز به ورود به حساب کاربری دارید.',401);
  const body=await context.request.json().catch(()=>null); const productId=String(body?.productId||'').trim().slice(0,120); const active=Boolean(body?.active);
  if(!productId) return bad('محصول نامعتبر است.');
  await ensureCustomerSchema(context.env.DB);
  const exists=await context.env.DB.prepare('SELECT id FROM products WHERE id=? LIMIT 1').bind(productId).first(); if(!exists) return bad('محصول پیدا نشد.',404);
  if(active) await context.env.DB.prepare('INSERT OR IGNORE INTO customer_wishlist(customer_id,product_id,created_at) VALUES(?,?,?)').bind(customer.id,productId,new Date().toISOString()).run();
  else await context.env.DB.prepare('DELETE FROM customer_wishlist WHERE customer_id=? AND product_id=?').bind(customer.id,productId).run();
  return json({ok:true,active});
}
