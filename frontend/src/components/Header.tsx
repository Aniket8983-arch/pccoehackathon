import React from 'react';
import { Layers, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  onResetView: () => void;
  totalCells: number;
  validCells: number;
}

export const Header: React.FC<HeaderProps> = ({ onResetView, totalCells, validCells }) => {
  return (
    <header className="header-bar">
      <div className="header-title-container">
        <div className="header-badge">
          <Layers className="icon-sm text-emerald-400" />
          <span>REAL RASTER GRID</span>
        </div>
        <h1 className="header-title">
          Development Viewer — Real Sentinel-2 / DEM Data
        </h1>
        <p className="header-subtitle">
          Nashik Agricultural Test AOI, Maharashtra • 10m Grid
        </p>
      </div>

      <div className="header-actions">
        {/* Disease disclaimer notice required by guidelines */}
        <div className="disclaimer-chip">
          <AlertTriangle className="icon-xs text-amber-400" />
          <span>Note: Remote sensing indices measure canopy density; they do not diagnose plant disease.</span>
        </div>

        <div className="status-chip">
          <CheckCircle2 className="icon-xs text-emerald-400" />
          <span>{validCells.toLocaleString()} / {totalCells.toLocaleString()} Valid Cells</span>
        </div>

        <button 
          onClick={onResetView}
          className="btn-secondary"
          title="Reset map camera to AOI bounds"
        >
          <RotateCcw className="icon-xs" />
          <span>Reset View</span>
        </button>
      </div>
    </header>
  );
};
