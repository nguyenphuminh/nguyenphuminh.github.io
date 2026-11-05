// Mobs (BRD 2.2.11): scripted enemies. Each has moves (same stage format as bosses) and a fixed controller.
// Controllers read the simulation directly; mobs never learn.

const recentlyAttacked = (e, sim, pause) => sim.time - e.lastAttackAt < pause;
const distanceTo = (e, sim) => Math.abs(sim.player.x - e.x);
const homeMove = (speed, anim) => ({ label: "Return", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.6, vx: speed, anim: [anim], home: true }] });

export const SHARDLING = {
    id: "shardling",
    name: "Shardling",
    kind: "mob",
    halfWidth: 6,
    height: 10,
    maxHp: 22,
    solid: false,
    flinchTime: 0.3,
    recoilTime: 0.5,
    deathTime: 0.6,
    notice: { front: 150, back: 50 },
    leash: 320,
    minTelegraph: 0.3,
    moves: {
        leap: {
            label: "Leap", kind: "attack", phase: 1,
            stages: [
                { part: "windup", dur: 0.35, anim: ["leap", "windup"], telegraph: "parryable" },
                { part: "air", dur: 0.4, anim: ["leap", "active"], leap: { height: 26, maxDistance: 90 },
                    hit: { x0: -8, x1: 10, y0: 0, y1: 12, damage: 8, parryable: true } },
                { part: "recovery", dur: 0.6, anim: ["leap", "recovery"] },
            ],
        },
        advance: { label: "Crawl", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.4, vx: 70, anim: ["crawl"], stopWithin: 50, track: true }] },
        retreat: { label: "Back off", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.35, vx: -60, anim: ["crawl"] }] },
        hold: { label: "Wait", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.35, vx: 0, anim: ["idle"], track: true }] },
        returnHome: homeMove(60, "crawl"),
    },
    controller(e, sim) {
        const d = distanceTo(e, sim);
        if (recentlyAttacked(e, sim, 0.6)) return "hold";
        if (d <= 80 && d >= 20) return "leap";
        return d > 80 ? "advance" : "retreat";
    },
};

export const SENTINEL = {
    id: "sentinel",
    name: "Glass Sentinel",
    kind: "mob",
    halfWidth: 9,
    height: 30,
    maxHp: 70,
    solid: true,
    shield: true, // blocks light attacks from the front; a heavy attack breaks the guard
    guardBrokenTime: 1.2,
    recoilTime: 0.7,
    deathTime: 0.8,
    notice: { front: 150, back: 50 },
    leash: 320,
    minTelegraph: 0.3,
    moves: {
        thrust: {
            label: "Spear Thrust", kind: "attack", phase: 1,
            stages: [
                { part: "windup", dur: 0.55, anim: ["thrust", "windup"], telegraph: "parryable" },
                { part: "active", dur: 0.15, vx: 20, anim: ["thrust", "active"], hit: { x0: 4, x1: 46, y0: 10, y1: 26, damage: 14, parryable: true } },
                { part: "recovery", dur: 0.75, anim: ["thrust", "recovery"] },
            ],
        },
        bash: {
            label: "Shield Bash", kind: "attack", phase: 1,
            stages: [
                { part: "windup", dur: 0.35, anim: ["bash", "windup"], telegraph: "unparryable" },
                { part: "active", dur: 0.1, vx: 60, anim: ["bash", "active"], hit: { x0: 0, x1: 24, y0: 4, y1: 30, damage: 10, parryable: false, knockback: 170 } },
                { part: "recovery", dur: 0.6, anim: ["bash", "recovery"] },
            ],
        },
        advance: { label: "Advance", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.5, vx: 32, anim: ["walk"], stopWithin: 40, track: true }] },
        retreat: { label: "Step back", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.4, vx: -30, anim: ["walk"] }] },
        hold: { label: "Hold", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.5, vx: 0, anim: ["idle"], track: true }] },
        returnHome: homeMove(32, "walk"),
    },
    controller(e, sim) {
        const d = distanceTo(e, sim);
        if (recentlyAttacked(e, sim, 0.5)) return "hold";
        if (d < 28) return sim.rng.chance(0.5) ? "bash" : "thrust";
        if (d < 52) return "thrust";
        return "advance";
    },
};

export const ARCHER = {
    id: "archer",
    name: "Mirror Archer",
    kind: "mob",
    halfWidth: 6,
    height: 24,
    maxHp: 30,
    solid: false,
    flinchTime: 0.3,
    recoilTime: 0.5,
    deathTime: 0.6,
    notice: { front: 220, back: 60 },
    leash: 340,
    minTelegraph: 0.3,
    hazards: { shard: { speed: 210, life: 2.5, halfWidth: 5, height: 6, lift: 20, damage: 10, offset: 10 } },
    moves: {
        throw: {
            label: "Throw", kind: "attack", phase: 1,
            stages: [
                { part: "windup", dur: 0.5, anim: ["throw", "windup"], telegraph: "parryable" },
                { part: "active", dur: 0.08, anim: ["throw", "active"], spawn: "shard" },
                { part: "recovery", dur: 0.6, anim: ["throw", "recovery"] },
            ],
        },
        advance: { label: "Advance", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.4, vx: 40, anim: ["walk"], stopWithin: 150, track: true }] },
        retreat: { label: "Back away", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.45, vx: -70, anim: ["retreat"] }] },
        hold: { label: "Aim", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.4, vx: 0, anim: ["idle"], track: true }] },
        returnHome: homeMove(40, "walk"),
    },
    controller(e, sim) {
        const d = distanceTo(e, sim);
        if (d < 90) return "retreat"; // backs away when approached
        if (recentlyAttacked(e, sim, 1.4)) return "hold";
        if (d <= 230) return "throw";
        return "advance";
    },
};

export const ECHO = {
    id: "echo",
    name: "Hollow Echo",
    kind: "mob",
    halfWidth: 6,
    height: 26,
    maxHp: 60,
    solid: true,
    recoilTime: 0.6,
    deathTime: 0.8,
    notice: { front: 160, back: 60 },
    leash: 320,
    minTelegraph: 0.3,
    moves: {
        slash: {
            label: "Slash", kind: "attack", phase: 1,
            stages: [
                { part: "windup", dur: 0.32, anim: ["slash", "windup"], telegraph: "parryable" },
                { part: "active", dur: 0.1, vx: 50, anim: ["slash", "active"], hit: { x0: 4, x1: 32, y0: 6, y1: 26, damage: 12, parryable: true } },
                { part: "recovery", dur: 0.6, anim: ["slash", "recovery"] },
            ],
        },
        rollAway: { label: "Roll", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.46, vx: -160, anim: ["roll"], invulnerable: [0.06, 0.32] }] },
        advance: { label: "Advance", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.4, vx: 70, anim: ["walk"], stopWithin: 26, track: true }] },
        hold: { label: "Guard", kind: "reposition", phase: 1, stages: [{ part: "move", dur: 0.35, vx: 0, anim: ["idle"], track: true }] },
        returnHome: homeMove(60, "walk"),
    },
    controller(e, sim) {
        const p = sim.player;
        const d = distanceTo(e, sim);
        const threatened = (p.state === "light" || p.state === "heavy") && d < 46;
        if (threatened && !recentlyAttacked(e, sim, 0.2)) return "rollAway"; // rolls away from attacks...
        if (recentlyAttacked(e, sim, 0.5)) return "hold";
        if (d < 34) return "slash"; // ...and answers with a quick slash
        return "advance";
    },
};
