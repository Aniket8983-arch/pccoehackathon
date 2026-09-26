import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { TerrainScene } from '../three/TerrainScene';
import { NDVILayer } from '../three/NDVILayer';
import { SatelliteTextureLayer } from '../three/SatelliteTextureLayer';
import { CropRenderer } from '../three/CropRenderer';
import { StressRiskLayer } from '../three/StressRiskLayer';
import { GridOverlay } from '../three/GridOverlay';
import { FieldBoundary } from '../three/FieldBoundary';
import type { TerrainDataPayload, GridData, GridCell, StressType } from '../types';

interface ThreeCanvasProps {
  terrainData: TerrainDataPayload | null;
  gridData: GridData | null;
  showNDVI: boolean;
  showSatellite: boolean;
  activeStressType: StressType;
  showCrops: boolean;
  showGrid: boolean;
  showBoundary: boolean;
  exaggeration: number;
  focusedCell: GridCell | null;
  onSelectCell: (cell: GridCell | null) => void;
  onSatelliteStatus: (loaded: boolean, failed: boolean) => void;
  resetViewTrigger: number;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  terrainData,
  gridData,
  showNDVI,
  showSatellite,
  activeStressType,
  showCrops,
  showGrid,
  showBoundary,
  exaggeration,
  focusedCell,
  onSelectCell,
  onSatelliteStatus,
  resetViewTrigger
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TerrainScene | null>(null);
  const ndviLayerRef = useRef<NDVILayer | null>(null);
  const satLayerRef = useRef<SatelliteTextureLayer | null>(null);
  const stressLayerRef = useRef<StressRiskLayer | null>(null);
  const cropRef = useRef<CropRenderer | null>(null);
  const gridOverlayRef = useRef<GridOverlay | null>(null);
  const boundaryRef = useRef<FieldBoundary | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const terrainDataRef = useRef<TerrainDataPayload | null>(null);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;

    const terrainScene = new TerrainScene();
    terrainScene.init(containerRef.current);
    sceneRef.current = terrainScene;

    const ndviLayer = new NDVILayer();
    ndviLayerRef.current = ndviLayer;

    const satLayer = new SatelliteTextureLayer();
    satLayerRef.current = satLayer;

    const stressLayer = new StressRiskLayer();
    stressLayerRef.current = stressLayer;

    const crop = new CropRenderer();
    terrainScene.getScene().add(crop.getGroup());
    cropRef.current = crop;

    const gridOv = new GridOverlay();
    terrainScene.getScene().add(gridOv.getGroup());
    gridOverlayRef.current = gridOv;

    const boundary = new FieldBoundary();
    terrainScene.getScene().add(boundary.getGroup());
    boundaryRef.current = boundary;

    // Load real Sentinel-2 satellite texture
    satLayer.load('/api/rgb-texture').then((success) => {
      onSatelliteStatus(success, !success);
      const mesh = sceneRef.current?.getTerrainMesh();
      if (mesh && success) {
        satLayer.apply(mesh);
        satLayer.setActive(true);
      }
    });

    return () => {
      terrainScene.dispose();
      ndviLayer.dispose();
      satLayer.dispose();
      stressLayer.dispose(terrainScene.getScene());
      crop.dispose();
      gridOv.dispose();
      boundary.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update terrain when data loads
  useEffect(() => {
    if (!terrainData || !sceneRef.current) return;
    terrainDataRef.current = terrainData;

    const scene = sceneRef.current;
    scene.updateTerrain(terrainData);

    const mesh = scene.getTerrainMesh();
    const exag = scene.getExaggeration();

    if (mesh) {
      const sat = satLayerRef.current;
      if (sat) {
        sat.apply(mesh);
        if (sat.isLoaded()) sat.setActive(true);
      }
      ndviLayerRef.current?.apply(mesh, terrainData);
      if (gridData) {
        const scene = sceneRef.current?.getScene();
        const geom = sceneRef.current?.getTerrainGeometry();
        if (scene && geom) {
          stressLayerRef.current?.apply(scene, geom, terrainData, gridData, activeStressType);
        }
      }
    }

    cropRef.current?.generate(terrainData, exag);
    gridOverlayRef.current?.generate(terrainData, exag);
    boundaryRef.current?.generate(terrainData, exag);
  }, [terrainData, gridData]); // Note: not depending on activeStressType intentionally for initial mount

  // Handle exaggeration changes
  useEffect(() => {
    const scene = sceneRef.current;
    const data = terrainDataRef.current;
    if (!scene || !data) return;

    scene.setExaggeration(exaggeration);
    cropRef.current?.generate(data, exaggeration);
    gridOverlayRef.current?.generate(data, exaggeration);
    boundaryRef.current?.generate(data, exaggeration);
  }, [exaggeration]);

  // Layer visibility
  useEffect(() => {
    const sat = satLayerRef.current;
    const ndvi = ndviLayerRef.current;
    const stress = stressLayerRef.current;
    if (!sat || !ndvi || !stress) return;

    // Determine Base Layer (Satellite or NDVI)
    // If stress is active, we STILL want the base layer underneath!
    const mesh = sceneRef.current?.getTerrainMesh();
    if (mesh) {
      if (showNDVI) {
        sat.setActive(false);
        ndvi.setActive(true);
        if (terrainDataRef.current) ndvi.apply(mesh, terrainDataRef.current);
      } else {
        // Default to satellite base layer even if activeStressType is set
        ndvi.setActive(false);
        sat.setActive(true);
        sat.apply(mesh);
      }
    }

    // Determine Stress Overlay
    console.log('[ThreeCanvas] activeStressType =', activeStressType, 'gridData cells =', gridData?.cells?.length);
    if (activeStressType !== 'none') {
      const threeScene = sceneRef.current?.getScene();
      const geom = sceneRef.current?.getTerrainGeometry();
      const td = terrainDataRef.current;
      console.log('[ThreeCanvas] scene=', !!threeScene, 'geom=', !!geom, 'terrainData=', !!td, 'gridData=', !!gridData);
      if (threeScene && geom && td && gridData) {
        stress.apply(threeScene, geom, td, gridData, activeStressType);
        stress.setActive(true);
      }
    } else {
      stress.setActive(false);
    }
  }, [showNDVI, showSatellite, activeStressType, gridData, terrainData]);

  useEffect(() => { cropRef.current?.setVisible(showCrops); }, [showCrops]);
  useEffect(() => { gridOverlayRef.current?.setVisible(showGrid); }, [showGrid]);
  useEffect(() => { boundaryRef.current?.setVisible(showBoundary); }, [showBoundary]);

  // Reset camera
  useEffect(() => {
    if (resetViewTrigger > 0) sceneRef.current?.resetCamera();
  }, [resetViewTrigger]);
  
  // Fly to focused cell
  useEffect(() => {
    if (focusedCell) {
      sceneRef.current?.flyToCell(focusedCell.col, focusedCell.row);
    }
  }, [focusedCell]);

  // Click handler for cell inspection
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!sceneRef.current || !gridData || !terrainDataRef.current || !containerRef.current) return;
    const td = terrainDataRef.current;

    const rect = containerRef.current.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, sceneRef.current.getCamera());
    const mesh = sceneRef.current.getTerrainMesh();
    if (!mesh) return;

    const intersects = raycaster.current.intersectObject(mesh);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      const { rows, cols } = td;
      const fieldWidth = 100;
      const fieldDepth = 100 * (rows / cols);

      const normX = (point.x + fieldWidth / 2) / fieldWidth;
      const normZ = (point.z + fieldDepth / 2) / fieldDepth;
      const col = Math.floor(normX * cols);
      const row = Math.floor(normZ * rows);

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        const cellId = `R${String(row).padStart(3, '0')}_C${String(col).padStart(3, '0')}`;
        const cell = gridData.cells.find(c => c.cell_id === cellId);
        if (cell) { onSelectCell(cell); return; }
      }
    }
    onSelectCell(null);
  }, [gridData, onSelectCell]);

  return (
    <div
      ref={containerRef}
      className="three-canvas-container"
      onClick={handleClick}
      style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
    />
  );
};
