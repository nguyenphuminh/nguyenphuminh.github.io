// Player combat kit (BRD 2.2.2) as a pure state machine.
import { approach, clamp } from "../../shared/math.js";
import { GRAVITY, MAX_FALL_SPEED, PLAYER as P } from "./constants.js";

const FREE_STATES = new Set(["idle", "run", "jump", "fall"]);
const ACTION_KEYS = ["roll", "light", "heavy", "parry", "heal", "jump"];

export function createPlayer(x, floorY) {
    return {
        x, y: floorY, vx: 0, vy: 0, facing: 1, grounded: true,
        hp: P.maxHp, maxHp: P.maxHp,
        stamina: P.maxStamina, maxStamina: P.maxStamina, staminaDelay: 0, staminaEmpty: false,
        heals: P.maxHeals, maxHeals: P.maxHeals,
        state: "idle", stateTime: 0,
        combo: 0, chainQueued: false, attackSerial: 0, attackHit: false, attackHitIds: new Set(), airAttack: false,
        invuln: 0, buffer: null, bufferTime: 0, healApplied: false, rollDir: 1,
    };
}

export function respawnPlayer(p, x, floorY) {
    Object.assign(p, createPlayer(x, floorY));
}

const setState = (p, state) => {
    p.state = state;
    p.stateTime = 0;
};

export const isPlayerFree = (p) => FREE_STATES.has(p.state);
export const lightDef = (p) => P.light[clamp(p.combo, 1, 3) - 1];
export const attackDef = (p) => (p.state === "heavy" ? P.heavy : p.state === "light" ? lightDef(p) : null);

export function isRollInvulnerable(p) {
    return p.state === "roll" && p.stateTime >= P.roll.invulnFrom && p.stateTime < P.roll.invulnTo;
}

export function isParryActive(p) {
    return p.state === "parry" && p.stateTime >= P.parry.window[0] && p.stateTime < P.parry.window[1];
}

export function playerHurtbox(p) {
    const h = p.state === "roll" ? P.rollHeight : P.height;
    return { left: p.x - P.halfWidth, right: p.x + P.halfWidth, top: p.y - h, bottom: p.y };
}

// The player's attack hitbox while an attack is in its active window. Each enemy can be hit once per attack
// (tracked in attackHitIds); attackHit says whether the attack has landed on anything.
export function playerAttackBox(p) {
    const def = attackDef(p);
    if (!def) return null;
    if (p.stateTime < def.windup || p.stateTime >= def.windup + def.active) return null;
    const a = p.x + p.facing * 4;
    const b = p.x + p.facing * def.reach;
    const tall = p.state === "heavy" ? 32 : 26;
    return {
        box: { left: Math.min(a, b), right: Math.max(a, b), top: p.y - tall, bottom: p.y - 2 },
        def,
        kind: p.state === "heavy" ? "heavy" : "light",
    };
}

function spendStamina(p, cost) {
    if (p.stamina <= 0) {
        p.staminaEmpty = true;
        return false;
    }
    p.stamina = Math.max(0, p.stamina - cost);
    p.staminaDelay = P.staminaDelay;
    return true;
}

// Starts the buffered action if the player is able to. Returns true when an action started.
function tryAct(p, intent, ctx) {
    const action = p.buffer;
    if (!action) return false;
    const grounded = p.grounded;
    let started = false;

    if (action === "jump" && grounded) {
        p.vy = -P.jumpVelocity;
        p.grounded = false;
        setState(p, "jump");
        started = true;
    } else if (action === "roll" && grounded && spendStamina(p, P.roll.stamina)) {
        p.rollDir = intent.moveX !== 0 ? Math.sign(intent.moveX) : p.facing;
        p.facing = p.rollDir;
        setState(p, "roll");
        started = true;
    } else if (action === "light" && spendStamina(p, P.light[0].stamina)) {
        if (intent.moveX !== 0) p.facing = Math.sign(intent.moveX);
        p.combo = 1;
        p.airAttack = !grounded;
        startAttack(p, "light");
        started = true;
    } else if (action === "heavy" && grounded && spendStamina(p, P.heavy.stamina)) {
        if (intent.moveX !== 0) p.facing = Math.sign(intent.moveX);
        startAttack(p, "heavy");
        started = true;
    } else if (action === "parry" && grounded && spendStamina(p, P.parry.stamina)) {
        if (intent.moveX !== 0) p.facing = Math.sign(intent.moveX);
        setState(p, "parry");
        p.vx = 0;
        started = true;
    } else if (action === "heal" && grounded && p.heals > 0) {
        p.heals -= 1;
        p.healApplied = false;
        setState(p, "heal");
        started = true;
    }

    if (started) {
        ctx.events.push({ type: "playerAction", action, toward: ctx.towardBoss(p, action) });
        p.buffer = null;
    }
    return started;
}

function startAttack(p, kind) {
    setState(p, kind);
    p.attackSerial += 1;
    p.attackHit = false;
    p.attackHitIds.clear();
    p.chainQueued = false;
}

function moveHorizontally(p, intent, speedFactor, dt) {
    const target = intent.moveX * P.walkSpeed * speedFactor;
    p.vx = approach(p.vx, target, (p.grounded ? P.groundAccel : P.airAccel) * dt);
}

// One fixed step. ctx = { events, bounds, towardBoss(p, action) }.
export function updatePlayer(p, intent, ctx, dt) {
    p.stateTime += dt;
    p.invuln = Math.max(0, p.invuln - dt);

    // Input buffer: the most recent action press is remembered briefly.
    for (const key of ACTION_KEYS) {
        if (intent[key]) {
            p.buffer = key;
            p.bufferTime = P.bufferTime;
        }
    }
    if (p.buffer) {
        p.bufferTime -= dt;
        if (p.bufferTime <= 0) p.buffer = null;
    }

    switch (p.state) {
        case "dead":
        case "grabbed":
            p.vx = approach(p.vx, 0, 600 * dt);
            p.buffer = null;
            break;
        case "rest":
            p.vx = 0;
            if (intent.moveX !== 0 || p.buffer) {
                setState(p, "idle");
                p.buffer = null;
            }
            break;
        case "hurt":
            p.vx = approach(p.vx, 0, 500 * dt);
            if (p.stateTime >= P.hurt.stun) setState(p, p.grounded ? "idle" : "fall");
            break;
        case "deflected":
            p.vx = approach(p.vx, 0, 500 * dt);
            if (p.stateTime >= P.deflected.stun) setState(p, p.grounded ? "idle" : "fall");
            break;
        case "roll": {
            const t = p.stateTime / P.roll.duration;
            p.vx = p.rollDir * P.roll.speed * (1 - t * t * 0.6);
            if (p.stateTime >= P.roll.duration) {
                setState(p, "idle");
                p.vx *= 0.3;
            } else if (p.stateTime >= P.roll.actFrom && tryAct(p, intent, ctx)) {
                // chained out of the roll
            }
            break;
        }
        case "light":
        case "heavy": {
            const def = attackDef(p);
            const t = p.stateTime;
            const activeEnd = def.windup + def.active;
            const lunging = t >= def.windup && t < activeEnd && !p.airAttack;
            if (p.grounded) p.vx = lunging ? p.facing * def.lunge : approach(p.vx, 0, 900 * dt);

            if (p.state === "light") {
                if (p.buffer === "light" && p.combo < 3 && !p.airAttack && t >= def.windup) p.chainQueued = true;
                if (p.chainQueued && t >= activeEnd + P.chainFrom) {
                    p.buffer = null;
                    if (spendStamina(p, P.light[p.combo].stamina)) {
                        p.combo += 1;
                        if (intent.moveX !== 0) p.facing = Math.sign(intent.moveX);
                        startAttack(p, "light");
                        ctx.events.push({ type: "playerAction", action: "light", toward: ctx.towardBoss(p, "light") });
                        break;
                    }
                    p.chainQueued = false;
                }
                // A light attack that landed can be cancelled into a roll during its recovery.
                if (p.attackHit && t >= activeEnd && p.buffer === "roll" && tryAct(p, intent, ctx)) break;
            }
            if (t >= activeEnd + def.recovery || (p.airAttack && p.grounded && t >= activeEnd)) {
                setState(p, p.grounded ? "idle" : "fall");
            }
            break;
        }
        case "parry":
            p.vx = 0;
            if (p.stateTime >= P.parry.duration) setState(p, "idle");
            break;
        case "heal":
            moveHorizontally(p, intent, P.heal.walkFactor, dt);
            if (!p.healApplied && p.stateTime >= P.heal.applyAt) {
                p.healApplied = true;
                p.hp = Math.min(p.maxHp, p.hp + P.heal.amount);
                ctx.events.push({ type: "heal", amount: P.heal.amount });
            }
            if (p.stateTime >= P.heal.duration) setState(p, "idle");
            break;
        default: {
            // Free states: idle, run, jump, fall.
            if (tryAct(p, intent, ctx)) break;
            moveHorizontally(p, intent, 1, dt);
            if (intent.moveX !== 0) p.facing = Math.sign(intent.moveX);
            // Releasing jump early caps the rise (variable jump height).
            const cutSpeed = -P.jumpVelocity * P.jumpCut;
            if (!intent.jumpHeld && p.state === "jump" && p.vy < cutSpeed) p.vy = cutSpeed;
            if (p.grounded) {
                const next = Math.abs(intent.moveX) > 0 ? "run" : "idle";
                if (p.state !== next) setState(p, next);
            } else if (p.vy > 0 && p.state !== "fall") {
                setState(p, "fall");
            }
        }
    }

    // Stamina regeneration.
    if (p.staminaDelay > 0) {
        p.staminaDelay -= dt;
    } else if (p.stamina < p.maxStamina && (isPlayerFree(p) || p.state === "rest")) {
        const rate = p.state === "idle" || p.state === "rest" ? P.staminaRegenIdle : P.staminaRegen;
        p.stamina = Math.min(p.maxStamina, p.stamina + rate * dt);
    }
    if (p.stamina > 0) p.staminaEmpty = false;

    // Physics.
    if (p.state !== "grabbed") {
        p.vy = Math.min(MAX_FALL_SPEED, p.vy + GRAVITY * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const floor = ctx.bounds.floorY;
        if (p.y >= floor) {
            if (!p.grounded && p.vy > 120) ctx.events.push({ type: "land", x: p.x });
            p.y = floor;
            p.vy = 0;
            p.grounded = true;
            if (p.state === "jump" || p.state === "fall") setState(p, intent.moveX !== 0 ? "run" : "idle");
        } else {
            p.grounded = false;
        }
        p.x = clamp(p.x, ctx.bounds.minX + P.halfWidth, ctx.bounds.maxX - P.halfWidth);
    }
}

// Applies enemy damage to the player. dir = knockback direction (-1 or 1); source = the enemy that dealt it.
export function damagePlayer(p, damage, dir, events, moveId, knockback = P.hurt.knockback, source = null) {
    if (p.state === "heal" && !p.healApplied) events.push({ type: "healCancel" });
    p.hp = Math.max(0, p.hp - damage);
    events.push({ type: "playerHit", damage, moveId, sourceUid: source?.uid ?? null, isBoss: Boolean(source?.isBoss), x: p.x, y: p.y - 14 });
    p.buffer = null;
    p.chainQueued = false;
    if (p.hp <= 0) {
        setState(p, "dead");
        p.vx = dir * knockback * 0.6;
        events.push({ type: "playerDeath" });
        return;
    }
    setState(p, "hurt");
    p.vx = dir * knockback;
    p.invuln = P.hurt.invuln;
}

export function grabPlayer(p, events) {
    if (p.state === "heal" && !p.healApplied) events.push({ type: "healCancel" }); // the spent charge is lost
    setState(p, "grabbed");
    p.vx = 0;
    p.vy = 0;
}

export function throwPlayer(p, damage, dir, events, moveId, speed, source = null) {
    p.state = "hurt";
    damagePlayer(p, damage, dir, events, moveId, speed, source);
    if (p.state === "hurt") p.vy = -150;
    p.grounded = false;
}

/** The knight's attack was turned aside by an enemy's parry stance: a short recoil, no damage. */
export function deflectPlayer(p, events, source) {
    setState(p, "deflected");
    p.vx = -p.facing * P.deflected.knockback;
    p.chainQueued = false;
    events.push({ type: "deflected", sourceUid: source.uid, isBoss: source.isBoss, x: p.x + p.facing * 12, y: p.y - 16 });
}

export function restPlayer(p) {
    p.hp = p.maxHp;
    p.heals = p.maxHeals;
    p.stamina = p.maxStamina;
    p.vx = 0;
    setState(p, "rest");
}
