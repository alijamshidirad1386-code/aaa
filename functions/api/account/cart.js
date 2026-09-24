import { bad, ensureCustomerSchema, json, requireCustomer, sameOriginRequest } from '../_shared.js';
export async function onRequestPut(context) {
  if (!sameOriginRequest(context.request)) return bad('درخواست نامعتبر است.',403);
  const customer=await requireCustomer(context); if(!customer) return bad('نیاز به ورود به حساب کاربری دارید.',401);
  const body=await context.request.json().catch(()=>null); const items=Array.isArray(body?.items)?body.items:[];
  if(items.length>100) return bad('سبد خرید بیش از حد بزرگ است.');
  await ensureCustomerSchema(context.env.DB);
  const clean=[];
  for(const item of items){ const id=String(item?.id||'').trim().slice(0,120); const quantity=Math.min(99,Math.max(1,Math.floor(Number(item?.quantity)||1))); if(!id) continue; const p=await context.env.DB.prepare('SELECT id FROM products WHERE id=? LIMIT 1').bind(id).first(); if(p) clean.push({id,quantity}); }
  await context.env.DB.prepare('DELETE FROM customer_cart WHERE customer_id=?').bind(customer.id).run();
  if(clean.length){ const now=new Date().toISOString(); for(const item of clean) await context.env.DB.prepare('INSERT INTO customer_cart(customer_id,product_id,quantity,updated_at) VALUES(?,?,?,?)').bind(customer.id,item.id,item.quantity,now).run(); }
  return json({ok:true,items:clean});
}
