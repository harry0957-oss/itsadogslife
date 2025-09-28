import { loadTileMetadata, NINE_SLICE_KEYS } from "./data/tile-metadata.js";

const assetList = document.getElementById("assetList");
const assetSearch = document.getElementById("assetSearch");
const assetTitle = document.getElementById("assetTitle");
const assetSubtitle = document.getElementById("assetSubtitle");
const tilesetSelect = document.getElementById("tilesetSelect");
const typeButtons = Array.from(document.querySelectorAll(".type-switch button"));
const sliceSelector = document.getElementById("sliceSelector");
const sheetContainer = document.getElementById("sheetContainer");
const sheetGrid = document.getElementById("sheetGrid");
const sheetPlaceholder = document.getElementById("sheetPlaceholder");
const statusMessage = document.getElementById("statusMessage");
const assignmentSummary = document.getElementById("assignmentSummary");
const jsonPreview = document.getElementById("jsonPreview");
const downloadButton = document.getElementById("downloadButton");
const copyButton = document.getElementById("copyButton");
const resetButton = document.getElementById("resetButton");

const state = {
  metadata: null,
  original: null,
  activeTileId: null,
  selectedSlice: "center",
  dirty: false
};

function cloneMetadata(metadata) {
  return JSON.parse(JSON.stringify(metadata));
}

function formatLabel(tileId, tile) {
  const label = tile?.label || tileId;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatCategory(category) {
  if (!category) return "";
  return category.replace(/-/g, " ");
}

function getTilesSorted(metadata) {
  const entries = Object.entries(metadata.tiles || {});
  return entries
    .map(([id, tile]) => ({ id, tile }))
    .sort((a, b) => {
      const categoryA = a.tile.category || "";
      const categoryB = b.tile.category || "";
      if (categoryA !== categoryB) {
        return categoryA.localeCompare(categoryB);
      }
      const labelA = a.tile.label || a.id;
      const labelB = b.tile.label || b.id;
      return labelA.localeCompare(labelB);
    });
}

function ensureSprite(tile) {
  if (!tile.sprite) {
    tile.sprite = { type: "none" };
  }
  if (!tile.sprite.type) {
    tile.sprite.type = tile.sprite.frame ? "single" : "none";
  }
  if (tile.sprite.type === "nine-slice") {
    if (!tile.sprite.frames || typeof tile.sprite.frames !== "object") {
      tile.sprite.frames = {};
    }
    for (const key of NINE_SLICE_KEYS) {
      if (!Array.isArray(tile.sprite.frames[key])) {
        tile.sprite.frames[key] = [0, 0];
      }
    }
  } else if (tile.sprite.type === "single") {
    if (!Array.isArray(tile.sprite.frame)) {
      tile.sprite.frame = [0, 0];
    }
  }
  return tile.sprite;
}

function selectAsset(tileId) {
  state.activeTileId = tileId;
  state.selectedSlice = "center";
  const tile = state.metadata.tiles[tileId];
  const label = formatLabel(tileId, tile);
  assetTitle.textContent = label;
  assetSubtitle.textContent = `${formatCategory(tile.category)} • ${tile.surface || "no surface"}`.trim();
  ensureSprite(tile);
  updateTypeButtons(tile.sprite.type);
  populateTilesetSelect(tile);
  updateSliceSelector(tile);
  renderSheet(tile);
  updateSummary();
  updateJsonPreview();
  updateStatus(`Ready to edit ${label}.`);
}

function updateTypeButtons(type) {
  typeButtons.forEach((button) => {
    button.disabled = !state.activeTileId;
    button.classList.toggle("active", button.dataset.type === type);
  });
}

function populateTilesetSelect(tile) {
  const tilesets = state.metadata.tilesets || {};
  tilesetSelect.innerHTML = "";
  const entries = Object.entries(tilesets);
  entries.forEach(([key, info]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = info.label ? `${info.label} (${key})` : key;
    tilesetSelect.appendChild(option);
  });
  if (!tile.sprite.tileset && entries.length) {
    tile.sprite.tileset = entries[0][0];
  }
  const disableSelect = !state.activeTileId || tile.sprite.type === "none" || !entries.length;
  tilesetSelect.disabled = disableSelect;
  if (tile.sprite.tileset) {
    tilesetSelect.value = tile.sprite.tileset;
  }
}

function updateSliceSelector(tile) {
  if (tile.sprite.type !== "nine-slice") {
    sliceSelector.hidden = true;
    sliceSelector.innerHTML = "";
    return;
  }
  sliceSelector.hidden = false;
  sliceSelector.innerHTML = "";
  NINE_SLICE_KEYS.forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = key.replace(/([A-Z])/g, " $1").trim();
    button.classList.toggle("active", key === state.selectedSlice);
    button.addEventListener("click", () => {
      state.selectedSlice = key;
      updateSliceSelector(tile);
      renderSheet(tile);
      updateSummary();
    });
    sliceSelector.appendChild(button);
  });
}

function getActiveFrame(tile) {
  const sprite = tile.sprite;
  if (sprite.type === "single") {
    return sprite.frame;
  }
  if (sprite.type === "nine-slice") {
    return sprite.frames?.[state.selectedSlice];
  }
  return null;
}

function renderSheet(tile) {
  if (tile.sprite.type === "none") {
    sheetContainer.hidden = true;
    sheetPlaceholder.hidden = false;
    sheetPlaceholder.textContent = "Sprite disabled for this tile.";
    sheetGrid.innerHTML = "";
    return;
  }

  const tilesetId = tile.sprite.tileset;
  const tileset = tilesetId ? state.metadata.tilesets?.[tilesetId] : null;
  if (!tileset) {
    sheetContainer.hidden = true;
    sheetPlaceholder.hidden = false;
    sheetPlaceholder.textContent = "Choose a tileset to display its sprite sheet.";
    sheetGrid.innerHTML = "";
    return;
  }

  const tileSize = tileset.tileSize || 32;
  const columns = tileset.columns || 1;
  const rows = tileset.rows || 1;

  sheetContainer.hidden = false;
  sheetPlaceholder.hidden = true;
  sheetGrid.style.setProperty("--tile-size", `${tileSize}px`);
  sheetGrid.style.gridTemplateColumns = `repeat(${columns}, ${tileSize}px)`;
  sheetGrid.style.gridTemplateRows = `repeat(${rows}, ${tileSize}px)`;
  sheetGrid.innerHTML = "";

  const activeFrame = getActiveFrame(tile);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sheet-cell";
      button.dataset.col = col;
      button.dataset.row = row;
      button.style.setProperty("--tile-size", `${tileSize}px`);
      button.style.backgroundImage = `url(${tileset.src})`;
      button.style.backgroundSize = `${columns * tileSize}px ${rows * tileSize}px`;
      button.style.backgroundPosition = `${-col * tileSize}px ${-row * tileSize}px`;
      if (Array.isArray(activeFrame) && activeFrame[0] === col && activeFrame[1] === row) {
        button.classList.add("active");
      }
      button.addEventListener("click", () => {
        applyFrame(tile, [col, row]);
      });
      sheetGrid.appendChild(button);
    }
  }
}

function applyFrame(tile, frame) {
  ensureSprite(tile);
  const sprite = tile.sprite;
  if (!sprite.tileset) {
    sprite.tileset = tilesetSelect.value;
  }
  if (sprite.type === "nine-slice") {
    sprite.frames[state.selectedSlice] = frame;
  } else if (sprite.type === "single") {
    sprite.frame = frame;
  }
  state.dirty = true;
  renderSheet(tile);
  updateSummary();
  updateJsonPreview();
  const label = formatLabel(state.activeTileId, tile);
  const sliceLabel = sprite.type === "nine-slice" ? ` (${state.selectedSlice})` : "";
  updateStatus(`Updated ${label}${sliceLabel} to column ${frame[0]}, row ${frame[1]}.`);
}

function updateSummary() {
  if (!state.activeTileId) {
    assignmentSummary.textContent = "";
    return;
  }
  const tile = state.metadata.tiles[state.activeTileId];
  const sprite = tile.sprite;
  if (!sprite || sprite.type === "none") {
    assignmentSummary.textContent = "No sprite assigned.";
    return;
  }
  const tileset = sprite.tileset ? state.metadata.tilesets?.[sprite.tileset] : null;
  const tilesetLabel = tileset?.label ? `${tileset.label} (${sprite.tileset})` : sprite.tileset || "Unknown";
  if (sprite.type === "single") {
    assignmentSummary.textContent = `Tileset: ${tilesetLabel} • Frame: [${sprite.frame.join(", ")}]`;
  } else if (sprite.type === "nine-slice") {
    const frame = sprite.frames?.[state.selectedSlice];
    assignmentSummary.textContent = `Tileset: ${tilesetLabel} • Slice: ${state.selectedSlice} • Frame: [${frame.join(", ")}]`;
  } else {
    assignmentSummary.textContent = `Tileset: ${tilesetLabel}`;
  }
}

function updateJsonPreview() {
  jsonPreview.textContent = JSON.stringify(state.metadata.tiles[state.activeTileId] ?? {}, null, 2);
}

function updateStatus(message) {
  statusMessage.textContent = message;
}

function setSpriteType(tile, type) {
  ensureSprite(tile);
  tile.sprite.type = type;
  if (type === "none") {
    delete tile.sprite.tileset;
    delete tile.sprite.frame;
    delete tile.sprite.frames;
  } else if (type === "single") {
    tile.sprite.frame = Array.isArray(tile.sprite.frame) ? tile.sprite.frame : [0, 0];
    if (!tile.sprite.tileset) {
      const firstTileset = Object.keys(state.metadata.tilesets || {})[0];
      if (firstTileset) {
        tile.sprite.tileset = firstTileset;
      }
    }
  } else if (type === "nine-slice") {
    if (!tile.sprite.tileset) {
      const firstTileset = Object.keys(state.metadata.tilesets || {})[0];
      if (firstTileset) {
        tile.sprite.tileset = firstTileset;
      }
    }
    tile.sprite.frames = tile.sprite.frames || {};
    for (const key of NINE_SLICE_KEYS) {
      if (!Array.isArray(tile.sprite.frames[key])) {
        tile.sprite.frames[key] = [0, 0];
      }
    }
    state.selectedSlice = state.selectedSlice || "center";
  }
  updateTypeButtons(type);
  populateTilesetSelect(tile);
  updateSliceSelector(tile);
  renderSheet(tile);
  updateSummary();
  updateJsonPreview();
  state.dirty = true;
}

function downloadMetadata() {
  const blob = new Blob([JSON.stringify(state.metadata, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tiles.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  updateStatus("Downloaded updated tiles.json.");
}

async function copyMetadata() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.metadata, null, 2));
    updateStatus("Copied JSON to clipboard.");
  } catch (error) {
    updateStatus(`Clipboard unavailable: ${error.message}`);
  }
}

function resetMetadata() {
  if (!state.original) return;
  state.metadata = cloneMetadata(state.original);
  state.dirty = false;
  renderAssetList(assetSearch.value);
  updateStatus("Reverted changes to original metadata.");
  if (state.activeTileId) {
    selectAsset(state.activeTileId);
  }
}

function renderAssetList(filterText = "") {
  assetList.innerHTML = "";
  const tiles = getTilesSorted(state.metadata);
  const query = filterText.trim().toLowerCase();
  tiles
    .filter(({ id, tile }) => {
      if (!query) return true;
      return (
        id.toLowerCase().includes(query) ||
        (tile.label && tile.label.toLowerCase().includes(query)) ||
        (tile.category && tile.category.toLowerCase().includes(query))
      );
    })
    .forEach(({ id, tile }) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "asset-item";
      item.dataset.tileId = id;
      item.setAttribute("role", "option");
      item.innerHTML = `<strong>${formatLabel(id, tile)}</strong><span>${formatCategory(tile.category)}</span>`;
      if (id === state.activeTileId) {
        item.classList.add("active");
      }
      item.addEventListener("click", () => {
        document.querySelectorAll(".asset-item").forEach((button) => button.classList.remove("active"));
        item.classList.add("active");
        selectAsset(id);
      });
      assetList.appendChild(item);
    });
}

function handleTilesetChange() {
  if (!state.activeTileId) return;
  const tile = state.metadata.tiles[state.activeTileId];
  ensureSprite(tile);
  tile.sprite.tileset = tilesetSelect.value;
  state.dirty = true;
  renderSheet(tile);
  updateSummary();
  updateJsonPreview();
  updateStatus(`Using ${tilesetSelect.value} tileset for ${formatLabel(state.activeTileId, tile)}.`);
}

tilesetSelect.addEventListener("change", handleTilesetChange);
typeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!state.activeTileId) return;
    const tile = state.metadata.tiles[state.activeTileId];
    setSpriteType(tile, button.dataset.type);
    updateStatus(`Changed sprite type to ${button.dataset.type}.`);
  });
});
assetSearch.addEventListener("input", () => {
  renderAssetList(assetSearch.value);
});
downloadButton.addEventListener("click", downloadMetadata);
copyButton.addEventListener("click", copyMetadata);
resetButton.addEventListener("click", resetMetadata);

async function init() {
  try {
    const metadata = await loadTileMetadata();
    state.metadata = cloneMetadata(metadata);
    state.original = cloneMetadata(metadata);
    renderAssetList();
    updateStatus("Loaded tile metadata.");
    const firstTile = Object.keys(state.metadata.tiles || {})[0];
    if (firstTile) {
      const firstButton = assetList.querySelector(".asset-item");
      if (firstButton) {
        firstButton.classList.add("active");
      }
      selectAsset(firstTile);
    }
  } catch (error) {
    updateStatus(`Failed to load metadata: ${error.message}`);
    jsonPreview.textContent = error.stack || error.message;
  }
}

init();
