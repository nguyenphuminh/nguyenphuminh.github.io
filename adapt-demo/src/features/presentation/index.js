// Public surface of the presentation feature (BRD 2.2.8 / section 4). Other features import only from here.
import { buildBossArt } from "./boss-art.js";
import { buildPlayerArt } from "./player-art.js";
import { buildWorldArt } from "./world-art.js";

export { drawText, measureText, LINE_HEIGHT } from "./font.js";
export { drawHud } from "./hud.js";
export { createFx } from "./fx.js";
export { createAudio } from "./audio.js";
export { HEX as colors } from "./palette.js";

// Synchronous: generates every sprite sheet, prop, tile and background at startup.
export function buildArt() {
    const world = buildWorldArt();
    const player = buildPlayerArt();
    const boss = buildBossArt();
    delete player.__frames;
    delete boss.__frames;
    return { player, boss, ...world };
}
