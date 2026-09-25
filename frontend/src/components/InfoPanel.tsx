import React, { useState } from 'react';
import { MapPin, Sprout, Satellite, Mountain, Calendar, Grid3x3, Maximize, Database, Map, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { GridMetadata } from '../types';

interface InfoPanelProps {
  metadata: GridMetadata;
  satelliteLoaded: boolean;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ metadata, satelliteLoaded }) => {
  const [farmExpanded, setFarmExpanded] = useState(false);
  const [weatherExpanded, setWeatherExpanded] = useState(false);
  const [dataExpanded, setDataExpanded] = useState(false);

  const bbox = metadata.aoi_bbox_4326;
  const centerLat = bbox ? ((bbox[1] + bbox[3]) / 2).toFixed(5) : 'Unknown';
  const centerLon = bbox ? ((bbox[0] + bbox[2]) / 2).toFixed(5) : 'Unknown';
  const areaWidthM = bbox ? Math.round((bbox[2] - bbox[0]) * 111320 * Math.cos(((bbox[1] + bbox[3]) / 2) * Math.PI / 180)) : 0;
  const areaHeightM = bbox ? Math.round((bbox[3] - bbox[1]) * 111320) : 0;
  const acquisitionDate = metadata.sentinel2_datetime
    ? new Date(metadata.sentinel2_datetime).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  return (
    <>
      {/* Location & Crop Card */}
      <div className="card" style={{ borderLeft: '3px solid #10b981' }}>
        <div className="card-header card-header-clickable" onClick={() => setFarmExpanded(!farmExpanded)}>
          <span className="card-title"><Info className="icon-sm" style={{ color: '#10b981' }} /> Farm Information</span>
          {farmExpanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
        </div>
        {farmExpanded && (
        <div className="card-body" style={{ padding: '0.8rem' }}>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.5 }}>
            Viewing a tomato field in Maharashtra, India.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.72rem', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin className="icon-xs" style={{ color: '#38bdf8', flexShrink: 0 }} />
              <span><b style={{ color: '#cbd5e1' }}>Latitude:</b> {centerLat}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin className="icon-xs" style={{ color: '#38bdf8', flexShrink: 0 }} />
              <span><b style={{ color: '#cbd5e1' }}>Longitude:</b> {centerLon}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sprout className="icon-xs" style={{ color: '#22c55e', flexShrink: 0 }} />
              <span><b style={{ color: '#cbd5e1' }}>Crop:</b> Tomato</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Maximize className="icon-xs" style={{ color: '#a78bfa', flexShrink: 0 }} />
              <span><b style={{ color: '#cbd5e1' }}>Area:</b> Approximately {areaWidthM} m × {areaHeightM} m</span>
            </div>
          </div>
          <div style={{ marginTop: '0.4rem', fontSize: '0.6rem', color: '#64748b', fontStyle: 'italic' }}>
            Crop type supplied for this field.
          </div>
        </div>
        )}
      </div>

      {/* Weather Summary Card */}
      {metadata.weather_summary && (
        <div className="card">
          <div className="card-header card-header-clickable" onClick={() => setWeatherExpanded(!weatherExpanded)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar className="icon-sm" style={{ color: '#fbbf24' }} />
              <span className="card-title" style={{ display: 'inline' }}>Past 7 Days Weather</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Open-Meteo</span>
              {weatherExpanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
            </div>
          </div>
          {weatherExpanded && (
          <div className="card-body">
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div className="mini-stat" style={{ flex: 1 }}>
                <div className="mini-stat-val" style={{ color: '#38bdf8' }}>{metadata.weather_summary.past_7d_precip_mm} mm</div>
                <div className="mini-stat-lbl">Precipitation</div>
              </div>
              <div className="mini-stat" style={{ flex: 1 }}>
                <div className="mini-stat-val" style={{ color: '#f87171' }}>{metadata.weather_summary.past_7d_et0_mm} mm</div>
                <div className="mini-stat-lbl">Evapotranspiration</div>
              </div>
            </div>
            
            <div style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: '#cbd5e1' }}>Water Deficit:</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: metadata.weather_summary.water_deficit_mm > 10 ? '#ef4444' : '#34d399' }}>
                {metadata.weather_summary.water_deficit_mm > 0 ? '-' : '+'}{Math.abs(metadata.weather_summary.water_deficit_mm)} mm
              </span>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Data Sources Card */}
      <div className="card">
        <div className="card-header card-header-clickable" onClick={() => setDataExpanded(!dataExpanded)}>
          <span className="card-title"><Database className="icon-sm" style={{ color: '#a78bfa' }} /> Data Sources</span>
          {dataExpanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
        </div>
        {dataExpanded && (
        <div className="card-body">
          <div className="grid-meta-list">
            <div className="meta-item">
              <span className="meta-label"><Satellite className="icon-xs" /> Satellite</span>
              <span className="meta-value">Sentinel-2</span>
            </div>
            <div className="meta-item">
              <span className="meta-label"><Map className="icon-xs" /> Source</span>
              <span className="meta-value" style={{ fontSize: '0.6rem' }}>Copernicus Data Space / Sentinel Hub</span>
            </div>
            <div className="meta-item">
              <span className="meta-label"><Mountain className="icon-xs" /> Terrain</span>
              <span className="meta-value">{metadata.dem_source || 'Copernicus DEM'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label"><Calendar className="icon-xs" /> Acquisition</span>
              <span className="meta-value code">{acquisitionDate}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label"><Maximize className="icon-xs" /> Resolution</span>
              <span className="meta-value">~10 m (B04, B08)</span>
            </div>
            <div className="meta-item">
              <span className="meta-label"><Grid3x3 className="icon-xs" /> Grid</span>
              <span className="meta-value code">{metadata.grid_rows} × {metadata.grid_cols} ({metadata.total_cells.toLocaleString()} cells)</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">NDVI</span>
              <span className="meta-value" style={{ fontSize: '0.6rem' }}>Calculated from Sentinel-2 B04 + B08</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Data</span>
              <span className="meta-value" style={{ color: satelliteLoaded ? '#34d399' : '#f87171' }}>
                {satelliteLoaded ? 'Live Sentinel-2' : 'Live Sentinel-2 imagery unavailable'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <div className="mini-stat" style={{ flex: 1 }}>
              <div className="mini-stat-val" style={{ color: '#34d399' }}>{metadata.valid_cells.toLocaleString()}</div>
              <div className="mini-stat-lbl">Valid cells</div>
            </div>
            <div className="mini-stat" style={{ flex: 1 }}>
              <div className="mini-stat-val" style={{ color: '#f87171' }}>{metadata.invalid_cells.toLocaleString()}</div>
              <div className="mini-stat-lbl">Masked</div>
            </div>
          </div>

          <div style={{ marginTop: '0.5rem', fontSize: '0.58rem', color: '#64748b', lineHeight: 1.5 }}>
            Sentinel-2 spatial resolution: approximately 10 m for the selected bands (B04, B08). Elevation from {metadata.dem_source}. Terrain exaggeration applied for visual depth.
          </div>
        </div>
        )}
      </div>
    </>
  );
};
