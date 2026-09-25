import type { LayerMode } from '../types';

export function getNdviColor(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '#475569'; // Unavailable / Invalid pixel
  if (val < 0.0) return '#8c510a';  // Water / Non-vegetation / Dark Soil
  if (val < 0.15) return '#d8b365'; // Bare Soil / Dry Ground
  if (val < 0.25) return '#f6e8c3'; // Low Vegetation / Sparse Sprouts
  if (val < 0.40) return '#a1d99b'; // Light Crop Canopy
  if (val < 0.55) return '#41ab5d'; // Healthy Crop Canopy
  if (val < 0.70) return '#238b45'; // Dense Canopy
  return '#005a32';                 // Lush High-Density Vegetation
}

export function getElevationColor(val: number | null | undefined, minElev = 544.0, maxElev = 554.0): string {
  if (val === null || val === undefined || isNaN(val)) return '#475569';
  // Normalize value between 0 and 1
  const t = Math.max(0, Math.min(1, (val - minElev) / (maxElev - minElev || 1)));
  
  // Custom 4-stop gradient: Teal -> Cyan -> Gold -> Coral Red
  if (t < 0.33) {
    // #2b83ba to #abdda4
    const localT = t / 0.33;
    return interpolateColor('#2b83ba', '#abdda4', localT);
  } else if (t < 0.66) {
    // #abdda4 to #fdae61
    const localT = (t - 0.33) / 0.33;
    return interpolateColor('#abdda4', '#fdae61', localT);
  } else {
    // #fdae61 to #d7191c
    const localT = (t - 0.66) / 0.34;
    return interpolateColor('#fdae61', '#d7191c', localT);
  }
}

export function getSlopeColor(val: number | null | undefined, minSlope = 0.0, maxSlope = 2.2): string {
  if (val === null || val === undefined || isNaN(val)) return '#475569';
  const t = Math.max(0, Math.min(1, (val - minSlope) / (maxSlope - minSlope || 1)));
  
  // Gradient for slope: Flat Soft Green -> Mild Yellow -> Steep Red
  if (t < 0.5) {
    const localT = t / 0.5;
    return interpolateColor('#e6f598', '#fee08b', localT);
  } else {
    const localT = (t - 0.5) / 0.5;
    return interpolateColor('#fee08b', '#f46d43', localT);
  }
}

export function getCellColor(
  cell: { valid: boolean; ndvi_mean: number | null; elevation_m: number | null; slope_deg: number | null },
  mode: LayerMode,
  elevRange: [number, number] = [544.4, 553.2],
  slopeRange: [number, number] = [0.05, 2.13]
): string {
  if (!cell.valid) return '#475569';
  
  switch (mode) {
    case 'ndvi':
      return getNdviColor(cell.ndvi_mean);
    case 'elevation':
      return getElevationColor(cell.elevation_m, elevRange[0], elevRange[1]);
    case 'slope':
      return getSlopeColor(cell.slope_deg, slopeRange[0], slopeRange[1]);
    default:
      return getNdviColor(cell.ndvi_mean);
  }
}

function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}
