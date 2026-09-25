import React from 'react';
import type { LayerMode, GridMetadata } from '../types';

interface LegendProps {
  mode: LayerMode;
  metadata?: GridMetadata;
}

export const Legend: React.FC<LegendProps> = ({ mode, metadata }) => {
  return (
    <div className="card legend-card">
      <div className="legend-header">
        <span className="legend-title">
          {mode === 'ndvi' && 'NDVI Color Legend'}
          {mode === 'elevation' && 'Elevation Legend (m)'}
          {mode === 'slope' && 'Slope Gradient Legend (°)'}
        </span>
      </div>

      <div className="legend-body">
        {mode === 'ndvi' && (
          <div className="ndvi-legend-items">
            <div className="gradient-bar ndvi-gradient"></div>
            <div className="legend-ticks">
              <span>-0.1</span>
              <span>0.0</span>
              <span>0.2</span>
              <span>0.4</span>
              <span>0.6</span>
              <span>0.8+</span>
            </div>
            <div className="legend-labels-grid">
              <span className="lbl-soil">Soil / Water</span>
              <span className="lbl-low">Sparse Veg</span>
              <span className="lbl-med">Moderate</span>
              <span className="lbl-lush">Lush Canopy</span>
            </div>
          </div>
        )}

        {mode === 'elevation' && (
          <div className="elevation-legend-items">
            <div className="gradient-bar elevation-gradient"></div>
            <div className="legend-ticks">
              <span>{metadata ? metadata.elevation_range_m[0].toFixed(1) : '544.4'} m</span>
              <span>{metadata ? ((metadata.elevation_range_m[0] + metadata.elevation_range_m[1]) / 2).toFixed(1) : '548.8'} m</span>
              <span>{metadata ? metadata.elevation_range_m[1].toFixed(1) : '553.2'} m</span>
            </div>
          </div>
        )}

        {mode === 'slope' && (
          <div className="slope-legend-items">
            <div className="gradient-bar slope-gradient"></div>
            <div className="legend-ticks">
              <span>{metadata ? metadata.slope_range_deg[0].toFixed(2) : '0.05'}° (Flat)</span>
              <span>{metadata ? ((metadata.slope_range_deg[0] + metadata.slope_range_deg[1]) / 2).toFixed(2) : '1.09'}°</span>
              <span>{metadata ? metadata.slope_range_deg[1].toFixed(2) : '2.13'}° (Steep)</span>
            </div>
          </div>
        )}

        {/* Unavailable / NoData cell key */}
        <div className="nodata-key flex items-center gap-2 mt-3 pt-2 border-t border-slate-700/50">
          <span className="nodata-swatch"></span>
          <span className="text-xs text-slate-400">Gray Swatch = Masked / Invalid / Unavailable Pixel</span>
        </div>
      </div>
    </div>
  );
};
