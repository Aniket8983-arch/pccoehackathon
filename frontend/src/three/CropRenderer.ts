import * as THREE from 'three';
import type { TerrainDataPayload } from '../types';
import { TerrainScene } from './TerrainScene';

/**
 * Data-driven 3D crop renderer.
 * Places instanced tomato plants ONLY where real NDVI indicates vegetation.
 * - NDVI < 0.15 → no crop (bare soil / non-vegetated)
 * - NDVI 0.15–0.30 → small, stressed (yellow-green)
 * - NDVI 0.30–0.50 → medium, moderate (green)
 * - NDVI 0.50–0.70 → tall, healthy (dark green + red fruits)
 * - NDVI > 0.70 → very tall, dense (deep green + many fruits)
 */

const NDVI_THRESHOLD = 0.15; // minimum NDVI to place a crop

function ndviToCanopyColor(ndvi: number): THREE.Color {
  if (ndvi < 0.20) return new THREE.Color(0.55, 0.50, 0.15); // dry yellow-brown
  if (ndvi < 0.30) return new THREE.Color(0.45, 0.55, 0.10); // yellow-green
  if (ndvi < 0.40) return new THREE.Color(0.30, 0.55, 0.10); // light green
  if (ndvi < 0.50) return new THREE.Color(0.20, 0.50, 0.08); // medium green
  if (ndvi < 0.60) return new THREE.Color(0.12, 0.45, 0.08); // green
  if (ndvi < 0.70) return new THREE.Color(0.08, 0.40, 0.06); // dark green
  return new THREE.Color(0.05, 0.35, 0.05); // deep forest green
}

export class CropRenderer {
  private group: THREE.Group;
  private stemMesh: THREE.InstancedMesh | null = null;
  private canopyMesh: THREE.InstancedMesh | null = null;
  private fruitMesh: THREE.InstancedMesh | null = null;
  private visible = true;

  constructor() {
    this.group = new THREE.Group();
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  generate(data: TerrainDataPayload, exaggeration: number) {
    this.dispose();

    const { rows, cols, ndvi, elevations, min_elevation, max_elevation } = data;
    const elevRange = max_elevation - min_elevation || 1;
    const fieldWidth = 100;
    const fieldDepth = 100 * (rows / cols);
    const cellW = fieldWidth / cols;
    const cellD = fieldDepth / rows;

    // First pass: collect all vegetated cells
    interface CropInstance {
      x: number; z: number; y: number;
      ndviVal: number;
      row: number; col: number;
    }
    const crops: CropInstance[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = ndvi[r]?.[c];
        if (val === null || val === undefined || isNaN(val) || val < NDVI_THRESHOLD) continue;

        const elev = elevations[r]?.[c] ?? min_elevation;
        const norm = (elev - min_elevation) / elevRange;
        const y = TerrainScene.computeY(norm, exaggeration, fieldWidth);

        // Position at cell center
        const x = -fieldWidth / 2 + (c + 0.5) * cellW;
        const z = -fieldDepth / 2 + (r + 0.5) * cellD;

        crops.push({ x, z, y, ndviVal: val, row: r, col: c });
      }
    }

    if (crops.length === 0) return;

    // Geometry for parts
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 1, 4);
    const canopyGeo = new THREE.SphereGeometry(0.3, 6, 5);
    const fruitGeo = new THREE.SphereGeometry(0.06, 4, 4);

    // Materials
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a1e,
      roughness: 0.9,
      metalness: 0.0,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      roughness: 0.75,
      metalness: 0.0,
    });
    const fruitMat = new THREE.MeshStandardMaterial({
      color: 0xcc2200,
      roughness: 0.5,
      metalness: 0.1,
    });

    // Count fruits (NDVI > 0.4 gets fruits)
    const fruitCrops = crops.filter(c => c.ndviVal > 0.4);
    // Each fruiting plant gets 2-4 fruits
    let totalFruits = 0;
    fruitCrops.forEach(c => {
      totalFruits += c.ndviVal > 0.6 ? 4 : (c.ndviVal > 0.5 ? 3 : 2);
    });

    // Create instanced meshes
    this.stemMesh = new THREE.InstancedMesh(stemGeo, stemMat, crops.length);
    this.canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, crops.length);
    this.fruitMesh = new THREE.InstancedMesh(fruitGeo, fruitMat, totalFruits);

    this.stemMesh.castShadow = true;
    this.canopyMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    // Place each crop
    for (let i = 0; i < crops.length; i++) {
      const crop = crops[i];

      // Scale plant height by NDVI (0.15→small, 0.8→tall)
      const t = Math.min(1, (crop.ndviVal - NDVI_THRESHOLD) / (0.75 - NDVI_THRESHOLD));
      const plantHeight = 0.4 + t * 1.8; // 0.4 to 2.2 scene units
      const canopyScale = 0.4 + t * 0.9; // 0.4 to 1.3

      // Add slight random offset within cell for natural look (±30% of cell)
      const seed = (crop.row * 137 + crop.col * 311) % 1000;
      const rx = ((seed % 100) / 100 - 0.5) * cellW * 0.5;
      const rz = (((seed * 7) % 100) / 100 - 0.5) * cellD * 0.5;

      // Stem
      dummy.position.set(crop.x + rx, crop.y + plantHeight * 0.5, crop.z + rz);
      dummy.scale.set(1, plantHeight, 1);
      dummy.rotation.set(0, seed * 0.01, 0);
      dummy.updateMatrix();
      this.stemMesh.setMatrixAt(i, dummy.matrix);

      // Canopy (on top of stem)
      dummy.position.set(crop.x + rx, crop.y + plantHeight * 0.85, crop.z + rz);
      dummy.scale.set(canopyScale, canopyScale * 0.75, canopyScale);
      dummy.updateMatrix();
      this.canopyMesh.setMatrixAt(i, dummy.matrix);

      // Set canopy color based on NDVI
      const canopyColor = ndviToCanopyColor(crop.ndviVal);
      this.canopyMesh.setColorAt(i, canopyColor);
    }

    this.stemMesh.instanceMatrix.needsUpdate = true;
    this.canopyMesh.instanceMatrix.needsUpdate = true;
    if (this.canopyMesh.instanceColor) this.canopyMesh.instanceColor.needsUpdate = true;

    // Place fruits on high-NDVI plants
    let fruitIdx = 0;
    for (const crop of fruitCrops) {
      const t = Math.min(1, (crop.ndviVal - NDVI_THRESHOLD) / (0.75 - NDVI_THRESHOLD));
      const plantHeight = 0.4 + t * 1.8;
      const numFruits = crop.ndviVal > 0.6 ? 4 : (crop.ndviVal > 0.5 ? 3 : 2);

      const seed = (crop.row * 137 + crop.col * 311) % 1000;
      const rx = ((seed % 100) / 100 - 0.5) * cellW * 0.5;
      const rz = (((seed * 7) % 100) / 100 - 0.5) * cellD * 0.5;

      for (let f = 0; f < numFruits; f++) {
        const angle = (f / numFruits) * Math.PI * 2 + seed * 0.01;
        const fruitR = 0.15 + Math.random() * 0.15;
        const fruitY = crop.y + plantHeight * (0.5 + Math.random() * 0.35);
        const fruitScale = 0.7 + crop.ndviVal * 0.8;

        dummy.position.set(
          crop.x + rx + Math.cos(angle) * fruitR,
          fruitY,
          crop.z + rz + Math.sin(angle) * fruitR
        );
        dummy.scale.set(fruitScale, fruitScale, fruitScale);
        dummy.updateMatrix();
        this.fruitMesh.setMatrixAt(fruitIdx, dummy.matrix);

        // Vary fruit color slightly (red to orange-red)
        const rVal = 0.7 + Math.random() * 0.3;
        color.setRGB(rVal, 0.08 + Math.random() * 0.12, 0.02);
        this.fruitMesh.setColorAt(fruitIdx, color);
        fruitIdx++;
      }
    }

    if (this.fruitMesh.instanceMatrix) this.fruitMesh.instanceMatrix.needsUpdate = true;
    if (this.fruitMesh.instanceColor) this.fruitMesh.instanceColor.needsUpdate = true;

    this.group.add(this.stemMesh);
    this.group.add(this.canopyMesh);
    this.group.add(this.fruitMesh);

    this.stemMesh.visible = this.visible;
    this.canopyMesh.visible = this.visible;
    this.fruitMesh.visible = this.visible;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (this.stemMesh) this.stemMesh.visible = visible;
    if (this.canopyMesh) this.canopyMesh.visible = visible;
    if (this.fruitMesh) this.fruitMesh.visible = visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  dispose() {
    if (this.stemMesh) {
      this.group.remove(this.stemMesh);
      this.stemMesh.geometry.dispose();
      (this.stemMesh.material as THREE.Material).dispose();
      this.stemMesh = null;
    }
    if (this.canopyMesh) {
      this.group.remove(this.canopyMesh);
      this.canopyMesh.geometry.dispose();
      (this.canopyMesh.material as THREE.Material).dispose();
      this.canopyMesh = null;
    }
    if (this.fruitMesh) {
      this.group.remove(this.fruitMesh);
      this.fruitMesh.geometry.dispose();
      (this.fruitMesh.material as THREE.Material).dispose();
      this.fruitMesh = null;
    }
  }
}
