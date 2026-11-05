// The Reflection, the final and hardest boss (BRD 2.2.10): the knight's own reflection, with a moveset like the
// knight's. Two phases; phase 2 adds Shatter Step and Mirror Volley.
// Reaches match the drawn blade (presentation measured each active frame).
const SLASH = { x0: 4, x1: 32, y0: 6, y1: 26 };
const OVERHEAD = { x0: 0, x1: 24, y0: 6, y1: 40 }; // chain2 is a rising overhead slash: short forward reach, tall
const HEAVY = { x0: 4, x1: 34, y0: 4, y1: 32 };
const ROLL_INVULN = [0.06, 0.32]; // the same window as the knight's own roll

const MOVES = {
    mirroredChain: {
        label: "Mirrored Chain", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.32, anim: ["chain1", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.08, vx: 40, anim: ["chain1", "active"], hit: { ...SLASH, damage: 12, parryable: true } },
            { part: "hold", dur: 0.12, anim: ["chain1", "recoveryStart"] },
            { part: "windup", dur: 0.2, anim: ["chain2", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.08, vx: 40, anim: ["chain2", "active"], hit: { ...OVERHEAD, damage: 12, parryable: true } },
            { part: "hold", dur: 0.12, anim: ["chain2", "recoveryStart"] },
            { part: "windup", dur: 0.22, anim: ["chain3", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.1, vx: 55, anim: ["chain3", "active"], hit: { ...SLASH, x1: 34, damage: 16, parryable: true } },
            { part: "recovery", dur: 0.51, anim: ["chain3", "recovery"] },
        ],
    },
    mirroredHeavy: {
        label: "Mirrored Heavy", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.55, anim: ["heavy", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.1, vx: 60, anim: ["heavy", "active"], hit: { ...HEAVY, damage: 28, parryable: true } },
            { part: "recovery", dur: 0.59, anim: ["heavy", "recovery"] },
        ],
    },
    mirroredLeap: {
        label: "Mirrored Leap", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.45, anim: ["leapSlash", "windup"], telegraph: "unparryable" },
            { part: "air", dur: 0.5, anim: ["leapSlash", "active"], leap: { height: 50 } },
            { part: "active", dur: 0.1, anim: ["leapSlash", "activeEnd"], hit: { x0: -14, x1: 30, y0: 0, y1: 28, damage: 22, parryable: false } },
            { part: "recovery", dur: 0.59, anim: ["leapSlash", "recovery"] },
        ],
    },
    rollThrough: {
        label: "Mirrored Roll", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.46, anim: ["roll"], rollPast: 30, passThrough: true, invulnerable: ROLL_INVULN }],
    },
    rollAway: {
        label: "Mirrored Roll", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.46, vx: -170, anim: ["roll"], invulnerable: ROLL_INVULN }],
    },
    mirroredParry: {
        label: "Mirrored Parry", kind: "counter", phase: 1,
        stages: [
            { part: "move", dur: 0.55, anim: ["parryStance"], parryStance: { counter: "riposte" }, track: true },
            { part: "recovery", dur: 0.26, anim: ["hold"] },
        ],
    },
    // Not chosen by the brain: only played as the answer to a deflected attack (BRD 2.2.10.2).
    riposte: {
        label: "Riposte", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.4, anim: ["riposte", "windup"], telegraph: "parryable", faceTarget: true },
            { part: "active", dur: 0.1, vx: 80, anim: ["riposte", "active"], hit: { ...SLASH, x1: 34, damage: 25, parryable: true } },
            { part: "recovery", dur: 0.51, anim: ["riposte", "recovery"] },
        ],
    },
    drink: {
        label: "Drink", kind: "heal", phase: 1, requires: "heals",
        stages: [{ part: "move", dur: 1.1, anim: ["drink"], heal: { at: 0.75, amount: 60 } }],
    },
    shatterStep: {
        label: "Shatter Step", kind: "attack", phase: 2,
        stages: [
            { part: "windup", dur: 0.35, anim: ["vanish"], telegraph: "parryable", invulnerable: true },
            { part: "windup", dur: 0.35, anim: ["appearSlash", "windup"], telegraph: "parryable", teleportBehind: 30 },
            { part: "active", dur: 0.1, vx: 40, anim: ["appearSlash", "active"], hit: { ...SLASH, x1: 34, damage: 20, parryable: true } },
            { part: "recovery", dur: 0.51, anim: ["appearSlash", "recovery"] },
        ],
    },
    mirrorVolley: {
        label: "Mirror Volley", kind: "attack", phase: 2,
        stages: [
            { part: "windup", dur: 0.6, anim: ["volley", "windup"], telegraph: "unparryable" },
            { part: "active", dur: 0.05, anim: ["volley", "active"], spawn: { kind: "shard", lift: 6, parryable: false } },
            { part: "hold", dur: 0.35, anim: ["volley", "windupEnd"] },
            { part: "active", dur: 0.05, anim: ["volley", "active"], spawn: { kind: "shard", lift: 22, parryable: false } },
            { part: "hold", dur: 0.35, anim: ["volley", "windupEnd"] },
            { part: "active", dur: 0.05, anim: ["volley", "active"], spawn: { kind: "shard", lift: 40, parryable: false } },
            { part: "recovery", dur: 0.51, anim: ["volley", "recovery"] },
        ],
    },
    advance: {
        label: "Advance", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.5, vx: 80, anim: ["walk"], stopWithin: 26, track: true }],
    },
    retreat: {
        label: "Retreat", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.45, vx: -85, anim: ["retreat"] }],
    },
    hold: {
        label: "Hold Guard", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.45, vx: 0, anim: ["hold"], track: true }],
    },
};

export const REFLECTION = {
    id: "reflection",
    name: "The Reflection",
    kind: "boss",
    halfWidth: 6,
    height: 26,
    maxHp: 470,
    solid: true,
    phases: 2,
    phase2: { recoveryScale: 0.8, moveScale: 1.15, transitionTime: 1.5 },
    stagger: { max: 90, drainDelay: 1.5, drain: 9, parry: 40, deflect: 20, staggeredTime: 1.8, afterCritical: 0.4 },
    critical: { light: 40, heavy: 60 },
    heals: 2, // never more than 2 per fight (BRD 2.2.10.3)
    recoilTime: 0.6,
    riseTime: 1.0,
    deathTime: 1.6,
    minTelegraph: 0.3,
    moves: MOVES,
    actions: ["mirroredChain", "mirroredHeavy", "mirroredLeap", "rollThrough", "rollAway", "mirroredParry", "drink", "shatterStep", "mirrorVolley", "advance", "retreat", "hold"],
    hazards: { shard: { speed: 240, life: 2.5, halfWidth: 5, height: 6, lift: 22, damage: 15, offset: 14 } },
};
