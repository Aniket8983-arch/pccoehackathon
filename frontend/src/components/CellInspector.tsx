import React from 'react';
import type { GridCell } from '../types';
import { Crosshair, MapPin, Leaf, Mountain, TrendingUp, CheckCircle, Calendar, Hash, ShieldAlert } from 'lucide-react';

interface CellInspectorProps {
  selectedCell: GridCell | null;
  sentinelDate?: string;
}

export const CellInspector: React.FC<CellInspectorProps> = ({ selectedCell, sentinelDate }) => {
  if (!selectedCell) {
    return (
      <div className="card cell-inspector empty-inspector">
        <div className="card-header">
          <div className="card-title">
            <Crosshair className="icon-sm text-sky-400" />
            <span>Cell Inspector</span>
          </div>
        </div>
        <div className="card-body text-center text-slate-400 py-6">
          <MapPin className="icon-lg mx-auto mb-2 text-slate-500 animate-bounce" />
          <p className="font-medium">Click any cell on the grid map</p>
          <p className="text-xs text-slate-500 mt-1">
            View real-time Sentinel-2 & DEM values directly measured at that ~10m cell location.
          </p>
        </div>
      </div>
    );
  }

  const isNdviAvailable = selectedCell.ndvi_mean !== null && selectedCell.ndvi_mean !== undefined;
  const isElevAvailable = selectedCell.elevation_m !== null && selectedCell.elevation_m !== undefined;
  const isSlopeAvailable = selectedCell.slope_deg !== null && selectedCell.slope_deg !== undefined;

  return (
    <div className="card cell-inspector">
      <div className="card-header border-b border-slate-700/50">
        <div className="card-title">
          <Crosshair className="icon-sm text-amber-400" />
          <span>Selected Cell: <span className="text-white font-mono">{selectedCell.cell_id}</span></span>
        </div>
        <span className={`status-pill ${selectedCell.valid ? 'pill-valid' : 'pill-invalid'}`}>
          {selectedCell.valid ? 'Valid Cell' : 'Unavailable'}
        </span>
      </div>

      <div className="card-body space-y-3">
        {/* Cell Row & Column */}
        <div className="grid grid-cols-2 gap-2">
          <div className="inspector-chip">
            <Hash className="icon-xs text-slate-400" />
            <div>
              <div className="chip-label">Grid Row</div>
              <div className="chip-value">{selectedCell.row}</div>
            </div>
          </div>

          <div className="inspector-chip">
            <Hash className="icon-xs text-slate-400" />
            <div>
              <div className="chip-label">Grid Column</div>
              <div className="chip-value">{selectedCell.col}</div>
            </div>
          </div>
        </div>

        {/* Center Geo Coordinates */}
        <div className="inspector-chip accent-sky">
          <MapPin className="icon-xs text-sky-400" />
          <div>
            <div className="chip-label">Center Latitude / Longitude</div>
            <div className="chip-value font-mono">
              {selectedCell.center_lat.toFixed(6)}° N, {selectedCell.center_lon.toFixed(6)}° E
            </div>
          </div>
        </div>

        {/* Primary Raster Measurements */}
        <div className="inspector-measurements space-y-2">
          {/* NDVI */}
          <div className="measurement-card">
            <div className="meas-header">
              <span className="meas-title">
                <Leaf className="icon-xs text-emerald-400" />
                <span>NDVI (Mean)</span>
              </span>
              <span className="meas-val text-emerald-400 font-mono">
                {isNdviAvailable ? selectedCell.ndvi_mean!.toFixed(4) : <span className="text-slate-400 italic">Unavailable</span>}
              </span>
            </div>
            {isNdviAvailable && (
              <div className="meas-sub font-mono text-slate-400 text-xs flex justify-between">
                <span>Min: {selectedCell.ndvi_min?.toFixed(4)}</span>
                <span>Max: {selectedCell.ndvi_max?.toFixed(4)}</span>
              </div>
            )}
            {!isNdviAvailable && (
              <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <ShieldAlert className="icon-xs text-slate-400" />
                <span>Pixel masked or missing satellite coverage</span>
              </div>
            )}
          </div>

          {/* Elevation */}
          <div className="measurement-card">
            <div className="meas-header">
              <span className="meas-title">
                <Mountain className="icon-xs text-amber-400" />
                <span>Elevation</span>
              </span>
              <span className="meas-val text-amber-300 font-mono">
                {isElevAvailable ? `${selectedCell.elevation_m!.toFixed(2)} m` : <span className="text-slate-400 italic">Unavailable</span>}
              </span>
            </div>
            <div className="meas-sub text-slate-400 text-xs">
              Source: Copernicus DEM 90m
            </div>
          </div>

          {/* Slope */}
          <div className="measurement-card">
            <div className="meas-header">
              <span className="meas-title">
                <TrendingUp className="icon-xs text-orange-400" />
                <span>Slope</span>
              </span>
              <span className="meas-val text-orange-300 font-mono">
                {isSlopeAvailable ? `${selectedCell.slope_deg!.toFixed(2)}°` : <span className="text-slate-400 italic">Unavailable</span>}
              </span>
            </div>
            <div className="meas-sub text-slate-400 text-xs">
              Real-world distance terrain gradient
            </div>
          </div>
        </div>

        {/* Pixel Count & Acquisition Date */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="inspector-meta-box">
            <CheckCircle className="icon-xs text-emerald-400" />
            <div>
              <span className="block text-slate-400">Valid Pixels</span>
              <span className="font-semibold text-slate-200">{selectedCell.valid_pixel_count}</span>
            </div>
          </div>

          <div className="inspector-meta-box">
            <Calendar className="icon-xs text-sky-400" />
            <div>
              <span className="block text-slate-400">Sentinel Scene Date</span>
              <span className="font-semibold text-slate-200 truncate block title={sentinelDate}">
                {sentinelDate ? new Date(sentinelDate).toLocaleDateString() : '2026-06-02'}
              </span>
            </div>
          </div>
        </div>

        {/* Low Vegetation Warning Flag */}
        {selectedCell.low_vegetation_index && (
          <div className="warning-banner">
            <ShieldAlert className="icon-xs text-amber-400 flex-shrink-0" />
            <span>Low Vegetation Index (&lt; 0.2 NDVI): Sparse canopy or bare ground.</span>
          </div>
        )}
      </div>
    </div>
  );
};
