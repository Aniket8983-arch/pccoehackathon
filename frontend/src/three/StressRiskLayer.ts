import * as THREE from 'three';
import type { TerrainDataPayload, GridData, StressType, GridCell } from '../types';

export class StressRiskLayer {
  private material: THREE.MeshStandardMaterial;
  private texture: THREE.DataTexture | null = null;
  public active = false;
  public stressType: StressType = 'none';

  constructor() {
    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
  }

  apply(mesh: THREE.Mesh, terrainData: TerrainDataPayload, gridData: GridData, stressType: StressType) {
    this.stressType = stressType;
    const { rows, cols } = terrainData;
    const size = rows * cols;
    const data = new Uint8Array(size * 4);

    // Create a map of row/col -> cell data
    const cellMap = new Map<string, GridCell>();
    gridData.cells.forEach(c => {
      cellMap.set(`${c.row}_${c.col}`, c);
    });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cellMap.get(`${r}_${c}`);
        const idx = (r * cols + c) * 4;

        if (cell && stressType !== 'none') {
          // Identify the relevant stress data object based on type
          const stressKey = `stress_${stressType}` as keyof GridCell;
          const stressData: any = cell[stressKey];

          if (stressData && stressData.score > 0) {
            const score = stressData.score;
            let rgb = [0, 0, 0];
            
            // Base color selection based on type
            if (stressType === 'water') rgb = [59, 130, 246]; // Blue
            else if (stressType === 'heat') rgb = [249, 115, 22]; // Orange
            else if (stressType === 'disease') rgb = [239, 68, 68]; // Red
            else if (stressType === 'vegetation') rgb = [168, 85, 247]; // Purple
            else if (stressType === 'overall') {
              if (score < 30) rgb = [34, 197, 94]; // Green
              else if (score < 60) rgb = [234, 179, 8]; // Yellow
              else rgb = [239, 68, 68]; // Red
            }

            // Alpha (opacity) intensity scales with risk
            let alpha = 0;
            if (score <= 30) alpha = 30; // Very faint (Low)
            else if (score <= 60) alpha = 90; // Subtle (Moderate)
            else if (score <= 80) alpha = 180; // Clear (High)
            else alpha = 240; // Strong (Critical)

            data[idx] = rgb[0];
            data[idx + 1] = rgb[1];
            data[idx + 2] = rgb[2];
            data[idx + 3] = alpha;
          } else {
            // No stress data for this cell
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
          }
        } else {
          // None selected or invalid cell
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
        }
      }
    }

    if (this.texture) this.texture.dispose();

    this.texture = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
    this.texture.needsUpdate = true;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter; // Blocky look for cells

    this.material.map = this.texture;
    mesh.material = this.material;
  }

  setActive(active: boolean) {
    this.active = active;
  }

  dispose() {
    this.material.dispose();
    if (this.texture) this.texture.dispose();
  }
}
