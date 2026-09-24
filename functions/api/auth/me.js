import { json, requireCustomer } from '../_shared.js';
export async function onRequestGet(context) {
  const customer = await requireCustomer(context);
  if (!customer) return json({ ok:true, authenticated:false });
  return json({ ok:true, authenticated:true, profile:{ id:customer.id, email:customer.email||'', displayName:customer.displayName||'کاربر PetRaPet', emailVerified:Boolean(customer.emailVerified), hasPassword:Boolean(customer.passwordHash) } });
}
