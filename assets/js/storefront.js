/* PetraPet storefront enhancements. This file is intentionally additive and keeps the original catalog/cart API intact. */
(() => {
  if (window.__PETRAPET_ENHANCED__) return;
  window.__PETRAPET_ENHANCED__ = true;

  const LS_WISHLIST = 'foxshop_wishlist_v1';
  const LS_COMPARE = 'foxshop_compare_v1';
  const LS_RESTOCK = 'foxshop_restock_v1';
  const FREE_SHIPPING_DEFAULT = 3900000;
  const SHOP_LOCATION = 'تبریز، ایران';
  const INSTAGRAM_URL = 'https://www.instagram.com/petra_petclinic?stkn=MTVmM2Q4ZGhqNjloMw==';
  const RUBIKA_URL = 'https://rubika.ir/petrapet';
  const WHATSAPP_URL = 'https://wa.me/989960494973';
  const TELEGRAM_URL = 'https://t.me/petrapetshop';

  function readList(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
    } catch (_) { return []; }
  }
  function writeList(key, list) { try { localStorage.setItem(key, JSON.stringify([...new Set(list)])); } catch (_) {} }
  function getWishlist() { return readList(LS_WISHLIST); }
  function getCompare() { return readList(LS_COMPARE); }
  function getRestock() { return readList(LS_RESTOCK); }

  function getProduct(id) {
    if (!Array.isArray(window.products)) return null;
    const key = String(id ?? '').trim();
    if (!key) return null;
    return window.products.find(p => String(p?.id ?? '').trim() === key) || null;
  }
  function d(p) { return p?.details || {}; }
  // Use the static product page as the client link target. This works both on Cloudflare
  // Workers (pretty URLs are still supported there) and on a plain static asset deployment.
  function productUrl(p) { return `product.html?id=${encodeURIComponent(String(p.id))}`; }
  function isConsumable(p) {
    if (!p) return false;
    const x = d(p);
    if (x.consumable) return true;
    const hay = `${p.name || ''} ${p.categoryId || ''} ${x.tags || ''}`.toLowerCase();
    return /food|litter|malt|treat|cat_dry_food|cat_wet_food|cat_litter|cat_treats|cat_supplements/.test(hay);
  }
  function inferredDetails(p) {
    const x = d(p);
    const name = String(p?.name || '');
    const out = { ...x };
    if (!out.brand) {
      const m = name.match(/(Royal Canin|GimCat|Schesir|Wanpy|Van Cat|Smart Paw|رویال کنین|جیم کت|شسیر|وانپی|ون کت)/i);
      out.brand = m ? m[1] : '';
    }
    if (!out.weight) {
      const m = name.match(/(?:وزن|weight)\s*([0-9۰-۹]+(?:[.,][0-9۰-۹]+)?\s*(?:کیلوگرم|kg|کیلو|گرم|g))/i);
      if (m) out.weight = m[1];
    }
    if (!out.suitableAge) {
      if (/kitten|بچه گربه/i.test(name)) out.suitableAge = 'بچه‌گربه';
      else if (/۱ تا ۷ سال|1\s*تا\s*7|adult|بالغ/i.test(name)) out.suitableAge = 'گربه بالغ';
    }
    if (!out.authenticity) out.authenticity = 'اطلاعات اصالت و تاریخ انقضا متناسب با کالای موجود قابل ارائه است.';
    return out;
  }

  function formatDateFa() {
    try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date()); }
    catch (_) { return new Date().toLocaleDateString('fa-IR'); }
  }

  function freeShippingThreshold() {
    return 3900000;
  }

  function shippingMessage(total = 0) {
    const threshold = freeShippingThreshold();
    if (total >= threshold) return 'هزینه ارسال برای این سبد به حد ارسال رایگان رسیده است.';
    const remaining = threshold - total;
    return `${window.formatPrice(remaining)} تومان تا ارسال رایگان باقی مانده است.`;
  }

  function safeText(text) { return typeof window.escapeHtml === 'function' ? window.escapeHtml(text) : String(text ?? ''); }


  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/[\u064A\u06CC]/g, 'ی')
      .replace(/[\u0643\u06A9]/g, 'ک')
      .replace(/[\u0629\u06C0\u06C1]/g, 'ه')
      .replace(/[\u0624]/g, 'و')
      .replace(/[\u0623\u0625\u0622\u0671]/g, 'ا')
      .replace(/\u0640/g, '')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[\u200c\u200d]/g, ' ')
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function searchTokens(value) {
    return normalizeSearchText(value).split(' ').filter(Boolean);
  }

  const searchDocumentCache = new WeakMap();
  function productSearchFields(p) {
    const x = inferredDetails(p);
    const categoryName = (window.categories || []).find(c => c.id === p?.categoryId)?.name || '';
    return {
      name: normalizeSearchText(p?.name),
      brand: normalizeSearchText(x.brand),
      category: normalizeSearchText(categoryName),
      description: normalizeSearchText([
        p?.shortDesc, p?.fullDesc, x.weight, x.volume, x.flavor, x.suitableAge,
        x.goals, x.ingredients, x.country, x.barcode, x.usageMethod, x.storage,
        Array.isArray(x.tags) ? x.tags.join(' ') : String(x.tags || ''), p?.id
      ].join(' '))
    };
  }

  function productSearchDocument(p) {
    if (!p || typeof p !== 'object') return '';
    const cached = searchDocumentCache.get(p);
    if (cached) return cached;
    const f = productSearchFields(p);
    const value = normalizeSearchText([f.name, f.brand, f.category, f.description].join(' '));
    searchDocumentCache.set(p, value);
    return value;
  }

  function tokenMatchesField(token, field) {
    const parts = field.split(' ').filter(Boolean);
    return parts.some(part => part === token || (token.length >= 2 && part.startsWith(token)));
  }

  function searchScoreProduct(p, query) {
    const q = normalizeSearchText(query);
    if (!q) return 0;
    const f = productSearchFields(p);
    const qTokens = searchTokens(q);
    if (!qTokens.length) return 0;

    // Every entered term must exist in the product's searchable document.
    // This prevents unrelated products from appearing for non-existent searches.
    const doc = productSearchDocument(p);
    if (!qTokens.every(token => tokenMatchesField(token, doc))) return 0;

    let score = 0;
    if (f.name === q) score += 1000;
    if (f.name.includes(q)) score += 700;
    if (f.brand === q) score += 650;
    if (f.category === q) score += 500;
    if (f.name.includes(q) || f.brand.includes(q) || f.category.includes(q)) score += 120;

    for (const token of qTokens) {
      if (tokenMatchesField(token, f.name)) score += 70;
      else if (tokenMatchesField(token, f.brand)) score += 50;
      else if (tokenMatchesField(token, f.category)) score += 35;
      else if (tokenMatchesField(token, f.description)) score += 12;
    }

    return score;
  }

  function rankProductsForSearch(list, query) {
    const q = normalizeSearchText(query);
    if (!q) return [...list];
    return list
      .map(p => ({ p, score: searchScoreProduct(p, q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.p);
  }

  function toast(msg, type = 'success') { if (typeof window.showToast === 'function') window.showToast(msg, type); }

  window.openProductPage = function (id) {
    const key = String(id ?? '').trim();
    if (!key) return;
    window.location.href = `product.html?id=${encodeURIComponent(key)}`;
  };

  window.isWishlisted = function (id) { return getWishlist().includes(String(id)); };
  window.toggleWishlist = function (id, event) {
    if (event) event.stopPropagation();
    const key = String(id); const list = getWishlist(); const i = list.indexOf(key);
    if (i >= 0) { list.splice(i, 1); toast('از علاقه‌مندی‌ها حذف شد', 'info'); }
    else { list.push(key); toast('به علاقه‌مندی‌ها اضافه شد'); }
    writeList(LS_WISHLIST, list); updateWishlistUI();
  };

  window.clearCompare = function () { writeList(LS_COMPARE, []); updateCompareBar(); };

  window.toggleCompare = function (id, event) {
    if (event) event.stopPropagation();
    const key = String(id); const list = getCompare();
    if (list.includes(key)) writeList(LS_COMPARE, list.filter(x => x !== key));
    else if (list.length >= 3) { toast('حداکثر ۳ محصول را می‌توانید همزمان مقایسه کنید.', 'info'); return; }
    else list.push(key), writeList(LS_COMPARE, list);
    updateCompareBar();
    toast(list.includes(key) ? 'به مقایسه اضافه شد' : 'از مقایسه حذف شد', 'info');
  };

  window.toggleRestockAlert = function (id) {
    const key = String(id); const list = getRestock();
    const i = list.indexOf(key);
    if (i >= 0) { list.splice(i, 1); toast('درخواست اطلاع موجودشدن حذف شد', 'info'); }
    else { list.push(key); toast('درخواست اطلاع موجودشدن روی این مرورگر ذخیره شد'); }
    writeList(LS_RESTOCK, list); updateRestockButtons();
  };

  function updateWishlistUI() {
    document.querySelectorAll('[data-wishlist-id]').forEach(btn => {
      const active = window.isWishlisted(btn.dataset.wishlistId);
      btn.classList.toggle('text-rose-600', active);
      btn.classList.toggle('bg-rose-50', active);
      const icon = btn.querySelector('i'); if (icon) icon.className = active ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      btn.setAttribute('aria-pressed', String(active));
    });
    const count = getWishlist().length;
    document.querySelectorAll('[data-wishlist-count]').forEach(el => el.textContent = window.toPersianDigits(count));
  }
  function updateRestockButtons() {
    const list = getRestock();
    document.querySelectorAll('[data-restock-id]').forEach(btn => {
      const active = list.includes(String(btn.dataset.restockId));
      btn.innerHTML = active ? '<i class="fa-solid fa-bell"></i> ثبت شد' : '<i class="fa-regular fa-bell"></i> اطلاع موجودشدن';
      btn.classList.toggle('bg-emerald-600', active);
      btn.classList.toggle('bg-slate-100', !active);
      btn.classList.toggle('text-white', active);
    });
  }

  function buildInvoiceText(customCart = null) {
    const items = customCart || (Array.isArray(window.cart) ? window.cart : []);
    const total = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    const lines = items.map((item, idx) => `${idx + 1}. ${item.name} × ${window.toPersianDigits(item.quantity)} = ${window.formatPrice((Number(item.price) || 0) * (Number(item.quantity) || 0))} تومان`);
    return [
      '🧾 فاکتور سفارش PetraPet',
      `📅 تاریخ: ${formatDateFa()}`,
      `📍 فروشگاه: PetraPet — ${SHOP_LOCATION}`,
      '',
      '📦 اقلام سفارش:',
      ...(lines.length ? lines : ['سبد خرید خالی است']),
      '',
      `💰 مبلغ کالاها: ${window.formatPrice(total)} تومان`,
      `🚚 ${shippingMessage(total)}`,
      `✅ مبلغ کل کالاها: ${window.formatPrice(total)} تومان`,
      '',
      'این متن از سبد خرید سایت کپی شده است. برای ثبت نهایی، آن را در گفت‌وگوی کانال انتخابی Paste کنید.'
    ].join('\n');
  }

  function buildItemsText(customCart = null) {
    const items = customCart || (Array.isArray(window.cart) ? window.cart : []);
    return items.map((item, idx) => `${idx + 1}. ${item.name} × ${window.toPersianDigits(item.quantity)}`).join('\n');
  }

  window.copyCartItems = async function () {
    const items = Array.isArray(window.cart) ? window.cart : [];
    if (!items.length) return toast('سبد خرید خالی است.', 'info');
    const ok = await window.copyTextToClipboard(buildItemsText());
    toast(ok ? 'نام و تعداد محصولات سبد کپی شد.' : 'کپی خودکار انجام نشد؛ متن آماده است و می‌توانید آن را دستی انتخاب و کپی کنید.', ok ? 'success' : 'info');
  };

  window.copyCartInvoice = async function () {
    const items = Array.isArray(window.cart) ? window.cart : [];
    if (!items.length) return toast('سبد خرید خالی است.', 'info');
    const ok = await window.copyTextToClipboard(buildInvoiceText());
    toast(ok ? 'فاکتور کامل کپی شد. آن را در اینستاگرام یا روبیکا Paste کنید.' : 'کپی خودکار انجام نشد؛ فاکتور همچنان در راهنما آماده است.', ok ? 'success' : 'info');
  };

  window.orderCartBy = async function (channel) {
    const items = Array.isArray(window.cart) ? window.cart : [];
    if (!items.length) return toast('سبد خرید خالی است.', 'info');
    const ok = await window.copyTextToClipboard(buildInvoiceText());
    if (!ok) toast('کپی خودکار انجام نشد؛ متن فاکتور در راهنما برای کپی دستی هم قابل استفاده است.', 'info');
    openOrderGuide(channel, ok);
  };

  function channelMeta(channel) {
    const map = {
      whatsapp: { label:'واتساپ', target:'واتساپ', url:WHATSAPP_URL, color:'#72d6bd', icon:'fa-brands fa-whatsapp' },
      telegram: { label:'تلگرام', target:'تلگرام', url:TELEGRAM_URL, color:'#8bd2ff', icon:'fa-brands fa-telegram' },
      rubika: { label:'روبیکا', target:'روبیکا', url:RUBIKA_URL, color:'#c7a8ff', icon:'fa-solid fa-comments' },
      instagram: { label:'اینستاگرام', target:'دایرکت اینستاگرام', url:INSTAGRAM_URL, color:'#ff9b9b', icon:'fa-brands fa-instagram' }
    };
    return map[channel] || map.instagram;
  }

  function openOrderGuide(channel = 'instagram', copied = true) {
    const meta = channelMeta(channel);
    let modal = document.getElementById('fox-order-guide');
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'fox-order-guide';
      modal.className = 'fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm hidden items-center justify-center p-4';
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div class="w-full max-w-md rounded-[26px] bg-white shadow-2xl p-6 space-y-4" dir="rtl" style="border:2px solid #101820">
      <div class="flex items-center justify-between gap-3"><div><h3 class="font-black text-base" style="color:${meta.color};-webkit-text-stroke:.5px #111">راهنمای سفارش با ${meta.label}</h3><p class="text-[11px] mt-1">${copied ? 'فاکتور همین حالا خودکار در کلیپ‌بورد کپی شد.' : 'کپی خودکار در این مرورگر در دسترس نبود؛ فاکتور را از گزینه «کپی فاکتور» بردارید.'}</p></div><button onclick="document.getElementById('fox-order-guide').classList.add('hidden')" class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="space-y-3 text-xs leading-relaxed">
        <div class="flex gap-3"><span class="w-7 h-7 rounded-lg flex items-center justify-center font-black" style="background:${meta.color};border:2px solid #101820">۱</span><p>دکمه پایین را بزنید تا ${meta.target} باز شود.</p></div>
        <div class="flex gap-3"><span class="w-7 h-7 rounded-lg flex items-center justify-center font-black" style="background:#ffe58b;border:2px solid #101820">۲</span><p>گفت‌وگوی PetraPet را باز کنید.</p></div>
        <div class="flex gap-3"><span class="w-7 h-7 rounded-lg flex items-center justify-center font-black" style="background:#8bd2ff;border:2px solid #101820">۳</span><p>در کادر پیام گزینه «Paste / چسباندن» را بزنید و فاکتور کپی‌شده را ارسال کنید.</p></div>
      </div>
      <button onclick="openOrderChannel('${channel}')" class="w-full py-3.5 rounded-2xl text-white font-black text-sm shadow" style="background:${meta.color};color:#101820;border:2px solid #101820"><i class="${meta.icon}"></i> باز کردن ${meta.label}</button>
      <button onclick="document.getElementById('fox-order-guide').classList.add('hidden')" class="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs">بستن</button>
    </div>`;
    modal.classList.remove('hidden'); modal.classList.add('flex');
  }

  window.openOrderChannel = function (channel) {
    const meta = channelMeta(channel);
    const win = window.open(meta.url, '_blank', 'noopener,noreferrer');
    if (!win) window.location.href = meta.url;
  };

  function addOrderButtonsToCart() {
    const footer = document.getElementById('cart-footer-view');
    if (!footer || footer.querySelector('[data-petrapet-order-tools]')) return;
    const tools = document.createElement('div');
    tools.dataset.petrapetOrderTools = '1';
    tools.className = 'space-y-3';
    tools.innerHTML = `<div class="rounded-2xl p-3 petra-cart-summary"><div class="flex items-center justify-between text-[11px] font-bold"><span><i class="fa-solid fa-truck-fast"></i> ارسال رایگان</span><span data-free-shipping-note></span></div><div class="mt-2 h-2 rounded-full bg-white overflow-hidden border border-black/10"><div data-free-shipping-progress class="h-full bg-gradient-to-r from-emerald-300 via-sky-300 to-violet-300 rounded-full transition-all"></div></div></div>
      <div class="grid grid-cols-2 gap-2"><button onclick="copyCartItems()" class="py-2.5 rounded-xl bg-white border-2 border-black font-bold text-[11px]"><i class="fa-solid fa-copy"></i> کپی محصولات</button><button onclick="copyCartInvoice()" class="py-2.5 rounded-xl bg-white border-2 border-black font-bold text-[11px]"><i class="fa-solid fa-file-invoice"></i> کپی فاکتور</button></div>
      <div class="grid grid-cols-2 gap-2" aria-label="راه‌های سفارش سبد خرید"><button onclick="orderCartBy('whatsapp')" class="petra-cart-order-action" style="background:#72d6bd"><i class="fa-brands fa-whatsapp"></i> واتساپ + کپی فاکتور</button><button onclick="orderCartBy('telegram')" class="petra-cart-order-action" style="background:#8bd2ff"><i class="fa-brands fa-telegram"></i> تلگرام + کپی فاکتور</button><button onclick="orderCartBy('rubika')" class="petra-cart-order-action" style="background:#c7a8ff"><i class="fa-solid fa-comments"></i> روبیکا + کپی فاکتور</button><button onclick="orderCartBy('instagram')" class="petra-cart-order-action" style="background:#ff9b9b"><i class="fa-brands fa-instagram"></i> اینستا + کپی فاکتور</button></div>
      <p class="text-[10px] leading-relaxed">با انتخاب هر راه ارتباطی، فاکتور ابتدا خودکار کپی می‌شود و سپس راهنمای چسباندن و ارسال برای شما نمایش داده می‌شود.</p>`;
    footer.appendChild(tools);
  }

  function updateShippingUI() {
    const total = typeof window.calculateCartTotal === 'function' ? window.calculateCartTotal() : 0;
    const threshold = freeShippingThreshold();
    document.querySelectorAll('[data-free-shipping-note]').forEach(el => el.textContent = shippingMessage(total));
    document.querySelectorAll('[data-free-shipping-progress]').forEach(el => el.style.width = `${Math.min(100, (total / threshold) * 100)}%`);
  }

  function patchCartRenderer() {
    if (!window.renderCartDrawer || window.renderCartDrawer.__foxWrapped) return;
    const base = window.renderCartDrawer;
    const wrapped = function (...args) {
      const result = base.apply(this, args);
      addOrderButtonsToCart(); updateShippingUI(); addMobileCartBar();
      return result;
    };
    wrapped.__foxWrapped = true; window.renderCartDrawer = wrapped;
  }

  function addMobileCartBar() {
    if (!window.cart || !window.cart.length || !/Mobi|Android/i.test(navigator.userAgent)) {
      document.getElementById('fox-mobile-cart-bar')?.remove(); return;
    }
    let bar = document.getElementById('fox-mobile-cart-bar');
    if (!bar) { bar = document.createElement('div'); bar.id='fox-mobile-cart-bar'; document.body.appendChild(bar); }
    bar.className = 'fixed bottom-3 inset-x-3 z-40 md:hidden rounded-2xl bg-slate-950/95 text-white shadow-2xl border border-white/10 p-3 backdrop-blur';
    bar.innerHTML = `<button onclick="toggleCartDrawer()" class="w-full flex items-center justify-between gap-3"><span class="flex items-center gap-2"><span class="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center"><i class="fa-solid fa-cart-shopping"></i></span><span class="text-right"><b class="block text-xs">سبد خرید</b><small class="text-[10px] text-white/60">${window.toPersianDigits(window.cart.reduce((s,i)=>s+i.quantity,0))} کالا</small></span></span><span class="font-black text-sm">${window.formatPrice(typeof window.calculateCartTotal === 'function' ? window.calculateCartTotal() : 0)} تومان</span></button>`;
  }

  function updateCompareBar() {
    document.getElementById('fox-compare-bar')?.remove();
    const ids = getCompare();
    if (!ids.length) return;
    const bar = document.createElement('div'); bar.id='fox-compare-bar';
    bar.className='fixed bottom-3 right-3 left-3 md:left-auto md:w-[420px] z-50 rounded-3xl bg-white/95 backdrop-blur border border-slate-200 shadow-2xl p-3';
    bar.innerHTML=`<div class="flex items-center justify-between gap-2"><div><b class="text-xs text-slate-900">مقایسه محصولات</b><span class="text-[10px] text-slate-400 mr-2">${window.toPersianDigits(ids.length)} از ۳</span></div><div class="flex gap-1"><a href="compare.html" class="px-3 py-2 rounded-xl bg-orange-600 text-white text-[11px] font-bold">مشاهده</a><button onclick="clearCompare()" class="w-9 h-9 rounded-xl bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button></div></div><div class="mt-2 flex gap-2 overflow-x-auto">${ids.map(id=>getProduct(id)).filter(Boolean).map(p=>`<a href="${productUrl(p)}" class="shrink-0 flex items-center gap-1.5 bg-slate-50 rounded-xl p-1.5 border"><img src="${safeText(p.image)}" class="w-8 h-8 object-contain rounded-lg bg-white"><span class="max-w-[150px] truncate text-[10px] font-bold text-slate-700">${safeText(p.name)}</span></a>`).join('')}</div>`;
    document.body.appendChild(bar);
  }

  function enhancedProductCard(prod) {
    const discount = Number(prod.discountPercent) || (prod.originalPrice > prod.finalPrice ? Math.round(((prod.originalPrice - prod.finalPrice)/prod.originalPrice)*100) : 0);
    const wished = window.isWishlisted(prod.id);
    const compare = getCompare().includes(String(prod.id));
    const x = inferredDetails(prod);
    return `<article class="product-card-item group bg-white rounded-3xl border border-orange-100/90 shadow-sm hover:shadow-xl hover:border-orange-300 transition-all duration-300 overflow-hidden relative flex flex-col">
      ${discount>0 ? `<span class="absolute top-3 right-3 z-10 bg-rose-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-xl shadow-md">${discount}٪ تخفیف امروز</span>`:''}
      <div class="absolute top-3 left-3 z-10 flex gap-1.5"><button data-wishlist-id="${safeText(prod.id)}" onclick="toggleWishlist('${safeText(prod.id)}',event)" class="w-9 h-9 rounded-xl bg-white/95 border border-slate-200 text-slate-500 shadow ${wished?'text-rose-600 bg-rose-50':''}" aria-label="علاقه‌مندی"><i class="${wished?'fa-solid':'fa-regular'} fa-heart"></i></button><button onclick="toggleCompare('${safeText(prod.id)}',event)" class="w-9 h-9 rounded-xl bg-white/95 border border-slate-200 ${compare?'text-orange-600 bg-orange-50':'text-slate-500'} shadow" aria-label="مقایسه"><i class="fa-solid fa-code-compare"></i></button></div>
      <a href="${productUrl(prod)}" class="aspect-square w-full bg-slate-50 overflow-hidden flex items-center justify-center p-6 group-hover:bg-orange-50/20 transition"><img src="${safeText(prod.image)}" alt="${safeText(prod.name)}" loading="lazy" decoding="async" class="w-full h-full object-contain group-hover:scale-105 transition duration-500"></a>
      <div class="p-5 flex-1 flex flex-col gap-3"><div><a href="${productUrl(prod)}" class="font-extrabold text-sm text-slate-800 hover:text-orange-600 transition line-clamp-2 leading-snug">${safeText(prod.name)}</a><p class="text-[11px] text-slate-400 line-clamp-1 mt-1">${safeText(prod.shortDesc||'')}</p></div>
        <div class="grid grid-cols-2 gap-1.5 text-[10px]"><span class="bg-slate-50 rounded-lg px-2 py-1 text-slate-500 truncate">${safeText(x.brand||'برند نامشخص')}</span><span class="bg-slate-50 rounded-lg px-2 py-1 text-slate-500 truncate">${safeText(x.weight||'وزن ثبت نشده')}</span></div>
        <div class="pt-2 border-t border-slate-100 flex items-end justify-between"><div>${discount>0?`<div class="text-[11px] text-slate-400 line-through">${window.formatPrice(prod.originalPrice)} تومان</div>`:''}<div class="font-black text-slate-900">${window.formatPrice(prod.finalPrice)} <span class="text-[10px] font-normal text-slate-500">تومان</span></div></div><span class="text-[10px] ${prod.stockStatus==='out_of_stock'?'text-rose-600':'text-emerald-600'} font-bold">${prod.stockStatus==='out_of_stock'?'ناموجود':prod.stockStatus==='low_stock'?'موجودی محدود':'موجود'}</span></div>
        <div class="grid grid-cols-2 gap-2 mt-auto">${prod.stockStatus==='out_of_stock' ? '<button disabled class="py-2.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-[11px] cursor-not-allowed"><i class="fa-solid fa-ban"></i> ناموجود</button>' : `<button onclick="addToCart('${safeText(prod.id)}')" class="py-2.5 rounded-xl bg-orange-50 hover:bg-orange-600 hover:text-white text-orange-700 font-bold text-[11px]"><i class="fa-solid fa-cart-plus"></i> سبد خرید</button>`}<a href="${productUrl(prod)}" class="py-2.5 rounded-xl bg-slate-900 text-white font-bold text-[11px] text-center"><i class="fa-solid fa-arrow-left"></i> صفحه محصول</a></div>
      </div></article>`;
  }

  function patchRenderers() {
    if (typeof window.renderProductCard === 'function' && !window.renderProductCard.__foxWrapped) {
      const wrappedCard = function(prod) { return enhancedProductCard(prod); };
      wrappedCard.__foxWrapped = true;
      window.renderProductCard = wrappedCard;
    }
    if (typeof window.renderProductsCatalog === 'function' && !window.renderProductsCatalog.__foxWrapped) {
      const wrapped = function () {
        const container = document.getElementById('catalog-products-grid');
        const emptyView = document.getElementById('catalog-empty-view');
        if (!container) return;
        const params = new URLSearchParams(window.location.search);
        const activeCategory = window.__foxActiveCategory || params.get('category') || 'all';
        const urlSearch = params.get('search') || '';
        const onlyDiscounted = params.get('discount') === '1';
        const searchInput = document.getElementById('catalog-search-input');
        if (searchInput && urlSearch && !searchInput.dataset.foxUrlSeeded) {
          searchInput.value = urlSearch;
          searchInput.dataset.foxUrlSeeded = '1';
        }
        // Once the input exists, it is authoritative. Never fall back to the old URL query
        // after the user clears or replaces it.
        const searchQuery = searchInput ? searchInput.value : urlSearch;
        const sortVal = document.getElementById('catalog-sort-select')?.value || 'default';
        let filtered = [...(window.products || [])];
        if (activeCategory !== 'all') filtered = filtered.filter(p => p.categoryId === activeCategory);
        if (onlyDiscounted) filtered = filtered.filter(p => Number(p.discountPercent) > 0 || Number(p.originalPrice) > Number(p.finalPrice));
        if (normalizeSearchText(searchQuery)) filtered = rankProductsForSearch(filtered, searchQuery);
        if (sortVal === 'price-asc') filtered.sort((a,b) => a.finalPrice-b.finalPrice);
        else if (sortVal === 'price-desc') filtered.sort((a,b) => b.finalPrice-a.finalPrice);
        else if (sortVal === 'discount') filtered.sort((a,b) => (b.discountPercent||0)-(a.discountPercent||0));
        else if (sortVal === 'bestseller') filtered.sort((a,b) => (Number(b.details?.salesCount)||0) - (Number(a.details?.salesCount)||0) || (Number(b.isBestSeller)-Number(a.isBestSeller)) || (Number(b.finalPrice)||0) - (Number(a.finalPrice)||0));
        container.innerHTML = filtered.map(enhancedProductCard).join('');
        if (emptyView) emptyView.classList.toggle('hidden', filtered.length > 0);
        updateWishlistUI(); updateCompareBar(); addTrustToExistingPriceAreas();
      };
      wrapped.__foxWrapped = true;
      window.renderProductsCatalog = wrapped;
    }
    if (typeof window.setCategoryFilter === 'function' && !window.setCategoryFilter.__foxWrapped) {
      const base = window.setCategoryFilter;
      const wrapped = function(catId) {
        window.__foxActiveCategory = catId || 'all';
        try { base.apply(this, arguments); } catch (_) {}
        if (typeof window.renderProductsCatalog === 'function') window.renderProductsCatalog();
      };
      wrapped.__foxWrapped = true;
      window.setCategoryFilter = wrapped;
    }
    if (typeof window.resetFilters === 'function' && !window.resetFilters.__foxWrapped) {
      const base = window.resetFilters;
      const wrapped = function() {
        window.__foxActiveCategory = 'all';
        try { base.apply(this, arguments); } catch (_) {}
        const input=document.getElementById('catalog-search-input');
        if(input) input.value='';
        const sort=document.getElementById('catalog-sort-select');
        if(sort) sort.value='default';
        if(typeof window.renderCategoryPills==='function') window.renderCategoryPills();
        if(typeof window.renderProductsCatalog==='function') window.renderProductsCatalog();
      };
      wrapped.__foxWrapped = true;
      window.resetFilters = wrapped;
    }
    const searchInput=document.getElementById('catalog-search-input');
    if(searchInput && !searchInput.dataset.foxEnhancedSearch){
      searchInput.dataset.foxEnhancedSearch='1';
      if (new URLSearchParams(window.location.search).get('search')) searchInput.dataset.foxUrlSeeded='1';
      searchInput.addEventListener('input',()=>{
        // Persist the live value in the URL so an old search can never reappear after clearing.
        try {
          const url = new URL(window.location.href);
          const value = searchInput.value.trim();
          if (value) url.searchParams.set('search', value);
          else url.searchParams.delete('search');
          window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + (url.hash || ''));
        } catch (_) {}
        if(typeof window.renderProductsCatalog==='function') window.renderProductsCatalog();
      });
      searchInput.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          if(typeof window.renderProductsCatalog==='function') window.renderProductsCatalog();
        }
      });
    }
    const searchButton=document.getElementById('catalog-search-trigger');
    if(searchButton && !searchButton.dataset.foxEnhancedSearchButton){
      searchButton.dataset.foxEnhancedSearchButton='1';
      searchButton.addEventListener('click',()=>{
        if(typeof window.renderProductsCatalog==='function') window.renderProductsCatalog();
        searchInput?.focus();
      });
    }
  }

  function patchHomeRenderers() {
    const wrapHome = (name, containerId, selector) => {
      if (typeof window[name] !== 'function' || window[name].__foxWrapped) return;
      const base = window[name];
      const wrapped = function(...args) {
        const result = base.apply(this, args);
        const container = document.getElementById(containerId);
        if (container) {
          const all = Array.isArray(window.products) ? window.products : [];
          const selected = selector(all);
          container.innerHTML = selected.map(enhancedProductCard).join('');
          updateWishlistUI();
          updateCompareBar();
        }
        return result;
      };
      wrapped.__foxWrapped = true;
      window[name] = wrapped;
    };
    wrapHome('renderHomeFeatured', 'home-featured-grid', products => {
      const featured = products.filter(p => p.isFeatured);
      return featured.length ? featured : products.slice(0, 4);
    });
  }

  function enhanceCatalogCards() {
    patchWishlistAndProductLinks(); updateWishlistUI(); updateCompareBar();
  }

  function patchWishlistAndProductLinks() {
    document.querySelectorAll('.product-card-item').forEach(card => {
      if (card.dataset.foxEnhanced) return;
      card.dataset.foxEnhanced='1';
    });
  }

  function injectHomeCommerceSections() {
    const home = document.getElementById('home-categories-grid');
    if (!home || document.getElementById('fox-home-commerce')) return;
    const products = Array.isArray(window.products) ? window.products : [];
    const root = document.createElement('div'); root.id='fox-home-commerce'; root.className='space-y-10 mt-2';
    const today = products.filter(p=>Number(p.discountPercent)>0).sort((a,b)=>(b.discountPercent||0)-(a.discountPercent||0)).slice(0,8);
    root.innerHTML = `
      <section class="space-y-4 fox-showcase-section"><div class="flex items-end justify-between gap-3"><div><span class="fox-eyebrow">پیشنهادهای این هفته</span><h2 class="text-xl sm:text-2xl font-black text-slate-900 mt-1">تخفیف‌های امروز</h2></div><a href="products.html?discount=1" class="fox-text-link">مشاهده همه <i class="fa-solid fa-arrow-left"></i></a></div><div data-home-row="today" class="flex gap-4 overflow-x-auto pb-3 custom-scroll snap-x snap-mandatory"></div></section>`;
    home.closest('section')?.after(root);
    const row=root.querySelector('[data-home-row="today"]');
    if (row) row.innerHTML = today.length ? today.map(p=>`<div class="min-w-[270px] max-w-[270px] snap-start">${enhancedProductCard(p)}</div>`).join('') : '<div class="w-full text-xs text-slate-400 py-5">در حال حاضر محصول تخفیف‌داری ثبت نشده است.</div>';
  }


  function addTrustToExistingPriceAreas() { /* Trust is intentionally shown once in the footer only. */ }

  function getProductIdFromLocation() {
    const params = new URLSearchParams(location.search);
    const queryId = params.get('id') || params.get('product') || params.get('pid');
    if (queryId) return queryId;

    const parts = location.pathname.split('/').filter(Boolean);
    const productIndex = parts.findIndex(part => part.toLowerCase() === 'product');
    if (productIndex >= 0 && parts[productIndex + 1]) return parts[productIndex + 1];

    const last = parts[parts.length - 1] || '';
    if (last && !/^product(?:\.html)?$/i.test(last) && !/^index\.html$/i.test(last)) return last;
    return '';
  }

  const PETRAPET_STICKERS = [
    ['01-witch.webp','ساحره'],['02-wizard.webp','جادوگر'],['03-dinosaur.webp','دایناسوری'],
    ['04-princess.webp','پرنسس'],['05-suit.webp','کت و شلوار'],['06-sunglasses.webp','تابستانی'],
    ['07-mafia.webp','مافیا'],['08-yarn.webp','کاموا'],['09-space.webp','فضانورد'],['10-angel.webp','فرشته']
  ];

  function getRandomProductSticker(productId) {
    const key = String(productId ?? '');
    const storageKey = `foxshop_random_sticker_${key}`;
    if (!window.__PETRAPET_RANDOM_PRODUCT_STICKER__ || window.__PETRAPET_RANDOM_PRODUCT_STICKER__.productId !== key) {
      let previous = -1;
      try { previous = Number(localStorage.getItem(storageKey)); } catch (_) {}
      let index = Math.floor(Math.random() * PETRAPET_STICKERS.length);
      if (PETRAPET_STICKERS.length > 1 && Number.isInteger(previous) && previous >= 0 && previous < PETRAPET_STICKERS.length && index === previous) {
        index = (previous + 1 + Math.floor(Math.random() * (PETRAPET_STICKERS.length - 1))) % PETRAPET_STICKERS.length;
      }
      try { localStorage.setItem(storageKey, String(index)); } catch (_) {}
      window.__PETRAPET_RANDOM_PRODUCT_STICKER__ = { productId: key, sticker: PETRAPET_STICKERS[index] };
    }
    return window.__PETRAPET_RANDOM_PRODUCT_STICKER__.sticker;
  }

  function buildProductSpecRows(p) {
    const x = inferredDetails(p);
    const rows = [
      ['برند', x.brand], ['وزن', x.weight], ['حجم', x.volume], ['طعم', x.flavor],
      ['مناسب برای', x.suitableAge], ['اهداف مصرف', x.goals], ['کشور سازنده', x.country],
      ['بارکد', x.barcode], ['تاریخ انقضا', x.expiryDate], ['روش مصرف', x.usageMethod],
      ['نحوه نگهداری', x.storage], ['گارانتی', x.warranty], ['اصالت کالا', x.authenticity]
    ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
    if (!rows.length) return '<p class="text-xs text-slate-400">مشخصات تکمیلی این محصول هنوز توسط فروشگاه ثبت نشده است.</p>';
    return `<div class="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">${rows.map(([label, value]) => `
      <div class="grid grid-cols-[minmax(92px,0.7fr)_minmax(0,1.3fr)] gap-3 px-3.5 py-3 text-xs">
        <span class="font-bold text-slate-500">${safeText(label)}</span>
        <span class="font-semibold text-slate-800 break-words whitespace-pre-line">${safeText(value)}</span>
      </div>`).join('')}</div>`;
  }

  function renderProductPage() {
    const root=document.getElementById('product-page-root'); if(!root) return;
    const rawId=getProductIdFromLocation();
    let id=''; try{id=decodeURIComponent(String(rawId||'')).trim();}catch(_){id=String(rawId||'').trim();}
    const storeReady=window.__PETRAPET_STORE_READY__===true;
    const catalog=Array.isArray(window.products)?window.products:[];
    if(!id || (!storeReady && catalog.length===0)){
      root.innerHTML='<div class="petra-product-shell p-10 text-center"><div class="fox-product-loading-orb"><i class="fa-solid fa-paw"></i></div><h1>در حال آماده‌سازی صفحه محصول…</h1><p>اطلاعات محصول در حال بارگذاری است.</p></div>'; return;
    }
    const p=getProduct(id);
    if(!p){root.innerHTML='<div class="petra-product-shell p-10 text-center"><h1>محصول پیدا نشد</h1><p class="mt-2">ممکن است محصول حذف شده یا لینک قدیمی باشد.</p><a href="products.html" class="inline-block mt-5 px-5 py-2.5 rounded-xl bg-[#8bd2ff] border-2 border-black font-black">بازگشت به فروشگاه</a></div>';return;}
    const x=inferredDetails(p);
    const relatedIds=(x.relatedIds||[]).map(String).filter(v=>v!==String(p.id));
    let related=relatedIds.map(getProduct).filter(Boolean);
    if(!related.length) related=(window.products||[]).filter(q=>q.id!==p.id&&q.categoryId===p.categoryId).slice(0,4);
    const images=[p.image,...(Array.isArray(x.moreImages)?x.moreImages:[])].filter(Boolean).slice(0,8);
    const wished=window.isWishlisted(p.id); const out=p.stockStatus==='out_of_stock';
    root.innerHTML=`<div class="space-y-7">
      <div class="flex items-center gap-2 text-[11px]"><a href="index.html">صفحه اصلی</a><i class="fa-solid fa-chevron-left text-[8px]"></i><a href="products.html">محصولات</a><i class="fa-solid fa-chevron-left text-[8px]"></i><span>${safeText(p.name)}</span></div>
      <section class="petra-product-shell p-4 sm:p-7"><div class="grid grid-cols-1 lg:grid-cols-2 gap-7 items-start">
        <div><div class="product-gallery-box aspect-square p-5 sm:p-8 flex items-center justify-center"><img id="fox-main-product-image" src="${safeText(images[0]||'')}" alt="${safeText(p.name)}" class="max-h-full max-w-full object-contain"></div><div class="flex gap-2 mt-3 overflow-x-auto">${images.map((img,i)=>`<button type="button" onclick="document.getElementById('fox-main-product-image').src='${safeText(img)}'" class="shrink-0 w-16 h-16 rounded-xl bg-white border-2 border-black p-1"><img src="${safeText(img)}" class="w-full h-full object-contain rounded-lg" alt=""></button>`).join('')}</div></div>
        <div class="space-y-4"><div class="flex flex-wrap gap-2"><span class="petra-mini-panel px-3 py-1.5 text-[10px] font-black">${safeText((window.categories||[]).find(c=>c.id===p.categoryId)?.name||'محصول')}</span><span class="petra-mini-panel px-3 py-1.5 text-[10px] font-black">${out?'ناموجود':'موجود'}</span></div>
          <h1 class="text-2xl sm:text-4xl font-black leading-tight">${safeText(p.name)}</h1>
          <p class="text-sm leading-8">${safeText(p.shortDesc||p.fullDesc||'')}</p>
          <div class="grid grid-cols-2 gap-2">${x.brand?`<div class="petra-mini-panel p-3 text-xs"><b>برند</b><div class="mt-1">${safeText(x.brand)}</div></div>`:''}${x.weight?`<div class="petra-mini-panel p-3 text-xs"><b>وزن</b><div class="mt-1">${safeText(x.weight)}</div></div>`:''}</div>
          <div class="petra-mini-panel p-4"><div class="flex items-end justify-between gap-3"><div>${Number(p.discountPercent)>0?`<div class="text-xs line-through">${window.formatPrice(p.originalPrice)} تومان</div>`:''}<div class="text-2xl font-black"><span class="price-text">${window.formatPrice(p.finalPrice)} تومان</span></div></div><span class="text-[10px]">${safeText(shippingMessage(window.cart?.reduce((s,i)=>s+i.price*i.quantity,0)||0))}</span></div></div>
          <div class="grid grid-cols-2 gap-2"><button ${out?'disabled':''} onclick="addToCart('${safeText(p.id)}')" class="py-3.5 rounded-2xl ${out?'bg-slate-200':'bg-[#72d6bd]'} border-2 border-black font-black text-xs"><i class="fa-solid fa-cart-plus"></i> افزودن به سبد</button><button onclick="toggleWishlist('${safeText(p.id)}',event)" data-wishlist-id="${safeText(p.id)}" class="py-3.5 rounded-2xl ${wished?'bg-[#ff9b9b]':'bg-[#dff5ff]'} border-2 border-black font-black text-xs"><i class="${wished?'fa-solid':'fa-regular'} fa-heart"></i> علاقه‌مندی</button></div>
          <div class="grid grid-cols-2 gap-2"><button onclick="toggleCompare('${safeText(p.id)}',event)" class="py-3 rounded-xl bg-[#c7a8ff] border-2 border-black font-black text-[11px]"><i class="fa-solid fa-code-compare"></i> مقایسه</button>${out?`<button onclick="toggleRestockAlert('${safeText(p.id)}')" data-restock-id="${safeText(p.id)}" class="py-3 rounded-xl bg-[#ffe58b] border-2 border-black font-black text-[11px]"><i class="fa-regular fa-bell"></i> اطلاع موجودشدن</button>`:`<button onclick="addToCart('${safeText(p.id)}')" class="py-3 rounded-xl bg-[#ffc27d] border-2 border-black font-black text-[11px]"><i class="fa-solid fa-plus"></i> افزودن دوباره</button>`}</div>
          <div class="petra-contact-strip petra-mini-panel p-4"><b>پشتیبانی و سفارش مستقیم</b><div class="grid grid-cols-2 gap-2 mt-3"><a class="px-3 py-2 rounded-xl bg-[#d8fff2] border-2 border-black text-center font-black" href="https://wa.me/989960494973" target="_blank">واتساپ</a><a class="px-3 py-2 rounded-xl bg-[#dff5ff] border-2 border-black text-center font-black" href="https://t.me/petrapetshop" target="_blank">تلگرام</a><a class="px-3 py-2 rounded-xl bg-[#eee2ff] border-2 border-black text-center font-black" href="https://rubika.ir/petrapet" target="_blank">روبیکا</a><a class="px-3 py-2 rounded-xl bg-[#fff1cf] border-2 border-black text-center font-black" href="https://www.instagram.com/petra_petclinic?stkn=MTVmM2Q4ZGhqNjloMw==" target="_blank">اینستاگرام</a></div></div>
        </div></div></section>
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-5"><div class="petra-mini-panel p-5"><h2 class="font-black text-base mb-3">مشخصات کامل</h2><div>${buildProductSpecRows(p)}</div></div><div class="petra-mini-panel p-5"><h2 class="font-black text-base mb-3">ترکیبات و آنالیز تغذیه‌ای</h2><p class="text-xs leading-8 whitespace-pre-line">${safeText(x.ingredients||'اطلاعات ترکیبات این کالا هنوز توسط فروشگاه تکمیل نشده است.')}</p>${x.nutritionAnalysis?`<div class="mt-4 pt-4 border-t-2 border-black/10"><h3 class="text-xs font-black mb-2">آنالیز تغذیه‌ای</h3><p class="text-xs leading-8 whitespace-pre-line">${safeText(x.nutritionAnalysis)}</p></div>`:''}</div></section>
      <section class="petra-mini-panel p-5"><h2 class="text-base font-black mb-3">توضیحات محصول</h2><p class="text-xs leading-8 whitespace-pre-line">${safeText(p.fullDesc||p.shortDesc||'')}</p></section>
      <section class="petra-mini-panel p-5"><h2 class="text-base font-black mb-4">پرسش‌های متداول</h2>${(Array.isArray(x.faq)&&x.faq.length)?x.faq.map(f=>`<details><summary class="cursor-pointer font-bold text-xs">${safeText(f.question||f.q||'سؤال متداول')}</summary><p class="text-xs leading-7 mt-2">${safeText(f.answer||f.a||'')}</p></details>`).join(''):'<p class="text-xs">FAQ این محصول هنوز تکمیل نشده است.</p>'}</section>
      <section class="space-y-4"><div class="flex items-center justify-between"><h2 class="text-base font-black">محصولات مرتبط</h2><a href="products.html" class="font-black text-xs">مشاهده فروشگاه</a></div><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${related.map(q=>enhancedProductCard(q)).join('')}</div></section>
    </div>`;
    updateWishlistUI(); updateRestockButtons(); updateCompareBar();
    document.title=`${p.name} | PetraPet`;
    setMeta('description',(p.shortDesc||p.fullDesc||'').slice(0,155));
  }

  window.repeatPurchase=function(id){
    const p=getProduct(id); if(!p) return;
    if(typeof window.addToCart==='function') window.addToCart(id,1);
    window.location.hash='cart';
    if(typeof window.toggleCartDrawer==='function') window.toggleCartDrawer();
  };

  function setMeta(name, content){
    if(!content) return; let el=document.querySelector(`meta[name="${name}"]`);
    if(!el){el=document.createElement('meta');el.setAttribute('name',name);document.head.appendChild(el);} el.setAttribute('content',content);
  }

  function renderFavoritesPage(){
    const root=document.getElementById('favorites-root');if(!root)return;
    const list=getWishlist().map(getProduct).filter(Boolean);
    root.innerHTML=list.length?`<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">${list.map(enhancedProductCard).join('')}</div>`:`<div class="bg-white rounded-3xl border border-dashed p-10 text-center"><i class="fa-regular fa-heart text-4xl text-rose-300"></i><h1 class="text-xl font-black mt-4">هنوز محصولی ذخیره نشده</h1><p class="text-xs text-slate-400 mt-2">روی قلب محصولات بزنید تا اینجا نگه‌داری شوند.</p><a href="products.html" class="inline-block mt-5 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold">رفتن به فروشگاه</a></div>`;
    updateCompareBar();
  }

  function renderComparePage(){
    const root=document.getElementById('compare-root');if(!root)return;
    const list=getCompare().map(getProduct).filter(Boolean);
    if(!list.length){root.innerHTML='<div class="bg-white rounded-3xl border border-dashed p-10 text-center"><i class="fa-solid fa-code-compare text-4xl text-orange-300"></i><h1 class="text-xl font-black mt-4">هنوز محصولی برای مقایسه انتخاب نشده</h1><a href="products.html" class="inline-block mt-5 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold">انتخاب محصولات</a></div>';return;}
    const fields=[['قیمت','finalPrice'],['برند',x=>'details.brand'],['وزن',x=>'details.weight'],['سن مناسب',x=>'details.suitableAge'],['هدف مصرف',x=>'details.goals'],['کشور سازنده',x=>'details.country'],['تاریخ انقضا',x=>'details.expiryDate'],['امتیاز',x=>'details.rating']];
    root.innerHTML=`<div class="overflow-x-auto bg-white rounded-3xl border border-slate-200"><table class="min-w-[720px] w-full text-right"><thead><tr><th class="p-4 bg-slate-50 text-xs text-slate-500 w-40">ویژگی</th>${list.map(p=>`<th class="p-4 align-top"><img src="${safeText(p.image)}" class="w-28 h-28 object-contain rounded-2xl bg-slate-50 border mx-auto"><a href="${productUrl(p)}" class="block text-xs font-black text-slate-800 mt-2 hover:text-orange-600">${safeText(p.name)}</a></th>`).join('')}</tr></thead><tbody>${fields.map(([label,key])=>`<tr class="border-t"><td class="p-4 text-xs font-bold text-slate-500 bg-slate-50">${label}</td>${list.map(p=>{let v=typeof key==='function'?key(p):p[key]; if(label==='قیمت'&&typeof v==='number')v=window.formatPrice(v)+' تومان'; if(label==='امتیاز'&&v)v=`★ ${v}`; return `<td class="p-4 text-xs text-slate-700 font-bold">${safeText(v??'—')}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><div class="mt-4 flex gap-2"><button onclick="clearCompare();renderComparePage();" class="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">پاک کردن مقایسه</button><a href="products.html" class="px-4 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold">افزودن محصول دیگر</a></div>`;
  }

  function injectHeaderLinks(){
    document.querySelectorAll('nav:not(.fox-mobile-bottom-nav)').forEach(nav=>{
      if(nav.querySelector('[data-petra-links]')) return;
      const wrap=document.createElement('div');
      wrap.dataset.petraLinks='1';
      wrap.className='hidden xl:flex items-center gap-2 mr-2';
      wrap.innerHTML='<a href="favorites.html" class="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-[#fff1cf] border-2 border-black">♥ علاقه‌مندی‌ها <span data-wishlist-count>۰</span></a><a href="compare.html" class="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-[#dff5ff] border-2 border-black">مقایسه</a>';
      nav.appendChild(wrap);
    });
  }

  function injectGlobalSearch(){
    const target=document.querySelector('header .glass-nav') || document.querySelector('header');
    const cart=document.getElementById('cart-trigger-btn');
    const actionWrap=cart?.parentElement || target?.querySelector('.max-w-7xl > div:last-child') || target?.querySelector('.max-w-7xl > div');
    if(!target || !actionWrap) return;

    let btn=document.getElementById('fox-global-search-trigger');
    if(!btn){
      btn=document.createElement('button');
      btn.id='fox-global-search-trigger';
      btn.type='button';
      btn.className='fox-search-icon-button';
      btn.setAttribute('aria-label','جستجوی محصول');
      btn.title='جستجوی محصول';
      btn.innerHTML='<i class="fa-solid fa-magnifying-glass"></i>';
      actionWrap.insertBefore(btn, actionWrap.firstElementChild || null);
      btn.addEventListener('click',openGlobalSearch);
    }

    if(!actionWrap.querySelector('[data-fox-search-cat]')){
      const thumb=document.createElement('span');
      thumb.dataset.foxSearchCat='1';
      thumb.className='fox-search-cat-thumb';
      thumb.setAttribute('aria-hidden','true');
      thumb.innerHTML='<img src="assets/images/petrapet-logo.png" alt="">';
      actionWrap.insertBefore(thumb, btn);
    }

    const input=document.getElementById('global-search-input');
    if(input && !input.dataset.foxSearchBound){
      input.dataset.foxSearchBound='1';
      input.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); submitGlobalSearch(input.value); } });
    }
    const desktopBtn=input?.parentElement?.querySelector('button');
    if(desktopBtn && !desktopBtn.dataset.foxSearchBound){
      desktopBtn.dataset.foxSearchBound='1';
      desktopBtn.type='button';
      desktopBtn.addEventListener('click',()=>submitGlobalSearch(input.value));
    }
  }

  function submitGlobalSearch(value){
    const q=String(value||'').trim();
    if(!q){ openGlobalSearch(); return; }
    window.location.href=`products.html?search=${encodeURIComponent(q)}`;
  }

  function openGlobalSearch(){
    let modal=document.getElementById('fox-global-search');
    if(!modal){
      modal=document.createElement('div'); modal.id='fox-global-search'; modal.className='fox-search-modal hidden';
      modal.innerHTML='<div class="fox-search-dialog" role="dialog" aria-modal="true" aria-label="جستجوی محصول"><button type="button" class="fox-search-close" aria-label="بستن"><i class="fa-solid fa-xmark"></i></button><div class="fox-search-kicker"><span class="fox-search-orb"><i class="fa-solid fa-paw"></i></span><span>جستجوی هوشمند PetraPet</span></div><h2>دنبال چی می‌گردی؟ 🐾</h2><p>نام، برند، وزن، طعم، دسته، سن یا نیاز گربه را بنویس.</p><form class="fox-search-form"><div class="fox-search-field"><i class="fa-solid fa-magnifying-glass"></i><input id="fox-search-modal-input" autocomplete="off" placeholder="مثلاً رویال کنین، خاک، بچه‌گربه..." /></div><button type="submit" class="fox-search-submit">جستجوی محصولات</button></form><div id="fox-search-live-results" class="fox-search-live-results"></div><div class="fox-search-hints"><button type="button" data-search-hint="غذای بچه‌گربه">بچه‌گربه</button><button type="button" data-search-hint="Royal Canin">Royal Canin</button><button type="button" data-search-hint="خاک گربه">خاک گربه</button><button type="button" data-search-hint="مالت">مالت</button></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click',e=>{ if(e.target===modal) closeGlobalSearch(); });
      modal.querySelector('.fox-search-close').addEventListener('click',closeGlobalSearch);
      modal.querySelector('.fox-search-form').addEventListener('submit',e=>{e.preventDefault();submitGlobalSearch(modal.querySelector('#fox-search-modal-input').value);});
      modal.querySelectorAll('[data-search-hint]').forEach(b=>b.addEventListener('click',()=>{modal.querySelector('#fox-search-modal-input').value=b.dataset.searchHint; submitGlobalSearch(b.dataset.searchHint);}));
      const liveInput=modal.querySelector('#fox-search-modal-input');
      liveInput?.addEventListener('input',()=>renderGlobalSearchSuggestions(liveInput.value));
      document.addEventListener('keydown',e=>{if(e.key==='Escape') closeGlobalSearch();});
    }
    modal.classList.remove('hidden');
    renderGlobalSearchSuggestions(modal.querySelector('#fox-search-modal-input')?.value || '');
    requestAnimationFrame(()=>modal.classList.add('is-open'));
    setTimeout(()=>modal.querySelector('#fox-search-modal-input')?.focus(),30);
  }

  function renderGlobalSearchSuggestions(value){
    const host=document.getElementById('fox-search-live-results');
    if(!host) return;
    const q=String(value||'').trim();
    if(!q){ host.innerHTML='<div class="fox-search-empty">جستجو را شروع کن تا پیشنهادهای مرتبط نمایش داده شوند ✨</div>'; return; }
    const results=rankProductsForSearch(Array.isArray(window.products)?window.products:[], q).slice(0,5);
    if(!results.length){ host.innerHTML='<div class="fox-search-empty">محصولی با این عبارت پیدا نشد؛ نام برند، طعم یا نیاز گربه را هم امتحان کن.</div>'; return; }
    host.innerHTML=results.map(p=>`<a class="fox-search-result" href="${productUrl(p)}"><img src="${safeText(p.image||'')}" alt=""><span><b>${safeText(p.name)}</b><small>${safeText(inferredDetails(p).brand || 'PetraPet')} · ${window.formatPrice(p.finalPrice)} تومان</small></span><i class="fa-solid fa-chevron-left"></i></a>`).join('') + `<button type="button" class="fox-search-all">مشاهده همه نتایج برای «${safeText(q)}»</button>`;
    host.querySelector('.fox-search-all')?.addEventListener('click',()=>submitGlobalSearch(q));
  }

  function closeGlobalSearch(){
    const modal=document.getElementById('fox-global-search'); if(!modal) return;
    modal.classList.remove('is-open'); setTimeout(()=>modal.classList.add('hidden'),160);
  }

  function injectPetraSupportLinks(){
    if(!/\/(contact|about)\.html$/.test(location.pathname)) return;
    const main=document.querySelector('main'); if(!main || main.querySelector('.petra-social-hub')) return;
    const box=document.createElement('section'); box.className='petra-social-hub'; box.innerHTML=`<a href="https://wa.me/989960494973" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i><span>واتساپ</span></a><a href="https://t.me/petrapetshop" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-telegram"></i><span>تلگرام</span></a><a href="https://rubika.ir/petrapet" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-comments"></i><span>روبیکا</span></a><a href="https://www.instagram.com/petra_petclinic?stkn=MTVmM2Q4ZGhqNjloMw==" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-instagram"></i><span>اینستاگرام</span></a>`;
    main.appendChild(box);
  }

  function injectTrustFooter(){
    document.querySelectorAll('footer').forEach(footer=>{
      const siblings=[...footer.parentElement.children].filter(el=>el.dataset?.foxVisibleTrust==='1');
      if(siblings.length>1) siblings.slice(0,-1).forEach(el=>el.remove());
      if(siblings.length) return;
      const trust=document.createElement('section');
      trust.dataset.foxVisibleTrust='1';
      trust.className='fox-trust-footer';
      trust.innerHTML='<div class="fox-trust-shell" aria-label="اعتماد و اطلاعات فروشگاه"><div class="fox-trust-mini"><span><i class="fa-solid fa-shield-heart"></i> خرید آگاهانه</span><span><i class="fa-solid fa-certificate"></i> اصالت و تاریخ انقضا طبق اطلاعات ثبت‌شده</span><span><i class="fa-solid fa-truck-fast"></i> ارسال از تبریز</span><span><i class="fa-solid fa-rotate-left"></i> سیاست مرجوعی شفاف</span></div></div>';
      footer.parentNode.insertBefore(trust,footer);
    });
  }

  function refreshAfterStoreReady(){
    patchCartRenderer(); patchRenderers(); patchHomeRenderers(); injectGlobalSearch(); injectTrustFooter(); injectPetraSupportLinks();
    if (document.getElementById('home-featured-grid') && typeof window.renderHomeFeatured === 'function') window.renderHomeFeatured();
    if (document.getElementById('catalog-products-grid') && typeof window.renderProductsCatalog === 'function') window.renderProductsCatalog();
    const commerce = document.getElementById('fox-home-commerce');
    if (commerce) commerce.remove();
    if (document.getElementById('home-categories-grid')) injectHomeCommerceSections();
    updateWishlistUI(); updateCompareBar(); updateShippingUI(); addOrderButtonsToCart();
  }

  function initFeatures(){
    patchCartRenderer(); patchRenderers(); patchHomeRenderers(); injectHeaderLinks(); injectGlobalSearch(); injectTrustFooter(); injectPetraSupportLinks(); updateWishlistUI(); updateCompareBar();
    const path=location.pathname;
    if (document.getElementById('home-featured-grid') && typeof window.renderHomeFeatured === 'function') window.renderHomeFeatured();
    if (document.getElementById('catalog-products-grid') && typeof window.renderProductsCatalog === 'function') window.renderProductsCatalog();
    if(document.getElementById('product-page-root')) renderProductPage();
    if(document.getElementById('favorites-root')) renderFavoritesPage();
    if(document.getElementById('compare-root')) renderComparePage();
    if(document.getElementById('home-categories-grid')) injectHomeCommerceSections();
    enhanceCatalogCards(); addTrustToExistingPriceAreas(); addOrderButtonsToCart(); updateShippingUI();
  }

  let foxInitFeaturesQueued = false;
  let foxStoreRefreshQueued = false;

  function scheduleInitFeatures(){
    if (foxInitFeaturesQueued) return;
    foxInitFeaturesQueued = true;
    const run = () => {
      foxInitFeaturesQueued = false;
      try { initFeatures(); } catch (err) { console.error('PetraPet feature init error:', err); }
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 120 });
    } else {
      setTimeout(run, 0);
    }
  }

  function scheduleStoreRefresh(){
    if (foxStoreRefreshQueued) return;
    foxStoreRefreshQueued = true;
    const run = () => {
      foxStoreRefreshQueued = false;
      try { refreshAfterStoreReady(); } catch (err) { console.error('PetraPet store refresh error:', err); }
      const liveInput=document.getElementById('fox-search-modal-input');
      if(liveInput) renderGlobalSearchSuggestions(liveInput.value || '');
    };
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 220 });
    } else {
      setTimeout(run, 0);
    }
  }

  function wrapInitPage(){
    if(typeof window.initPage !== 'function' || window.initPage.__foxWrapped) return;
    const base=window.initPage;
    const wrapped=function(...args){
      const r=base.apply(this,args);
      scheduleInitFeatures();
      return r;
    };
    wrapped.__foxWrapped=true;
    window.initPage=wrapped;
  }

  // Re-render additive sections once the remote D1 catalog or local fallback has finished loading.
  window.addEventListener('foxshop:store-ready', () => {
    wrapInitPage();
    scheduleStoreRefresh();
  }, { passive: true });

  // One lightweight initialization path instead of multiple 60/350ms delayed passes.
  wrapInitPage();
  document.addEventListener('DOMContentLoaded', () => {
    wrapInitPage();
    scheduleInitFeatures();
  }, { once: true });

  window.__foxshopBuildInvoice = buildInvoiceText;
  window.__foxshopBuildItems = buildItemsText;
  window.updateCompareBar = updateCompareBar;
  window.renderFavoritesPage = renderFavoritesPage;
  window.renderComparePage = renderComparePage;
})();
