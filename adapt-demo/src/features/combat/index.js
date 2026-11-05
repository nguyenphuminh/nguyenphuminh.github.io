// Public surface of the combat feature (pure simulation shared by the game and the trainer).
export { createSim, NO_INTENT } from "./sim.js";
export { DT, FLOOR_Y, PLAYER, MIN_TELEGRAPH } from "./constants.js";
export { ENEMIES, BOSS_IDS, isActionAllowed } from "./enemies/index.js";
