'use strict';

const db = require('./db');

const repo = {
  all({ q = '', category = '' } = {}) {
    let sql = 'SELECT * FROM products';
    const where = [];
    const params = {};

    if (q) {
      where.push('(name LIKE @q OR description LIKE @q)');
      params.q = `%${q}%`;
    }
    if (category) {
      where.push('category = @category');
      params.category = category;
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY created_at DESC, id DESC';

    return db.prepare(sql).all(params);
  },

  find(id) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  },

  categories() {
    return db
      .prepare('SELECT DISTINCT category FROM products ORDER BY category')
      .all()
      .map((r) => r.category);
  },

  create(data) {
    const info = db
      .prepare(
        `INSERT INTO products (name, description, price, stock, category, image_url, owner_id)
         VALUES (@name, @description, @price, @stock, @category, @image_url, @owner_id)`
      )
      .run(data);
    return this.find(info.lastInsertRowid);
  },

  update(id, data) {
    db.prepare(
      `UPDATE products SET
         name = @name,
         description = @description,
         price = @price,
         stock = @stock,
         category = @category,
         image_url = @image_url,
         updated_at = datetime('now')
       WHERE id = @id`
    ).run({ ...data, id });
    return this.find(id);
  },

  remove(id) {
    return db.prepare('DELETE FROM products WHERE id = ?').run(id);
  },

  stats() {
    return db
      .prepare(
        `SELECT
           COUNT(*)                        AS total,
           COALESCE(SUM(stock), 0)         AS units,
           COALESCE(SUM(price * stock), 0) AS inventoryValue
         FROM products`
      )
      .get();
  },
};

module.exports = repo;
