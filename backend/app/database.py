"""SQLite access layer: connection, migrations, seed and product repository."""
import os
import sqlite3
from contextlib import contextmanager

from .config import CURRENT_USER, DB_PATH


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def migrate() -> None:
    with get_conn() as conn:
        conn.execute(
            """
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
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS payments (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                reference   TEXT    NOT NULL,
                sender_id   TEXT    NOT NULL,
                receiver_id TEXT    NOT NULL,
                amount      REAL    NOT NULL,
                status      TEXT    NOT NULL DEFAULT 'pending',
                provider    TEXT    NOT NULL DEFAULT '',
                detail      TEXT    NOT NULL DEFAULT '',
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            """
        )


def seed() -> None:
    """Seed exactly two products on first boot, as requested."""
    with get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) AS n FROM products").fetchone()["n"]
        if count:
            return
        products = [
            {
                "name": "Aurora Wireless Headphones",
                "description": (
                    "Immersive over-ear headphones with active noise cancellation, "
                    "40h battery life and plush memory-foam earcups. Your soundtrack, "
                    "uninterrupted."
                ),
                "price": 149.99,
                "stock": 24,
                "category": "Audio",
                "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
                "owner_id": CURRENT_USER["id"],
            },
            {
                "name": "Nimbus Mechanical Keyboard",
                "description": (
                    "A hot-swappable 75% mechanical keyboard with gasket-mounted switches, "
                    "per-key RGB and a satisfying typing feel that begs you to write more."
                ),
                "price": 89.5,
                "stock": 12,
                "category": "Peripherals",
                "image_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
                "owner_id": CURRENT_USER["id"],
            },
        ]
        conn.executemany(
            """
            INSERT INTO products (name, description, price, stock, category, image_url, owner_id)
            VALUES (:name, :description, :price, :stock, :category, :image_url, :owner_id)
            """,
            products,
        )


def init_db() -> None:
    migrate()
    seed()


# ---- Repository ---------------------------------------------------------

def list_products(q: str = "", category: str = "") -> list[dict]:
    sql = "SELECT * FROM products"
    where, params = [], {}
    if q:
        where.append("(name LIKE :q OR description LIKE :q)")
        params["q"] = f"%{q}%"
    if category:
        where.append("category = :category")
        params["category"] = category
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at DESC, id DESC"
    with get_conn() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def find_product(product_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM products WHERE id = ?", (product_id,)
        ).fetchone()
        return dict(row) if row else None


def categories() -> list[str]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT category FROM products ORDER BY category"
        ).fetchall()
        return [r["category"] for r in rows]


def create_product(data: dict) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO products (name, description, price, stock, category, image_url, owner_id)
            VALUES (:name, :description, :price, :stock, :category, :image_url, :owner_id)
            """,
            data,
        )
        new_id = cur.lastrowid
    return find_product(new_id)


def update_product(product_id: int, data: dict) -> dict:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE products SET
                name = :name,
                description = :description,
                price = :price,
                stock = :stock,
                category = :category,
                image_url = :image_url,
                updated_at = datetime('now')
            WHERE id = :id
            """,
            {**data, "id": product_id},
        )
    return find_product(product_id)


def delete_product(product_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM products WHERE id = ?", (product_id,))


def stats() -> dict:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*)                         AS total,
                COALESCE(SUM(stock), 0)          AS units,
                COALESCE(SUM(price * stock), 0)  AS inventoryValue
            FROM products
            """
        ).fetchone()
        return dict(row)


# ---- Payments -----------------------------------------------------------

def create_payment(data: dict) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO payments (reference, sender_id, receiver_id, amount, status, provider, detail)
            VALUES (:reference, :sender_id, :receiver_id, :amount, :status, :provider, :detail)
            """,
            data,
        )
        new_id = cur.lastrowid
        row = conn.execute("SELECT * FROM payments WHERE id = ?", (new_id,)).fetchone()
        return dict(row)


def list_payments() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM payments ORDER BY created_at DESC, id DESC"
        ).fetchall()
        return [dict(r) for r in rows]
