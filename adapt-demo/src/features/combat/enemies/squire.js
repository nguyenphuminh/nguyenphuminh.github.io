// The Pale Squire, the first and easiest boss (BRD 2.2.9). One phase, long wind-ups (≥ 0.45 s), five attacks.
const SLASH = { x0: 4, x1: 46, y0: 6, y1: 40 };
const BACKHAND = { x0: 4, x1: 42, y0: 6, y1: 40 };

const MOVES = {
    wideSlash: {
        label: "Wide Slash", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.5, anim: ["wideSlash", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.12, vx: 30, anim: ["wideSlash", "active"], hit: { ...SLASH, damage: 14, parryable: true } },
            { part: "recovery", dur: 0.7, anim: ["wideSlash", "recovery"] },
        ],
    },
    doubleSlash: {
        label: "Double Slash", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.5, anim: ["wideSlash", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.12, vx: 30, anim: ["wideSlash", "active"], hit: { ...SLASH, damage: 12, parryable: true } },
            { part: "hold", dur: 0.3, anim: ["wideSlash", "recoveryStart"] },
            { part: "windup", dur: 0.2, anim: ["backSlash", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.12, vx: 40, anim: ["backSlash", "active"], hit: { ...BACKHAND, damage: 13, parryable: true } },
            { part: "recovery", dur: 0.8, anim: ["backSlash", "recovery"] },
        ],
    },
    chargingThrust: {
        label: "Charging Thrust", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.55, anim: ["thrust", "windup"], telegraph: "parryable" },
            { part: "active", dur: 0.28, vx: 230, anim: ["thrust", "active"], hit: { x0: 0, x1: 40, y0: 8, y1: 34, damage: 16, parryable: true } },
            { part: "recovery", dur: 0.75, anim: ["thrust", "recovery"] },
        ],
    },
    overheadChop: {
        label: "Overhead Chop", kind: "attack", phase: 1,
        stages: [
            { part: "windup", dur: 0.75, anim: ["chop", "windup"], telegraph: "unparryable" },
            { part: "active", dur: 0.1, anim: ["chop", "active"], hit: { x0: 0, x1: 44, y0: 0, y1: 50, damage: 22, parryable: false } }, // matches the drawn blade (42–44 px)
            { part: "recovery", dur: 0.95, anim: ["chop", "recovery"] },
        ],
    },
    mimicRoll: {
        label: "Mimic Roll", kind: "attack", phase: 1,
        stages: [
            { part: "move", dur: 0.45, anim: ["roll"], rollPast: 36, passThrough: true },
            { part: "windup", dur: 0.45, anim: ["turnSlash", "windup"], telegraph: "parryable", faceTarget: true },
            { part: "active", dur: 0.12, vx: 30, anim: ["turnSlash", "active"], hit: { ...BACKHAND, damage: 13, parryable: true } },
            { part: "recovery", dur: 0.7, anim: ["turnSlash", "recovery"] },
        ],
    },
    advance: {
        label: "Advance", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.6, vx: 55, anim: ["walk"], stopWithin: 30, track: true }],
    },
    retreat: {
        label: "Retreat", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.5, vx: -65, anim: ["retreat"] }],
    },
    hold: {
        label: "Hold Guard", kind: "reposition", phase: 1,
        stages: [{ part: "move", dur: 0.5, vx: 0, anim: ["hold"], track: true }],
    },
};

export const SQUIRE = {
    id: "squire",
    name: "The Pale Squire",
    kind: "boss",
    halfWidth: 11,
    height: 44,
    maxHp: 280,
    solid: true,
    phases: 1,
    stagger: { max: 90, drainDelay: 1.5, drain: 10, parry: 45, deflect: 20, staggeredTime: 2.2, afterCritical: 0.4 },
    critical: { light: 40, heavy: 60 },
    recoilTime: 0.9,
    riseTime: 0.8,
    deathTime: 1.6,
    minTelegraph: 0.45,
    brain: { temperature: 0.12 }, // "still learning": more variety in its choices (BRD 2.2.4)
    moves: MOVES,
    actions: ["wideSlash", "doubleSlash", "chargingThrust", "overheadChop", "mimicRoll", "advance", "retreat", "hold"],
    hazards: {},
};
