"""
Build a geospatial grid aligned to the Sentinel-2 raster and sample all
real raster measurements into each cell.

Usage:
    python scripts/07_create_grid.py

Inputs:
    data/processed/ndvi.tif    (10 m, FLOAT32)
    data/raw/dem.tif           (90 m, FLOAT32)
    data/processed/slope.tif   (90 m, FLOAT32)
    data/processed/selected_scene.json
    data/processed/dem_metadata.json
    config/settings.py  →  AOI_BBOX, LOW_VEGETATION_NDVI_THRESHOLD

Outputs:
    data/processed/grid.json      (per-cell measurements)
    data/processed/grid.geojson   (GeoJSON with one feature per cell)

The grid is built in projected CRS (UTM) and aligned pixel-for-pixel to the
Sentinel-2 10 m NDVI raster.  No fake data, no invented values.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from pyproj import Transformer

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import AOI_BBOX, LOW_VEGETATION_NDVI_THRESHOLD

# ── Paths ─────────────────────────────────────────────────────────────
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
RAW_DIR = PROJECT_ROOT / "data" / "raw"

NDVI_PATH = PROCESSED_DIR / "ndvi.tif"
DEM_PATH = RAW_DIR / "dem.tif"
SLOPE_PATH = PROCESSED_DIR / "slope.tif"
SCENE_META_PATH = PROCESSED_DIR / "selected_scene.json"
DEM_META_PATH = PROCESSED_DIR / "dem_metadata.json"

GRID_JSON_PATH = PROCESSED_DIR / "grid.json"
GRID_GEOJSON_PATH = PROCESSED_DIR / "grid.geojson"


def load_json(path: Path) -> dict:
    if not path.exists():
        print(f"  [WARN] Metadata file not found: {path.name}", file=sys.stderr)
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def sample_raster_at_points(raster_path: Path, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    """
    Sample a raster at the given projected coordinates using nearest-neighbor.
    Returns NaN for points outside raster extent.
    """
    import rasterio

    with rasterio.open(raster_path) as ds:
        # Convert world coords → pixel row/col
        inv_transform = ~ds.transform
        cols_f, rows_f = inv_transform * (xs, ys)
        cols_i = np.round(cols_f).astype(int)
        rows_i = np.round(rows_f).astype(int)

        data = ds.read(1).astype(np.float32)
        h, w = data.shape

        values = np.full(len(xs), np.nan, dtype=np.float32)
        valid = (rows_i >= 0) & (rows_i < h) & (cols_i >= 0) & (cols_i < w)
        values[valid] = data[rows_i[valid], cols_i[valid]]

        # Replace nodata sentinel with NaN
        values[(values == -9999.0)] = np.nan

    return values


def main() -> None:
    import rasterio

    print("=" * 60)
    print("  Geospatial Grid Generator")
    print("=" * 60)
    print()

    # ── Step 1: Load NDVI raster as the grid template ─────────────────
    print("[STEP 1] Loading NDVI raster (grid template) ...")

    for p, name in [(NDVI_PATH, "ndvi.tif"), (DEM_PATH, "dem.tif"), (SLOPE_PATH, "slope.tif")]:
        if not p.exists():
            print(f"  [ERROR] {name} not found: {p}", file=sys.stderr)
            sys.exit(1)

    with rasterio.open(NDVI_PATH) as ds:
        ndvi_data = ds.read(1).astype(np.float32)
        ndvi_crs = ds.crs
        ndvi_transform = ds.transform
        ndvi_h, ndvi_w = ds.shape

    dx = abs(ndvi_transform.a)  # pixel width in meters
    dy = abs(ndvi_transform.e)  # pixel height in meters
    x_origin = ndvi_transform.c  # top-left X
    y_origin = ndvi_transform.f  # top-left Y

    print(f"  CRS       : {ndvi_crs}")
    print(f"  Shape     : {ndvi_h} rows x {ndvi_w} cols")
    print(f"  Pixel size: {dx:.2f} m x {dy:.2f} m")
    print(f"  Origin    : ({x_origin:.2f}, {y_origin:.2f})")
    total_cells = ndvi_h * ndvi_w
    print(f"  Total cells: {total_cells:,}")
    print()

    # ── Step 2: Build grid cell centres (aligned to NDVI pixels) ──────
    print("[STEP 2] Building pixel-aligned grid cell centres ...")

    # Cell centre = pixel centre
    # For pixel (r, c): x_center = x_origin + (c + 0.5) * dx
    #                    y_center = y_origin - (r + 0.5) * dy
    rows_idx, cols_idx = np.meshgrid(np.arange(ndvi_h), np.arange(ndvi_w), indexing="ij")
    rows_flat = rows_idx.ravel()
    cols_flat = cols_idx.ravel()

    x_centers = x_origin + (cols_flat + 0.5) * dx
    y_centers = y_origin - (rows_flat + 0.5) * dy

    print(f"  Generated {len(x_centers):,} cell centres.")
    print()

    # ── Step 3: Read NDVI values directly (1:1 pixel mapping) ─────────
    print("[STEP 3] Reading NDVI values (direct pixel mapping) ...")

    ndvi_flat = ndvi_data.ravel().astype(np.float32)
    ndvi_valid_mask = np.isfinite(ndvi_flat)
    valid_count = int(np.sum(ndvi_valid_mask))
    invalid_count = total_cells - valid_count
    print(f"  Valid NDVI pixels : {valid_count:,}")
    print(f"  Invalid (NaN)     : {invalid_count:,}")
    print()

    # ── Step 4: Sample DEM and slope at cell centres ──────────────────
    print("[STEP 4] Sampling elevation and slope at cell centres ...")

    elev_values = sample_raster_at_points(DEM_PATH, x_centers, y_centers)
    slope_values = sample_raster_at_points(SLOPE_PATH, x_centers, y_centers)

    elev_valid = int(np.sum(np.isfinite(elev_values)))
    slope_valid = int(np.sum(np.isfinite(slope_values)))
    print(f"  Elevation samples : {elev_valid:,} valid / {total_cells:,}")
    print(f"  Slope samples     : {slope_valid:,} valid / {total_cells:,}")
    print()

    # ── Step 5: Convert cell centres & corners to WGS84 ───────────────
    print("[STEP 5] Converting coordinates to WGS84 ...")

    to_wgs84 = Transformer.from_crs(str(ndvi_crs), "EPSG:4326", always_xy=True)

    # Centres
    lon_centers, lat_centers = to_wgs84.transform(x_centers, y_centers)

    # Cell corner offsets (half-pixel in each direction)
    half_dx = dx / 2
    half_dy = dy / 2

    print(f"  [OK] Transformed {total_cells:,} centres to lat/lon.")
    print()

    # ── Step 6: Load source metadata ──────────────────────────────────
    print("[STEP 6] Loading source metadata ...")

    scene_meta = load_json(SCENE_META_PATH)
    dem_meta = load_json(DEM_META_PATH)

    source_scene_id = scene_meta.get("scene_id", "unknown")
    source_datetime = scene_meta.get("datetime", "unknown")
    dem_instance = dem_meta.get("dem_instance", "unknown")

    print(f"  Sentinel-2 scene : {source_scene_id}")
    print(f"  Scene datetime   : {source_datetime}")
    print(f"  DEM source       : {dem_instance}")
    print()

    # ── Step 7: Assemble grid cells ───────────────────────────────────
    print("[STEP 7] Assembling grid cells ...")

    cells = []
    geojson_features = []

    for i in range(total_cells):
        r = int(rows_flat[i])
        c = int(cols_flat[i])

        ndvi_val = float(ndvi_flat[i]) if ndvi_valid_mask[i] else None
        elev_val = float(elev_values[i]) if np.isfinite(elev_values[i]) else None
        slope_val = float(slope_values[i]) if np.isfinite(slope_values[i]) else None

        is_valid = ndvi_val is not None

        # Cell bounds in UTM
        x_min = x_origin + c * dx
        x_max = x_min + dx
        y_max_cell = y_origin - r * dy
        y_min_cell = y_max_cell - dy

        # Cell corners in WGS84 for GeoJSON polygon
        corners_x = [x_min, x_max, x_max, x_min, x_min]
        corners_y = [y_min_cell, y_min_cell, y_max_cell, y_max_cell, y_min_cell]
        corner_lons, corner_lats = to_wgs84.transform(
            np.array(corners_x), np.array(corners_y)
        )

        cell = {
            "cell_id": f"R{r:03d}_C{c:03d}",
            "row": r,
            "col": c,
            "center_lat": round(float(lat_centers[i]), 7),
            "center_lon": round(float(lon_centers[i]), 7),
            "bbox_utm": [round(x_min, 2), round(y_min_cell, 2),
                         round(x_max, 2), round(y_max_cell, 2)],
            "valid": is_valid,
            "valid_pixel_count": 1 if is_valid else 0,
            "ndvi_mean": round(ndvi_val, 6) if ndvi_val is not None else None,
            "ndvi_min": round(ndvi_val, 6) if ndvi_val is not None else None,
            "ndvi_max": round(ndvi_val, 6) if ndvi_val is not None else None,
            "elevation_m": round(elev_val, 2) if elev_val is not None else None,
            "slope_deg": round(slope_val, 4) if slope_val is not None else None,
        }

        # Low-vegetation flag (observation only, NOT a disease diagnosis)
        if ndvi_val is not None:
            cell["low_vegetation_index"] = ndvi_val < LOW_VEGETATION_NDVI_THRESHOLD
        else:
            cell["low_vegetation_index"] = None

        cells.append(cell)

        # GeoJSON feature
        geojson_features.append({
            "type": "Feature",
            "properties": cell,
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [round(float(corner_lons[j]), 7), round(float(corner_lats[j]), 7)]
                    for j in range(5)
                ]],
            },
        })

    print(f"  [OK] Assembled {total_cells:,} cells.")
    print()

    # ── Step 8: Compute summary stats ─────────────────────────────────
    print("[STEP 8] Computing summary statistics ...")

    valid_cells = [c for c in cells if c["valid"]]
    invalid_cells_list = [c for c in cells if not c["valid"]]

    ndvi_vals = np.array([c["ndvi_mean"] for c in valid_cells])
    elev_vals = np.array([c["elevation_m"] for c in valid_cells if c["elevation_m"] is not None])
    slope_vals = np.array([c["slope_deg"] for c in valid_cells if c["slope_deg"] is not None])
    low_veg_count = sum(1 for c in valid_cells if c["low_vegetation_index"])

    print(f"  Total cells     : {total_cells:,}")
    print(f"  Valid cells     : {len(valid_cells):,}")
    print(f"  Invalid cells   : {len(invalid_cells_list):,}")
    print()
    if len(ndvi_vals) > 0:
        print(f"  NDVI range      : [{ndvi_vals.min():.6f}, {ndvi_vals.max():.6f}]")
        print(f"  NDVI mean       : {ndvi_vals.mean():.6f}")
    if len(elev_vals) > 0:
        print(f"  Elevation range : [{elev_vals.min():.2f}, {elev_vals.max():.2f}] m")
        print(f"  Elevation mean  : {elev_vals.mean():.2f} m")
    if len(slope_vals) > 0:
        print(f"  Slope range     : [{slope_vals.min():.4f}, {slope_vals.max():.4f}] deg")
        print(f"  Slope mean      : {slope_vals.mean():.4f} deg")
    print()
    print(f"  Low vegetation  : {low_veg_count:,} cells "
          f"(threshold < {LOW_VEGETATION_NDVI_THRESHOLD})")
    print()

    # ── Step 9: Save grid.json ────────────────────────────────────────
    print("[STEP 9] Saving grid.json ...")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    grid_output = {
        "metadata": {
            "aoi_bbox_4326": AOI_BBOX,
            "crs": str(ndvi_crs),
            "pixel_size_m": {"dx": round(dx, 2), "dy": round(dy, 2)},
            "grid_rows": ndvi_h,
            "grid_cols": ndvi_w,
            "total_cells": total_cells,
            "valid_cells": len(valid_cells),
            "invalid_cells": len(invalid_cells_list),
            "sentinel2_scene_id": source_scene_id,
            "sentinel2_datetime": source_datetime,
            "dem_source": dem_instance,
            "low_vegetation_ndvi_threshold": LOW_VEGETATION_NDVI_THRESHOLD,
            "low_vegetation_cell_count": low_veg_count,
            "ndvi_range": [round(float(ndvi_vals.min()), 6),
                           round(float(ndvi_vals.max()), 6)] if len(ndvi_vals) > 0 else None,
            "elevation_range_m": [round(float(elev_vals.min()), 2),
                                  round(float(elev_vals.max()), 2)] if len(elev_vals) > 0 else None,
            "slope_range_deg": [round(float(slope_vals.min()), 4),
                                round(float(slope_vals.max()), 4)] if len(slope_vals) > 0 else None,
            "generated_at": datetime.utcnow().isoformat() + "Z",
        },
        "cells": cells,
    }

    GRID_JSON_PATH.write_text(json.dumps(grid_output, indent=2), encoding="utf-8")
    size_kb = GRID_JSON_PATH.stat().st_size / 1024
    print(f"  [OK] Saved: {GRID_JSON_PATH.name} ({size_kb:.1f} KB)")
    print()

    # ── Step 10: Save grid.geojson ────────────────────────────────────
    print("[STEP 10] Saving grid.geojson ...")

    geojson = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:EPSG::4326"},
        },
        "features": geojson_features,
    }

    GRID_GEOJSON_PATH.write_text(json.dumps(geojson), encoding="utf-8")
    size_kb = GRID_GEOJSON_PATH.stat().st_size / 1024
    print(f"  [OK] Saved: {GRID_GEOJSON_PATH.name} ({size_kb:.1f} KB)")
    print()
    print("[DONE] Grid generation complete.")


if __name__ == "__main__":
    main()
