import { DESIGN_MODES, TILE_SIZE } from './modes.js';
import { updateTileAppearance } from './rendering.js';

const data = window.__LEVEL_DATA__ || {};
const mode = DESIGN_MODES[data.modeId] || Object.values(DESIGN_MODES)[0];
const layout = data.layout || { size: 0, tiles: [] };

const map = document.getElementById('map');
const titleElement = document.getElementById('previewTitle');
const footerElement = document.getElementById('previewFooter');

if (data.preview?.title) {
  titleElement.textContent = data.preview.title;
} else if (mode?.preview?.title) {
  titleElement.textContent = mode.preview.title;
}

if (data.preview?.footer) {
  footerElement.textContent = data.preview.footer;
} else if (mode?.preview?.footer) {
  footerElement.textContent = mode.preview.footer;
}

if (data.preview?.documentTitle) {
  document.title = data.preview.documentTitle;
} else if (mode?.preview?.documentTitle) {
  document.title = mode.preview.documentTitle;
}

if (mode?.preview?.background) {
  document.body.style.background = mode.preview.background;
}

if (!map || !layout.size || !Array.isArray(layout.tiles)) {
  return;
}

map.style.setProperty('--tile-size', `${TILE_SIZE}px`);
map.style.gridTemplateColumns = `repeat(${layout.size}, ${TILE_SIZE}px)`;
map.style.gridTemplateRows = `repeat(${layout.size}, ${TILE_SIZE}px)`;

const state = layout.tiles.map(row => row.map(tile => ({ ...tile })));

for (let y = 0; y < layout.size; y++) {
  for (let x = 0; x < layout.size; x++) {
    const tile = state[y][x];
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.x = x;
    cell.dataset.y = y;
    map.appendChild(cell);
    updateTileAppearance({ element: cell, tile, x, y, mode, state, gridSize: layout.size });
  }
}
