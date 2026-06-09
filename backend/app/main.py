"""FastAPI marketplace REST API (mounted under /api)."""
from typing import Any

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import database as db
from .config import CURRENT_USER

app = FastAPI(title="Marketplace API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


def parse_product(body: dict[str, Any]) -> tuple[list[str], dict]:
    """Coerce + validate an incoming product payload (mirrors the API contract)."""
    body = body or {}
    errors: list[str] = []
    name = str(body.get("name") or "").strip()
    description = str(body.get("description") or "").strip()
    category = str(body.get("category") or "").strip() or "General"
    image_url = str(body.get("image_url") or "").strip()

    try:
        price = float(body.get("price"))
    except (TypeError, ValueError):
        price = float("nan")
    try:
        stock = int(float(body.get("stock")))
    except (TypeError, ValueError):
        stock = None

    if not name:
        errors.append("Name is required.")
    if price != price or price < 0:  # NaN check + negative
        errors.append("Price must be a positive number.")
    if stock is None or stock < 0:
        errors.append("Stock must be a positive whole number.")

    data = {
        "name": name,
        "description": description,
        "category": category,
        "image_url": image_url,
        "price": 0.0 if price != price else price,
        "stock": 0 if stock is None else stock,
        "owner_id": CURRENT_USER["id"],
    }
    return errors, data


router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/user")
def user() -> dict:
    return CURRENT_USER


@router.get("/categories")
def list_categories() -> list[str]:
    return db.categories()


@router.get("/stats")
def get_stats() -> dict:
    return db.stats()


@router.get("/products")
def list_products(q: str = "", category: str = "") -> list[dict]:
    return db.list_products(q=q, category=category)


@router.get("/products/{product_id}")
def get_product(product_id: int):
    product = db.find_product(product_id)
    if not product:
        return JSONResponse(status_code=404, content={"error": "Product not found."})
    return product


@router.post("/products")
async def create_product(request: Request):
    body = await _json(request)
    errors, data = parse_product(body)
    if errors:
        return JSONResponse(status_code=422, content={"errors": errors})
    return JSONResponse(status_code=201, content=db.create_product(data))


@router.put("/products/{product_id}")
async def update_product(product_id: int, request: Request):
    existing = db.find_product(product_id)
    if not existing:
        return JSONResponse(status_code=404, content={"error": "Product not found."})
    body = await _json(request)
    errors, data = parse_product(body)
    if errors:
        return JSONResponse(status_code=422, content={"errors": errors})
    return db.update_product(product_id, data)


@router.delete("/products/{product_id}")
def delete_product(product_id: int):
    existing = db.find_product(product_id)
    if not existing:
        return JSONResponse(status_code=404, content={"error": "Product not found."})
    db.delete_product(product_id)
    return {"deleted": True, "id": product_id}


async def _json(request: Request) -> dict:
    try:
        return await request.json()
    except Exception:
        return {}


app.include_router(router)


@app.get("/")
def root() -> dict:
    return {"service": "marketplace-api", "docs": "/docs", "api": "/api"}
