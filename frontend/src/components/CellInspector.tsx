import React, { useState, useEffect } from 'react';
import { Crosshair, MapPin, Mountain, Leaf, Satellite, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(true);

  // Auto-expand when a new cell is selected
  useEffect(() => {
    if (selectedCell) setExpanded(true);
  }, [selectedCell]);

  if (!selectedCell) {
    return (
      <div className="card">
        <div className="card-header card-header-clickable" onClick={() => setExpanded(!expanded)}>
          <span className="card-title"><Crosshair className="icon-sm" style={{ color: '#38bdf8' }} /> Cell Inspector</span>
          {expanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
        </div>
        {expanded && (
          <div className="card-body" style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.72rem' }}>
            Click on the 3D terrain to inspect a 10 m × 10 m grid cell
          </div>
        )}
      </div>
    );
  }

  const veg = getVegetationStatus(selectedCell.ndvi_mean);

  return (
    <div className="card">
      <div className="card-header card-header-clickable" onClick={() => setExpanded(!expanded)}>
        <span className="card-title"><Crosshair className="icon-sm" style={{ color: '#38bdf8' }} /> {selectedCell.cell_id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`status-pill ${selectedCell.valid ? 'pill-valid' : 'pill-invalid'}`}>
            {selectedCell.valid ? 'Valid' : 'Masked'}
          </span>
          {expanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
        </div>
      </div>
      {expanded && (
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

        {selectedCell.stress_overall && (
          <>
            <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.4rem', fontWeight: 700 }}>Risk Analysis</div>
            {[
              { label: 'Overall Risk', key: 'stress_overall', icon: '🚨' },
              { label: 'Water Stress', key: 'stress_water', icon: '🔵' },
              { label: 'Heat Stress', key: 'stress_heat', icon: '🟠' },
              { label: 'Disease Risk', key: 'stress_disease', icon: '🔴' },
              { label: 'Vegetation Stress', key: 'stress_vegetation', icon: '🟢' }
            ].map(type => {
              const stressData = (selectedCell as any)[type.key];
              if (!stressData) return null;
              const color = stressData.level === 'Critical' ? '#ef4444' : stressData.level === 'High' ? '#f97316' : stressData.level === 'Moderate' ? '#f59e0b' : '#34d399';
              
              return (
                <div key={type.key} className="measurement-card" style={{ borderLeft: `2px solid ${color}` }}>
                  <div className="meas-header">
                    <span className="meas-title" style={{ color: '#f8fafc' }}>{type.icon} {type.label}</span>
                    <span className="meas-val" style={{ color }}>{stressData.score}/100</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color, marginTop: '0.2rem' }}>
                    {stressData.level}
                  </div>
                  
                  {stressData.factors && stressData.factors.length > 0 && (
                    <div style={{ marginTop: '0.3rem' }}>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8', letterSpacing: '0.02em' }}>Factors:</div>
                      <ul style={{ margin: '0.1rem 0 0 0', paddingLeft: '1rem', fontSize: '0.6rem', color: '#cbd5e1' }}>
                        {stressData.factors.map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  
                  {stressData.recommendation && stressData.recommendation !== 'N/A' && stressData.recommendation !== 'No immediate action.' && stressData.recommendation !== 'Routine monitoring.' && stressData.recommendation !== 'Healthy canopy.' && (
                    <div style={{ marginTop: '0.3rem', padding: '0.3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.25rem' }}>
                      <div style={{ fontSize: '0.55rem', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Recommendation</div>
                      <div style={{ fontSize: '0.6rem', color: '#f8fafc', lineHeight: 1.3 }}>{stressData.recommendation}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        <div className="inspector-meta-box">
          <Satellite className="icon-xs" style={{ color: '#38bdf8' }} />
          <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
            Sentinel-2 · {sentinelDate ? new Date(sentinelDate).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
