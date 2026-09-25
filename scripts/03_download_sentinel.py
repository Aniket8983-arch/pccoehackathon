"""
Download Sentinel-2 L2A bands (B04, B08, SCL) via Sentinel Hub Processing API.

Usage:
    python scripts/03_download_sentinel.py

Selects the lowest-cloud-cover scene from the catalog search results,
downloads B04, B08 at 10 m REFLECTANCE, and SCL (nearest-resampled to 10 m).
Saves proper GeoTIFFs with CRS and geotransform.

All pixel values come from real Sentinel-2 data — nothing hardcoded.
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import requests
from pyproj import Transformer

# ── Project imports ───────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import AOI_BBOX, SH_PROCESS_URL
from src.auth import get_access_token

# ── Paths ─────────────────────────────────────────────────────────────
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
SCENE_METADATA_PATH = PROCESSED_DIR / "scene_metadata.json"
SELECTED_SCENE_PATH = PROCESSED_DIR / "selected_scene.json"

B04_PATH = RAW_DIR / "sentinel_b04.tif"
B08_PATH = RAW_DIR / "sentinel_b08.tif"
SCL_PATH = RAW_DIR / "sentinel_scl.tif"

# ── Evalscripts ───────────────────────────────────────────────────────

# B04 and B08: reflectance bands (FLOAT32), nodata = -9999
EVALSCRIPT_B04 = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "dataMask"], units: "REFLECTANCE" }],
    output: { bands: 1, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [-9999.0];
  return [sample.B04];
}
"""

EVALSCRIPT_B08 = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08", "dataMask"], units: "REFLECTANCE" }],
    output: { bands: 1, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [-9999.0];
  return [sample.B08];
}
"""

# SCL: classification layer (UINT8), 0 = nodata (matches SCL "No Data" class)
# Nearest-neighbor resampling preserves integer class labels when upscaled from 20m → 10m
EVALSCRIPT_SCL = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["SCL", "dataMask"] }],
    output: { bands: 1, sampleType: "UINT8" }
  };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0];
  return [sample.SCL];
}
"""


# ── Scene selection ───────────────────────────────────────────────────

def load_best_scene() -> dict:
    """Load catalog results and return the lowest cloud-cover scene."""
    if not SCENE_METADATA_PATH.exists():
        print("[ERROR] scene_metadata.json not found.", file=sys.stderr)
        print("        Run 02_sentinel_catalog_test.py first.", file=sys.stderr)
        sys.exit(1)

    data = json.loads(SCENE_METADATA_PATH.read_text(encoding="utf-8"))
    scenes = data.get("scenes", [])
    if not scenes:
        print("[ERROR] No scenes in scene_metadata.json.", file=sys.stderr)
        sys.exit(1)

    # Keep only scenes with cloud cover data, sort ascending
    valid = [s for s in scenes if s.get("cloud_cover_pct") is not None]
    if not valid:
        print("[ERROR] No scenes have cloud cover information.", file=sys.stderr)
        sys.exit(1)

    valid.sort(key=lambda s: s["cloud_cover_pct"])
    return valid[0]


# ── UTM projection ───────────────────────────────────────────────────

def compute_utm_params(bbox_4326: list) -> dict:
    """
    Convert EPSG:4326 bbox to UTM, compute pixel dims at 10 m resolution.
    Returns dict with utm bbox, EPSG code, CRS URL, and pixel w/h.
    """
    west, south, east, north = bbox_4326
    center_lon = (west + east) / 2
    center_lat = (south + north) / 2

    utm_zone = int((center_lon + 180) / 6) + 1
    epsg = 32600 + utm_zone if center_lat >= 0 else 32700 + utm_zone

    t = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    x_min, y_min = t.transform(west, south)
    x_max, y_max = t.transform(east, north)

    width_px = int(round((x_max - x_min) / 10))
    height_px = int(round((y_max - y_min) / 10))

    info = {
        "bbox": [x_min, y_min, x_max, y_max],
        "epsg": epsg,
        "crs_url": f"http://www.opengis.net/def/crs/EPSG/0/{epsg}",
        "width_px": width_px,
        "height_px": height_px,
        "res_m": 10,
    }
    print(f"  UTM zone  : EPSG:{epsg}")
    print(f"  UTM bbox  : [{x_min:.1f}, {y_min:.1f}, {x_max:.1f}, {y_max:.1f}]")
    print(f"  Pixel size: {width_px} x {height_px} @ 10 m")
    return info


# ── Processing API download ──────────────────────────────────────────

def download_band(
    token: str,
    band_name: str,
    evalscript: str,
    utm: dict,
    time_from: str,
    time_to: str,
    output_path: Path,
    processing: dict | None = None,
) -> bool:
    """
    Download a single band via the Sentinel Hub Processing API.
    Returns True on success.
    """
    data_entry = {
        "type": "sentinel-2-l2a",
        "dataFilter": {
            "timeRange": {"from": time_from, "to": time_to},
            "mosaickingOrder": "leastCC",
        },
    }
    if processing:
        data_entry["processing"] = processing

    body = {
        "input": {
            "bounds": {
                "bbox": utm["bbox"],
                "properties": {"crs": utm["crs_url"]},
            },
            "data": [data_entry],
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
        "evalscript": evalscript,
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "image/tiff",
    }

    print(f"  Requesting {band_name} ...")
    try:
        resp = requests.post(SH_PROCESS_URL, json=body, headers=headers, timeout=120)
    except requests.RequestException as exc:
        print(f"  [ERROR] Request failed: {exc}", file=sys.stderr)
        return False

    if resp.status_code != 200:
        print(f"  [ERROR] HTTP {resp.status_code}", file=sys.stderr)
        try:
            err = resp.json()
            msg = json.dumps(err, indent=2)[:500]
        except (ValueError, KeyError):
            msg = resp.text[:500]
        print(f"  {msg}", file=sys.stderr)
        return False

    # Save raw GeoTIFF bytes
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(resp.content)
    size_kb = len(resp.content) / 1024
    print(f"  [OK] {band_name} saved: {output_path.name} ({size_kb:.1f} KB)")
    return True


# ── GeoTIFF verification ─────────────────────────────────────────────

def verify_geotiff(path: Path, band_name: str) -> bool:
    """Read the GeoTIFF with rasterio and print diagnostics."""
    import rasterio

    try:
        with rasterio.open(path) as ds:
            crs = ds.crs
            transform = ds.transform
            shape = ds.shape
            dtype = ds.dtypes[0]
            data = ds.read(1)

            # Compute valid pixel mask
            if "float" in dtype:
                valid_mask = (data != -9999.0) & np.isfinite(data)
            else:
                valid_mask = data > 0  # SCL: 0 is "No Data" class

            valid = data[valid_mask]
            total = data.size
            pct = 100 * len(valid) / total if total > 0 else 0

            print(f"  {band_name}:")
            print(f"    File      : {path.name}")
            print(f"    CRS       : {crs}")
            print(f"    Transform : {transform}")
            print(f"    Shape     : {shape[0]}h x {shape[1]}w")
            print(f"    Dtype     : {dtype}")
            print(f"    Valid px  : {len(valid):,} / {total:,} ({pct:.1f}%)")
            if len(valid) > 0:
                print(f"    Min       : {float(valid.min()):.6f}")
                print(f"    Max       : {float(valid.max()):.6f}")
                print(f"    Mean      : {float(valid.mean()):.6f}")
            return len(valid) > 0
    except Exception as exc:
        print(f"  [ERROR] {band_name}: {exc}", file=sys.stderr)
        return False


# ── Main ──────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 60)
    print("  Sentinel-2 L2A Band Download")
    print("=" * 60)
    print()

    # Step 1: Select best scene
    print("[STEP 1] Selecting best scene from catalog results ...")
    scene = load_best_scene()
    scene_dt = scene["datetime"]
    scene_id = scene["scene_id"]
    cloud_pct = scene["cloud_cover_pct"]
    print(f"  Scene : {scene_id}")
    print(f"  Date  : {scene_dt}")
    print(f"  Cloud : {cloud_pct}%")
    print()

    # Build a 1-day time window around the scene acquisition
    dt = datetime.fromisoformat(scene_dt.replace("Z", "+00:00"))
    time_from = dt.strftime("%Y-%m-%dT00:00:00Z")
    time_to = (dt + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")
    print(f"  Time window: {time_from} to {time_to}")
    print()

    # Step 2: Compute UTM projection and pixel grid
    print("[STEP 2] Computing UTM projection ...")
    utm = compute_utm_params(AOI_BBOX)
    print()

    # Step 3: Authenticate
    print("[STEP 3] Authenticating ...")
    token = get_access_token()
    print("  [OK] Token acquired.")
    print()

    # Step 4: Download bands
    print("[STEP 4] Downloading bands via Processing API ...")
    print(f"  Endpoint: {SH_PROCESS_URL}")
    print()

    # B04 (Red, 10 m, reflectance)
    ok_b04 = download_band(
        token, "B04", EVALSCRIPT_B04, utm, time_from, time_to, B04_PATH,
    )
    # B08 (NIR, 10 m, reflectance)
    ok_b08 = download_band(
        token, "B08", EVALSCRIPT_B08, utm, time_from, time_to, B08_PATH,
    )
    # SCL (20 m native, nearest-neighbor upsampled to 10 m)
    ok_scl = download_band(
        token, "SCL", EVALSCRIPT_SCL, utm, time_from, time_to, SCL_PATH,
        processing={"upsampling": "NEAREST", "downsampling": "NEAREST"},
    )
    print()

    if not (ok_b04 and ok_b08 and ok_scl):
        print("[FAIL] One or more band downloads failed.", file=sys.stderr)
        sys.exit(1)

    # Step 5: Verify GeoTIFFs
    print("[STEP 5] Verifying GeoTIFFs ...")
    v1 = verify_geotiff(B04_PATH, "B04 (Red reflectance)")
    v2 = verify_geotiff(B08_PATH, "B08 (NIR reflectance)")
    v3 = verify_geotiff(SCL_PATH, "SCL (Scene Classification)")
    print()

    if not (v1 and v2 and v3):
        print("[FAIL] GeoTIFF verification failed.", file=sys.stderr)
        sys.exit(1)

    # Step 6: Save selected scene metadata
    print("[STEP 6] Saving selected scene metadata ...")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    selected = {
        "scene_id": scene_id,
        "datetime": scene_dt,
        "cloud_cover_pct": cloud_pct,
        "platform": scene.get("platform", "unknown"),
        "time_window": {"from": time_from, "to": time_to},
        "aoi_bbox_4326": AOI_BBOX,
        "utm_epsg": utm["epsg"],
        "utm_bbox": utm["bbox"],
        "pixel_size_m": utm["res_m"],
        "raster_width_px": utm["width_px"],
        "raster_height_px": utm["height_px"],
        "output_files": {
            "b04": str(B04_PATH.relative_to(PROJECT_ROOT)),
            "b08": str(B08_PATH.relative_to(PROJECT_ROOT)),
            "scl": str(SCL_PATH.relative_to(PROJECT_ROOT)),
        },
        "downloaded_at": datetime.utcnow().isoformat() + "Z",
    }
    SELECTED_SCENE_PATH.write_text(json.dumps(selected, indent=2), encoding="utf-8")
    print(f"  [OK] Saved to: {SELECTED_SCENE_PATH}")
    print()
    print("[DONE] All bands downloaded and verified.")


if __name__ == "__main__":
    main()
