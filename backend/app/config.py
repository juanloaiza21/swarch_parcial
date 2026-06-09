"""Application configuration and the hardcoded user."""
import os

# Hardcoded user baked into the app (no auth for this iteration).
CURRENT_USER = {
    "id": 1,
    "name": "Juan Loaiza",
    "email": "juan.loaiza@y.uno",
    "role": "seller",
    "avatar": "JL",
}

PORT = int(os.environ.get("PORT", "3000"))

# Single SQLite file. Lives under /data so it can be mounted as a Docker volume.
DB_PATH = os.environ.get(
    "DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "marketplace.db"),
)
