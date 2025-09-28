export async function loadTileMetadata() {
  const url = new URL("../../data/tiles.json", import.meta.url);
  const response = await fetch(url.href, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load tile metadata: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const NINE_SLICE_KEYS = [
  "single",
  "topLeft",
  "top",
  "topRight",
  "left",
  "center",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight"
];
