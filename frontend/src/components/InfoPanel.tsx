import React, { useState } from 'react';
import type { GridMetadata } from '../types';
import { Info, ChevronDown, ChevronUp, Database, Satellite, Mountain, Compass, Grid } from 'lucide-react';

interface InfoPanelProps {
  metadata: GridMetadata;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ metadata }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="card info-panel">
      <div 
        className="card-header" 
        onClick={() => setCollapsed(!collapsed)}
        style={{ cursor: 'pointer' }}
      >
        <div className="card-title">
          <Info className="icon-sm text-sky-400" />
          <span>Pipeline & Data Metadata</span>
        </div>
        <button className="icon-button" aria-label="Toggle panel">
          {collapsed ? <ChevronDown className="icon-xs" /> : <ChevronUp className="icon-xs" />}
        </button>
      </div>

      {!collapsed && (
        <div className="card-body grid-meta-list">
          <div className="meta-item">
            <span className="meta-label">
              <Compass className="icon-xs text-sky-400" />
              <span>AOI Bounding Box</span>
            </span>
            <span className="meta-value code">
              [{metadata.aoi_bbox_4326.join(', ')}]
            </span>
          </div>

          <div className="meta-item">
            <span className="meta-label">
              <Satellite className="icon-xs text-emerald-400" />
              <span>Sentinel-2 Scene</span>
            </span>
            <span className="meta-value truncate" title={metadata.sentinel2_scene_id}>
              {metadata.sentinel2_scene_id}
            </span>
          </div>

          <div className="meta-item">
            <span className="meta-label">
              <Satellite className="icon-xs text-emerald-400" />
              <span>Acquisition Date</span>
            </span>
            <span className="meta-value">
              {new Date(metadata.sentinel2_datetime).toUTCString()}
            </span>
          </div>

          <div className="meta-item">
            <span className="meta-label">
              <Mountain className="icon-xs text-amber-400" />
              <span>DEM Source</span>
            </span>
            <span className="meta-value highlight-dem">
              {metadata.dem_source}
            </span>
          </div>

          <div className="meta-item">
            <span className="meta-label">
              <Database className="icon-xs text-indigo-400" />
              <span>Grid CRS</span>
            </span>
            <span className="meta-value code">
              {metadata.crs}
            </span>
          </div>

          <div className="meta-item">
            <span className="meta-label">
              <Grid className="icon-xs text-purple-400" />
              <span>Grid Resolution</span>
            </span>
            <span className="meta-value">
              {metadata.grid_rows} rows × {metadata.grid_cols} cols (~{metadata.pixel_size_m.dx}m × {metadata.pixel_size_m.dy}m)
            </span>
          </div>

          <div className="meta-stats-row">
            <div className="mini-stat">
              <div className="mini-stat-val">{metadata.total_cells.toLocaleString()}</div>
              <div className="mini-stat-lbl">Total Cells</div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat-val text-emerald-400">{metadata.valid_cells.toLocaleString()}</div>
              <div className="mini-stat-lbl">Valid Cells</div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat-val text-amber-400">{metadata.low_vegetation_cell_count.toLocaleString()}</div>
              <div className="mini-stat-lbl">Low NDVI (&lt;0.2)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
