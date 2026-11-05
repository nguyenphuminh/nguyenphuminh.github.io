// The combat simulation shared by the browser game and the offline trainer.
// Pure and deterministic for a given seed: no engine, DOM or wall-clock access.
import { createRng } from "../../shared/rng.js";
import { BOSS as B, DT, FLOOR_Y, PLAYER as P } from "./constants.js";
import {
    createPlayer, damagePlayer, grabPlayer, isParryActive, isRollInvulnerable,
    playerAttackBox, playerHurtbox, respawnPlayer, restPlayer, updatePlayer,
} from "./player.js";
import {
    addStagger, bossHurtbox, createBoss, currentStage, damageBoss, isBossHittable, updateBoss, wakeBoss,
} from "./boss.js";
import { updateHazards } from "./hazards.js";

const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const PLAYER_MODES = {
    idle: "neutral", run: "neutral", rest: "neutral", jump: "air", fall: "air",
    light: "attack", heavy: "heavy", roll: "roll", parry: "parry", heal: "heal",
    hurt: "hurt", grabbed: "hurt", dead: "dead",
};

export const NO_INTENT = Object.freeze({
    moveX: 0, jump: false, jumpHeld: false, roll: false, light: false, heavy: false, parry: false, heal: false,
});

/**
 * @param {object} o
 * @param {number} [o.seed]
 * @param {{minX:number,maxX:number,floorY?:number}} o.bounds
 * @param {number} o.playerX
 * @param {number|null} [o.bossX]   null = no boss in this simulation
 * @param {(view)=>string} [o.controller]  picks the boss's next move when it is free
 */
export function createSim({ seed = 1, bounds, playerX, bossX = null, controller = null }) {
    const floorY = bounds.floorY ?? FLOOR_Y;
    const sim = {
        rng: createRng(seed),
        time: 0,
        bounds: { minX: bounds.minX, maxX: bounds.maxX, floorY },
        player: createPlayer(playerX, floorY),
        boss: bossX === null ? null : createBoss(bossX, floorY),
        hazards: [],
        nextId: 1,
        outcome: null, // null | "playerDead" | "bossDead"
        controller,
        events: [],

        step(intent = NO_INTENT) {
            sim.events = [];
            sim.time += DT;
            const p = sim.player;
            const b = sim.boss;

            updatePlayer(p, intent, playerContext, DT);
            if (b) {
                updateBoss(sim, DT);
                updateHazards(sim, DT);
                resolvePlayerAttack();
                separateBodies();
            }
            return sim.events;
        },

        // Called by boss stages and hazards. Returns hit | parried | grab | dodged | null.
        tryHitPlayer(box, hit, moveId, sourceX) {
            const p = sim.player;
            if (p.state === "dead" || p.state === "grabbed") return null;
            if (!overlaps(box, playerHurtbox(p))) return null;
            if (isRollInvulnerable(p)) {
                sim.events.push({ type: "dodge", moveId });
                return "dodged";
            }
            if (p.invuln > 0) return null;
            const facesSource = Math.abs(sourceX - p.x) < 2 || Math.sign(sourceX - p.x) === p.facing;
            if (hit.parryable && isParryActive(p) && facesSource) {
                p.stateTime = Math.max(p.stateTime, P.parry.duration - 0.1);
                sim.events.push({ type: "parry", moveId, x: p.x + p.facing * 10, y: p.y - 16 });
                return "parried";
            }
            if (hit.grab) {
                grabPlayer(p, sim.events);
                return "grab";
            }
            damagePlayer(p, hit.damage, Math.sign(p.x - sourceX) || 1, sim.events, moveId);
            if (p.state === "dead") sim.outcome = "playerDead";
            return "hit";
        },

        addStagger: (amount) => addStagger(sim, amount),

        // Starts the boss fight (the boss rises from its kneel).
        wakeBoss: () => wakeBoss(sim),

        setBounds(next) {
            sim.bounds.minX = next.minX;
            sim.bounds.maxX = next.maxX;
        },

        rest: () => restPlayer(sim.player),

        // Resets the fight for a new attempt. The boss keeps nothing from the previous attempt.
        resetAttempt({ playerX, bossX }) {
            respawnPlayer(sim.player, playerX, floorY);
            if (bossX !== undefined && bossX !== null) sim.boss = createBoss(bossX, floorY);
            sim.hazards.length = 0;
            sim.outcome = null;
        },

        // Only what is visible on screen (BRD 2.2.3.4). This is all the brain and bots may read.
        view() {
            const p = sim.player;
            const v = {
                time: sim.time,
                bounds: { ...sim.bounds },
                player: {
                    x: p.x, y: p.y, vx: p.vx, vy: p.vy, grounded: p.grounded, facing: p.facing,
                    state: p.state, stateTime: p.stateTime, mode: PLAYER_MODES[p.state] ?? "neutral",
                    combo: p.combo, hp: p.hp, maxHp: p.maxHp, stamina: p.stamina, maxStamina: p.maxStamina,
                    heals: p.heals, maxHeals: p.maxHeals,
                },
                boss: null,
                hazards: sim.hazards.map((h) => ({ kind: h.kind, x: h.x, y: h.y, dir: h.dir ?? 0, t: h.t, impactAt: h.impactAt ?? 0 })),
            };
            const b = sim.boss;
            if (b) {
                const stage = currentStage(b);
                v.boss = {
                    x: b.x, y: b.y, facing: b.facing, airborne: b.airborne,
                    hp: b.hp, maxHp: b.maxHp, stagger: b.stagger, maxStagger: b.maxStagger, phase: b.phase,
                    state: b.state, stateTime: b.stateTime,
                    actionId: b.action ? b.action.id : null, // the boss's own knowledge; bots must use anim
                    anim: stage ? stage.anim[0] : null, // what a player sees: the animation being played
                    animSegment: stage ? stage.anim[1] ?? null : null,
                    stagePart: stage ? stage.part : null,
                    stageIndex: b.action ? b.action.stageIndex : -1,
                    stageTime: b.action ? b.action.stageTime : 0,
                    stageDur: b.action ? b.action.stageDur : 0,
                    telegraph: stage ? stage.telegraph ?? null : null,
                    leapTargetX: b.action && b.action.data.toX !== undefined ? b.action.data.toX : null,
                };
            }
            return v;
        },
    };

    const playerContext = {
        get events() {
            return sim.events;
        },
        get bounds() {
            return sim.bounds;
        },
        towardBoss(p, action) {
            if (!sim.boss) return false;
            const dirToBoss = Math.sign(sim.boss.x - p.x) || 1;
            return action === "roll" ? p.rollDir === dirToBoss : p.facing === dirToBoss;
        },
    };

    function resolvePlayerAttack() {
        const p = sim.player;
        const b = sim.boss;
        const atk = playerAttackBox(p);
        if (!atk || !isBossHittable(b) || !overlaps(atk.box, bossHurtbox(b))) return;
        p.attackHit = true;
        let damage = atk.def.damage;
        let critical = false;
        if (b.state === "staggered" && !b.criticalTaken) {
            critical = true;
            damage = B.criticalDamage[atk.kind];
            b.criticalTaken = true;
            b.stateTime = Math.max(b.stateTime, B.staggeredTime - B.staggerAfterCritical);
        }
        sim.events.push({ type: "bossHit", damage, kind: atk.kind, critical, x: b.x, y: b.y - 34 });
        if (!critical) addStagger(sim, atk.def.stagger);
        damageBoss(sim, damage);
    }

    // The player cannot walk through the boss, but can roll through it.
    function separateBodies() {
        const p = sim.player;
        const b = sim.boss;
        if (b.state === "dormant" || b.state === "dead" || b.airborne || !p.grounded) return;
        if (p.state === "roll" || p.state === "grabbed" || p.state === "dead") return;
        const minGap = B.halfWidth + P.halfWidth;
        const dx = p.x - b.x;
        if (Math.abs(dx) < minGap) {
            const side = dx === 0 ? -b.facing : Math.sign(dx);
            p.x = b.x + side * minGap;
            const { minX, maxX } = sim.bounds;
            if (p.x < minX + P.halfWidth || p.x > maxX - P.halfWidth) p.x = b.x - side * minGap; // cornered: pop out the other side
        }
    }

    return sim;
}
