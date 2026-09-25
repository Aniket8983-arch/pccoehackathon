import React from 'react';
import type { LayerMode, BaseMapStyle, GridMetadata } from '../types';
import { Leaf, Mountain, TrendingUp, Map, Eye } from 'lucide-react';

interface LayerToggleProps {
  currentMode: LayerMode;
  onModeChange: (mode: LayerMode) => void;
  baseMap: BaseMapStyle;
  onBaseMapChange: (style: BaseMapStyle) => void;
  metadata?: GridMetadata;
  highlightLowVeg: boolean;
  onToggleLowVeg: (highlight: boolean) => void;
}

export const LayerToggle: React.FC<LayerToggleProps> = ({
  currentMode,
  onModeChange,
  baseMap,
  onBaseMapChange,
  metadata,
  highlightLowVeg,
  onToggleLowVeg
}) => {
  return (
    <div className="card layer-toggle-card">
      <div className="card-header">
        <div className="card-title">
          <Eye className="icon-sm text-emerald-400" />
          <span>Layer & Raster View Selector</span>
        </div>
      </div>

      <div className="card-body">
        {/* Layer Mode Pills */}
        <div className="mode-toggle-group">
          <button
            onClick={() => onModeChange('ndvi')}
            className={`mode-btn ${currentMode === 'ndvi' ? 'active-ndvi' : ''}`}
          >
            <Leaf className="icon-xs" />
            <div className="mode-btn-text">
              <span className="mode-name">NDVI</span>
              <span className="mode-sub">Vegetation Index</span>
            </div>
          </button>

          <button
            onClick={() => onModeChange('elevation')}
            className={`mode-btn ${currentMode === 'elevation' ? 'active-elevation' : ''}`}
          >
            <Mountain className="icon-xs" />
            <div className="mode-btn-text">
              <span className="mode-name">Elevation</span>
              <span className="mode-sub">Copernicus DEM</span>
            </div>
          </button>

          <button
            onClick={() => onModeChange('slope')}
            className={`mode-btn ${currentMode === 'slope' ? 'active-slope' : ''}`}
          >
            <TrendingUp className="icon-xs" />
            <div className="mode-btn-text">
              <span className="mode-name">Slope</span>
              <span className="mode-sub">Terrain Gradient</span>
            </div>
          </button>
        </div>

        {/* Current Mode Statistics Range */}
        {metadata && (
          <div className="range-summary-box">
            {currentMode === 'ndvi' && (
              <div className="range-summary">
                <span className="range-label">NDVI Range:</span>
                <span className="range-values">{metadata.ndvi_range[0].toFixed(3)} to {metadata.ndvi_range[1].toFixed(3)}</span>
              </div>
            )}
            {currentMode === 'elevation' && (
              <div className="range-summary">
                <span className="range-label">Elevation Range:</span>
                <span className="range-values">{metadata.elevation_range_m[0].toFixed(1)} m to {metadata.elevation_range_m[1].toFixed(1)} m</span>
              </div>
            )}
            {currentMode === 'slope' && (
              <div className="range-summary">
                <span className="range-label">Slope Range:</span>
                <span className="range-values">{metadata.slope_range_deg[0].toFixed(2)}° to {metadata.slope_range_deg[1].toFixed(2)}°</span>
              </div>
            )}
          </div>
        )}

        {/* Highlight Low Vegetation Checkbox */}
        {currentMode === 'ndvi' && (
          <label className="checkbox-toggle">
            <input 
              type="checkbox"
              checked={highlightLowVeg}
              onChange={(e) => onToggleLowVeg(e.target.checked)}
            />
            <span className="checkbox-label">Highlight Low Vegetation (&lt; 0.2 NDVI)</span>
          </label>
        )}

        {/* Base Map Selector */}
        <div className="basemap-selector">
          <span className="basemap-label">
            <Map className="icon-xs text-sky-400" />
            <span>Base Map Tile:</span>
          </span>
          <div className="basemap-buttons">
            <button
              onClick={() => onBaseMapChange('satellite')}
              className={`basemap-btn ${baseMap === 'satellite' ? 'active' : ''}`}
            >
              Satellite
            </button>
            <button
              onClick={() => onBaseMapChange('dark')}
              className={`basemap-btn ${baseMap === 'dark' ? 'active' : ''}`}
            >
              Dark
            </button>
            <button
              onClick={() => onBaseMapChange('streets')}
              className={`basemap-btn ${baseMap === 'streets' ? 'active' : ''}`}
            >
              Streets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
