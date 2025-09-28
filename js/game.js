import * as THREE from "three";
import { Player } from "./player.js";
import {
  createMapState,
  loadTileMetadata,
  loadLevelData,
  buildLevelFromData,
  setupBuildings,
  setupShowring,
  scatterShrubs,
  createSurfaceResolver
} from "./tiles.js";

const REMOTE_ASSET_BASE =
  "https://raw.githubusercontent.com/harry0957-oss/itsadogslife/main/";

const LEVEL_SOURCES = [
  `${REMOTE_ASSET_BASE}levels/emeraldisle.json`,
  "./levels/emeraldisle.json"
];

export class Game {
  constructor({ canvas, ui }) {
    this.canvas = canvas;
    this.ui = ui;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7fc8f8);

    this.viewSize = 80;
    this.cameraHeight = 120;
    this.camera = new THREE.OrthographicCamera(
      -this.viewSize,
      this.viewSize,
      this.viewSize,
      -this.viewSize,
      0.1,
      500
    );
    this.camera.position.set(0, this.cameraHeight, 0);
    this.camera.lookAt(0, 0, 0);

    this.setupLights();

    this.textureLoader = new THREE.TextureLoader();
    this.textureLoader.setCrossOrigin("anonymous");
    this.tileMaterialCache = new Map();

    this.mapState = createMapState();
    this.surfaceGrid = [];
    this.surfaceResolver = createSurfaceResolver({
      mapState: this.mapState,
      surfaceGrid: this.surfaceGrid
    });
    this.houseColliders = [];
    this.signEntries = [];
    this.currentSign = null;

    this.player = new Player({
      scene: this.scene,
      canvas: this.canvas,
      remoteAssetBase: REMOTE_ASSET_BASE
    });
    this.player.setInteractionHandlers({
      onInteract: () => this.handleInteract(),
      onCancel: () => this.ui.hideMessage()
    });

    this.ui.onMusicToggle(() => {
      this.player.ensureAudioInitialized();
      const muted = this.player.toggleMusicMuted();
      this.ui.setMusicLabel(muted);
    });
    this.ui.setMusicLabel(this.player.isMusicMuted());

    this.clock = new THREE.Clock();

    this.handleResize = this.handleResize.bind(this);
    this.animate = this.animate.bind(this);

    window.addEventListener("resize", this.handleResize);
  }

  async start() {
    this.handleResize();

    try {
      this.tileMetadata = await loadTileMetadata();
    } catch (error) {
      console.warn("Failed to load tile metadata:", error);
      this.tileMetadata = null;
    }

    await this.initializeLevel();
    this.animate();
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xf9f9ff, 0x28432f, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(80, 150, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(sun);
  }

  async initializeLevel() {
    try {
      this.ui.clearLoadError();
      this.disposeLayerRoot();
      this.houseColliders.length = 0;
      this.signEntries.length = 0;

      const { data } = await loadLevelData(LEVEL_SOURCES);
      const { layerRoot } = await buildLevelFromData(data, {
        scene: this.scene,
        mapState: this.mapState,
        surfaceGrid: this.surfaceGrid,
        textureLoader: this.textureLoader,
        tileMaterialCache: this.tileMaterialCache,
        tileMetadata: this.tileMetadata
      });
      this.layerRoot = layerRoot;

      setupBuildings(data, {
        scene: this.scene,
        mapState: this.mapState,
        houseColliders: this.houseColliders,
        signEntries: this.signEntries
      });
      setupShowring(data, { scene: this.scene, mapState: this.mapState });
      scatterShrubs({
        scene: this.scene,
        mapState: this.mapState,
        surfaceGrid: this.surfaceGrid
      });

      this.player.setPosition(this.mapState.spawnPosition);
      this.surfaceResolver = createSurfaceResolver({
        mapState: this.mapState,
        surfaceGrid: this.surfaceGrid
      });
    } catch (error) {
      console.error(error);
      const advice =
        window.location.protocol === "file:"
          ? "Try running a local web server (for example: npx serve) so the browser can load JSON files."
          : "Please check that the level file exists and that your internet connection is available.";
      this.ui.showLoadError(`Level failed to load. ${advice}`);
    }
  }

  disposeLayerRoot() {
    if (!this.layerRoot) return;
    this.scene.remove(this.layerRoot);
    this.layerRoot.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
      }
    });
    this.layerRoot = null;
  }

  handleResize() {
    const aspectRatio = window.innerWidth / window.innerHeight;
    this.camera.left = -this.viewSize * aspectRatio;
    this.camera.right = this.viewSize * aspectRatio;
    this.camera.top = this.viewSize;
    this.camera.bottom = -this.viewSize;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  handleInteract() {
    if (!this.currentSign) return;
    this.ui.showMessage({
      title: this.currentSign.title,
      description: this.currentSign.description
    });
  }

  updateInteraction() {
    let closest = null;
    let minDistance = Infinity;
    const position = this.player.position;

    this.signEntries.forEach((sign) => {
      const distance = position.distanceTo(sign.mesh.position);
      if (distance < minDistance) {
        minDistance = distance;
        closest = sign;
      }
    });

    const interactDistance = 22;
    if (closest && minDistance < interactDistance) {
      this.currentSign = closest;
      this.ui.showPrompt(`Press Enter to read the ${closest.title} sign`);
    } else {
      this.currentSign = null;
      this.ui.hidePrompt();
    }
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();

    this.player.update(delta, {
      bounds: this.mapState.bounds,
      houseColliders: this.houseColliders,
      determineSurface: this.surfaceResolver
    });

    this.updateInteraction();

    const position = this.player.position;
    this.camera.position.set(position.x, this.cameraHeight, position.z);
    this.camera.lookAt(position.x, position.y, position.z);

    this.renderer.render(this.scene, this.camera);
  }
}
