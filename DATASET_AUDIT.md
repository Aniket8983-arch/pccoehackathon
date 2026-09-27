# Dataset Audit Report

**Generated**: 2026-09-26  
**Project**: Crop Stress Detection & Field Advisory Platform

---

## 1. Disease1 — Tomato Disease Dataset

| Property | Value |
|---|---|
| **Path** | `Disease1/Tomato Disease Dataset/` |
| **Crop** | Tomato |
| **Type** | Object Detection (Pascal VOC XML) |
| **Total Images** | 1,026 |
| **Image Format** | JPG (4032×3024, ~6MB each) |
| **Environment** | Real-world field photos |
| **Train/Val/Test** | None (single set per class) |

### Classes
| Class | Count |
|---|---|
| GrayMold | 82 |
| Viral | 417 |
| Wilt | 527 |

### Notes
- No healthy class available
- Pascal VOC XML annotations with bounding boxes
- High-resolution field photos
- Suitable for object detection or classification after cropping

---

## 2. Disease2 — Tomato-Village Dataset

| Property | Value |
|---|---|
| **Path** | `Disease2/Tomato-Village-main/` |
| **Crop** | Tomato |
| **Source** | Real-world field (Rajasthan, India) |
| **Citation** | Gehlot et al., Multimedia Systems (2023) |
| **Variants** | 3: Multiclass, Multi-label, Object Detection |

### Variant-a: Multiclass Classification (PRIMARY)
| Class | Train | Val | Test | Total |
|---|---|---|---|---|
| Early_blight | 347 | 99 | 50 | 496 |
| Healthy | 151 | 43 | 22 | 216 |
| Late_blight | 632 | 180 | 92 | 904 |
| Leaf Miner | 716 | 204 | 104 | 1,024 |
| Magnesium Deficiency | 655 | 187 | 95 | 937 |
| Nitrogen Deficiency | 251 | 72 | 37 | 360 |
| Pottassium Deficiency | 50 | 14 | 8 | 72 |
| Spotted Wilt Virus | 361 | 103 | 53 | 517 |
| **Total** | **3,163** | **902** | **461** | **4,526** |

### Variant-b: Multi-label Classification
- 5,653 images with CSV annotations
- Binary columns for 8 classes
- Images can have 1-3 simultaneous labels
- Includes multi-label combos (e.g., Leaf_Miner + Magnesium Deficiency)

### Variant-c: Object Detection
- Train: 11,493 images + YOLO + Pascal VOC annotations
- Val: 2,875 images + annotations

---

## 3. MaizeLeaf_dataset — Maize Leaf Classification

| Property | Value |
|---|---|
| **Path** | `MaizeLeaf_dataset/` |
| **Format** | NumPy (.npy) |
| **Image Shape** | 48×48×3 (RGB) |
| **Data Type** | float32 [0-255] |
| **Labels** | uint8 {0, 1, 2} |
| **Total** | 18,040 images |

### Split Distribution
| Split | Total | Label 0 | Label 1 | Label 2 |
|---|---|---|---|---|
| Train | 9,580 | 3,200 | 3,180 | 3,200 |
| Val | 2,395 | 875 | 609 | 911 |
| Test | 6,065 | 2,245 | 1,591 | 2,229 |

### Notes
- Label meanings NOT documented — likely: Healthy / Nitrogen Deficiency / Potassium Deficiency
- Well-balanced training set
- Very small images (48×48) — need lightweight model

---

## 4. Soil1 — IWED (Indian Water Erosion Dataset)

| Property | Value |
|---|---|
| **Path** | `Soil1/IWED (Indian Water Erosion Dataset)/` |
| **Type** | Geospatial raster data |
| **Format** | GeoTIFF, NetCDF, Excel, Shapefiles |
| **Resolution** | 250m national scale |
| **ML Trainable** | ❌ No |

Contains RUSLE model factors:
- R-factor (Rainfall erosivity)
- K-factor (Soil erodibility)
- LS-factor (Topographic)
- C-factor (Cover management)
- P-factor (Support practices)
- PSL (Potential Soil Loss)
- ESC (Erosion Severity Classes)
- SDR (Sediment Delivery Ratio)
- SSY (Specific Sediment Yield)

**Project Use**: Contextual soil erosion reference data for the field area.

---

## 5. Soil2 — IRED (Indian Rainfall Erosivity Dataset)

| Property | Value |
|---|---|
| **Path** | `Soil2/Indian Rainfall Erosivity Dataset (IRED)/` |
| **Type** | Rainfall erosivity raster data |
| **Format** | NetCDF, Excel, Shapefiles |
| **ML Trainable** | ❌ No |

Contains:
- R-Factor (Rainfall erosivity for India)
- MFI (Modified Fournier Index)
- FI (Fournier Index)

**Project Use**: Contextual rainfall erosivity reference data.

---

## Summary

| Dataset | ML Trainable | Purpose | Count |
|---|---|---|---|
| Disease2 Variant-a | ✅ PRIMARY | Tomato disease multiclass | 4,526 |
| Disease2 Variant-b | ✅ | Multi-label stress | 5,653 |
| Disease1 | ✅ | Object detection | 1,026 |
| MaizeLeaf | ✅ | Maize nutrient deficiency | 18,040 |
| Soil1 (IWED) | ❌ | Erosion reference | N/A |
| Soil2 (IRED) | ❌ | Rainfall reference | N/A |

## Stress Categories Trainable from Available Data

| Category | Trainable | Source |
|---|---|---|
| Disease (blight, virus, mold, wilt) | ✅ RGB image | Disease1, Disease2 |
| Pest (Leaf Miner) | ✅ RGB image | Disease2 |
| Nutrient (Mg, N, K deficiency) | ✅ RGB image + soil report | Disease2, soil upload |
| Water stress | ⚠️ Multimodal only | NDVI + weather + soil |
| Heat stress | ⚠️ Multimodal only | Weather + NDVI |
| Healthy | ✅ RGB image | Disease2 |
