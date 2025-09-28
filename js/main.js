import { Game } from "./game.js";
import { createUI } from "./ui.js";

function bootstrap() {
  const canvas = document.getElementById("scene");
  const prompt = document.getElementById("prompt");
  const messagePanel = document.getElementById("messagePanel");
  const loadError = document.getElementById("loadError");
  const musicToggle = document.getElementById("musicToggle");

  const ui = createUI({ prompt, messagePanel, loadError, musicToggle });
  const game = new Game({ canvas, ui });
  game.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
