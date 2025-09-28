function applyLayers(element, layers) {
  if (!layers.length) {
    element.style.backgroundImage = 'none';
    element.style.backgroundSize = '';
    element.style.backgroundPosition = '';
    element.style.backgroundRepeat = '';
    return;
  }

  element.style.backgroundImage = layers.map(layer => layer.image).join(', ');
  element.style.backgroundSize = layers.map(layer => layer.size).join(', ');
  element.style.backgroundPosition = layers.map(layer => layer.position).join(', ');
  element.style.backgroundRepeat = layers.map(() => 'no-repeat').join(', ');
}

function updateTileAppearance({ element, tile, x, y, mode, state, gridSize }) {
  element.dataset.base = tile.base;
  element.dataset.overlay = tile.overlay;

  if (tile.signText) {
    element.dataset.signText = tile.signText;
  } else {
    delete element.dataset.signText;
  }

  const layers = mode.buildTileLayers({ state, gridSize, tile, x, y });
  applyLayers(element, layers.filter(Boolean));

  const symbol = mode.getOverlaySymbol(tile);
  if (symbol) {
    element.dataset.overlaySymbol = symbol;
  } else {
    delete element.dataset.overlaySymbol;
  }

  const baseLabel = mode.baseLabels[tile.base] || tile.base;
  const overlayDescription = tile.overlay === 'none' ? '' : mode.describeOverlay(tile);
  const ariaLabel = overlayDescription ? `${baseLabel} tile with ${overlayDescription}` : `${baseLabel} tile`;
  element.setAttribute('aria-label', ariaLabel);
  element.title = tile.overlay === mode.signToolId && tile.signText ? tile.signText : '';
}

export { applyLayers, updateTileAppearance };
