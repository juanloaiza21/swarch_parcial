# 🛍️ NimbusMarket

A simple marketplace, split into **two Docker images**: a backend REST API and a
frontend SPA. A single hardcoded user owns the shop, the catalog is seeded with
two products, and the whole thing runs on one SQLite file.

> Payments / checkout redirection are intentionally **not** implemented yet.

## Architecture

```
┌─────────────────────────┐        /api/*  (reverse-proxied)        ┌──────────────────────────┐
│  frontend (image 1)     │  ───────────────────────────────────▶  │  backend (image 2)       │
│  nginx + static SPA     │                                         │  Python · FastAPI        │
│  port 8080 → 80         │  ◀───────────────────────────────────  │  port 3000  · SQLite     │
└─────────────────────────┘              JSON responses             └──────────────────────────┘
                                                                              │
                                                                     marketplace.db (volume)
```

- **frontend/** — vanilla-JS single-page app (hash router, cart in `localStorage`),
  served by nginx. nginx also reverse-proxies `/api` to the backend, so the
  browser never talks to the backend directly — no CORS, no hardcoded host.
- **backend/** — FastAPI (Python) JSON API with a single SQLite database file.
  Seeds exactly two products and exposes the hardcoded user on first boot.
  Interactive API docs are available at `/docs` (Swagger UI).

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

The SQLite file is persisted in the `marketplace-data` Docker volume, so your
products survive restarts. Remove it with `docker compose down -v`.

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

## Features

- Hardcoded seller user baked into the app.
- Two seeded products on first boot, single SQLite file.
- Full product **CRUD** with server-side validation.
- Search + category filtering.
- A lightweight cart (client-side) with live badge — checkout is stubbed.
- Stock badges (low / sold out), inventory stats, flash messages.
- Responsive, modern dark UI.

## Project layout

```
.
├── backend/            # FastAPI + SQLite REST API (Docker image 1)
│   ├── app/
│   │   ├── config.py       # hardcoded user, paths
│   │   ├── database.py     # migrations, seed (2 products), repository
│   │   └── main.py         # FastAPI app + REST routes
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/           # nginx + vanilla SPA (Docker image 2)
│   ├── public/
│   │   ├── index.html
│   │   ├── css/styles.css
│   │   └── js/{api.js,app.js}
│   ├── nginx.conf          # SPA fallback + /api reverse proxy
│   └── Dockerfile
└── docker-compose.yml  # orchestrates both images
```
