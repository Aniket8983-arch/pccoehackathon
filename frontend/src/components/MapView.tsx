import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GridCell, GridMetadata, LayerMode, BaseMapStyle } from '../types';
import { getCellColor } from '../utils/colorScale';

interface MapViewProps {
  geoJsonData: any;
  metadata: GridMetadata;
  layerMode: LayerMode;
  baseMapStyle: BaseMapStyle;
  selectedCell: GridCell | null;
  onSelectCell: (cell: GridCell | null) => void;
  highlightLowVeg: boolean;
  resetViewTrigger: number;
}

export const MapView: React.FC<MapViewProps> = ({
  geoJsonData,
  metadata,
  layerMode,
  baseMapStyle,
  selectedCell,
  onSelectCell,
  highlightLowVeg,
  resetViewTrigger
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const selectedCellIdRef = useRef<string | null>(selectedCell ? selectedCell.cell_id : null);
  const highlightLowVegRef = useRef<boolean>(highlightLowVeg);

  selectedCellIdRef.current = selectedCell ? selectedCell.cell_id : null;
  highlightLowVegRef.current = highlightLowVeg;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Leaflet Map with Canvas Renderer for fast performance with 11,550 cells
    const map = L.map(mapContainerRef.current, {
      preferCanvas: true,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle BaseMap Layer Switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }

    let tileUrl = '';
    let attribution = '';

    if (baseMapStyle === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Esri, Maxar, Earthstar Geographics';
    } else if (baseMapStyle === 'dark') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{y}/{x}{r}.png';
      attribution = '&copy; OpenStreetMap &copy; CARTO';
    } else {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png';
      attribution = '&copy; OpenStreetMap';
    }

    const newTileLayer = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 20
    });

    newTileLayer.addTo(map);
    baseTileLayerRef.current = newTileLayer;
  }, [baseMapStyle]);

  // Load GeoJSON Layer & Handle Styling
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geoJsonData) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    const elevRange = metadata.elevation_range_m;
    const slopeRange = metadata.slope_range_deg;

    // Create GeoJSON Canvas Layer
    const canvasRenderer = L.canvas({ padding: 0.5 });
    const geoJsonLayer = L.geoJSON(geoJsonData, {
      renderer: canvasRenderer,
      style: (feature: any) => {
        if (!feature || !feature.properties) return { fillColor: '#475569', fillOpacity: 0.8, weight: 0.5, color: '#334155' };
        
        const props = feature.properties as GridCell;
        const color = getCellColor(props, layerMode, elevRange, slopeRange);
        const isSelected = selectedCellIdRef.current === props.cell_id;
        const isLowVeg = highlightLowVeg && props.low_vegetation_index;

        return {
          fillColor: isLowVeg ? '#ef4444' : color,
          fillOpacity: isSelected ? 0.95 : isLowVeg ? 0.9 : 0.75,
          weight: isSelected ? 2.5 : isLowVeg ? 1.5 : 0.3,
          color: isSelected ? '#f59e0b' : isLowVeg ? '#b91c1c' : '#1e293b'
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const props = feature.properties as GridCell;

        // Hover tooltip for quick preview
        const ndviTxt = props.ndvi_mean !== null ? props.ndvi_mean.toFixed(3) : 'N/A';
        const elevTxt = props.elevation_m !== null ? `${props.elevation_m.toFixed(1)}m` : 'N/A';
        layer.bindTooltip(`
          <div style="font-family: monospace; font-size: 11px; padding: 2px 4px;">
            <strong>${props.cell_id}</strong> (R${props.row}, C${props.col})<br/>
            NDVI: ${ndviTxt} | Elev: ${elevTxt}
          </div>
        `, { sticky: true, opacity: 0.9 });

        // Cell Click handler
        layer.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          onSelectCell(props);
        });
      }
    } as any).addTo(map);

    geoJsonLayerRef.current = geoJsonLayer;

    // Fit map bounds to AOI initially
    const bounds = geoJsonLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    // Map background click clears selection
    map.on('click', () => {
      onSelectCell(null);
    });
  }, [geoJsonData, metadata]);

  // Update styles when layerMode, selectedCell, or highlightLowVeg changes
  useEffect(() => {
    const geoJsonLayer = geoJsonLayerRef.current;
    if (!geoJsonLayer) return;

    const elevRange = metadata.elevation_range_m;
    const slopeRange = metadata.slope_range_deg;

    geoJsonLayer.setStyle((feature: any) => {
      if (!feature || !feature.properties) return { fillColor: '#475569', fillOpacity: 0.8, weight: 0.5, color: '#334155' };
      
      const props = feature.properties as GridCell;
      const color = getCellColor(props, layerMode, elevRange, slopeRange);
      const isSelected = selectedCellIdRef.current === props.cell_id;
      const isLowVeg = highlightLowVeg && props.low_vegetation_index;

      return {
        fillColor: isLowVeg ? '#ef4444' : color,
        fillOpacity: isSelected ? 0.95 : isLowVeg ? 0.9 : 0.75,
        weight: isSelected ? 2.5 : isLowVeg ? 1.5 : 0.3,
        color: isSelected ? '#ffffff' : isLowVeg ? '#b91c1c' : '#0f172a'
      };
    });
  }, [layerMode, selectedCell, highlightLowVeg, metadata]);

  // Reset View Trigger
  useEffect(() => {
    if (resetViewTrigger > 0 && mapRef.current && geoJsonLayerRef.current) {
      const bounds = geoJsonLayerRef.current.getBounds();
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [resetViewTrigger]);

  return (
    <div className="map-view-container relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full rounded-xl overflow-hidden shadow-2xl" />
    </div>
  );
};
