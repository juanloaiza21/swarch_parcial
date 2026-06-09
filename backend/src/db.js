'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH, CURRENT_USER } = require('./config');

// Make sure the directory for the SQLite file exists.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      price       REAL    NOT NULL DEFAULT 0,
      stock       INTEGER NOT NULL DEFAULT 0,
      category    TEXT    NOT NULL DEFAULT 'General',
      image_url   TEXT    NOT NULL DEFAULT '',
      owner_id    INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

// Seed exactly two products on first boot, as requested.
function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (name, description, price, stock, category, image_url, owner_id)
    VALUES (@name, @description, @price, @stock, @category, @image_url, @owner_id)
  `);

  const products = [
    {
      name: 'Aurora Wireless Headphones',
      description:
        'Immersive over-ear headphones with active noise cancellation, 40h battery life and plush memory-foam earcups. Your soundtrack, uninterrupted.',
      price: 149.99,
      stock: 24,
      category: 'Audio',
      image_url:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
      owner_id: CURRENT_USER.id,
    },
    {
      name: 'Nimbus Mechanical Keyboard',
      description:
        'A hot-swappable 75% mechanical keyboard with gasket-mounted switches, per-key RGB and a satisfying typing feel that begs you to write more.',
      price: 89.5,
      stock: 12,
      category: 'Peripherals',
      image_url:
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80',
      owner_id: CURRENT_USER.id,
    },
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(products);
}

migrate();
seed();

module.exports = db;
