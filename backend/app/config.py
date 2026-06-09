"""Application configuration and the hardcoded user."""
import os
import uuid

_EMAIL = "juan.loaiza@y.uno"

# Stable UUID username derived from the email, so it stays identical across
# restarts and between the frontend and backend.
USERNAME = str(uuid.uuid5(uuid.NAMESPACE_DNS, _EMAIL))

# Hardcoded user baked into the app (no auth for this iteration).
CURRENT_USER = {
    "id": 1,
    "username": USERNAME,
    "name": "Juan Loaiza",
    "email": _EMAIL,
    "role": "seller",
    "avatar": "JL",
}

# The store / merchant the buyer pays at checkout (receiver of payments).
MERCHANT = {
    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "un_store")),
    "name": "UN Store",
}

PORT = int(os.environ.get("PORT", "3000"))

# External Payment service (un_store_back -> External Payment over HTTP/REST).
# When unset, payments are simulated so the demo flow still works end to end.
EXTERNAL_PAYMENT_URL = os.environ.get("EXTERNAL_PAYMENT_URL", "")
PAYMENT_TIMEOUT = float(os.environ.get("PAYMENT_TIMEOUT", "8"))

# Single SQLite file. Lives under /data so it can be mounted as a Docker volume.
DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "marketplace.db"),
)
