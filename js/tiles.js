import * as THREE from "three";

const buildingPalette = [
  { color: 0xfef3c7, trimColor: 0x1d3557, roofColor: 0xb56576 },
  { color: 0xe0f2ff, trimColor: 0x264653, roofColor: 0x457b9d },
  { color: 0xfdecef, trimColor: 0x2a9d8f, roofColor: 0xe76f51 },
  { color: 0xfff4e6, trimColor: 0x6d597a, roofColor: 0xb56576 },
  { color: 0xf0fff1, trimColor: 0x355070, roofColor: 0x6d597a },
  { color: 0xe9f5db, trimColor: 0x1f3c88, roofColor: 0x577590 }
];

export function createMapState() {
  return {
    tileWorldSize: 4,
    width: 0,
    height: 0,
    minX: -80,
    maxX: 80,
    minZ: -80,
    maxZ: 80,
    bounds: { minX: -70, maxX: 70, minZ: -70, maxZ: 70 },
    spawnPosition: new THREE.Vector3(0, 0, 0),
    tileToWorld(col, row, y = 0) {
      const x = this.minX + this.tileWorldSize * col + this.tileWorldSize * 0.5;
      const z = this.maxZ - this.tileWorldSize * row - this.tileWorldSize * 0.5;
      return new THREE.Vector3(x, y, z);
    },
    worldToTile(x, z) {
      const col = Math.floor((x - this.minX) / this.tileWorldSize);
      const row = Math.floor((this.maxZ - z) / this.tileWorldSize);
      return { col, row };
    }
  };
}

export async function loadTileMetadata() {
  const url = new URL("../data/tiles.json", import.meta.url);
  const response = await fetch(url.href, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load tile metadata: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function tryLoadLevel(source) {
  const resolved = new URL(source, import.meta.url);

  if (resolved.protocol === "file:") {
    const module = await import(resolved.href, { assert: { type: "json" } });
    return { data: module.default, origin: resolved.href };
  }

  const response = await fetch(resolved.href, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} ${response.statusText}`);
  }

  const isRawGithubCdn = resolved.hostname === "raw.githubusercontent.com";

  try {
    const data = isRawGithubCdn ? JSON.parse(await response.text()) : await response.json();
    return { data, origin: resolved.href };
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${resolved.href}: ${error.message}`);
  }
}

export async function loadLevelData(sources) {
  const attempts = Array.isArray(sources) ? sources : [sources];
  const errors = [];

  for (const source of attempts) {
    try {
      const result = await tryLoadLevel(source);
      console.info(`Loaded level data from ${result.origin}`);
      return result;
    } catch (error) {
      console.warn(`Failed to load level from ${source}:`, error);
      errors.push({ source, error });
    }
  }

  const failure = new Error(
    `Unable to load level data. Attempts: ${errors
      .map(({ source, error }) => `${source} (${error.message})`)
      .join("; ")}`
  );
  failure.attempts = errors;
  throw failure;
}

export async function buildLevelFromData(
  data,
  { scene, mapState, surfaceGrid, textureLoader, tileMaterialCache, tileMetadata }
) {
  const tileWorldSize = data.tileWorldSize ?? data.tileSize ?? 32;
  const primaryLayer = Array.isArray(data.layers) ? data.layers[0] : null;
  const layerGrid = primaryLayer?.grid ?? [];
  const fallbackTiles = Array.isArray(data.tiles) ? data.tiles : [];
  const inferredHeight =
    data.height ?? (layerGrid.length || fallbackTiles.length || data.size || 0);
  const inferredWidth =
    data.width ?? (layerGrid[0]?.length || fallbackTiles[0]?.length || data.size || 0);
  const width = inferredWidth;
  const height = inferredHeight;
  const halfWidth = (width * tileWorldSize) / 2;
  const halfHeight = (height * tileWorldSize) / 2;

  mapState.tileWorldSize = tileWorldSize;
  mapState.width = width;
  mapState.height = height;
  mapState.minX = -halfWidth;
  mapState.maxX = halfWidth;
  mapState.minZ = -halfHeight;
  mapState.maxZ = halfHeight;
  mapState.bounds = {
    minX: mapState.minX + tileWorldSize * 0.5,
    maxX: mapState.maxX - tileWorldSize * 0.5,
    minZ: mapState.minZ + tileWorldSize * 0.5,
    maxZ: mapState.maxZ - tileWorldSize * 0.5
  };

  surfaceGrid.length = height;
  for (let row = 0; row < height; row++) {
    surfaceGrid[row] = new Array(width).fill("grass");
  }

  const tilesetEntries = Object.entries(data.tilesets ?? {});
  const tilesets = {};
  await Promise.all(
    tilesetEntries.map(
      ([key, info]) =>
        new Promise((resolve, reject) => {
          textureLoader.load(
            info.src,
            (texture) => {
              texture.magFilter = THREE.NearestFilter;
              texture.minFilter = THREE.NearestFilter;
              texture.generateMipmaps = false;
              texture.colorSpace = THREE.SRGBColorSpace;
              const tileSize = info.tileSize ?? data.tileSize ?? 32;
              const columns = Math.max(1, Math.floor(texture.image.width / tileSize));
              const rows = Math.max(1, Math.floor(texture.image.height / tileSize));
              tilesets[key] = { texture, tileSize, columns, rows, name: key };
              resolve();
            },
            undefined,
            (error) => reject(error)
          );
        })
    )
  );

  const layers = data.layers ?? [];
  const layerRoot = new THREE.Group();
  scene.add(layerRoot);

  const legend = data.legend ?? {};
  const metadataTiles = tileMetadata?.tiles ?? {};

  layers.forEach((layer, layerIndex) => {
    const group = new THREE.Group();
    group.position.y = layerIndex * 0.01;
    layerRoot.add(group);

    const grid = layer.grid ?? [];
    for (let row = 0; row < height; row++) {
      const rowData = grid[row] ?? [];
      for (let col = 0; col < width; col++) {
        const key = rowData[col];
        if (!key) continue;
        const baseTile = legend[key];
        if (!baseTile) continue;
        const metadata = metadataTiles[key] ?? {};
        const tileDef = { ...metadata, ...baseTile };
        const tilesetKey = tileDef.tileset;
        const tileset = tilesetKey ? tilesets[tilesetKey] : null;

        const mesh = createTileMesh({
          tileset,
          tileDef,
          col,
          row,
          mapState,
          tileMaterialCache
        });
        if (!mesh) continue;
        mesh.position.y = 0;
        group.add(mesh);

        if (tileDef.surface) {
          surfaceGrid[row][col] = tileDef.surface;
        }
      }
    }
  });

  if (!layers.length && fallbackTiles.length) {
    const group = new THREE.Group();
    layerRoot.add(group);
    for (let row = 0; row < fallbackTiles.length; row++) {
      const rowData = fallbackTiles[row] ?? [];
      for (let col = 0; col < rowData.length; col++) {
        const key = rowData[col];
        if (!key) continue;
        const baseTile = legend[key] ?? {};
        const metadata = metadataTiles[key] ?? {};
        const tileDef = { ...metadata, ...baseTile };
        const mesh = createTileMesh({
          tileset: null,
          tileDef,
          col,
          row,
          mapState,
          tileMaterialCache
        });
        if (!mesh) continue;
        mesh.position.y = 0;
        group.add(mesh);
        if (tileDef.surface) {
          surfaceGrid[row][col] = tileDef.surface;
        }
      }
    }
  }

  const spawnDef = data.objects?.spawn ?? data.spawn;
  if (spawnDef?.tile) {
    const spawn = mapState.tileToWorld(spawnDef.tile[0], spawnDef.tile[1]);
    if (spawnDef.offset) {
      spawn.add(
        new THREE.Vector3(
          spawnDef.offset[0] ?? 0,
          spawnDef.offset[1] ?? 0,
          spawnDef.offset[2] ?? 0
        )
      );
    }
    mapState.spawnPosition.copy(spawn);
  }

  return { layerRoot };
}

export function setupBuildings(levelData, { scene, mapState, houseColliders, signEntries }) {
  const buildings = levelData.objects?.buildings ?? [];
  buildings.forEach((data, index) => {
    const worldPosition = mapState.tileToWorld(data.tile[0], data.tile[1]);
    if (data.offset) {
      worldPosition.add(
        new THREE.Vector3(
          data.offset[0] ?? 0,
          data.offset[1] ?? 0,
          data.offset[2] ?? 0
        )
      );
    }

    if (data.spawnHouse !== false) {
      const palette = buildingPalette[index % buildingPalette.length];
      const house = createHouse(palette);
      house.position.copy(worldPosition);
      if (data.rotation) {
        house.rotation.y = THREE.MathUtils.degToRad(data.rotation);
      }
      scene.add(house);

      const halfSize = data.collider?.halfSize ?? [13, 12];
      const offset = data.collider?.offset ?? [0, 0];
      houseColliders.push({
        center: new THREE.Vector2(
          worldPosition.x + (offset[0] ?? 0),
          worldPosition.z + (offset[1] ?? 0)
        ),
        halfX: halfSize[0],
        halfZ: halfSize[1]
      });
    } else if (data.collider) {
      const halfSize = data.collider.halfSize ?? [13, 12];
      const offset = data.collider.offset ?? [0, 0];
      houseColliders.push({
        center: new THREE.Vector2(
          worldPosition.x + (offset[0] ?? 0),
          worldPosition.z + (offset[1] ?? 0)
        ),
        halfX: halfSize[0],
        halfZ: halfSize[1]
      });
    }

    const sign = createSign();
    const signOffset = data.signOffset ?? [0, 0, 6];
    sign.position.set(
      worldPosition.x + (signOffset[0] ?? 0),
      signOffset[1] ?? 0,
      worldPosition.z + (signOffset[2] ?? 0)
    );
    if (data.signRotation) {
      sign.rotation.y = THREE.MathUtils.degToRad(data.signRotation);
    }
    scene.add(sign);

    signEntries.push({
      mesh: sign,
      title: data.title,
      description: data.description
    });
  });

  const extraSigns = levelData.objects?.extraSigns ?? [];
  extraSigns.forEach((data) => {
    const worldPosition = mapState.tileToWorld(data.tile[0], data.tile[1]);
    if (data.offset) {
      worldPosition.add(
        new THREE.Vector3(
          data.offset[0] ?? 0,
          data.offset[1] ?? 0,
          data.offset[2] ?? 0
        )
      );
    }
    const sign = createSign();
    const offset = data.signOffset ?? [0, 0, 0];
    sign.position.set(
      worldPosition.x + (offset[0] ?? 0),
      offset[1] ?? 0,
      worldPosition.z + (offset[2] ?? 0)
    );
    if (data.signRotation) {
      sign.rotation.y = THREE.MathUtils.degToRad(data.signRotation);
    }
    scene.add(sign);
    signEntries.push({
      mesh: sign,
      title: data.title,
      description: data.description
    });
  });
}

export function setupShowring(levelData, { scene, mapState }) {
  const showring = levelData.objects?.showring;
  if (!showring?.tile) return;
  const center = mapState.tileToWorld(showring.tile[0], showring.tile[1]);
  const radius = showring.radius ?? 18;
  const floorRadius = showring.floorRadius ?? radius - 1.5;
  const height = showring.height ?? 1.4;

  const ringBorder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 64, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x3a2c1f, side: THREE.DoubleSide })
  );
  ringBorder.position.set(center.x, height / 2, center.z);
  ringBorder.castShadow = true;
  ringBorder.receiveShadow = true;
  scene.add(ringBorder);

  const ringFloor = new THREE.Mesh(
    new THREE.CircleGeometry(floorRadius, 48),
    new THREE.MeshLambertMaterial({ color: 0xd9c097 })
  );
  ringFloor.rotation.x = -Math.PI / 2;
  ringFloor.position.set(center.x, 0.05, center.z);
  ringFloor.receiveShadow = true;
  scene.add(ringFloor);

  const bleacherMaterial = new THREE.MeshLambertMaterial({ color: 0xe6e0d6 });
  const bleacherRadius = radius + 6;
  for (let i = 0; i < 4; i++) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 4), bleacherMaterial);
    const angle = (i / 4) * Math.PI * 2;
    bench.position.set(
      center.x + Math.cos(angle) * bleacherRadius,
      1,
      center.z + Math.sin(angle) * bleacherRadius
    );
    bench.rotation.y = angle + Math.PI / 2;
    bench.castShadow = true;
    bench.receiveShadow = true;
    scene.add(bench);
  }
}

export function scatterShrubs({ scene, mapState, surfaceGrid }, count = 28) {
  const shrubMaterial = new THREE.MeshLambertMaterial({ color: 0x1e6f3b });
  const candidates = [];
  for (let row = 0; row < surfaceGrid.length; row++) {
    for (let col = 0; col < surfaceGrid[row].length; col++) {
      if (surfaceGrid[row][col] === "grass") {
        candidates.push({ row, col });
      }
    }
  }

  for (let i = 0; i < count && candidates.length > 0; i++) {
    const index = Math.floor(Math.random() * candidates.length);
    const { row, col } = candidates.splice(index, 1)[0];
    const center = mapState.tileToWorld(col, row);
    const shrub = new THREE.Mesh(
      new THREE.SphereGeometry(THREE.MathUtils.randFloat(2, 4), 12, 12),
      shrubMaterial
    );
    shrub.position.set(
      center.x + THREE.MathUtils.randFloatSpread(mapState.tileWorldSize * 0.6),
      THREE.MathUtils.randFloat(1, 3),
      center.z + THREE.MathUtils.randFloatSpread(mapState.tileWorldSize * 0.6)
    );
    shrub.castShadow = true;
    shrub.receiveShadow = true;
    scene.add(shrub);
  }
}

export function createSurfaceResolver({ mapState, surfaceGrid }) {
  return (position) => {
    if (!surfaceGrid.length) return "grass";
    const col = Math.floor((position.x - mapState.minX) / mapState.tileWorldSize);
    const row = Math.floor((mapState.maxZ - position.z) / mapState.tileWorldSize);
    if (row < 0 || row >= surfaceGrid.length) return "grass";
    if (col < 0 || col >= surfaceGrid[row].length) return "grass";
    return surfaceGrid[row][col] || "grass";
  };
}

function createHouse({ color, trimColor, roofColor }) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(22, 16, 20),
    new THREE.MeshLambertMaterial({ color })
  );
  base.position.y = 8;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(18, 10, 4),
    new THREE.MeshLambertMaterial({ color: roofColor })
  );
  roof.position.y = 18;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(5, 8, 1.4),
    new THREE.MeshLambertMaterial({ color: trimColor })
  );
  door.position.set(0, 4, 10.7);
  door.castShadow = true;
  group.add(door);

  const windowGeometry = new THREE.BoxGeometry(4, 4, 1.2);
  const windowMaterial = new THREE.MeshLambertMaterial({ color: 0xf1f6ff });
  const windowPositions = [
    [-8, 6, 10.4],
    [8, 6, 10.4]
  ];
  windowPositions.forEach(([x, y, z]) => {
    const window = new THREE.Mesh(windowGeometry, windowMaterial);
    window.position.set(x, y, z);
    window.castShadow = true;
    group.add(window);
  });

  return group;
}

function createSign() {
  const group = new THREE.Group();

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 12, 12),
    new THREE.MeshLambertMaterial({ color: 0x8c5627 })
  );
  post.position.y = 6;
  post.castShadow = true;
  group.add(post);

  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(9, 4.2, 1.1),
    new THREE.MeshLambertMaterial({ color: 0xfff5b5 })
  );
  plank.position.set(0, 10, 0.4);
  plank.castShadow = true;
  group.add(plank);

  return group;
}

function createTileMesh({ tileset, tileDef, col, row, mapState, tileMaterialCache }) {
  const geometry = new THREE.PlaneGeometry(mapState.tileWorldSize, mapState.tileWorldSize);
  geometry.attributes.uv = geometry.attributes.uv.clone();

  let material = null;
  let cacheKey = null;

  if (tileset) {
    const tileIndex = tileDef.index ?? null;
    const frame = tileDef.frame ?? null;
    let column = 0;
    let tileRow = 0;
    if (frame) {
      column = frame[0];
      tileRow = frame[1];
    } else if (tileIndex !== null) {
      column = tileIndex % tileset.columns;
      tileRow = Math.floor(tileIndex / tileset.columns);
    }

    const du = 1 / tileset.columns;
    const dv = 1 / tileset.rows;
    const u0 = column * du;
    const v0 = 1 - (tileRow + 1) * dv;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, u0 + u * du, v0 + v * dv);
    }
    uv.needsUpdate = true;

    cacheKey = `${tileset.name}:${column},${tileRow}`;
    material = tileMaterialCache.get(cacheKey);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ map: tileset.texture, transparent: true });
      tileMaterialCache.set(cacheKey, material);
    }
  } else if (tileDef.color) {
    cacheKey = `color:${tileDef.color}`;
    material = tileMaterialCache.get(cacheKey);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color: new THREE.Color(tileDef.color) });
      tileMaterialCache.set(cacheKey, material);
    }
  }

  if (!material) {
    return null;
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  const worldPosition = mapState.tileToWorld(col, row);
  mesh.position.set(worldPosition.x, 0, worldPosition.z);
  return mesh;
}
