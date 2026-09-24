import { bad, ensureCustomerSchema, json, requireCustomer, sameOriginRequest } from '../_shared.js';
export async function onRequestPost(context){
  if(!sameOriginRequest(context.request)) return bad('درخواست نامعتبر است.',403);
  if(!context.env?.DB) return bad('اتصال حساب کاربری به دیتابیس برقرار نیست.',500);
  const customer=await requireCustomer(context); if(!customer) return bad('برای ثبت سابقه سفارش باید وارد حساب شوید.',401);
  const body=await context.request.json().catch(()=>null); const channel=body?.channel==='rubika'?'rubika':'instagram'; const items=Array.isArray(body?.items)?body.items:[];
  if(!items.length || items.length>100) return bad('سبد خرید خالی یا نامعتبر است.');
  await ensureCustomerSchema(context.env.DB);
  const clean=[]; let total=0;
  for(const raw of items){ const id=String(raw?.id||'').trim().slice(0,120); const quantity=Math.min(99,Math.max(1,Math.floor(Number(raw?.quantity)||1))); if(!id) continue; const p=await context.env.DB.prepare('SELECT id,final_price AS price FROM products WHERE id=? LIMIT 1').bind(id).first(); if(!p) continue; clean.push({id,quantity}); total += (Number(p.price)||0)*quantity; }
  if(!clean.length) return bad('محصولات سبد خرید معتبر نیستند.');
  const id=`orderreq_${crypto.randomUUID()}`; await context.env.DB.prepare('INSERT INTO customer_order_requests(id,customer_id,channel,status,total_amount,items_json,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,customer.id,channel,'pending_contact',total,JSON.stringify(clean),new Date().toISOString()).run();
  return json({ok:true,orderId:id});
}
