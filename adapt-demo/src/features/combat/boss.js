// The Mirrorwright's runtime (BRD 2.2.3): executes moves stage by stage, stagger, phases.
import { clamp, lerp } from "../../shared/math.js";
import { BOSS as B } from "./constants.js";
import { MOVES, isActionAllowed } from "./moves.js";
import { spawnHazard } from "./hazards.js";
import { throwPlayer } from "./player.js";

const UNHITTABLE = new Set(["dormant", "rise", "transition", "dead"]);

export function createBoss(x, floorY) {
    return {
        x, y: floorY, facing: -1, airborne: false,
        hp: B.maxHp, maxHp: B.maxHp,
        stagger: 0, maxStagger: B.maxStagger, staggerIdle: 0, criticalTaken: false,
        phase: 1, phaseShifted: false,
        state: "dormant", stateTime: 0,
        action: null,
    };
}

export const isBossHittable = (b) => !UNHITTABLE.has(b.state);

export function bossHurtbox(b) {
    return { left: b.x - B.halfWidth, right: b.x + B.halfWidth, top: b.y - B.height, bottom: b.y };
}

export function relativeBox(b, box) {
    const a = b.x + b.facing * box.x0;
    const c = b.x + b.facing * box.x1;
    return { left: Math.min(a, c), right: Math.max(a, c), top: b.y - box.y1, bottom: b.y - box.y0 };
}

export const currentStage = (b) => (b.action ? b.action.def.stages[b.action.stageIndex] : null);

function setState(b, state) {
    b.state = state;
    b.stateTime = 0;
}

export function wakeBoss(sim) {
    setState(sim.boss, "rise");
}

export function startBossAction(sim, requestedId) {
    const b = sim.boss;
    const id = isActionAllowed(requestedId, b.phase) ? requestedId : "hold";
    b.facing = sim.player.x >= b.x ? 1 : -1;
    setState(b, "action");
    b.action = { id, def: MOVES[id], stageIndex: -1, stageTime: 0, stageDur: 0, hitDone: false, hitPlayer: false, parried: false, data: {} };
    sim.events.push({ type: "bossActionStart", id });
    enterStage(sim, 0);
}

function enterStage(sim, index) {
    const b = sim.boss;
    const a = b.action;
    const stage = a.def.stages[index];
    let dur = typeof stage.dur === "function" ? stage.dur(sim.rng) : stage.dur;
    if (b.phase === 2 && stage.part === "recovery") dur *= B.phase2RecoveryScale;
    a.stageIndex = index;
    a.stageTime = 0;
    a.stageDur = dur;
    a.hitDone = false;
    if (stage.part === "windup") sim.events.push({ type: "bossWindup", id: a.id, telegraph: stage.telegraph });
    if (stage.part === "active" && stage.hit) sim.events.push({ type: "bossSwing", id: a.id });
    if (stage.leap) {
        a.data.fromX = b.x;
        a.data.toX = clamp(sim.player.x, sim.bounds.minX + B.halfWidth, sim.bounds.maxX - B.halfWidth);
        sim.events.push({ type: "bossLeap" });
    }
    if (stage.spawn) spawnHazard(sim, stage.spawn);
}

function endAction(sim, interrupted) {
    const b = sim.boss;
    const a = b.action;
    if (!a) return;
    sim.events.push({ type: "bossActionEnd", id: a.id, hitPlayer: a.hitPlayer, parried: a.parried, interrupted });
    b.action = null;
    b.airborne = false;
    b.y = sim.bounds.floorY;
}

// Moves the boss into a non-action state, ending the current move if any.
export function interruptBoss(sim, state) {
    endAction(sim, true);
    setState(sim.boss, state);
}

export function addStagger(sim, amount) {
    const b = sim.boss;
    if (b.state === "staggered" || !isBossHittable(b)) return;
    b.stagger += amount;
    b.staggerIdle = 0;
    if (b.stagger >= b.maxStagger) {
        b.stagger = 0;
        b.criticalTaken = false;
        interruptBoss(sim, "staggered");
        sim.events.push({ type: "stagger" });
    }
}

// Applies player damage to the boss and handles phase change and death.
export function damageBoss(sim, damage) {
    const b = sim.boss;
    b.hp = Math.max(0, b.hp - damage);
    if (b.hp <= 0) {
        interruptBoss(sim, "dead");
        sim.hazards.length = 0;
        sim.events.push({ type: "bossDeath" });
        sim.outcome = "bossDead";
    } else if (!b.phaseShifted && b.hp <= b.maxHp / 2) {
        b.phaseShifted = true;
        b.stagger = 0;
        interruptBoss(sim, "transition");
        sim.events.push({ type: "phase2Start" });
    }
}

export function updateBoss(sim, dt) {
    const b = sim.boss;
    const p = sim.player;
    b.stateTime += dt;
    b.staggerIdle += dt;
    if (b.staggerIdle > B.staggerDrainDelay) b.stagger = Math.max(0, b.stagger - B.staggerDrain * dt);

    switch (b.state) {
        case "dormant":
        case "dead":
            return;
        case "rise":
            if (b.stateTime >= B.riseTime) setState(b, "ready");
            return;
        case "recoil":
            if (b.stateTime >= B.recoilTime) setState(b, "ready");
            return;
        case "staggered":
            if (b.stateTime >= B.staggeredTime) setState(b, "ready");
            return;
        case "transition":
            if (b.stateTime >= B.transitionTime) {
                b.phase = 2;
                sim.events.push({ type: "phase2" });
                setState(b, "ready");
            }
            return;
        case "grabHold":
            p.x = b.x + b.facing * 18; // held in the boss's hand (presentation grab point)
            p.y = b.y - 14;
            if (b.stateTime >= B.grab.holdTime) {
                p.y = sim.bounds.floorY - 22;
                throwPlayer(p, B.grab.damage, b.facing, sim.events, b.action.id, B.grab.throwSpeed);
                if (p.state === "dead") sim.outcome = "playerDead";
                b.action.hitPlayer = true;
                b.state = "action";
                enterStage(sim, b.action.stageIndex + 1);
            }
            return;
        case "ready": {
            if (p.state === "dead") return;
            const id = sim.controller ? sim.controller(sim.view()) : "hold";
            startBossAction(sim, id);
            return;
        }
        case "action":
            runStage(sim, dt);
    }
}

function runStage(sim, dt) {
    const b = sim.boss;
    const p = sim.player;
    const a = b.action;
    const stage = a.def.stages[a.stageIndex];
    a.stageTime += dt;

    if (stage.leap) {
        const t = clamp(a.stageTime / a.stageDur, 0, 1);
        b.x = lerp(a.data.fromX, a.data.toX, t);
        b.y = sim.bounds.floorY - Math.sin(t * Math.PI) * 70;
        b.airborne = true;
    } else {
        if (b.airborne) sim.events.push({ type: "bossLand", x: b.x });
        b.airborne = false;
        b.y = sim.bounds.floorY;
        if (stage.track) b.facing = p.x >= b.x ? 1 : -1;
        let vx = stage.vx ?? 0;
        if (b.phase === 2 && stage.part === "move") vx *= B.phase2MoveScale;
        if (stage.stopWithin && Math.abs(p.x - b.x) < stage.stopWithin) vx = 0;
        b.x += b.facing * vx * dt;
    }
    b.x = clamp(b.x, sim.bounds.minX + B.halfWidth, sim.bounds.maxX - B.halfWidth);

    if (stage.hit && !a.hitDone) {
        const result = sim.tryHitPlayer(relativeBox(b, stage.hit), stage.hit, a.id, b.x);
        if (result) {
            a.hitDone = true;
            if (result === "hit") {
                a.hitPlayer = true;
            } else if (result === "parried") {
                a.parried = true;
                interruptBoss(sim, "recoil");
                addStagger(sim, B.parryStagger);
                return;
            } else if (result === "grab") {
                setState(b, "grabHold");
                sim.events.push({ type: "grabbed", id: a.id });
                return;
            }
        }
    }

    if (b.state === "action" && a.stageTime >= a.stageDur) {
        if (a.stageIndex + 1 < a.def.stages.length) {
            enterStage(sim, a.stageIndex + 1);
        } else {
            endAction(sim, false);
            setState(b, "ready");
        }
    }
}
