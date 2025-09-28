import { createDesignModes, TILE_SIZE, BRUSH_OPTIONS, DEFAULT_GRID_SIZE, GRID_LIMITS } from './modes.js';
import { createGrid, cloneGrid } from './state.js';
import { updateTileAppearance } from './rendering.js';
import { applyBrush } from './tools.js';
import { loadTileMetadata } from '../data/tile-metadata.js';

const toolList = document.getElementById('toolList');
const brushContainer = document.getElementById('brushOptions');
const gridElement = document.getElementById('grid');
const statusElement = document.getElementById('status');
const tileTemplate = document.getElementById('tileTemplate');
const gridSizeInput = document.getElementById('gridSize');
const signInput = document.getElementById('signText');
const resizeButton = document.getElementById('resizeGrid');
const downloadButton = document.getElementById('downloadJson');
const loadButton = document.getElementById('loadJson');
const loadInput = document.getElementById('loadJsonInput');
const openLevelButton = document.getElementById('openLevel');
const designerTitle = document.getElementById('designerTitle');
const designerTagline = document.getElementById('designerTagline');
const modeSelect = document.getElementById('modeSelect');
const signLegend = document.getElementById('signLegend');
const signLabel = document.getElementById('signLabel');
const signHint = document.getElementById('signHint');

const modeSnapshots = new Map();
const tileElements = [];
const toolButtons = new Map();
const brushButtons = new Map();

let DESIGN_MODES = {};
let currentMode = null;
let gridSize = DEFAULT_GRID_SIZE;
let state = createGrid(DEFAULT_GRID_SIZE, () => ({ base: 'sea', overlay: 'none', signText: '' }));
let currentTool = null;
let brushDimension = BRUSH_OPTIONS[0];
let currentSignText = '';
let mouseDown = false;

function ensureSnapshot(mode) {
  if (!modeSnapshots.has(mode.id)) {
    modeSnapshots.set(mode.id, {
      gridSize: DEFAULT_GRID_SIZE,
      state: createGrid(DEFAULT_GRID_SIZE, mode.defaultTile),
      toolId: mode.defaultTool,
      brushSize: BRUSH_OPTIONS[0],
      signText: ''
    });
  }
  return modeSnapshots.get(mode.id);
}

function saveActiveSnapshot() {
  if (!currentMode) return;
  const snapshot = ensureSnapshot(currentMode);
  snapshot.gridSize = gridSize;
  snapshot.state = state;
  snapshot.toolId = currentTool;
  snapshot.brushSize = brushDimension;
  snapshot.signText = currentSignText;
}

function onTileUpdated(x, y) {
  const row = tileElements[y];
  const element = row && row[x];
  if (!element || !currentMode) return;
  updateTileAppearance({ element, tile: state[y][x], x, y, mode: currentMode, state, gridSize });
}

function renderGrid() {
  if (!currentMode) return;
  gridElement.innerHTML = '';
  tileElements.length = 0;
  gridElement.style.setProperty('--tile-size', `${TILE_SIZE}px`);
  gridElement.style.gridTemplateColumns = `repeat(${gridSize}, ${TILE_SIZE}px)`;
  gridElement.style.gridTemplateRows = `repeat(${gridSize}, ${TILE_SIZE}px)`;
  gridElement.style.width = `${gridSize * TILE_SIZE}px`;
  gridElement.style.height = `${gridSize * TILE_SIZE}px`;

  for (let y = 0; y < gridSize; y++) {
    tileElements[y] = [];
    for (let x = 0; x < gridSize; x++) {
      const tileState = state[y][x];
      const tile = tileTemplate.content.firstElementChild.cloneNode(true);
      tile.dataset.x = x;
      tile.dataset.y = y;
      tile.addEventListener('pointerdown', handlePointerDown);
      tile.addEventListener('pointerenter', handlePointerEnter);
      tile.addEventListener('contextmenu', (event) => event.preventDefault());
      tileElements[y][x] = tile;
      updateTileAppearance({ element: tile, tile: tileState, x, y, mode: currentMode, state, gridSize });
      gridElement.appendChild(tile);
    }
  }
}

function setActiveTool(toolId) {
  if (!currentMode) return;
  if (!currentMode.toolsById.has(toolId)) {
    toolId = currentMode.defaultTool;
  }
  currentTool = toolId;
  toolButtons.forEach((button, id) => {
    button.classList.toggle('active', id === currentTool);
  });
  const tool = currentMode.toolsById.get(currentTool);
  if (tool) {
    updateStatus(`Selected ${tool.label}. ${tool.description}`);
  }
  ensureSnapshot(currentMode).toolId = currentTool;
}

function renderPalette() {
  if (!currentMode) return;
  toolButtons.clear();
  toolList.innerHTML = '';
  currentMode.palette.forEach((tool) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool';
    button.dataset.tool = tool.id;
    button.innerHTML = `<span class="tool-icon">${tool.icon}</span> ${tool.label}`;
    button.title = tool.description;
    button.addEventListener('click', () => {
      setActiveTool(tool.id);
    });
    toolButtons.set(tool.id, button);
    toolList.appendChild(button);
  });
  setActiveTool(currentTool || currentMode.defaultTool);
}

function setBrushSize(size) {
  brushDimension = size;
  brushButtons.forEach((button, value) => {
    button.classList.toggle('active', value === brushDimension);
  });
  if (currentMode) {
    updateStatus(`Brush size set to ${size}×${size}.`);
    ensureSnapshot(currentMode).brushSize = brushDimension;
  }
}

function renderBrushOptions() {
  brushButtons.clear();
  brushContainer.innerHTML = '';
  BRUSH_OPTIONS.forEach((size) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'brush';
    button.dataset.size = size;
    button.textContent = `${size}×${size}`;
    button.addEventListener('click', () => setBrushSize(size));
    brushButtons.set(size, button);
    brushContainer.appendChild(button);
  });
  if (!brushButtons.has(brushDimension)) {
    brushDimension = BRUSH_OPTIONS[0];
  }
  setBrushSize(brushDimension);
}

function updateStatus(message) {
  statusElement.textContent = message;
}

function handlePointerDown(event) {
  if (!currentMode) return;
  event.preventDefault();
  const toolId = event.button === 2 ? 'sea' : currentTool;
  const x = Number(event.currentTarget.dataset.x);
  const y = Number(event.currentTarget.dataset.y);
  mouseDown = true;
  applyBrush({
    mode: currentMode,
    state,
    gridSize,
    x,
    y,
    toolId,
    brushSize: brushDimension,
    onTileUpdated,
    updateStatus,
    signText: currentSignText
  });
  window.addEventListener('pointerup', handlePointerUp, { once: true });
}

function handlePointerEnter(event) {
  if (!mouseDown || !currentMode) return;
  const toolId = event.buttons === 2 ? 'sea' : currentTool;
  const x = Number(event.currentTarget.dataset.x);
  const y = Number(event.currentTarget.dataset.y);
  applyBrush({
    mode: currentMode,
    state,
    gridSize,
    x,
    y,
    toolId,
    brushSize: brushDimension,
    onTileUpdated,
    updateStatus,
    signText: currentSignText
  });
}

function handlePointerUp() {
  mouseDown = false;
}

function resizeGrid() {
  if (!currentMode) return;
  const requested = Number(gridSizeInput.value);
  if (!Number.isInteger(requested) || requested < GRID_LIMITS.min || requested > GRID_LIMITS.max) {
    updateStatus(currentMode.messages.gridInvalid);
    return;
  }
  const snapshot = ensureSnapshot(currentMode);
  snapshot.gridSize = requested;
  snapshot.state = createGrid(requested, currentMode.defaultTile);
  state = snapshot.state;
  gridSize = snapshot.gridSize;
  renderGrid();
  updateStatus(currentMode.messages.resized(requested));
}

function exportJson() {
  if (!currentMode) return;
  const layout = {
    mode: currentMode.id,
    size: gridSize,
    tiles: cloneGrid(state)
  };
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = currentMode.layoutFileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function loadJsonFromFile(file) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const parsed = JSON.parse(reader.result);
      applyLayout(parsed);
      if (currentMode) {
        updateStatus(currentMode.messages.loadSuccess(file.name));
      }
    } catch (error) {
      console.error('Failed to load layout', error);
      const message = error instanceof Error ? error.message : 'Invalid JSON file.';
      updateStatus(`Unable to load layout: ${message}`);
    }
  });
  reader.readAsText(file);
}

function applyLayout(layout) {
  if (!currentMode) return;
  if (!layout || typeof layout !== 'object') {
    throw new Error('Layout must be an object.');
  }
  const modeId = layout.mode && DESIGN_MODES[layout.mode] ? layout.mode : currentMode.id;
  if (modeId !== currentMode.id) {
    setDesignMode(modeId, { silent: true });
  }
  const size = Number(layout.size);
  if (!Number.isInteger(size) || size < GRID_LIMITS.min || size > GRID_LIMITS.max) {
    throw new Error('Layout size out of bounds.');
  }
  const tiles = layout.tiles;
  if (!Array.isArray(tiles) || tiles.length !== size) {
    throw new Error('Tiles array does not match layout size.');
  }

  const sanitized = createGrid(size, currentMode.defaultTile);
  for (let y = 0; y < size; y++) {
    const row = tiles[y];
    if (!Array.isArray(row) || row.length !== size) {
      throw new Error('Tile rows must match layout size.');
    }
    for (let x = 0; x < size; x++) {
      sanitized[y][x] = currentMode.sanitizeTile(row[x]);
    }
  }

  const snapshot = ensureSnapshot(currentMode);
  snapshot.gridSize = size;
  snapshot.state = sanitized;
  state = snapshot.state;
  gridSize = size;
  gridSizeInput.value = size;
  renderGrid();
  mouseDown = false;
}

function generateLevelHtml() {
  const snapshot = state.map((row) => row.map((tile) => ({ base: tile.base, overlay: tile.overlay, signText: tile.signText })));
  const data = {
    modeId: currentMode.id,
    layout: { size: gridSize, tiles: snapshot },
    preview: currentMode.preview
  };
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${currentMode.preview.documentTitle}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #eef5ff;
    }
    main {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .map {
      --tile-size: ${TILE_SIZE}px;
      display: grid;
      gap: 0;
      background: rgba(4, 20, 34, 0.85);
      padding: 0.75rem;
      border-radius: 1.2rem;
      box-shadow: 0 1.5rem 3.5rem rgba(0, 0, 0, 0.4);
    }
    .cell {
      width: var(--tile-size);
      height: var(--tile-size);
      position: relative;
      background-repeat: no-repeat;
      background-origin: border-box;
      display: grid;
      place-items: center;
      font-size: calc(var(--tile-size) * 0.5);
    }
    .cell::after {
      content: attr(data-overlay-symbol);
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: calc(var(--tile-size) * 0.5);
      color: #fff9c4;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      pointer-events: none;
    }
    .cell[data-overlay="sign"]::after {
      font-size: calc(var(--tile-size) * 0.4);
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    footer {
      font-size: 0.9rem;
      color: rgba(238, 245, 255, 0.7);
    }
  </style>
</head>
<body>
  <main>
    <h1 id="previewTitle"></h1>
    <section id="map" class="map" role="grid" aria-label="Level layout"></section>
    <footer id="previewFooter"></footer>
  </main>
  <script>window.__LEVEL_DATA__ = ${serialized};</script>
  <script type="module" src="./js/leveldesigner/preview-runtime.js"></script>
</body>
</html>`;
}

function openLevelPage() {
  if (!currentMode) return;
  const levelHtml = generateLevelHtml();
  const levelWindow = window.open('', '_blank');
  if (!levelWindow) {
    updateStatus('Pop-up blocked. Allow pop-ups to open the level page.');
    return;
  }
  levelWindow.document.write(levelHtml);
  levelWindow.document.close();
}

function updateSignUi() {
  if (!currentMode) return;
  const section = currentMode.signSection;
  signLegend.textContent = section.legend;
  signLabel.textContent = section.label;
  signHint.textContent = section.hint;
  signInput.placeholder = section.placeholder;
  signInput.maxLength = currentMode.signMaxLength;
}

function updateModeUi() {
  if (!currentMode) return;
  designerTitle.textContent = currentMode.title;
  document.title = currentMode.title;
  designerTagline.textContent = currentMode.tagline;
  gridSizeInput.value = gridSize;
  updateSignUi();
}

function setDesignMode(modeId, { silent = false } = {}) {
  const nextMode = DESIGN_MODES[modeId];
  if (!nextMode) return;

  if (currentMode) {
    saveActiveSnapshot();
  }

  currentMode = nextMode;
  const snapshot = ensureSnapshot(currentMode);
  gridSize = snapshot.gridSize;
  state = snapshot.state;
  currentTool = snapshot.toolId || currentMode.defaultTool;
  brushDimension = snapshot.brushSize || BRUSH_OPTIONS[0];
  currentSignText = snapshot.signText || '';
  signInput.value = currentSignText;
  modeSelect.value = currentMode.id;

  updateModeUi();
  renderPalette();
  renderBrushOptions();
  renderGrid();
  if (!silent) {
    updateStatus(currentMode.instructions);
  }
}

function populateModeSelect() {
  modeSelect.innerHTML = '';
  Object.values(DESIGN_MODES).forEach((mode) => {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = mode.label;
    modeSelect.appendChild(option);
  });
  if (currentMode) {
    modeSelect.value = currentMode.id;
  }
}

function attachEventListeners() {
  signInput.addEventListener('input', (event) => {
    if (!currentMode) return;
    currentSignText = currentMode.normalizeSignText(event.target.value);
    signInput.value = currentSignText;
    ensureSnapshot(currentMode).signText = currentSignText;
  });

  resizeButton.addEventListener('click', resizeGrid);
  downloadButton.addEventListener('click', exportJson);
  loadButton.addEventListener('click', () => loadInput.click());
  loadInput.addEventListener('change', (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    const isJsonType = file.type === 'application/json';
    const isJsonName = file.name?.toLowerCase().endsWith('.json');
    if (file.type && !isJsonType && !isJsonName) {
      updateStatus('Please choose a JSON layout file.');
      event.target.value = '';
      return;
    }
    loadJsonFromFile(file);
    event.target.value = '';
  });

  openLevelButton.addEventListener('click', openLevelPage);
  modeSelect.addEventListener('change', (event) => setDesignMode(event.target.value));
  gridElement.addEventListener('pointerleave', () => {
    mouseDown = false;
  });
}

async function init() {
  try {
    updateStatus('Loading tile metadata…');
    const metadata = await loadTileMetadata();
    DESIGN_MODES = createDesignModes(metadata);
    const initialMode = DESIGN_MODES.town || Object.values(DESIGN_MODES)[0];
    if (!initialMode) {
      throw new Error('No design modes available.');
    }
    populateModeSelect();
    setDesignMode(initialMode.id, { silent: true });
    updateStatus(initialMode.instructions);
  } catch (error) {
    console.error('Failed to initialise designer', error);
    updateStatus(`Failed to load tile metadata: ${error.message}`);
  }
}

attachEventListeners();
init();
