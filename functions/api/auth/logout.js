import { clearCustomerSessionCookie, deleteCustomerSession, json, sameOriginRequest } from '../_shared.js';
export async function onRequestPost(context) {
  if (!sameOriginRequest(context.request)) return new Response(JSON.stringify({ok:false,error:'درخواست نامعتبر است.'}), {status:403,headers:{'content-type':'application/json; charset=utf-8'}});
  await deleteCustomerSession(context);
  return json({ok:true},200,{'set-cookie':clearCustomerSessionCookie()});
}
