"""
FastAPI backend serving processed satellite data to the Three.js frontend.

Endpoints:
  GET /api/grid      → grid.json data (cells + metadata)
  GET /api/terrain   → elevation + NDVI as structured 2D arrays
  GET /api/metadata  → satellite scene metadata
  GET /api/rgb-texture → RGB satellite PNG image

Credentials are NEVER exposed to the browser.
All data comes from pre-processed pipeline outputs in data/processed/.
"""

import json
import sys
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# ── Project paths ─────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

GRID_JSON_PATH = PROCESSED_DIR / "grid.json"
SELECTED_SCENE_PATH = PROCESSED_DIR / "selected_scene.json"
DEM_META_PATH = PROCESSED_DIR / "dem_metadata.json"
NDVI_STATS_PATH = PROCESSED_DIR / "ndvi_statistics.json"
RGB_PATH = PROCESSED_DIR / "rgb_texture.png"
DEM_PATH = RAW_DIR / "dem.tif"
NDVI_PATH = PROCESSED_DIR / "ndvi.tif"

# ── App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="3D Smart Crop Field API",
    description="Serves real Sentinel-2 and DEM data for the Three.js frontend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Cache ─────────────────────────────────────────────────────────────
_grid_cache: dict | None = None
_terrain_cache: dict | None = None


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _build_terrain_payload() -> dict:
    """Read DEM and NDVI rasters and build a structured terrain payload."""
    import rasterio
    from scipy.ndimage import zoom

    if not DEM_PATH.exists():
        raise HTTPException(status_code=404, detail="DEM raster not found. Run the data pipeline first.")
    if not NDVI_PATH.exists():
        raise HTTPException(status_code=404, detail="NDVI raster not found. Run the data pipeline first.")

    # Load DEM
    with rasterio.open(DEM_PATH) as ds:
        dem = ds.read(1).astype(np.float32)
        dem[dem == -9999.0] = np.nan

    # Load NDVI
    with rasterio.open(NDVI_PATH) as ds:
        ndvi = ds.read(1).astype(np.float32)

    # DEM may have different resolution than NDVI, resample DEM to NDVI grid
    ndvi_rows, ndvi_cols = ndvi.shape
    dem_rows, dem_cols = dem.shape

    if dem.shape != ndvi.shape:
        # Use scipy zoom to resample DEM to match NDVI grid
        zoom_r = ndvi_rows / dem_rows
        zoom_c = ndvi_cols / dem_cols
        dem_resampled = zoom(dem, (zoom_r, zoom_c), order=1)  # bilinear
        dem = dem_resampled[:ndvi_rows, :ndvi_cols]

    # Replace NaN with min for clean terrain
    valid_dem = dem[np.isfinite(dem)]
    if len(valid_dem) == 0:
        min_elev = 0.0
        max_elev = 1.0
    else:
        min_elev = float(np.min(valid_dem))
        max_elev = float(np.max(valid_dem))

    dem_clean = np.where(np.isfinite(dem), dem, min_elev)

    valid_ndvi = ndvi[np.isfinite(ndvi)]
    min_ndvi = float(np.min(valid_ndvi)) if len(valid_ndvi) > 0 else -1.0
    max_ndvi = float(np.max(valid_ndvi)) if len(valid_ndvi) > 0 else 1.0
    ndvi_clean = np.where(np.isfinite(ndvi), ndvi, 0.0)

    # Load AOI bbox from grid.json metadata
    grid_data = _load_json(GRID_JSON_PATH)
    bbox = grid_data.get("metadata", {}).get("aoi_bbox_4326", [0, 0, 0, 0])

    return {
        "rows": int(ndvi_rows),
        "cols": int(ndvi_cols),
        "elevations": dem_clean.tolist(),
        "ndvi": ndvi_clean.tolist(),
        "min_elevation": round(min_elev, 2),
        "max_elevation": round(max_elev, 2),
        "min_ndvi": round(min_ndvi, 4),
        "max_ndvi": round(max_ndvi, 4),
        "bbox": bbox,
    }


# ── Endpoints ─────────────────────────────────────────────────────────

@app.get("/api/grid")
async def get_grid():
    """Return the full grid.json data (metadata + cells)."""
    if not GRID_JSON_PATH.exists():
        raise HTTPException(status_code=404, detail="grid.json not found. Run the data pipeline (scripts 02-07).")
    return JSONResponse(content=_load_json(GRID_JSON_PATH))


@app.get("/api/terrain")
async def get_terrain():
    """Return terrain elevation + NDVI as structured 2D arrays for Three.js."""
    # Always rebuild or you could cache with a file-watch, but building is fast enough for now
    return JSONResponse(content=_build_terrain_payload())


@app.get("/api/metadata")
async def get_metadata():
    """Return satellite scene and DEM metadata."""
    scene = _load_json(SELECTED_SCENE_PATH)
    dem = _load_json(DEM_META_PATH)
    ndvi_stats = _load_json(NDVI_STATS_PATH)

    return JSONResponse(content={
        "sentinel2": {
            "scene_id": scene.get("scene_id", "unknown"),
            "datetime": scene.get("datetime", "unknown"),
            "cloud_cover_pct": scene.get("cloud_cover_pct"),
            "platform": scene.get("platform", "Sentinel-2"),
            "pixel_size_m": scene.get("pixel_size_m", 10),
            "aoi_bbox": scene.get("aoi_bbox_4326", []),
        },
        "dem": {
            "source": dem.get("dem_instance", "unknown"),
            "resolution_m": dem.get("pixel_resolution_m"),
            "elevation_range_m": [
                dem.get("elevation_min_m"),
                dem.get("elevation_max_m"),
            ],
        },
        "ndvi": {
            "min": ndvi_stats.get("ndvi_min"),
            "max": ndvi_stats.get("ndvi_max"),
            "mean": ndvi_stats.get("ndvi_mean"),
            "valid_pixels": ndvi_stats.get("valid_ndvi_pixels"),
        },
    })


@app.get("/api/rgb-texture")
async def get_rgb_texture():
    """Return the RGB satellite PNG texture."""
    if not RGB_PATH.exists():
        raise HTTPException(status_code=404, detail="RGB texture not found. Run 09_download_rgb.py.")
    return FileResponse(
        path=str(RGB_PATH),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ── Serve frontend static files (production build) ───────────────────
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


# ── Main ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print("Starting 3D Smart Crop Field API server ...")
    print(f"  Grid JSON  : {'FOUND' if GRID_JSON_PATH.exists() else 'MISSING'}")
    print(f"  DEM raster : {'FOUND' if DEM_PATH.exists() else 'MISSING'}")
    print(f"  NDVI raster: {'FOUND' if NDVI_PATH.exists() else 'MISSING'}")
    print(f"  RGB texture: {'FOUND' if RGB_PATH.exists() else 'MISSING'}")
    print()
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
