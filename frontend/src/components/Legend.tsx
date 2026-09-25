import React from 'react';
import { Palette } from 'lucide-react';
import type { VisualizationMode, GridMetadata } from '../types';

interface LegendProps {
  mode: VisualizationMode;
  metadata: GridMetadata;
}

export const Legend: React.FC<LegendProps> = ({ mode, metadata }) => {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><Palette className="icon-sm" style={{ color: '#a78bfa' }} /> Legend</span>
      </div>
      <div className="card-body legend-card">
        {mode === 'satellite' && (
          <div>
            <div className="legend-title">Sentinel-2 True Color (B04/B03/B02)</div>
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', lineHeight: 1.5, marginTop: '0.3rem' }}>
              Real satellite imagery showing natural land appearance: vegetation, bare soil, roads, and field patterns as observed from space.
            </div>
          </div>
        )}

        {(mode === 'ndvi' || mode === 'satellite-ndvi') && (
          <div>
            <div className="legend-title">NDVI – Vegetation Index (B08 – B04) / (B08 + B04)</div>
            <div className="gradient-bar ndvi-gradient" style={{ marginTop: '0.3rem' }} />
            <div className="legend-ticks">
              <span>-0.2</span><span>0.0</span><span>0.2</span><span>0.4</span><span>0.6</span><span>0.8</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.3rem', fontSize: '0.63rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#8c5114' }} />
                <span style={{ color: '#cbd5e1' }}>{'< 0.1'} — Bare soil / non-vegetated</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#e6d94d' }} />
                <span style={{ color: '#cbd5e1' }}>0.1 – 0.3 — Sparse / stressed vegetation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#339926' }} />
                <span style={{ color: '#cbd5e1' }}>0.3 – 0.6 — Moderate vegetation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#0d6b1a' }} />
                <span style={{ color: '#cbd5e1' }}>{'> 0.6'} — Dense healthy vegetation</span>
              </div>
            </div>

            {metadata.ndvi_range && (
              <div style={{ marginTop: '0.3rem', fontSize: '0.6rem', color: '#64748b' }}>
                Observed range: {metadata.ndvi_range[0].toFixed(3)} to {metadata.ndvi_range[1].toFixed(3)}
              </div>
            )}
          </div>
        )}

        {metadata.elevation_range_m && (
          <div style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
            <div className="legend-title">Elevation</div>
            <div style={{ fontSize: '0.63rem', color: '#94a3b8', marginTop: '0.15rem' }}>
              {metadata.elevation_range_m[0].toFixed(0)} m – {metadata.elevation_range_m[1].toFixed(0)} m ({metadata.dem_source})
            </div>
          </div>
        )}

        <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.58rem', color: '#475569' }}>
          <span className="nodata-swatch" /> No data / masked
        </div>
      </div>
    </div>
  );
};
