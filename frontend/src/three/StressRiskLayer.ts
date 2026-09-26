import * as THREE from 'three';
import type { TerrainDataPayload, GridData, StressType, GridCell } from '../types';

/**
 * StressRiskLayer renders colored cell highlights on top of the terrain.
 * It creates a separate mesh that sits slightly above the terrain surface
 * using a vertically-offset clone of the terrain geometry.
 */
export class StressRiskLayer {
  private overlayMesh: THREE.Mesh | null = null;
  private material: THREE.MeshBasicMaterial;
  private texture: THREE.DataTexture | null = null;
  public active = false;
  public stressType: StressType = 'none';

  constructor() {
    // Use MeshBasicMaterial — it doesn't need lighting, so colors are always vivid
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1.0, // per-pixel alpha from texture handles transparency
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }

  apply(
    scene: THREE.Scene,
    baseGeometry: THREE.BufferGeometry,
    terrainData: TerrainDataPayload,
    gridData: GridData,
    stressType: StressType
  ) {
    this.stressType = stressType;
    const { rows, cols } = terrainData;
    const size = rows * cols;
    const data = new Uint8Array(size * 4);

    // Build cell lookup map
    const cellMap = new Map<string, GridCell>();
    gridData.cells.forEach(c => {
      cellMap.set(`${c.row}_${c.col}`, c);
    });

    let nonZeroPixels = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cellMap.get(`${r}_${c}`);
        const idx = (r * cols + c) * 4;

        if (cell && stressType !== 'none') {
          const stressKey = `stress_${stressType}` as keyof GridCell;
          const stressData: any = cell[stressKey];

          if (stressData && typeof stressData.score === 'number' && stressData.score > 0) {
            const score = stressData.score;
            let rgb = [0, 0, 0];

            // Color based on stress type
            if (stressType === 'water') rgb = [30, 100, 255];       // Vivid Blue
            else if (stressType === 'heat') rgb = [255, 120, 0];    // Vivid Orange
            else if (stressType === 'disease') rgb = [255, 40, 40]; // Vivid Red
            else if (stressType === 'vegetation') rgb = [180, 60, 255]; // Vivid Purple
            else if (stressType === 'overall') {
              if (score < 30) rgb = [40, 200, 100];
              else if (score < 60) rgb = [240, 200, 0];
              else rgb = [255, 40, 40];
            }

            // Alpha: completely invisible below 25, then ramp up
            let alpha = 0;
            if (score <= 25) {
              alpha = 0; // Not visible
            } else if (score <= 40) {
              alpha = 100; // Faint
            } else if (score <= 60) {
              alpha = 160; // Moderate — clearly visible
            } else if (score <= 80) {
              alpha = 210; // High — very visible
            } else {
              alpha = 250; // Critical — almost opaque
            }

            data[idx + 0] = rgb[0];
            data[idx + 1] = rgb[1];
            data[idx + 2] = rgb[2];
            data[idx + 3] = alpha;

            if (alpha > 0) nonZeroPixels++;
          } else {
            data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
          }
        } else {
          data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 0;
        }
      }
    }

    console.log(`[StressRiskLayer] type=${stressType}, rows=${rows}, cols=${cols}, nonZeroPixels=${nonZeroPixels}/${size}`);

    // Create or update texture
    if (this.texture) this.texture.dispose();
    this.texture = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
    this.texture.needsUpdate = true;
    this.texture.magFilter = THREE.NearestFilter; // Sharp blocky cells
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;

    this.material.map = this.texture;
    this.material.needsUpdate = true;

    // Clone geometry and offset Y slightly upward so overlay sits ON TOP of terrain
    if (!this.overlayMesh) {
      const clonedGeom = baseGeometry.clone();
      // Push every vertex up by a tiny amount
      const pos = clonedGeom.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + 0.08); // 0.08 units above terrain
      }
      pos.needsUpdate = true;

      this.overlayMesh = new THREE.Mesh(clonedGeom, this.material);
      this.overlayMesh.renderOrder = 10; // Render after terrain
      scene.add(this.overlayMesh);
      console.log('[StressRiskLayer] Created overlay mesh and added to scene');
    } else {
      // Update geometry clone
      const clonedGeom = baseGeometry.clone();
      const pos = clonedGeom.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + 0.08);
      }
      pos.needsUpdate = true;
      
      this.overlayMesh.geometry.dispose();
      this.overlayMesh.geometry = clonedGeom;
    }

    this.overlayMesh.visible = this.active;
  }

  setActive(active: boolean) {
    this.active = active;
    if (this.overlayMesh) {
      this.overlayMesh.visible = active;
      console.log(`[StressRiskLayer] setActive(${active}), mesh.visible=${this.overlayMesh.visible}`);
    }
  }

  dispose(scene: THREE.Scene) {
    this.material.dispose();
    if (this.texture) this.texture.dispose();
    if (this.overlayMesh) {
      this.overlayMesh.geometry.dispose();
      scene.remove(this.overlayMesh);
    }
  }
}
