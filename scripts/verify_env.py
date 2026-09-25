"""
Verify that .env credentials load correctly without exposing secrets.

Usage:
    python scripts/verify_env.py

Expected output on success:
    [OK] Credentials loaded. CLIENT_ID starts with: xxxxxxxx...
    [OK] CLIENT_SECRET is set (N chars, not shown).
    [OK] .env is listed in .gitignore.
    [PASS] Environment configuration is ready.

Expected output on failure:
    [ERROR] Missing credentials: CLIENT_ID, CLIENT_SECRET
"""

import sys
from pathlib import Path

# Ensure project root is on sys.path so config can be imported
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import (
    validate_credentials,
    SH_CLIENT_ID,
    SH_CLIENT_SECRET,
    SH_TOKEN_URL,
    SH_PROCESS_URL,
    AOI_BBOX,
    ENV_PATH,
    PROJECT_ROOT as PROJ_ROOT,
)


def check_gitignore() -> bool:
    """Verify .env is listed in .gitignore to prevent accidental commits."""
    gitignore_path = PROJ_ROOT / ".gitignore"
    if not gitignore_path.exists():
        print("[WARN] .gitignore not found!", file=sys.stderr)
        return False

    content = gitignore_path.read_text()
    if ".env" in content:
        print("[OK] .env is listed in .gitignore.")
        return True
    else:
        print("[WARN] .env is NOT listed in .gitignore — credentials may be committed!", file=sys.stderr)
        return False


def check_no_secret_leak() -> None:
    """
    Sanity check: verify that the secret is not accidentally embedded
    in the settings module source code.
    """
    settings_path = PROJ_ROOT / "config" / "settings.py"
    source = settings_path.read_text()

    # The secret should never appear as a literal in the source
    if SH_CLIENT_SECRET and SH_CLIENT_SECRET in source:
        print("[FAIL] CLIENT_SECRET found hardcoded in settings.py!", file=sys.stderr)
        sys.exit(1)

    print("[OK] No hardcoded secrets detected in settings.py.")


def main() -> None:
    print("=" * 56)
    print("  Environment & Credentials Verification")
    print("=" * 56)
    print()
    print(f"  .env path : {ENV_PATH}")
    print(f"  .env exists: {ENV_PATH.exists()}")
    print()

    # 1. Validate credentials load from .env
    validate_credentials()

    # 2. Confirm .gitignore protects .env
    check_gitignore()

    # 3. Confirm no hardcoded secrets
    check_no_secret_leak()

    # 4. Show non-secret config values
    print()
    print(f"[INFO] Token URL  : {SH_TOKEN_URL}")
    print(f"[INFO] Process URL: {SH_PROCESS_URL}")
    print(f"[INFO] AOI bbox   : {AOI_BBOX}")
    print()
    print("[PASS] Environment configuration is ready.")


if __name__ == "__main__":
    main()
