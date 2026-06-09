"""Application configuration and the hardcoded user."""
import os
import uuid

_EMAIL = "juan.loaiza@y.uno"

# Human-readable username/handle. This is what we send to the payment
# processor as sender_id (NOT the UUID).
USERNAME = _EMAIL.split("@")[0]  # "juan.loaiza"

# Stable UUID identifier derived from the email, identical across restarts
# and between the frontend and backend.
USER_UUID = str(uuid.uuid5(uuid.NAMESPACE_DNS, _EMAIL))

# Hardcoded user baked into the app (no auth for this iteration).
CURRENT_USER = {
    "id": 1,
    "uuid": USER_UUID,
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

# Payment broker (un_store_back -> broker /queue over HTTP/REST).
# The shop POSTs {sender_id, receiver_id, amount} to the broker, which queues
# it; the pasarela later forwards it to the bank. Point this at the broker's
# /queue endpoint, e.g. http://<broker-ip>:8001/queue.
# When unset, payments are simulated so the demo flow still works end to end.
BROKER_URL = os.environ.get("BROKER_URL", os.environ.get("EXTERNAL_PAYMENT_URL", ""))
PAYMENT_TIMEOUT = float(os.environ.get("PAYMENT_TIMEOUT", "8"))

# Single SQLite file. Lives under /data so it can be mounted as a Docker volume.
DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "marketplace.db"),
)
