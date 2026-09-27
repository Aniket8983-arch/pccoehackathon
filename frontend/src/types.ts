export interface GridMetadata {
  aoi_bbox_4326: [number, number, number, number];
  crs: string;
  pixel_size_m: { dx: number; dy: number };
  grid_rows: number;
  grid_cols: number;
  total_cells: number;
  valid_cells: number;
  invalid_cells: number;
  sentinel2_scene_id: string;
  sentinel2_datetime: string;
  dem_source: string;
  low_vegetation_ndvi_threshold: number;
  low_vegetation_cell_count: number;
  ndvi_range: [number, number] | null;
  elevation_range_m: [number, number] | null;
  slope_range_deg: [number, number] | null;
  generated_at: string;
  intelligence_updated_at?: string;
  weather_summary?: {
    past_7d_precip_mm: number;
    past_7d_et0_mm: number;
    water_deficit_mm: number;
    avg_tmax_c: number;
  };
}

export interface StressData {
  score: number;
  level: 'Low' | 'Moderate' | 'High' | 'Critical';
  factors: string[];
  recommendation: string;
}

export type StressType = 'none' | 'overall' | 'water' | 'heat' | 'disease' | 'vegetation';

export interface GridCell {
  cell_id: string;
  row: number;
  col: number;
  center_lat: number;
  center_lon: number;
  bbox_utm: [number, number, number, number];
  valid: boolean;
  valid_pixel_count: number;
  ndvi_mean: number | null;
  ndvi_min: number | null;
  ndvi_max: number | null;
  elevation_m: number | null;
  slope_deg: number | null;
  low_vegetation_index: boolean | null;
  
  stress_overall?: StressData;
  stress_water?: StressData;
  stress_heat?: StressData;
  stress_disease?: StressData;
  stress_vegetation?: StressData;

  // Legacy fields for backward compatibility
  stress_score?: number;
  stress_level?: 'None' | 'Low' | 'Moderate' | 'High' | 'Critical';
  stress_factors?: string[];
  recommendation?: string;
}

export interface GridData {
  metadata: GridMetadata;
  cells: GridCell[];
}

// Satellite View = real satellite imagery on terrain
// NDVI View = NDVI color-coded overlay on terrain
// Satellite + NDVI View = satellite with semi-transparent NDVI highlights
export type VisualizationMode = 'satellite' | 'ndvi' | 'satellite-ndvi';

export interface TerrainDataPayload {
  rows: number;
  cols: number;
  elevations: number[][];
  ndvi: number[][];
  min_elevation: number;
  max_elevation: number;
  min_ndvi: number;
  max_ndvi: number;
  bbox: [number, number, number, number];
}

// ── Part B + C Types ─────────────────────────────────────────────────
export interface ImageAnalysisResult {
  crop: { name: string; confidence: number };
  predictions: Array<{ class_name: string; confidence: number }>;
  stress: {
    disease: StressLevel;
    water: StressLevel;
    heat: StressLevel;
    nutrient: StressLevel;
    pest: StressLevel;
  };
}

export interface StressLevel {
  level: string;
  confidence: number;
  possible_conditions?: string[];
  evidence?: string[];
}

export interface SoilParameter {
  value: number | string | null;
  unit: string;
  status: string;
  reference_range: string;
}

export interface SoilAnalysisResult {
  parameters: Record<string, SoilParameter>;
  extraction_method: string;
  confidence: string;
}

export interface FullAnalysisResult {
  analysis_id: string;
  timestamp: string;
  stress_assessment: Record<string, StressLevel>;
  recommendations: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  evidence?: string[];
  map_action?: { type: string; cell_id: string; lat: number; lon: number } | null;
}
