// Boot: mount Kippy on the canvas, keep pixels crisp at any window size, start the game flow.
import { Game } from "kippy";
import { createGameFlow } from "./features/game-flow/index.js";
import { VIEW_HEIGHT, VIEW_WIDTH } from "./features/world/index.js";

const canvas = document.getElementById("game");
canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;

function fit() {
    const scale = Math.min(window.innerWidth / VIEW_WIDTH, window.innerHeight / VIEW_HEIGHT);
    const crisp = scale >= 1 ? Math.floor(scale) : scale; // whole-number scaling keeps pixels square
    canvas.style.width = `${Math.round(VIEW_WIDTH * crisp)}px`;
    canvas.style.height = `${Math.round(VIEW_HEIGHT * crisp)}px`;
}
fit();
window.addEventListener("resize", fit);

const game = new Game({ canvas });
game.ctx.imageSmoothingEnabled = false;
window.addEventListener("keydown", (e) => {
    // Keep the page from scrolling with game keys.
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
});
createGameFlow(game).start();
