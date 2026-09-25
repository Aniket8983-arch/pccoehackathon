import React, { useEffect, useState } from 'react';
import type { GridData, GridCell, LayerMode, BaseMapStyle } from './types';
import { Header } from './components/Header';
import { InfoPanel } from './components/InfoPanel';
import { LayerToggle } from './components/LayerToggle';
import { CellInspector } from './components/CellInspector';
import { Legend } from './components/Legend';
import { MapView } from './components/MapView';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';

export const App: React.FC = () => {
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [layerMode, setLayerMode] = useState<LayerMode>('ndvi');
  const [baseMapStyle, setBaseMapStyle] = useState<BaseMapStyle>('satellite');
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [highlightLowVeg, setHighlightLowVeg] = useState<boolean>(false);
  const [resetViewTrigger, setResetViewTrigger] = useState<number>(0);

  const fetchGridData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch grid metadata and cell definitions
      const jsonRes = await fetch('/data/grid.json');
      if (!jsonRes.ok) {
        throw new Error(`Failed to load grid.json: HTTP ${jsonRes.status} ${jsonRes.statusText}`);
      }
      const data: GridData = await jsonRes.json();
      setGridData(data);

      // Fetch geojson geometry for spatial rendering
      const geoRes = await fetch('/data/grid.geojson');
      if (!geoRes.ok) {
        throw new Error(`Failed to load grid.geojson: HTTP ${geoRes.status} ${geoRes.statusText}`);
      }
      const geoData = await geoRes.json();
      setGeoJsonData(geoData);

      setLoading(false);
    } catch (err: any) {
      console.error("Error loading grid data:", err);
      setError(err.message || "Could not fetch grid.json. Ensure the data pipeline output exists in public/data/");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGridData();
  }, []);

  const handleResetView = () => {
    setResetViewTrigger(prev => prev + 1);
  };

  if (loading) {
    return <LoadingState message="Fetching 11,550 real raster cells from grid.json & grid.geojson..." />;
  }

  if (error || !gridData || !geoJsonData) {
    return <ErrorState error={error || "Grid data is unavailable"} onRetry={fetchGridData} />;
  }

  return (
    <div className="app-container flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Header Banner */}
      <Header 
        onResetView={handleResetView}
        totalCells={gridData.metadata.total_cells}
        validCells={gridData.metadata.valid_cells}
      />

      {/* Main Workspace */}
      <div className="main-workspace flex-1 flex relative overflow-hidden">
        {/* Map Canvas Background */}
        <div className="map-area flex-1 relative h-full">
          <MapView 
            geoJsonData={geoJsonData}
            metadata={gridData.metadata}
            layerMode={layerMode}
            baseMapStyle={baseMapStyle}
            selectedCell={selectedCell}
            onSelectCell={setSelectedCell}
            highlightLowVeg={highlightLowVeg}
            resetViewTrigger={resetViewTrigger}
          />
        </div>

        {/* Floating Controls & Sidebar */}
        <aside className="sidebar-overlay absolute top-4 left-4 bottom-4 w-96 flex flex-col gap-3 pointer-events-none z-20">
          <div className="pointer-events-auto space-y-3 overflow-y-auto pr-1 max-h-full custom-scrollbar">
            {/* Layer View & Basemap Selector */}
            <LayerToggle 
              currentMode={layerMode}
              onModeChange={setLayerMode}
              baseMap={baseMapStyle}
              onBaseMapChange={setBaseMapStyle}
              metadata={gridData.metadata}
              highlightLowVeg={highlightLowVeg}
              onToggleLowVeg={setHighlightLowVeg}
            />

            {/* Cell Inspector */}
            <CellInspector 
              selectedCell={selectedCell}
              sentinelDate={gridData.metadata.sentinel2_datetime}
            />

            {/* Legend Card */}
            <Legend 
              mode={layerMode}
              metadata={gridData.metadata}
            />

            {/* Information Panel */}
            <InfoPanel metadata={gridData.metadata} />
          </div>
        </aside>
      </div>
    </div>
  );
};

export default App;
