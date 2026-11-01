import { Game } from "kippy";
import { buildSounds } from "./features/audio/bank.js";
import { createMusic } from "./features/audio/music.js";
import { createBindings } from "./features/controls/bindings.js";
import { LoadingScene } from "./scenes/loading.js";
import { TitleScene } from "./scenes/title.js";

const canvas = document.getElementById("game");
const MAX_PIXELS = 2560 * 1440;

// Backing resolution follows the window (and pixel ratio), capped for fill-rate
function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth * dpr;
    const h = window.innerHeight * dpr;
    const k = Math.min(1, Math.sqrt(MAX_PIXELS / (w * h)));
    canvas.width = Math.floor(w * k);
    canvas.height = Math.floor(h * k);
}
resize();
window.addEventListener("resize", resize);

// Game keys must never scroll the page or move focus away from the game
const RESERVED = new Set(["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
window.addEventListener("keydown", (e) => {
    if (RESERVED.has(e.code)) e.preventDefault();
});

const game = new Game({ canvas });
game.audio.bus("music").volume = 0.8;
const loading = new LoadingScene();
game.setScene(loading);
game.start();

const sounds = await buildSounds((p) => (loading.progress = p));
const services = { sounds, music: createMusic(sounds), controls: createBindings() };
game.setScene(new TitleScene(services));

if (new URLSearchParams(location.search).has("test")) window.__abyss = { game, services };
