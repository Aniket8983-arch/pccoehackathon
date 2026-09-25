import React from 'react';
import { Satellite, RotateCcw, Layers, Eye } from 'lucide-react';
import type { VisualizationMode } from '../types';

interface HeaderProps {
  onResetView: () => void;
  mode: VisualizationMode;
  onModeChange: (mode: VisualizationMode) => void;
  satelliteLoaded: boolean;
  satelliteFailed: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onResetView, mode, onModeChange, satelliteLoaded, satelliteFailed }) => {
  return (
    <header className="header-bar">
      <div className="header-title-container">
        <h1 className="header-title">3D Smart Crop Field – Maharashtra Tomato Farm</h1>
        <span className="header-subtitle">Real Sentinel-2 satellite imagery on DEM terrain · ~10 m resolution</span>
      </div>

      <div className="header-actions">
        {/* Live data indicator */}
        <div className="live-indicator" style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.3rem 0.7rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: 700,
          background: satelliteLoaded ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${satelliteLoaded ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: satelliteLoaded ? '#34d399' : '#f87171',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: satelliteLoaded ? '#10b981' : '#ef4444',
            display: 'inline-block',
            animation: satelliteLoaded ? 'pulse 2s infinite' : 'none',
          }} />
          {satelliteLoaded ? 'LIVE SENTINEL-2 DATA' : satelliteFailed ? 'LIVE DATA UNAVAILABLE' : 'LOADING...'}
        </div>

        {/* View mode tabs */}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            className={`mode-tab ${mode === 'satellite' ? 'mode-tab-active' : ''}`}
            onClick={() => onModeChange('satellite')}
          >
            <Satellite className="icon-xs" /> Satellite
          </button>
          <button
            className={`mode-tab ${mode === 'ndvi' ? 'mode-tab-active' : ''}`}
            onClick={() => onModeChange('ndvi')}
          >
            <Layers className="icon-xs" /> NDVI
          </button>
          <button
            className={`mode-tab ${mode === 'satellite-ndvi' ? 'mode-tab-active' : ''}`}
            onClick={() => onModeChange('satellite-ndvi')}
          >
            <Eye className="icon-xs" /> Satellite + NDVI
          </button>
        </div>

        <button className="btn-secondary" onClick={onResetView}>
          <RotateCcw className="icon-xs" /> Reset View
        </button>
      </div>
    </header>
  );
};
