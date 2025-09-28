import * as THREE from "three";

const directionRows = {
  up: 0,
  left: 1,
  down: 2,
  right: 3
};

const defaultSurfaceInfo = { surface: "grass", collides: false };

export class Player {
  constructor({ scene, canvas, remoteAssetBase }) {
    this.scene = scene;
    this.canvas = canvas;
    this.remoteAssetBase = remoteAssetBase;

    this.pressedKeys = new Set();
    this.preferredAxis = "vertical";
    this.movementVector = new THREE.Vector3();
    this.collisionProbe = new THREE.Vector3();
    this.speed = 28;

    this.currentDirection = "down";
    this.currentFrame = 0;
    this.frameDuration = 0.12;
    this.frameTimer = 0;

    this.spriteLoaded = false;

    this.audioInitialized = false;
    this.activeFootsteps = null;
    this.musicMuted = false;

    this.backgroundMusic = new Audio(`${this.remoteAssetBase}assets/music/mapmusic.mp3`);
    this.grassFootsteps = new Audio(`${this.remoteAssetBase}assets/sounds/grasswalk.mp3`);
    this.pathFootsteps = new Audio(`${this.remoteAssetBase}assets/sounds/pathwalk.mp3`);

    this.onInteract = null;
    this.onCancel = null;

    this.createSprite();
    this.bindHandlers();
    this.addEventListeners();
  }

  createSprite() {
    this.spriteCanvas = document.createElement("canvas");
    this.spriteCanvas.width = 64;
    this.spriteCanvas.height = 64;
    this.spriteCtx = this.spriteCanvas.getContext("2d");

    this.handlerTexture = new THREE.CanvasTexture(this.spriteCanvas);
    this.handlerTexture.magFilter = THREE.NearestFilter;
    this.handlerTexture.minFilter = THREE.NearestFilter;
    this.handlerTexture.generateMipmaps = false;

    this.spriteSheet = new Image();
    this.spriteSheet.crossOrigin = "anonymous";
    this.spriteSheet.src = `${this.remoteAssetBase}assets/walk.png`;
    this.spriteSheet.addEventListener("load", () => {
      this.spriteLoaded = true;
      this.setSpriteFrame(this.currentFrame, directionRows[this.currentDirection]);
    });

    const material = new THREE.MeshBasicMaterial({
      map: this.handlerTexture,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.handler = new THREE.Group();
    this.handlerSprite = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), material);
    this.handlerSprite.rotation.x = -Math.PI / 2;
    this.handlerSprite.position.y = 0.4;
    this.handler.add(this.handlerSprite);

    this.scene.add(this.handler);
  }

  bindHandlers() {
    this.boundInitializeAudio = this.initializeAudio.bind(this);
    this.boundPointerDown = () => this.initializeAudio();
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
  }

  addEventListeners() {
    this.canvas.addEventListener("click", this.boundInitializeAudio);
    window.addEventListener("pointerdown", this.boundPointerDown, { once: true });
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
  }

  setInteractionHandlers({ onInteract, onCancel }) {
    this.onInteract = onInteract;
    this.onCancel = onCancel;
  }

  handleKeyDown(event) {
    this.pressedKeys.add(event.code);
    if (event.code === "Enter" && typeof this.onInteract === "function") {
      this.onInteract();
    }
    if (event.code === "Escape" && typeof this.onCancel === "function") {
      this.onCancel();
    }
  }

  handleKeyUp(event) {
    this.pressedKeys.delete(event.code);
  }

  initializeAudio() {
    if (this.audioInitialized) return;
    this.audioInitialized = true;

    this.backgroundMusic.preload = "auto";
    this.backgroundMusic.loop = true;
    this.backgroundMusic.volume = 0.2;
    this.backgroundMusic.muted = this.musicMuted;
    this.backgroundMusic.play().catch(() => {});

    this.grassFootsteps.preload = "auto";
    this.grassFootsteps.volume = 0.4;
    this.grassFootsteps.playbackRate = 1.5;
    this.grassFootsteps.loop = true;

    this.pathFootsteps.preload = "auto";
    this.pathFootsteps.volume = 0.5;
    this.pathFootsteps.loop = true;

    this.primeFootstep(this.grassFootsteps);
    this.primeFootstep(this.pathFootsteps);
  }

  ensureAudioInitialized() {
    this.initializeAudio();
  }

  primeFootstep(audio) {
    audio.loop = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {});
  }

  setMusicMuted(isMuted) {
    this.musicMuted = isMuted;
    if (this.audioInitialized) {
      this.backgroundMusic.muted = this.musicMuted;
      if (!this.musicMuted) {
        this.backgroundMusic.play().catch(() => {});
      }
    }
    return this.musicMuted;
  }

  toggleMusicMuted() {
    return this.setMusicMuted(!this.musicMuted);
  }

  isMusicMuted() {
    return this.musicMuted;
  }

  playFootsteps(surface) {
    if (!this.audioInitialized) return;
    const target = surface === "path" ? this.pathFootsteps : this.grassFootsteps;
    if (this.activeFootsteps && this.activeFootsteps !== target) {
      this.activeFootsteps.pause();
      this.activeFootsteps.currentTime = 0;
    }

    this.activeFootsteps = target;
    if (this.activeFootsteps.paused) {
      this.activeFootsteps.play().catch(() => {});
    }
  }

  stopFootsteps() {
    if (!this.audioInitialized) return;
    if (this.activeFootsteps) {
      this.activeFootsteps.pause();
      this.activeFootsteps.currentTime = 0;
      this.activeFootsteps = null;
    }
  }

  update(delta, environment) {
    const bounds = environment?.bounds ?? {
      minX: -Infinity,
      maxX: Infinity,
      minZ: -Infinity,
      maxZ: Infinity
    };
    const houseColliders = environment?.houseColliders ?? [];
    const determineSurface = environment?.determineSurface ?? (() => defaultSurfaceInfo);

    let inputX = 0;
    let inputZ = 0;
    if (this.pressedKeys.has("ArrowUp") || this.pressedKeys.has("KeyW")) inputZ -= 1;
    if (this.pressedKeys.has("ArrowDown") || this.pressedKeys.has("KeyS")) inputZ += 1;
    if (this.pressedKeys.has("ArrowLeft") || this.pressedKeys.has("KeyA")) inputX -= 1;
    if (this.pressedKeys.has("ArrowRight") || this.pressedKeys.has("KeyD")) inputX += 1;

    if (inputX !== 0 && inputZ !== 0) {
      if (this.preferredAxis === "horizontal") {
        inputZ = 0;
      } else {
        inputX = 0;
      }
    } else if (inputX !== 0) {
      this.preferredAxis = "horizontal";
    } else if (inputZ !== 0) {
      this.preferredAxis = "vertical";
    }

    const hasInput = inputX !== 0 || inputZ !== 0;
    let moved = false;

    if (hasInput) {
      const startX = this.handler.position.x;
      const startZ = this.handler.position.z;

      if (Math.abs(inputX) > Math.abs(inputZ)) {
        this.updateDirection(inputX > 0 ? "right" : "left");
      } else {
        this.updateDirection(inputZ > 0 ? "down" : "up");
      }

      const length = Math.hypot(inputX, inputZ) || 1;
      this.movementVector
        .set(inputX / length, 0, inputZ / length)
        .multiplyScalar(this.speed * delta);

      let nextX = this.handler.position.x + this.movementVector.x;
      let nextZ = this.handler.position.z + this.movementVector.z;

      const { minX, maxX, minZ, maxZ } = bounds;
      nextX = THREE.MathUtils.clamp(nextX, minX, maxX);
      nextZ = THREE.MathUtils.clamp(nextZ, minZ, maxZ);

      for (const collider of houseColliders) {
        const withinZ = Math.abs(this.handler.position.z - collider.center.y) < collider.halfZ;
        if (withinZ && Math.abs(nextX - collider.center.x) < collider.halfX) {
          if (nextX > this.handler.position.x) {
            nextX = collider.center.x - collider.halfX;
          } else if (nextX < this.handler.position.x) {
            nextX = collider.center.x + collider.halfX;
          } else {
            nextX = this.handler.position.x;
          }
        }
      }

      for (const collider of houseColliders) {
        const withinX = Math.abs(nextX - collider.center.x) < collider.halfX;
        if (withinX && Math.abs(nextZ - collider.center.y) < collider.halfZ) {
          if (nextZ > this.handler.position.z) {
            nextZ = collider.center.y - collider.halfZ;
          } else if (nextZ < this.handler.position.z) {
            nextZ = collider.center.y + collider.halfZ;
          } else {
            nextZ = this.handler.position.z;
          }
        }
      }

      const probe = this.collisionProbe;
      const currentY = this.handler.position.y;

      if (nextX !== this.handler.position.x) {
        probe.set(nextX, currentY, this.handler.position.z);
        const tileInfo = determineSurface(probe) || defaultSurfaceInfo;
        if (tileInfo.collides) {
          nextX = this.handler.position.x;
        }
      }

      if (nextZ !== this.handler.position.z) {
        probe.set(nextX, currentY, nextZ);
        const tileInfo = determineSurface(probe) || defaultSurfaceInfo;
        if (tileInfo.collides) {
          nextZ = this.handler.position.z;
        }
      }

      this.handler.position.x = THREE.MathUtils.clamp(nextX, minX, maxX);
      this.handler.position.z = THREE.MathUtils.clamp(nextZ, minZ, maxZ);

      moved = this.handler.position.x !== startX || this.handler.position.z !== startZ;

      if (moved) {
        const tileInfo = determineSurface(this.handler.position) || defaultSurfaceInfo;
        this.playFootsteps(tileInfo.surface ?? "grass");
      } else {
        this.stopFootsteps();
      }
    } else {
      this.stopFootsteps();
    }

    this.updateSpriteAnimation(delta, moved);
  }

  updateSpriteAnimation(delta, moving) {
    const row = directionRows[this.currentDirection];
    if (moving) {
      this.frameTimer += delta;
      if (this.frameTimer >= this.frameDuration) {
        this.frameTimer -= this.frameDuration;
        this.currentFrame = (this.currentFrame + 1) % 9;
        this.setSpriteFrame(this.currentFrame, row);
      }
    } else if (this.currentFrame !== 0) {
      this.currentFrame = 0;
      this.frameTimer = 0;
      this.setSpriteFrame(this.currentFrame, row);
    }
  }

  setSpriteFrame(frameIndex, directionRow) {
    if (!this.spriteLoaded) return;
    this.spriteCtx.clearRect(0, 0, 64, 64);
    this.spriteCtx.drawImage(
      this.spriteSheet,
      frameIndex * 64,
      directionRow * 64,
      64,
      64,
      0,
      0,
      64,
      64
    );
    this.handlerTexture.needsUpdate = true;
  }

  updateDirection(direction) {
    if (this.currentDirection === direction) return;
    this.currentDirection = direction;
    this.setSpriteFrame(this.currentFrame, directionRows[this.currentDirection]);
  }

  setPosition(position) {
    this.handler.position.copy(position);
  }

  get position() {
    return this.handler.position;
  }

  get object() {
    return this.handler;
  }
}
