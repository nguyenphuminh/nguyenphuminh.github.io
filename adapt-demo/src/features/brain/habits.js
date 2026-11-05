// Habit profile (BRD 2.2.4.1): running statistics of the player's visible behaviour, shared by all bosses and fed
// by boss fights and mob encounters alike. Each habit is a decayed ratio, so it follows the player as they change,
// and it persists across attempts and journeys.

// name: [prior, per-sample decay]
const HABITS = {
    rollRate: [0.4, 0.96], // rolls per boss attack
    earlyRollRate: [0.35, 0.96], // share of rolls started in the first part of a wind-up
    rollTowardRate: [0.4, 0.96], // share of rolls toward the boss
    parryRate: [0.12, 0.96], // parry attempts per parryable attack
    parrySuccessRate: [0.35, 0.95], // successful parries per attempt
    jumpRate: [0.12, 0.96], // jumps per boss attack
    reactionTime: [0.5, 0.96], // time to first defensive action, 0..1 of 0.8 s
    distance: [0.35, 0.99], // typical distance kept, 0..1 of 240 px
    aggression: [0.4, 0.97], // share of the player's actions that are attacks
    healAtRange: [0.5, 0.9], // share of heals started far from the boss
    punishRate: [0.3, 0.95], // share of boss recoveries the player punished
};
export const HABIT_NAMES = Object.keys(HABITS);
const PRIOR_WEIGHT = 1.5;
const EARLY_FRACTION = 0.6;
const FAR = 110;

const newCounters = () => ({ attacks: 0, rolls: 0, earlyRolls: 0, towardRolls: 0, parries: 0, parryHits: 0, parryable: 0, jumps: 0, heals: 0, farHeals: 0, recoveries: 0, punishes: 0 });

export function createHabitProfile(saved = null) {
    const stats = {};
    for (const name of HABIT_NAMES) {
        const s = saved?.stats?.[name];
        stats[name] = { num: Number.isFinite(s?.num) ? s.num : 0, den: Number.isFinite(s?.den) ? s.den : 0 };
    }
    let attacksSeen = Number.isFinite(saved?.attacksSeen) ? saved.attacksSeen : 0;
    let window = null; // the boss attack currently being watched
    let sampleClock = 0;
    let attempt = newCounters();

    function sample(name, x) {
        const s = stats[name];
        const decay = HABITS[name][1];
        s.num = s.num * decay + x;
        s.den = s.den * decay + 1;
    }

    function value(name) {
        const s = stats[name];
        return (s.num + HABITS[name][0] * PRIOR_WEIGHT) / (s.den + PRIOR_WEIGHT);
    }

    function closeWindow() {
        const w = window;
        window = null;
        if (!w) return;
        attacksSeen += 1;
        attempt.attacks += 1;
        sample("rollRate", w.rolled ? 1 : 0);
        sample("jumpRate", w.jumped ? 1 : 0);
        if (w.rolled) {
            sample("earlyRollRate", w.earlyRoll ? 1 : 0);
            sample("rollTowardRate", w.towardRoll ? 1 : 0);
        }
        if (w.parryable) {
            attempt.parryable += 1;
            sample("parryRate", w.parried ? 1 : 0);
        }
        if (w.parried) sample("parrySuccessRate", w.parrySuccess ? 1 : 0);
        if (w.reaction !== null) sample("reactionTime", Math.min(1, w.reaction / 0.8));
        if (!w.parrySuccess && w.sawRecovery) {
            attempt.recoveries += 1;
            if (w.punished) attempt.punishes += 1;
            sample("punishRate", w.punished ? 1 : 0);
        }
    }

    return {
        /** Feed one fixed step: the visible view after the step and the events it produced. */
        observe(view, events, dt) {
            const p = view.player;
            // The enemy the knight is dealing with: an awake boss, or the nearest mob that has noticed them.
            let focus = null;
            for (const e of view.enemies ?? (view.boss ? [view.boss] : [])) {
                if (e.state === "dead" || e.state === "dormant" || (!e.isBoss && !e.aware)) continue;
                if (!focus || Math.abs(e.x - p.x) < Math.abs(focus.x - p.x)) focus = e;
            }
            const dist = focus ? Math.abs(focus.x - p.x) : Infinity;

            sampleClock += dt;
            if (sampleClock >= 0.25 && focus && dist < 300 && p.mode !== "dead") {
                sampleClock = 0;
                sample("distance", Math.min(1, dist / 240));
            }
            if (window) {
                const source = (view.enemies ?? [view.boss]).find((e) => e && e.uid === window.uid);
                if (source && source.stagePart === "recovery") window.sawRecovery = true;
            }

            for (const e of events) {
                if (e.type === "enemyActionStart") {
                    if (e.kind !== "attack") continue;
                    closeWindow();
                    window = {
                        uid: e.uid, start: view.time, firstWindup: e.firstWindup, parryable: e.telegraph === "parryable",
                        rolled: false, earlyRoll: false, towardRoll: false, jumped: false, parried: false, parrySuccess: false,
                        reaction: null, sawRecovery: false, punished: false,
                    };
                } else if (e.type === "enemyActionEnd") {
                    if (window && e.uid === window.uid) closeWindow();
                } else if (e.type === "playerAction") {
                    const isAttack = e.action === "light" || e.action === "heavy";
                    if (e.action !== "jump") sample("aggression", isAttack ? 1 : 0);
                    if (e.action === "heal" && focus && dist < 300) {
                        attempt.heals += 1;
                        const far = dist > FAR;
                        if (far) attempt.farHeals += 1;
                        sample("healAtRange", far ? 1 : 0);
                    }
                    if (!window) continue;
                    const elapsed = view.time - window.start;
                    const defensive = e.action === "roll" || e.action === "parry" || e.action === "jump";
                    if (defensive && window.reaction === null && !window.sawRecovery) window.reaction = elapsed;
                    if (e.action === "roll" && !window.rolled && !window.sawRecovery) {
                        window.rolled = true;
                        window.earlyRoll = elapsed < window.firstWindup * EARLY_FRACTION;
                        window.towardRoll = e.toward;
                        attempt.rolls += 1;
                        if (window.earlyRoll) attempt.earlyRolls += 1;
                        if (window.towardRoll) attempt.towardRolls += 1;
                    } else if (e.action === "parry" && !window.parried && !window.sawRecovery) {
                        window.parried = true;
                        attempt.parries += 1;
                    } else if (e.action === "jump" && !window.jumped && !window.sawRecovery) {
                        window.jumped = true;
                        attempt.jumps += 1;
                    }
                } else if (e.type === "parry" && window && e.sourceUid === window.uid) {
                    window.parrySuccess = true;
                    attempt.parryHits += 1;
                } else if (e.type === "enemyHit" && window && window.sawRecovery && e.uid === window.uid) {
                    window.punished = true;
                }
            }
        },

        value,
        values: () => Object.fromEntries(HABIT_NAMES.map((n) => [n, value(n)])),
        /** How much evidence backs the profile, 0..1. */
        familiarity: () => Math.min(1, attacksSeen / 25),
        attacksSeen: () => attacksSeen,
        /** Counters for the current attempt only (for the Fallen screen line). */
        attemptCounters: () => ({ ...attempt }),
        startAttempt() {
            window = null;
            attempt = newCounters();
        },
        endAttempt: closeWindow,
        snapshot: () => ({ stats: JSON.parse(JSON.stringify(stats)), attacksSeen }),
    };
}
