// Public surface of the combat feature (pure simulation shared by the game and the trainer).
export { createSim, NO_INTENT } from "./sim.js";
export { DT, FLOOR_Y, PLAYER, BOSS, MIN_TELEGRAPH } from "./constants.js";
export { MOVES, ACTIONS, HAZARDS, isActionAllowed } from "./moves.js";
