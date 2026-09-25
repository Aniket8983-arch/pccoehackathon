import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TerrainDataPayload } from '../types';

/**
 * Elevation height factor: at exaggeration=1.0, the max elevation difference
 * will visually span this fraction of the field width.
 * 0.2 = 20% of field width. Very visible 3D depth.
 */
const HEIGHT_FACTOR = 0.2;

export class TerrainScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private terrainMesh: THREE.Mesh | null = null;
  private terrainGeometry: THREE.PlaneGeometry | null = null;
  private defaultMaterial: THREE.MeshStandardMaterial | null = null;
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private animFrameId: number = 0;
  private exaggeration: number = 1.5;
  private terrainData: TerrainDataPayload | null = null;
  private container: HTMLElement | null = null;
  private fieldWidth: number = 100;
  private fieldDepth: number = 100;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa8d8ea);
    this.scene.fog = new THREE.FogExp2(0xa8d8ea, 0.0018);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Enable shadows for terrain depth perception
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 400;
    this.controls.maxPolarAngle = Math.PI / 2.02;
    this.controls.zoomSpeed = 0.8;
    this.controls.rotateSpeed = 0.5;
    this.controls.panSpeed = 0.5;

    // Ambient — enough to see all terrain, not too bright to wash out shadows
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);

    // Directional sunlight at a low-ish angle to create slope shading
    this.dirLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    this.dirLight.position.set(60, 100, 40);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 400;
    this.dirLight.shadow.camera.left = -120;
    this.dirLight.shadow.camera.right = 120;
    this.dirLight.shadow.camera.top = 120;
    this.dirLight.shadow.camera.bottom = -120;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Hemisphere for sky/ground bounce — adds subtle color variation on slopes
    this.hemiLight = new THREE.HemisphereLight(0xb1e1ff, 0x886644, 0.35);
    this.scene.add(this.hemiLight);
  }

  init(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);
    window.addEventListener('resize', this.onResize);
    this.animate();
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /** Compute the Y value for a given normalized elevation (0–1). */
  static computeY(normalizedElev: number, exaggeration: number, fieldWidth: number): number {
    return normalizedElev * fieldWidth * HEIGHT_FACTOR * exaggeration;
  }

  /** Apply elevation to existing geometry vertices without rebuilding the mesh. */
  private applyElevation() {
    if (!this.terrainData || !this.terrainGeometry) return;
    const { rows, cols, elevations, min_elevation, max_elevation } = this.terrainData;
    const positions = this.terrainGeometry.attributes.position;
    const elevRange = max_elevation - min_elevation || 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const elev = elevations[r]?.[c] ?? min_elevation;
        const norm = (elev - min_elevation) / elevRange;
        positions.setY(idx, TerrainScene.computeY(norm, this.exaggeration, this.fieldWidth));
      }
    }
    positions.needsUpdate = true;
    this.terrainGeometry.computeVertexNormals();
  }

  updateTerrain(data: TerrainDataPayload) {
    this.terrainData = data;
    const { rows, cols } = data;
    this.fieldWidth = 100;
    this.fieldDepth = 100 * (rows / cols);

    // Only create new geometry if dimensions changed
    const needsNewGeometry = !this.terrainGeometry ||
      this.terrainGeometry.parameters.widthSegments !== cols - 1 ||
      this.terrainGeometry.parameters.heightSegments !== rows - 1;

    if (needsNewGeometry) {
      // Remove old mesh
      if (this.terrainMesh) {
        this.scene.remove(this.terrainMesh);
        this.terrainGeometry?.dispose();
        this.defaultMaterial?.dispose();
      }

      this.terrainGeometry = new THREE.PlaneGeometry(
        this.fieldWidth, this.fieldDepth, cols - 1, rows - 1
      );
      this.terrainGeometry.rotateX(-Math.PI / 2);

      this.defaultMaterial = new THREE.MeshStandardMaterial({
        color: 0x999999,
        roughness: 1.0,
        metalness: 0.0,
        flatShading: false,
        side: THREE.DoubleSide,
      });

      this.terrainMesh = new THREE.Mesh(this.terrainGeometry, this.defaultMaterial);
      this.terrainMesh.receiveShadow = true;
      this.terrainMesh.castShadow = true;
      this.scene.add(this.terrainMesh);
    }

    this.applyElevation();
    this.resetCamera();
  }

  getTerrainMesh(): THREE.Mesh | null { return this.terrainMesh; }
  getScene(): THREE.Scene { return this.scene; }
  getCamera(): THREE.PerspectiveCamera { return this.camera; }
  getRenderer(): THREE.WebGLRenderer { return this.renderer; }
  getTerrainGeometry(): THREE.PlaneGeometry | null { return this.terrainGeometry; }
  getTerrainData(): TerrainDataPayload | null { return this.terrainData; }
  getExaggeration(): number { return this.exaggeration; }
  getFieldWidth(): number { return this.fieldWidth; }
  getFieldDepth(): number { return this.fieldDepth; }

  /** Change exaggeration — updates vertex positions in-place (preserves material). */
  setExaggeration(val: number) {
    this.exaggeration = val;
    this.applyElevation();
  }

  resetCamera() {
    // Strong oblique aerial angle revealing slopes and depth
    const maxH = this.fieldWidth * HEIGHT_FACTOR * this.exaggeration;
    this.camera.position.set(
      this.fieldWidth * 0.55,
      this.fieldWidth * 0.5 + maxH,
      this.fieldDepth * 0.55
    );
    this.controls.target.set(0, maxH * 0.3, 0);
    this.controls.update();
  }

  setTerrainVisible(visible: boolean) {
    if (this.terrainMesh) this.terrainMesh.visible = visible;
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.animFrameId);
    this.controls.dispose();
    this.terrainGeometry?.dispose();
    if (this.terrainMesh) {
      (this.terrainMesh.material as THREE.Material).dispose();
    }
    this.defaultMaterial?.dispose();
    this.renderer.dispose();
    this.container?.removeChild(this.renderer.domElement);
  }
}
