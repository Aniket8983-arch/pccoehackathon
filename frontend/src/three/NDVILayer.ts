import * as THREE from 'three';
import type { TerrainDataPayload } from '../types';

/**
 * NDVI analytical overlay — color-coded vegetation index from real Sentinel-2 B04+B08.
 * This is a data overlay, NOT the primary visual. Satellite imagery is the foundation.
 */

function ndviToColor(ndvi: number): [number, number, number] {
  if (ndvi < -0.1) return [0.10, 0.10, 0.40]; // water
  if (ndvi < 0.0)  return [0.30, 0.20, 0.10]; // bare/urban
  if (ndvi < 0.1)  return [0.55, 0.32, 0.08]; // bare soil
  if (ndvi < 0.2)  return [0.82, 0.71, 0.55]; // dry/sparse
  if (ndvi < 0.3)  return [0.90, 0.85, 0.30]; // stressed
  if (ndvi < 0.4)  return [0.68, 0.82, 0.22]; // low vegetation
  if (ndvi < 0.5)  return [0.45, 0.73, 0.20]; // moderate
  if (ndvi < 0.6)  return [0.20, 0.60, 0.15]; // healthy
  if (ndvi < 0.7)  return [0.13, 0.55, 0.13]; // dense
  if (ndvi < 0.8)  return [0.05, 0.42, 0.10]; // very dense
  return [0.00, 0.35, 0.05]; // maximum vegetation
}

export class NDVILayer {
  private texture: THREE.DataTexture | null = null;
  private ndviMaterial: THREE.MeshStandardMaterial | null = null;
  private originalMaterial: THREE.Material | null = null;
  private active = false;
  private mesh: THREE.Mesh | null = null;

  createTexture(data: TerrainDataPayload): THREE.DataTexture {
    const { rows, cols, ndvi } = data;
    const pixels = new Uint8Array(rows * cols * 4);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 4;
        const val = ndvi[r]?.[c];
        if (val === null || val === undefined || isNaN(val)) {
          pixels[idx] = 44; pixels[idx+1] = 44; pixels[idx+2] = 44; pixels[idx+3] = 255;
        } else {
          const [rr, gg, bb] = ndviToColor(val);
          pixels[idx] = Math.round(rr * 255);
          pixels[idx+1] = Math.round(gg * 255);
          pixels[idx+2] = Math.round(bb * 255);
          pixels[idx+3] = 255;
        }
      }
    }

    const tex = new THREE.DataTexture(pixels, cols, rows, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;
    this.texture = tex;
    return tex;
  }

  apply(mesh: THREE.Mesh, data: TerrainDataPayload) {
    this.mesh = mesh;
    if (!this.originalMaterial) {
      this.originalMaterial = mesh.material as THREE.Material;
    }
    const tex = this.createTexture(data);
    this.ndviMaterial = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
  }

  setActive(active: boolean) {
    this.active = active;
    if (!this.mesh) return;
    if (active && this.ndviMaterial) {
      this.mesh.material = this.ndviMaterial;
    } else if (!active && this.originalMaterial) {
      this.mesh.material = this.originalMaterial;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  dispose() {
    this.texture?.dispose();
    this.ndviMaterial?.dispose();
  }
}
