"""
Test Copernicus Data Space OAuth2 client-credentials authentication.

Usage:
    python scripts/01_auth_test.py

Prints HTTP status, success/failure, and token expiry duration.
Never prints the access token or client secret.
"""

import sys
from pathlib import Path

import requests

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import SH_CLIENT_ID, SH_CLIENT_SECRET, SH_TOKEN_URL, validate_credentials


def test_auth() -> None:
    """Attempt OAuth2 client-credentials grant and report the result."""

    # Verify credentials are loaded from .env
    validate_credentials()
    print()

    print(f"[INFO] Token endpoint: {SH_TOKEN_URL}")
    print("[INFO] Requesting token with grant_type=client_credentials ...")
    print()

    try:
        response = requests.post(
            SH_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": SH_CLIENT_ID,
                "client_secret": SH_CLIENT_SECRET,
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        # Network-level failure (DNS, timeout, connection refused)
        print(f"[FAIL] Request failed: {type(exc).__name__}: {exc}")
        sys.exit(1)

    print(f"  HTTP Status : {response.status_code}")

    if response.status_code == 200:
        data = response.json()

        expires_in = data.get("expires_in", "unknown")
        token_type = data.get("token_type", "unknown")
        scope = data.get("scope", "unknown")

        print(f"  Token Type  : {token_type}")
        print(f"  Expires In  : {expires_in} seconds")
        print(f"  Scope       : {scope}")
        print()
        print("[PASS] Authentication succeeded.")
    else:
        # Auth failure — print status and sanitized error, never the raw body
        # which could echo back credentials in some OAuth implementations
        try:
            error_data = response.json()
            error_code = error_data.get("error", "unknown_error")
            error_desc = error_data.get("error_description", "No description provided.")
        except (ValueError, KeyError):
            error_code = "parse_error"
            error_desc = "Could not parse error response."

        print(f"  Error       : {error_code}")
        print(f"  Description : {error_desc}")
        print()
        print("[FAIL] Authentication failed.")
        sys.exit(1)


if __name__ == "__main__":
    test_auth()
