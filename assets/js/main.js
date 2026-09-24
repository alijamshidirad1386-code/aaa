/**
 * PetraPet Cat Boutique - Vanilla JavaScript Core
 * Cloudflare Pages Ready - No build step or npm required
 */

// Global Configuration
const INSTAGRAM_URL = "https://www.instagram.com/petra_petclinic?stkn=MTVmM2Q4ZGhqNjloMw==";
const SUPPORT_PHONE = "09960494973";

// Storage Keys
const LS_PRODUCTS = "foxshop_products_data";
const LS_CATEGORIES = "foxshop_categories_data";
const LS_CART = "foxshop_cart_data";
const LS_SETTINGS = "foxshop_settings_data";
const LS_ADMIN = "foxshop_admin_credentials";
const LS_ADMIN_USERNAME = "foxshop_admin_username";
const DEFAULT_ADMIN_USERNAME = "admin";
const RUBIKA_URL = "https://rubika.ir/petrapet";

// State
let products = [];
let categories = [];
let cart = [];
let settings = {
  shopName: "PetraPet",
  phone: "+98 996 049 4973",
  instagramUrl: INSTAGRAM_URL,
  aboutText: "پت‌شاپ PetraPet در تبریز با هدف ارائه مرغوب‌ترین و اصیل‌ترین خوراک و ملزومات گربه‌ها ایجاد شده است. ما اهمیت عشق و مراقبتی که نسبت به گربه‌تان دارید را درک می‌کنیم؛ از این رو محصولات را با اطلاعات قابل بررسی درباره برند، اصالت و انقضا عرضه می‌کنیم.",
  storeLocation: "تبریز، ایران",
  freeShippingThreshold: 3500000,
  shippingCost: 120000,
  shippingDispatchTime: "۱ تا ۲ روز کاری",
  returnPolicy: "شرایط مرجوعی طبق سیاست ثبت‌شده فروشگاه و با بررسی وضعیت کالا انجام می‌شود.",
  authenticityPolicy: "اطلاعات اصالت و مستندات هر محصول فقط در صورت ثبت و قابل ارائه بودن نمایش داده می‌شود."
};

let logoClickCount = 0;
let logoClickTimer = null;
let isAdminLoggedIn = false;
let adminUsername = DEFAULT_ADMIN_USERNAME;
let backendReady = false;
let lastRemoteStore = null;
let customerStories = [];
if (typeof window !== 'undefined') {
  window.__FOXSHOP_STORE_READY__ = false;
  window.__FOXSHOP_STORE_LOADING__ = true;
}

// Safe read-only bridges for additive storefront modules. Existing internal state remains the source of truth.
if (typeof window !== "undefined") {
  const expose = (name, getter) => {
    try { Object.defineProperty(window, name, { configurable: true, get: getter }); } catch (_) { /* legacy browser guard */ }
  };
  expose("products", () => products);
  expose("categories", () => categories);
  expose("cart", () => cart);
  expose("settings", () => settings);
  expose("customerStories", () => customerStories);
}

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", async () => {
  initPetraPetPageNavigationLoader();
  initMobileBottomNav();
  try { await initStorage(); } catch (err) { console.error("Init storage error:", err); }
  initHeader();
  initCartUI();
  initSecretAdminTrigger();
  createToastContainer();
  checkRemoteAdminSession();
  if (typeof initPage === "function") { initPage(); }
  if (new URLSearchParams(window.location.search).get("cart") === "1") {
    setTimeout(() => { if (document.getElementById("cart-drawer")) toggleCartDrawer(); }, 40);
  }
});

/**
 * Storage Initialization
 */
function normalizeCategories(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => item && typeof item === "object").map(item => ({
    id: String(item.id || "").trim(),
    name: String(item.name || "").trim(),
    slug: String(item.slug || item.name || "").trim(),
    image: typeof item.image === "string" ? item.image : "",
    icon: typeof item.icon === "string" && item.icon ? item.icon : "fa-paw",
    color: typeof item.color === "string" && item.color ? item.color : "from-orange-500 to-amber-500"
  })).filter(item => item.id && item.name);
}

function normalizeProducts(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => item && typeof item === "object").map(item => ({
    ...item,
    id: String(item.id || "").trim(),
    name: String(item.name || "").trim(),
    categoryId: String(item.categoryId || "").trim(),
    originalPrice: Number(item.originalPrice) || 0,
    finalPrice: Number(item.finalPrice) || 0,
    discountPercent: Number(item.discountPercent) || 0,
    stockStatus: item.stockStatus || "in_stock",
    image: typeof item.image === "string" ? item.image : "",
    shortDesc: typeof item.shortDesc === "string" ? item.shortDesc : "",
    fullDesc: typeof item.fullDesc === "string" ? item.fullDesc : "",
    isFeatured: Boolean(item.isFeatured),
    isBestSeller: Boolean(item.isBestSeller),
    isNew: Boolean(item.isNew)
  })).filter(item => item.id && item.name && item.categoryId);
}

function normalizeCart(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(item => item && typeof item === "object").map(item => ({
    id: String(item.id || "").trim(),
    name: String(item.name || "").trim(),
    price: Number(item.price) || 0,
    quantity: Math.max(1, Number(item.quantity) || 1),
    image: typeof item.image === "string" ? item.image : ""
  })).filter(item => item.id && item.name);
}

async function apiRequest(path, options = {}) {
  const { timeoutMs = 0, ...requestOptions } = options || {};
  const controller = timeoutMs > 0 && typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeoutId = null;
  if (controller) timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const fetchOptions = {
      credentials: "same-origin",
      ...requestOptions,
      headers: {
        ...(requestOptions.body instanceof FormData ? {} : { "content-type": "application/json" }),
        ...(requestOptions.headers || {})
      }
    };
    if (controller && !fetchOptions.signal) fetchOptions.signal = controller.signal;
    const response = await fetch(`/api${path}`, fetchOptions);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { ok: false, error: text || "پاسخ نامعتبر از سرور" }; }
    if (!response.ok || data?.ok === false) {
      const err = new Error(data?.error || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return data;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function applyRemoteStore(store) {
  if (!store || typeof store !== "object") return false;
  categories = normalizeCategories(store.categories || []);
  products = normalizeProducts(store.products || []);
  if (store.settings && typeof store.settings === "object") settings = { ...settings, ...store.settings };
  customerStories = Array.isArray(store.customerStories) ? store.customerStories : [];
  lastRemoteStore = { categories, products, settings: { ...settings }, customerStories };
  backendReady = true;
  if (typeof window !== 'undefined') {
    window.__FOXSHOP_STORE_READY__ = true;
    window.__FOXSHOP_STORE_LOADING__ = false;
    window.dispatchEvent(new CustomEvent('foxshop:store-ready'));
  }
  return true;
}

const FOXSHOP_STORE_CACHE_KEY = "foxshop_store_cache_v1";
const FOXSHOP_STORE_CACHE_TTL = 30000;

function readPetraPetStoreCache() {
  try {
    const raw = sessionStorage.getItem(FOXSHOP_STORE_CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : null;
    if (!cached || !cached.data || !cached.ts) return null;
    if (Date.now() - Number(cached.ts) > FOXSHOP_STORE_CACHE_TTL) return null;
    return cached.data;
  } catch (_) { return null; }
}

async function refreshRemoteStore() {
  const data = await apiRequest("/store", { timeoutMs: 6000 });
  applyRemoteStore(data);
  try { sessionStorage.setItem(FOXSHOP_STORE_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
  return data;
}

// Start the public catalog request as soon as this script is parsed. A recent
// session cache paints the catalog immediately, while a background request
// refreshes it without making page initialization wait for the network.
let foxShopEarlyStorePromise = null;
function getRemoteStoreOnce() {
  if (!foxShopEarlyStorePromise) {
    const cached = readPetraPetStoreCache();
    if (cached) {
      applyRemoteStore(cached);
      foxShopEarlyStorePromise = Promise.resolve(cached);
      Promise.resolve().then(() => refreshRemoteStore().catch(() => {}));
    } else {
      foxShopEarlyStorePromise = refreshRemoteStore();
    }
  }
  return foxShopEarlyStorePromise;
}

if (typeof window !== "undefined" && typeof fetch === "function") {
  try {
    const prime = getRemoteStoreOnce();
    // Prevent an early network rejection from becoming an unhandled-promise event;
    // initStorage() will still observe the same promise and apply the normal fallback.
    if (prime && typeof prime.catch === "function") prime.catch(() => {});
  } catch (_) {}
}

async function checkRemoteAdminSession() {
  try {
    const data = await apiRequest("/admin/me", { method: "GET" });
    if (data.authenticated) {
      isAdminLoggedIn = true;
      adminUsername = data.username || DEFAULT_ADMIN_USERNAME;
      applyRemoteStore(data.store);
    }
  } catch (_) {
    // Not logged in or backend is unavailable; public catalog fallback remains active.
  }
}

async function initStorage() {
  // Public catalog comes from Cloudflare D1 when the API is configured.
  try {
    await getRemoteStoreOnce();
  } catch (remoteErr) {
    backendReady = false;
    console.warn("Remote store unavailable; using built-in catalog fallback:", remoteErr);
    try {
      const savedCats = localStorage.getItem(LS_CATEGORIES);
      const defaultCats = (typeof DEFAULT_CATEGORIES !== "undefined") ? [...DEFAULT_CATEGORIES] : [];
      categories = normalizeCategories(savedCats ? JSON.parse(savedCats) : null);
      if (!categories.length) categories = normalizeCategories(defaultCats);

      const savedProds = localStorage.getItem(LS_PRODUCTS);
      const defaultProds = (typeof DEFAULT_PRODUCTS !== "undefined") ? [...DEFAULT_PRODUCTS] : [];
      products = normalizeProducts(savedProds ? JSON.parse(savedProds) : null);
      if (!products.length) products = normalizeProducts(defaultProds);

      const savedSettings = localStorage.getItem(LS_SETTINGS);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        if (parsedSettings && typeof parsedSettings === "object" && !Array.isArray(parsedSettings)) settings = { ...settings, ...parsedSettings };
      }
      customerStories = [];
    } catch (err) {
      console.error("Local fallback load error:", err);
      categories = normalizeCategories(typeof DEFAULT_CATEGORIES !== "undefined" ? DEFAULT_CATEGORIES : []);
      products = normalizeProducts(typeof DEFAULT_PRODUCTS !== "undefined" ? DEFAULT_PRODUCTS : []);
    }
  }

  try {
    const savedCart = localStorage.getItem(LS_CART);
    cart = normalizeCart(savedCart ? JSON.parse(savedCart) : []);
  } catch { cart = []; }
  if (!backendReady && typeof window !== 'undefined') {
    window.__FOXSHOP_STORE_READY__ = true;
    window.__FOXSHOP_STORE_LOADING__ = false;
    window.dispatchEvent(new CustomEvent('foxshop:store-ready'));
  }
}

function saveCart() {
  safeSaveStorage(LS_CART, cart);
  updateCartBadge();
  renderCartDrawer();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('foxshop:cart-changed', { detail: { items: cart } }));
}

/**
 * Toast Notifications
 */
function createToastContainer() {
  if (!document.getElementById("toast-container")) {
    const container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
}

function showToast(message, type = "success") {
  createToastContainer();
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "fa-circle-check text-emerald-400";
  if (type === "info") icon = "fa-circle-info text-amber-400";

  toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i><span>${message}</span>`;
  container.appendChild(toast);

  // Trigger anim
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/**
 * Persian Number Formatter
 */
function formatPrice(num) {
  if (num === undefined || num === null) return "۰";
  return Number(num).toLocaleString("fa-IR");
}

function toPersianDigits(str) {
  const persian = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str).replace(/[0-9]/g, w => persian[+w]);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function(m) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m];
  });
}

/*
 * PetraPet page navigation loader. Replaces decorative navigation flashes with
 * one clean full-screen loader and works on every page using this shared file.
 */
const FOXSHOP_LOGO_URL = "https://lh3.googleusercontent.com/aida-public/AB6AXuCA9wPsl74QezScl6MSgkI2o0xUTzfcjGUtFbzxomrJAIf6RXTyJ4Vt37NbG-HSROy0k7OY1w1g0FQycVmExxDWxx-pTo4BozV8Rt7OnTeb8vvsIBis0RxQIaeFqPPYcMaOM7KMCmth-w7A9l_TAW9Z_nmWueMMYj89L-312K11CIz-TgjjEO9hEsd41UPsCivtswJi7O-hpFxHWGJl4xZHf5w5R50arV9ZPUhMFzPJlfyNtICfR0IBS6hMALr65T-hxkA";
const FOXSHOP_NAV_LOADER_KEY = "foxshop_nav_loader_v1";
let foxShopPageLoader = null;
let foxShopPageLoaderTimer = null;

function ensurePetraPetPageLoader() {
  if (foxShopPageLoader && foxShopPageLoader.isConnected) return foxShopPageLoader;
  const existing = document.getElementById("fox-global-page-loader");
  if (existing) {
    foxShopPageLoader = existing;
    return existing;
  }
  if (!document.body) return null;
  const loader = document.createElement("div");
  loader.id = "fox-global-page-loader";
  loader.setAttribute("aria-live", "polite");
  loader.setAttribute("aria-busy", "true");
  loader.innerHTML = `
    <div class="fox-global-loader-card" role="status">
      <div class="fox-global-loader-logo"><img src="${FOXSHOP_LOGO_URL}" alt="PetraPet" decoding="async"></div>
      <div class="fox-global-loader-spinner" aria-hidden="true"></div>
      <div class="fox-global-loader-title">در حال بارگیری</div>
      <div class="fox-global-loader-subtitle">لطفاً چند لحظه صبر کنید…</div>
    </div>
  `;
  document.body.appendChild(loader);
  foxShopPageLoader = loader;
  return loader;
}

function showPetraPetPageLoader() {
  const loader = ensurePetraPetPageLoader();
  if (!loader) return;
  if (foxShopPageLoaderTimer) clearTimeout(foxShopPageLoaderTimer);
  loader.classList.remove("is-hiding");
  loader.classList.add("is-visible");
  loader.setAttribute("aria-busy", "true");
  document.documentElement.classList.add("fox-page-loading");
}

function hidePetraPetPageLoader(delay = 120) {
  const loader = ensurePetraPetPageLoader();
  if (!loader) return;
  if (foxShopPageLoaderTimer) clearTimeout(foxShopPageLoaderTimer);
  foxShopPageLoaderTimer = setTimeout(() => {
    loader.classList.add("is-hiding");
    loader.setAttribute("aria-busy", "false");
    document.documentElement.classList.remove("fox-page-loading");
    setTimeout(() => {
      if (foxShopPageLoader && foxShopPageLoader.classList.contains("is-hiding")) {
        foxShopPageLoader.classList.remove("is-visible", "is-hiding");
      }
    }, 220);
  }, Math.max(0, Number(delay) || 0));
}

function isPetraPetInternalNavigationLink(anchor, event) {
  if (!anchor || !anchor.href) return false;
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.dataset.noPageLoader === "1") return false;
  const rawHref = anchor.getAttribute("href") || "";
  if (!rawHref || rawHref.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(rawHref)) return false;
  let url;
  try { url = new URL(anchor.href, window.location.href); } catch (_) { return false; }
  if (url.origin !== window.location.origin || url.protocol !== window.location.protocol) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
  return true;
}

function initPetraPetPageNavigationLoader() {
  const loader = ensurePetraPetPageLoader();
  if (!loader || loader.dataset.bound === "1") return;
  loader.dataset.bound = "1";
  let navigating = false;
  let loadStartedAt = 0;
  try {
    const pending = sessionStorage.getItem(FOXSHOP_NAV_LOADER_KEY) === "1";
    sessionStorage.removeItem(FOXSHOP_NAV_LOADER_KEY);
    if (pending) {
      showPetraPetPageLoader();
      loadStartedAt = Date.now();
      const reveal = () => hidePetraPetPageLoader(Math.max(120, 360 - (Date.now() - loadStartedAt)));
      if (document.readyState === "complete") reveal();
      else window.addEventListener("load", reveal, { once: true });
      setTimeout(reveal, 5200);
    } else {
      hidePetraPetPageLoader(0);
    }
  } catch (_) {
    hidePetraPetPageLoader(0);
  }

  document.addEventListener("click", (event) => {
    if (navigating) return;
    const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!isPetraPetInternalNavigationLink(anchor, event)) return;
    const url = new URL(anchor.href, window.location.href);
    navigating = true;
    try { sessionStorage.setItem(FOXSHOP_NAV_LOADER_KEY, "1"); } catch (_) {}
    const mobileMenu = document.getElementById("mobile-menu");
    if (mobileMenu) mobileMenu.classList.add("hidden");
    const cartDrawer = document.getElementById("cart-drawer");
    if (cartDrawer) cartDrawer.classList.add("hidden");
    showPetraPetPageLoader();
    event.preventDefault();
    setTimeout(() => { window.location.assign(url.href); }, 45);
  }, true);

  window.addEventListener("pageshow", () => {
    navigating = false;
    try { sessionStorage.removeItem(FOXSHOP_NAV_LOADER_KEY); } catch (_) {}
    hidePetraPetPageLoader(80);
  });
}

/**
 * Header & Mobile Navigation
 */
function initHeader() {
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const closeBtn = document.getElementById("close-mobile-menu");

  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener("click", () => mobileMenu.classList.remove("hidden"));
  }
  if (closeBtn && mobileMenu) {
    closeBtn.addEventListener("click", () => mobileMenu.classList.add("hidden"));
  }

  // Populate categories dropdown if exists
  const dropdown = document.getElementById("header-categories-dropdown");
  if (dropdown) {
    if (categories.length === 0) {
      dropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center font-normal">دسته‌بندی ثبت نشده است</div>`;
    } else {
      dropdown.innerHTML = categories.map(cat => `
        <a href="products.html?category=${cat.id}" class="flex items-center justify-between p-2.5 rounded-xl hover:bg-orange-50 text-slate-700 text-xs font-semibold transition">
          <span class="flex items-center gap-2">
            <i class="fa-solid fa-paw text-orange-500 text-[10px]"></i>
            <span>${escapeHtml(cat.name)}</span>
          </span>
          <span class="text-[10px] text-slate-400 font-normal">${products.filter(p => p.categoryId === cat.id).length} کالا</span>
        </a>
      `).join("");
    }
  }

  // Global Search Box
  const globalSearchInput = document.getElementById("global-search-input");
  if (globalSearchInput) {
    globalSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const query = globalSearchInput.value.trim();
        window.location.href = `products.html?search=${encodeURIComponent(query)}`;
      }
    });
  }

  updateCartBadge();
}

/**
 * Cart Functionality
 */
function syncMobileBottomNavWithCart() {
  const drawer = document.getElementById("cart-drawer");
  const nav = document.getElementById("fox-mobile-bottom-nav");
  if (!drawer || !nav) return;
  nav.classList.toggle("is-cart-open", !drawer.classList.contains("hidden"));
}

function setCartDrawerOpen(open) {
  const drawer = document.getElementById("cart-drawer");
  if (!drawer) return;
  if (open) {
    renderCartDrawer();
    drawer.classList.remove("hidden");
  } else {
    drawer.classList.add("hidden");
  }
  syncMobileBottomNavWithCart();
}

function initCartUI() {
  const cartTrigger = document.getElementById("cart-trigger-btn");
  const cartDrawer = document.getElementById("cart-drawer");
  const closeCartBtn = document.getElementById("close-cart-btn");

  if (cartTrigger && cartDrawer && !cartTrigger.dataset.foxCartBound) {
    cartTrigger.dataset.foxCartBound = "1";
    cartTrigger.addEventListener("click", () => setCartDrawerOpen(true));
  }

  if (closeCartBtn && cartDrawer && !closeCartBtn.dataset.foxCartBound) {
    closeCartBtn.dataset.foxCartBound = "1";
    closeCartBtn.addEventListener("click", () => setCartDrawerOpen(false));
  }

  // Close when clicking outside overlay
  if (cartDrawer && !cartDrawer.dataset.foxCartOverlayBound) {
    cartDrawer.dataset.foxCartOverlayBound = "1";
    cartDrawer.addEventListener("click", (e) => {
      if (e.target === cartDrawer) setCartDrawerOpen(false);
    });
  }

  syncMobileBottomNavWithCart();
}

function addToCart(productId, quantity = 1) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      id: prod.id,
      name: prod.name,
      price: prod.finalPrice,
      image: prod.image,
      quantity: quantity
    });
  }

  saveCart();
  showToast(`«${prod.name}» به سبد خرید اضافه شد 🐾`, "success");
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  showToast("کالا از سبد خرید حذف شد", "info");
}

function updateCartQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    removeFromCart(productId);
  } else {
    saveCart();
  }
}

function updateCartBadge() {
  const badges = document.querySelectorAll(".cart-count-badge");
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  badges.forEach(b => {
    b.textContent = toPersianDigits(totalItems);
    if (totalItems > 0) {
      b.classList.remove("hidden");
    } else {
      b.classList.add("hidden");
    }
  });
  document.querySelectorAll("[data-mobile-cart-count]").forEach(b => {
    b.textContent = toPersianDigits(totalItems);
    b.classList.toggle("is-empty", totalItems === 0);
  });
}

function calculateCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function renderCartDrawer() {
  const container = document.getElementById("cart-items-container");
  const emptyView = document.getElementById("cart-empty-view");
  const footerView = document.getElementById("cart-footer-view");
  const totalAmountEl = document.getElementById("cart-total-amount");

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = "";
    if (emptyView) emptyView.classList.remove("hidden");
    if (footerView) footerView.classList.add("hidden");
    return;
  }

  if (emptyView) emptyView.classList.add("hidden");
  if (footerView) footerView.classList.remove("hidden");

  container.innerHTML = cart.map(item => `
    <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
      <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" class="w-14 h-14 object-contain rounded-xl bg-white p-1 border border-slate-200">
      <div class="flex-1 min-w-0">
        <h4 class="font-bold text-xs text-slate-800 line-clamp-1">${escapeHtml(item.name)}</h4>
        <p class="text-xs font-black text-orange-600 mt-1">${formatPrice(item.price)} <span class="text-[10px] font-normal text-slate-500">تومان</span></p>
      </div>
      <div class="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
        <button onclick="updateCartQuantity('${item.id}', 1)" class="w-6 h-6 rounded-lg text-slate-600 hover:bg-orange-50 hover:text-orange-600 font-bold text-xs flex items-center justify-center">+</button>
        <span class="w-6 text-center text-xs font-black text-slate-800">${toPersianDigits(item.quantity)}</span>
        <button onclick="updateCartQuantity('${item.id}', -1)" class="w-6 h-6 rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 font-bold text-xs flex items-center justify-center">-</button>
      </div>
      <button onclick="removeFromCart('${item.id}')" class="text-slate-400 hover:text-rose-500 p-1.5" title="حذف">
        <i class="fa-solid fa-trash-can text-xs"></i>
      </button>
    </div>
  `).join("");

  if (totalAmountEl) {
    totalAmountEl.textContent = formatPrice(calculateCartTotal());
  }
}

/**
 * Product card navigation.
 * Product cards now go directly to the real product page; no secondary splash/overlay is shown.
 */
function openProductDetailModalWithSplash(productId) {
  const key = String(productId ?? "").trim();
  if (!key) return;
  window.location.assign(`product.html?id=${encodeURIComponent(key)}`);
}

function openProductDetailModal(productId, skipSplash = false) {
  if (!skipSplash) {
    openProductDetailModalWithSplash(productId);
    return;
  }

  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  const modal = document.getElementById("product-detail-modal");
  if (!modal) return;

  const catObj = categories.find(c => c.id === prod.categoryId);
  const catName = catObj ? catObj.name : "عمومی";

  document.getElementById("detail-modal-product-id").value = prod.id;
  document.getElementById("detail-modal-img").src = prod.image;
  document.getElementById("detail-modal-title").textContent = prod.name;
  document.getElementById("detail-modal-category").textContent = catName;
  document.getElementById("detail-modal-short").textContent = prod.shortDesc || "";
  document.getElementById("detail-modal-full").textContent = prod.fullDesc || "";
  
  document.getElementById("detail-modal-price").textContent = formatPrice(prod.finalPrice);
  
  const origPriceEl = document.getElementById("detail-modal-orig-price");
  if (origPriceEl) {
    if (prod.discountPercent > 0) {
      origPriceEl.textContent = formatPrice(prod.originalPrice) + " تومان";
      origPriceEl.classList.remove("hidden");
    } else {
      origPriceEl.classList.add("hidden");
    }
  }

  // Stock status badge
  const stockEl = document.getElementById("detail-modal-stock");
  if (stockEl) {
    if (prod.stockStatus === "out_of_stock") {
      stockEl.className = "bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full";
      stockEl.textContent = "ناموجود";
    } else if (prod.stockStatus === "low_stock") {
      stockEl.className = "bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full";
      stockEl.textContent = "تعداد محدود در انبار";
    } else {
      stockEl.className = "bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full";
      stockEl.textContent = "موجود و آماده ارسال";
    }
  }

  modal.classList.remove("hidden");
}

function closeProductDetailModal() {
  const modal = document.getElementById("product-detail-modal");
  if (modal) modal.classList.add("hidden");
}

/**
 * Direct Instagram Product Order / Inquiries
 */
function openInstagramProduct(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  const msg = `🐾 سلام و وقت بخیر از سایت PetraPet\nاستعلام موجودی و سفارش کالا:\n📦 نام کالا: ${prod.name}\n💰 قیمت: ${formatPrice(prod.finalPrice)} تومان`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).catch(() => {});
  }

  showToast("اطلاعات کالا کپی شد! در حال انتقال به اینستاگرام...", "instagram");
  setTimeout(() => {
    window.open(INSTAGRAM_URL, "_blank");
  }, 400);
}

/**
 * Secret 5-Clicks on Brand Logo -> Opens In-Browser Admin Management
 * Prevents default navigation so tapping never reloads or returns to home page!
 */
function initSecretAdminTrigger() {
  const triggers = document.querySelectorAll(".brand-logo-trigger");
  const badge = document.getElementById("tap-badge");

  triggers.forEach(trigger => {
    trigger.addEventListener("click", (e) => {
      // Prevent standard link navigation so tapping does not reload or leave the page
      if (e) e.preventDefault();

      logoClickCount++;
      trigger.classList.remove("logo-tap");
      void trigger.offsetWidth;
      trigger.classList.add("logo-tap");

      if (badge) {
        badge.textContent = `${logoClickCount}/5`;
        badge.classList.remove("opacity-0");
      }

      clearTimeout(logoClickTimer);
      logoClickTimer = setTimeout(() => {
        // If clicked only once and on another page, user intended to go home
        if (logoClickCount === 1) {
          const isHome = window.location.pathname.endsWith("index.html") || 
                         window.location.pathname === "/" || 
                         window.location.pathname === "" ||
                         window.location.pathname.endsWith("/");
          if (!isHome) {
            window.location.href = "index.html";
          }
        }
        logoClickCount = 0;
        if (badge) badge.classList.add("opacity-0");
      }, 700);

      if (logoClickCount >= 5) {
        logoClickCount = 0;
        clearTimeout(logoClickTimer);
        if (badge) badge.classList.add("opacity-0");
        openAdminModal();
      }
    });
  });
}

/**
 * Robust Client-Side Storage & Image Compression Engine
 * Guarantees zero QuotaExceededError crashes and ultrafast loading
 */
function safeSaveStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Storage save error:", err);
    showToast("حافظه مرورگر پر شده است. لطفاً از تصویر با حجم کمتر استفاده نمایید.", "error");
    return false;
  }
}

/**
 * High-performance Canvas Image Compressor
 * Converts any camera/gallery photo into a lightweight, crisp WebP/JPEG (approx 15-35KB)
 */
function compressImage(file, maxWidth = 360, maxHeight = 360, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("هیچ فایلی انتخاب نشده است"));
    
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("فرمت فایل تصویری معتبر نیست"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL("image/webp", quality);
        if (!dataUrl || dataUrl.indexOf("data:image/webp") !== 0) {
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function getLockoutRemainingSeconds() {
  return 0;
}

let activeAdminTab = "products";

/**
 * Compatibility handlers kept for the existing HTML templates.
 * They delegate to the current modal/order implementations without reloading the page.
 */
async function copyTextToClipboard(text) {
  if (!text) return false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // Fall through to the legacy copy path for mobile browsers / permission edge cases.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } catch (err) { console.warn("Clipboard copy failed:", err); }
  textarea.remove();
  return copied;
}

function openMobileBottomCart() {
  const drawer = document.getElementById("cart-drawer");
  if (drawer) {
    toggleCartDrawer();
    return;
  }
  window.location.href = "products.html?cart=1";
}

function initMobileBottomNav() {
  if (document.getElementById("fox-mobile-bottom-nav")) return;
  const path = window.location.pathname || "";
  const nav = document.createElement("nav");
  nav.id = "fox-mobile-bottom-nav";
  nav.className = "fox-mobile-bottom-nav";
  nav.setAttribute("aria-label", "دسترسی سریع فروشگاه");

  const isHome = /(^|\/)index\.html$/.test(path) || path === "/" || path === "";
  const isProducts = /(^|\/)products\.html$/.test(path) || /(^|\/)product\.html$/.test(path) || /(^|\/)product\//.test(path);
  const isInfo = /(^|\/)(about|contact)\.html$/.test(path);

  nav.innerHTML = `
    <a href="index.html" class="fox-bottom-nav-item ${isHome ? "is-active" : ""}" ${isHome ? 'aria-current="page"' : ""}>
      <span class="fox-bottom-nav-icon"><i class="fa-solid fa-house"></i></span><b>خانه</b>
    </a>
    <a href="products.html#category-pills-container" class="fox-bottom-nav-item ${isProducts ? "is-active" : ""}" ${isProducts ? 'aria-current="page"' : ""}>
      <span class="fox-bottom-nav-icon"><i class="fa-solid fa-layer-group"></i></span><b>دسته‌بندی</b>
    </a>
    <button type="button" class="fox-bottom-nav-item" onclick="openMobileBottomCart()" aria-label="باز کردن سبد خرید">
      <span class="fox-bottom-nav-icon fox-bottom-nav-cart"><i class="fa-solid fa-cart-shopping"></i><em data-mobile-cart-count>۰</em></span><b>سبد خرید</b>
    </button>
    <a href="contact.html" class="fox-bottom-nav-item ${isInfo ? "is-active" : ""}" ${isInfo ? 'aria-current="page"' : ""}>
      <span class="fox-bottom-nav-icon"><i class="fa-solid fa-headset"></i></span><b>درباره ما و پشتیبانی</b>
    </a>`;

  document.body.appendChild(nav);
  updateCartBadge();
}

function toggleMobileMenu() {
  const mobileMenu = document.getElementById("mobile-menu");
  if (!mobileMenu) return;
  mobileMenu.classList.toggle("hidden");
}

function toggleCartDrawer() {
  const drawer = document.getElementById("cart-drawer");
  if (!drawer) return;
  setCartDrawerOpen(drawer.classList.contains("hidden"));
}

function openAdminPortalModal() {
  openAdminModal();
}

function closeAdminPortalModal() {
  closeAdminModal();
}

function setAdminTab(tab) {
  adminSwitchTab(tab);
}

function openRubikaOrderModal(prefilledProductId = null) {
  let targetItems = [];

  if (prefilledProductId) {
    const prod = products.find(p => p.id === prefilledProductId);
    if (prod) {
      targetItems = [{ name: prod.name, price: prod.finalPrice, quantity: 1 }];
    }
  } else {
    targetItems = [...cart];
  }

  if (targetItems.length === 0) {
    showToast("لطفاً ابتدا کالایی را انتخاب کنید یا به سبد خرید اضافه کنید.", "info");
    return;
  }

  const modal = document.getElementById("rubika-order-modal");
  const list = document.getElementById("rb-order-items-list");
  const total = document.getElementById("rb-order-total-amount");

  if (list) {
    list.innerHTML = targetItems.map(item => `
      <div class="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
        <span class="font-medium text-slate-800 truncate max-w-[200px]">${escapeHtml(item.name)}</span>
        <span class="text-slate-500 font-bold">${toPersianDigits(item.quantity)} عدد × ${formatPrice(item.price)}</span>
      </div>
    `).join("");
  }

  if (total) {
    total.textContent = formatPrice(
      targetItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0)
    ) + " تومان";
  }

  if (modal) modal.classList.remove("hidden");
}

function closeRubikaOrderModal() {
  const modal = document.getElementById("rubika-order-modal");
  if (modal) modal.classList.add("hidden");
}

function buildOrderMessageFromForm() {
  const name = document.getElementById("rb-customer-name")?.value.trim() || "همراه عزیز";
  const phone = document.getElementById("rb-customer-phone")?.value.trim() || "";
  const address = document.getElementById("rb-customer-address")?.value.trim() || "هماهنگی در چت";
  const notes = document.getElementById("rb-customer-notes")?.value.trim() || "-";

  let itemsSummary = "";
  let totalPrice = 0;

  if (cart.length > 0) {
    cart.forEach(item => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      itemsSummary += `• ${item.name} (${toPersianDigits(quantity)} عدد) - ${formatPrice(price * quantity)} تومان\n`;
      totalPrice += price * quantity;
    });
  } else {
    const activeDetailId = document.getElementById("detail-modal-product-id")?.value;
    const prod = products.find(p => p.id === activeDetailId);
    if (prod) {
      itemsSummary = `• ${prod.name} (۱ عدد) - ${formatPrice(prod.finalPrice)} تومان\n`;
      totalPrice = Number(prod.finalPrice) || 0;
    }
  }

  return `🐾 سفارش جدید از سایت PetraPet 🐾\n\n` +
    `👤 نام مشتری: ${name}\n` +
    `📞 شماره تماس: ${phone}\n` +
    `📍 آدرس تحویل: ${address}\n\n` +
    `📦 اقلام سفارش:\n${itemsSummary}\n` +
    `💰 مبلغ کل: ${formatPrice(totalPrice)} تومان\n` +
    `📝 توضیحات: ${notes}\n\n` +
    `با تشکر از پت‌شاپ تخصصی گربه‌ها PetraPet`;
}

function submitRubikaOrder(event) {
  if (event?.preventDefault) event.preventDefault();
  const message = buildOrderMessageFromForm();
  copyTextToClipboard(message);
  showToast("متن سفارش کپی شد! در حال باز کردن روبیکا @petrapet...", "rubika");
  setTimeout(() => window.open(RUBIKA_URL, "_blank", "noopener,noreferrer"), 600);
}

function submitInstagramOrder() {
  const message = buildOrderMessageFromForm();
  copyTextToClipboard(message);
  showToast("متن سفارش کپی شد! در حال انتقال به دایرکت اینستاگرام...", "instagram");
  setTimeout(() => window.open(INSTAGRAM_URL, "_blank", "noopener,noreferrer"), 600);
}

function openAdminModal() {
  let modal = document.getElementById("admin-portal-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "admin-portal-modal";
    modal.className = "fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm hidden flex items-center justify-center p-2 sm:p-5";
    document.body.appendChild(modal);
  }

  try {
    renderAdminPortal();
  } catch (err) {
    console.error("renderAdminPortal error:", err);
  }
  modal.classList.remove("hidden");
}

function closeAdminModal() {
  const modal = document.getElementById("admin-portal-modal");
  if (modal) modal.classList.add("hidden");
}

function adminSwitchTab(tab) {
  activeAdminTab = tab;
  renderAdminPortal();
}

function renderAdminPortal() {
  const modal = document.getElementById("admin-portal-modal");
  if (!modal) return;

  const remainingLockout = getLockoutRemainingSeconds();

  if (!isAdminLoggedIn) {
    // Render Auth Screen with Brute Force Protection
    modal.innerHTML = `
      <div class="glass-card fox-admin-theme fox-admin-login bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-orange-200 relative animate-float">
        <button onclick="closeAdminModal()" class="absolute top-4 left-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-400 rounded-2xl mx-auto flex items-center justify-center text-white shadow-lg shadow-orange-500/30 mb-3">
            <i class="fa-solid fa-shield-halved text-2xl"></i>
          </div>
          <h3 class="text-lg font-black text-slate-800">ورود به مدیریت PetraPet</h3>
          <p class="text-xs text-slate-500 mt-1">سامانه امن مدیریت اختصاصی پت‌شاپ گربه‌ها</p>
        </div>

        ${remainingLockout > 0 ? `
          <div class="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
            <i class="fa-solid fa-triangle-exclamation text-base"></i>
            <div>
              <p class="font-bold">حساب موقتاً قفل شده است</p>
              <p class="text-[11px]">به دلیل تلاش‌های ناموفق، لطفاً <span id="lockout-timer" class="font-bold text-rose-900">${toPersianDigits(remainingLockout)}</span> ثانیه صبر کنید.</p>
            </div>
          </div>
        ` : ""}

        <form onsubmit="handleAdminLogin(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">نام کاربری مدیریت:</label>
            <input type="text" id="admin-username-input" required autocomplete="username" ${remainingLockout > 0 ? "disabled" : ""}
              value="${escapeHtml(adminUsername || DEFAULT_ADMIN_USERNAME)}"
              placeholder="نام کاربری را وارد نمایید..."
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-xs font-mono transition bg-slate-50 disabled:bg-slate-100">
            <p class="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
              <i class="fa-solid fa-user-shield text-orange-400"></i>
              <span>ورود فقط با اطلاعات مدیر ذخیره‌شده در Cloudflare D1 انجام می‌شود.</span>
            </p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5">رمز عبور مدیریت:</label>
            <input type="password" id="admin-password-input" required ${remainingLockout > 0 ? "disabled" : ""}
              placeholder="رمز عبور را وارد نمایید..."
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none text-xs font-mono transition bg-slate-50 disabled:bg-slate-100">
            <p class="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
              <i class="fa-solid fa-key text-orange-400"></i>
              <span>رمز عبور را در پنل مدیریت یا D1 به‌صورت امن نگهداری و تغییر دهید.</span>
            </p>
          </div>

          <button type="submit" ${remainingLockout > 0 ? "disabled" : ""}
            class="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-600/25 transition flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed">
            <i class="fa-solid fa-lock-open"></i>
            <span>ورود امن به داشبورد</span>
          </button>
        </form>

        <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span class="flex items-center gap-1"><i class="fa-solid fa-shield-check text-emerald-500"></i> محافظت ضد Brute-force</span>
          <span>نسخه پایدار v2.4</span>
        </div>
      </div>
    `;
    return;
  }

  // Render Logged-in Dashboard
  modal.innerHTML = `
    <div class="glass-card fox-admin-theme fox-admin-dashboard bg-white rounded-3xl p-4 sm:p-6 max-w-4xl w-full shadow-2xl border border-orange-200 relative max-h-[92vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/20">
            <i class="fa-solid fa-paw text-lg"></i>
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
              <span>پنل مدیریت پیشرفته PetraPet</span>
              <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">احراز هویت شده</span>
            </h3>
            <p class="text-[11px] text-slate-400">مدیریت آنی محصولات و دسته‌بندی‌ها با Cloudflare D1 و تصاویر ذخیره‌شده در دیتابیس آنلاین</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="adminLogout()" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-xs font-bold transition flex items-center gap-1.5">
            <i class="fa-solid fa-right-from-bracket"></i>
            <span class="hidden sm:inline">خروج</span>
          </button>
          <button onclick="closeAdminModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 pt-3 pb-2 border-b border-slate-100 shrink-0 overflow-x-auto">
        <button onclick="adminSwitchTab('products')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${activeAdminTab === 'products' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          <i class="fa-solid fa-boxes-stacked"></i>
          <span>محصولات (${toPersianDigits(products.length)})</span>
        </button>
        <button onclick="adminSwitchTab('categories')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${activeAdminTab === 'categories' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          <i class="fa-solid fa-layer-group"></i>
          <span>دسته‌بندی‌ها با تصویر WebP (${toPersianDigits(categories.length)})</span>
        </button>
        <button onclick="adminSwitchTab('content')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${activeAdminTab === 'content' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          <i class="fa-solid fa-comments"></i>
          <span>نظرات کاربران</span>
        </button>
        <button onclick="adminSwitchTab('security')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${activeAdminTab === 'security' ? 'bg-orange-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          <i class="fa-solid fa-shield-halved"></i>
          <span>امنیت و پشتیبان‌گیری</span>
        </button>
      </div>

      <!-- Tab Content (Scrollable) -->
      <div class="overflow-y-auto custom-scroll flex-1 py-4">
        ${renderAdminTabContent()}
      </div>
    </div>
  `;
  if (activeAdminTab === 'content') queueMicrotask(loadAdminPendingReviews);
}

function renderAdminTabContent() {
  if (activeAdminTab === 'content') return renderAdminCustomerContent();
  if (activeAdminTab === "products") {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- New Product Form -->
        <div class="lg:col-span-5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <h4 class="font-bold text-xs text-slate-800 mb-3 flex items-center gap-2">
            <i class="fa-solid fa-plus text-orange-600"></i>
            <span>افزودن محصول جدید</span>
          </h4>
          <form onsubmit="handleAdminAddProduct(event)" class="space-y-3">
            <div>
              <label class="block text-[11px] font-bold text-slate-600 mb-1">نام محصول:</label>
              <input type="text" id="admin-new-name" required placeholder="مثال: غذای خشک گربه رویال کنین 4kg"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">دسته‌بندی:</label>
                <select id="admin-new-cat" class="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none">
                  ${categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">قیمت (تومان):</label>
                <input type="number" id="admin-new-price" required placeholder="1250000"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">درصد تخفیف (%):</label>
                <input type="number" id="admin-new-discount" value="0" min="0" max="90"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">وضعیت انبار:</label>
                <select id="admin-new-stock" class="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none">
                  <option value="in_stock">موجود در انبار</option>
                  <option value="low_stock">موجودی محدود</option>
                  <option value="out_of_stock">ناموجود</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-600 mb-1">آدرس عکس یا فایل تصویر:</label>
              <input type="text" id="admin-new-img" inputmode="url" placeholder="https://... یا عکس ذخیره‌شده در سایت"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500 mb-1.5">
              <input type="file" id="admin-product-file" accept="image/webp,image/png,image/jpeg"
                onchange="handleAdminFileToInput('admin-product-file', 'admin-new-img', 'admin-prod-preview')"
                class="block w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer">
              <input type="hidden" id="admin-new-img-key" value="">
              <div id="admin-prod-preview" class="hidden mt-2 p-1.5 bg-white rounded-xl border border-slate-200 flex items-center gap-2">
                <img id="admin-prod-preview-img" class="w-10 h-10 object-contain rounded-lg">
                <span class="text-[10px] text-slate-500">پیش‌نمایش تصویر انتخابی</span>
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-600 mb-1">توضیحات مختصر:</label>
              <textarea id="admin-new-desc" rows="2" placeholder="توضیحات کوتاه برای مشخصات محصول..."
                class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500"></textarea>
            </div>

            <details class="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
              <summary class="cursor-pointer text-[11px] font-black text-orange-700">مشخصات تکمیلی محصول (اختیاری)</summary>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <input id="admin-new-brand" placeholder="برند" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <input id="admin-new-weight" placeholder="وزن / حجم" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <input id="admin-new-flavor" placeholder="طعم و تنوع" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <input id="admin-new-age" placeholder="سن مناسب" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <input id="admin-new-goals" placeholder="هدف مصرف: عقیم، حساس، ادراری، مو بلند..." class="px-3 py-2 rounded-xl border bg-white text-xs sm:col-span-2">
                <input id="admin-new-country" placeholder="کشور سازنده" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <input id="admin-new-barcode" placeholder="بارکد" class="px-3 py-2 rounded-xl border bg-white text-xs" dir="ltr">
                <input id="admin-new-expiry" placeholder="تاریخ انقضا" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <input id="admin-new-stock-qty" type="number" min="0" placeholder="تعداد واقعی انبار" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <input id="admin-new-min-stock" type="number" min="0" placeholder="حداقل موجودی" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <input id="admin-new-restock" placeholder="زمان تأمین مجدد" class="px-3 py-2 rounded-xl border bg-white text-xs">
                <label class="flex items-center gap-2 text-[11px] font-bold"><input id="admin-new-consumable" type="checkbox"> محصول مصرفی / مناسب خرید مجدد</label>
                <textarea id="admin-new-ingredients" rows="2" placeholder="ترکیبات" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs"></textarea>
                <textarea id="admin-new-nutrition" rows="2" placeholder="آنالیز تغذیه‌ای" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs"></textarea>
                <textarea id="admin-new-usage" rows="2" placeholder="روش مصرف" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs"></textarea>
                <textarea id="admin-new-storage" rows="2" placeholder="روش نگهداری" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs"></textarea>
                <input id="admin-new-warranty" placeholder="ضمانت" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">
              </div>
            </details>

            <button type="submit" class="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-floppy-disk"></i>
              <span>ذخیره و انتشار محصول</span>
            </button>
          </form>
        </div>

        <!-- Products List -->
        <div class="lg:col-span-7 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-bold text-xs text-slate-800 flex items-center gap-2">
              <i class="fa-solid fa-list text-orange-600"></i>
              <span>لیست محصولات فعال (${toPersianDigits(products.length)})</span>
            </h4>
            <input type="text" id="admin-prod-search" oninput="adminFilterProducts(this.value)" placeholder="جستجوی سریع در محصولات..."
              class="px-3 py-1 rounded-xl border border-slate-200 text-xs w-48 outline-none focus:border-orange-500">
          </div>

          <div id="admin-products-list" class="space-y-2 max-h-[460px] overflow-y-auto custom-scroll pr-1">
            ${renderAdminProductsRows(products)}
          </div>
        </div>
      </div>
    `;
  } else if (activeAdminTab === "categories") {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Add Category Form with WebP Support -->
        <div class="lg:col-span-5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <h4 class="font-bold text-xs text-slate-800 mb-3 flex items-center gap-2">
            <i class="fa-solid fa-folder-plus text-orange-600"></i>
            <span>افزودن دسته‌بندی جدید با عکس WebP</span>
          </h4>
          <form onsubmit="handleAdminAddCategory(event)" class="space-y-3">
            <div>
              <label class="block text-[11px] font-bold text-slate-600 mb-1">نام دسته‌بندی (فارسی):</label>
              <input type="text" id="admin-cat-name" required placeholder="مثال: بستنی و کرمی گربه"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
            </div>

            <div class="p-3 rounded-xl bg-orange-50/70 border border-orange-200/80 flex items-center gap-2">
              <i class="fa-solid fa-wand-magic-sparkles text-orange-500"></i>
              <p class="text-[10px] text-orange-800 leading-relaxed">
                شناسهٔ داخلی این دسته‌بندی به‌صورت خودکار توسط سیستم ساخته می‌شود و نیازی به ورود Slug / ID نیست.
              </p>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-600 mb-1">
                <span class="text-orange-600 font-black">تصویر WebP دسته‌بندی:</span>
                <span class="text-[10px] text-slate-400 mr-1">(آدرس اینترنتی یا فایل WebP)</span>
              </label>
              <input type="url" id="admin-cat-img" placeholder="https://... یا انتخاب فایل با فرمت .webp"
                class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500 mb-1.5">
              
              <div class="p-2.5 bg-orange-50/60 rounded-xl border border-orange-200/80">
                <p class="text-[10px] text-orange-800 font-semibold mb-1 flex items-center gap-1">
                  <i class="fa-solid fa-file-image"></i>
                  <span>آپلود فایل WebP مستقیم از دستگاه:</span>
                </p>
                <input type="file" id="admin-cat-file" accept="image/webp,image/png,image/jpeg"
                  onchange="handleAdminFileToInput('admin-cat-file', 'admin-cat-img', 'admin-cat-preview')"
                  class="block w-full text-[11px] text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700 cursor-pointer">
              </div>

              <div id="admin-cat-preview" class="hidden mt-2 p-2 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                <img id="admin-cat-preview-img" class="w-12 h-12 object-cover rounded-lg border border-orange-200">
                <div>
                  <span class="text-[11px] font-bold text-slate-700 block">پیش‌نمایش تصویر WebP</span>
                  <span class="text-[9px] text-emerald-600 font-semibold">آماده استفاده در طراحی</span>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">آیکون دسته‌بندی:</label>
                <select id="admin-cat-icon" class="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none">
                  <option value="fa-paw">🐾 رد پنجه (fa-paw)</option>
                  <option value="fa-bowl-food">🍲 ظرف غذا (fa-bowl-food)</option>
                  <option value="fa-fish">🐟 ماهی و کنسرو (fa-fish)</option>
                  <option value="fa-cookie-bite">🍪 تشویقی (fa-cookie-bite)</option>
                  <option value="fa-shield-heart">🛡️ مکمل و درمانی (fa-shield-heart)</option>
                  <option value="fa-box">📦 جعبه و بستر (fa-box)</option>
                  <option value="fa-cat">🐱 گربه (fa-cat)</option>
                  <option value="fa-soap">🧼 بهداشت و شستشو (fa-soap)</option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">گرادیان رنگی:</label>
                <select id="admin-cat-color" class="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none">
                  <option value="from-orange-500 to-amber-500">نارنجی طلایی (Fox)</option>
                  <option value="from-rose-500 to-pink-500">رز و تمشکی</option>
                  <option value="from-amber-400 to-orange-500">عسلی کهربایی</option>
                  <option value="from-emerald-500 to-teal-600">سبز زمردی</option>
                  <option value="from-blue-500 to-indigo-600">آبی اقیانوسی</option>
                  <option value="from-purple-500 to-indigo-500">بنفش سلطنتی</option>
                </select>
              </div>
            </div>

            <button type="submit" class="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-plus-circle"></i>
              <span>افزودن دسته‌بندی با عکس WebP</span>
            </button>
          </form>
        </div>

        <!-- Categories List -->
        <div class="lg:col-span-7 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-bold text-xs text-slate-800 flex items-center gap-2">
              <i class="fa-solid fa-layer-group text-orange-600"></i>
              <span>دسته‌بندی‌های فعال (${toPersianDigits(categories.length)})</span>
            </h4>
          </div>

          <div class="space-y-2.5 max-h-[460px] overflow-y-auto custom-scroll pr-1">
            ${categories.map(cat => {
              const catProds = products.filter(p => p.categoryId === cat.id);
              return `
                <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs hover:bg-orange-50/40 transition">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-200 relative shrink-0 shadow-sm">
                      ${cat.image ? `
                        <img src="${cat.image}" class="w-full h-full object-cover" alt="${escapeHtml(cat.name)}" loading="lazy" decoding="async">
                      ` : `
                        <div class="w-full h-full bg-gradient-to-br ${cat.color || 'from-orange-500 to-amber-500'} flex items-center justify-center text-white">
                          <i class="fa-solid ${cat.icon || 'fa-paw'} text-base"></i>
                        </div>
                      `}
                      <span class="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-white/90 text-orange-600 flex items-center justify-center text-[9px] shadow">
                        <i class="fa-solid ${cat.icon || 'fa-paw'}"></i>
                      </span>
                    </div>

                    <div>
                      <p class="font-black text-slate-800 text-xs">${escapeHtml(cat.name)}</p>
                      <p class="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><i class="fa-solid fa-fingerprint text-orange-300"></i> شناسه خودکار</p>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="bg-white px-2 py-0.5 rounded-md border text-[10px] text-slate-600 font-bold">
                          ${toPersianDigits(catProds.length)} محصول
                        </span>
                        ${cat.image ? '<span class="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold"><i class="fa-solid fa-image"></i> دارای تصویر WebP</span>' : '<span class="text-[9px] text-slate-400">بدون تصویر</span>'}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <label class="px-2.5 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95" title="انتخاب مستقیم عکس WebP از حافظه دستگاه">
                      <i class="fa-solid fa-cloud-arrow-up text-orange-600"></i>
                      <span class="hidden sm:inline">آپلود WebP</span>
                      <span class="sm:hidden">عکس</span>
                      <input type="file" accept="image/*" class="hidden" onchange="handleDirectCategoryFileUpload('${cat.id}', this)">
                    </label>
                    <button type="button" onclick="adminEditCategoryUrl('${cat.id}')" class="px-2 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-orange-300 text-slate-600 hover:text-orange-600 text-[11px] font-bold transition flex items-center gap-1" title="تغییر با آدرس اینترنتی">
                      <i class="fa-solid fa-link text-[10px]"></i>
                      <span class="hidden sm:inline">لینک</span>
                    </button>
                    ${cat.image ? `
                      <button type="button" onclick="adminRemoveCategoryPhoto('${cat.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="حذف عکس و بازگشت به آیکون">
                        <i class="fa-solid fa-image-slash text-xs"></i>
                      </button>
                    ` : ''}
                    <button type="button" onclick="adminDeleteCategory('${cat.id}')" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="حذف دسته">
                      <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  } else if (activeAdminTab === "security") {
    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Security Status -->
        <div class="lg:col-span-6 space-y-4">
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div class="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-2">
              <i class="fa-solid fa-shield-check text-base"></i>
              <span>وضعیت امنیت فرانت‌اند و Cloudflare Pages: فعال و امن</span>
            </div>
            <ul class="text-[11px] text-emerald-700 space-y-1.5 leading-relaxed">
              <li class="flex items-center gap-1.5">
                <i class="fa-solid fa-check text-[10px]"></i>
                <span>محافظت در برابر حملات تزریق کد (XSS Sanitation Engine)</span>
              </li>
              <li class="flex items-center gap-1.5">
                <i class="fa-solid fa-check text-[10px]"></i>
                <span>محدودسازی تلاش ورود سمت سرور در Cloudflare D1</span>
              </li>
              <li class="flex items-center gap-1.5">
                <i class="fa-solid fa-check text-[10px]"></i>
                <span>هش رمز عبور سمت سرور با PBKDF2 + salt و نشست HttpOnly</span>
              </li>
              <li class="flex items-center gap-1.5">
                <i class="fa-solid fa-check text-[10px]"></i>
                <span>هدرهای امنیتی Cloudflare Pages (_headers): CSP, X-Frame, X-Content-Type</span>
              </li>
            </ul>
          </div>

          <!-- Change Username Form -->
          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 class="font-bold text-xs text-slate-800 mb-3 flex items-center gap-2">
              <i class="fa-solid fa-user-shield text-orange-600"></i>
              <span>تغییر نام کاربری مدیریت</span>
            </h4>
            <form onsubmit="handleAdminChangeUsername(event)" class="space-y-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">نام کاربری فعلی:</label>
                <input type="text" value="${escapeHtml(adminUsername || DEFAULT_ADMIN_USERNAME)}" disabled
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-xs outline-none">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">نام کاربری جدید:</label>
                <input type="text" id="admin-new-username" required minlength="3" maxlength="40" autocomplete="username"
                  placeholder="مثال: foxadmin"
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">رمز عبور فعلی برای تأیید:</label>
                <input type="password" id="admin-username-current-pwd" required autocomplete="current-password"
                  placeholder="رمز عبور فعلی..."
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
              </div>
              <button type="submit" class="w-full py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-user-pen"></i>
                <span>ذخیره نام کاربری جدید</span>
              </button>
            </form>
          </div>

          <!-- Change Password Form -->
          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 class="font-bold text-xs text-slate-800 mb-3 flex items-center gap-2">
              <i class="fa-solid fa-key text-orange-600"></i>
              <span>تغییر رمز عبور مدیریت (رمزنگاری SHA-256)</span>
            </h4>
            <form onsubmit="handleAdminChangePassword(event)" class="space-y-3">
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">رمز عبور فعلی:</label>
                <input type="password" id="admin-current-pwd" required placeholder="رمز فعلی..."
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">رمز عبور جدید:</label>
                <input type="password" id="admin-new-pwd" required minlength="6" placeholder="حداقل ۶ کاراکتر..."
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-600 mb-1">تکرار رمز عبور جدید:</label>
                <input type="password" id="admin-confirm-pwd" required minlength="6" placeholder="تکرار رمز جدید..."
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-orange-500">
              </div>

              <button type="submit" class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition flex items-center justify-center gap-1.5">
                <i class="fa-solid fa-lock"></i>
                <span>ذخیره هش رمز جدید</span>
              </button>
            </form>
          </div>
        </div>

        <!-- Backup & Database Management -->
        <div class="lg:col-span-6 space-y-4">
          <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <h4 class="font-bold text-xs text-slate-800 mb-2 flex items-center gap-2">
              <i class="fa-solid fa-database text-orange-600"></i>
              <span>پشتیبان‌گیری و خروجی داده‌ها (JSON Backup)</span>
            </h4>
            <p class="text-[11px] text-slate-500 mb-3 leading-relaxed">
              محصولات، دسته‌بندی‌ها و تنظیمات در Cloudflare D1 نگهداری می‌شوند و تصاویر آپلودی در D1 ذخیره می‌شوند. پشتیبان JSON نیز از داده‌های آنلاین تهیه می‌شود.
            </p>

            <div class="grid grid-cols-2 gap-2">
              <button onclick="adminExportBackup()" class="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm">
                <i class="fa-solid fa-download"></i>
                <span>دانلود پشتیبان کامل</span>
              </button>

              <label class="py-2.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-center">
                <i class="fa-solid fa-upload"></i>
                <span>بازیابی فایل JSON</span>
                <input type="file" accept=".json" onchange="adminImportBackup(event)" class="hidden">
              </label>
            </div>
          </div>

          <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <h4 class="font-bold text-xs text-amber-900 mb-1.5 flex items-center gap-1.5">
              <i class="fa-solid fa-rotate-left text-amber-600"></i>
              <span>بازنشانی به داده‌های پیش‌فرض اولیه PetraPet</span>
            </h4>
            <p class="text-[11px] text-amber-800 mb-3 leading-relaxed">
              در صورت تمایل می‌توانید کاتالوگ را به محصولات و دسته‌بندی‌های استاندارد اولیه بازگردانید.
            </p>
            <button onclick="adminResetDefaults()" class="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-1.5">
              <i class="fa-solid fa-arrows-rotate"></i>
              <span>بازنشانی به کاتالوگ اولیه</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

function renderAdminCustomerContent() {
  const allReviews = products.flatMap(p => (Array.isArray(p.reviews) ? p.reviews : []).map(r => ({ ...r, productName: p.name })));
  return `
    <div class="space-y-5">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <h4 class="font-black text-xs text-slate-800 flex items-center gap-2"><i class="fa-solid fa-star text-amber-500"></i> ثبت نظر تاییدشده توسط مدیر</h4>
          <p class="text-[10px] text-slate-400 mt-1">برای نظراتی که خارج از فرم عمومی دریافت کرده‌اید.</p>
          <form onsubmit="adminAddReview(event)" class="space-y-3 mt-4">
            <select id="admin-review-product" required class="w-full px-3 py-2 rounded-xl border bg-white text-xs">${products.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')}</select>
            <div class="grid grid-cols-2 gap-2"><input id="admin-review-name" required maxlength="80" placeholder="نام مشتری" class="w-full px-3 py-2 rounded-xl border bg-white text-xs"><select id="admin-review-rating" class="w-full px-3 py-2 rounded-xl border bg-white text-xs"><option value="5">۵ ستاره</option><option value="4">۴ ستاره</option><option value="3">۳ ستاره</option><option value="2">۲ ستاره</option><option value="1">۱ ستاره</option></select></div>
            <input id="admin-review-photo" placeholder="آدرس عکس مشتری (اختیاری)" class="w-full px-3 py-2 rounded-xl border bg-white text-xs" dir="ltr">
            <textarea id="admin-review-text" rows="4" required maxlength="3000" placeholder="متن نظر مشتری" class="w-full px-3 py-2 rounded-xl border bg-white text-xs"></textarea>
            <button class="w-full py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs">ثبت نظر</button>
          </form>
        </div>
        <div class="rounded-2xl p-4 bg-amber-50 border border-amber-200">
          <div class="flex items-center justify-between gap-2"><div><h4 class="font-black text-xs text-amber-900">نظرات در انتظار بررسی</h4><p class="text-[10px] text-amber-700 mt-1">نظرهای ثبت‌شده توسط کاربران ابتدا اینجا می‌آیند.</p></div><button onclick="loadAdminPendingReviews()" class="px-3 py-2 rounded-xl bg-white border border-amber-200 text-amber-800 text-[10px] font-bold"><i class="fa-solid fa-rotate"></i> بروزرسانی</button></div>
          <div id="admin-pending-reviews" class="mt-4 space-y-2"><div class="p-3 rounded-xl bg-white/70 text-[10px] text-amber-700">در حال دریافت…</div></div>
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between"><h4 class="font-black text-xs text-slate-800">نظرات تاییدشده (${toPersianDigits(allReviews.length)})</h4><span class="text-[10px] text-slate-400">فقط نظرات تاییدشده امتیاز محصول را تغییر می‌دهند.</span></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">${allReviews.length ? allReviews.map(r => `<div class="p-3 rounded-2xl bg-slate-50 border"><div class="flex justify-between gap-2"><b class="text-[11px]">${escapeHtml(r.customerName || 'مشتری')}</b><button onclick="adminDeleteReview('${escapeHtml(r.id)}')" class="text-rose-500"><i class="fa-solid fa-trash"></i></button></div><span class="text-[10px] text-slate-400 block mt-1">${escapeHtml(r.productName || '')} • ${'★'.repeat(Number(r.rating)||5)}</span><p class="text-[10px] text-slate-600 leading-6 mt-1">${escapeHtml(r.reviewText||'')}</p>${r.photoUrl ? `<img src="${escapeHtml(r.photoUrl)}" loading="lazy" class="mt-2 w-20 h-20 object-cover rounded-xl border">` : ''}</div>`).join('') : '<p class="text-[11px] text-slate-400">هنوز نظر تاییدشده‌ای ثبت نشده است.</p>'}</div>
      </div>
    </div>`;
}

async function loadAdminPendingReviews() {
  const host=document.getElementById('admin-pending-reviews');
  if(!host) return;
  try {
    const data=await apiRequest('/admin/review',{method:'GET'});
    const pending=(data.reviews||[]).filter(r=>!Number(r.approved));
    host.innerHTML=pending.length?pending.map(r=>`<div class="p-3 rounded-2xl bg-white border border-amber-200"><div class="flex justify-between gap-2"><div><b class="text-[11px] text-slate-800">${escapeHtml(r.customerName||'مشتری')}</b><span class="block text-[9px] text-slate-400 mt-1">${escapeHtml(r.productName||'محصول')} • ${'★'.repeat(Math.min(5,Math.max(1,Number(r.rating)||5)))}</span></div><span class="text-[9px] text-amber-700">در انتظار</span></div><p class="text-[10px] text-slate-600 leading-6 mt-2">${escapeHtml(r.reviewText||'')}</p><div class="grid grid-cols-2 gap-2 mt-2"><button onclick="adminModerateReview('${escapeHtml(r.id)}',true)" class="py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black"><i class="fa-solid fa-check"></i> تایید</button><button onclick="adminModerateReview('${escapeHtml(r.id)}',false)" class="py-2 rounded-xl bg-rose-50 text-rose-700 text-[10px] font-black"><i class="fa-solid fa-trash"></i> حذف</button></div></div>`).join(''):'<div class="p-3 rounded-xl bg-white/70 text-[10px] text-amber-700">نظری در انتظار بررسی نیست.</div>';
  } catch(err) { host.innerHTML=`<div class="p-3 rounded-xl bg-rose-50 text-rose-700 text-[10px]">${escapeHtml(err.message||'خطا در دریافت نظرات')}</div>`; }
}

async function adminModerateReview(id,approved){
  try {
    if(!approved && !confirm('این نظر حذف شود؟')) return;
    const data=await apiRequest(`/admin/review/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({approved:!!approved})});
    applyRemoteStore(data.store); renderAdminPortal(); showToast(approved?'نظر تایید و منتشر شد.':'نظر حذف شد.','success');
  } catch(err){ showToast(err.message||'خطا در بررسی نظر','error'); }
}

async function adminAddReview(event) {
  event.preventDefault();
  try {
    const data = await apiRequest('/admin/review', { method:'POST', body:JSON.stringify({
      productId:document.getElementById('admin-review-product')?.value||'', customerName:document.getElementById('admin-review-name')?.value.trim()||'',
      rating:Number(document.getElementById('admin-review-rating')?.value)||5, photoUrl:document.getElementById('admin-review-photo')?.value.trim()||'', reviewText:document.getElementById('admin-review-text')?.value.trim()||''
    })});
    applyRemoteStore(data.store); renderAdminPortal(); showToast('نظر واقعی مشتری ثبت شد و در صفحه محصول نمایش داده می‌شود.','success');
  } catch (err) { showToast(err.message||'خطا در ثبت نظر','error'); }
}

async function adminDeleteReview(id) {
  if(!confirm('این نظر از سایت حذف شود؟')) return;
  try { const data=await apiRequest(`/admin/review/${encodeURIComponent(id)}`,{method:'DELETE'}); applyRemoteStore(data.store); renderAdminPortal(); showToast('نظر حذف شد','info'); }
  catch(err){ showToast(err.message||'خطا در حذف نظر','error'); }
}

async function adminAddStory(event) {
  event.preventDefault();
  try {
    const data=await apiRequest('/admin/story',{method:'POST',body:JSON.stringify({
      customerName:document.getElementById('admin-story-name')?.value.trim()||'', catName:document.getElementById('admin-story-cat')?.value.trim()||'',
      photoUrl:document.getElementById('admin-story-photo')?.value.trim()||'', quote:document.getElementById('admin-story-quote')?.value.trim()||''
    })});
    applyRemoteStore(data.store); renderAdminPortal(); showToast('تجربه مشتری ثبت شد و برای اثبات اجتماعی سایت آماده است.','success');
  } catch(err){ showToast(err.message||'خطا در ثبت تجربه مشتری','error'); }
}

async function adminDeleteStory(id) {
  if(!confirm('این تجربه مشتری حذف شود؟')) return;
  try { const data=await apiRequest(`/admin/story/${encodeURIComponent(id)}`,{method:'DELETE'}); applyRemoteStore(data.store); renderAdminPortal(); showToast('تجربه حذف شد','info'); }
  catch(err){ showToast(err.message||'خطا در حذف تجربه','error'); }
}

function renderAdminProductsRows(productList) {
  if (productList.length === 0) {
    return `<div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed">هیچ کالایی یافت نشد</div>`;
  }

  return productList.map(prod => `
    <div class="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-orange-50/40 rounded-xl border border-slate-200 text-xs transition">
      <div class="flex items-center gap-2.5">
        <img src="${prod.image}" class="w-10 h-10 object-contain rounded-lg bg-white border border-slate-200 p-0.5 shrink-0" alt="${escapeHtml(prod.name)}" loading="lazy" decoding="async">
        <div>
          <p class="font-bold text-slate-800 line-clamp-1 max-w-[240px] sm:max-w-xs">${escapeHtml(prod.name)}</p>
          <div class="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
            <span class="font-bold text-orange-600">${formatPrice(prod.finalPrice)} تومان</span>
            ${prod.discountPercent > 0 ? `<span class="bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-bold">${toPersianDigits(prod.discountPercent)}٪ تخفیف</span>` : ""}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="openProductDetailModal('${prod.id}', true)" class="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition" title="مشاهده">
          <i class="fa-solid fa-eye text-xs"></i>
        </button>
        <button onclick='openAdminProductEditor(${JSON.stringify(String(prod.id)).replace(/'/g, "&#39;")})' class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="ویرایش محصول">
          <i class="fa-solid fa-pen-to-square text-xs"></i>
        </button>
        <button onclick="adminDeleteProduct('${prod.id}')" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition" title="حذف">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </div>
    </div>
  `).join("");
}

function adminFilterProducts(query) {
  const q = query.trim().toLowerCase();
  const listEl = document.getElementById("admin-products-list");
  if (!listEl) return;
  const filtered = products.filter(p => p.name.toLowerCase().includes(q) || (p.shortDesc && p.shortDesc.toLowerCase().includes(q)));
  listEl.innerHTML = renderAdminProductsRows(filtered);
}

function waitForImageLoad(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('تصویر در سرور ذخیره شد اما مرورگر نتوانست آن را لود کند.')), timeout);
    img.onload = () => finish(resolve, true);
    img.onerror = () => finish(reject, new Error('تصویر در سرور ذخیره شد اما فایل خروجی قابل نمایش نیست.'));
    img.src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  });
}

/**
 * Handle File Upload (WebP, PNG, JPG) with Automatic Canvas Compression
 * Safely converts camera/gallery photos into tiny, crisp WebP/JPEG dataURL
 */
async function handleAdminFileToInput(fileInputId, targetInputId, previewWrapperId) {
  const fileInput = document.getElementById(fileInputId);
  const targetInput = document.getElementById(targetInputId);
  const previewWrapper = document.getElementById(previewWrapperId);
  if (!fileInput?.files?.[0]) return;
  if (!backendReady || !isAdminLoggedIn) { showToast("لطفاً ابتدا وارد پنل مدیریت شوید.", "error"); return; }

  const file = fileInput.files[0];
  fileInput.dataset.uploading = "1";
  showToast("در حال فشرده‌سازی و ذخیره تصویر در دیتابیس...", "info");
  try {
    const blob = await compressImageBlob(file);
    const form = new FormData();
    form.append("file", blob, "foxshop-image.webp");
    const data = await apiRequest("/admin/upload-image", { method: "POST", body: form });
    await waitForImageLoad(data.url);
    if (targetInput) targetInput.value = data.url;
    if (previewWrapper) {
      previewWrapper.classList.remove("hidden");
      const img = previewWrapper.querySelector("img");
      if (img) img.src = data.url;
    }
    const keyInputId = targetInputId === "admin-new-img" ? "admin-new-img-key" : "admin-cat-img-key";
    const keyInput = document.getElementById(keyInputId);
    if (keyInput) keyInput.value = data.key;
    fileInput.dataset.uploading = "0";
    showToast("تصویر با موفقیت در دیتابیس آنلاین ذخیره شد 🐾", "success");
  } catch (err) {
    fileInput.dataset.uploading = "0";
    console.error(err); showToast(err.message || "خطا در بارگذاری تصویر", "error");
  }
}

async function compressImageBlob(file, maxWidth = 1000, maxHeight = 1000, quality = 0.80) {
  if (!file) throw new Error('هیچ فایلی انتخاب نشده است');
  const type = String(file.type || '').toLowerCase();
  if (!/^image\/(webp|jpeg|jpg|png|avif|gif)$/.test(type)) {
    throw new Error('فقط تصویر JPG، PNG، WebP، AVIF یا GIF مجاز است.');
  }

  let source = null;
  let objectUrl = null;
  try {
    // createImageBitmap avoids a giant base64 Data URL in memory on mobile.
    if ('createImageBitmap' in window) {
      try {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) {
        source = await createImageBitmap(file);
      }
    }
  } catch (_) {}

  if (!source) {
    objectUrl = URL.createObjectURL(file);
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('فرمت فایل تصویری معتبر نیست'));
      img.src = objectUrl;
    });
  }

  const srcWidth = source.width || source.naturalWidth;
  const srcHeight = source.height || source.naturalHeight;
  if (!srcWidth || !srcHeight) throw new Error('ابعاد تصویر قابل تشخیص نیست.');

  const scale = Math.min(1, maxWidth / srcWidth, maxHeight / srcHeight);
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('مرورگر از پردازش تصویر پشتیبانی نمی‌کند');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);

  const canvasBlob = (mime, q) => new Promise((resolve) => canvas.toBlob(resolve, mime, q));

  // Prefer WebP; fall back to JPEG. Keep the file comfortably below D1's
  // 2,000,000-byte BLOB/row limit so the image remains reliable in D1.
  const attempts = [
    ['image/webp', Math.min(0.86, Math.max(0.62, quality))],
    ['image/webp', 0.72],
    ['image/webp', 0.62],
    ['image/jpeg', 0.82],
    ['image/jpeg', 0.72]
  ];

  let best = null;
  for (const [mime, q] of attempts) {
    const blob = await canvasBlob(mime, q);
    if (!blob) continue;
    if (!best || blob.size < best.size) best = blob;
    if (blob.size <= 900000) {
      best = blob;
      break;
    }
  }

  if (!best) throw new Error('فشرده‌سازی تصویر انجام نشد.');
  if (best.size > 1800000) throw new Error('حجم تصویر بعد از فشرده‌سازی هنوز زیاد است؛ عکس کوچک‌تری انتخاب کنید.');
  return best;
}

/**
 * Direct File Upload for Existing Category
 * Triggered directly by native <input type="file"> on iOS/Android/Desktop
 */
async function handleDirectCategoryFileUpload(catId, inputEl) {
  if (!inputEl?.files?.[0]) return;
  if (!backendReady || !isAdminLoggedIn) { showToast("لطفاً ابتدا وارد پنل مدیریت شوید.", "error"); return; }
  const cat = categories.find(c => c.id === catId); if (!cat) return;
  showToast(`در حال فشرده‌سازی و ذخیره عکس «${cat.name}» در دیتابیس...`, "info");
  try {
    const blob = await compressImageBlob(inputEl.files[0]);
    const form = new FormData(); form.append("file", blob, "category-image.webp");
    const uploaded = await apiRequest("/admin/upload-image", { method: "POST", body: form });
    await waitForImageLoad(uploaded.url);
    const saved = await apiRequest(`/admin/category/${encodeURIComponent(catId)}`, { method: "PUT", body: JSON.stringify({ ...cat, image: uploaded.url, imageKey: uploaded.key }) });
    applyRemoteStore(saved.store); renderAdminPortal(); initHeader();
    if (typeof renderHomeCategories === "function") renderHomeCategories();
    if (typeof renderCategoryPills === "function") renderCategoryPills();
    showToast(`عکس جدید دسته‌بندی «${cat.name}» ذخیره شد 🐾`, "success");
  } catch (err) { console.error(err); showToast(err.message || "خطا در بارگذاری عکس", "error"); }
}

/**
 * Change Category Image via Internet URL
 */
async function adminEditCategoryUrl(catId) {
  const cat = categories.find(c => c.id === catId); if (!cat) return;
  const currentUrl = cat.image && !cat.image.startsWith("data:") ? cat.image : "";
  const newUrl = prompt(`آدرس اینترنتی تصویر WebP برای دسته‌بندی «${cat.name}» را وارد کنید:`, currentUrl);
  if (newUrl === null) return;
  const image = newUrl.trim(); if (!image) return;
  try {
    const data = await apiRequest(`/admin/category/${encodeURIComponent(catId)}`, { method: "PUT", body: JSON.stringify({ ...cat, image }) });
    applyRemoteStore(data.store); renderAdminPortal(); initHeader();
    if (typeof renderHomeCategories === "function") renderHomeCategories();
    if (typeof renderCategoryPills === "function") renderCategoryPills();
    showToast(`عکس دسته‌بندی «${cat.name}» به‌روزرسانی شد 🐾`, "success");
  } catch (err) { showToast(err.message || "خطا در ذخیره تصویر", "error"); }
}

/**
 * Remove Category Photo (Revert to colored gradient icon)
 */
async function adminRemoveCategoryPhoto(catId) {
  const cat = categories.find(c => c.id === catId); if (!cat) return;
  if (!confirm(`آیا می‌خواهید تصویر دسته‌بندی «${cat.name}» را حذف کنید و به آیکون بازگردد؟`)) return;
  try {
    const data = await apiRequest(`/admin/category/${encodeURIComponent(catId)}`, { method: "PUT", body: JSON.stringify({ ...cat, image: "" }) });
    applyRemoteStore(data.store); renderAdminPortal(); initHeader();
    if (typeof renderHomeCategories === "function") renderHomeCategories();
    if (typeof renderCategoryPills === "function") renderCategoryPills();
    showToast("تصویر دسته‌بندی حذف شد و به آیکون پیش‌فرض برگشت", "info");
  } catch (err) { showToast(err.message || "خطا در حذف تصویر", "error"); }
}

/**
 * Fallback prompt edit category photo
 */
function adminPromptEditCategoryPhoto(catId) {
  adminEditCategoryUrl(catId);
}

/**
 * Add / Edit Category with WebP Image
 */
async function handleAdminAddCategory(e) {
  e.preventDefault();
  if (!backendReady || !isAdminLoggedIn) { showToast("ورود مدیریت لازم است.", "error"); return; }
  const name = document.getElementById("admin-cat-name")?.value.trim() || "";
  const img = document.getElementById("admin-cat-img")?.value.trim() || "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=400&q=80&fm=webp";
  const icon = document.getElementById("admin-cat-icon")?.value || "fa-paw";
  const color = document.getElementById("admin-cat-color")?.value || "from-orange-500 to-amber-500";
  const imageKey = document.getElementById("admin-cat-img-key")?.value || "";
  if (!name) { showToast("لطفاً نام دسته‌بندی را وارد نمایید", "info"); return; }
  try {
    const data = await apiRequest("/admin/category", { method:"POST", body: JSON.stringify({ name, slug:name, image:img, imageKey, icon, color }) });
    applyRemoteStore(data.store); renderAdminPortal(); initHeader();
    if (typeof renderHomeCategories === "function") renderHomeCategories();
    if (typeof renderCategoryPills === "function") renderCategoryPills();
    showToast("دسته‌بندی جدید با شناسه خودکار ذخیره شد 🐾", "success");
  } catch (err) { showToast(err.message || "خطا در ذخیره دسته‌بندی", "error"); }
}

async function adminDeleteCategory(catId) {
  if (categories.length <= 1) { showToast("امکان حذف همه دسته‌بندی‌ها وجود ندارد", "info"); return; }
  if (!confirm("آیا از حذف این دسته‌بندی اطمینان دارید؟")) return;
  try {
    const data = await apiRequest(`/admin/category/${encodeURIComponent(catId)}`, { method:"DELETE" });
    applyRemoteStore(data.store); renderAdminPortal(); initHeader();
    if (typeof renderHomeCategories === "function") renderHomeCategories();
    showToast("دسته‌بندی حذف شد", "info");
  } catch (err) { showToast(err.message || "خطا در حذف دسته‌بندی", "error"); }
}

/**
 * Handle Admin Add Product
 */
async function handleAdminAddProduct(e) {
  e.preventDefault();
  if (!backendReady || !isAdminLoggedIn) { showToast("ورود مدیریت لازم است.", "error"); return; }
  const name = document.getElementById("admin-new-name")?.value.trim() || "";
  const cat = document.getElementById("admin-new-cat")?.value || "";
  const price = parseFloat(document.getElementById("admin-new-price")?.value) || 0;
  const discount = parseInt(document.getElementById("admin-new-discount")?.value, 10) || 0;
  const stock = document.getElementById("admin-new-stock")?.value || "in_stock";
  const img = document.getElementById("admin-new-img")?.value.trim() || "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80";
  const imageKey = document.getElementById("admin-new-img-key")?.value || "";
  const fileInput = document.getElementById("admin-product-file");
  const desc = document.getElementById("admin-new-desc")?.value.trim() || "";
  if (fileInput?.dataset.uploading === "1") {
    showToast("لطفاً صبر کنید تا آپلود و فشرده‌سازی تصویر تمام شود.", "info");
    return;
  }
  if (!name || !cat) { showToast("نام محصول و دسته‌بندی الزامی است.", "info"); return; }
  const finalPrice = discount > 0 ? Math.round(price * (1 - discount / 100)) : price;
  try {
    const data = await apiRequest("/admin/product", { method:"POST", body: JSON.stringify({
      name, categoryId:cat, originalPrice:price, discountPercent:discount, finalPrice, stockStatus:stock, image:img, imageKey, shortDesc:desc, fullDesc:desc,
      isFeatured:true, isBestSeller:false, isNew:true,
      brand:document.getElementById("admin-new-brand")?.value.trim() || "",
      weight:document.getElementById("admin-new-weight")?.value.trim() || "",
      flavor:document.getElementById("admin-new-flavor")?.value.trim() || "",
      suitableAge:document.getElementById("admin-new-age")?.value.trim() || "",
      goals:document.getElementById("admin-new-goals")?.value.trim() || "",
      country:document.getElementById("admin-new-country")?.value.trim() || "",
      barcode:document.getElementById("admin-new-barcode")?.value.trim() || "",
      expiryDate:document.getElementById("admin-new-expiry")?.value.trim() || "",
      actualStock:document.getElementById("admin-new-stock-qty")?.value || "",
      minStock:document.getElementById("admin-new-min-stock")?.value || "",
      restockTime:document.getElementById("admin-new-restock")?.value.trim() || "",
      consumable:!!document.getElementById("admin-new-consumable")?.checked,
      ingredients:document.getElementById("admin-new-ingredients")?.value.trim() || "",
      nutritionAnalysis:document.getElementById("admin-new-nutrition")?.value.trim() || "",
      usageMethod:document.getElementById("admin-new-usage")?.value.trim() || "",
      storage:document.getElementById("admin-new-storage")?.value.trim() || "",
      warranty:document.getElementById("admin-new-warranty")?.value.trim() || ""
    }) });
    applyRemoteStore(data.store); renderAdminPortal(); e.target.reset();
    if (typeof renderProductsCatalog === "function") renderProductsCatalog();
    if (typeof renderFeaturedProducts === "function") renderFeaturedProducts();
    showToast("محصول جدید با موفقیت در Cloudflare D1 ذخیره و منتشر شد 🐾", "success");
  } catch (err) { showToast(err.message || "خطا در ذخیره محصول", "error"); }
}

function closeAdminProductEditor() {
  document.getElementById('admin-product-editor-modal')?.remove();
}

function openAdminProductEditor(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) { showToast('محصول موردنظر پیدا نشد.', 'error'); return; }
  const pd = prod.details || {};
  closeAdminProductEditor();

  const modal = document.createElement('div');
  modal.id = 'admin-product-editor-modal';
  modal.className = 'fixed inset-0 z-[70] bg-slate-950/70 flex items-center justify-center p-3 sm:p-5';
  modal.innerHTML = `
    <div class="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-orange-200 p-4 sm:p-6">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 class="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2"><i class="fa-solid fa-pen-to-square text-orange-600"></i> ویرایش محصول</h3>
          <p class="text-[11px] text-slate-400 mt-1">تغییرات مستقیماً در Cloudflare D1 ذخیره می‌شود.</p>
        </div>
        <button type="button" onclick="closeAdminProductEditor()" class="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <form onsubmit='handleAdminEditProduct(event, ${JSON.stringify(String(productId)).replace(/'/g, "&#39;")})' class="space-y-3">
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">نام محصول:</label>
          <input id="edit-prod-name" required value="${escapeHtml(prod.name)}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">دسته‌بندی:</label>
            <select id="edit-prod-cat" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500">
              ${categories.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === prod.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-600 mb-1">وضعیت انبار:</label>
            <select id="edit-prod-stock" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500">
              <option value="in_stock" ${prod.stockStatus === 'in_stock' ? 'selected' : ''}>موجود در انبار</option>
              <option value="low_stock" ${prod.stockStatus === 'low_stock' ? 'selected' : ''}>موجودی محدود</option>
              <option value="out_of_stock" ${prod.stockStatus === 'out_of_stock' ? 'selected' : ''}>ناموجود</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div><label class="block text-[11px] font-bold text-slate-600 mb-1">قیمت اصلی:</label><input id="edit-prod-price" type="number" min="0" value="${Number(prod.originalPrice) || 0}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500"></div>
          <div><label class="block text-[11px] font-bold text-slate-600 mb-1">تخفیف ٪:</label><input id="edit-prod-discount" type="number" min="0" max="90" value="${Number(prod.discountPercent) || 0}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500"></div>
          <div><label class="block text-[11px] font-bold text-slate-600 mb-1">قیمت نهایی:</label><input id="edit-prod-final" type="number" min="0" value="${Number(prod.finalPrice) || 0}" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500"></div>
        </div>

        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">آدرس عکس:</label>
          <input id="edit-prod-image" type="text" inputmode="url" value="${escapeHtml(prod.image || '')}" placeholder="https://... یا عکس را از دستگاه انتخاب کنید" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500">
          <input id="edit-prod-image-key" type="hidden" value="${escapeHtml(prod.imageKey || '')}">
          <div class="mt-2 flex items-center gap-2">
            <label class="px-3 py-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-bold cursor-pointer flex items-center gap-1.5">
              <i class="fa-solid fa-image"></i><span>انتخاب و فشرده‌سازی عکس</span>
              <input id="edit-prod-file" type="file" accept="image/webp,image/jpeg,image/png,image/avif,image/gif" class="hidden" onchange="handleAdminEditProductFile(this)">
            </label>
            <span id="edit-prod-upload-status" class="text-[10px] text-slate-400"></span>
          </div>
          <div class="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 ${prod.image ? '' : 'hidden'}" id="edit-prod-preview-wrap">
            <img id="edit-prod-preview" src="${escapeHtml(prod.image || '')}" class="w-14 h-14 object-contain rounded-lg bg-white border border-slate-200" alt="پیش‌نمایش">
            <span class="text-[10px] text-slate-500">پیش‌نمایش تصویر فعلی</span>
          </div>
        </div>

        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">توضیحات کوتاه:</label>
          <textarea id="edit-prod-short" rows="2" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500">${escapeHtml(prod.shortDesc || '')}</textarea>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">توضیحات کامل:</label>
          <textarea id="edit-prod-full" rows="4" class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-orange-500">${escapeHtml(prod.fullDesc || '')}</textarea>
        </div>

        <details open class="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
          <summary class="cursor-pointer text-[11px] font-black text-orange-700">مشخصات تکمیلی فروش، SEO و انبار</summary>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <input id="edit-prod-slug" value="${escapeHtml(pd.slug || '')}" placeholder="Slug اختیاری" class="px-3 py-2 rounded-xl border bg-white text-xs" dir="ltr">
            <input id="edit-prod-brand" value="${escapeHtml(pd.brand || '')}" placeholder="برند" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-weight" value="${escapeHtml(pd.weight || '')}" placeholder="وزن / حجم" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-flavor" value="${escapeHtml(pd.flavor || '')}" placeholder="طعم و تنوع" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-age" value="${escapeHtml(pd.suitableAge || '')}" placeholder="سن مناسب" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-goals" value="${escapeHtml(pd.goals || '')}" placeholder="هدف مصرف" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-country" value="${escapeHtml(pd.country || '')}" placeholder="کشور سازنده" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-barcode" value="${escapeHtml(pd.barcode || '')}" placeholder="بارکد" class="px-3 py-2 rounded-xl border bg-white text-xs" dir="ltr">
            <input id="edit-prod-expiry" value="${escapeHtml(pd.expiryDate || '')}" placeholder="تاریخ انقضا" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-stock-qty" type="number" min="0" value="${pd.actualStock == null ? '' : Number(pd.actualStock)}" placeholder="تعداد واقعی انبار" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-min-stock" type="number" min="0" value="${pd.minStock == null ? '' : Number(pd.minStock)}" placeholder="حداقل موجودی" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-restock" value="${escapeHtml(pd.restockTime || '')}" placeholder="زمان تأمین مجدد" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <label class="flex items-center gap-2 text-[11px] font-bold"><input id="edit-prod-consumable" type="checkbox" ${pd.consumable ? 'checked' : ''}> محصول مصرفی / مناسب خرید مجدد</label>
            <textarea id="edit-prod-ingredients" rows="2" placeholder="ترکیبات" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">${escapeHtml(pd.ingredients || '')}</textarea>
            <textarea id="edit-prod-nutrition" rows="2" placeholder="آنالیز تغذیه‌ای" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">${escapeHtml(pd.nutritionAnalysis || '')}</textarea>
            <textarea id="edit-prod-usage" rows="2" placeholder="روش مصرف" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">${escapeHtml(pd.usageMethod || '')}</textarea>
            <textarea id="edit-prod-storage" rows="2" placeholder="روش نگهداری" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">${escapeHtml(pd.storage || '')}</textarea>
            <input id="edit-prod-warranty" value="${escapeHtml(pd.warranty || '')}" placeholder="ضمانت" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">
            <textarea id="edit-prod-authenticity" rows="2" placeholder="متن ضمانت اصالت" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">${escapeHtml(pd.authenticity || '')}</textarea>
            <input id="edit-prod-rating" type="number" min="0" max="5" step="0.1" value="${Number(pd.rating)||0}" placeholder="امتیاز" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-review-count" type="number" min="0" value="${Number(pd.reviewCount)||0}" placeholder="تعداد نظر" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <input id="edit-prod-sales-count" type="number" min="0" value="${Number(pd.salesCount)||0}" placeholder="تعداد فروش" class="px-3 py-2 rounded-xl border bg-white text-xs">
            <textarea id="edit-prod-more-images" rows="3" placeholder="عکس‌های بیشتر؛ هر آدرس در یک خط" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">${escapeHtml(Array.isArray(pd.moreImages)?pd.moreImages.join('\n'):'')}</textarea>
            <textarea id="edit-prod-related" rows="2" placeholder="شناسه محصولات مرتبط؛ با ویرگول جدا کنید" class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs">${escapeHtml(Array.isArray(pd.relatedIds)?pd.relatedIds.join(', '):'')}</textarea>
            <textarea id="edit-prod-faq" rows="4" placeholder='FAQ به صورت JSON؛ مثال: [{"question":"...","answer":"..."}]' class="sm:col-span-2 px-3 py-2 rounded-xl border bg-white text-xs" dir="ltr">${escapeHtml(JSON.stringify(Array.isArray(pd.faq)?pd.faq:[], null, 2))}</textarea>
          </div>
        </details>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <label class="flex items-center gap-2 text-[11px] font-bold text-slate-700"><input id="edit-prod-featured" type="checkbox" ${prod.isFeatured ? 'checked' : ''}> ویژه</label>
          <label class="flex items-center gap-2 text-[11px] font-bold text-slate-700"><input id="edit-prod-best" type="checkbox" ${prod.isBestSeller ? 'checked' : ''}> پرفروش</label>
          <label class="flex items-center gap-2 text-[11px] font-bold text-slate-700"><input id="edit-prod-new" type="checkbox" ${prod.isNew ? 'checked' : ''}> جدید</label>
        </div>

        <div class="flex gap-2 pt-1">
          <button type="submit" class="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"><i class="fa-solid fa-floppy-disk"></i> ذخیره تغییرات</button>
          <button type="button" onclick="closeAdminProductEditor()" class="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">انصراف</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
}

async function handleAdminEditProductFile(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  if (!backendReady || !isAdminLoggedIn) { showToast('لطفاً ابتدا وارد پنل مدیریت شوید.', 'error'); return; }
  const status = document.getElementById('edit-prod-upload-status');
  try {
    if (status) status.textContent = 'در حال فشرده‌سازی...';
    const blob = await compressImageBlob(file);
    const form = new FormData();
    form.append('file', blob, blob.type === 'image/jpeg' ? 'foxshop-image.jpg' : 'foxshop-image.webp');
    const uploaded = await apiRequest('/admin/upload-image', { method: 'POST', body: form });
    await waitForImageLoad(uploaded.url);
    document.getElementById('edit-prod-image').value = uploaded.url;
    document.getElementById('edit-prod-image-key').value = uploaded.key;
    const preview = document.getElementById('edit-prod-preview');
    const wrap = document.getElementById('edit-prod-preview-wrap');
    if (preview) preview.src = `${uploaded.url}?v=${Date.now()}`;
    if (wrap) wrap.classList.remove('hidden');
    if (status) status.textContent = `آماده؛ ${Math.round(blob.size / 1024)}KB`;
    showToast('عکس فشرده شد و با موفقیت در D1 ذخیره شد 🐾', 'success');
  } catch (err) {
    console.error(err);
    if (status) status.textContent = '';
    showToast(err.message || 'خطا در آپلود تصویر', 'error');
  }
}

async function handleAdminEditProduct(event, productId) {
  event.preventDefault();
  if (!backendReady || !isAdminLoggedIn) { showToast('ورود مدیریت لازم است.', 'error'); return; }
  const prod = products.find(p => p.id === productId);
  if (!prod) { showToast('محصول موردنظر پیدا نشد.', 'error'); return; }

  const originalPrice = Number(document.getElementById('edit-prod-price')?.value) || 0;
  const discountPercent = Math.min(90, Math.max(0, Number(document.getElementById('edit-prod-discount')?.value) || 0));
  const finalField = document.getElementById('edit-prod-final')?.value;
  const finalPrice = finalField === '' ? Math.round(originalPrice * (1 - discountPercent / 100)) : Math.max(0, Number(finalField) || 0);

  try {
    const data = await apiRequest(`/admin/product/${encodeURIComponent(productId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: document.getElementById('edit-prod-name')?.value.trim() || '',
        categoryId: document.getElementById('edit-prod-cat')?.value || '',
        stockStatus: document.getElementById('edit-prod-stock')?.value || 'in_stock',
        originalPrice,
        discountPercent,
        finalPrice,
        isFeatured: !!document.getElementById('edit-prod-featured')?.checked,
        isBestSeller: !!document.getElementById('edit-prod-best')?.checked,
        isNew: !!document.getElementById('edit-prod-new')?.checked,
        image: document.getElementById('edit-prod-image')?.value.trim() || '',
        imageKey: document.getElementById('edit-prod-image-key')?.value || '',
        shortDesc: document.getElementById('edit-prod-short')?.value.trim() || '',
        fullDesc: document.getElementById('edit-prod-full')?.value.trim() || '',
        details: {
          slug: document.getElementById('edit-prod-slug')?.value.trim() || '',
          brand: document.getElementById('edit-prod-brand')?.value.trim() || '',
          weight: document.getElementById('edit-prod-weight')?.value.trim() || '',
          flavor: document.getElementById('edit-prod-flavor')?.value.trim() || '',
          suitableAge: document.getElementById('edit-prod-age')?.value.trim() || '',
          goals: document.getElementById('edit-prod-goals')?.value.trim() || '',
          country: document.getElementById('edit-prod-country')?.value.trim() || '',
          barcode: document.getElementById('edit-prod-barcode')?.value.trim() || '',
          expiryDate: document.getElementById('edit-prod-expiry')?.value.trim() || '',
          actualStock: document.getElementById('edit-prod-stock-qty')?.value || '',
          minStock: document.getElementById('edit-prod-min-stock')?.value || '',
          restockTime: document.getElementById('edit-prod-restock')?.value.trim() || '',
          consumable: !!document.getElementById('edit-prod-consumable')?.checked,
          ingredients: document.getElementById('edit-prod-ingredients')?.value.trim() || '',
          nutritionAnalysis: document.getElementById('edit-prod-nutrition')?.value.trim() || '',
          usageMethod: document.getElementById('edit-prod-usage')?.value.trim() || '',
          storage: document.getElementById('edit-prod-storage')?.value.trim() || '',
          warranty: document.getElementById('edit-prod-warranty')?.value.trim() || '',
          authenticity: document.getElementById('edit-prod-authenticity')?.value.trim() || '',
          rating: Number(document.getElementById('edit-prod-rating')?.value) || 0,
          reviewCount: Number(document.getElementById('edit-prod-review-count')?.value) || 0,
          salesCount: Number(document.getElementById('edit-prod-sales-count')?.value) || 0,
          moreImages: (document.getElementById('edit-prod-more-images')?.value || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean),
          relatedIds: (document.getElementById('edit-prod-related')?.value || '').split(',').map(v => v.trim()).filter(Boolean),
          faq: (() => { try { const parsed = JSON.parse(document.getElementById('edit-prod-faq')?.value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch (_) { return []; } })()
        }
      })
    });
    applyRemoteStore(data.store);
    closeAdminProductEditor();
    renderAdminPortal();
    if (typeof renderProductsCatalog === 'function') renderProductsCatalog();
    if (typeof renderFeaturedProducts === 'function') renderFeaturedProducts();
    showToast('تغییرات محصول با موفقیت ذخیره شد 🐾', 'success');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'خطا در ویرایش محصول', 'error');
  }
}

async function adminDeleteProduct(id) {
  if (!confirm("آیا از حذف این محصول اطمینان دارید؟")) return;
  try {
    const data = await apiRequest(`/admin/product/${encodeURIComponent(id)}`, { method:"DELETE" });
    applyRemoteStore(data.store); renderAdminPortal();
    if (typeof renderProductsCatalog === "function") renderProductsCatalog();
    if (typeof renderFeaturedProducts === "function") renderFeaturedProducts();
    showToast("محصول با موفقیت از دیتابیس حذف شد", "info");
  } catch (err) { showToast(err.message || "خطا در حذف محصول", "error"); }
}

/**
 * Handle Admin Login with Rate Limiting & SHA-256
 */
async function handleAdminLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById("admin-username-input")?.value.trim() || "";
  const passInput = document.getElementById("admin-password-input")?.value || "";
  try {
    const data = await apiRequest("/admin/login", { method:"POST", body:JSON.stringify({username:usernameInput,password:passInput}) });
    isAdminLoggedIn = true; adminUsername = data.username || usernameInput; applyRemoteStore(data.store);
    showToast("ورود موفقیت‌آمیز به پنل مدیریت PetraPet 🐾", "success"); renderAdminPortal();
  } catch (err) { showToast(err.message || "نام کاربری یا رمز عبور اشتباه است.", err.status===429 ? "info" : "error"); renderAdminPortal(); }
}

async function handleAdminChangeUsername(e) {
  e.preventDefault();
  const nextUsername = document.getElementById("admin-new-username")?.value.trim() || "";
  const currentPassword = document.getElementById("admin-username-current-pwd")?.value || "";
  try {
    const data = await apiRequest("/admin/username", {method:"PUT", body:JSON.stringify({username:nextUsername,currentPassword})});
    adminUsername = data.username || nextUsername; applyRemoteStore(data.store); renderAdminPortal();
    showToast("نام کاربری مدیریت با موفقیت تغییر کرد 🔐", "success");
  } catch (err) { showToast(err.message || "خطا در تغییر نام کاربری", "error"); }
}

async function handleAdminChangePassword(e) {
  e.preventDefault();
  const curr = document.getElementById("admin-current-pwd")?.value || "";
  const next = document.getElementById("admin-new-pwd")?.value || "";
  const conf = document.getElementById("admin-confirm-pwd")?.value || "";
  if (next !== conf) { showToast("رمز جدید و تکرار آن همخوانی ندارند", "info"); return; }
  try {
    const data = await apiRequest("/admin/password", {method:"PUT", body:JSON.stringify({currentPassword:curr,newPassword:next})});
    adminUsername = data.username || adminUsername; applyRemoteStore(data.store); renderAdminPortal();
    showToast("رمز عبور مدیریت در Cloudflare D1 تغییر کرد و نشست امن جدید ساخته شد 🔒", "success");
  } catch (err) { showToast(err.message || "خطا در تغییر رمز عبور", "error"); }
}

async function adminLogout() {
  try { await apiRequest("/admin/logout", {method:"POST"}); } catch (_) {}
  isAdminLoggedIn = false; adminUsername = DEFAULT_ADMIN_USERNAME;
  showToast("خروج امن از پنل مدیریت انجام شد", "info"); renderAdminPortal();
}

function adminExportBackup() {
  const data = {
    version: "2.4",
    exportedAt: new Date().toISOString(),
    products,
    categories,
    settings,
    customerStories
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `foxshop-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("فایل پشتیبان با موفقیت دانلود شد 📁", "success");
}

async function adminImportBackup(e) {
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  try {
    const data=JSON.parse(await file.text());
    const res=await apiRequest("/admin/import",{method:"POST",body:JSON.stringify(data)});
    applyRemoteStore(res.store); renderAdminPortal(); initHeader();
    if(typeof renderProductsCatalog==="function") renderProductsCatalog();
    if(typeof renderHomeCategories==="function") renderHomeCategories();
    showToast("پشتیبان با موفقیت در Cloudflare D1 بازیابی شد 🐾","success");
  } catch(err){ showToast(err.message||"خطا در بازیابی فایل JSON","error"); }
  finally { e.target.value=""; }
}

async function adminResetDefaults() {
  if (!confirm("آیا اطمینان دارید که می‌خواهید کاتالوگ به حالت اولیه بازگردد؟")) return;
  if (!backendReady || !isAdminLoggedIn) { showToast("ورود مدیریت لازم است.", "error"); return; }
  try {
    const res=await apiRequest("/admin/reset",{method:"POST",body:JSON.stringify({products:typeof DEFAULT_PRODUCTS!=="undefined"?DEFAULT_PRODUCTS:[],categories:typeof DEFAULT_CATEGORIES!=="undefined"?DEFAULT_CATEGORIES:[]})});
    applyRemoteStore(res.store); renderAdminPortal(); initHeader();
    if(typeof renderProductsCatalog==="function") renderProductsCatalog();
    if(typeof renderHomeCategories==="function") renderHomeCategories();
    showToast("کاتالوگ به حالت اولیه در Cloudflare D1 بازنشانی شد 🐾","info");
  } catch(err){ showToast(err.message||"خطا در بازنشانی کاتالوگ","error"); }
}

// Global window assignments for all inline HTML handlers used by the static pages.
if (typeof window !== "undefined") {
  window.openProductDetailModalWithSplash = openProductDetailModalWithSplash;
  window.openProductDetailModal = openProductDetailModal;
  window.closeProductDetailModal = closeProductDetailModal;
  window.openInstagramProduct = openInstagramProduct;
  window.addToCart = addToCart;
  window.updateCartQuantity = updateCartQuantity;
  window.removeFromCart = removeFromCart;
  window.toggleMobileMenu = toggleMobileMenu;
  window.toggleCartDrawer = toggleCartDrawer;
  window.openRubikaOrderModal = openRubikaOrderModal;
  window.closeRubikaOrderModal = closeRubikaOrderModal;
  window.submitRubikaOrder = submitRubikaOrder;
  window.submitInstagramOrder = submitInstagramOrder;
  window.openAdminModal = openAdminModal;
  window.openAdminPortalModal = openAdminPortalModal;
  window.closeAdminPortalModal = closeAdminPortalModal;
  window.setAdminTab = setAdminTab;
  window.handleAdminLogin = handleAdminLogin;
  window.handleAdminChangeUsername = handleAdminChangeUsername;
  window.handleAdminChangePassword = handleAdminChangePassword;
  window.adminLogout = adminLogout;
  window.handleAdminFileToInput = handleAdminFileToInput;
  window.handleDirectCategoryFileUpload = handleDirectCategoryFileUpload;
  window.adminEditCategoryUrl = adminEditCategoryUrl;
  window.adminRemoveCategoryPhoto = adminRemoveCategoryPhoto;
  window.adminDeleteCategory = adminDeleteCategory;
  window.adminSwitchTab = adminSwitchTab;
  window.handleAdminAddCategory = handleAdminAddCategory;
  window.handleAdminAddProduct = handleAdminAddProduct;
  window.adminDeleteProduct = adminDeleteProduct;
  window.openAdminProductEditor = openAdminProductEditor;
  window.closeAdminProductEditor = closeAdminProductEditor;
  window.handleAdminEditProduct = handleAdminEditProduct;
  window.handleAdminEditProductFile = handleAdminEditProductFile;
  window.adminFilterProducts = adminFilterProducts;
  window.adminExportBackup = adminExportBackup;
  window.adminImportBackup = adminImportBackup;
  window.adminResetDefaults = adminResetDefaults;
  window.adminAddReview = adminAddReview;
  window.adminDeleteReview = adminDeleteReview;
  window.loadAdminPendingReviews = loadAdminPendingReviews;
  window.adminModerateReview = adminModerateReview;
  window.showToast = showToast;
  window.formatPrice = formatPrice;
  window.toPersianDigits = toPersianDigits;
  window.escapeHtml = escapeHtml;
  window.copyTextToClipboard = copyTextToClipboard;
}

/* PetraPet Premium Cat UI micro-interactions — visual only */
(() => {
  const initPremiumUI = () => {
    try {
      const revealSelectors = [
        'main > section',
        'main > div.bg-white',
        '.product-card-item',
        '#home-featured-grid > div',
        '#home-bestseller-grid > div',
        '#home-categories-container > a',
        '#catalog-products-grid > div',
        'footer'
      ];
      const elements = document.querySelectorAll(revealSelectors.join(','));
      const isTouchOrMobile = window.matchMedia && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

      if (!isTouchOrMobile) {
        elements.forEach((el, i) => {
          if (el.classList.contains('fixed')) return;
          el.classList.add('fox-reveal');
          el.style.animationDelay = `${Math.min(i * 35, 420)}ms`;
        });

        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            });
          }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
          elements.forEach(el => observer.observe(el));
        } else {
          elements.forEach(el => el.classList.add('is-visible'));
        }
      } else {
        elements.forEach(el => el.classList.add('is-visible'));
      }

      const header = document.querySelector('header.sticky');
      if (header) {
        let headerTick = false;
        const syncHeader = () => {
          if (headerTick) return;
          headerTick = true;
          requestAnimationFrame(() => {
            header.classList.toggle('is-scrolled', window.scrollY > 10);
            headerTick = false;
          });
        };
        syncHeader();
        window.addEventListener('scroll', syncHeader, { passive: true });
      }

      document.querySelectorAll('.fox-cat-pattern, .fox-cat-corner').forEach(el => el.remove());
    } catch (err) {
      console.debug('Premium UI enhancement skipped:', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPremiumUI, { once: true });
  } else {
    initPremiumUI();
  }
})();
