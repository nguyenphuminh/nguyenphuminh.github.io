// The combat simulation shared by the browser game and the offline trainer.
// Pure and deterministic for a given seed: no engine, DOM or wall-clock access.
import { createRng } from "../../shared/rng.js";
import { DT, FLOOR_Y, PLAYER as P } from "./constants.js";
import { ENEMIES } from "./enemies/index.js";
import {
    createPlayer, damagePlayer, deflectPlayer, grabPlayer, isParryActive, isRollInvulnerable,
    playerAttackBox, playerHurtbox, respawnPlayer, restPlayer, updatePlayer,
} from "./player.js";
import {
    addStagger, breakGuard, cancelHealIfDrinking, counterAttack, createEnemy, currentStage, damageEnemy, enemyHurtbox,
    isBlocking, isEnemyHittable, isEnemyInvulnerable, reactToHit, updateEnemy, wakeEnemy,
} from "./enemy.js";
import { updateHazards } from "./hazards.js";

const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const PLAYER_MODES = {
    idle: "neutral", run: "neutral", rest: "neutral", jump: "air", fall: "air",
    light: "attack", heavy: "heavy", roll: "roll", parry: "parry", heal: "heal",
    hurt: "hurt", grabbed: "hurt", deflected: "hurt", dead: "dead",
};

export const NO_INTENT = Object.freeze({
    moveX: 0, jump: false, jumpHeld: false, roll: false, light: false, heavy: false, parry: false, heal: false,
});

/**
 * @param {object} o
 * @param {number} [o.seed]
 * @param {{minX:number,maxX:number,floorY?:number}} o.bounds
 * @param {number} o.playerX
 * @param {{id:string,x:number}|null} [o.boss]   the area's boss (starts dormant), or null
 * @param {{id:string,x:number}[]} [o.mobs]      mob posts
 * @param {(view)=>string} [o.controller]        picks the boss's next move when it is free
 */
export function createSim({ seed = 1, bounds, playerX, boss = null, mobs = [], controller = null }) {
    const floorY = bounds.floorY ?? FLOOR_Y;
    const mobArea = { minX: bounds.minX, maxX: bounds.maxX }; // mobs live where the simulation starts: the approach
    let nextUid = 1;
    const sim = {
        rng: createRng(seed),
        time: 0,
        bounds: { minX: bounds.minX, maxX: bounds.maxX, floorY },
        player: createPlayer(playerX, floorY),
        boss: null,
        mobs: [],
        enemies: [],
        hazards: [],
        nextId: 1,
        outcome: null, // null | "playerDead" | "bossDead"
        controller,
        events: [],

        step(intent = NO_INTENT) {
            sim.events = [];
            sim.time += DT;
            updatePlayer(sim.player, intent, playerContext, DT);
            for (const e of sim.enemies) updateEnemy(sim, e, DT);
            updateHazards(sim, DT);
            resolvePlayerAttack();
            separateBodies();
            return sim.events;
        },

        enemyByUid: (uid) => sim.enemies.find((e) => e.uid === uid),

        // Called by enemy stages and hazards. Returns hit | parried | grab | dodged | null.
        tryHitPlayer(box, hit, moveId, sourceX, source) {
            const p = sim.player;
            if (p.state === "dead" || p.state === "grabbed") return null;
            if (!overlaps(box, playerHurtbox(p))) return null;
            const from = { uid: source.uid, isBoss: source.isBoss };
            if (isRollInvulnerable(p)) {
                sim.events.push({ type: "dodge", moveId, sourceUid: from.uid, isBoss: from.isBoss });
                return "dodged";
            }
            if (p.invuln > 0) return null;
            const facesSource = Math.abs(sourceX - p.x) < 2 || Math.sign(sourceX - p.x) === p.facing;
            if (hit.parryable && isParryActive(p) && facesSource) {
                p.stateTime = Math.max(p.stateTime, P.parry.duration - 0.1);
                sim.events.push({ type: "parry", moveId, sourceUid: from.uid, isBoss: from.isBoss, x: p.x + p.facing * 10, y: p.y - 16 });
                return "parried";
            }
            if (hit.grab) {
                grabPlayer(p, sim.events);
                return "grab";
            }
            damagePlayer(p, hit.damage, Math.sign(p.x - sourceX) || 1, sim.events, moveId, hit.knockback, source);
            if (p.state === "dead") sim.outcome = "playerDead";
            return "hit";
        },

        addStagger: (enemy, amount) => addStagger(sim, enemy, amount),

        /** Starts the boss fight (the boss rises). */
        wakeBoss: () => wakeEnemy(sim.boss),

        setBounds(next) {
            sim.bounds.minX = next.minX;
            sim.bounds.maxX = next.maxX;
        },

        rest: () => restPlayer(sim.player),

        /** Brings every mob back to its post at full health (after resting or dying). */
        respawnMobs() {
            sim.mobs = mobs.map((m) => createEnemy(ENEMIES[m.id], m.x, floorY, nextUid++, mobArea));
            sim.enemies = sim.boss ? [sim.boss, ...sim.mobs] : [...sim.mobs];
            for (let i = sim.hazards.length - 1; i >= 0; i--) if (!sim.hazards[i].isBoss) sim.hazards.splice(i, 1);
        },

        /** Resets for a new attempt. The boss keeps nothing from the previous attempt; mobs return. */
        resetAttempt({ playerX }) {
            respawnPlayer(sim.player, playerX, floorY);
            if (boss) sim.boss = createEnemy(ENEMIES[boss.id], boss.x, floorY, sim.boss ? sim.boss.uid : nextUid++);
            sim.hazards.length = 0;
            sim.outcome = null;
            sim.respawnMobs();
        },

        /** Mobs that have noticed the knight and are close enough to stop them resting. */
        threatsNear(range) {
            return sim.mobs.filter((m) => m.state !== "dead" && m.aware && Math.abs(m.x - sim.player.x) < range);
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
                boss: sim.boss ? enemyView(sim.boss) : null,
                enemies: sim.enemies.map(enemyView),
                hazards: sim.hazards.map((h) => ({ kind: h.kind, x: h.x, y: h.y, dir: h.dir ?? 0, t: h.t, impactAt: h.impactAt ?? 0, isBoss: h.isBoss })),
            };
            return v;
        },
    };

    function enemyView(e) {
        const stage = currentStage(e);
        return {
            uid: e.uid, defId: e.def.id, isBoss: e.isBoss, aware: e.aware,
            x: e.x, y: e.y, facing: e.facing, airborne: e.airborne,
            hp: e.hp, maxHp: e.maxHp, stagger: e.stagger, maxStagger: e.maxStagger, phase: e.phase, heals: e.heals,
            state: e.state, stateTime: e.stateTime,
            actionId: e.action ? e.action.id : null, // the enemy's own knowledge; bots must use anim
            anim: stage ? stage.anim[0] : null, // what a player sees: the animation being played
            animSegment: stage ? stage.anim[1] ?? null : null,
            stagePart: stage ? stage.part : null,
            stageIndex: e.action ? e.action.stageIndex : -1,
            stageTime: e.action ? e.action.stageTime : 0,
            stageDur: e.action ? e.action.stageDur : 0,
            telegraph: stage ? stage.telegraph ?? null : null,
            leapTargetX: e.action && e.action.data.toX !== undefined ? e.action.data.toX : null,
        };
    }

    // The nearest enemy that is engaging the knight (an awake boss or an aware mob).
    function nearestThreat(p) {
        let best = null;
        for (const e of sim.enemies) {
            if (e.state === "dead" || e.state === "dormant" || (!e.isBoss && !e.aware)) continue;
            if (!best || Math.abs(e.x - p.x) < Math.abs(best.x - p.x)) best = e;
        }
        return best;
    }

    const playerContext = {
        get events() {
            return sim.events;
        },
        get bounds() {
            return sim.bounds;
        },
        towardBoss(p, action) {
            const target = nearestThreat(p);
            if (!target) return false;
            const dir = Math.sign(target.x - p.x) || 1;
            return action === "roll" ? p.rollDir === dir : p.facing === dir;
        },
    };

    function resolvePlayerAttack() {
        const p = sim.player;
        const atk = playerAttackBox(p);
        if (!atk) return;
        for (const e of sim.enemies) {
            if (!isEnemyHittable(e) || p.attackHitIds.has(e.uid) || isEnemyInvulnerable(e)) continue;
            if (!overlaps(atk.box, enemyHurtbox(e))) continue;
            p.attackHitIds.add(e.uid);
            p.attackHit = true;
            e.aware = true;
            if (currentStage(e)?.parryStance) {
                deflectPlayer(p, sim.events, e); // turned aside: no damage, the knight recoils
                counterAttack(sim, e);
                return;
            }
            const frontal = Math.sign(p.x - e.x) === e.facing;
            if (e.def.shield && e.state !== "guardBroken" && frontal) {
                if (atk.kind === "light") {
                    sim.events.push({ type: "enemyBlocked", uid: e.uid, x: e.x + e.facing * e.def.halfWidth, y: e.y - e.def.height / 2 });
                    continue;
                }
                breakGuard(sim, e); // a heavy attack breaks the guard and still lands
            }
            let damage = atk.def.damage;
            let critical = false;
            if (e.state === "staggered" && !e.criticalTaken) {
                critical = true;
                damage = e.def.critical[atk.kind];
                e.criticalTaken = true;
                e.stateTime = Math.max(e.stateTime, e.def.stagger.staggeredTime - e.def.stagger.afterCritical);
            }
            sim.events.push({ type: "enemyHit", uid: e.uid, isBoss: e.isBoss, damage, kind: atk.kind, critical, x: e.x, y: e.y - e.def.height / 2 });
            if (!critical) addStagger(sim, e, atk.def.stagger);
            cancelHealIfDrinking(sim, e); // before the damage, which may also start a phase change
            damageEnemy(sim, e, damage);
            reactToHit(sim, e);
        }
    }

    // The player cannot walk through solid enemies, but can roll through them.
    function separateBodies() {
        const p = sim.player;
        if (!p.grounded || p.state === "roll" || p.state === "grabbed" || p.state === "dead") return;
        for (const e of sim.enemies) {
            if (!isBlocking(e)) continue;
            const minGap = e.def.halfWidth + P.halfWidth;
            const dx = p.x - e.x;
            if (Math.abs(dx) >= minGap) continue;
            const side = dx === 0 ? -e.facing : Math.sign(dx);
            p.x = e.x + side * minGap;
            const { minX, maxX } = sim.bounds;
            if (p.x < minX + P.halfWidth || p.x > maxX - P.halfWidth) p.x = e.x - side * minGap; // cornered: pop out the other side
        }
    }

    if (boss) sim.boss = createEnemy(ENEMIES[boss.id], boss.x, floorY, nextUid++);
    sim.respawnMobs();
    return sim;
}
