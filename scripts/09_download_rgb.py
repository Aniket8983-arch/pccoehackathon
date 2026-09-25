"""
RGB Satellite Texture download via Sentinel Hub Processing API.

Downloads a true-color RGB composite (B04, B03, B02) as a PNG image
for use as a terrain overlay texture in the Three.js 3D visualization.

Usage:
    python scripts/09_download_rgb.py
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests
from pyproj import Transformer

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import AOI_BBOX, SH_PROCESS_URL
from src.auth import get_access_token

# ── Paths ─────────────────────────────────────────────────────────────
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
RGB_PATH = PROCESSED_DIR / "rgb_texture.png"
SELECTED_SCENE_PATH = PROCESSED_DIR / "selected_scene.json"

# ── Evalscript ────────────────────────────────────────────────────────
EVALSCRIPT_RGB = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04", "dataMask"], units: "REFLECTANCE" }],
    output: { bands: 4 }
  };
}
function evaluatePixel(sample) {
  // Gain factor to brighten reflectance values for visual display
  let gain = 2.8;
  return [
    gain * sample.B04,
    gain * sample.B03,
    gain * sample.B02,
    sample.dataMask
  ];
}
"""


def compute_utm_params(bbox_4326: list) -> dict:
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
    return {
        "bbox": [x_min, y_min, x_max, y_max],
        "epsg": epsg,
        "crs_url": f"http://www.opengis.net/def/crs/EPSG/0/{epsg}",
        "width_px": width_px,
        "height_px": height_px,
    }


def main() -> None:
    print("=" * 60)
    print("  Sentinel-2 RGB Texture Download")
    print("=" * 60)
    print()

    # Load selected scene metadata for time window
    if SELECTED_SCENE_PATH.exists():
        scene = json.loads(SELECTED_SCENE_PATH.read_text(encoding="utf-8"))
        scene_dt = scene.get("datetime", "")
        dt = datetime.fromisoformat(scene_dt.replace("Z", "+00:00"))
        time_from = dt.strftime("%Y-%m-%dT00:00:00Z")
        time_to = (dt + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")
        print(f"  Using scene: {scene.get('scene_id', 'unknown')}")
        print(f"  Time window: {time_from} to {time_to}")
    else:
        # Fallback: use recent 30-day window
        now = datetime.utcnow()
        time_from = (now - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z")
        time_to = now.strftime("%Y-%m-%dT00:00:00Z")
        print(f"  No selected scene found, using recent window")
    print()

    # Compute UTM
    print("[STEP 1] Computing UTM projection ...")
    utm = compute_utm_params(AOI_BBOX)
    print(f"  UTM EPSG: {utm['epsg']}")
    print(f"  Size: {utm['width_px']}x{utm['height_px']} px @ 10 m")
    print()

    # Auth
    print("[STEP 2] Authenticating ...")
    token = get_access_token()
    print("  [OK] Token acquired.")
    print()

    # Download
    print("[STEP 3] Downloading RGB composite ...")
    body = {
        "input": {
            "bounds": {
                "bbox": utm["bbox"],
                "properties": {"crs": utm["crs_url"]},
            },
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {"from": time_from, "to": time_to},
                        "mosaickingOrder": "leastCC",
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
                    "format": {"type": "image/png"},
                }
            ],
        },
        "evalscript": EVALSCRIPT_RGB,
    }

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "image/png",
    }

    resp = requests.post(SH_PROCESS_URL, json=body, headers=headers, timeout=120)

    if resp.status_code != 200:
        print(f"  [ERROR] HTTP {resp.status_code}", file=sys.stderr)
        try:
            err = resp.json()
            print(f"  {json.dumps(err, indent=2)[:500]}", file=sys.stderr)
        except (ValueError, KeyError):
            print(f"  {resp.text[:500]}", file=sys.stderr)
        sys.exit(1)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    RGB_PATH.write_bytes(resp.content)
    size_kb = len(resp.content) / 1024
    print(f"  [OK] Saved: {RGB_PATH.name} ({size_kb:.1f} KB)")
    print()
    print("[DONE] RGB texture downloaded.")


if __name__ == "__main__":
    main()
