import * as THREE from 'three';

/**
 * Loads the real Sentinel-2 RGB satellite texture and applies it to the terrain.
 * The satellite image IS the primary visual — not a layer, not an overlay.
 */
export class SatelliteTextureLayer {
  private texture: THREE.Texture | null = null;
  private satMaterial: THREE.MeshStandardMaterial | null = null;
  private fallbackMaterial: THREE.Material | null = null;
  private active = false;
  private mesh: THREE.Mesh | null = null;
  private loaded = false;
  private loadFailed = false;

  async load(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (tex) => {
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.flipY = false;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          this.texture = tex;
          this.satMaterial = new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.95,
            metalness: 0.0,
            side: THREE.DoubleSide,
          });
          this.loaded = true;
          this.loadFailed = false;
          resolve(true);
        },
        undefined,
        () => {
          this.loaded = false;
          this.loadFailed = true;
          resolve(false);
        }
      );
    });
  }

  apply(mesh: THREE.Mesh) {
    this.mesh = mesh;
    if (!this.fallbackMaterial) {
      this.fallbackMaterial = mesh.material as THREE.Material;
    }
  }

  /** Immediately apply satellite texture to mesh. */
  setActive(active: boolean) {
    this.active = active;
    if (!this.mesh) return;
    if (active && this.satMaterial) {
      this.mesh.material = this.satMaterial;
    } else if (!active && this.fallbackMaterial) {
      this.mesh.material = this.fallbackMaterial;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  hasFailed(): boolean {
    return this.loadFailed;
  }

  dispose() {
    this.texture?.dispose();
    this.satMaterial?.dispose();
  }
}
