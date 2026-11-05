// The Mirrorwright, the second boss (BRD 2.2.3), as data. Values match the trained model; change them only with retraining.
// A move is a list of stages. Stage fields:
//   part       windup | hold | active | recovery | move | air
//   dur        seconds, or (rng) => seconds
//   anim       [animName, segment?]; segment is windup | active | recovery | windupEnd | activeEnd | recoveryStart,
//              omitted = play the anim across the stage
//   telegraph  parryable | unparryable (wind-up cue shown to the player)
//   vx         forward speed while in the stage (negative = backwards)
//   hit        hitbox relative to the boss's feet, x along facing: { x0, x1, y0, y1, damage, parryable, grab? }
//   spawn      hazard spawned when the stage starts: shockwaves | shard | rain
//   leap       true on the airborne stage (arc toward the target picked at take-off)
const CUT_HIT = { x0: 4, x1: 60, y0: 8, y1: 52 }; // reaches match the drawn blade (presentation reports 61–65 px)
const LUNGE_HIT = { x0: 0, x1: 62, y0: 8, y1: 44 };

const MOVES = {
    quickCut: {
        label: "Quick Cut", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.32, anim: ["quickCut", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.1, vx: 40, anim: ["quickCut", "active"], hit: { ...CUT_HIT, damage: 15, parryable: true } },
            { part: "recovery", dur: 0.55, anim: ["quickCut", "recovery"] },
        ],
    },
    hesitationCut: {
        label: "Hesitation Cut", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.32, anim: ["quickCut", "windup"], telegraph: "parryable" },
            { part: "hold", dur: 0.45, anim: ["quickCut", "windupEnd"], telegraph: "parryable" },
            { part: "active", dur: 0.1, vx: 50, anim: ["quickCut", "active"], hit: { ...CUT_HIT, damage: 16, parryable: true } },
            { part: "recovery", dur: 0.55, anim: ["quickCut", "recovery"] },
        ],
    },
    piercingLunge: {
        label: "Piercing Lunge", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.45, anim: ["lunge", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.25, vx: 260, anim: ["lunge", "active"], hit: { ...LUNGE_HIT, damage: 18, parryable: true } },
            { part: "recovery", dur: 0.6, anim: ["lunge", "recovery"] },
        ],
    },
    shatterSlam: {
        label: "Shatter Slam", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.6, anim: ["slam", "windup"], telegraph: "unparryable" },
            { part: "active", dur: 0.08, anim: ["slam", "active"], spawn: "shockwaves",
                hit: { x0: 0, x1: 60, y0: 0, y1: 60, damage: 24, parryable: false } },
            { part: "recovery", dur: 0.8, anim: ["slam", "recovery"] },
        ],
    },
    lowSweep: {
        label: "Low Sweep", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.42, anim: ["sweep", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.14, anim: ["sweep", "active"], hit: { x0: -12, x1: 66, y0: 0, y1: 16, damage: 15, parryable: true } },
            { part: "recovery", dur: 0.6, anim: ["sweep", "recovery"] },
        ],
    },
    glassLeap: {
        label: "Glass Leap", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.5, anim: ["leap", "windup"], telegraph: "unparryable" },
            { part: "air", dur: 0.55, anim: ["leap", "active"], leap: true },
            { part: "active", dur: 0.1, anim: ["leap", "activeEnd"], hit: { x0: -30, x1: 56, y0: 0, y1: 30, damage: 22, parryable: false } },
            { part: "recovery", dur: 0.75, anim: ["leap", "recovery"] },
        ],
    },
    mirrorShard: {
        label: "Mirror Shard", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.5, vx: -70, anim: ["shard", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.06, anim: ["shard", "active"], spawn: "shard" },
            { part: "recovery", dur: 0.45, anim: ["shard", "recovery"] },
        ],
    },
    grasp: {
        label: "Grasp", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.7, anim: ["grasp", "windup"], telegraph: "unparryable" },
            { part: "active", dur: 0.2, vx: 60, anim: ["grasp", "active"], hit: { x0: 4, x1: 42, y0: 4, y1: 50, damage: 0, parryable: false, grab: true } },
            { part: "recovery", dur: 0.9, anim: ["grasp", "recovery"] },
        ],
    },
    feint: {
        label: "Feint", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.32, anim: ["quickCut", "windup"], telegraph: "parryable" },
            { part: "move", dur: 0.3, vx: -100, anim: ["feintStep"] },
            { part: "recovery", dur: 0.12, anim: ["idle"] },
        ],
    },
    echoCombo: {
        label: "Echo Combo", kind: "attack", phase: 2,
        stages: [
            { part: "windup", dur: 0.32, anim: ["quickCut", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.1, vx: 40, anim: ["quickCut", "active"], hit: { ...CUT_HIT, damage: 14, parryable: true } },
            { part: "hold", dur: (rng) => rng.range(0.12, 0.45), anim: ["quickCut", "recoveryStart"] },
            { part: "windup", dur: 0.35, anim: ["lunge", "windup"], telegraph: "unparryable" },
            { part: "active", dur: 0.25, vx: 260, anim: ["lunge", "active"], hit: { ...LUNGE_HIT, damage: 17, parryable: false } },
            { part: "recovery", dur: 0.7, anim: ["lunge", "recovery"] },
        ],
    },
    shardRain: {
        label: "Shard Rain", kind: "attack", phase: 2,
        stages: [
            { part: "windup", dur: 0.7, anim: ["shardRain", "windup"], telegraph: "unparryable" },
            { part: "active", dur: 0.2, anim: ["shardRain", "active"], spawn: "rain" },
            { part: "recovery", dur: 0.9, anim: ["shardRain", "recovery"] },
        ],
    },
    advance: {
        label: "Advance", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.6, vx: 60, anim: ["walk"], stopWithin: 34, track: true }],
    },
    retreat: {
        label: "Retreat", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.5, vx: -75, anim: ["retreat"] }],
    },
    hold: {
        label: "Hold Guard", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.5, vx: 0, anim: ["hold"], track: true }],
    },
};

// Fixed action order: the policy network's outputs map to this list.
const ACTIONS = [
    "quickCut", "hesitationCut", "piercingLunge", "shatterSlam", "lowSweep", "glassLeap", "mirrorShard",
    "grasp", "feint", "echoCombo", "shardRain", "advance", "retreat", "hold",
];

const HAZARDS = {
    shockwave: { speed: 175, life: 1.5, halfWidth: 8, height: 12, damage: 13, offset: 20 },
    shard: { speed: 250, life: 2.5, halfWidth: 5, height: 6, lift: 24, damage: 12, offset: 20 },
    rain: { count: 6, warn: 0.6, stagger: 0.18, active: 0.08, radius: 14, damage: 14 },
};

export const MIRRORWRIGHT = {
    id: "mirrorwright",
    name: "The Mirrorwright",
    kind: "boss",
    halfWidth: 14,
    height: 64,
    maxHp: 420,
    solid: true,
    phases: 2,
    phase2: { recoveryScale: 0.75, moveScale: 1.2, transitionTime: 1.8 },
    stagger: { max: 100, drainDelay: 1.5, drain: 8, parry: 45, deflect: 20, staggeredTime: 2.0, afterCritical: 0.4 },
    critical: { light: 40, heavy: 60 },
    recoilTime: 0.8,
    riseTime: 1.6,
    deathTime: 2.2,
    grab: { holdTime: 1.0, damage: 28, throwSpeed: 200, handX: 18, handY: 14 },
    minTelegraph: 0.3,
    moves: MOVES,
    actions: ACTIONS,
    hazards: HAZARDS,
};
