// Online learner (BRD 2.2.4.3): learns how each move actually turns out against this player.
// A contextual bandit on each move's immediate outcome (damage dealt, minus damage taken and parries
// suffered while the move played out). Corrections are centred on the player's average outcome, so the
// learner only shifts preferences between moves; it never drifts the whole policy.
//   general:   how well move a works against this player overall
//   situation: how well move a works in a coarse kind of situation (distance band × player action × phase)
import { ACTIONS } from "../combat/index.js";
import { clamp } from "../../shared/math.js";

const MODE_GROUP = { neutral: 0, hurt: 0, dead: 0, attack: 1, heavy: 1, roll: 2, parry: 2, heal: 3, air: 4 };
export const BUCKET_COUNT = 3 * 5 * 2;
const A = ACTIONS.length;
const GAIN = 1.5;
const LIMIT = 0.6;

export function bucketOf(view) {
    const d = Math.abs(view.player.x - view.boss.x);
    const band = d < 60 ? 0 : d < 140 ? 1 : 2;
    return (band * 5 + (MODE_GROUP[view.player.mode] ?? 0)) * 2 + (view.boss.phase - 1);
}

const restore = (arr, length) =>
    Array.isArray(arr) && arr.length === length && arr.every(Number.isFinite) ? Float64Array.from(arr) : new Float64Array(length);

export function createOnlineLearner(saved = null) {
    const s = {
        gMean: restore(saved?.gMean, A),
        gN: restore(saved?.gN, A),
        bMean: restore(saved?.bMean, BUCKET_COUNT * A),
        bN: restore(saved?.bN, BUCKET_COUNT * A),
        base: restore(saved?.base, 2), // [mean, count] over all moves
        bBase: restore(saved?.bBase, BUCKET_COUNT * 2),
    };
    const step = (count, floor) => Math.max(1 / count, floor);

    return {
        correction(bucket, a) {
            const i = bucket * A + a;
            const general = (s.gN[a] / (s.gN[a] + 4)) * (s.gMean[a] - s.base[0]);
            const local = (s.bN[i] / (s.bN[i] + 3)) * (s.bMean[i] - s.bBase[bucket * 2]);
            return clamp(GAIN * (general + local), -LIMIT, LIMIT);
        },
        /** Records the outcome of move a, chosen in situation bucket. */
        update(bucket, a, outcome) {
            const i = bucket * A + a;
            s.gN[a] += 1;
            s.gMean[a] += (outcome - s.gMean[a]) * step(s.gN[a], 0.08);
            s.bN[i] += 1;
            s.bMean[i] += (outcome - s.bMean[i]) * step(s.bN[i], 0.15);
            s.base[1] += 1;
            s.base[0] += (outcome - s.base[0]) * step(s.base[1], 0.03);
            s.bBase[bucket * 2 + 1] += 1;
            s.bBase[bucket * 2] += (outcome - s.bBase[bucket * 2]) * step(s.bBase[bucket * 2 + 1], 0.05);
        },
        snapshot: () => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.from(v)])),
    };
}
