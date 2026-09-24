import { onRequestGet as getStore } from './functions/api/store.js';
import { onRequestGet as getMedia } from './functions/api/media/[key].js';
import { onRequestPost as adminLogin } from './functions/api/admin/login.js';
import { onRequestPost as adminLogout } from './functions/api/admin/logout.js';
import { onRequestGet as adminMe } from './functions/api/admin/me.js';
import { onRequestPut as adminPassword } from './functions/api/admin/password.js';
import { onRequestPut as adminUsername } from './functions/api/admin/username.js';
import { onRequestPost as adminProductCreate } from './functions/api/admin/product.js';
import { onRequestPut as adminProductUpdate, onRequestDelete as adminProductDelete } from './functions/api/admin/product/[id].js';
import { onRequestPost as adminCategoryCreate } from './functions/api/admin/category.js';
import { onRequestPut as adminCategoryUpdate, onRequestDelete as adminCategoryDelete } from './functions/api/admin/category/[id].js';
import { onRequestPost as adminImport } from './functions/api/admin/import.js';
import { onRequestPost as adminReset } from './functions/api/admin/reset.js';
import { onRequestPost as adminUploadImage } from './functions/api/admin/upload-image.js';
import { onRequestPost as adminReviewCreate, onRequestGet as adminReviewList } from './functions/api/admin/review.js';
import { onRequestDelete as adminReviewDelete, onRequestPut as adminReviewModerate } from './functions/api/admin/review/[id].js';
import { onRequestPost as adminStoryCreate } from './functions/api/admin/story.js';
import { onRequestPost as publicReviewCreate } from './functions/api/review.js';
import { onRequestDelete as adminStoryDelete } from './functions/api/admin/story/[id].js';
import { onRequestPost as authRequestCode } from './functions/api/auth/request-code.js';
import { onRequestPost as authVerifyCode } from './functions/api/auth/verify-code.js';
import { onRequestPost as authPasswordLogin } from './functions/api/auth/password-login.js';
import { onRequestGet as authMe } from './functions/api/auth/me.js';
import { onRequestPut as authPassword } from './functions/api/auth/password.js';
import { onRequestPost as authLogout } from './functions/api/auth/logout.js';
import { onRequestGet as accountGet, onRequestPut as accountProfileUpdate } from './functions/api/account/index.js';
import { onRequestPut as accountFavorite } from './functions/api/account/favorites.js';
import { onRequestPut as accountCart } from './functions/api/account/cart.js';
import { onRequestPost as accountOrderRequest } from './functions/api/account/orders.js';
import { bad } from './functions/api/_shared.js';

function contextFor(request, env, executionCtx, params = {}) {
  return { request, env, params, waitUntil: executionCtx?.waitUntil?.bind(executionCtx), next: executionCtx?.passThroughOnException?.bind(executionCtx) };
}

async function healthHandler(context) {
  return new Response(JSON.stringify({
    ok: true,
    build: 'petrapet-media-edit-v7',
    d1: !!context.env.DB,
    emailProviderConfigured: Boolean(String(context.env.RESEND_API_KEY || '').trim() && String(context.env.AUTH_EMAIL_FROM || '').trim()),
    authPepperConfigured: String(context.env.AUTH_PEPPER || '').trim().length >= 24,
    webCrypto: !!globalThis.crypto?.subtle,
    pbkdf2: typeof crypto?.subtle?.deriveBits === 'function',
    pbkdf2Iterations: 100000
  }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}



function escapeHtmlServer(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
}

function buildProductSeoHtml(product, requestUrl) {
  const origin = new URL(requestUrl).origin;
  const canonical = `${origin}/product/${encodeURIComponent(String(product.id))}`;
  const title = `${product.name} | PetRaPet`;
  const description = String(product.shortDesc || product.fullDesc || 'خرید و مشخصات کامل محصول در پت‌شاپ PetRaPet').replace(/\s+/g, ' ').slice(0, 170);
  const image = String(product.image || '');
  const details = product.details || {};
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: image ? [image] : [],
    description,
    brand: details.brand ? { '@type': 'Brand', name: details.brand } : undefined,
    sku: details.barcode || product.id,
    offers: { '@type': 'Offer', priceCurrency: 'IRR', price: Number(product.finalPrice) || 0, availability: product.stockStatus === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', url: canonical },
    aggregateRating: Number(details.reviewCount) > 0 && Number(details.rating) > 0 ? { '@type':'AggregateRating', ratingValue:Number(details.rating), reviewCount:Number(details.reviewCount) } : undefined
  };
  const jsonLd = JSON.stringify(schema).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<title>${escapeHtmlServer(title)}</title><meta name="description" content="${escapeHtmlServer(description)}"><link rel="canonical" href="${escapeHtmlServer(canonical)}"><meta property="og:title" content="${escapeHtmlServer(title)}"><meta property="og:description" content="${escapeHtmlServer(description)}">${image ? `<meta property="og:image" content="${escapeHtmlServer(image)}">` : ''}<script type="application/ld+json">${jsonLd}</script>`;
}

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('cross-origin-opener-policy', 'same-origin');
  headers.set('cross-origin-resource-policy', 'same-site');
  headers.set('content-security-policy', "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:");
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function matchApi(url, request) {
  const p = url.pathname;
  const method = request.method.toUpperCase();

  if (p === '/api/health' && method === 'GET') return [healthHandler, {}];
  if (p === '/api/store' && method === 'GET') return [getStore, {}];
  if (p === '/api/review' && method === 'POST') return [publicReviewCreate, {}];
  if (p === '/api/auth/request-code' && method === 'POST') return [authRequestCode, {}];
  if (p === '/api/auth/verify-code' && method === 'POST') return [authVerifyCode, {}];
  if (p === '/api/auth/login-password' && method === 'POST') return [authPasswordLogin, {}];
  if (p === '/api/auth/me' && method === 'GET') return [authMe, {}];
  if (p === '/api/auth/password' && method === 'PUT') return [authPassword, {}];
  if (p === '/api/auth/logout' && method === 'POST') return [authLogout, {}];
  if (p === '/api/account' && method === 'GET') return [accountGet, {}];
  if (p === '/api/account' && method === 'PUT') return [accountProfileUpdate, {}];
  if (p === '/api/account/favorites' && method === 'PUT') return [accountFavorite, {}];
  if (p === '/api/account/cart' && method === 'PUT') return [accountCart, {}];
  if (p === '/api/account/orders' && method === 'POST') return [accountOrderRequest, {}];
  if (p === '/api/admin/login' && method === 'POST') return [adminLogin, {}];
  if (p === '/api/admin/logout' && method === 'POST') return [adminLogout, {}];
  if (p === '/api/admin/me' && method === 'GET') return [adminMe, {}];
  if (p === '/api/admin/password' && method === 'PUT') return [adminPassword, {}];
  if (p === '/api/admin/username' && method === 'PUT') return [adminUsername, {}];
  if (p === '/api/admin/product' && method === 'POST') return [adminProductCreate, {}];
  if (p === '/api/admin/category' && method === 'POST') return [adminCategoryCreate, {}];
  if (p === '/api/admin/import' && method === 'POST') return [adminImport, {}];
  if (p === '/api/admin/reset' && method === 'POST') return [adminReset, {}];
  if (p === '/api/admin/upload-image' && method === 'POST') return [adminUploadImage, {}];
  if (p === '/api/admin/review' && method === 'POST') return [adminReviewCreate, {}];
  if (p === '/api/admin/review' && method === 'GET') return [adminReviewList, {}];
  if (p === '/api/admin/story' && method === 'POST') return [adminStoryCreate, {}];

  let m = p.match(/^\/api\/admin\/product\/([^/]+)$/);
  if (m && method === 'PUT') return [adminProductUpdate, { id: decodeURIComponent(m[1]) }];
  if (m && method === 'DELETE') return [adminProductDelete, { id: decodeURIComponent(m[1]) }];

  m = p.match(/^\/api\/admin\/category\/([^/]+)$/);
  if (m && method === 'PUT') return [adminCategoryUpdate, { id: decodeURIComponent(m[1]) }];
  if (m && method === 'DELETE') return [adminCategoryDelete, { id: decodeURIComponent(m[1]) }];

  m = p.match(/^\/api\/admin\/review\/([^/]+)$/);
  if (m && method === 'DELETE') return [adminReviewDelete, { id: decodeURIComponent(m[1]) }];
  if (m && method === 'PUT') return [adminReviewModerate, { id: decodeURIComponent(m[1]) }];
  m = p.match(/^\/api\/admin\/story\/([^/]+)$/);
  if (m && method === 'DELETE') return [adminStoryDelete, { id: decodeURIComponent(m[1]) }];

  m = p.match(/^\/api\/media\/([A-Za-z0-9_-]{20,80})$/);
  if (m && method === 'GET') return [getMedia, { key: decodeURIComponent(m[1]) }];

  return null;
}

export default {
  async fetch(request, env, executionCtx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS' } });
      }

      if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
        const origin = request.headers.get('Origin');
        if (origin) {
          try { if (new URL(origin).origin !== url.origin) return addSecurityHeaders(bad('درخواست نامعتبر است.', 403)); }
          catch (_) { return addSecurityHeaders(bad('درخواست نامعتبر است.', 403)); }
        }
        const fetchSite = String(request.headers.get('Sec-Fetch-Site') || '').toLowerCase();
        if (fetchSite === 'cross-site') return addSecurityHeaders(bad('درخواست نامعتبر است.', 403));
      }

      const route = matchApi(url, request);
      if (!route) return addSecurityHeaders(bad('API route not found.', 404));

      try {
        return addSecurityHeaders(await route[0](contextFor(request, env, executionCtx, route[1])));
      } catch (error) {
        console.error('PetRaPet API error:', error);
        const message = String(error?.message || '');
        if (/D1 binding is missing|binding.*DB/i.test(message)) {
          return addSecurityHeaders(bad('اتصال Worker به Cloudflare D1 برقرار نیست. Binding با نام DB را بررسی کنید.', 500));
        }
        if (/EMAIL_PROVIDER_NOT_CONFIGURED/i.test(message)) {
          return addSecurityHeaders(bad('ارسال ایمیل هنوز در تنظیمات Worker فعال نشده است.', 503));
        }
        return addSecurityHeaders(bad('خطای داخلی سرور. لطفاً دوباره تلاش کنید.', 500));
      }
    }

    // Pretty product URLs are rewritten to the static product page without changing the visible URL.
    if (request.method.toUpperCase() === 'GET') {
      const productMatch = url.pathname.match(/^\/product\/([A-Za-z0-9_-]{1,120})$/);
      if (productMatch) {
        const rewritten = new URL(request.url);
        rewritten.pathname = '/product.html';
        rewritten.search = `?id=${encodeURIComponent(productMatch[1])}`;
        const assetResponse = await env.ASSETS.fetch(new Request(rewritten.toString(), request));
        if (!assetResponse.ok || !env.DB) return addSecurityHeaders(assetResponse);
        try {
          const store = await getStore(env.DB);
          const product = store.products?.find(item => String(item.id) === String(productMatch[1]));
          if (!product) return addSecurityHeaders(assetResponse);
          const html = await assetResponse.text();
          const seoHtml = buildProductSeoHtml(product, request.url);
          const hydrated = html.replace(/<head[^>]*>/i, match => `${match}${seoHtml}`);
          return addSecurityHeaders(new Response(hydrated, { status: 200, headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store' } }));
        } catch (seoError) {
          console.error('PetRaPet product SEO render error:', seoError);
          return addSecurityHeaders(assetResponse);
        }
      }
    }

    if (request.method.toUpperCase() === 'GET' && url.pathname === '/robots.txt') {
      const origin = url.origin;
      return addSecurityHeaders(new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`, { status: 200, headers: { 'content-type':'text/plain; charset=utf-8', 'cache-control':'public, max-age=3600, s-maxage=86400' } }));
    }

    if (request.method.toUpperCase() === 'GET' && url.pathname === '/sitemap.xml' && env.DB) {
      try {
        const rows = await env.DB.prepare('SELECT id,updated_at AS updatedAt FROM products ORDER BY id').all();
        const urls = [`${url.origin}/`, `${url.origin}/products.html`, `${url.origin}/about.html`, `${url.origin}/contact.html`];
        for (const row of rows?.results || []) urls.push(`${url.origin}/product/${encodeURIComponent(String(row.id))}`);
        const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${escapeHtmlServer(u)}</loc></url>`).join('')}</urlset>`;
        return addSecurityHeaders(new Response(body, { status:200, headers:{ 'content-type':'application/xml; charset=utf-8', 'cache-control':'public, max-age=600, s-maxage=3600' } }));
      } catch (_) {}
    }

    // Everything else is a static PetRaPet file served by Cloudflare Workers Static Assets.
    const asset = await env.ASSETS.fetch(request);
    const assetHeaders = new Headers(asset.headers);
    if (/\.(?:webp|avif|png|jpe?g|gif|svg|ico|woff2?|ttf)$/i.test(url.pathname)) {
      assetHeaders.set('cache-control', 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400');
    }
    return addSecurityHeaders(new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers: assetHeaders }));
  }
};
