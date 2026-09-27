import React, { useEffect, useState } from 'react';
import type { GridData, GridCell, VisualizationMode, TerrainDataPayload, StressType } from './types';
import { Header } from './components/Header';
import { InfoPanel } from './components/InfoPanel';
import { LayerToggle } from './components/LayerToggle';
import { CellInspector } from './components/CellInspector';
import { Legend } from './components/Legend';
import { ThreeCanvas } from './components/ThreeCanvas';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { StressAnalysisPanel } from './components/StressAnalysisPanel';
import { CropAnalysisPanel } from './components/CropAnalysisPanel';
import { SoilReportPanel } from './components/SoilReportPanel';
import { AgriculturalAssistant } from './components/AgriculturalAssistant';
import type { ImageAnalysisResult, SoilAnalysisResult } from './types';

export const App: React.FC = () => {
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [terrainData, setTerrainData] = useState<TerrainDataPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<VisualizationMode>('satellite');
  const [activeStressType, setActiveStressType] = useState<StressType>('none');
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [focusedCell, setFocusedCell] = useState<GridCell | null>(null);
  const [resetViewTrigger, setResetViewTrigger] = useState<number>(0);
  const [exaggeration, setExaggeration] = useState<number>(1.5);

  const [_imageResult, setImageResult] = useState<ImageAnalysisResult | null>(null);
  const [_soilResult, setSoilResult] = useState<SoilAnalysisResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  // Live data status
  const [satelliteLoaded, setSatelliteLoaded] = useState(false);
  const [satelliteFailed, setSatelliteFailed] = useState(false);

  // Layer toggles derived from mode
  // If activeStressType is not 'none', it overrides mode rendering internally in ThreeCanvas,
  // but we keep mode to dictate base layers when stress is turned off
  const showSatellite = mode === 'satellite' || mode === 'satellite-ndvi';
  const showNDVI = mode === 'ndvi' || mode === 'satellite-ndvi';
  const [showCrops, setShowCrops] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showBoundary, setShowBoundary] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gridRes, terrainRes] = await Promise.all([
        fetch('/api/grid'),
        fetch('/api/terrain')
      ]);

      if (!gridRes.ok) throw new Error(`Grid API failed: ${gridRes.status}`);
      if (!terrainRes.ok) throw new Error(`Terrain API failed: ${terrainRes.status}`);

      const gridJson: GridData = await gridRes.json();
      const terrainJson: TerrainDataPayload = await terrainRes.json();

      setGridData(gridJson);
      setTerrainData(terrainJson);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data from backend API');
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleResetView = () => setResetViewTrigger(prev => prev + 1);

  const handleSatelliteStatus = (loaded: boolean, failed: boolean) => {
    setSatelliteLoaded(loaded);
    setSatelliteFailed(failed);
  };
  
  const handleSelectCellFromPanel = (cell: GridCell) => {
    setFocusedCell(cell);
    setSelectedCell(cell);
  };

  const handleMapAction = (action: { type: string; cell_id: string; lat: number; lon: number }) => {
    // Find the cell by cell_id and focus it
    if (gridData) {
      const cell = gridData.cells.find(c => c.cell_id === action.cell_id);
      if (cell) {
        setFocusedCell(cell);
        setSelectedCell(cell);
      }
    }
  };

  if (loading) {
    return <LoadingState message="Loading live Sentinel-2 satellite data and Copernicus DEM terrain..." />;
  }

  if (error || !gridData || !terrainData) {
    return <ErrorState error={error || 'Data unavailable'} onRetry={fetchData} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', background: '#090d16', color: '#f8fafc' }}>
      <Header
        onResetView={handleResetView}
        mode={mode}
        onModeChange={setMode}
        satelliteLoaded={satelliteLoaded}
        satelliteFailed={satelliteFailed}
      />

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        <div className="side-panel">
          <div className="side-panel-content custom-scrollbar">
            <StressAnalysisPanel
              gridData={gridData}
              activeStressType={activeStressType}
              onStressTypeChange={setActiveStressType}
              onSelectCell={handleSelectCellFromPanel}
            />

            <CropAnalysisPanel
              selectedCell={selectedCell}
              onAnalysisComplete={(result) => {
                setImageResult(result);
                setAnalysisId(`analysis-${Date.now()}`);
              }}
            />

            <SoilReportPanel
              onAnalysisComplete={(result) => {
                setSoilResult(result);
              }}
            />

            <AgriculturalAssistant
              analysisId={analysisId}
              selectedCell={selectedCell}
              onMapAction={handleMapAction}
            />

            <LayerToggle
              mode={mode}
              onModeChange={setMode}
              showCrops={showCrops} onToggleCrops={() => setShowCrops(v => !v)}
              showGrid={showGrid} onToggleGrid={() => setShowGrid(v => !v)}
              showBoundary={showBoundary} onToggleBoundary={() => setShowBoundary(v => !v)}
              exaggeration={exaggeration}
              onExaggerationChange={setExaggeration}
              metadata={gridData.metadata}
            />

            <CellInspector
              selectedCell={selectedCell}
              sentinelDate={gridData.metadata.sentinel2_datetime}
            />

            <Legend mode={mode} metadata={gridData.metadata} />

            <InfoPanel metadata={gridData.metadata} satelliteLoaded={satelliteLoaded} />
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', height: '100%' }}>
          <ThreeCanvas
            terrainData={terrainData}
            gridData={gridData}
            showNDVI={showNDVI}
            showSatellite={showSatellite}
            activeStressType={activeStressType}
            showCrops={showCrops}
            showGrid={showGrid}
            showBoundary={showBoundary}
            exaggeration={exaggeration}
            focusedCell={focusedCell}
            onSelectCell={setSelectedCell}
            onSatelliteStatus={handleSatelliteStatus}
            resetViewTrigger={resetViewTrigger}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
