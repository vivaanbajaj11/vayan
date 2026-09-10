let PRODUCTS = [];
let COLLECTIONS = [];
let FILTERED = [];

const filters = { search: '', category: 'all', color: '', minPrice: null, maxPrice: null };

function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function thumbOf(product) {
  return (product.images && product.images[0] && product.images[0].url) || product.image || '';
}

async function loadAll() {
  try {
    const [productsRes, collectionsRes] = await Promise.all([
      fetch('products.json'),
      fetch('collections.json'),
    ]);
    const productsData = await productsRes.json();
    PRODUCTS = productsData.products || [];

    try {
      const collectionsData = await collectionsRes.json();
      COLLECTIONS = collectionsData.collections || [];
    } catch (e) {
      COLLECTIONS = [];
    }

    populateColorFilter();
    renderCategoryPills();
    renderFeaturedBanner();
    applyFilters();
    renderMarquee();
  } catch (e) {
    console.error('Could not load shop data', e);
    document.getElementById('productGrid').innerHTML =
      '<p style="padding:24px;color:#8A6E5C;">Could not load the shop right now. Please refresh.</p>';
  }
}

// --- Filtering ---
function applyFilters() {
  FILTERED = PRODUCTS.filter((p) => {
    if (filters.category !== 'all' && p.category !== filters.category) return false;
    if (filters.color && p.color !== filters.color) return false;
    if (filters.minPrice != null && p.price < filters.minPrice) return false;
    if (filters.maxPrice != null && p.price > filters.maxPrice) return false;
    if (filters.search) {
      const haystack = `${p.name} ${p.description} ${p.personality} ${p.color} ${p.fabric}`.toLowerCase();
      if (!haystack.includes(filters.search)) return false;
    }
    return true;
  });
  renderProducts(FILTERED);
  setupScrollReveal();
}

function populateColorFilter() {
  const select = document.getElementById('colorFilter');
  if (!select) return;
  const colors = [...new Set(PRODUCTS.map((p) => p.color).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All colors</option>' +
    colors.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.addEventListener('change', () => {
    filters.color = select.value;
    applyFilters();
  });
}

function renderCategoryPills() {
  const wrap = document.getElementById('categoryPills');
  if (!wrap) return;
  const pills = [{ id: 'all', name: 'All' }, ...COLLECTIONS];
  wrap.innerHTML = pills.map((c) => `
    <button class="pill ${c.id === 'all' ? 'active' : ''}" data-id="${c.id}" type="button">${escapeHtml(c.name)}</button>
  `).join('');

  wrap.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filters.category = btn.dataset.id;
      applyFilters();
      setMarqueeTheme(btn.dataset.id);
    });
  });
}

function setMarqueeTheme(categoryId) {
  const section = document.querySelector('.marquee-section');
  if (!section) return;
  const collection = COLLECTIONS.find((c) => c.id === categoryId);
  section.style.background = collection ? collection.themeColor : '';
}

function renderFeaturedBanner() {
  const el = document.getElementById('featuredBanner');
  if (!el || COLLECTIONS.length === 0) return;
  const featured = COLLECTIONS[0];
  el.style.setProperty('--feature-color', featured.themeColor);
  el.innerHTML = `
    <div class="featured-inner">
      <div class="eyebrow"><span class="diamond"></span><span>Featured collection</span></div>
      <h2>${escapeHtml(featured.name)}</h2>
      <p>${escapeHtml(featured.tagline)}</p>
      <button class="featured-cta" id="featuredCta" type="button">Shop the collection</button>
    </div>
  `;
  document.getElementById('featuredCta').addEventListener('click', () => {
    filters.category = featured.id;
    applyFilters();
    setMarqueeTheme(featured.id);
    document.querySelectorAll('#categoryPills .pill').forEach((b) => {
      b.classList.toggle('active', b.dataset.id === featured.id);
    });
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
  });
}

// --- Marquee ---
function renderMarquee() {
  const track = document.getElementById('marqueeTrack');
  if (!track || PRODUCTS.length === 0) return;
  const doubled = [...PRODUCTS, ...PRODUCTS];
  track.innerHTML = doubled.map((p) => `
    <div class="marquee-item">
      <div class="frame">
        <img src="${thumbOf(p)}" alt="${escapeHtml(p.name)}" loading="lazy">
      </div>
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="bubble">${escapeHtml(p.personality)}</div>
    </div>
  `).join('');
}

// --- Product grid ---
function renderProducts(list) {
  const grid = document.getElementById('productGrid');
  if (list.length === 0) {
    grid.innerHTML = '<p style="padding:24px;color:#8A6E5C;grid-column:1/-1;text-align:center;">No shirts match those filters yet.</p>';
    return;
  }
  grid.innerHTML = list.map((p) => {
    const outOfStock = p.stock <= 0;
    const lowStock = p.stock > 0 && p.stock <= 3;
    return `
      <div class="product-card ${outOfStock ? 'sold-out-card' : ''}" data-id="${p.id}">
        <div class="swatch-frame">
          <img src="${thumbOf(p)}" alt="${escapeHtml(p.name)} shirt swatch" loading="lazy">
        </div>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="personality">${escapeHtml(p.personality)}</p>
        <p class="desc">${escapeHtml(p.description)}</p>
        <p class="fabric">${escapeHtml(p.fabric)}</p>
        <div class="price-row">
          <span class="price">${formatINR(p.price)}</span>
          <span class="stock-note ${lowStock ? 'low' : ''}">
            ${outOfStock ? 'Sold out' : lowStock ? `Only ${p.stock} left` : `${p.stock} in stock`}
          </span>
        </div>
        <button class="add-btn" data-id="${p.id}" ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? 'Sold out' : 'Select size'}
        </button>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.product-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (card.classList.contains('sold-out-card')) return;
      openModal(card.dataset.id);
    });
  });
}

function setupScrollReveal() {
  const cards = document.querySelectorAll('.product-card');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    cards.forEach((c) => c.classList.add('in-view'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  cards.forEach((c) => observer.observe(c));
}

// --- Product modal ---
let modalProduct = null;
let modalImageIndex = 0;
let modalSelectedSize = null;

const productModal = document.getElementById('productModal');
const modalBackdrop = document.getElementById('modalBackdrop');

function openModal(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return;
  modalProduct = product;
  modalImageIndex = 0;
  modalSelectedSize = null;

  document.getElementById('modalName').textContent = product.name;
  document.getElementById('modalPersonality').textContent = product.personality;
  document.getElementById('modalPrice').textContent = formatINR(product.price);
  document.getElementById('modalDesc').textContent = product.description;
  document.getElementById('modalFabric').textContent = `${product.fabric} · ${product.color || ''}`;

  const collection = COLLECTIONS.find((c) => c.id === product.category);
  document.getElementById('modalCategory').textContent = collection ? collection.name : '';

  renderGallery(product);
  renderSizeOptions(product);
  updateAddButton();

  productModal.classList.add('open');
  modalBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  productModal.classList.remove('open');
  modalBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

function renderGallery(product) {
  const track = document.getElementById('galleryTrack');
  const dots = document.getElementById('galleryDots');
  const images = (product.images && product.images.length > 0) ? product.images : [{ url: product.image || '' }];

  track.innerHTML = images.map((img) => `
    <div class="gallery-slide"><img src="${img.url}" alt="${escapeHtml(product.name)}"></div>
  `).join('');
  dots.innerHTML = images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-i="${i}"></span>`).join('');

  const nav = document.querySelectorAll('.gallery-nav');
  nav.forEach((btn) => btn.style.display = images.length > 1 ? '' : 'none');
  dots.style.display = images.length > 1 ? '' : 'none';

  updateGalleryPosition();

  dots.querySelectorAll('.dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      modalImageIndex = Number(dot.dataset.i);
      updateGalleryPosition();
    });
  });
}

function updateGalleryPosition() {
  const track = document.getElementById('galleryTrack');
  const dots = document.getElementById('galleryDots');
  track.style.transform = `translateX(-${modalImageIndex * 100}%)`;
  dots.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === modalImageIndex);
  });
}

function renderSizeOptions(product) {
  const wrap = document.getElementById('sizeOptions');
  const allSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const available = product.sizes || [];
  wrap.innerHTML = allSizes.map((s) => `
    <button class="size-btn" data-size="${s}" ${available.includes(s) ? '' : 'disabled'} type="button">${s}</button>
  `).join('');

  wrap.querySelectorAll('.size-btn:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.size-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      modalSelectedSize = btn.dataset.size;
      updateAddButton();
    });
  });
}

function updateAddButton() {
  const btn = document.getElementById('modalAddBtn');
  if (modalSelectedSize) {
    btn.disabled = false;
    btn.textContent = `Add to Cart — ${formatINR(modalProduct.price)}`;
  } else {
    btn.disabled = true;
    btn.textContent = 'Select a size';
  }
}

document.getElementById('modalClose').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && productModal.classList.contains('open')) closeModal();
});
document.getElementById('galleryPrev').addEventListener('click', () => {
  const count = modalProduct.images ? modalProduct.images.length : 1;
  modalImageIndex = (modalImageIndex - 1 + count) % count;
  updateGalleryPosition();
});
document.getElementById('galleryNext').addEventListener('click', () => {
  const count = modalProduct.images ? modalProduct.images.length : 1;
  modalImageIndex = (modalImageIndex + 1) % count;
  updateGalleryPosition();
});
document.getElementById('modalAddBtn').addEventListener('click', () => {
  if (!modalSelectedSize || !modalProduct) return;
  Cart.addItem(modalProduct, modalSelectedSize);
  closeModal();
  openCart();
});

// --- Cart drawer UI ---
const cartDrawer = document.getElementById('cartDrawer');
const backdrop = document.getElementById('backdrop');
const cartToggle = document.getElementById('cartToggle');
const cartClose = document.getElementById('cartClose');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartCountEl = document.getElementById('cartCount');
const checkoutBtn = document.getElementById('checkoutBtn');

function openCart() {
  cartDrawer.classList.add('open');
  backdrop.classList.add('open');
  cartToggle.setAttribute('aria-expanded', 'true');
}

function closeCart() {
  cartDrawer.classList.remove('open');
  backdrop.classList.remove('open');
  cartToggle.setAttribute('aria-expanded', 'false');
}

cartToggle.addEventListener('click', () => {
  cartDrawer.classList.contains('open') ? closeCart() : openCart();
});
cartClose.addEventListener('click', closeCart);
backdrop.addEventListener('click', closeCart);

function renderCart() {
  const items = Cart.getItems();
  cartCountEl.textContent = Cart.getCount();

  if (items.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
  } else {
    cartItemsEl.innerHTML = items.map((i) => `
      <div class="cart-item">
        <img src="${i.image}" alt="${escapeHtml(i.name)}">
        <div class="cart-item-info">
          <div class="name">${escapeHtml(i.name)}${i.size ? ` <span class="size-tag">Size ${i.size}</span>` : ''}</div>
          <div class="meta">
            <button class="qty-btn" data-line="${i.lineId}" data-delta="-1">-</button>
            <span>${i.qty}</span>
            <button class="qty-btn" data-line="${i.lineId}" data-delta="1">+</button>
            <span>${formatINR(i.price * i.qty)}</span>
          </div>
          <button class="remove-link" data-line="${i.lineId}">Remove</button>
        </div>
      </div>
    `).join('');
  }

  cartTotalEl.textContent = formatINR(Cart.getTotal());

  cartItemsEl.querySelectorAll('.qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const items = Cart.getItems();
      const item = items.find((i) => i.lineId === btn.dataset.line);
      if (item) {
        Cart.setQty(item.lineId, item.qty + Number(btn.dataset.delta));
      }
    });
  });

  cartItemsEl.querySelectorAll('.remove-link').forEach((btn) => {
    btn.addEventListener('click', () => Cart.removeItem(btn.dataset.line));
  });
}

Cart.onChange(renderCart);

checkoutBtn.addEventListener('click', async () => {
  const items = Cart.getItems();
  if (items.length === 0) return;

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Redirecting…';

  try {
    const res = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'No checkout URL returned');
    }
  } catch (e) {
    console.error(e);
    alert('Checkout is not set up yet. Add your Stripe secret key in Netlify environment variables to enable it.');
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = 'Checkout';
  }
});

// --- Search & price filter inputs ---
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filters.search = searchInput.value.trim().toLowerCase();
      applyFilters();
    }, 200);
  });
}

const minPriceInput = document.getElementById('minPrice');
const maxPriceInput = document.getElementById('maxPrice');
if (minPriceInput && maxPriceInput) {
  minPriceInput.addEventListener('input', () => {
    filters.minPrice = minPriceInput.value ? Number(minPriceInput.value) : null;
    applyFilters();
  });
  maxPriceInput.addEventListener('input', () => {
    filters.maxPrice = maxPriceInput.value ? Number(maxPriceInput.value) : null;
    applyFilters();
  });
}

const clearFiltersBtn = document.getElementById('clearFilters');
if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener('click', () => {
    filters.search = '';
    filters.category = 'all';
    filters.color = '';
    filters.minPrice = null;
    filters.maxPrice = null;
    if (searchInput) searchInput.value = '';
    if (minPriceInput) minPriceInput.value = '';
    if (maxPriceInput) maxPriceInput.value = '';
    const colorFilter = document.getElementById('colorFilter');
    if (colorFilter) colorFilter.value = '';
    document.querySelectorAll('#categoryPills .pill').forEach((b) => {
      b.classList.toggle('active', b.dataset.id === 'all');
    });
    setMarqueeTheme('all');
    applyFilters();
  });
}

loadAll();
renderCart();

// --- Mobile nav toggle ---
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// --- Footer year ---
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// --- Newsletter form (front-end only — no backend wired up yet) ---
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const note = document.getElementById('newsletterNote');
    const email = document.getElementById('newsletterEmail').value;
    if (note) {
      note.textContent = `Thanks — we'll email ${email} when the next run drops.`;
    }
    newsletterForm.reset();
  });
}
