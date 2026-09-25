"""
Centralized project settings.

Loads Sentinel Hub credentials from .env and defines all
configuration constants (AOI, grid size, API endpoints, paths).

SECURITY:
    - Credentials are loaded from .env via python-dotenv.
    - CLIENT_SECRET is never printed, logged, or included in error messages.
    - Only CLIENT_ID is shown in diagnostic output (first 8 chars masked).
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# ── Locate project root and load .env ────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"

load_dotenv(dotenv_path=ENV_PATH)

# ── Sentinel Hub OAuth credentials ────────────────────────────────────
SH_CLIENT_ID: str = os.getenv("CLIENT_ID", "")
SH_CLIENT_SECRET: str = os.getenv("CLIENT_SECRET", "")


def validate_credentials() -> None:
    """
    Verify that both CLIENT_ID and CLIENT_SECRET are present and non-empty.
    Raises SystemExit with a helpful message if either is missing.
    Never prints or logs the secret value.
    """
    missing = []
    if not SH_CLIENT_ID:
        missing.append("CLIENT_ID")
    if not SH_CLIENT_SECRET:
        missing.append("CLIENT_SECRET")

    if missing:
        print(
            f"[ERROR] Missing credentials: {', '.join(missing)}\n"
            f"        Create a .env file at: {ENV_PATH}\n"
            f"        with the following variables:\n"
            f"            CLIENT_ID=<your-sentinel-hub-client-id>\n"
            f"            CLIENT_SECRET=<your-sentinel-hub-client-secret>\n"
            f"        See .env.example for reference.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Confirm loading succeeded without exposing secret
    masked_id = SH_CLIENT_ID[:8] + "..." if len(SH_CLIENT_ID) > 8 else "***"
    print(f"[OK] Credentials loaded. CLIENT_ID starts with: {masked_id}")
    print(f"[OK] CLIENT_SECRET is set ({len(SH_CLIENT_SECRET)} chars, not shown).")


# ── API endpoints ─────────────────────────────────────────────────────
SH_TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu"
    "/auth/realms/CDSE/protocol/openid-connect/token"
)
SH_PROCESS_URL = "https://sh.dataspace.copernicus.eu/process/v1"

# ── Area of Interest ──────────────────────────────────────────────────
# Nashik agricultural test AOI, Maharashtra.
# Bounding box: [west, south, east, north] in EPSG:4326
# Configurable — replace with an actual field polygon if provided later.
AOI_BBOX = [73.9300, 20.0000, 73.9400, 20.0100]

# ── Grid parameters ───────────────────────────────────────────────────
# Cell size aligned to Sentinel-2 pixel resolution.
# Set to 10 to match native 10 m bands (B04, B08).
GRID_CELL_SIZE_M = 10  # meters

# ── Sentinel-2 date range (last 30 days by default) ──────────────────
DATE_FROM = "2026-08-26"
DATE_TO = "2026-09-25"

# ── Vegetation index flag threshold ──────────────────────────────────
# Grid cells with mean NDVI below this value are flagged as
# "low_vegetation_index".  This is a simple observation flag, NOT a
# disease diagnosis.  Adjust as needed for the crop and season.
LOW_VEGETATION_NDVI_THRESHOLD = 0.2

# ── Output directory ──────────────────────────────────────────────────
OUTPUT_DIR = PROJECT_ROOT / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
