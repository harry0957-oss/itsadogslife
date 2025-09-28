const TILE_SIZE = 32;
const BRUSH_OPTIONS = [1, 2, 4, 8];
const DEFAULT_GRID_SIZE = 16;
const GRID_LIMITS = { min: 6, max: 50 };

const NINE_SLICE_COORDS = {
  single: { col: 0, row: 0 },
  topLeft: { col: 0, row: 2 },
  top: { col: 1, row: 2 },
  topRight: { col: 2, row: 2 },
  left: { col: 0, row: 3 },
  center: { col: 1, row: 3 },
  right: { col: 2, row: 3 },
  bottomLeft: { col: 0, row: 4 },
  bottom: { col: 1, row: 4 },
  bottomRight: { col: 2, row: 4 }
};

const SHORT_GRASS_VARIANTS = [
  { col: 0, row: 5 },
  { col: 1, row: 5 },
  { col: 2, row: 5 }
];

function computeNineSliceKey(x, y, gridSize, matchFn) {
  const up = matchFn(x, y - 1);
  const down = matchFn(x, y + 1);
  const left = matchFn(x - 1, y);
  const right = matchFn(x + 1, y);

  if (!up && !down && !left && !right) return 'single';
  if (!up && !left) return 'topLeft';
  if (!up && !right) return 'topRight';
  if (!down && !left) return 'bottomLeft';
  if (!down && !right) return 'bottomRight';
  if (!up) return 'top';
  if (!down) return 'bottom';
  if (!left) return 'left';
  if (!right) return 'right';
  return 'center';
}

function spriteLayer(sheet, frame) {
  if (!sheet || !frame) return null;
  const sizeX = sheet.columns * TILE_SIZE;
  const sizeY = sheet.rows * TILE_SIZE;
  return {
    image: `url(${sheet.src})`,
    size: `${sizeX}px ${sizeY}px`,
    position: `${-frame.col * TILE_SIZE}px ${-frame.row * TILE_SIZE}px`
  };
}

function tintLayer(color) {
  return { image: `linear-gradient(${color}, ${color})`, size: '100% 100%', position: '0 0' };
}

function normalizeText(text, maxLength) {
  if (typeof text !== 'string') return '';
  return text.slice(0, maxLength).trim();
}

function createTownMode() {
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

  const spriteSheets = {
    land: { src: 'assets/dirt.png', columns: 3, rows: 6 },
    path: { src: 'assets/dirt.png', columns: 3, rows: 6 },
    grass: { src: 'assets/grass.png', columns: 3, rows: 6 },
    longGrass: { src: 'assets/long-grass.png', columns: 1, rows: 1 },
    water: { src: 'assets/water.png', columns: 3, rows: 6 }
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
    brushTools: new Set(['land', 'grass', 'short-grass', 'long-grass']),
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
    spriteSheets,
    defaultTile: () => ({ base: 'sea', overlay: 'none', signText: '' }),
    messages: {
      needsBase: 'Claim land before placing terrain, buildings, or signs.',
      gridInvalid: 'Grid size must be between 6 and 50.',
      resized: size => `Grid resized to ${size} × ${size}. Start shaping your land!`,
      buildingRequirement: (label, size) => `Need a ${size}×${size} land area cleared for ${label}.`,
      loadSuccess: file => `Loaded layout from ${file}.`
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

  mode.toolsById = new Map(mode.palette.map(tool => [tool.id, tool]));

  mode.normalizeSignText = text => normalizeText(text, mode.signMaxLength);

  mode.getOverlaySymbol = tile => {
    if (tile.overlay === mode.signToolId) {
      return tile.signText || overlayEmoji[mode.signToolId] || '';
    }
    return overlayEmoji[tile.overlay] || '';
  };

  mode.describeOverlay = tile => {
    if (tile.overlay === 'none') return '';
    if (tile.overlay === mode.signToolId) {
      return tile.signText ? `sign “${tile.signText}”` : 'sign';
    }
    return mode.overlayLabels[tile.overlay] || tile.overlay.replace(/-/g, ' ');
  };

  mode.buildTileLayers = ({ state, gridSize, tile, x, y }) => {
    const overlayLayers = [];

    const landMatch = (nx, ny) => ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize && state[ny][nx].base === 'land';
    const overlayMatch = (nx, ny, overlay) =>
      ny >= 0 && ny < gridSize && nx >= 0 && nx < gridSize && state[ny][nx].overlay === overlay;

    const getLandFrame = () => {
      const key = computeNineSliceKey(x, y, gridSize, landMatch);
      return NINE_SLICE_COORDS[key] || NINE_SLICE_COORDS.center;
    };

    const getOverlayFrame = overlay => {
      const key = computeNineSliceKey(x, y, gridSize, (nx, ny) => overlayMatch(nx, ny, overlay));
      return NINE_SLICE_COORDS[key] || NINE_SLICE_COORDS.center;
    };

    const getShortGrassFrame = () => {
      const index = Math.abs((x * 131 + y * 17) % SHORT_GRASS_VARIANTS.length);
      return SHORT_GRASS_VARIANTS[index];
    };

    switch (tile.overlay) {
      case 'grass':
        overlayLayers.push(spriteLayer(spriteSheets.grass, getOverlayFrame('grass')));
        break;
      case 'long-grass':
        overlayLayers.push(spriteLayer(spriteSheets.longGrass, getOverlayFrame('long-grass')));
        break;
      case 'short-grass':
        overlayLayers.push(spriteLayer(spriteSheets.grass, getShortGrassFrame()));
        break;
      case 'path':
        overlayLayers.push(spriteLayer(spriteSheets.path, getOverlayFrame('path')));
        break;
      case 'sign':
        overlayLayers.push(tintLayer('rgba(150, 98, 45, 0.75)'));
        break;
      default:
        if (buildingTints[tile.overlay]) {
          overlayLayers.push(tintLayer(buildingTints[tile.overlay]));
        }
    }

    const baseLayer =
      tile.base === 'sea'
        ? spriteLayer(spriteSheets.water, { col: 0, row: 0 })
        : spriteLayer(spriteSheets.land, getLandFrame());

    return overlayLayers.filter(Boolean).concat(baseLayer ? [baseLayer] : []);
  };

  mode.sanitizeTile = tile => {
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
    brushTools: new Set(['land', 'carpet', 'tile-inlay']),
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
    spriteSheets: {},
    defaultTile: () => ({ base: 'sea', overlay: 'none', signText: '' }),
    messages: {
      needsBase: 'Lay down Floor before placing interior details.',
      gridInvalid: 'Grid size must be between 6 and 50.',
      resized: size => `Grid resized to ${size} × ${size}. Sketch a new floor plan!`,
      buildingRequirement: (label, size) => `Need a ${size}×${size} floor area cleared for ${label}.`,
      loadSuccess: file => `Loaded layout from ${file}.`
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

  mode.toolsById = new Map(mode.palette.map(tool => [tool.id, tool]));

  mode.normalizeSignText = text => normalizeText(text, mode.signMaxLength);

  mode.getOverlaySymbol = tile => {
    if (tile.overlay === mode.signToolId) {
      return tile.signText || overlayEmoji[mode.signToolId] || '';
    }
    return overlayEmoji[tile.overlay] || '';
  };

  mode.describeOverlay = tile => {
    if (tile.overlay === 'none') return '';
    if (tile.overlay === mode.signToolId) {
      return tile.signText ? `note “${tile.signText}”` : 'note';
    }
    return overlayLabels[tile.overlay] || tile.overlay.replace(/-/g, ' ');
  };

  mode.buildTileLayers = ({ tile }) => {
    const overlayLayers = [];

    if (mode.buildingTints[tile.overlay]) {
      overlayLayers.push(tintLayer(mode.buildingTints[tile.overlay]));
    } else if (tile.overlay === mode.signToolId) {
      overlayLayers.push(tintLayer(mode.buildingTints[mode.signToolId]));
    }

    const baseLayer =
      tile.base === 'sea'
        ? tintLayer('rgba(20, 24, 32, 0.85)')
        : tintLayer('rgba(120, 98, 82, 0.9)');

    return overlayLayers.filter(Boolean).concat([baseLayer]);
  };

  mode.sanitizeTile = tile => {
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

export const DESIGN_MODES = Object.freeze({
  town: createTownMode(),
  interior: createInteriorMode()
});

export { TILE_SIZE, BRUSH_OPTIONS, DEFAULT_GRID_SIZE, GRID_LIMITS, tintLayer };
