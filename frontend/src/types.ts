export interface GridMetadata {
  aoi_bbox_4326: [number, number, number, number]; // [west, south, east, north]
  crs: string;
  pixel_size_m: {
    dx: number;
    dy: number;
  };
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
  ndvi_range: [number, number];
  elevation_range_m: [number, number];
  slope_range_deg: [number, number];
  generated_at: string;
}

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
  low_vegetation_index: boolean;
}

export interface GridData {
  metadata: GridMetadata;
  cells: GridCell[];
}

export type LayerMode = 'ndvi' | 'elevation' | 'slope';

export type BaseMapStyle = 'satellite' | 'dark' | 'streets';
