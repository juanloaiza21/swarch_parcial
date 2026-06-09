'use strict';

const app = document.getElementById('app');
let currentUser = null;

// ---- Helpers ------------------------------------------------------------

const money = (n) => '$' + Number(n || 0).toFixed(2);
const compact = (n) =>
  Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function flash(type, message) {
  sessionStorage.setItem('flash', JSON.stringify({ type, message }));
}

function renderFlash() {
  const host = document.getElementById('flash-host');
  const raw = sessionStorage.getItem('flash');
  sessionStorage.removeItem('flash');
  if (!raw) { host.innerHTML = ''; return; }
  const { type, message } = JSON.parse(raw);
  host.innerHTML = `<div class="flash flash-${type}" role="status">${escapeHtml(message)}</div>`;
  setTimeout(() => { host.innerHTML = ''; }, 4000);
}

function navigate(hash) {
  if (location.hash === hash) router();
  else location.hash = hash;
}

// ---- Cart (client-side, persisted in localStorage) ----------------------

const Cart = {
  read() {
    try { return JSON.parse(localStorage.getItem('cart')) || []; }
    catch { return []; }
  },
  write(items) {
    localStorage.setItem('cart', JSON.stringify(items));
    Cart.refreshBadge();
  },
  add(id) {
    const items = Cart.read();
    const line = items.find((i) => i.id === id);
    if (line) line.qty += 1;
    else items.push({ id, qty: 1 });
    Cart.write(items);
  },
  setQty(id, qty) {
    let items = Cart.read();
    if (qty <= 0) items = items.filter((i) => i.id !== id);
    else { const l = items.find((i) => i.id === id); if (l) l.qty = qty; }
    Cart.write(items);
  },
  remove(id) {
    Cart.write(Cart.read().filter((i) => i.id !== id));
  },
  count() {
    return Cart.read().reduce((n, i) => n + i.qty, 0);
  },
  refreshBadge() {
    const badge = document.getElementById('cart-badge');
    const n = Cart.count();
    badge.textContent = n;
    badge.hidden = n === 0;
  },
};

// ---- Views --------------------------------------------------------------

function spinner() {
  return '<div class="loading"><div class="spinner"></div></div>';
}

function errorView(message) {
  return `<div class="empty">
    <div class="empty-art">⚠️</div>
    <h3>Something went wrong</h3>
    <p>${escapeHtml(message)}</p>
    <a href="#/" class="btn btn-primary">Back to storefront</a>
  </div>`;
}

async function homeView(params) {
  app.innerHTML = spinner();
  const q = params.get('q') || '';
  const category = params.get('category') || '';

  try {
    const [products, categories, stats] = await Promise.all([
      API.listProducts({ q, category }),
      API.getCategories(),
      API.getStats(),
    ]);

    const firstName = (currentUser?.name || 'there').split(' ')[0];
    const catOptions = ['<option value="">All categories</option>']
      .concat(categories.map((c) =>
        `<option value="${escapeHtml(c)}" ${c === category ? 'selected' : ''}>${escapeHtml(c)}</option>`))
      .join('');

    const cards = products.length
      ? `<section class="grid">${products.map(productCard).join('')}</section>`
      : `<div class="empty">
           <div class="empty-art">🛒</div>
           <h3>No products found</h3>
           <p>${q || category ? 'Try a different search or filter.' : 'Your catalog is empty. Add your first product.'}</p>
           <a href="#/products/new" class="btn btn-primary">+ Add product</a>
         </div>`;

    app.innerHTML = `
      <section class="hero">
        <div class="hero-text">
          <p class="eyebrow">Welcome back, ${escapeHtml(firstName)} 👋</p>
          <h1>Your storefront, beautifully simple.</h1>
          <p class="hero-sub">Manage your catalog, track inventory, and keep your shop sharp.</p>
        </div>
        <div class="hero-stats">
          <div class="stat"><span class="stat-value">${stats.total}</span><span class="stat-label">Products</span></div>
          <div class="stat"><span class="stat-value">${stats.units}</span><span class="stat-label">Units in stock</span></div>
          <div class="stat"><span class="stat-value">$${compact(stats.inventoryValue)}</span><span class="stat-label">Inventory value</span></div>
        </div>
      </section>

      <section class="toolbar">
        <form class="search" id="search-form">
          <input type="search" name="q" placeholder="Search products…" value="${escapeHtml(q)}" />
          <select name="category">${catOptions}</select>
          <button type="submit" class="btn btn-ghost">Filter</button>
          ${q || category ? '<a href="#/" class="btn btn-link">Clear</a>' : ''}
        </form>
        <a href="#/products/new" class="btn btn-primary">+ Add product</a>
      </section>

      ${cards}
    `;

    document.getElementById('search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const qs = new URLSearchParams();
      if (fd.get('q')) qs.set('q', fd.get('q'));
      if (fd.get('category')) qs.set('category', fd.get('category'));
      navigate(`#/${qs.toString() ? '?' + qs : ''}`);
    });
  } catch (err) {
    app.innerHTML = errorView(err.message);
  }
}

function productCard(p) {
  const media = p.image_url
    ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
    : `<div class="card-media-fallback">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>`;
  let stockChip = '';
  if (p.stock === 0) stockChip = '<span class="chip chip-out">Sold out</span>';
  else if (p.stock <= 5) stockChip = `<span class="chip chip-low">Only ${p.stock} left</span>`;

  return `<article class="card">
    <a class="card-media" href="#/products/${p.id}">
      ${media}
      <span class="chip chip-category">${escapeHtml(p.category)}</span>
      ${stockChip}
    </a>
    <div class="card-body">
      <h3 class="card-title"><a href="#/products/${p.id}">${escapeHtml(p.name)}</a></h3>
      <p class="card-desc">${escapeHtml(p.description)}</p>
      <div class="card-footer">
        <span class="price">${money(p.price)}</span>
        <div class="card-actions">
          <a class="btn btn-icon" href="#/products/${p.id}/edit" title="Edit">✏️</a>
          <button class="btn btn-small btn-primary" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Add</button>
        </div>
      </div>
    </div>
  </article>`;
}

async function showView(id) {
  app.innerHTML = spinner();
  try {
    const p = await API.getProduct(id);
    const media = p.image_url
      ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" />`
      : `<div class="card-media-fallback large">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>`;
    const stockClass = p.stock === 0 ? 'is-out' : (p.stock <= 5 ? 'is-low' : 'is-ok');
    const stockText = p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`;

    app.innerHTML = `
      <a href="#/" class="back-link">← Back to storefront</a>
      <section class="detail">
        <div class="detail-media">${media}</div>
        <div class="detail-info">
          <span class="chip chip-category">${escapeHtml(p.category)}</span>
          <h1>${escapeHtml(p.name)}</h1>
          <p class="detail-price">${money(p.price)}</p>
          <p class="detail-stock ${stockClass}">${stockText}</p>
          <p class="detail-desc">${escapeHtml(p.description)}</p>
          <div class="detail-actions">
            <button class="btn btn-primary btn-lg" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>🛒 Add to cart</button>
            <a href="#/products/${p.id}/edit" class="btn btn-ghost btn-lg">Edit</a>
            <button class="btn btn-danger btn-lg" data-delete="${p.id}" data-name="${escapeHtml(p.name)}">Delete</button>
          </div>
          <dl class="meta">
            <div><dt>Sold by</dt><dd>${escapeHtml(currentUser?.name || '')}</dd></div>
            <div><dt>Created</dt><dd>${escapeHtml(p.created_at)}</dd></div>
            <div><dt>Updated</dt><dd>${escapeHtml(p.updated_at)}</dd></div>
          </dl>
        </div>
      </section>`;
  } catch (err) {
    app.innerHTML = errorView(err.message);
  }
}

async function formView(id) {
  app.innerHTML = spinner();
  const editing = Boolean(id);
  let product = { name: '', description: '', price: '', stock: '', category: '', image_url: '' };

  if (editing) {
    try { product = await API.getProduct(id); }
    catch (err) { app.innerHTML = errorView(err.message); return; }
  }

  app.innerHTML = `
    <a href="${editing ? '#/products/' + id : '#/'}" class="back-link">← Cancel</a>
    <section class="form-wrap">
      <h1>${editing ? 'Edit product' : 'New product'}</h1>
      <div id="form-errors"></div>
      <form id="product-form" class="form">
        <div class="field">
          <label>Name *</label>
          <input name="name" value="${escapeHtml(product.name)}" required />
        </div>
        <div class="field">
          <label>Description</label>
          <textarea name="description" rows="4">${escapeHtml(product.description)}</textarea>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Price ($) *</label>
            <input name="price" type="number" step="0.01" min="0" value="${escapeHtml(product.price)}" required />
          </div>
          <div class="field">
            <label>Stock *</label>
            <input name="stock" type="number" step="1" min="0" value="${escapeHtml(product.stock)}" required />
          </div>
          <div class="field">
            <label>Category</label>
            <input name="category" value="${escapeHtml(product.category)}" placeholder="General" />
          </div>
        </div>
        <div class="field">
          <label>Image URL</label>
          <input name="image_url" value="${escapeHtml(product.image_url)}" placeholder="https://…" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-lg">${editing ? 'Save changes' : 'Create product'}</button>
          <a href="${editing ? '#/products/' + id : '#/'}" class="btn btn-ghost btn-lg">Cancel</a>
        </div>
      </form>
    </section>`;

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    try {
      const saved = editing
        ? await API.updateProduct(id, data)
        : await API.createProduct(data);
      flash('success', `“${saved.name}” was ${editing ? 'updated' : 'created'}.`);
      navigate(`#/products/${saved.id}`);
    } catch (err) {
      const errs = err.body && err.body.errors ? err.body.errors : [err.message];
      document.getElementById('form-errors').innerHTML =
        `<div class="flash flash-error">${errs.map(escapeHtml).join('<br>')}</div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

async function cartView() {
  app.innerHTML = spinner();
  const lines = Cart.read();
  if (!lines.length) {
    app.innerHTML = `<div class="empty">
      <div class="empty-art">🛒</div>
      <h3>Your cart is empty</h3>
      <p>Browse the storefront and add something you like.</p>
      <a href="#/" class="btn btn-primary">Go shopping</a>
    </div>`;
    return;
  }

  try {
    const products = await Promise.all(lines.map((l) => API.getProduct(l.id).catch(() => null)));
    const items = lines
      .map((l, i) => products[i] ? { ...products[i], qty: l.qty } : null)
      .filter(Boolean);
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);

    const rows = items.map((i) => `
      <div class="cart-row">
        <div class="cart-thumb">${i.image_url
          ? `<img src="${escapeHtml(i.image_url)}" alt="${escapeHtml(i.name)}" />`
          : `<div class="card-media-fallback">${escapeHtml(i.name.charAt(0))}</div>`}</div>
        <div class="cart-info">
          <a href="#/products/${i.id}" class="cart-name">${escapeHtml(i.name)}</a>
          <span class="muted">${money(i.price)} each</span>
        </div>
        <div class="qty">
          <button class="btn btn-icon" data-qty="${i.id}" data-delta="-1">−</button>
          <span class="qty-value">${i.qty}</span>
          <button class="btn btn-icon" data-qty="${i.id}" data-delta="1">+</button>
        </div>
        <div class="cart-line-total">${money(i.price * i.qty)}</div>
        <button class="btn btn-icon" data-remove="${i.id}" title="Remove">🗑️</button>
      </div>`).join('');

    app.innerHTML = `
      <a href="#/" class="back-link">← Continue shopping</a>
      <h1 class="page-title">Your cart</h1>
      <section class="cart">
        ${rows}
        <div class="cart-summary">
          <span>Total</span>
          <span class="cart-total">${money(total)}</span>
        </div>
        <div class="cart-checkout">
          <button class="btn btn-primary btn-lg" id="checkout-btn">Pay ${money(total)}</button>
          <span class="muted" id="checkout-note">Pays the store via the External Payment service.</span>
        </div>
      </section>`;

    document.getElementById('checkout-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const note = document.getElementById('checkout-note');
      btn.disabled = true;
      btn.textContent = 'Processing…';
      try {
        const store = await API.getStore();
        const payment = await API.createPayment({
          sender_id: currentUser?.username || String(currentUser?.id || ''),
          receiver_id: store.id,
          amount: Number(total.toFixed(2)),
        });
        Cart.write([]); // empty the cart on success
        renderReceipt(payment, store);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = `Pay ${money(total)}`;
        note.innerHTML = `<span class="pay-error">Payment failed: ${escapeHtml(err.message)}</span>`;
      }
    });
  } catch (err) {
    app.innerHTML = errorView(err.message);
  }
}

function renderReceipt(payment, store) {
  const ok = ['approved', 'succeeded', 'paid', 'completed'].includes(payment.status);
  app.innerHTML = `
    <section class="receipt">
      <div class="receipt-icon ${ok ? 'ok' : 'fail'}">${ok ? '✓' : '✕'}</div>
      <h1>${ok ? 'Payment ' + payment.status : 'Payment ' + payment.status}</h1>
      <p class="muted">${ok ? 'Thanks! Your order is confirmed.' : escapeHtml(payment.detail || 'The payment was not completed.')}</p>
      <dl class="receipt-grid">
        <div><dt>Reference</dt><dd>${escapeHtml(payment.reference)}</dd></div>
        <div><dt>Amount</dt><dd>${money(payment.amount)}</dd></div>
        <div><dt>Status</dt><dd class="status-${ok ? 'ok' : 'fail'}">${escapeHtml(payment.status)}</dd></div>
        <div><dt>Provider</dt><dd>${escapeHtml(payment.provider)}</dd></div>
        <div><dt>From (sender_id)</dt><dd class="mono">${escapeHtml(payment.sender_id)}</dd></div>
        <div><dt>To (receiver_id)</dt><dd class="mono">${escapeHtml(payment.receiver_id)} · ${escapeHtml(store?.name || '')}</dd></div>
      </dl>
      <a href="#/" class="btn btn-primary btn-lg">Back to storefront</a>
    </section>`;
  Cart.refreshBadge();
}

// ---- Global click handling (event delegation) ---------------------------

document.addEventListener('click', async (e) => {
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) {
    Cart.add(Number(addBtn.dataset.add));
    flash('success', 'Added to your cart.');
    renderFlash();
    return;
  }

  const delBtn = e.target.closest('[data-delete]');
  if (delBtn) {
    const name = delBtn.dataset.name;
    if (!confirm(`Delete “${name}”? This cannot be undone.`)) return;
    try {
      await API.deleteProduct(delBtn.dataset.delete);
      Cart.remove(Number(delBtn.dataset.delete));
      flash('success', `“${name}” was deleted.`);
      navigate('#/');
    } catch (err) {
      flash('error', err.message);
      renderFlash();
    }
    return;
  }

  const qtyBtn = e.target.closest('[data-qty]');
  if (qtyBtn) {
    const id = Number(qtyBtn.dataset.qty);
    const delta = Number(qtyBtn.dataset.delta);
    const line = Cart.read().find((i) => i.id === id);
    Cart.setQty(id, (line ? line.qty : 0) + delta);
    cartView();
    return;
  }

  const rmBtn = e.target.closest('[data-remove]');
  if (rmBtn) {
    Cart.remove(Number(rmBtn.dataset.remove));
    cartView();
    return;
  }
});

// ---- Router -------------------------------------------------------------

function router() {
  renderFlash();
  Cart.refreshBadge();

  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, queryStr] = raw.split('?');
  const params = new URLSearchParams(queryStr || '');

  const parts = path.split('/').filter(Boolean); // e.g. ['products','5','edit']

  if (parts.length === 0) return homeView(params);
  if (parts[0] === 'products') {
    if (parts[1] === 'new') return formView(null);
    if (parts[1] && parts[2] === 'edit') return formView(parts[1]);
    if (parts[1]) return showView(parts[1]);
  }
  if (parts[0] === 'cart') return cartView();

  app.innerHTML = errorView('Page not found.');
}

// ---- Bootstrap ----------------------------------------------------------

async function boot() {
  try {
    currentUser = await API.getUser();
    const shortId = (currentUser.username || '').split('-')[0];
    document.getElementById('user-name').textContent = currentUser.name;
    document.getElementById('user-id').textContent = currentUser.username ? `#${shortId}` : currentUser.role;
    document.getElementById('user-avatar').textContent = currentUser.avatar;
    document.getElementById('user-chip').title =
      `${currentUser.name} · ${currentUser.role}\n${currentUser.username || ''}\n${currentUser.email}`;
    document.getElementById('footer-user').textContent =
      `Signed in as ${currentUser.name} (${currentUser.username || currentUser.id}) · FastAPI · SQLite`;
  } catch (_) {
    document.getElementById('user-name').textContent = 'Offline';
  }
  Cart.refreshBadge();
  router();
}

window.addEventListener('hashchange', router);
boot();
