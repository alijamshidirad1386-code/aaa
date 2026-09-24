/* PetRaPet customer account/auth UI. Loaded only on auth/account pages to keep the storefront light. */
(() => {
  'use strict';
  const CART_KEY = 'foxshop_cart_data';
  const WISH_KEY = 'foxshop_wishlist_v1';
  const NEEDS_PASSWORD_KEY = 'foxshop_needs_password_v1';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const faDigits = value => String(value ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  const price = value => { try { return new Intl.NumberFormat('fa-IR').format(Number(value) || 0); } catch (_) { return faDigits(Math.round(Number(value)||0)); } };
  const date = value => { try { return new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium'}).format(new Date(value)); } catch (_) { return ''; } };
  const api = async (path, options = {}) => {
    const res = await fetch(`/api${path}`, { credentials:'same-origin', ...options, headers:{ ...(options.body ? {'content-type':'application/json'} : {}), ...(options.headers || {}) } });
    const text = await res.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch (_) {}
    if (!res.ok || data.ok === false) { const e = new Error(data.error || `HTTP ${res.status}`); e.status=res.status; throw e; }
    return data;
  };
  const localList = key => { try { const x=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(x)?x.map(String).filter(Boolean):[]; } catch(_){ return []; } };
  const localCart = () => { try { const x=JSON.parse(localStorage.getItem(CART_KEY)||'[]'); return Array.isArray(x)?x.filter(i=>i&&i.id).map(i=>({id:String(i.id),quantity:Math.min(99,Math.max(1,Math.floor(Number(i.quantity)||1)))})):[]; } catch(_){ return []; } };
  const saveLocalCart = items => { try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (_) {} };
  const saveWishlist = items => { try { localStorage.setItem(WISH_KEY, JSON.stringify([...new Set(items.map(String))])); } catch (_) {} };

  function toast(message, type='success') {
    const existing = document.getElementById('account-toast');
    const node = existing || document.createElement('div');
    node.id='account-toast'; node.className=`fox-account-toast ${type}`; node.textContent=message;
    if(!existing) document.body.appendChild(node);
    clearTimeout(node._timer); node._timer=setTimeout(()=>node.remove(),3200);
  }

  function loginPage() {
    return document.getElementById('fox-auth-root');
  }
  function accountPage() {
    return document.getElementById('fox-account-root');
  }

  let authStep = 'identifier';
  let authMode = 'password';
  let authIdentifier = '';
  let authTimer = null;
  let authSeconds = 0;

  function renderLogin() {
    const root=loginPage(); if(!root)return;
    const isCode=authStep==='code';
    root.innerHTML=`<div class="fox-auth-shell"><div class="fox-auth-brand"><div class="fox-auth-paw"><i class="fa-solid fa-paw"></i></div><div><b>Fox<span>Shop</span></b><small>ورود و ثبت‌نام با ایمیل</small></div></div>
      <div class="fox-auth-grid"><section class="fox-auth-card"><div class="fox-auth-heading"><span>${isCode?'تأیید امن ایمیل':'ورود یا ساخت حساب'}</span><h1>${isCode?'کد تأیید ایمیل را وارد کن':'به PetRaPet خوش اومدی 🐾'}</h1><p>${isCode?`کد ۶ رقمی که به <strong>${safe(authIdentifier)}</strong> فرستادیم را وارد کن.`:'برای ساخت حساب یا ورود سریع، ایمیلت را وارد کن. حساب جدید با تأیید ایمیل ساخته می‌شود و بعد از آن یک رمز برای ورودهای بعدی تنظیم می‌کنی.'}</p></div>
      ${!isCode?`<div class="fox-auth-tabs"><button type="button" class="${authMode==='password'?'is-active':''}" data-auth-mode="password">ورود با رمز</button><button type="button" class="${authMode==='code'?'is-active':''}" data-auth-mode="code">ورود / ثبت‌نام با کد</button></div>
        <div id="fox-auth-password-pane" class="${authMode==='password'?'':'hidden'}"><form id="fox-password-login-form" class="fox-auth-form"><label>ایمیل<input id="fox-login-identifier" type="email" autocomplete="username" inputmode="email" placeholder="example@email.com" required></label><label>رمز عبور<div class="fox-password-field"><input id="fox-login-password" type="password" autocomplete="current-password" placeholder="رمز عبور" required><button type="button" data-toggle-password="fox-login-password" aria-label="نمایش رمز"><i class="fa-regular fa-eye"></i></button></div></label><button class="fox-auth-primary" type="submit">ورود به حساب <i class="fa-solid fa-arrow-left"></i></button><button class="fox-auth-secondary" type="button" id="fox-show-code">ساخت حساب / ورود با کد ایمیل</button></form></div>
        <div id="fox-auth-code-pane" class="${authMode==='code'?'':'hidden'}"><form id="fox-code-request-form" class="fox-auth-form"><label>ایمیل شما<input id="fox-code-identifier" type="email" autocomplete="email" inputmode="email" placeholder="example@email.com" required></label><div class="fox-email-note"><i class="fa-regular fa-envelope"></i><span>کد تأیید مستقیماً به ایمیل شما ارسال می‌شود.</span></div><button class="fox-auth-primary" type="submit">ارسال کد تأیید به ایمیل <i class="fa-solid fa-paper-plane"></i></button></form></div>`:
      `<form id="fox-verify-form" class="fox-auth-form"><div class="fox-verify-target"><i class="fa-regular fa-envelope"></i><span>${safe(authIdentifier)}</span><button type="button" id="fox-change-identifier">تغییر ایمیل</button></div><label>کد ۶ رقمی<input id="fox-auth-code" class="fox-code-input" maxlength="6" minlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="••••••" required></label><button class="fox-auth-primary" type="submit">تأیید ایمیل و ورود <i class="fa-solid fa-check"></i></button><button class="fox-auth-secondary" type="button" id="fox-resend-code" disabled>ارسال دوباره <span id="fox-resend-countdown"></span></button></form>`}
      <div id="fox-auth-status" class="fox-auth-status" aria-live="polite"></div></section>
      <aside class="fox-auth-side"><div class="fox-auth-side-art"><i class="fa-solid fa-cat"></i><span class="fox-float-paw">🐾</span><span class="fox-float-heart">♥</span></div><h2>حساب شخصی PetRaPet 🐾</h2><p>با حساب کاربری، علاقه‌مندی‌ها، سبد خرید و سابقه درخواست‌های سفارش برای خودت ذخیره می‌شوند.</p><div class="fox-auth-benefits"><div><i class="fa-regular fa-envelope"></i><span>تأیید با ایمیل واقعی</span></div><div><i class="fa-solid fa-heart"></i><span>علاقه‌مندی‌های همگام</span></div><div><i class="fa-solid fa-shield-heart"></i><span>ورود امن با رمز عبور</span></div></div></aside></div><a href="index.html" class="fox-auth-back"><i class="fa-solid fa-arrow-right"></i> برگشت به فروشگاه</a></div>`;
    bindLoginEvents();
  }

  function setStatus(message, type='') { const el=document.getElementById('fox-auth-status'); if(el){ el.textContent=message||''; el.className=`fox-auth-status ${type}`; } }

  function bindLoginEvents() {
    document.querySelectorAll('[data-toggle-password]').forEach(btn=>btn.addEventListener('click',()=>{const input=document.getElementById(btn.dataset.togglePassword); if(!input)return; input.type=input.type==='password'?'text':'password'; btn.innerHTML=input.type==='password'?'<i class="fa-regular fa-eye"></i>':'<i class="fa-regular fa-eye-slash"></i>'; }));
    document.querySelectorAll('[data-auth-mode]').forEach(tab=>tab.addEventListener('click',()=>{ authMode=tab.dataset.authMode==='code'?'code':'password'; document.querySelectorAll('[data-auth-mode]').forEach(t=>t.classList.toggle('is-active',t===tab)); document.getElementById('fox-auth-password-pane')?.classList.toggle('hidden',authMode!=='password'); document.getElementById('fox-auth-code-pane')?.classList.toggle('hidden',authMode!=='code'); }));
    document.getElementById('fox-show-code')?.addEventListener('click',()=>{authMode='code'; renderLogin();});
    document.getElementById('fox-password-login-form')?.addEventListener('submit',passwordLogin);
    document.getElementById('fox-code-request-form')?.addEventListener('submit',requestCode);
    document.getElementById('fox-verify-form')?.addEventListener('submit',verifyCode);
    document.getElementById('fox-change-identifier')?.addEventListener('click',()=>{ stopTimer(); authStep='identifier'; authMode='code'; renderLogin(); });
    document.getElementById('fox-resend-code')?.addEventListener('click',requestCodeFromStored);
  }

  async function passwordLogin(event) {
    event.preventDefault(); const id=document.getElementById('fox-login-identifier')?.value.trim(); const pw=document.getElementById('fox-login-password')?.value||''; setStatus('در حال ورود…','loading');
    try { await api('/auth/login-password',{method:'POST',body:JSON.stringify({identifier:id,password:pw})}); localStorage.removeItem(NEEDS_PASSWORD_KEY); location.href='account.html'; } catch(e){ setStatus(e.message||'ورود ناموفق بود.','error'); }
  }
  async function requestCode(event) { event?.preventDefault(); const input=document.getElementById('fox-code-identifier'); authIdentifier=input?.value.trim()||''; await sendCode(); }
  async function requestCodeFromStored(){ if(authSeconds>0)return; await sendCode(); }
  async function sendCode(){ setStatus('در حال ارسال کد به ایمیل…','loading'); try { const data=await api('/auth/request-code',{method:'POST',body:JSON.stringify({identifier:authIdentifier})}); authStep='code'; renderLogin(); startTimer(data.expiresIn||600); setStatus(`کد به ${data.masked||authIdentifier} ارسال شد. صندوق Spam/Junk را هم بررسی کن.`,'success'); setTimeout(()=>document.getElementById('fox-auth-code')?.focus(),50); } catch(e){ setStatus(e.message||'ارسال کد انجام نشد.','error'); } }
  async function verifyCode(event){ event.preventDefault(); const code=document.getElementById('fox-auth-code')?.value.trim(); setStatus('در حال بررسی کد…','loading'); try { const data=await api('/auth/verify-code',{method:'POST',body:JSON.stringify({identifier:authIdentifier,code})}); stopTimer(); if(data.needsPassword){ localStorage.setItem(NEEDS_PASSWORD_KEY,'1'); location.href='account.html?setup=password'; } else { localStorage.removeItem(NEEDS_PASSWORD_KEY); location.href='account.html'; } } catch(e){ setStatus(e.message||'کد نادرست است.','error'); } }
  function startTimer(seconds){ stopTimer(); authSeconds=Math.max(0,Number(seconds)||600); const btn=document.getElementById('fox-resend-code'); if(btn)btn.disabled=authSeconds>0; const tick=()=>{ const label=document.getElementById('fox-resend-countdown'); if(label)label.textContent=authSeconds>0?` (${faDigits(authSeconds)} ثانیه)`:''; if(authSeconds<=0){ if(btn)btn.disabled=false; return; } authSeconds--; authTimer=setTimeout(tick,1000); }; tick(); }
  function stopTimer(){ if(authTimer)clearTimeout(authTimer); authTimer=null; authSeconds=0; }


  async function renderAccount(){
    const root=accountPage(); if(!root)return;
    root.innerHTML='<div class="fox-account-loading"><div class="fox-auth-paw"><i class="fa-solid fa-paw"></i></div><h1>در حال بارگذاری حساب…</h1></div>';
    try {
      const [account,store] = await Promise.all([api('/account'),api('/store').catch(()=>({products:[],categories:[]}))]);
      if(!account.authenticated){ location.href='login.html?next=account'; return; }
      const products=Array.isArray(store.products)?store.products:[];
      const productById=id=>products.find(p=>String(p.id)===String(id));
      // Merge a browser cart with server cart after login, keeping the larger quantity for each SKU.
      const mergedMap=new Map((account.cart||[]).map(i=>[String(i.id),{id:String(i.id),quantity:Number(i.quantity)||1}]));
      for(const item of localCart()){ const id=String(item.id); const current=mergedMap.get(id); if(!current || item.quantity>current.quantity) mergedMap.set(id,item); }
      const merged=[...mergedMap.values()];
      if(merged.length !== (account.cart||[]).length || merged.some(i=>!(account.cart||[]).find(x=>String(x.id)===String(i.id)&&Number(x.quantity)===Number(i.quantity)))) await api('/account/cart',{method:'PUT',body:JSON.stringify({items:merged})}).catch(()=>{});
      saveLocalCart(merged.map(i=>({id:i.id,quantity:i.quantity})));
      const favoriteIds=[...new Set([...(account.favoriteIds||[]),...localList(WISH_KEY)])];
      for(const id of favoriteIds) if(!(account.favoriteIds||[]).includes(id)) await api('/account/favorites',{method:'PUT',body:JSON.stringify({productId:id,active:true})}).catch(()=>{});
      saveWishlist(favoriteIds);
      renderAccountView(root,{...account,cart:merged,favoriteIds,products,productById});
    } catch(e){ root.innerHTML=`<div class="fox-account-error"><i class="fa-solid fa-triangle-exclamation"></i><h1>حساب کاربری بارگذاری نشد</h1><p>${safe(e.message||'خطای اتصال')}</p><button type="button" onclick="location.reload()">تلاش دوباره</button></div>`; }
  }

  function renderAccountView(root,data){
    const {profile,cart,favoriteIds,orders,products,productById}=data;
    const favProducts=favoriteIds.map(productById).filter(Boolean);
    const cartItems=cart.map(i=>({...i,p:productById(i.id)})).filter(i=>i.p||i.name);
    const total=cartItems.reduce((s,i)=>s+(Number(i.p?.finalPrice||i.price)||0)*Number(i.quantity||1),0);
    root.innerHTML=`<div class="fox-account-shell"><div class="fox-account-hero"><div class="fox-account-avatar"><i class="fa-solid fa-cat"></i></div><div class="min-w-0"><span class="fox-eyebrow">حساب کاربری</span><h1>${safe(profile.displayName||'کاربر PetRaPet')}</h1><p>${safe(profile.email||'حساب تأییدشده PetRaPet')}</p></div><div class="fox-account-actions"><a href="products.html" class="fox-account-btn secondary"><i class="fa-solid fa-bag-shopping"></i> فروشگاه</a><button id="fox-logout" class="fox-account-btn danger"><i class="fa-solid fa-right-from-bracket"></i> خروج</button></div></div>
      ${localStorage.getItem(NEEDS_PASSWORD_KEY)==='1' || !profile.hasPassword ? `<section class="fox-account-banner"><div><b>رمز عبورت را تنظیم کن 🔐</b><p>برای ورودهای بعدی سریع‌تر، یک رمز ۸ کاراکتری یا بیشتر برای حسابت بگذار.</p></div><button type="button" id="fox-open-password">تنظیم رمز</button></section>`:''}
      <div class="fox-account-stats"><div><b>${faDigits(favProducts.length)}</b><span>علاقه‌مندی</span></div><div><b>${faDigits(cart.reduce((s,i)=>s+Number(i.quantity||1),0))}</b><span>کالا در سبد</span></div><div><b>${faDigits((orders||[]).length)}</b><span>درخواست سفارش</span></div></div>
      <div class="fox-account-grid"><section class="fox-account-panel"><div class="fox-panel-title"><div><span class="fox-eyebrow">سبد خرید</span><h2>سبد خرید ذخیره‌شده</h2></div><a href="products.html?cart=1" class="fox-mini-link">باز کردن سبد</a></div>${cartItems.length?`<div class="fox-account-products">${cartItems.map(i=>`<div class="fox-account-product"><img src="${safe(i.p?.image||i.image||'')}" alt="${safe(i.p?.name||i.name)}" loading="lazy"><div class="min-w-0"><b>${safe(i.p?.name||i.name)}</b><span>${faDigits(i.quantity)} × ${price(i.p?.finalPrice||i.price)} تومان</span></div><button type="button" data-cart-remove="${safe(i.id)}" aria-label="حذف"><i class="fa-solid fa-trash"></i></button></div>`).join('')}</div><div class="fox-account-total"><span>مجموع فعلی</span><b>${price(total)} تومان</b></div>`:'<div class="fox-account-empty"><i class="fa-solid fa-cart-shopping"></i><p>سبد خریدت خالی است.</p><a href="products.html">رفتن به فروشگاه</a></div>'}</section>
      <section class="fox-account-panel"><div class="fox-panel-title"><div><span class="fox-eyebrow">علاقه‌مندی‌ها</span><h2>محصولات ذخیره‌شده</h2></div><a href="favorites.html" class="fox-mini-link">مشاهده همه</a></div>${favProducts.length?`<div class="fox-account-products">${favProducts.slice(0,8).map(p=>`<a class="fox-account-product" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${safe(p.image)}" alt="${safe(p.name)}" loading="lazy"><div class="min-w-0"><b>${safe(p.name)}</b><span>${price(p.finalPrice)} تومان</span></div><i class="fa-solid fa-chevron-left"></i></a>`).join('')}</div>`:'<div class="fox-account-empty"><i class="fa-regular fa-heart"></i><p>هنوز چیزی ذخیره نکرده‌ای.</p><a href="products.html">پیدا کردن محصول</a></div>'}</section>
      <section class="fox-account-panel"><div class="fox-panel-title"><div><span class="fox-eyebrow">سفارش‌ها</span><h2>سابقه درخواست سفارش</h2></div></div>${(orders||[]).length?`<div class="fox-account-orders">${orders.map(o=>`<article><div><b>${o.channel==='rubika'?'روبیکا':'اینستاگرام'}</b><span>${date(o.createdAt)}</span></div><strong>${price(o.totalAmount)} تومان</strong><small>وضعیت: ${safe(orderStatus(o.status))}</small></article>`).join('')}</div>`:'<div class="fox-account-empty"><i class="fa-regular fa-file-lines"></i><p>هنوز سابقه‌ای ثبت نشده.</p><span>هنگام ارسال فاکتور از حساب واردشده، سابقه درخواست سفارش اینجا ذخیره می‌شود.</span></div>'}</section>
      <section class="fox-account-panel"><div class="fox-panel-title"><div><span class="fox-eyebrow">امنیت</span><h2>اطلاعات و رمز حساب</h2></div></div><form id="fox-profile-form" class="fox-account-form"><label>نام نمایشی<input id="fox-display-name" maxlength="80" value="${safe(profile.displayName||'')}" required></label><div class="fox-profile-identifiers"><span><i class="fa-regular fa-envelope"></i>${safe(profile.email||'ایمیل ثبت نشده')}</span></div><button type="submit" class="fox-auth-primary">ذخیره نام <i class="fa-solid fa-check"></i></button></form><div class="fox-password-divider"></div><form id="fox-change-password" class="fox-account-form"><label>رمز فعلی<input type="password" id="fox-current-password" autocomplete="current-password" placeholder="برای تغییر رمز وارد کن"></label><label>رمز جدید<input type="password" id="fox-new-password" autocomplete="new-password" placeholder="حداقل ۸ کاراکتر"></label><button type="submit" class="fox-auth-secondary">تغییر رمز عبور <i class="fa-solid fa-key"></i></button></form></section></div><div id="fox-account-status" class="fox-account-status" aria-live="polite"></div></div>`;
    document.getElementById('fox-logout')?.addEventListener('click',logout);
    document.getElementById('fox-open-password')?.addEventListener('click',()=>document.getElementById('fox-new-password')?.focus());
    if(new URLSearchParams(location.search).get('setup')==='password' && document.getElementById('fox-new-password')) { setTimeout(()=>document.getElementById('fox-new-password')?.focus(),80); }
    document.getElementById('fox-profile-form')?.addEventListener('submit',updateProfile);
    document.getElementById('fox-change-password')?.addEventListener('submit',changePassword);
    root.querySelectorAll('[data-cart-remove]').forEach(btn=>btn.addEventListener('click',()=>removeAccountCart(btn.dataset.cartRemove,root)));
  }
  function orderStatus(value){ return value==='pending_contact'?'در انتظار هماهنگی': value==='completed'?'تکمیل‌شده': value==='cancelled'?'لغوشده':'در حال پیگیری'; }
  function accountStatus(message,type=''){ const el=document.getElementById('fox-account-status'); if(el){el.textContent=message||'';el.className=`fox-account-status ${type}`;} }
  async function updateProfile(e){ e.preventDefault(); const name=document.getElementById('fox-display-name')?.value.trim(); try{ await api('/account',{method:'PUT',body:JSON.stringify({displayName:name})}); accountStatus('نام نمایشی ذخیره شد.','success'); }catch(err){ accountStatus(err.message||'ذخیره ناموفق بود.','error'); } }
  async function changePassword(e){ e.preventDefault(); const current=document.getElementById('fox-current-password')?.value||''; const next=document.getElementById('fox-new-password')?.value||''; try{ await api('/auth/password',{method:'PUT',body:JSON.stringify({currentPassword:current,newPassword:next})}); localStorage.removeItem(NEEDS_PASSWORD_KEY); document.getElementById('fox-current-password').value=''; document.getElementById('fox-new-password').value=''; accountStatus('رمز عبور با موفقیت تغییر کرد.','success'); }catch(err){ accountStatus(err.message||'تغییر رمز ناموفق بود.','error'); } }
  async function removeAccountCart(id, root){ const items=localCart().filter(i=>String(i.id)!==String(id)); saveLocalCart(items); try{ await api('/account/cart',{method:'PUT',body:JSON.stringify({items})}); toast('کالا از سبد حساب حذف شد.','info'); renderAccount(); }catch(err){ toast(err.message||'ذخیره سبد ناموفق بود.','error'); } }
  async function logout(){ try{ await api('/auth/logout',{method:'POST',body:'{}'}); localStorage.removeItem(NEEDS_PASSWORD_KEY); location.href='index.html'; }catch(e){toast(e.message||'خروج ناموفق بود.','error');} }

  window.PetRaPetAccount = { refresh:renderAccount, isLoginPage:()=>Boolean(loginPage()) };
  document.addEventListener('DOMContentLoaded',()=>{ if(loginPage()){ authStep='identifier'; renderLogin(); } else if(accountPage()){ renderAccount(); } });
})();
