import * as THREE from 'three';
import type { TerrainDataPayload } from '../types';
import { TerrainScene } from './TerrainScene';

export class FieldBoundary {
  private boundaryLine: THREE.Line | null = null;
  private visible = true;
  private group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  generate(data: TerrainDataPayload, exaggeration: number) {
    if (this.boundaryLine) {
      this.group.remove(this.boundaryLine);
      this.boundaryLine.geometry.dispose();
      (this.boundaryLine.material as THREE.Material).dispose();
    }

    const { rows, cols, min_elevation, max_elevation, elevations } = data;
    const elevRange = max_elevation - min_elevation || 1;
    const fieldWidth = 100;
    const fieldDepth = 100 * (rows / cols);
    const hw = fieldWidth / 2;
    const hd = fieldDepth / 2;
    const yOffset = 0.3;

    const getY = (r: number, c: number) => {
      const e = elevations[Math.min(r, rows - 1)]?.[Math.min(c, cols - 1)] ?? min_elevation;
      const norm = (e - min_elevation) / elevRange;
      return TerrainScene.computeY(norm, exaggeration, fieldWidth) + yOffset;
    };

    const pts: THREE.Vector3[] = [];
    const samples = 30;

    // Bottom edge (r=0)
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const c = Math.floor(t * (cols - 1));
      pts.push(new THREE.Vector3(-hw + t * fieldWidth, getY(0, c), -hd));
    }
    // Right edge
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const r = Math.floor(t * (rows - 1));
      pts.push(new THREE.Vector3(hw, getY(r, cols - 1), -hd + t * fieldDepth));
    }
    // Top edge
    for (let i = samples; i >= 0; i--) {
      const t = i / samples;
      const c = Math.floor(t * (cols - 1));
      pts.push(new THREE.Vector3(-hw + t * fieldWidth, getY(rows - 1, c), hd));
    }
    // Left edge
    for (let i = samples; i >= 0; i--) {
      const t = i / samples;
      const r = Math.floor(t * (rows - 1));
      pts.push(new THREE.Vector3(-hw, getY(r, 0), -hd + t * fieldDepth));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x22ff88, linewidth: 2, opacity: 0.8, transparent: true });
    this.boundaryLine = new THREE.Line(geo, mat);
    this.boundaryLine.visible = this.visible;
    this.group.add(this.boundaryLine);
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (this.boundaryLine) this.boundaryLine.visible = visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  dispose() {
    if (this.boundaryLine) {
      this.boundaryLine.geometry.dispose();
      (this.boundaryLine.material as THREE.Material).dispose();
    }
  }
}
