// Public surface of the presentation feature (BRD 2.2.8 / section 4). Other features import only from here.
import { buildBossArt } from "./boss-art.js";
import { buildPlayerArt } from "./player-art.js";
import { buildWorldArt } from "./world-art.js";
import { buildSquireArt } from "./squire-art.js";
import { buildMobArt } from "./mob-art.js";
import { buildPortraits, buildVisionFace } from "./portraits.js";
import { buildHallArt } from "./hall-art.js";
import { buildHeartArt } from "./heart-art.js";
import { buildArcherArt } from "./archer-art.js";
import { buildEchoArt, buildReflectionArt } from "./knight-variants.js";
import { setVisionFace } from "./story-ui.js";

export { drawText, measureText, LINE_HEIGHT } from "./font.js";
export { drawHud } from "./hud.js";
export { createFx } from "./fx.js";
export { createAudio } from "./audio.js";
export { HEX as colors } from "./palette.js";
export { drawDialogue, drawSkipRing, drawInscription, drawMobBar, drawShardVision } from "./story-ui.js";
export { MIRROR_PANE_GLASS } from "./hall-art.js";
export { GREAT_MIRROR_GLASS } from "./heart-art.js";

// Synchronous: generates every sprite sheet, prop, tile and background at startup.
export function buildArt() {
    const world = buildWorldArt();
    const player = buildPlayerArt();
    const boss = buildBossArt();
    const squire = buildSquireArt();
    const mobs = buildMobArt();
    mobs.archer = buildArcherArt();
    mobs.echo = buildEchoArt();
    const reflection = buildReflectionArt();
    const portraits = buildPortraits({ player, squire, boss, reflection });
    setVisionFace(buildVisionFace());
    for (const art of [player, boss, squire, reflection, mobs.shardling, mobs.sentinel, mobs.archer, mobs.echo]) delete art.__frames;
    // Stage 2 (Hall of Panes) and stage 3 (Silvered Heart, ending) environments are merged into the same maps.
    const hall = buildHallArt(), heart = buildHeartArt();
    for (const part of [hall, heart]) {
        Object.assign(world.tiles, part.tiles);
        Object.assign(world.backgrounds, part.backgrounds);
        Object.assign(world.props, part.props);
    }
    return { player, boss, squire, reflection, mobs, portraits, ...world };
}
