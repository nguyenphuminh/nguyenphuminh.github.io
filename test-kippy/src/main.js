import { Game } from "./shared/kippy.js";
import { fitCanvas } from "./shared/view.js";
import { unlockAudio, setMuted } from "./shared/audio.js";
import { loadSave } from "./shared/store.js";
import { buildAtlas } from "./features/art/atlas.js";
import { TitleScene } from "./features/scenes/titleScene.js";
import { RunScene } from "./features/scenes/runScene.js";

const game = new Game({ canvas: document.getElementById("game") });
fitCanvas(game);
window.addEventListener("resize", () => fitCanvas(game));
for (const type of ["keydown", "pointerdown"]) window.addEventListener(type, unlockAudio);
setMuted(Boolean(loadSave().muted));
buildAtlas();

const showTitle = () => game.setScene(new TitleScene(startRun));
const startRun = (character, stage) => game.setScene(new RunScene(character, stage, showTitle));

showTitle();
game.start();

// Opt-in developer helpers: open the page with ?debug and use window.__ia in the console.
if (new URLSearchParams(location.search).has("debug")) {
    import("./features/debug/debug.js").then(m => m.installDebug(game, startRun));
}
