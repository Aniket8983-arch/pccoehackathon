"""
Search the Sentinel Hub Catalog API for Sentinel-2 L2A scenes covering the AOI.

Usage:
    python scripts/02_sentinel_catalog_test.py

Outputs:
    - Per-scene: product ID, acquisition datetime, cloud cover %
    - Total matching scene count
    - Saves scene metadata to data/processed/scene_metadata.json

Does NOT download imagery. All data comes from the real API response.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import requests

# Ensure project root is importable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import AOI_BBOX, OUTPUT_DIR
from src.auth import get_access_token

# ── Constants ─────────────────────────────────────────────────────────
CATALOG_URL = "https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search"
COLLECTION = "sentinel-2-l2a"

# Search period
DATE_FROM = "2026-06-01T00:00:00Z"
DATE_TO = "2026-09-25T23:59:59Z"

# Output path
METADATA_DIR = PROJECT_ROOT / "data" / "processed"
METADATA_PATH = METADATA_DIR / "scene_metadata.json"


def build_search_body(bbox: list, date_from: str, date_to: str) -> dict:
    """Build STAC-compliant catalog search request body."""
    return {
        "collections": [COLLECTION],
        "bbox": bbox,
        "datetime": f"{date_from}/{date_to}",
        "limit": 100,
    }


def search_catalog(token: str, bbox: list, date_from: str, date_to: str) -> list[dict]:
    """
    Query the Sentinel Hub Catalog API and return all matching features.
    Handles pagination via the 'next' token if present.
    """
    all_features = []
    body = build_search_body(bbox, date_from, date_to)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    page = 1
    while True:
        print(f"  [INFO] Requesting catalog page {page} ...")
        resp = requests.post(CATALOG_URL, json=body, headers=headers, timeout=60)

        if resp.status_code != 200:
            print(f"  [ERROR] Catalog search failed: HTTP {resp.status_code}", file=sys.stderr)
            try:
                err = resp.json()
                msg = err.get("error", {}).get("message", resp.text[:200])
                print(f"  [ERROR] {msg}", file=sys.stderr)
            except (ValueError, KeyError):
                print(f"  [ERROR] {resp.text[:200]}", file=sys.stderr)
            sys.exit(1)

        data = resp.json()
        features = data.get("features", [])
        all_features.extend(features)
        print(f"  [INFO] Page {page}: {len(features)} scene(s) returned.")

        # Check for pagination
        context = data.get("context", {})
        next_token = context.get("next")
        if next_token and len(features) > 0:
            body["next"] = next_token
            page += 1
        else:
            break

    return all_features


def extract_scene_info(feature: dict) -> dict:
    """Extract relevant metadata from a single STAC feature."""
    props = feature.get("properties", {})
    return {
        "scene_id": feature.get("id", "unknown"),
        "datetime": props.get("datetime", "unknown"),
        "cloud_cover_pct": props.get("eo:cloud_cover", None),
        "instrument": props.get("instruments", ["unknown"])[0] if props.get("instruments") else "unknown",
        "platform": props.get("platform", "unknown"),
    }


def main() -> None:
    west, south, east, north = AOI_BBOX
    print("=" * 60)
    print("  Sentinel-2 L2A Catalog Search")
    print("=" * 60)
    print()
    print(f"  Collection  : {COLLECTION}")
    print(f"  AOI bbox    : [{west}, {south}, {east}, {north}]")
    print(f"  Date range  : {DATE_FROM[:10]} to {DATE_TO[:10]}")
    print()

    # Authenticate
    print("[STEP 1] Authenticating ...")
    token = get_access_token()
    print("  [OK] Token acquired.")
    print()

    # Search
    print("[STEP 2] Searching catalog ...")
    features = search_catalog(token, AOI_BBOX, DATE_FROM, DATE_TO)
    print()

    total = len(features)
    print(f"[RESULT] {total} scene(s) found.")
    print()

    if total == 0:
        print("[WARN] No scenes found for the given AOI and date range.")
        print("       Possible causes:")
        print("       - AOI too small or outside Sentinel-2 coverage")
        print("       - Date range has no acquisitions in this orbit")
        print("       - Cloud filter on server side excluded all scenes")
        print()
        print("       Consider broadening the date range or AOI.")
        # Still save an empty result so downstream scripts see the file
        scenes = []
    else:
        # Extract and display scene info
        scenes = [extract_scene_info(f) for f in features]

        # Sort by datetime
        scenes.sort(key=lambda s: s["datetime"])

        print(f"  {'#':<4} {'Date/Time':<28} {'Cloud %':<10} {'Platform':<12} Scene ID")
        print(f"  {'-'*4} {'-'*28} {'-'*10} {'-'*12} {'-'*40}")

        for i, s in enumerate(scenes, 1):
            cc = f"{s['cloud_cover_pct']:.1f}" if s["cloud_cover_pct"] is not None else "N/A"
            scene_short = s["scene_id"][:50]
            print(f"  {i:<4} {s['datetime']:<28} {cc:<10} {s['platform']:<12} {scene_short}")

        # Summary stats
        cloud_values = [s["cloud_cover_pct"] for s in scenes if s["cloud_cover_pct"] is not None]
        if cloud_values:
            print()
            print(f"  Cloud cover: min={min(cloud_values):.1f}%, "
                  f"max={max(cloud_values):.1f}%, "
                  f"mean={sum(cloud_values)/len(cloud_values):.1f}%")

            # Identify best (lowest cloud) scene
            best = min(scenes, key=lambda s: s["cloud_cover_pct"] if s["cloud_cover_pct"] is not None else 999)
            print(f"  Best scene : {best['scene_id']}")
            print(f"               {best['datetime']}  ({best['cloud_cover_pct']:.1f}% cloud)")

    # Save metadata
    print()
    print("[STEP 3] Saving scene metadata ...")
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

    output = {
        "query": {
            "collection": COLLECTION,
            "bbox": AOI_BBOX,
            "date_from": DATE_FROM,
            "date_to": DATE_TO,
            "generated_at": datetime.utcnow().isoformat() + "Z",
        },
        "total_scenes": total,
        "scenes": scenes,
    }

    METADATA_PATH.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"  [OK] Saved to: {METADATA_PATH}")
    print()
    print("[DONE]")


if __name__ == "__main__":
    main()
