import { bad, ensureCustomerSchema, json, requireCustomer, sameOriginRequest } from '../_shared.js';

export async function onRequestGet(context) {
  if (!context.env?.DB) return bad('اتصال حساب کاربری به دیتابیس برقرار نیست.', 500);
  const customer = await requireCustomer(context);
  if (!customer) return json({ ok:true, authenticated:false });
  await ensureCustomerSchema(context.env.DB);
  const [favorites, cart, orders] = await Promise.all([
    context.env.DB.prepare('SELECT product_id AS productId FROM customer_wishlist WHERE customer_id=? ORDER BY created_at DESC').bind(customer.id).all(),
    context.env.DB.prepare(`SELECT c.product_id AS productId,c.quantity,p.name,p.final_price AS price,p.image,p.stock_status AS stockStatus FROM customer_cart c LEFT JOIN products p ON p.id=c.product_id WHERE c.customer_id=? ORDER BY c.updated_at DESC`).bind(customer.id).all(),
    context.env.DB.prepare('SELECT id,channel,status,total_amount AS totalAmount,items_json AS itemsJson,created_at AS createdAt FROM customer_order_requests WHERE customer_id=? ORDER BY created_at DESC LIMIT 20').bind(customer.id).all()
  ]);
  return json({ ok:true, authenticated:true, profile:profile(customer), favoriteIds:(favorites?.results||[]).map(r=>String(r.productId)), cart:(cart?.results||[]).filter(r=>r.name).map(r=>({id:String(r.productId),name:String(r.name),price:Number(r.price)||0,image:String(r.image||''),quantity:Math.max(1,Number(r.quantity)||1),stockStatus:String(r.stockStatus||'in_stock')})), orders:(orders?.results||[]).map(r=>({id:r.id,channel:r.channel,status:r.status,totalAmount:Number(r.totalAmount)||0,createdAt:r.createdAt,items:parseItems(r.itemsJson)})) });
}

export async function onRequestPut(context) {
  if (!sameOriginRequest(context.request)) return bad('درخواست نامعتبر است.',403);
  const customer = await requireCustomer(context);
  if (!customer) return bad('نیاز به ورود به حساب کاربری دارید.',401);
  const body = await context.request.json().catch(()=>null);
  const name = String(body?.displayName || '').trim().slice(0,80);
  if (name.length < 2) return bad('نام نمایشی باید حداقل ۲ کاراکتر باشد.');
  await ensureCustomerSchema(context.env.DB);
  await context.env.DB.prepare('UPDATE customers SET display_name=?,updated_at=? WHERE id=?').bind(name,new Date().toISOString(),customer.id).run();
  return json({ok:true,displayName:name});
}

function profile(row){ return {id:row.id,email:row.email||'',displayName:row.displayName||'کاربر PetRaPet',emailVerified:Boolean(row.emailVerified),hasPassword:Boolean(row.passwordHash)}; }
function parseItems(v){ try { const x=JSON.parse(String(v||'[]')); return Array.isArray(x)?x:[]; } catch(_){ return []; } }
