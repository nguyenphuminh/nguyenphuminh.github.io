// Public surface of the adaptive brain feature.
export { createBrain, BRAIN_DEFAULTS } from "./brain.js";
export { loadPolicy, PolicyNet, POLICY_SHAPE, scoreWith } from "./policy.js";
export { encodeFeatures, FEATURE_SIZE } from "./features.js";
export { createHabitProfile, HABIT_NAMES } from "./habits.js";
export { stepReward, terminalReward } from "./reward.js";
export { habitLines, attemptLesson, preferenceChanges } from "./explain.js";
export { loadMemory, saveMemory, forgetMemory, freshMemory, MEMORY_KEY } from "./memory.js";
