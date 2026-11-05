// Runtime for every enemy (bosses and mobs): executes moves stage by stage, stagger, phases, awareness.
// Stage fields (see enemies/*.js):
//   part       windup | hold | active | recovery | move | air
//   dur        seconds, or (rng) => seconds
//   anim       [animName, segment?]; segment is windup | active | recovery | windupEnd | activeEnd | recoveryStart,
//              omitted = play the anim across the stage
//   telegraph  parryable | unparryable (wind-up cue shown to the player)
//   vx         forward speed while in the stage (negative = backwards)
//   hit        hitbox relative to the feet, x along facing: { x0, x1, y0, y1, damage, parryable, grab?, knockback? }
//   spawn      hazard spawned when the stage starts: shockwaves | shard | rain
//   leap       true, or { height, maxDistance }: airborne arc toward the player's position at take-off
//   track      keep facing the player; stopWithin: stop moving when this close to the player
//   faceTarget turn to face the player when the stage starts
//   rollPast   travel past the player, ending this many px behind them; passThrough: the player is not blocked
//   home       walk back to the enemy's post (mobs)
//   invulnerable  true, or [from, to] seconds within the stage, during which the enemy cannot be damaged
//   parryStance   { counter: moveId }: the knight's attacks landing now are deflected and answered with `counter`
//   heal          { at, amount }: spends one of the enemy's heals; restores `amount` at `at` s unless hit first
//   teleportBehind  reappear this many px behind the knight (opposite the way the knight faces)
//   spawn may also be an object, e.g. { kind: "shard", lift, parryable }
import { clamp, lerp } from "../../shared/math.js";
import { spawnHazard } from "./hazards.js";
import { throwPlayer } from "./player.js";
import { isActionAllowed } from "./enemies/index.js";

const UNHITTABLE = new Set(["dormant", "rise", "transition", "dead"]);

/** areaBounds: where a mob lives; it never leaves them, whatever area the knight is in (BRD 2.2.11). */
export function createEnemy(def, x, floorY, uid, areaBounds = null) {
    return {
        uid, def, isBoss: def.kind === "boss", areaBounds,
        x, y: floorY, homeX: x, facing: -1, airborne: false,
        hp: def.maxHp, maxHp: def.maxHp,
        stagger: 0, maxStagger: def.stagger ? def.stagger.max : 0, staggerIdle: 0, criticalTaken: false,
        phase: 1, phaseShifted: false,
        state: def.kind === "boss" ? "dormant" : "idle", stateTime: 0,
        action: null,
        heals: def.heals ?? 0,
        aware: false,
        lastAttackAt: -99,
    };
}

export const isEnemyHittable = (e) => !UNHITTABLE.has(e.state);

/** True while the current stage makes the enemy untouchable (whole stage, or a window within it). */
export function isEnemyInvulnerable(e) {
    const stage = currentStage(e);
    if (!stage || !stage.invulnerable) return false;
    if (stage.invulnerable === true) return true;
    const t = e.action.stageTime;
    return t >= stage.invulnerable[0] && t < stage.invulnerable[1];
}
export const currentStage = (e) => (e.action ? e.action.def.stages[e.action.stageIndex] : null);
/** True while the enemy may block the player's body (not dormant or dead, not airborne, not mid-roll). */
export const isBlocking = (e) => e.def.solid && !e.airborne && e.state !== "dormant" && e.state !== "dead" && !currentStage(e)?.passThrough;

export function enemyHurtbox(e) {
    return { left: e.x - e.def.halfWidth, right: e.x + e.def.halfWidth, top: e.y - e.def.height, bottom: e.y };
}

export function relativeBox(e, box) {
    const a = e.x + e.facing * box.x0;
    const c = e.x + e.facing * box.x1;
    return { left: Math.min(a, c), right: Math.max(a, c), top: e.y - box.y1, bottom: e.y - box.y0 };
}

const evt = (e, data) => ({ uid: e.uid, isBoss: e.isBoss, ...data });

function setState(e, state) {
    e.state = state;
    e.stateTime = 0;
}

export function wakeEnemy(e) {
    setState(e, "rise");
}

export function startEnemyAction(sim, e, requestedId) {
    const id = isActionAllowed(e.def, requestedId, e.phase, e) ? requestedId : "hold";
    const def = e.def.moves[id];
    e.facing = sim.player.x >= e.x ? 1 : -1;
    setState(e, "action");
    e.action = { id, def, stageIndex: -1, stageTime: 0, stageDur: 0, hitDone: false, hitPlayer: false, parried: false, data: {} };
    if (def.kind === "attack") e.lastAttackAt = sim.time;
    sim.events.push(evt(e, {
        type: "enemyActionStart", id, kind: def.kind,
        firstWindup: def.stages[0].part === "windup" ? def.stages[0].dur : 0,
        telegraph: def.stages.find((s) => s.telegraph)?.telegraph ?? null,
    }));
    enterStage(sim, e, 0);
}

function enterStage(sim, e, index) {
    const a = e.action;
    const stage = a.def.stages[index];
    let dur = typeof stage.dur === "function" ? stage.dur(sim.rng) : stage.dur;
    if (e.phase === 2 && stage.part === "recovery" && e.def.phase2) dur *= e.def.phase2.recoveryScale;
    a.stageIndex = index;
    a.stageTime = 0;
    a.stageDur = dur;
    a.hitDone = false;
    const p = sim.player;
    if (stage.faceTarget || stage.rollPast) e.facing = p.x >= e.x ? 1 : -1;
    if (stage.part === "windup") sim.events.push(evt(e, { type: "enemyWindup", id: a.id, telegraph: stage.telegraph }));
    if (stage.part === "active" && stage.hit) sim.events.push(evt(e, { type: "enemySwing", id: a.id }));
    if (stage.rollPast) a.data.rollSpeed = (Math.abs(p.x - e.x) + stage.rollPast) / dur;
    if (stage.teleportBehind) {
        const behind = p.x - p.facing * stage.teleportBehind;
        const lim = limitsOf(e, sim);
        e.x = clamp(behind, lim.minX + e.def.halfWidth, lim.maxX - e.def.halfWidth);
        e.facing = p.x >= e.x ? 1 : -1;
        sim.events.push(evt(e, { type: "enemyAppear", x: e.x, y: e.y - e.def.height / 2 }));
    }
    if (stage.heal && e.heals > 0) {
        e.heals -= 1; // the charge is spent when drinking starts
        a.data.healPending = true;
        sim.events.push(evt(e, { type: "enemyDrink" }));
    }
    if (stage.leap) {
        const maxDistance = stage.leap.maxDistance ?? Infinity;
        const target = e.x + clamp(p.x - e.x, -maxDistance, maxDistance);
        a.data.fromX = e.x;
        const lim = limitsOf(e, sim);
        a.data.toX = clamp(target, lim.minX + e.def.halfWidth, lim.maxX - e.def.halfWidth);
        a.data.arc = stage.leap.height ?? 70;
        sim.events.push(evt(e, { type: "enemyLeap", x: e.x }));
    }
    if (stage.spawn) spawnHazard(sim, e, stage.spawn);
}

function endAction(sim, e, interrupted) {
    const a = e.action;
    if (!a) return;
    sim.events.push(evt(e, { type: "enemyActionEnd", id: a.id, kind: a.def.kind, hitPlayer: a.hitPlayer, parried: a.parried, interrupted }));
    e.action = null;
    e.airborne = false;
    e.y = sim.bounds.floorY;
}

/** Moves the enemy into a non-action state, ending the current move if any. */
export function interruptEnemy(sim, e, state) {
    endAction(sim, e, true);
    setState(e, state);
}

export function addStagger(sim, e, amount) {
    if (!e.def.stagger || e.state === "staggered" || !isEnemyHittable(e)) return;
    e.stagger += amount;
    e.staggerIdle = 0;
    if (e.stagger >= e.maxStagger) {
        e.stagger = 0;
        e.criticalTaken = false;
        interruptEnemy(sim, e, "staggered");
        sim.events.push(evt(e, { type: "stagger" }));
    }
}

/** Applies player damage; handles death and the phase-2 transition. */
export function damageEnemy(sim, e, damage) {
    e.hp = Math.max(0, e.hp - damage);
    e.aware = true;
    if (e.hp <= 0) {
        interruptEnemy(sim, e, "dead");
        sim.events.push(evt(e, { type: "enemyDeath", x: e.x, y: e.y - e.def.height / 2 }));
        if (e.isBoss) {
            sim.hazards.length = 0;
            sim.outcome = "bossDead";
        } else {
            for (let i = sim.hazards.length - 1; i >= 0; i--) if (sim.hazards[i].ownerUid === e.uid) sim.hazards.splice(i, 1);
        }
    } else if (e.def.phases === 2 && !e.phaseShifted && e.hp <= e.maxHp / 2) {
        e.phaseShifted = true;
        e.stagger = 0;
        interruptEnemy(sim, e, "transition");
        sim.events.push(evt(e, { type: "phase2Start" }));
    }
}

/** Being hit while drinking cancels the heal; the spent charge is lost. */
export function cancelHealIfDrinking(sim, e) {
    const stage = currentStage(e);
    if (!stage || !stage.heal || !e.action.data.healPending || e.state === "dead") return;
    e.action.data.healPending = false;
    sim.events.push(evt(e, { type: "enemyHealCancel" }));
    interruptEnemy(sim, e, "recoil");
}

/** The knight's attack landed in a parry stance: the enemy answers with its counter move. */
export function counterAttack(sim, e) {
    const counter = currentStage(e).parryStance.counter;
    endAction(sim, e, true);
    startEnemyAction(sim, e, counter);
}

/** Reaction to being hit (mobs flinch); bosses keep going. */
export function reactToHit(sim, e) {
    if (e.state === "dead" || e.isBoss) return;
    if (e.def.flinchTime && !e.airborne) interruptEnemy(sim, e, "flinch");
}

export function breakGuard(sim, e) {
    interruptEnemy(sim, e, "guardBroken");
    sim.events.push(evt(e, { type: "guardBreak", x: e.x, y: e.y - e.def.height / 2 }));
}

const limitsOf = (e, sim) => e.areaBounds ?? sim.bounds;
const playerInArea = (e, sim) => !e.areaBounds || (sim.player.x >= e.areaBounds.minX && sim.player.x <= e.areaBounds.maxX);

function noticesPlayer(e, sim) {
    const p = sim.player;
    if (!playerInArea(e, sim)) return false;
    const dx = p.x - e.x;
    const inFront = Math.sign(dx) === e.facing || dx === 0;
    return Math.abs(dx) <= (inFront ? e.def.notice.front : e.def.notice.back) && Math.abs(p.y - e.y) < 60;
}

export function updateEnemy(sim, e, dt) {
    const p = sim.player;
    const def = e.def;
    e.stateTime += dt;
    if (def.stagger) {
        e.staggerIdle += dt;
        if (e.staggerIdle > def.stagger.drainDelay) e.stagger = Math.max(0, e.stagger - def.stagger.drain * dt);
    }

    switch (e.state) {
        case "dormant":
        case "dead":
            return;
        case "idle":
            if (p.state !== "dead" && (e.aware || noticesPlayer(e, sim))) {
                e.aware = true;
                setState(e, "ready");
            }
            return;
        case "rise":
            if (e.stateTime >= def.riseTime) setState(e, "ready");
            return;
        case "recoil":
            if (e.stateTime >= def.recoilTime) setState(e, "ready");
            return;
        case "flinch":
            if (e.stateTime >= def.flinchTime) setState(e, "ready");
            return;
        case "guardBroken":
            if (e.stateTime >= def.guardBrokenTime) setState(e, "ready");
            return;
        case "staggered":
            if (e.stateTime >= def.stagger.staggeredTime) setState(e, "ready");
            return;
        case "transition":
            if (e.stateTime >= def.phase2.transitionTime) {
                e.phase = 2;
                sim.events.push(evt(e, { type: "phase2" }));
                setState(e, "ready");
            }
            return;
        case "grabHold":
            p.x = e.x + e.facing * def.grab.handX;
            p.y = e.y - def.grab.handY;
            if (e.stateTime >= def.grab.holdTime) {
                p.y = sim.bounds.floorY - 22;
                throwPlayer(p, def.grab.damage, e.facing, sim.events, e.action.id, def.grab.throwSpeed, e);
                if (p.state === "dead") sim.outcome = "playerDead";
                e.action.hitPlayer = true;
                e.state = "action";
                enterStage(sim, e, e.action.stageIndex + 1);
            }
            return;
        case "ready": {
            if (p.state === "dead") return;
            let id;
            if (e.isBoss) {
                id = sim.controller ? sim.controller(sim.view()) : "hold";
            } else if (!playerInArea(e, sim) || Math.abs(e.x - e.homeX) > def.leash || Math.abs(p.x - e.x) > def.leash) {
                id = "returnHome"; // the knight left (e.g. through the veil) or got too far: go back to the post
            } else {
                id = def.controller(e, sim);
            }
            startEnemyAction(sim, e, id);
            return;
        }
        case "action":
            runStage(sim, e, dt);
    }
}

function runStage(sim, e, dt) {
    const p = sim.player;
    const a = e.action;
    const stage = a.def.stages[a.stageIndex];
    a.stageTime += dt;

    if (stage.leap) {
        const t = clamp(a.stageTime / a.stageDur, 0, 1);
        e.x = lerp(a.data.fromX, a.data.toX, t);
        e.y = sim.bounds.floorY - Math.sin(t * Math.PI) * a.data.arc;
        e.airborne = true;
    } else {
        if (e.airborne) sim.events.push(evt(e, { type: "enemyLand", x: e.x }));
        e.airborne = false;
        e.y = sim.bounds.floorY;
        if (stage.track) e.facing = p.x >= e.x ? 1 : -1;
        let vx;
        if (stage.home) {
            const toHome = e.homeX - e.x;
            e.facing = Math.sign(toHome) || e.facing;
            vx = Math.abs(toHome) < 2 ? 0 : stage.vx;
        } else if (stage.rollPast) {
            vx = a.data.rollSpeed;
        } else {
            vx = stage.vx ?? 0;
            if (e.phase === 2 && stage.part === "move" && e.def.phase2) vx *= e.def.phase2.moveScale;
            if (stage.stopWithin && Math.abs(p.x - e.x) < stage.stopWithin) vx = 0;
        }
        e.x += e.facing * vx * dt;
    }
    const lim = limitsOf(e, sim);
    e.x = clamp(e.x, lim.minX + e.def.halfWidth, lim.maxX - e.def.halfWidth);

    if (stage.heal && a.data.healPending && a.stageTime >= stage.heal.at) {
        a.data.healPending = false;
        const before = e.hp;
        e.hp = Math.min(e.maxHp, e.hp + stage.heal.amount); // never above its starting health
        sim.events.push(evt(e, { type: "enemyHeal", amount: e.hp - before }));
    }

    if (stage.hit && !a.hitDone) {
        const result = sim.tryHitPlayer(relativeBox(e, stage.hit), stage.hit, a.id, e.x, e);
        if (result) {
            a.hitDone = true;
            if (result === "hit") {
                a.hitPlayer = true;
            } else if (result === "parried") {
                a.parried = true;
                interruptEnemy(sim, e, "recoil");
                if (e.def.stagger) addStagger(sim, e, e.def.stagger.parry);
                return;
            } else if (result === "grab") {
                setState(e, "grabHold");
                sim.events.push(evt(e, { type: "grabbed", id: a.id }));
                return;
            }
        }
    }

    if (e.state === "action" && a.stageTime >= a.stageDur) {
        if (a.stageIndex + 1 < a.def.stages.length) {
            enterStage(sim, e, a.stageIndex + 1);
        } else {
            const wasHome = stage.home;
            endAction(sim, e, false);
            if (wasHome && Math.abs(e.x - e.homeX) < 4) {
                e.aware = false;
                e.facing = -1;
                setState(e, "idle");
            } else {
                setState(e, "ready");
            }
        }
    }
}
