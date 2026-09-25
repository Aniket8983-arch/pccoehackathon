import React from 'react';
import { Satellite, Layers, Eye, Grid3x3, Square, Mountain, Sprout, ChevronDown, ChevronUp } from 'lucide-react';
import type { VisualizationMode, GridMetadata } from '../types';

interface LayerToggleProps {
  mode: VisualizationMode;
  onModeChange: (mode: VisualizationMode) => void;
  showCrops: boolean; onToggleCrops: () => void;
  showGrid: boolean; onToggleGrid: () => void;
  showBoundary: boolean; onToggleBoundary: () => void;
  exaggeration: number;
  onExaggerationChange: (val: number) => void;
  metadata: GridMetadata;
}

const ToggleSwitch: React.FC<{ label: string; icon: React.ReactNode; active: boolean; onToggle: () => void; color?: string }> = ({ label, icon, active, onToggle, color = '#10b981' }) => (
  <label className="toggle-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0', cursor: 'pointer' }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
      {icon} {label}
    </span>
    <div
      onClick={onToggle}
      style={{
        width: '2.2rem', height: '1.15rem', borderRadius: '0.6rem',
        background: active ? color : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background 0.2s', cursor: 'pointer'
      }}
    >
      <div style={{
        width: '0.85rem', height: '0.85rem', borderRadius: '50%',
        background: '#fff', position: 'absolute', top: '0.15rem',
        left: active ? '1.2rem' : '0.15rem', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
      }} />
    </div>
  </label>
);

export const LayerToggle: React.FC<LayerToggleProps> = ({
  mode, onModeChange,
  showCrops, onToggleCrops,
  showGrid, onToggleGrid,
  showBoundary, onToggleBoundary,
  exaggeration, onExaggerationChange,
  metadata,
}) => {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="card">
      <div className="card-header card-header-clickable" onClick={() => setExpanded(!expanded)}>
        <span className="card-title"><Satellite className="icon-sm" style={{ color: '#38bdf8' }} /> View Mode</span>
        {expanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
      </div>
      {expanded && (
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {/* View mode buttons */}
        <div className="mode-toggle-group">
          <button className={`mode-btn ${mode === 'satellite' ? 'active-sat' : ''}`} onClick={() => onModeChange('satellite')}>
            <Satellite className="icon-sm" />
            <span className="mode-name">Satellite</span>
            <span className="mode-sub">Real imagery</span>
          </button>
          <button className={`mode-btn ${mode === 'ndvi' ? 'active-ndvi' : ''}`} onClick={() => onModeChange('ndvi')}>
            <Layers className="icon-sm" />
            <span className="mode-name">NDVI</span>
            <span className="mode-sub">Vegetation</span>
          </button>
          <button className={`mode-btn ${mode === 'satellite-ndvi' ? 'active-ndvi' : ''}`} onClick={() => onModeChange('satellite-ndvi')}>
            <Eye className="icon-sm" />
            <span className="mode-name">Combined</span>
            <span className="mode-sub">Sat + NDVI</span>
          </button>
        </div>

        {/* Terrain Exaggeration Slider */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem', marginTop: '0.3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontWeight: 600, color: '#cbd5e1' }}>
              <Mountain className="icon-xs" style={{ color: '#f59e0b' }} /> Terrain Exaggeration
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
              {exaggeration.toFixed(1)}×
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.1"
            value={exaggeration}
            onChange={(e) => onExaggerationChange(parseFloat(e.target.value))}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#f59e0b' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', color: '#64748b', marginTop: '0.15rem' }}>
            <span>0.5× Subtle</span>
            <span>5.0× Dramatic</span>
          </div>
          <div style={{ fontSize: '0.58rem', color: '#94a3b8', marginTop: '0.3rem', fontStyle: 'italic', lineHeight: 1.4 }}>
            Terrain exaggeration is applied for visualization. Real elevation values remain unchanged.
          </div>
        </div>

        {/* Overlay toggles */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.35rem', marginTop: '0.25rem' }}>
          <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', fontWeight: 700 }}>Overlays</div>
          <ToggleSwitch label="3D Tomato Crops (NDVI)" icon={<Sprout className="icon-xs" />} active={showCrops} onToggle={onToggleCrops} color="#22c55e" />
          <ToggleSwitch label="10 m Grid" icon={<Grid3x3 className="icon-xs" />} active={showGrid} onToggle={onToggleGrid} color="#818cf8" />
          <ToggleSwitch label="Field Boundary" icon={<Square className="icon-xs" />} active={showBoundary} onToggle={onToggleBoundary} color="#22ff88" />
        </div>

        {metadata.ndvi_range && (
          <div style={{ marginTop: '0.3rem', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.04)', borderRadius: '0.3rem', fontSize: '0.65rem', color: '#94a3b8' }}>
            NDVI range: <span style={{ color: '#34d399', fontFamily: 'monospace' }}>{metadata.ndvi_range[0].toFixed(3)}</span> → <span style={{ color: '#34d399', fontFamily: 'monospace' }}>{metadata.ndvi_range[1].toFixed(3)}</span>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
