function getBuildingArea(mode, gridSize, x, y) {
  const size = mode.buildingSize;
  const half = Math.floor(size / 2);
  const startX = Math.max(0, Math.min(x - half, gridSize - size));
  const startY = Math.max(0, Math.min(y - half, gridSize - size));
  return { startX, startY, size };
}

function canPlaceBuilding({ mode, state, gridSize, x, y, overlay }) {
  if (!mode.buildingTools.has(overlay)) return false;
  const { startX, startY, size } = getBuildingArea(mode, gridSize, x, y);
  for (let by = 0; by < size; by++) {
    for (let bx = 0; bx < size; bx++) {
      const nx = startX + bx;
      const ny = startY + by;
      const tile = state[ny][nx];
      if (tile.base !== mode.requiredBase) return false;
      if (tile.overlay !== 'none' && tile.overlay !== overlay) return false;
    }
  }
  return true;
}

function applyBuilding({ mode, state, gridSize, x, y, overlay, onTileUpdated }) {
  const { startX, startY, size } = getBuildingArea(mode, gridSize, x, y);
  for (let by = 0; by < size; by++) {
    for (let bx = 0; bx < size; bx++) {
      const nx = startX + bx;
      const ny = startY + by;
      const tile = state[ny][nx];
      tile.base = mode.requiredBase;
      tile.baseVariant = null;
      tile.overlay = overlay;
      tile.overlayVariant = null;
      tile.signText = '';
      onTileUpdated(nx, ny);
    }
  }
  return true;
}

function applyTool({
  mode,
  state,
  gridSize,
  x,
  y,
  toolId,
  signText,
  onTileUpdated,
  updateStatus,
  variant
}) {
  const tool = mode.toolsById.get(toolId);
  if (!tool) return false;

  const tile = state[y][x];
  const normalizedVariant = typeof variant === 'string' ? variant : null;

  switch (tool.category) {
    case 'base': {
      const changed =
        tile.base !== tool.base ||
        tile.overlay !== 'none' ||
        tile.signText !== '' ||
        tile.baseVariant !== normalizedVariant ||
        tile.overlayVariant !== null;
      tile.base = tool.base;
      tile.baseVariant = normalizedVariant;
      tile.overlay = 'none';
      tile.overlayVariant = null;
      tile.signText = '';
      if (changed) {
        onTileUpdated(x, y);
      }
      return changed;
    }
    case 'overlay': {
      if (tool.requiresBase && tile.base !== tool.requiresBase) {
        return false;
      }
      if (
        tile.overlay === tool.overlay &&
        tile.overlayVariant === normalizedVariant &&
        tile.signText === ''
      ) {
        return false;
      }
      tile.overlay = tool.overlay;
      tile.overlayVariant = normalizedVariant;
      tile.signText = '';
      onTileUpdated(x, y);
      return true;
    }
    case 'sign': {
      if (tool.requiresBase && tile.base !== tool.requiresBase) {
        return false;
      }
      const cleaned = mode.normalizeSignText(signText);
      if (tile.overlay === mode.signToolId && tile.signText === cleaned) {
        return false;
      }
      tile.overlay = mode.signToolId;
      tile.overlayVariant = null;
      tile.signText = cleaned;
      onTileUpdated(x, y);
      return true;
    }
    case 'building': {
      if (!mode.buildingTools.has(tool.overlay)) {
        return false;
      }
      if (!canPlaceBuilding({ mode, state, gridSize, x, y, overlay: tool.overlay })) {
        if (typeof updateStatus === 'function') {
          const size = mode.buildingSize;
          updateStatus(mode.messages.buildingRequirement(tool.label, size));
        }
        return false;
      }
      return applyBuilding({ mode, state, gridSize, x, y, overlay: tool.overlay, onTileUpdated });
    }
    default:
      return false;
  }
}

function applyBrush({
  mode,
  state,
  gridSize,
  x,
  y,
  toolId,
  brushSize,
  onTileUpdated,
  updateStatus,
  signText,
  variant
}) {
  const span = mode.brushTools.has(toolId) ? Math.min(brushSize, gridSize) : 1;
  const half = Math.floor(span / 2);
  const startX = Math.max(0, Math.min(x - half, gridSize - span));
  const startY = Math.max(0, Math.min(y - half, gridSize - span));
  let needsBase = false;

  for (let by = 0; by < span; by++) {
    for (let bx = 0; bx < span; bx++) {
      const nx = startX + bx;
      const ny = startY + by;
      const target = state[ny][nx];
      if (mode.landOnlyTools.has(toolId) && target.base !== mode.requiredBase) {
        needsBase = true;
        continue;
      }
      applyTool({
        mode,
        state,
        gridSize,
        x: nx,
        y: ny,
        toolId,
        signText,
        onTileUpdated,
        updateStatus,
        variant
      });
    }
  }

  if (needsBase && typeof updateStatus === 'function') {
    updateStatus(mode.messages.needsBase);
  }
}

export { applyBrush, applyTool };
