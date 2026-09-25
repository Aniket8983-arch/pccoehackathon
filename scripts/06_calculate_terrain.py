"""
Calculate slope from real Copernicus DEM elevation data.

Usage:
    python scripts/06_calculate_terrain.py

Reads:
    data/raw/dem.tif

Outputs:
    data/processed/slope.tif              (Float32, degrees, georeferenced)
    data/processed/terrain_statistics.json
    data/processed/dem_preview.png
    data/processed/slope_preview.png

Slope is derived using numpy.gradient with real-world horizontal distances
extracted from the GeoTIFF transform — no arbitrary pixel assumptions.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# ── Paths ─────────────────────────────────────────────────────────────
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

DEM_PATH = RAW_DIR / "dem.tif"
SLOPE_PATH = PROCESSED_DIR / "slope.tif"
STATS_PATH = PROCESSED_DIR / "terrain_statistics.json"
DEM_PREVIEW = PROCESSED_DIR / "dem_preview.png"
SLOPE_PREVIEW = PROCESSED_DIR / "slope_preview.png"


def compute_slope(elevation: np.ndarray, dx_m: float, dy_m: float) -> np.ndarray:
    """
    Compute slope in degrees from an elevation array.

    Uses numpy.gradient with real-world pixel spacing so that
    slope = arctan(sqrt((dz/dx)^2 + (dz/dy)^2)) in degrees.

    Parameters
    ----------
    elevation : 2-D float array of elevation values (meters)
    dx_m      : pixel width in meters  (east-west spacing)
    dy_m      : pixel height in meters (north-south spacing, positive)

    Returns
    -------
    slope : 2-D float array of slope in degrees
    """
    # numpy.gradient returns (dz/dy_row, dz/dx_col)
    # dy_m is the row spacing, dx_m is the column spacing
    dz_dy, dz_dx = np.gradient(elevation, dy_m, dx_m)

    slope_rad = np.arctan(np.sqrt(dz_dx ** 2 + dz_dy ** 2))
    slope_deg = np.degrees(slope_rad).astype(np.float32)
    return slope_deg


def make_preview(
    data: np.ndarray,
    title: str,
    cbar_label: str,
    output_path: Path,
    cmap: str = "terrain",
    vmin: float = None,
    vmax: float = None,
    stats_text: str = "",
) -> None:
    """Save a matplotlib preview PNG."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(1, 1, figsize=(7, 6), dpi=150)

    display = np.ma.masked_where(~np.isfinite(data), data)
    im = ax.imshow(display, cmap=cmap, vmin=vmin, vmax=vmax, interpolation="nearest")

    cbar = fig.colorbar(im, ax=ax, shrink=0.8, pad=0.02)
    cbar.set_label(cbar_label, fontsize=11)

    ax.set_title(f"{title}\n{stats_text}", fontsize=10)
    ax.set_xlabel("Column")
    ax.set_ylabel("Row")

    fig.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    import rasterio

    print("=" * 60)
    print("  Terrain Analysis (Elevation + Slope)")
    print("=" * 60)
    print()

    # ── Step 1: Load DEM ──────────────────────────────────────────────
    print("[STEP 1] Loading DEM raster ...")

    if not DEM_PATH.exists():
        print(f"  [ERROR] DEM not found: {DEM_PATH}", file=sys.stderr)
        print("          Run 05_download_dem.py first.", file=sys.stderr)
        sys.exit(1)

    with rasterio.open(DEM_PATH) as ds:
        elevation = ds.read(1).astype(np.float32)
        dem_profile = ds.profile.copy()
        crs = ds.crs
        transform = ds.transform

    # Replace nodata with NaN for clean computation
    nodata_mask = (elevation == -9999.0)
    elevation[nodata_mask] = np.nan

    valid_elev = elevation[np.isfinite(elevation)]

    print(f"  CRS       : {crs}")
    print(f"  Shape     : {elevation.shape[0]}h x {elevation.shape[1]}w")
    print(f"  Transform : {transform}")
    print(f"  Valid px  : {len(valid_elev):,} / {elevation.size:,}")
    print()

    # ── Step 2: Extract real pixel spacing ────────────────────────────
    print("[STEP 2] Extracting pixel spacing from geotransform ...")

    # rasterio Affine transform: | a  b  c |
    #                            | d  e  f |
    # a = pixel width (east), e = pixel height (negative = north-up)
    dx_m = abs(transform.a)  # column spacing in CRS units (meters for UTM)
    dy_m = abs(transform.e)  # row spacing in CRS units (meters for UTM)

    print(f"  dx (column spacing) : {dx_m:.2f} m")
    print(f"  dy (row spacing)    : {dy_m:.2f} m")
    print()

    # ── Step 3: Compute slope ─────────────────────────────────────────
    print("[STEP 3] Computing slope from elevation gradient ...")

    slope = compute_slope(elevation, dx_m, dy_m)

    # Propagate NaN from elevation to slope
    slope[nodata_mask] = np.nan

    valid_slope = slope[np.isfinite(slope)]

    if len(valid_elev) == 0 or len(valid_slope) == 0:
        print("  [ERROR] No valid terrain pixels!", file=sys.stderr)
        sys.exit(1)

    # ── Compute statistics ────────────────────────────────────────────
    elev_min = float(np.min(valid_elev))
    elev_max = float(np.max(valid_elev))
    elev_mean = float(np.mean(valid_elev))
    elev_median = float(np.median(valid_elev))
    elev_std = float(np.std(valid_elev))

    slope_min = float(np.min(valid_slope))
    slope_max = float(np.max(valid_slope))
    slope_mean = float(np.mean(valid_slope))
    slope_median = float(np.median(valid_slope))
    slope_std = float(np.std(valid_slope))

    print(f"  Elevation:")
    print(f"    Min    : {elev_min:.2f} m")
    print(f"    Max    : {elev_max:.2f} m")
    print(f"    Mean   : {elev_mean:.2f} m")
    print(f"    Median : {elev_median:.2f} m")
    print(f"    Std    : {elev_std:.2f} m")
    print(f"  Slope:")
    print(f"    Min    : {slope_min:.4f} deg")
    print(f"    Max    : {slope_max:.4f} deg")
    print(f"    Mean   : {slope_mean:.4f} deg")
    print(f"    Median : {slope_median:.4f} deg")
    print(f"    Std    : {slope_std:.4f} deg")
    print()

    # ── Step 4: Save slope GeoTIFF ────────────────────────────────────
    print("[STEP 4] Saving slope GeoTIFF ...")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    slope_profile = dem_profile.copy()
    slope_profile.update(
        dtype="float32",
        count=1,
        nodata=np.nan,
        compress="deflate",
    )

    with rasterio.open(SLOPE_PATH, "w", **slope_profile) as dst:
        dst.write(slope, 1)

    size_kb = SLOPE_PATH.stat().st_size / 1024
    print(f"  [OK] Saved: {SLOPE_PATH.name} ({size_kb:.1f} KB)")
    print()

    # ── Step 5: Save statistics JSON ──────────────────────────────────
    print("[STEP 5] Saving terrain statistics ...")

    stats = {
        "crs": str(crs),
        "raster_shape_hw": list(elevation.shape),
        "pixel_spacing_m": {"dx": round(dx_m, 2), "dy": round(dy_m, 2)},
        "total_pixels": int(elevation.size),
        "valid_pixels": int(len(valid_elev)),
        "elevation": {
            "min_m": round(elev_min, 2),
            "max_m": round(elev_max, 2),
            "mean_m": round(elev_mean, 2),
            "median_m": round(elev_median, 2),
            "std_m": round(elev_std, 2),
        },
        "slope": {
            "min_deg": round(slope_min, 4),
            "max_deg": round(slope_max, 4),
            "mean_deg": round(slope_mean, 4),
            "median_deg": round(slope_median, 4),
            "std_deg": round(slope_std, 4),
        },
        "computed_at": datetime.utcnow().isoformat() + "Z",
    }

    STATS_PATH.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(f"  [OK] Saved: {STATS_PATH.name}")
    print()

    # ── Step 6: Generate preview PNGs ─────────────────────────────────
    print("[STEP 6] Generating preview images ...")

    make_preview(
        elevation,
        title="Elevation - Nashik Agricultural Test AOI",
        cbar_label="Elevation (m)",
        output_path=DEM_PREVIEW,
        cmap="terrain",
        vmin=elev_min - 1,
        vmax=elev_max + 1,
        stats_text=f"Range: {elev_min:.1f} - {elev_max:.1f} m | Mean: {elev_mean:.1f} m",
    )
    print(f"  [OK] Saved: {DEM_PREVIEW.name}")

    make_preview(
        slope,
        title="Slope - Nashik Agricultural Test AOI",
        cbar_label="Slope (degrees)",
        output_path=SLOPE_PREVIEW,
        cmap="YlOrRd",
        vmin=0,
        vmax=max(slope_max, 1.0),
        stats_text=f"Range: {slope_min:.2f} - {slope_max:.2f} deg | Mean: {slope_mean:.2f} deg",
    )
    print(f"  [OK] Saved: {SLOPE_PREVIEW.name}")
    print()

    # ── Verification readback ─────────────────────────────────────────
    print("[STEP 7] Verifying slope.tif readback ...")
    with rasterio.open(SLOPE_PATH) as ds:
        readback = ds.read(1)
        rb_valid = readback[np.isfinite(readback)]
        print(f"  CRS       : {ds.crs}")
        print(f"  Shape     : {ds.shape[0]}h x {ds.shape[1]}w")
        print(f"  Dtype     : {ds.dtypes[0]}")
        print(f"  Valid px  : {len(rb_valid):,}")
        print(f"  Min slope : {float(rb_valid.min()):.4f} deg")
        print(f"  Max slope : {float(rb_valid.max()):.4f} deg")
    print()
    print("[DONE] Terrain analysis complete.")


if __name__ == "__main__":
    main()
