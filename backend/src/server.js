'use strict';

const express = require('express');
const cors = require('cors');

const { PORT, CURRENT_USER } = require('./config');
const repo = require('./repository');

const app = express();
app.use(cors());
app.use(express.json());

// Tiny request logger.
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Coerce + validate incoming product payloads.
function parseProduct(body = {}) {
  const errors = [];
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || '').trim() || 'General';
  const image_url = String(body.image_url || '').trim();
  const price = Number.parseFloat(body.price);
  const stock = Number.parseInt(body.stock, 10);

  if (!name) errors.push('Name is required.');
  if (Number.isNaN(price) || price < 0) errors.push('Price must be a positive number.');
  if (Number.isNaN(stock) || stock < 0) errors.push('Stock must be a positive whole number.');

  return {
    errors,
    data: {
      name,
      description,
      category,
      image_url,
      price: Number.isNaN(price) ? 0 : price,
      stock: Number.isNaN(stock) ? 0 : stock,
      owner_id: CURRENT_USER.id,
    },
  };
}

const router = express.Router();

// Health check (handy for Docker).
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Hardcoded current user.
router.get('/user', (_req, res) => res.json(CURRENT_USER));

// Catalog meta.
router.get('/categories', (_req, res) => res.json(repo.categories()));
router.get('/stats', (_req, res) => res.json(repo.stats()));

// List with optional search + category filter.
router.get('/products', (req, res) => {
  const { q = '', category = '' } = req.query;
  res.json(repo.all({ q, category }));
});

// Read one.
router.get('/products/:id', (req, res) => {
  const product = repo.find(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
});

// Create.
router.post('/products', (req, res) => {
  const { errors, data } = parseProduct(req.body);
  if (errors.length) return res.status(422).json({ errors });
  res.status(201).json(repo.create(data));
});

// Update.
router.put('/products/:id', (req, res) => {
  const existing = repo.find(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const { errors, data } = parseProduct(req.body);
  if (errors.length) return res.status(422).json({ errors });
  res.json(repo.update(existing.id, data));
});

// Delete.
router.delete('/products/:id', (req, res) => {
  const existing = repo.find(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  repo.remove(existing.id);
  res.json({ deleted: true, id: existing.id });
});

app.use('/api', router);

// 404 fallback for unknown API routes.
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(`🛍️  Marketplace API running on http://localhost:${PORT}/api`);
});
