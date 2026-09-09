let PRODUCTS = [];

async function loadProducts() {
  try {
    const res = await fetch('products.json');
    const data = await res.json();
    PRODUCTS = data.products || [];
    renderProducts();
    renderMarquee();
    setupScrollReveal();
  } catch (e) {
    console.error('Could not load products', e);
    document.getElementById('productGrid').innerHTML =
      '<p style="padding:24px;color:#6B7280;">Could not load the shop right now. Please refresh.</p>';
  }
}

function renderMarquee() {
  const track = document.getElementById('marqueeTrack');
  if (!track || PRODUCTS.length === 0) return;
  // Duplicate the list once so translateX(-50%) loops seamlessly with no visible seam.
  const doubled = [...PRODUCTS, ...PRODUCTS];
  track.innerHTML = doubled.map((p) => `
    <div class="marquee-item">
      <div class="frame">
        <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">
      </div>
      <div class="name">${escapeHtml(p.name)}</div>
    </div>
  `).join('');
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

function renderProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = PRODUCTS.map((p) => {
    const outOfStock = p.stock <= 0;
    const lowStock = p.stock > 0 && p.stock <= 3;
    return `
      <div class="product-card">
        <div class="swatch-frame">
          <img src="${p.image}" alt="${escapeHtml(p.name)} shirt swatch" loading="lazy">
        </div>
        <h3>${escapeHtml(p.name)}</h3>
        <p class="personality">${escapeHtml(p.personality)}</p>
        <p class="desc">${escapeHtml(p.description)}</p>
        <p class="fabric">${escapeHtml(p.fabric)}</p>
        <div class="price-row">
          <span class="price">$${p.price}</span>
          <span class="stock-note ${lowStock ? 'low' : ''}">
            ${outOfStock ? 'Sold out' : lowStock ? `Only ${p.stock} left` : `${p.stock} in stock`}
          </span>
        </div>
        <button class="add-btn" data-id="${p.id}" ${outOfStock ? 'disabled' : ''}>
          ${outOfStock ? 'Sold out' : 'Add to cart'}
        </button>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = PRODUCTS.find((p) => p.id === btn.dataset.id);
      if (product) {
        Cart.addItem(product);
        openCart();
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

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
          <div class="name">${escapeHtml(i.name)}</div>
          <div class="meta">
            <button class="qty-btn" data-id="${i.id}" data-delta="-1">-</button>
            <span>${i.qty}</span>
            <button class="qty-btn" data-id="${i.id}" data-delta="1">+</button>
            <span>$${i.price * i.qty}</span>
          </div>
          <button class="remove-link" data-id="${i.id}">Remove</button>
        </div>
      </div>
    `).join('');
  }

  cartTotalEl.textContent = `$${Cart.getTotal()}`;

  cartItemsEl.querySelectorAll('.qty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const items = Cart.getItems();
      const item = items.find((i) => i.id === btn.dataset.id);
      if (item) {
        Cart.setQty(item.id, item.qty + Number(btn.dataset.delta));
      }
    });
  });

  cartItemsEl.querySelectorAll('.remove-link').forEach((btn) => {
    btn.addEventListener('click', () => Cart.removeItem(btn.dataset.id));
  });
}

Cart.onChange(renderCart);

checkoutBtn.addEventListener('click', async () => {
  const items = Cart.getItems();
  if (items.length === 0) return;

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Redirecting…';

  try {
    // Calls the Netlify serverless function which creates a Stripe Checkout Session.
    // See netlify/functions/create-checkout-session.js
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

loadProducts();
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
