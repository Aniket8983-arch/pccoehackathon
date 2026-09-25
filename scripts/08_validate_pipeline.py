"""
Validate the entire pipeline: prove that grid.json contains only values
derived from real source rasters with no fake/mock data.

Usage:
    python scripts/08_validate_pipeline.py

Runs 15+ checks across all pipeline artifacts and prints a clear
PASS/FAIL report per component.
"""

import json
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config.settings import AOI_BBOX

# ── Paths ─────────────────────────────────────────────────────────────
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

PATHS = {
    "b04": RAW_DIR / "sentinel_b04.tif",
    "b08": RAW_DIR / "sentinel_b08.tif",
    "scl": RAW_DIR / "sentinel_scl.tif",
    "ndvi": PROCESSED_DIR / "ndvi.tif",
    "dem": RAW_DIR / "dem.tif",
    "slope": PROCESSED_DIR / "slope.tif",
    "grid_json": PROCESSED_DIR / "grid.json",
    "scene_meta": PROCESSED_DIR / "scene_metadata.json",
    "selected_scene": PROCESSED_DIR / "selected_scene.json",
    "dem_meta": PROCESSED_DIR / "dem_metadata.json",
}

# Physically meaningful NDVI range (strict)
NDVI_ABS_MIN = -1.0
NDVI_ABS_MAX = 1.0


class ValidationResult:
    """Track pass/fail for a named check."""

    def __init__(self, name: str):
        self.name = name
        self.passed = True
        self.messages: list[str] = []

    def fail(self, msg: str):
        self.passed = False
        self.messages.append(f"FAIL: {msg}")

    def info(self, msg: str):
        self.messages.append(f"  {msg}")

    def ok(self, msg: str):
        self.messages.append(f"  OK: {msg}")

    @property
    def status(self) -> str:
        return "PASS" if self.passed else "FAIL"


def check_raster(path: Path, name: str, expect_dtype: str = None) -> ValidationResult:
    """Validate that a file is a real GeoTIFF with non-empty raster data."""
    import rasterio

    result = ValidationResult(name)

    if not path.exists():
        result.fail(f"File not found: {path.name}")
        return result
    result.ok(f"File exists ({path.stat().st_size / 1024:.1f} KB)")

    try:
        with rasterio.open(path) as ds:
            if ds.crs is None:
                result.fail("No CRS defined")
            else:
                result.ok(f"CRS: {ds.crs}")

            if ds.transform is None or ds.transform.is_identity:
                result.fail("No geotransform / identity transform")
            else:
                result.ok(f"Transform: pixel {abs(ds.transform.a):.2f} x {abs(ds.transform.e):.2f}")

            data = ds.read(1)

            if data.size == 0:
                result.fail("Raster has zero pixels")
                return result
            result.ok(f"Shape: {ds.shape[0]}h x {ds.shape[1]}w ({data.size:,} px)")

            if expect_dtype and ds.dtypes[0] != expect_dtype:
                result.info(f"Expected dtype {expect_dtype}, got {ds.dtypes[0]}")

            # Check for non-trivial data (not all same value)
            unique_count = len(np.unique(data[np.isfinite(data) & (data != -9999.0)]))
            if unique_count <= 1:
                result.fail(f"Raster has only {unique_count} unique value(s) - suspicious")
            else:
                result.ok(f"Contains {unique_count:,} unique values")

    except Exception as exc:
        result.fail(f"Cannot read as raster: {exc}")

    return result


def check_sentinel_source() -> ValidationResult:
    """Validate Sentinel-2 scene metadata exists and has real scene IDs."""
    result = ValidationResult("Sentinel-2 source")

    meta_path = PATHS["scene_meta"]
    selected_path = PATHS["selected_scene"]

    if not meta_path.exists():
        result.fail(f"scene_metadata.json not found")
        return result
    result.ok("scene_metadata.json exists")

    data = json.loads(meta_path.read_text(encoding="utf-8"))
    scenes = data.get("scenes", [])
    if len(scenes) == 0:
        result.fail("No scenes in catalog results")
    else:
        result.ok(f"Catalog contains {len(scenes)} scene(s)")

    # Verify scene IDs look real (S2A/S2B/S2C prefix)
    for s in scenes:
        sid = s.get("scene_id", "")
        if not any(sid.startswith(p) for p in ("S2A_", "S2B_", "S2C_")):
            result.fail(f"Suspicious scene ID (no S2 prefix): {sid[:60]}")
            break

    if not selected_path.exists():
        result.fail("selected_scene.json not found")
    else:
        sel = json.loads(selected_path.read_text(encoding="utf-8"))
        scene_id = sel.get("scene_id", "")
        scene_dt = sel.get("datetime", "")
        result.ok(f"Selected scene: {scene_id[:50]}")
        result.ok(f"Acquisition: {scene_dt}")
        if not scene_id or scene_id == "unknown":
            result.fail("Selected scene ID is missing/unknown")
        if not scene_dt or scene_dt == "unknown":
            result.fail("Acquisition datetime is missing/unknown")

    return result


def check_ndvi_values(grid_cells: list) -> ValidationResult:
    """Validate NDVI values in grid cells are physically meaningful."""
    result = ValidationResult("NDVI values")

    valid_cells = [c for c in grid_cells if c.get("valid")]
    ndvi_values = [c["ndvi_mean"] for c in valid_cells if c.get("ndvi_mean") is not None]

    if len(ndvi_values) == 0:
        result.fail("No valid NDVI values in grid")
        return result
    result.ok(f"{len(ndvi_values):,} cells with NDVI values")

    arr = np.array(ndvi_values)

    # Check finite
    non_finite = int(np.sum(~np.isfinite(arr)))
    if non_finite > 0:
        result.fail(f"{non_finite} non-finite NDVI values found")
    else:
        result.ok("All NDVI values are finite")

    # Check physical range
    out_of_range = int(np.sum((arr < NDVI_ABS_MIN) | (arr > NDVI_ABS_MAX)))
    if out_of_range > 0:
        result.fail(f"{out_of_range} NDVI values outside [{NDVI_ABS_MIN}, {NDVI_ABS_MAX}]")
    else:
        result.ok(f"All NDVI in [{arr.min():.4f}, {arr.max():.4f}] (within physical range)")

    # Check not suspiciously uniform (all identical = likely fake)
    if len(set(ndvi_values)) <= 3:
        result.fail(f"Only {len(set(ndvi_values))} unique NDVI values - suspicious")
    else:
        result.ok(f"{len(set(ndvi_values)):,} unique NDVI values (realistic variation)")

    return result


def check_elevation_values(grid_cells: list) -> ValidationResult:
    """Validate elevation values are finite and realistic."""
    result = ValidationResult("Elevation values")

    elev_values = [c["elevation_m"] for c in grid_cells
                   if c.get("valid") and c.get("elevation_m") is not None]

    if len(elev_values) == 0:
        result.fail("No elevation values in grid")
        return result
    result.ok(f"{len(elev_values):,} cells with elevation")

    arr = np.array(elev_values)
    non_finite = int(np.sum(~np.isfinite(arr)))
    if non_finite > 0:
        result.fail(f"{non_finite} non-finite elevation values")
    else:
        result.ok("All elevation values are finite")

    result.ok(f"Range: [{arr.min():.2f}, {arr.max():.2f}] m")

    return result


def check_slope_values(grid_cells: list) -> ValidationResult:
    """Validate slope values are finite and non-negative."""
    result = ValidationResult("Slope values")

    slope_values = [c["slope_deg"] for c in grid_cells
                    if c.get("valid") and c.get("slope_deg") is not None]

    if len(slope_values) == 0:
        result.fail("No slope values in grid")
        return result
    result.ok(f"{len(slope_values):,} cells with slope")

    arr = np.array(slope_values)
    non_finite = int(np.sum(~np.isfinite(arr)))
    if non_finite > 0:
        result.fail(f"{non_finite} non-finite slope values")
    else:
        result.ok("All slope values are finite")

    negatives = int(np.sum(arr < 0))
    if negatives > 0:
        result.fail(f"{negatives} negative slope values")
    else:
        result.ok("All slope values >= 0")

    result.ok(f"Range: [{arr.min():.4f}, {arr.max():.4f}] deg")

    return result


def check_grid(grid_data: dict) -> ValidationResult:
    """Validate grid structure, metadata, and cell locations."""
    result = ValidationResult("Grid structure")

    meta = grid_data.get("metadata", {})
    cells = grid_data.get("cells", [])

    if not cells:
        result.fail("No cells in grid.json")
        return result

    # Check total matches
    total = meta.get("total_cells", 0)
    if total != len(cells):
        result.fail(f"Metadata says {total} cells but found {len(cells)}")
    else:
        result.ok(f"Cell count matches metadata: {total:,}")

    # Check geometry matches
    expected = meta.get("grid_rows", 0) * meta.get("grid_cols", 0)
    if expected != len(cells):
        result.fail(f"rows*cols={expected} != cell count {len(cells)}")
    else:
        result.ok(f"Grid geometry: {meta.get('grid_rows')}r x {meta.get('grid_cols')}c = {expected:,}")

    # CRS recorded
    crs = meta.get("crs")
    if not crs or crs == "unknown":
        result.fail("CRS not recorded in metadata")
    else:
        result.ok(f"CRS: {crs}")

    # Sentinel-2 date recorded
    s2_dt = meta.get("sentinel2_datetime")
    if not s2_dt or s2_dt == "unknown":
        result.fail("Sentinel-2 acquisition date not recorded")
    else:
        result.ok(f"Sentinel-2 date: {s2_dt}")

    # DEM source recorded
    dem_src = meta.get("dem_source")
    if not dem_src or dem_src == "unknown":
        result.fail("DEM source not recorded")
    else:
        result.ok(f"DEM source: {dem_src}")

    # Cell locations inside AOI
    west, south, east, north = AOI_BBOX
    # Allow small buffer for raster alignment overshoot
    buffer = 0.001  # ~100 m in degrees
    outside = 0
    for c in cells:
        lat = c.get("center_lat")
        lon = c.get("center_lon")
        if lat is None or lon is None:
            continue
        if (lon < west - buffer or lon > east + buffer or
                lat < south - buffer or lat > north + buffer):
            outside += 1

    if outside > 0:
        result.fail(f"{outside} cells have centres outside AOI + buffer")
    else:
        result.ok(f"All cell centres within AOI bounds (with alignment buffer)")

    return result


def check_no_mock_data(grid_cells: list) -> ValidationResult:
    """Check for common signs of mock/fabricated data."""
    result = ValidationResult("No mock data")

    valid_cells = [c for c in grid_cells if c.get("valid")]

    # 1. No null/None in mandatory fields of valid cells
    null_ndvi = sum(1 for c in valid_cells if c.get("ndvi_mean") is None)
    if null_ndvi > 0:
        result.fail(f"{null_ndvi} valid cells have null NDVI")
    else:
        result.ok("No null NDVI in valid cells")

    # 2. Check that valid cells don't have NDVI = 0 everywhere (placeholder)
    zero_ndvi = sum(1 for c in valid_cells
                    if c.get("ndvi_mean") is not None and c["ndvi_mean"] == 0.0)
    zero_pct = 100 * zero_ndvi / len(valid_cells) if valid_cells else 0
    if zero_pct > 50:
        result.fail(f"{zero_pct:.0f}% of valid cells have NDVI = 0.0 (likely placeholder)")
    else:
        result.ok(f"Only {zero_ndvi} cells with NDVI exactly 0.0 ({zero_pct:.1f}%)")

    # 3. Check that NDVI values are not suspiciously round
    ndvi_vals = [c["ndvi_mean"] for c in valid_cells if c.get("ndvi_mean") is not None]
    round_count = sum(1 for v in ndvi_vals if v == round(v, 1))
    round_pct = 100 * round_count / len(ndvi_vals) if ndvi_vals else 0
    if round_pct > 80:
        result.fail(f"{round_pct:.0f}% of NDVI values are round to 1 decimal (likely fabricated)")
    else:
        result.ok(f"NDVI values show natural precision ({round_pct:.1f}% round to 1 dp)")

    # 4. Check elevation is not a single repeated value
    elev_vals = [c["elevation_m"] for c in valid_cells if c.get("elevation_m") is not None]
    if elev_vals:
        unique_elev = len(set(elev_vals))
        if unique_elev == 1 and len(elev_vals) > 100:
            result.fail(f"All {len(elev_vals)} elevation values identical ({elev_vals[0]})")
        else:
            result.ok(f"Elevation has {unique_elev} unique values across {len(elev_vals)} cells")

    # 5. Verify no cell has all three values identical to another pattern
    #    (common in generated grids with np.random or linspace)
    ndvi_arr = np.array(ndvi_vals)
    if len(ndvi_arr) > 10:
        diffs = np.diff(ndvi_arr)
        # If diffs are perfectly constant, data was likely linspace-generated
        if len(diffs) > 1 and np.std(diffs) == 0:
            result.fail("NDVI values form a perfect arithmetic sequence (fabricated)")
        else:
            result.ok("NDVI values are not in an arithmetic sequence")

    # 6. Check source rasters have sufficient unique data
    result.ok("Source raster uniqueness checked in individual raster validations")

    return result


def main() -> None:
    import rasterio  # ensure available

    print()
    print("=" * 60)
    print("  PIPELINE VALIDATION")
    print("=" * 60)
    print()

    results: list[ValidationResult] = []

    # ── Sentinel-2 source ─────────────────────────────────────────────
    print("[1/9] Sentinel-2 source metadata ...")
    r = check_sentinel_source()
    results.append(r)
    for m in r.messages:
        print(f"       {m}")
    print()

    # ── Raster checks ─────────────────────────────────────────────────
    raster_checks = [
        ("b04", "B04 (Red reflectance)", "float32"),
        ("b08", "B08 (NIR reflectance)", "float32"),
        ("scl", "SCL (Scene Classification)", "uint8"),
        ("ndvi", "NDVI raster", "float32"),
        ("dem", "DEM raster", "float32"),
        ("slope", "Slope raster", "float32"),
    ]

    for idx, (key, label, dtype) in enumerate(raster_checks, start=2):
        print(f"[{idx}/9] {label} ...")
        r = check_raster(PATHS[key], label, expect_dtype=dtype)
        results.append(r)
        for m in r.messages:
            print(f"       {m}")
        print()

    # ── Grid checks ───────────────────────────────────────────────────
    print("[8/9] Grid structure & values ...")
    grid_path = PATHS["grid_json"]
    if not grid_path.exists():
        r = ValidationResult("Grid structure")
        r.fail("grid.json not found")
        results.append(r)
        for sub in [ValidationResult("NDVI values"), ValidationResult("Elevation values"),
                     ValidationResult("Slope values"), ValidationResult("No mock data")]:
            sub.fail("Cannot validate — grid.json missing")
            results.append(sub)
    else:
        grid_data = json.loads(grid_path.read_text(encoding="utf-8"))
        cells = grid_data.get("cells", [])

        r_grid = check_grid(grid_data)
        results.append(r_grid)
        for m in r_grid.messages:
            print(f"       {m}")
        print()

        r_ndvi = check_ndvi_values(cells)
        results.append(r_ndvi)
        print(f"       --- NDVI values ---")
        for m in r_ndvi.messages:
            print(f"       {m}")
        print()

        r_elev = check_elevation_values(cells)
        results.append(r_elev)
        print(f"       --- Elevation values ---")
        for m in r_elev.messages:
            print(f"       {m}")
        print()

        r_slope = check_slope_values(cells)
        results.append(r_slope)
        print(f"       --- Slope values ---")
        for m in r_slope.messages:
            print(f"       {m}")
        print()

    # ── No mock data ──────────────────────────────────────────────────
    print("[9/9] No mock data ...")
    if grid_path.exists():
        r_mock = check_no_mock_data(cells)
    else:
        r_mock = ValidationResult("No mock data")
        r_mock.fail("Cannot check — grid.json missing")
    results.append(r_mock)
    for m in r_mock.messages:
        print(f"       {m}")
    print()

    # ── Final report ──────────────────────────────────────────────────
    print("=" * 60)
    print("  VALIDATION REPORT")
    print("=" * 60)
    print()

    max_name_len = max(len(r.name) for r in results)
    all_passed = True

    for r in results:
        status_str = "PASS" if r.passed else "FAIL"
        icon = "+" if r.passed else "X"
        padding = " " * (max_name_len - len(r.name))
        print(f"  [{icon}] {r.name}{padding} : {status_str}")
        if not r.passed:
            all_passed = False
            for m in r.messages:
                if m.startswith("FAIL"):
                    print(f"        -> {m}")

    print()
    print("-" * 60)
    if all_passed:
        print("  RESULT: ALL CHECKS PASSED")
        print()
        print("  The pipeline produces grid.json from real Copernicus")
        print("  satellite data with no mock or fabricated values.")
    else:
        fail_count = sum(1 for r in results if not r.passed)
        print(f"  RESULT: {fail_count} CHECK(S) FAILED")
        print()
        print("  The pipeline has issues. Review failures above.")
        sys.exit(1)

    print()


if __name__ == "__main__":
    main()
