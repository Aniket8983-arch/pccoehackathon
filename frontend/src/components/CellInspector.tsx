import React from 'react';
import { Crosshair, MapPin, Mountain, Leaf, Satellite, TrendingUp } from 'lucide-react';
import type { GridCell } from '../types';

interface CellInspectorProps {
  selectedCell: GridCell | null;
  sentinelDate: string;
}

function getVegetationStatus(ndvi: number | null): { label: string; color: string } {
  if (ndvi === null) return { label: 'No data', color: '#64748b' };
  if (ndvi >= 0.6) return { label: 'Dense healthy vegetation', color: '#22c55e' };
  if (ndvi >= 0.4) return { label: 'Moderate vegetation', color: '#84cc16' };
  if (ndvi >= 0.2) return { label: 'Sparse vegetation', color: '#f59e0b' };
  if (ndvi >= 0.0) return { label: 'Bare soil / minimal vegetation', color: '#d97706' };
  return { label: 'Water / non-vegetated', color: '#3b82f6' };
}

export const CellInspector: React.FC<CellInspectorProps> = ({ selectedCell, sentinelDate }) => {
  if (!selectedCell) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Crosshair className="icon-sm" style={{ color: '#38bdf8' }} /> Cell Inspector</span>
        </div>
        <div className="card-body" style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.72rem' }}>
          Click on the 3D terrain to inspect a 10 m × 10 m grid cell
        </div>
      </div>
    );
  }

  const veg = getVegetationStatus(selectedCell.ndvi_mean);

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Crosshair className="icon-sm" style={{ color: '#38bdf8' }} /> {selectedCell.cell_id}</span>
        <span className={`status-pill ${selectedCell.valid ? 'pill-valid' : 'pill-invalid'}`}>
          {selectedCell.valid ? 'Valid' : 'Masked'}
        </span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div className="inspector-chip accent-sky">
          <MapPin className="icon-xs" style={{ color: '#38bdf8' }} />
          <div>
            <div className="chip-label">Coordinates</div>
            <div className="chip-value" style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
              {selectedCell.center_lat.toFixed(5)}°N, {selectedCell.center_lon.toFixed(5)}°E
            </div>
          </div>
        </div>

        <div className="measurement-card">
          <div className="meas-header">
            <span className="meas-title"><Mountain className="icon-xs" style={{ color: '#f59e0b' }} /> Elevation</span>
            <span className="meas-val" style={{ color: '#fbbf24' }}>
              {selectedCell.elevation_m !== null ? `${selectedCell.elevation_m.toFixed(1)} m` : 'N/A'}
            </span>
          </div>
          {selectedCell.slope_deg !== null && (
            <div className="meas-sub" style={{ fontSize: '0.63rem', color: '#94a3b8' }}>
              <TrendingUp className="icon-xs" style={{ display: 'inline', verticalAlign: 'middle' }} /> Slope: {selectedCell.slope_deg.toFixed(2)}°
            </div>
          )}
        </div>

        <div className="measurement-card">
          <div className="meas-header">
            <span className="meas-title"><Leaf className="icon-xs" style={{ color: '#10b981' }} /> NDVI</span>
            <span className="meas-val" style={{ color: '#34d399' }}>
              {selectedCell.ndvi_mean !== null ? selectedCell.ndvi_mean.toFixed(4) : 'N/A'}
            </span>
          </div>
          <div className="meas-sub" style={{ fontSize: '0.63rem', marginTop: '0.2rem' }}>
            <span style={{ color: veg.color, fontWeight: 600 }}>{veg.label}</span>
          </div>
        </div>

        <div className="inspector-meta-box">
          <Satellite className="icon-xs" style={{ color: '#38bdf8' }} />
          <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
            Sentinel-2 · {sentinelDate ? new Date(sentinelDate).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
};
