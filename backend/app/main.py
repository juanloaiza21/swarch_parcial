"""FastAPI marketplace REST API (mounted under /api)."""
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import database as db
from .config import (
    CURRENT_USER,
    EXTERNAL_PAYMENT_URL,
    MERCHANT,
    PAYMENT_TIMEOUT,
)

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


def parse_payment(body: dict[str, Any]) -> tuple[list[str], dict]:
    """Validate a payment payload: sender_id, receiver_id, amount."""
    body = body or {}
    errors: list[str] = []
    sender_id = str(body.get("sender_id") or "").strip()
    # receiver_id defaults to the store/merchant when not supplied.
    receiver_id = str(body.get("receiver_id") or MERCHANT["id"]).strip()

    try:
        amount = float(body.get("amount"))
    except (TypeError, ValueError):
        amount = float("nan")

    if not sender_id:
        errors.append("sender_id is required.")
    if not receiver_id:
        errors.append("receiver_id is required.")
    if amount != amount or amount <= 0:  # NaN or non-positive
        errors.append("amount must be a positive number.")

    data = {
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "amount": 0.0 if amount != amount else round(amount, 2),
    }
    return errors, data


async def forward_to_external(payload: dict) -> dict:
    """POST the payment to the External Payment service over HTTP/REST.

    Falls back to a simulated approval when no provider URL is configured,
    so the end-to-end flow works without an external dependency.
    """
    reference = uuid.uuid4().hex[:12].upper()

    if not EXTERNAL_PAYMENT_URL:
        return {
            "status": "approved",
            "provider": "simulated",
            "reference": reference,
            "detail": "Simulated payment (no EXTERNAL_PAYMENT_URL configured).",
        }

    try:
        async with httpx.AsyncClient(timeout=PAYMENT_TIMEOUT) as client:
            resp = await client.post(EXTERNAL_PAYMENT_URL, json=payload)
            resp.raise_for_status()
            body = resp.json() if resp.content else {}
        return {
            "status": body.get("status", "approved"),
            "provider": "external",
            "reference": str(body.get("reference") or body.get("id") or reference),
            "detail": body.get("message", "Processed by external payment provider."),
        }
    except Exception as exc:  # network/HTTP errors -> declined, recorded for audit
        return {
            "status": "failed",
            "provider": "external",
            "reference": reference,
            "detail": f"External payment error: {exc}",
        }


router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/user")
def user() -> dict:
    return CURRENT_USER


@router.get("/store")
def store() -> dict:
    return MERCHANT


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


# ---- Payments (un_store_back -> External Payment) -----------------------

@router.get("/payments")
def list_payments() -> list[dict]:
    return db.list_payments()


@router.post("/payments")
async def create_payment(request: Request):
    body = await _json(request)
    errors, data = parse_payment(body)
    if errors:
        return JSONResponse(status_code=422, content={"errors": errors})

    result = await forward_to_external(data)
    record = db.create_payment(
        {
            "reference": result["reference"],
            "sender_id": data["sender_id"],
            "receiver_id": data["receiver_id"],
            "amount": data["amount"],
            "status": result["status"],
            "provider": result["provider"],
            "detail": result.get("detail", ""),
        }
    )

    ok = result["status"] in ("approved", "succeeded", "paid", "completed")
    return JSONResponse(status_code=201 if ok else 402, content=record)


async def _json(request: Request) -> dict:
    try:
        return await request.json()
    except Exception:
        return {}


app.include_router(router)


@app.get("/")
def root() -> dict:
    return {"service": "marketplace-api", "docs": "/docs", "api": "/api"}
