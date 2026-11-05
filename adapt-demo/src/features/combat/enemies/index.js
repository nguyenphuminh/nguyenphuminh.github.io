// Registry of every enemy definition (bosses and mobs).
import { MIRRORWRIGHT } from "./mirrorwright.js";
import { SQUIRE } from "./squire.js";
import { REFLECTION } from "./reflection.js";
import { ARCHER, ECHO, SHARDLING, SENTINEL } from "./mobs.js";

export const ENEMIES = {
    squire: SQUIRE, mirrorwright: MIRRORWRIGHT, reflection: REFLECTION,
    shardling: SHARDLING, sentinel: SENTINEL, archer: ARCHER, echo: ECHO,
};
export const BOSS_IDS = ["squire", "mirrorwright", "reflection"];

/**
 * True when move `id` exists for this enemy and is available in the given phase. `state` (the enemy, or its
 * visible view) is needed for moves that require something, e.g. a heal left to drink.
 */
export function isActionAllowed(def, id, phase, state = null) {
    const move = def.moves[id];
    if (move === undefined || move.phase > phase) return false;
    if (move.requires === "heals") return Boolean(state) && state.heals > 0;
    return true;
}
