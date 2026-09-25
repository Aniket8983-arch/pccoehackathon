"""
OAuth2 client-credentials authentication for Copernicus Data Space Sentinel Hub.

Fetches and caches a Bearer token. Never logs or prints the token or secret.
"""

import time
import sys
from pathlib import Path

import requests

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import SH_CLIENT_ID, SH_CLIENT_SECRET, SH_TOKEN_URL

# ── In-memory token cache ─────────────────────────────────────────────
_cached_token: str | None = None
_token_expiry: float = 0.0


def get_access_token() -> str:
    """
    Return a valid Bearer token, refreshing if expired or not yet fetched.

    Raises SystemExit on auth failure so callers don't need to handle it.
    """
    global _cached_token, _token_expiry

    # Return cached token if still valid (with 60s safety margin)
    if _cached_token and time.time() < (_token_expiry - 60):
        return _cached_token

    if not SH_CLIENT_ID or not SH_CLIENT_SECRET:
        print("[ERROR] CLIENT_ID or CLIENT_SECRET not set. Check .env file.", file=sys.stderr)
        sys.exit(1)

    try:
        resp = requests.post(
            SH_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": SH_CLIENT_ID,
                "client_secret": SH_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
    except requests.RequestException as exc:
        print(f"[ERROR] Token request failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)

    if resp.status_code != 200:
        try:
            err = resp.json()
            msg = err.get("error_description", err.get("error", "Unknown error"))
        except (ValueError, KeyError):
            msg = f"HTTP {resp.status_code}"
        print(f"[ERROR] Authentication failed: {msg}", file=sys.stderr)
        sys.exit(1)

    data = resp.json()
    _cached_token = data["access_token"]
    _token_expiry = time.time() + data.get("expires_in", 1800)

    return _cached_token
