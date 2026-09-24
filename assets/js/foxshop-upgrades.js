/* PetRaPet additive upgrades: advanced filtering, recommendations, account sync and review UX. */
(() => {
  'use strict';
  if (window.__FOXSHOP_UPGRADES__) return;
  window.__FOXSHOP_UPGRADES__ = true;

  const LS_WISH = 'foxshop_wishlist_v1';
  const LS_CART = 'foxshop_cart_data';
  const LS_RECENT = 'foxshop_recent_v1';
  const safe = value => typeof window.escapeHtml === 'function' ? window.escapeHtml(value) : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fa = value => { try { return Number(value || 0).toLocaleString('fa-IR'); } catch (_) { return String(value || 0); } };
  const money = value => `${fa(Math.round(Number(value) || 0))} تومان`;

  function products() { return Array.isArray(window.products) ? window.products : []; }
  function getProduct(id) { const k=String(id ?? ''); return products().find(p=>String(p?.id)===k) || null; }
  function details(p) { return p?.details || {}; }
  function brandOf(p) { const direct=String(details(p).brand||'').trim(); if(direct) return direct; const m=String(p?.name||'').match(/(Royal Canin|GimCat|Schesir|Wanpy|Van Cat|Smart Paw|رویال کنین|جیم کت|شسیر|وانپی|ون کت)/i); return m?m[1]:''; }
  function list(key) { try { const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v.map(String).filter(Boolean):[]; } catch (_) { return []; } }
  function saveList(key, value) { try { localStorage.setItem(key, JSON.stringify([...new Set(value.map(String))])); } catch (_) {} }
  function productUrl(p) { return `product.html?id=${encodeURIComponent(String(p.id))}`; }
  function textBlob(p) { const d=details(p); return `${p?.name||''} ${p?.shortDesc||''} ${d.brand||''} ${d.goals||''} ${d.suitableAge||''} ${Array.isArray(d.tags)?d.tags.join(' '):String(d.tags||'')} ${d.ingredients||''}`.toLowerCase(); }
  function normalize(value) { return String(value ?? '').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ').trim(); }

  function rememberViewed(id) {
    const key=String(id||''); if(!key) return;
    const current=list(LS_RECENT).filter(x=>x!==key); current.unshift(key); saveList(LS_RECENT,current.slice(0,10));
  }

  function recommendationScore(p, seed) {
    if(!p) return -99999;
    const d=details(p), seedD=details(seed);
    let score=0;
    if(seed && String(p.categoryId)===String(seed.categoryId)) score+=32;
    if(seed && brandOf(p) && brandOf(seed) && normalize(brandOf(p))===normalize(brandOf(seed))) score+=26;
    const pTags=Array.isArray(d.tags)?d.tags.map(normalize):[];
    const sTags=Array.isArray(seedD.tags)?seedD.tags.map(normalize):[];
    if(pTags.length && sTags.length) score += sTags.filter(t=>pTags.includes(t)).length*7;
    const pGoals=normalize(d.goals), sGoals=normalize(seedD.goals);
    if(pGoals && sGoals && pGoals.split(/[,،\s]+/).some(x=>x && sGoals.includes(x))) score+=10;
    if(Number(p.isBestSeller)) score+=5;
    if(Number(p.isFeatured)) score+=3;
    if(Number(p.stockStatus)!==0 && p.stockStatus!=='out_of_stock') score+=3;
    if(seed && Number(seed.finalPrice)>0 && Number(p.finalPrice)>0) {
      const ratio=Number(p.finalPrice)/Number(seed.finalPrice);
      if(ratio>=0.65 && ratio<=1.35) score+=8;
    }
    const recent=list(LS_RECENT);
    if(recent.includes(String(p.id))) score+=6;
    return score;
  }

  function recommendationProducts(seed=null, limit=4) {
    const all=products().filter(p=>p && p.stockStatus!=='out_of_stock');
    const wish=list(LS_WISH), cart=(()=>{try{return JSON.parse(localStorage.getItem(LS_CART)||'[]')}catch(_){return[]}})();
    const seeds=[];
    if(seed) seeds.push(seed);
    for(const id of wish.slice(0,3)) { const p=getProduct(id); if(p) seeds.push(p); }
    for(const item of Array.isArray(cart)?cart.slice(0,3):[]) { const p=getProduct(item?.id); if(p) seeds.push(p); }
    return all.map(p=>{
      let score=0;
      for(const s of seeds) score+=recommendationScore(p,s);
      return {p,score};
    }).sort((a,b)=>b.score-a.score || Number(b.p.isBestSeller)-Number(a.p.isBestSeller) || Number(a.p.finalPrice)-Number(b.p.finalPrice))
      .slice(0,limit).map(x=>x.p);
  }

  function card(p) {
    const x=details(p), wished=list(LS_WISH).includes(String(p.id));
    const discount=Number(p.discountPercent)||((Number(p.originalPrice)>Number(p.finalPrice))?Math.round((1-Number(p.finalPrice)/Number(p.originalPrice))*100):0);
    return `<article class="fox-upgrade-card product-card-item"><div class="fox-upgrade-card-media"><a href="${productUrl(p)}"><img src="${safe(p.image||'')}" alt="${safe(p.name)}" loading="lazy" decoding="async"></a>${discount>0?`<span class="fox-upgrade-discount">${fa(discount)}٪ تخفیف</span>`:''}<button type="button" class="fox-upgrade-heart ${wished?'is-active':''}" onclick="toggleWishlist('${safe(p.id)}',event)" aria-label="علاقه‌مندی"><i class="${wished?'fa-solid':'fa-regular'} fa-heart"></i></button></div><div class="fox-upgrade-card-body"><a href="${productUrl(p)}" class="fox-upgrade-title">${safe(p.name)}</a><div class="fox-upgrade-meta"><span>${safe(x.brand||'برند نامشخص')}</span><span>${safe(x.weight||'')}</span></div><div class="fox-upgrade-price">${money(p.finalPrice)}</div><button type="button" onclick="addToCart('${safe(p.id)}')" class="fox-upgrade-add" ${p.stockStatus==='out_of_stock'?'disabled':''}>${p.stockStatus==='out_of_stock'?'ناموجود':'افزودن به سبد'} <i class="fa-solid fa-cart-plus"></i></button></div></article>`;
  }

  function injectAccountLinks() {
    document.querySelectorAll('header').forEach(header=>{
      if(header.querySelector('[data-fox-account-link]')) return;
      const action = header.querySelector('#cart-trigger-btn')?.parentElement || header.querySelector('.max-w-7xl > div:last-child') || header.querySelector('.max-w-7xl');
      if(!action) return;
      const a=document.createElement('a'); a.href='account.html'; a.dataset.foxAccountLink='1'; a.className='fox-account-link-inline'; a.innerHTML='<i class="fa-regular fa-user"></i><span>حساب کاربری</span>'; a.setAttribute('aria-label','حساب کاربری');
      action.insertBefore(a, action.firstElementChild || null);
    });
  }

  let catalogBase=null;
  function advancedFilterValues() {
    return {
      brand: document.getElementById('fox-filter-brand')?.value || 'all',
      min: Number(document.getElementById('fox-filter-min')?.value) || 0,
      max: Number(document.getElementById('fox-filter-max')?.value) || 0,
      stock: document.getElementById('fox-filter-stock')?.value || 'all',
      discount: Boolean(document.getElementById('fox-filter-discount')?.checked),
      best: Boolean(document.getElementById('fox-filter-best')?.checked)
    };
  }
  function applyAdvancedFilter(listValue, f) {
    return listValue.filter(p=>{
      if(f.brand!=='all' && normalize(brandOf(p))!==normalize(f.brand)) return false;
      const price=Number(p.finalPrice)||0;
      if(f.min && price<f.min) return false;
      if(f.max && price>f.max) return false;
      if(f.stock==='in' && p.stockStatus==='out_of_stock') return false;
      if(f.stock==='low' && p.stockStatus!=='low_stock') return false;
      if(f.stock==='out' && p.stockStatus!=='out_of_stock') return false;
      if(f.discount && !(Number(p.discountPercent)>0 || Number(p.originalPrice)>Number(p.finalPrice))) return false;
      if(f.best && !Number(p.isBestSeller)) return false;
      return true;
    });
  }
  function renderAdvancedFilterDom() {
    const grid=document.getElementById('catalog-products-grid'); if(!grid || document.getElementById('fox-advanced-filters')) return;
    const brands=[...new Set(products().map(p=>brandOf(p)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa'));
    const shell=document.createElement('section'); shell.id='fox-advanced-filters'; shell.className='fox-filter-shell';
    shell.innerHTML=`<div class="fox-filter-head"><div><span>فیلتر هوشمند</span><h2>پیدا کردن محصول مناسب</h2></div><button type="button" id="fox-filter-reset" class="fox-filter-reset">پاک کردن همه</button></div><div class="fox-filter-grid"><label>برند<select id="fox-filter-brand"><option value="all">همه برندها</option>${brands.map(b=>`<option value="${safe(b)}">${safe(b)}</option>`).join('')}</select></label><label>حداقل قیمت<input id="fox-filter-min" type="number" min="0" inputmode="numeric" placeholder="مثلاً ۳۰۰۰۰۰"></label><label>حداکثر قیمت<input id="fox-filter-max" type="number" min="0" inputmode="numeric" placeholder="مثلاً ۳۰۰۰۰۰۰"></label><label>موجودی<select id="fox-filter-stock"><option value="all">همه</option><option value="in">فقط موجود</option><option value="low">موجودی محدود</option><option value="out">ناموجود</option></select></label></div><div class="fox-filter-checks"><label><input id="fox-filter-discount" type="checkbox"> فقط تخفیف‌دار</label><label><input id="fox-filter-best" type="checkbox"> فقط پرفروش‌ها</label></div><div id="fox-filter-summary" class="fox-filter-summary"></div>`;
    grid.parentNode.insertBefore(shell,grid);
    const refresh=()=>{ if(typeof window.renderProductsCatalog==='function') window.renderProductsCatalog(); };
    shell.querySelectorAll('select,input').forEach(el=>el.addEventListener(el.type==='number'?'change':'change',refresh));
    shell.querySelectorAll('input[type=number]').forEach(el=>el.addEventListener('input',()=>{clearTimeout(el._t);el._t=setTimeout(refresh,250);}));
    shell.querySelector('#fox-filter-reset')?.addEventListener('click',()=>{
      document.getElementById('fox-filter-brand').value='all'; document.getElementById('fox-filter-min').value=''; document.getElementById('fox-filter-max').value=''; document.getElementById('fox-filter-stock').value='all'; document.getElementById('fox-filter-discount').checked=false; document.getElementById('fox-filter-best').checked=false; refresh();
    });
  }
  function applyAdvancedFilterToDom() {
    const grid=document.getElementById('catalog-products-grid'); if(!grid) return;
    const f=advancedFilterValues();
    const allowed=new Set(applyAdvancedFilter(products(),f).map(p=>String(p.id)));
    let shown=0;
    grid.querySelectorAll('.product-card-item').forEach(card=>{
      const id=card.querySelector('[data-wishlist-id]')?.getAttribute('data-wishlist-id') || card.querySelector('a[href*="product.html?id="]')?.href?.split('id=')[1] || '';
      const visible=allowed.has(String(id).split('&')[0]); card.hidden=!visible; if(visible) shown++;
    });
    const summary=document.getElementById('fox-filter-summary'); if(summary) summary.textContent=`${fa(shown)} محصول مطابق فیلترهای انتخاب‌شده است.`;
    const empty=document.getElementById('catalog-empty-view'); if(empty && grid.children.length) empty.classList.toggle('hidden', shown>0);
  }
  function wrapCatalog() {
    if(catalogBase || typeof window.renderProductsCatalog!=='function') return;
    // Let the existing storefront enhancement wrap the original renderer first.
    if(!window.renderProductsCatalog.__foxWrapped) return;
    catalogBase=window.renderProductsCatalog;
    const wrapped=function(...args){ const r=catalogBase.apply(this,args); applyAdvancedFilterToDom(); return r; };
    wrapped.__foxWrapped=true; wrapped.__foxAdvancedWrapped=true; window.renderProductsCatalog=wrapped;
    renderAdvancedFilterDom();
    window.renderProductsCatalog();
  }

  function installCustomerSync() {
    if(!window.fetch || window.__FOX_CUSTOMER_SYNC__) return;
    window.__FOX_CUSTOMER_SYNC__=true;
    let timer=null;
    const syncCart=()=>{
      clearTimeout(timer); timer=setTimeout(()=>{ const items=Array.isArray(window.cart)?window.cart.map(i=>({id:String(i.id),quantity:Math.min(99,Math.max(1,Math.floor(Number(i.quantity)||1)))})):[]; fetch('/api/account/cart',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({items})}).catch(()=>{}); },450);
    };
    const wrap=(name, after)=>{
      if(typeof window[name]!=='function' || window[name].__foxCustomerWrapped) return;
      const base=window[name]; const fn=function(...args){ const result=base.apply(this,args); try{after?.(...args);}catch(_){} return result; }; fn.__foxCustomerWrapped=true; window[name]=fn;
    };
    wrap('toggleWishlist',(id)=>{ const active=list(LS_WISH).includes(String(id)); fetch('/api/account/favorites',{method:'PUT',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({productId:String(id),active})}).catch(()=>{}); });
    wrap('addToCart',syncCart); wrap('removeFromCart',syncCart); wrap('updateCartQuantity',syncCart);
    wrap('orderCartBy',channel=>{ const items=Array.isArray(window.cart)?window.cart.map(i=>({id:String(i.id),quantity:Number(i.quantity)||1})):[]; if(!items.length)return; fetch('/api/account/orders',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({channel,items})}).catch(()=>{}); });
  }

  function injectHomeRecommendations() {
    const anchor=document.getElementById('home-categories-grid'); if(!anchor || document.getElementById('fox-home-recommendations')) return;
    const recs=recommendationProducts(null,4); if(!recs.length)return;
    const hasSignals=list(LS_RECENT).length || list(LS_WISH).length;
    const section=document.createElement('section'); section.id='fox-home-recommendations'; section.className='fox-recommend-section';
    section.innerHTML=`<div class="fox-recommend-head"><div><span>${hasSignals?'پیشنهاد هوشمند':'محبوب‌های پیشنهادی'}</span><h2>${hasSignals?'شاید این‌ها هم برایت جذاب باشند 🐾':'چند انتخاب خوب برای شروع 🐾'}</h2><p>${hasSignals?'بر اساس علاقه‌مندی‌ها، سبد خرید و محصولات دیده‌شده.':'برای شروع، محصولات پرفروش و منتخب فروشگاه را می‌بینی.'}</p></div><a href="products.html">مشاهده همه <i class="fa-solid fa-arrow-left"></i></a></div><div class="fox-upgrade-grid">${recs.map(card).join('')}</div>`;
    anchor.parentNode.insertBefore(section,anchor.nextSibling);
  }

  function injectProductRecommendations() {
    const root=document.getElementById('product-page-root'); if(!root) return;
    const raw=new URLSearchParams(location.search).get('id') || (location.pathname.match(/\/product\/([^/]+)/)||[])[1];
    const seed=getProduct(raw); if(!seed)return;
    rememberViewed(seed.id);
    injectProductSeo(seed);
    if(root.querySelector('#fox-product-smart-recs')) return;
    const recs=recommendationProducts(seed,4).filter(p=>String(p.id)!==String(seed.id)); if(!recs.length)return;
    const section=document.createElement('section'); section.id='fox-product-smart-recs'; section.className='fox-recommend-section';
    section.innerHTML=`<div class="fox-recommend-head"><div><span>برای تو انتخاب شده</span><h2>پیشنهادهای هوشمند نزدیک به این محصول</h2><p>محصولاتی با ویژگی‌ها یا کاربردهای نزدیک به چیزی که الان می‌بینی.</p></div></div><div class="fox-upgrade-grid">${recs.map(card).join('')}</div>`;
    root.appendChild(section);
  }

  function setMetaAttr(attr,name,content){ if(!content)return; let el=document.head.querySelector(`meta[${attr}="${name}"]`); if(!el){el=document.createElement('meta');el.setAttribute(attr,name);document.head.appendChild(el);} el.setAttribute('content',content); }
  function injectProductSeo(p){
    const origin=location.origin; const canonical=`${origin}/product/${encodeURIComponent(String(p.id))}`; const title=`${String(p.name||'محصول').trim()} | PetRaPet`;
    const description=String(p.shortDesc||p.fullDesc||'خرید و مشخصات کامل محصول در پت‌شاپ PetRaPet').replace(/\s+/g,' ').slice(0,170);
    let link=document.head.querySelector('link[rel="canonical"]'); if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link);} link.href=canonical;
    document.title=title; setMetaAttr('name','description',description); setMetaAttr('property','og:title',title); setMetaAttr('property','og:description',description); setMetaAttr('property','og:url',canonical); if(p.image)setMetaAttr('property','og:image',p.image);
    let ld=document.getElementById('fox-product-jsonld'); if(!ld){ld=document.createElement('script');ld.id='fox-product-jsonld';ld.type='application/ld+json';document.head.appendChild(ld);}
    const d=details(p); const data={'@context':'https://schema.org','@type':'Product',name:p.name,image:p.image?[p.image]:[],description,brand:brandOf(p)?{'@type':'Brand',name:brandOf(p)}:undefined,sku:d.barcode||p.id,offers:{'@type':'Offer',price:Number(p.finalPrice)||0,priceCurrency:'IRR',availability:p.stockStatus==='out_of_stock'?'https://schema.org/OutOfStock':'https://schema.org/InStock',url:canonical},aggregateRating:Number(d.reviewCount)>0&&Number(d.rating)>0?{'@type':'AggregateRating',ratingValue:Number(d.rating),reviewCount:Number(d.reviewCount)}:undefined};
    ld.textContent=JSON.stringify(data);
  }

  function reviewEnhancement() {
    const section=document.querySelector('.fox-review-section'), listEl=section?.querySelector('.fox-approved-reviews'); if(!section || !listEl || section.dataset.foxReviewEnhanced) return;
    section.dataset.foxReviewEnhanced='1';
    const cards=[...listEl.querySelectorAll('.fox-review-card')];
    cards.forEach((el,index)=>{ const stars=el.querySelector('.fox-review-stars')?.textContent?.trim()||''; el.dataset.rating=String(Math.min(5,Math.max(1,stars.length))); el.dataset.order=String(index); });
    const total=cards.length; const counts=[1,2,3,4,5].map(n=>cards.filter(c=>Number(c.dataset.rating)===n).length);
    const summary=document.createElement('div'); summary.className='fox-review-analytics';
    summary.innerHTML=`<div class="fox-review-analytics-score"><strong>${cards.length?(counts.reduce((s,c,i)=>s+c*(i+1),0)/cards.length).toFixed(1):'—'}</strong><span>از ۵</span><small>${fa(total)} نظر ثبت‌شده</small></div><div class="fox-review-bars">${[5,4,3,2,1].map(n=>{const c=counts[n-1]||0;const pct=total?Math.round(c/total*100):0;return `<div><span>${fa(n)} ستاره</span><div><i style="width:${pct}%"></i></div><em>${fa(c)}</em></div>`}).join('')}</div>`;
    const heading=section.querySelector('.fox-review-heading'); heading?.after(summary);
    const toolbar=document.createElement('div'); toolbar.className='fox-review-toolbar'; toolbar.innerHTML='<span>مرتب‌سازی نظرات</span><div><button type="button" data-sort="new">جدیدترین</button><button type="button" data-sort="high">بالاترین امتیاز</button><button type="button" data-sort="low">کمترین امتیاز</button></div>';
    listEl.before(toolbar);
    toolbar.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
      const sorted=[...cards].sort((a,b)=>{ if(btn.dataset.sort==='high'||btn.dataset.sort==='low'){const diff=Number(a.dataset.rating)-Number(b.dataset.rating);return btn.dataset.sort==='high'?-diff:diff;} return Number(a.dataset.order)-Number(b.dataset.order); });
      sorted.forEach(c=>listEl.appendChild(c)); toolbar.querySelectorAll('button').forEach(b=>b.classList.remove('is-active')); btn.classList.add('is-active');
    }));
    toolbar.querySelector('[data-sort="new"]')?.classList.add('is-active');
  }

  function init() {
    injectAccountLinks();
    installCustomerSync();
    if(document.getElementById('products-page-root') || document.getElementById('catalog-products-grid')) wrapCatalog();
    if(document.getElementById('product-page-root')) { injectProductRecommendations(); reviewEnhancement(); }
    if(document.getElementById('home-categories-grid')) injectHomeRecommendations();
  }

  function readyInit() {
    injectAccountLinks();
    if(window.__FOXSHOP_STORE_READY__===true) setTimeout(init,30);
    window.addEventListener('foxshop:store-ready',()=>setTimeout(init,20),{once:false});
    setTimeout(()=>{try{init();}catch(e){console.error('PetRaPet upgrade init error',e);}},250);
    setTimeout(()=>{try{wrapCatalog();reviewEnhancement();injectProductRecommendations();installCustomerSync();}catch(e){}},900);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',readyInit,{once:true}); else readyInit();
})();
