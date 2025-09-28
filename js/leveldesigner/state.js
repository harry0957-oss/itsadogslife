function createGrid(size, createTile) {
  const grid = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      row.push(createTile());
    }
    grid.push(row);
  }
  return grid;
}

function cloneGrid(grid) {
  return grid.map(row => row.map(tile => ({ ...tile })));
}

export { createGrid, cloneGrid };
