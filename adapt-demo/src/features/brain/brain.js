// A boss's adaptive brain (BRD 2.2.4): shared habit profile + the boss's pretrained policy + its online learner.
import { isActionAllowed } from "../combat/index.js";
import { createRng } from "../../shared/rng.js";
import { createHabitProfile } from "./habits.js";
import { encodeFeatures, FEATURE_SIZE } from "./features.js";
import { bucketOf, createOnlineLearner } from "./online.js";
import { stepReward } from "./reward.js";

export const BRAIN_DEFAULTS = { temperature: 0.06, epsilon: 0.03 };

/**
 * @param {object} o
 * @param {object} o.bossDef  the boss's definition (its moves and action order)
 * @param {object} o.habits   the shared habit profile (observed by its owner, read here)
 * @param {{scores:(f:number[])=>number[]}|null} [o.policy]  pretrained policy, or null to rely on online learning alone
 * @param {object|null} [o.online]  saved online-learner state for this boss
 */
export function createBrain({ bossDef, habits, policy = null, online: saved = null, seed = 1, options = {} }) {
    const cfg = { ...BRAIN_DEFAULTS, ...(bossDef.brain ?? {}), ...options };
    const ACTIONS = bossDef.actions;
    const A = ACTIONS.length;
    const online = createOnlineLearner(A, saved);
    const rng = createRng(seed);
    const features = new Array(FEATURE_SIZE);
    const q = new Float64Array(A);
    let pending = null; // last decision waiting for its outcome
    let reward = 0; // outcome of the pending move so far
    let moveStats = {};

    // Combined preference per move; moves not available in this phase get -Infinity.
    function evaluate(view, habitProfile = habits, learner = online) {
        encodeFeatures(view, habitProfile, features);
        const base = policy ? policy.scores(features) : null;
        const bucket = bucketOf(view);
        for (let a = 0; a < A; a++) {
            q[a] = isActionAllowed(bossDef, ACTIONS[a], view.boss.phase, view.boss) ? (base ? base[a] : 0) + learner.correction(bucket, a) : -Infinity;
        }
        return bucket;
    }

    function softmax(values, temperature) {
        let max = -Infinity;
        for (const v of values) if (v > max) max = v;
        const probs = new Float64Array(values.length);
        let sum = 0;
        for (let a = 0; a < values.length; a++) {
            probs[a] = values[a] === -Infinity ? 0 : Math.exp((values[a] - max) / temperature);
            sum += probs[a];
        }
        for (let a = 0; a < values.length; a++) probs[a] /= sum;
        return probs;
    }

    // The previous move's outcome is known once the boss is free again (or the fight ends).
    function learn() {
        if (!pending) return;
        online.update(pending.bucket, pending.action, reward);
        pending = null;
        reward = 0;
    }

    return {
        bossDef,

        /** Picks the boss's next move. Called only when the boss is free (between moves). */
        decide(view) {
            learn();
            const bucket = evaluate(view);
            const allowed = [];
            for (let a = 0; a < A; a++) if (q[a] !== -Infinity) allowed.push(a);
            let action;
            if (rng.next() < cfg.epsilon) {
                action = rng.pick(allowed);
            } else {
                const probs = softmax(q, cfg.temperature);
                let r = rng.next();
                action = allowed[allowed.length - 1];
                for (const a of allowed) {
                    r -= probs[a];
                    if (r <= 0) {
                        action = a;
                        break;
                    }
                }
            }
            pending = { bucket, action };
            const id = ACTIONS[action];
            (moveStats[id] ??= { uses: 0, hits: 0, damage: 0 }).uses += 1;
            return id;
        },

        /** Feed every fixed step of this boss's fight (rewards and move results; habits are fed by their owner). */
        observe(events, dt) {
            reward += stepReward(events, dt);
            for (const e of events) {
                if (e.type === "playerHit" && e.isBoss && e.moveId) {
                    const s = (moveStats[e.moveId] ??= { uses: 0, hits: 0, damage: 0 });
                    s.hits += 1;
                    s.damage += e.damage;
                }
            }
        },

        startAttempt() {
            pending = null;
            reward = 0;
            moveStats = {};
        },

        /** Closes the attempt (won, died or quit) and returns this boss's move results for it. */
        endAttempt() {
            learn();
            return { moveStats: { ...moveStats } };
        },

        /**
         * Probability of each move averaged over a fixed set of reference situations.
         * fresh = true gives the boss's preferences before it met this player.
         */
        preferences(fresh = false) {
            const habitProfile = fresh ? createHabitProfile() : habits;
            const learner = fresh ? createOnlineLearner(A) : online;
            const totals = new Float64Array(A);
            let count = 0;
            for (const dist of [30, 70, 120, 200]) {
                for (const mode of ["neutral", "attack", "roll", "heal"]) {
                    for (let phase = 1; phase <= (bossDef.phases ?? 1); phase++) {
                        evaluate(referenceView(bossDef, dist, mode, phase), habitProfile, learner);
                        const probs = softmax(q, cfg.temperature);
                        for (let a = 0; a < A; a++) totals[a] += probs[a];
                        count++;
                    }
                }
            }
            return Object.fromEntries(ACTIONS.map((id, a) => [id, totals[a] / count]));
        },

        moveLabel: (id) => bossDef.moves[id].label,
        snapshot: () => online.snapshot(),
    };
}

function referenceView(bossDef, dist, mode, phase) {
    const bossX = 300;
    const boss = {
        x: bossX, y: 228, facing: -1, hp: Math.round(bossDef.maxHp * (phase === 1 ? 0.8 : 0.35)), maxHp: bossDef.maxHp,
        stagger: 20, maxStagger: bossDef.stagger?.max ?? 100, phase, state: "ready", isBoss: true, heals: bossDef.heals ?? 0,
    };
    return {
        time: 0,
        bounds: { minX: 24, maxX: 456, floorY: 228 },
        player: {
            x: bossX - dist, y: 228, vx: 0, vy: 0, grounded: mode !== "air", facing: 1, state: mode, stateTime: 0, mode,
            combo: 0, hp: 70, maxHp: 100, stamina: 70, maxStamina: 100, heals: 2, maxHeals: 3,
        },
        boss,
        enemies: [boss],
        hazards: [],
    };
}
