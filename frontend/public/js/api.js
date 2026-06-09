'use strict';

// All requests are relative — nginx proxies /api to the backend container,
// so there is no CORS dance and no hardcoded backend host in the browser.
const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && (body.error || (body.errors && body.errors.join(' ')))) ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

const API = {
  getUser: () => request('/user'),
  getStats: () => request('/stats'),
  getCategories: () => request('/categories'),
  listProducts: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category) qs.set('category', params.category);
    const suffix = qs.toString() ? `?${qs}` : '';
    return request(`/products${suffix}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) =>
    request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  getStore: () => request('/store'),
  createPayment: (data) => request('/payments', { method: 'POST', body: JSON.stringify(data) }),
};

window.API = API;
