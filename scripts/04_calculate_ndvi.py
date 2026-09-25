"""
Calculate NDVI from real Sentinel-2 B04/B08 reflectance with SCL cloud masking.

Usage:
    python scripts/04_calculate_ndvi.py

Inputs:
    data/raw/sentinel_b04.tif   (Red, FLOAT32, reflectance)
    data/raw/sentinel_b08.tif   (NIR, FLOAT32, reflectance)
    data/raw/sentinel_scl.tif   (Scene Classification, UINT8)

Outputs:
    data/processed/ndvi.tif             (FLOAT32, georeferenced)
    data/processed/ndvi_statistics.json  (min/max/mean/valid count)
    data/processed/ndvi_preview.png      (visualization only)

NDVI = (B08 - B04) / (B08 + B04)
Invalid/cloudy pixels are set to NaN.
No fake values, no clipping, no artificial modification.
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

B04_PATH = RAW_DIR / "sentinel_b04.tif"
B08_PATH = RAW_DIR / "sentinel_b08.tif"
SCL_PATH = RAW_DIR / "sentinel_scl.tif"

NDVI_PATH = PROCESSED_DIR / "ndvi.tif"
STATS_PATH = PROCESSED_DIR / "ndvi_statistics.json"
PREVIEW_PATH = PROCESSED_DIR / "ndvi_preview.png"

# SCL classes to EXCLUDE (mask as invalid)
# 0  = No data
# 1  = Saturated / defective
# 2  = Dark area pixels
# 3  = Cloud shadow
# 7  = Unclassified / low probability cloud
# 8  = Medium probability cloud
# 9  = High probability cloud
# 10 = Thin cirrus
# 11 = Snow / ice
SCL_EXCLUDE = {0, 1, 2, 3, 7, 8, 9, 10, 11}

# SCL classes KEPT for analysis:
# 4  = Vegetation
# 5  = Bare soil
# 6  = Water (NDVI will be low/negative, which is correct)


def main() -> None:
    import rasterio
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive backend
    import matplotlib.pyplot as plt
    from matplotlib.colors import LinearSegmentedColormap

    print("=" * 60)
    print("  NDVI Calculation from Sentinel-2 L2A")
    print("=" * 60)
    print()

    # ── Step 1: Load rasters ──────────────────────────────────────────
    print("[STEP 1] Loading input rasters ...")

    for p, name in [(B04_PATH, "B04"), (B08_PATH, "B08"), (SCL_PATH, "SCL")]:
        if not p.exists():
            print(f"  [ERROR] {name} not found: {p}", file=sys.stderr)
            print("          Run 03_download_sentinel.py first.", file=sys.stderr)
            sys.exit(1)

    with rasterio.open(B04_PATH) as ds_b04:
        b04 = ds_b04.read(1).astype(np.float32)
        profile = ds_b04.profile.copy()
        crs = ds_b04.crs
        transform = ds_b04.transform
        print(f"  B04: {b04.shape}, CRS={crs}, dtype={b04.dtype}")

    with rasterio.open(B08_PATH) as ds_b08:
        b08 = ds_b08.read(1).astype(np.float32)
        print(f"  B08: {b08.shape}, dtype={b08.dtype}")

    with rasterio.open(SCL_PATH) as ds_scl:
        scl = ds_scl.read(1)
        print(f"  SCL: {scl.shape}, dtype={scl.dtype}")

    # Verify shapes match
    if b04.shape != b08.shape or b04.shape != scl.shape:
        print(f"  [ERROR] Shape mismatch: B04={b04.shape}, B08={b08.shape}, SCL={scl.shape}",
              file=sys.stderr)
        sys.exit(1)
    print(f"  [OK] All rasters aligned: {b04.shape[0]}h x {b04.shape[1]}w")
    print()

    # ── Step 2: Build validity mask ───────────────────────────────────
    print("[STEP 2] Building validity mask from SCL ...")

    # Count SCL class distribution
    unique, counts = np.unique(scl, return_counts=True)
    total_px = scl.size
    print("  SCL class distribution:")
    scl_labels = {
        0: "No data", 1: "Saturated/defective", 2: "Dark area",
        3: "Cloud shadow", 4: "Vegetation", 5: "Bare soil",
        6: "Water", 7: "Unclassified", 8: "Cloud (medium)",
        9: "Cloud (high)", 10: "Cirrus", 11: "Snow/ice",
    }
    for cls, cnt in zip(unique, counts):
        pct = 100 * cnt / total_px
        label = scl_labels.get(cls, f"Unknown({cls})")
        excluded = " [EXCLUDED]" if cls in SCL_EXCLUDE else " [KEPT]"
        print(f"    SCL {cls:2d} ({label:24s}): {cnt:6,} px ({pct:5.1f}%){excluded}")

    # Valid = NOT in SCL_EXCLUDE AND B04 was not nodata (-9999)
    scl_valid = np.ones(scl.shape, dtype=bool)
    for cls in SCL_EXCLUDE:
        scl_valid &= (scl != cls)

    # Also exclude original nodata from the download step
    b04_valid = (b04 != -9999.0) & np.isfinite(b04)
    b08_valid = (b08 != -9999.0) & np.isfinite(b08)

    valid_mask = scl_valid & b04_valid & b08_valid

    valid_count = int(np.sum(valid_mask))
    masked_count = total_px - valid_count
    print()
    print(f"  Total pixels : {total_px:,}")
    print(f"  Valid pixels  : {valid_count:,} ({100 * valid_count / total_px:.1f}%)")
    print(f"  Masked pixels : {masked_count:,} ({100 * masked_count / total_px:.1f}%)")
    print()

    # ── Step 3: Calculate NDVI ────────────────────────────────────────
    print("[STEP 3] Calculating NDVI ...")

    # Initialize with NaN (invalid / nodata)
    ndvi = np.full(b04.shape, np.nan, dtype=np.float32)

    # Only compute where valid
    nir = b08[valid_mask]
    red = b04[valid_mask]
    denominator = nir + red

    # Safe division: where denominator is zero, NDVI stays NaN
    safe = denominator != 0.0
    # We need to map back: compute for the valid pixels where denominator != 0
    ndvi_values = np.full(nir.shape, np.nan, dtype=np.float32)
    ndvi_values[safe] = (nir[safe] - red[safe]) / denominator[safe]

    ndvi[valid_mask] = ndvi_values

    # Stats on valid NDVI pixels only
    finite_mask = np.isfinite(ndvi)
    ndvi_valid = ndvi[finite_mask]
    valid_ndvi_count = len(ndvi_valid)

    if valid_ndvi_count == 0:
        print("  [ERROR] No valid NDVI pixels produced!", file=sys.stderr)
        sys.exit(1)

    ndvi_min = float(np.min(ndvi_valid))
    ndvi_max = float(np.max(ndvi_valid))
    ndvi_mean = float(np.mean(ndvi_valid))
    ndvi_median = float(np.median(ndvi_valid))
    ndvi_std = float(np.std(ndvi_valid))

    print(f"  Valid NDVI pixels: {valid_ndvi_count:,}")
    print(f"  Min    : {ndvi_min:.6f}")
    print(f"  Max    : {ndvi_max:.6f}")
    print(f"  Mean   : {ndvi_mean:.6f}")
    print(f"  Median : {ndvi_median:.6f}")
    print(f"  Std    : {ndvi_std:.6f}")
    print()

    # ── Step 4: Save NDVI GeoTIFF ─────────────────────────────────────
    print("[STEP 4] Saving NDVI GeoTIFF ...")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    ndvi_profile = profile.copy()
    ndvi_profile.update(
        dtype="float32",
        count=1,
        nodata=np.nan,
        compress="deflate",
    )

    with rasterio.open(NDVI_PATH, "w", **ndvi_profile) as dst:
        dst.write(ndvi, 1)

    size_kb = NDVI_PATH.stat().st_size / 1024
    print(f"  [OK] Saved: {NDVI_PATH.name} ({size_kb:.1f} KB)")
    print(f"       CRS: {crs}")
    print(f"       Transform: {transform}")
    print()

    # ── Step 5: Save statistics JSON ──────────────────────────────────
    print("[STEP 5] Saving NDVI statistics ...")

    stats = {
        "source_scene": "see selected_scene.json",
        "raster_shape": list(b04.shape),
        "total_pixels": total_px,
        "valid_ndvi_pixels": valid_ndvi_count,
        "masked_pixels": total_px - valid_ndvi_count,
        "valid_pct": round(100 * valid_ndvi_count / total_px, 2),
        "ndvi_min": round(ndvi_min, 6),
        "ndvi_max": round(ndvi_max, 6),
        "ndvi_mean": round(ndvi_mean, 6),
        "ndvi_median": round(ndvi_median, 6),
        "ndvi_std": round(ndvi_std, 6),
        "scl_classes_excluded": sorted(SCL_EXCLUDE),
        "scl_distribution": {
            str(int(cls)): {"label": scl_labels.get(int(cls), "unknown"), "count": int(cnt)}
            for cls, cnt in zip(unique, counts)
        },
        "computed_at": datetime.utcnow().isoformat() + "Z",
    }

    STATS_PATH.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(f"  [OK] Saved: {STATS_PATH.name}")
    print()

    # ── Step 6: Generate preview PNG ──────────────────────────────────
    print("[STEP 6] Generating NDVI preview PNG ...")

    # Custom NDVI colormap: brown → yellow → green → dark green
    ndvi_colors = [
        (0.0, "#8B4513"),   # bare soil (brown)
        (0.25, "#D2B48C"),  # dry/sparse (tan)
        (0.4, "#FFFF00"),   # stressed (yellow)
        (0.5, "#ADFF2F"),   # moderate (yellow-green)
        (0.65, "#228B22"),  # healthy (forest green)
        (1.0, "#006400"),   # dense vegetation (dark green)
    ]
    cmap = LinearSegmentedColormap.from_list(
        "ndvi",
        [(pos, color) for pos, color in ndvi_colors],
        N=256,
    )
    cmap.set_bad(color="#2c2c2c", alpha=1.0)  # NaN pixels shown as dark gray

    fig, ax = plt.subplots(1, 1, figsize=(8, 7), dpi=150)

    # Display NDVI with masked NaN
    ndvi_display = np.ma.masked_invalid(ndvi)
    im = ax.imshow(
        ndvi_display,
        cmap=cmap,
        vmin=-0.2,
        vmax=0.9,
        interpolation="nearest",
    )

    cbar = fig.colorbar(im, ax=ax, shrink=0.8, pad=0.02)
    cbar.set_label("NDVI", fontsize=11)

    ax.set_title(
        f"NDVI - Nashik Agricultural Test AOI\n"
        f"Valid: {valid_ndvi_count:,} px | Mean: {ndvi_mean:.3f} | "
        f"Range: [{ndvi_min:.3f}, {ndvi_max:.3f}]",
        fontsize=10,
    )
    ax.set_xlabel("Column (10 m pixels)")
    ax.set_ylabel("Row (10 m pixels)")

    fig.tight_layout()
    fig.savefig(PREVIEW_PATH, dpi=150, bbox_inches="tight")
    plt.close(fig)

    print(f"  [OK] Saved: {PREVIEW_PATH.name}")
    print()
    print("[DONE] NDVI calculation complete.")


if __name__ == "__main__":
    main()
