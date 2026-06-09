# 🛍️ NimbusMarket / UN Store

A simple marketplace, split into **two Docker images** (`un_store_front` +
`un_store_back`) backed by a single SQLite database (`un_store_db`). A hardcoded
user (with a UUID username) owns the shop, the catalog is seeded with two
products, and checkout pays a store via an **External Payment** service.

## Architecture

```
   Web Browser
        │ HTTP
        ▼
┌──────────────────┐   HTTP/REST    ┌──────────────────┐   DB Connector   ┌──────────────┐
│  un_store_front  │ ─────────────▶ │  un_store_back   │ ───────────────▶ │  un_store_db │
│  nginx + SPA     │ ◀───────────── │  FastAPI (Py)    │                  │  SQLite vol  │
│  :8080 → 80      │   JSON          │  :3000           │                  └──────────────┘
└──────────────────┘                └───────┬──────────┘
                                            │ HTTP/REST  POST {sender_id, receiver_id, amount}
                                            ▼
                                   ┌──────────────────┐
                                   │ External Payment │  (configurable; simulated if unset)
                                   └──────────────────┘
```

- **frontend/** (`un_store_front`) — vanilla-JS single-page app (hash router,
  cart in `localStorage`), served by nginx. nginx reverse-proxies `/api` to the
  backend, so the browser never talks to the backend directly — no CORS, no
  hardcoded host.
- **backend/** (`un_store_back`) — FastAPI (Python) JSON API over a single SQLite
  file. Seeds two products and the hardcoded UUID user, and forwards checkout
  payments to the External Payment service over HTTP/REST. Swagger UI at `/docs`.

## Run it (Docker, recommended)

```bash
docker compose up --build
```

Then open **http://localhost:8080**.

| Service  | URL                              |
|----------|----------------------------------|
| Frontend | http://localhost:8080            |
| API      | http://localhost:3000/api        |
| Health   | http://localhost:3000/api/health |

The SQLite file is persisted in the `un_store_db` Docker volume, so your
products survive restarts. Remove it with `docker compose down -v`.

### Connecting a real External Payment service

By default, payments are **simulated** (approved locally) so the flow works out
of the box. To send payments to a real provider, set `EXTERNAL_PAYMENT_URL` —
`un_store_back` will `POST { sender_id, receiver_id, amount }` to it:

```bash
EXTERNAL_PAYMENT_URL=https://payments.example.com/charge docker compose up --build
```

## Run locally (no Docker)

```bash
# Terminal 1 — backend API on :3000
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 3000

# Terminal 2 — serve the frontend however you like, e.g.
cd frontend/public && python3 -m http.server 8080
```

When running the frontend without nginx you'll need to proxy `/api` to
`localhost:3000` yourself (or run the full Docker setup, which handles it).

## API

| Method | Path                  | Description                          |
|--------|-----------------------|--------------------------------------|
| GET    | `/api/health`         | Health check                         |
| GET    | `/api/user`           | The hardcoded current user           |
| GET    | `/api/products`       | List products (`?q=`, `?category=`)  |
| GET    | `/api/products/:id`   | Get one product                      |
| POST   | `/api/products`       | Create a product                     |
| PUT    | `/api/products/:id`   | Update a product                     |
| DELETE | `/api/products/:id`   | Delete a product                     |
| GET    | `/api/categories`     | Distinct categories                  |
| GET    | `/api/stats`          | Catalog stats (totals, value)        |
| GET    | `/api/store`          | The store/merchant (payment receiver)|
| GET    | `/api/payments`       | Payment/transaction history          |
| POST   | `/api/payments`       | Pay: `{ sender_id, receiver_id, amount }` → External Payment |

### `POST /api/payments`

```jsonc
// request
{ "sender_id": "<buyer uuid>", "receiver_id": "<store uuid>", "amount": 239.49 }
// response (201 approved / 402 declined)
{ "id": 1, "reference": "EXT-1A2B3C", "sender_id": "...", "receiver_id": "...",
  "amount": 239.49, "status": "approved", "provider": "external", "created_at": "..." }
```

`receiver_id` is optional and defaults to the store. The request is forwarded to
the External Payment service and the transaction is recorded in SQLite.

## Features

- Hardcoded seller user (UUID username) baked into the app.
- Two seeded products on first boot, single SQLite file.
- Full product **CRUD** with server-side validation.
- Search + category filtering.
- A lightweight cart (client-side) with live badge.
- **Checkout → External Payment** over HTTP/REST, with a receipt + history.
- Stock badges (low / sold out), inventory stats, flash messages.
- Responsive, modern dark UI.

## Project layout

```
.
├── backend/            # un_store_back — FastAPI + SQLite REST API
│   ├── app/
│   │   ├── config.py       # hardcoded user (UUID), merchant, payment config
│   │   ├── database.py     # migrations, seed (2 products), products + payments
│   │   └── main.py         # FastAPI app, REST routes, External Payment forwarder
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/           # un_store_front — nginx + vanilla SPA
│   ├── public/
│   │   ├── index.html
│   │   ├── css/styles.css
│   │   └── js/{api.js,app.js}
│   ├── nginx.conf          # SPA fallback + /api reverse proxy → un_store_back
│   └── Dockerfile
└── docker-compose.yml  # orchestrates both images + un_store_db volume
```
