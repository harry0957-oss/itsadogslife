import { NINE_SLICE_KEYS } from '../data/tile-metadata.js';

const TILE_SIZE = 32;
const BRUSH_OPTIONS = [1, 2, 4, 8];
const DEFAULT_GRID_SIZE = 16;
const GRID_LIMITS = { min: 6, max: 50 };

function computeNineSliceKey(x, y, gridSize, matchFn) {
  const up = matchFn(x, y - 1);
  const down = matchFn(x, y + 1);
  const left = matchFn(x - 1, y);
  const right = matchFn(x + 1, y);

  let key = 'center';

  if (!up && !down && !left && !right) {
    key = 'single';
  } else if (!up && down) {
    if (!left && right) key = 'topLeft';
    else if (!right && left) key = 'topRight';
    else key = 'top';
  } else if (!down && up) {
    if (!left && right) key = 'bottomLeft';
    else if (!right && left) key = 'bottomRight';
    else key = 'bottom';
  } else if (!left && right) {
    key = 'left';
  } else if (!right && left) {
    key = 'right';
  }

  if (!NINE_SLICE_KEYS.includes(key)) {
    return 'center';
  }
  return key;
}

function spriteLayer(config, frame) {
  if (!config || !frame || frame.length !== 2) return null;
  const tileset = config.tileset;
  if (!tileset?.src) return null;
  const size = tileset.tileSize ?? TILE_SIZE;
  const columns = tileset.columns ?? 1;
  const rows = tileset.rows ?? 1;
  const width = columns * size;
  const height = rows * size;
  const offsetX = frame[0] * size;
  const offsetY = frame[1] * size;
  return {
    image: `url(${tileset.src})`,
    size: `${width}px ${height}px`,
    position: `${-offsetX}px ${-offsetY}px`
  };
}

function tintLayer(color) {
  return { image: `linear-gradient(${color}, ${color})`, size: '100% 100%', position: '0 0' };
}

function normalizeText(text, maxLength) {
  if (typeof text !== 'string') return '';
  return text.slice(0, maxLength).trim();
}

function getSpriteConfig(metadata, tileId) {
  const tile = metadata?.tiles?.[tileId];
  if (!tile?.sprite) return null;
  const tilesetId = tile.sprite.tileset;
  const tileset = tilesetId ? metadata.tilesets?.[tilesetId] : null;
  if (!tileset) return null;
  return { tileId, tile, sprite: tile.sprite, tileset: { ...tileset, id: tilesetId } };
}

function generateFrameKeyVariants(key) {
  if (!key) return [];
  const variants = new Set([key]);

  if (/[A-Z]/.test(key)) {
    variants.add(key.replace(/([A-Z])/g, '-$1').toLowerCase());
    variants.add(key.replace(/([A-Z])/g, '_$1').toLowerCase());
  }

  if (key.includes('-') || key.includes('_')) {
    const parts = key.split(/[-_]/).filter(Boolean);
    if (parts.length) {
      const camel = parts
        .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('');
      if (camel) {
        variants.add(camel);
      }
    }
  }

  if (key === 'center') {
    variants.add('centre');
  } else if (key === 'centre') {
    variants.add('center');
  } else if (key === 'single') {
    variants.add('default');
  } else if (key === 'default') {
    variants.add('single');
  }

  return Array.from(variants).filter(Boolean);
}

function resolveNineSliceFrame(frames, key) {
  if (!frames || typeof frames !== 'object') return null;
  const variants = generateFrameKeyVariants(key);
  for (const variant of variants) {
    const frame = frames?.[variant];
    if (Array.isArray(frame) && frame.length === 2) {
      return frame;
    }
  }
  return null;
}

function pickFrame(config, key) {
  if (!config?.sprite) return null;
  const { sprite } = config;
  if (sprite.type === 'nine-slice') {
    const frames = sprite.frames ?? {};
    return (
      resolveNineSliceFrame(frames, key) ??
      resolveNineSliceFrame(frames, 'center') ??
      resolveNineSliceFrame(frames, 'single') ??
      (Array.isArray(sprite.frame) && sprite.frame.length === 2 ? sprite.frame : null)
    );
  }
  if (sprite.type === 'single') {
    return sprite.frame ?? null;
  }
  return null;
}

function createTownMode(tileMetadata) {
  const overlayEmoji = {
    none: '',
    grass: '',
    'short-grass': '',
    'long-grass': '',
    path: '',
    house: '🏠',
    vets: '🐾',
    'dog-training': '🎯',
    'dog-groomers': '✂️',
    'dog-show': '🏆',
    'pet-shop': '🛍️',
    sign: '🪧'
  };

  const buildingTints = {
    house: 'rgba(199, 98, 120, 0.72)',
    vets: 'rgba(70, 140, 180, 0.72)',
    'dog-training': 'rgba(138, 109, 200, 0.72)',
    'dog-groomers': 'rgba(200, 90, 150, 0.72)',
    'dog-show': 'rgba(200, 170, 90, 0.72)',
    'pet-shop': 'rgba(90, 170, 120, 0.72)'
  };

  const sprites = {
    land: getSpriteConfig(tileMetadata, 'land'),
    sea: getSpriteConfig(tileMetadata, 'sea'),
    grass: getSpriteConfig(tileMetadata, 'grass'),
    shortGrass: getSpriteConfig(tileMetadata, 'short-grass'),
    longGrass: getSpriteConfig(tileMetadata, 'long-grass'),
    path: getSpriteConfig(tileMetadata, 'path'),
    water: getSpriteConfig(tileMetadata, 'water')
  };

  const mode = {
    id: 'town',
    label: 'Town Exterior',
    title: 'Town Level Designer',
    tagline: 'Left click to paint • Right click to sea',
    instructions:
      'Select Land to shape your island, use Grass with larger brushes to fill areas, then add paths, specialist buildings, and custom signs. Right-click turns tiles back into sea.',
    defaultTool: 'land',
    signToolId: 'sign',
    signMaxLength: 32,
    layoutFileName: 'town-layout.json',
    requiredBase: 'land',
    baseLabels: { sea: 'sea', land: 'land' },
    overlayLabels: {
      grass: 'grass',
      'short-grass': 'short grass',
      'long-grass': 'long grass',
      path: 'path',
      house: 'house',
      vets: 'veterinary clinic',
      'dog-training': 'dog training grounds',
      'dog-groomers': 'dog groomers',
      'dog-show': 'dog show arena',
      'pet-shop': 'pet shop',
      sign: 'sign'
    },
    overlayEmoji,
    baseTypes: new Set(['sea', 'land']),
    overlayTypes: new Set([
      'none',
      'grass',
      'path',
      'short-grass',
      'long-grass',
      'house',
      'vets',
      'dog-training',
      'dog-groomers',
      'dog-show',
      'pet-shop',
      'sign'
    ]),
    brushTools: new Set(['land', 'sea', 'grass', 'short-grass', 'long-grass']),
    landOnlyTools: new Set([
      'grass',
      'short-grass',
      'long-grass',
      'path',
      'house',
      'vets',
      'dog-training',
      'dog-groomers',
      'dog-show',
      'pet-shop',
      'sign'
    ]),
    buildingTools: new Set(['house', 'vets', 'dog-training', 'dog-groomers', 'dog-show', 'pet-shop']),
    buildingSize: 5,
    buildingTints,
    defaultTile: () => ({ base: 'sea', overlay: 'none', signText: '' }),
    messages: {
      needsBase: 'Claim land before placing terrain, buildings, or signs.',
      gridInvalid: 'Grid size must be between 6 and 50.',
      resized: (size) => `Grid resized to ${size} × ${size}. Start shaping your land!`,
      buildingRequirement: (label, size) => `Need a ${size}×${size} land area cleared for ${label}.`,
      loadSuccess: (file) => `Loaded layout from ${file}.`
    },
    signSection: {
      legend: 'Sign Writer',
      label: 'Message',
      hint: 'Update existing signs by painting them again.',
      placeholder: 'Welcome adventurers'
    },
    preview: {
      documentTitle: 'Town Level Preview',
      title: 'Town Level Preview',
      footer: 'Everything beyond the island edge is open sea and currently inaccessible.',
      background: 'radial-gradient(circle at top, rgba(120, 180, 255, 0.18), rgba(9, 14, 24, 0.95))'
    }
  };

  mode.palette = [
    { id: 'land', label: 'Land', icon: '🏝️', description: 'Claim land from the surrounding sea.', category: 'base', base: 'land' },
    { id: 'sea', label: 'Sea', icon: '🌊', description: 'Return a tile to open water.', category: 'base', base: 'sea' },
    { id: 'grass', label: 'Grass', icon: '🌱', description: 'Add standard grass using the shared tileset.', category: 'overlay', overlay: 'grass', requiresBase: 'land' },
    { id: 'short-grass', label: 'Short Grass', icon: '🌾', description: 'Trimmed grass variant for tidy areas.', category: 'overlay', overlay: 'short-grass', requiresBase: 'land' },
    { id: 'long-grass', label: 'Long Grass', icon: '🌿', description: 'Tall grass using the long grass sheet.', category: 'overlay', overlay: 'long-grass', requiresBase: 'land' },
    { id: 'path', label: 'Path', icon: '🪨', description: 'Lay walking paths for players.', category: 'overlay', overlay: 'path', requiresBase: 'land' },
    { id: 'house', label: 'House', icon: '🏠', description: 'Place village houses on land.', category: 'building', overlay: 'house' },
    { id: 'vets', label: 'Vets', icon: '🐾', description: 'Mark veterinary services for pets.', category: 'building', overlay: 'vets' },
    { id: 'dog-training', label: 'Dog Training', icon: '🎯', description: 'Plan dedicated dog training areas.', category: 'building', overlay: 'dog-training' },
    { id: 'dog-groomers', label: 'Dog Groomers', icon: '✂️', description: 'Set up grooming parlours for pups.', category: 'building', overlay: 'dog-groomers' },
    { id: 'dog-show', label: 'Dog Show', icon: '🏆', description: 'Designate the show arena.', category: 'building', overlay: 'dog-show' },
    { id: 'pet-shop', label: 'Pet Shop', icon: '🛍️', description: 'Place pet supply stores.', category: 'building', overlay: 'pet-shop' },
    { id: 'sign', label: 'Sign', icon: '🪧', description: 'Add signage for directions or lore.', category: 'sign', requiresBase: 'land' }
  ];

  mode.toolsById = new Map(mode.palette.map((tool) => [tool.id, tool]));

  mode.normalizeSignText = (text) => normalizeText(text, mode.signMaxLength);

  mode.getOverlaySymbol = (tile) => {
    if (tile.overlay === mode.signToolId) {
      return tile.signText || overlayEmoji[mode.signToolId] || '';
    }
    return overlayEmoji[tile.overlay] || '';
  };

  mode.describeOverlay = (tile) => {
    if (tile.overlay === 'none') return '';
    if (tile.overlay === mode.signToolId) {
      return tile.signText ? `sign “${tile.signText}”` : 'sign';
    }
    return mode.overlayLabels[tile.overlay] || tile.overlay.replace(/-/g, ' ');
  };

  mode.buildTileLayers = ({ state, gridSize, tile, x, y }) => {
    const defaultBase = mode.defaultTile().base;
    const baseMatch = (nx, ny) => {
      if (ny < 0 || ny >= gridSize || nx < 0 || nx >= gridSize) {
        return tile.base === defaultBase;
      }
      return state[ny][nx].base === tile.base;
    };
    const overlayMatch = (nx, ny, overlay) =>
      ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize && state[ny][nx].overlay === overlay;

    const baseConfig =
      tile.base === 'sea'
        ? sprites.sea ?? sprites.water ?? null
        : sprites.land ?? null;

    let baseLayer = null;
    if (baseConfig?.sprite) {
      const baseKey =
        baseConfig.sprite.type === 'nine-slice'
          ? computeNineSliceKey(x, y, gridSize, baseMatch)
          : 'single';
      baseLayer = spriteLayer(baseConfig, pickFrame(baseConfig, baseKey));
    }

    const overlayLayers = [];
    const overlay = tile.overlay;

    if (overlay === 'grass') {
      const key = computeNineSliceKey(x, y, gridSize, (nx, ny) => overlayMatch(nx, ny, 'grass'));
      const layer = spriteLayer(sprites.grass, pickFrame(sprites.grass, key));
      if (layer) overlayLayers.push(layer);
    } else if (overlay === 'short-grass') {
      const config = sprites.shortGrass;
      const key =
        config?.sprite?.type === 'nine-slice'
          ? computeNineSliceKey(x, y, gridSize, (nx, ny) => overlayMatch(nx, ny, 'short-grass'))
          : 'single';
      const layer = spriteLayer(config, pickFrame(config, key));
      if (layer) overlayLayers.push(layer);
    } else if (overlay === 'long-grass') {
      const config = sprites.longGrass;
      const key =
        config?.sprite?.type === 'nine-slice'
          ? computeNineSliceKey(x, y, gridSize, (nx, ny) => overlayMatch(nx, ny, 'long-grass'))
          : 'single';
      const layer = spriteLayer(config, pickFrame(config, key));
      if (layer) overlayLayers.push(layer);
    } else if (overlay === 'path') {
      const key = computeNineSliceKey(x, y, gridSize, (nx, ny) => overlayMatch(nx, ny, 'path'));
      const layer = spriteLayer(sprites.path, pickFrame(sprites.path, key));
      if (layer) overlayLayers.push(layer);
    } else if (overlay === 'sign') {
      overlayLayers.push(tintLayer('rgba(150, 98, 45, 0.75)'));
    } else if (buildingTints[overlay]) {
      overlayLayers.push(tintLayer(buildingTints[overlay]));
    }

    return [...overlayLayers, baseLayer].filter(Boolean);
  };

  mode.sanitizeTile = (tile) => {
    const safeBase = mode.baseTypes.has(tile?.base) ? tile.base : mode.defaultTile().base;
    let safeOverlay = mode.overlayTypes.has(tile?.overlay) ? tile.overlay : 'none';
    let safeSign = '';

    if (safeOverlay !== 'none' && safeBase !== mode.requiredBase) {
      safeOverlay = 'none';
    }

    if (safeOverlay === mode.signToolId) {
      safeSign = mode.normalizeSignText(tile?.signText);
    }

    return {
      base: safeOverlay === 'none' ? safeBase : mode.requiredBase,
      overlay: safeOverlay,
      signText: safeSign
    };
  };

  return mode;
}

function createInteriorMode() {
  const overlayEmoji = {
    none: '',
    carpet: '🟥',
    'tile-inlay': '🎨',
    counter: '🪑',
    kennel: '🐶',
    sign: '📝'
  };

  const overlayLabels = {
    carpet: 'carpet',
    'tile-inlay': 'tile inlay',
    counter: 'counter',
    kennel: 'kennel space',
    sign: 'note'
  };

  const mode = {
    id: 'interior',
    label: 'Interior',
    title: 'Interior Level Designer',
    tagline: 'Left click to paint • Right click to clear',
    instructions:
      'Lay down Floor tiles to outline the room, then add carpets, counters, kennels, and notes to plan the interior spaces. Right-click clears tiles back to empty space.',
    defaultTool: 'land',
    signToolId: 'sign',
    signMaxLength: 64,
    layoutFileName: 'interior-layout.json',
    requiredBase: 'land',
    baseLabels: { sea: 'empty space', land: 'floor' },
    overlayLabels,
    overlayEmoji,
    baseTypes: new Set(['sea', 'land']),
    overlayTypes: new Set(['none', 'carpet', 'tile-inlay', 'counter', 'kennel', 'sign']),
    brushTools: new Set(['land', 'sea', 'carpet', 'tile-inlay']),
    landOnlyTools: new Set(['carpet', 'tile-inlay', 'counter', 'kennel', 'sign']),
    buildingTools: new Set(),
    buildingSize: 3,
    buildingTints: {
      carpet: 'rgba(180, 70, 90, 0.78)',
      'tile-inlay': 'rgba(90, 150, 190, 0.78)',
      counter: 'rgba(180, 150, 110, 0.78)',
      kennel: 'rgba(140, 110, 80, 0.78)',
      sign: 'rgba(190, 160, 120, 0.78)'
    },
    defaultTile: () => ({ base: 'sea', overlay: 'none', signText: '' }),
    messages: {
      needsBase: 'Lay down Floor before placing interior details.',
      gridInvalid: 'Grid size must be between 6 and 50.',
      resized: (size) => `Grid resized to ${size} × ${size}. Sketch a new floor plan!`,
      buildingRequirement: (label, size) => `Need a ${size}×${size} floor area cleared for ${label}.`,
      loadSuccess: (file) => `Loaded layout from ${file}.`
    },
    signSection: {
      legend: 'Note Board',
      label: 'Note',
      hint: 'Update existing notes by painting them again.',
      placeholder: 'Remember to add plants'
    },
    preview: {
      documentTitle: 'Interior Layout Preview',
      title: 'Interior Layout Preview',
      footer: 'Previewing building interior layout.',
      background: 'radial-gradient(circle at top, rgba(200, 180, 255, 0.18), rgba(18, 12, 28, 0.95))'
    }
  };

  mode.palette = [
    { id: 'land', label: 'Floor', icon: '🧱', description: 'Lay down sturdy flooring.', category: 'base', base: 'land' },
    { id: 'sea', label: 'Empty Space', icon: '⬛', description: 'Clear back to empty space.', category: 'base', base: 'sea' },
    { id: 'carpet', label: 'Carpet', icon: '🟥', description: 'Add a soft carpet area.', category: 'overlay', overlay: 'carpet', requiresBase: 'land' },
    { id: 'tile-inlay', label: 'Tile Inlay', icon: '🎨', description: 'Decorative tile pattern.', category: 'overlay', overlay: 'tile-inlay', requiresBase: 'land' },
    { id: 'counter', label: 'Counter', icon: '🪑', description: 'Place interior counters or desks.', category: 'overlay', overlay: 'counter', requiresBase: 'land' },
    { id: 'kennel', label: 'Kennel', icon: '🐶', description: 'Set a kennel space for pups.', category: 'overlay', overlay: 'kennel', requiresBase: 'land' },
    { id: 'sign', label: 'Note', icon: '📝', description: 'Add designer notes for the room.', category: 'sign', requiresBase: 'land' }
  ];

  mode.toolsById = new Map(mode.palette.map((tool) => [tool.id, tool]));

  mode.normalizeSignText = (text) => normalizeText(text, mode.signMaxLength);

  mode.getOverlaySymbol = (tile) => {
    if (tile.overlay === mode.signToolId) {
      return tile.signText || overlayEmoji[mode.signToolId] || '';
    }
    return overlayEmoji[tile.overlay] || '';
  };

  mode.describeOverlay = (tile) => {
    if (tile.overlay === 'none') return '';
    if (tile.overlay === mode.signToolId) {
      return tile.signText ? `note “${tile.signText}”` : 'note';
    }
    return overlayLabels[tile.overlay] || tile.overlay.replace(/-/g, ' ');
  };

  mode.buildTileLayers = ({ tile }) => {
    const layers = [];

    if (mode.buildingTints[tile.overlay]) {
      layers.push(tintLayer(mode.buildingTints[tile.overlay]));
    } else if (tile.overlay === mode.signToolId) {
      layers.push(tintLayer(mode.buildingTints[mode.signToolId]));
    }

    const baseLayer =
      tile.base === 'sea'
        ? tintLayer('rgba(20, 24, 32, 0.85)')
        : tintLayer('rgba(120, 98, 82, 0.9)');

    layers.push(baseLayer);
    return layers.filter(Boolean);
  };

  mode.sanitizeTile = (tile) => {
    const safeBase = mode.baseTypes.has(tile?.base) ? tile.base : mode.defaultTile().base;
    let safeOverlay = mode.overlayTypes.has(tile?.overlay) ? tile.overlay : 'none';
    let safeSign = '';

    if (safeOverlay !== 'none' && safeBase !== mode.requiredBase) {
      safeOverlay = 'none';
    }

    if (safeOverlay === mode.signToolId) {
      safeSign = mode.normalizeSignText(tile?.signText);
    }

    return {
      base: safeOverlay === 'none' ? safeBase : mode.requiredBase,
      overlay: safeOverlay,
      signText: safeSign
    };
  };

  return mode;
}

function createDesignModes(tileMetadata) {
  const modes = {
    town: createTownMode(tileMetadata),
    interior: createInteriorMode()
  };
  return Object.freeze(modes);
}

export { TILE_SIZE, BRUSH_OPTIONS, DEFAULT_GRID_SIZE, GRID_LIMITS, createDesignModes };
