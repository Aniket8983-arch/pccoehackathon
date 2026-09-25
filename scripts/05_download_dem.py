"""
Download Copernicus DEM elevation data via Sentinel Hub Processing API.

Usage:
    python scripts/05_download_dem.py

Attempts COPERNICUS_30 (30 m) first. If access is denied, falls back to
COPERNICUS_90 (90 m) and records the fallback in metadata.

Output:
    data/raw/dem.tif                  (Float32 GeoTIFF, elevation in meters)
    data/processed/dem_metadata.json  (DEM source, stats, AOI info)

All elevation values come from the real Copernicus DEM — nothing fabricated.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import requests
from pyproj import Transformer

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import AOI_BBOX, SH_PROCESS_URL
from src.auth import get_access_token

# ── Paths ─────────────────────────────────────────────────────────────
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
DEM_PATH = RAW_DIR / "dem.tif"
DEM_META_PATH = PROCESSED_DIR / "dem_metadata.json"

# ── DEM evalscript ────────────────────────────────────────────────────
# Returns raw elevation in meters as FLOAT32.
# dataMask marks pixels outside the DEM coverage as nodata (-9999).
EVALSCRIPT_DEM = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["DEM", "dataMask"] }],
    output: { bands: 1, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [-9999.0];
  return [sample.DEM];
}
"""

# DEM instances to try, in priority order
DEM_INSTANCES = ["COPERNICUS_30", "COPERNICUS_90"]


# ── UTM helpers (same logic as 03_download_sentinel.py) ───────────────

def compute_utm_params(bbox_4326: list, resolution_m: float) -> dict:
    """Convert EPSG:4326 bbox to UTM, compute pixel dims at given resolution."""
    west, south, east, north = bbox_4326
    center_lon = (west + east) / 2
    center_lat = (south + north) / 2

    utm_zone = int((center_lon + 180) / 6) + 1
    epsg = 32600 + utm_zone if center_lat >= 0 else 32700 + utm_zone

    t = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    x_min, y_min = t.transform(west, south)
    x_max, y_max = t.transform(east, north)

    width_px = int(round((x_max - x_min) / resolution_m))
    height_px = int(round((y_max - y_min) / resolution_m))

    return {
        "bbox": [x_min, y_min, x_max, y_max],
        "epsg": epsg,
        "crs_url": f"http://www.opengis.net/def/crs/EPSG/0/{epsg}",
        "width_px": width_px,
        "height_px": height_px,
        "res_m": resolution_m,
    }


# ── Download logic ────────────────────────────────────────────────────

def attempt_dem_download(
    token: str,
    dem_instance: str,
    utm: dict,
) -> tuple[bool, bytes | None, str | None]:
    """
    Try downloading DEM for the given instance.
    Returns (success, response_bytes_or_None, error_message_or_None).
    """
    body = {
        "input": {
            "bounds": {
                "bbox": utm["bbox"],
                "properties": {"crs": utm["crs_url"]},
            },
            "data": [
                {
                    "type": "dem",
                    "dataFilter": {
                        "demInstance": dem_instance,
                    },
                }
            ],
        },
        "output": {
            "width": utm["width_px"],
            "height": utm["height_px"],
            "responses": [
                {
                    "identifier": "default",
                    "format": {"type": "image/tiff"},
                }
            ],
        },
        "evalscript": EVALSCRIPT_DEM,
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "image/tiff",
    }

    print(f"  Requesting DEM ({dem_instance}) ...")
    print(f"  Size: {utm['width_px']}x{utm['height_px']} px @ {utm['res_m']} m")

    try:
        resp = requests.post(SH_PROCESS_URL, json=body, headers=headers, timeout=120)
    except requests.RequestException as exc:
        return False, None, f"Network error: {exc}"

    if resp.status_code == 200:
        return True, resp.content, None

    # Extract error details
    try:
        err = resp.json()
        err_msg = json.dumps(err, indent=2)[:600]
    except (ValueError, KeyError):
        err_msg = resp.text[:600]

    return False, None, f"HTTP {resp.status_code}: {err_msg}"


def verify_dem(path: Path) -> dict:
    """Read the DEM GeoTIFF and return stats. Returns empty dict on failure."""
    import rasterio

    try:
        with rasterio.open(path) as ds:
            data = ds.read(1).astype(np.float32)
            crs = str(ds.crs)
            transform = str(ds.transform)
            shape = ds.shape

            valid_mask = (data != -9999.0) & np.isfinite(data)
            valid = data[valid_mask]

            if len(valid) == 0:
                print("  [ERROR] No valid elevation pixels!", file=sys.stderr)
                return {}

            stats = {
                "crs": crs,
                "transform": transform,
                "shape_hw": list(shape),
                "dtype": str(ds.dtypes[0]),
                "total_pixels": int(data.size),
                "valid_pixels": int(len(valid)),
                "valid_pct": round(100 * len(valid) / data.size, 2),
                "elevation_min_m": round(float(np.min(valid)), 2),
                "elevation_max_m": round(float(np.max(valid)), 2),
                "elevation_mean_m": round(float(np.mean(valid)), 2),
                "elevation_median_m": round(float(np.median(valid)), 2),
                "elevation_std_m": round(float(np.std(valid)), 2),
            }

            print(f"  CRS       : {crs}")
            print(f"  Shape     : {shape[0]}h x {shape[1]}w")
            print(f"  Dtype     : {ds.dtypes[0]}")
            print(f"  Valid px  : {len(valid):,} / {data.size:,} ({stats['valid_pct']}%)")
            print(f"  Elev min  : {stats['elevation_min_m']} m")
            print(f"  Elev max  : {stats['elevation_max_m']} m")
            print(f"  Elev mean : {stats['elevation_mean_m']} m")
            print(f"  Elev std  : {stats['elevation_std_m']} m")
            return stats

    except Exception as exc:
        print(f"  [ERROR] Failed to read DEM: {exc}", file=sys.stderr)
        return {}


# ── Main ──────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("  Copernicus DEM Download")
    print("=" * 60)
    print()

    # Step 1: Auth
    print("[STEP 1] Authenticating ...")
    token = get_access_token()
    print("  [OK] Token acquired.")
    print()

    # Step 2: Compute UTM grid
    print("[STEP 2] Computing UTM projection ...")
    print(f"  AOI (EPSG:4326): {AOI_BBOX}")

    # Try each DEM instance in priority order
    used_instance = None
    fallback_occurred = False
    errors_log = []

    for i, dem_instance in enumerate(DEM_INSTANCES):
        # Choose native resolution for pixel grid
        native_res = 30 if "30" in dem_instance else 90
        utm = compute_utm_params(AOI_BBOX, native_res)
        print()

        label = "primary" if i == 0 else "fallback"
        print(f"[STEP 3] Downloading DEM — {dem_instance} ({label}) ...")

        ok, data_bytes, err_msg = attempt_dem_download(token, dem_instance, utm)

        if ok:
            used_instance = dem_instance
            fallback_occurred = (i > 0)
            RAW_DIR.mkdir(parents=True, exist_ok=True)
            DEM_PATH.write_bytes(data_bytes)
            size_kb = len(data_bytes) / 1024
            print(f"  [OK] Saved: {DEM_PATH.name} ({size_kb:.1f} KB)")
            break
        else:
            print(f"  [FAIL] {dem_instance}: {err_msg}")
            errors_log.append({"instance": dem_instance, "error": err_msg})
            if i < len(DEM_INSTANCES) - 1:
                print(f"  Falling back to next DEM instance ...")

    if used_instance is None:
        print()
        print("[FAIL] All DEM sources failed:", file=sys.stderr)
        for entry in errors_log:
            print(f"  - {entry['instance']}: {entry['error']}", file=sys.stderr)
        sys.exit(1)

    print()

    # Step 4: Verify
    print("[STEP 4] Verifying DEM GeoTIFF ...")
    stats = verify_dem(DEM_PATH)
    if not stats:
        sys.exit(1)
    print()

    # Step 5: Save metadata
    print("[STEP 5] Saving DEM metadata ...")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    metadata = {
        "dem_instance": used_instance,
        "fallback_occurred": fallback_occurred,
        "errors": errors_log if errors_log else None,
        "aoi_bbox_4326": AOI_BBOX,
        "utm_epsg": utm["epsg"],
        "utm_bbox": utm["bbox"],
        "pixel_resolution_m": utm["res_m"],
        "raster_width_px": utm["width_px"],
        "raster_height_px": utm["height_px"],
        **stats,
        "downloaded_at": datetime.utcnow().isoformat() + "Z",
    }

    DEM_META_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"  [OK] Saved: {DEM_META_PATH.name}")
    print()

    if fallback_occurred:
        print(f"[WARN] Fallback was used: {used_instance} instead of {DEM_INSTANCES[0]}")
    print(f"[DONE] DEM downloaded and verified ({used_instance}).")


if __name__ == "__main__":
    main()
