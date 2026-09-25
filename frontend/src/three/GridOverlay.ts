import * as THREE from 'three';
import type { TerrainDataPayload } from '../types';
import { TerrainScene } from './TerrainScene';

export class GridOverlay {
  private gridLines: THREE.LineSegments | null = null;
  private visible = false;
  private group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  generate(data: TerrainDataPayload, exaggeration: number) {
    if (this.gridLines) {
      this.group.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      (this.gridLines.material as THREE.Material).dispose();
    }

    const { rows, cols, elevations, min_elevation, max_elevation } = data;
    const elevRange = max_elevation - min_elevation || 1;
    const fieldWidth = 100;
    const fieldDepth = 100 * (rows / cols);
    const cellW = fieldWidth / cols;
    const cellD = fieldDepth / rows;

    const points: number[] = [];
    const yOffset = 0.15;

    const step = Math.max(1, Math.floor(Math.min(rows, cols) / 20));

    // Horizontal lines
    for (let r = 0; r <= rows; r += step) {
      for (let c = 0; c < cols; c++) {
        const r0 = Math.min(r, rows - 1);
        const e1 = elevations[r0]?.[c] ?? min_elevation;
        const e2 = elevations[r0]?.[Math.min(c + 1, cols - 1)] ?? min_elevation;
        const n1 = (e1 - min_elevation) / elevRange;
        const n2 = (e2 - min_elevation) / elevRange;
        const y1 = TerrainScene.computeY(n1, exaggeration, fieldWidth) + yOffset;
        const y2 = TerrainScene.computeY(n2, exaggeration, fieldWidth) + yOffset;
        const x1 = -fieldWidth / 2 + c * cellW;
        const x2 = -fieldWidth / 2 + (c + 1) * cellW;
        const z = -fieldDepth / 2 + r * cellD;
        points.push(x1, y1, z, x2, y2, z);
      }
    }

    // Vertical lines
    for (let c = 0; c <= cols; c += step) {
      for (let r = 0; r < rows; r++) {
        const c0 = Math.min(c, cols - 1);
        const e1 = elevations[r]?.[c0] ?? min_elevation;
        const e2 = elevations[Math.min(r + 1, rows - 1)]?.[c0] ?? min_elevation;
        const n1 = (e1 - min_elevation) / elevRange;
        const n2 = (e2 - min_elevation) / elevRange;
        const y1 = TerrainScene.computeY(n1, exaggeration, fieldWidth) + yOffset;
        const y2 = TerrainScene.computeY(n2, exaggeration, fieldWidth) + yOffset;
        const x = -fieldWidth / 2 + c * cellW;
        const z1 = -fieldDepth / 2 + r * cellD;
        const z2 = -fieldDepth / 2 + (r + 1) * cellD;
        points.push(x, y1, z1, x, y2, z2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x88ccff, opacity: 0.25, transparent: true });
    this.gridLines = new THREE.LineSegments(geo, mat);
    this.gridLines.visible = this.visible;
    this.group.add(this.gridLines);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (this.gridLines) this.gridLines.visible = visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  dispose() {
    if (this.gridLines) {
      this.gridLines.geometry.dispose();
      (this.gridLines.material as THREE.Material).dispose();
    }
  }
}
