// World layout (BRD 2.2.1): approach area, checkpoint shrine, veil gate and the boss arena.
// The arena interior is exactly as wide as the training arena, so the boss sees the same distances.
import { FLOOR_Y } from "../combat/index.js";

export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 270;

const ARENA_LEFT = 1080;
export const WORLD = {
    floorY: FLOOR_Y,
    approach: { minX: 12, maxX: 1010 },
    shrineX: 150,
    veilX: 1022,
    arenaLeft: ARENA_LEFT,
    arena: { minX: ARENA_LEFT + 24, maxX: ARENA_LEFT + 456 },
    arenaEntryX: ARENA_LEFT + 60,
    bossX: ARENA_LEFT + 330,
    interactRange: 26,
};

export const nearShrine = (x) => Math.abs(x - WORLD.shrineX) < WORLD.interactRange;
export const nearVeil = (x) => x > WORLD.veilX - WORLD.interactRange - 6;

/** Camera x (left edge) for the approach area: follows the player, never shows the arena. */
export function approachCameraX(playerX) {
    const max = WORLD.veilX + 24 - VIEW_WIDTH;
    return Math.max(0, Math.min(max, Math.round(playerX - VIEW_WIDTH * 0.4)));
}

export const arenaCameraX = () => ARENA_LEFT;
