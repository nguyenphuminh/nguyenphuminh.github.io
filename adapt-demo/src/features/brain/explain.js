// Plain-words explanations of what the boss has learned (BRD 2.2.6, 2.2.7).
// Every line is computed from the saved habit profile or the attempt's counters; nothing is invented.
import { MOVES } from "../combat/index.js";

const pct = (v) => `${Math.round(v * 100)}%`;

/** Lines for the boss memory screen, strongest first. */
export function habitLines(habits) {
    const v = habits.values();
    const seen = habits.attacksSeen();
    if (seen < 4) return [{ text: "I have barely seen you fight. Come closer.", strength: 0 }];
    const lines = [];
    const add = (strength, text) => lines.push({ strength, text });

    if (v.rollRate >= 0.55) add(v.rollRate, `You answer ${pct(v.rollRate)} of my attacks with a roll.`);
    if (v.earlyRollRate >= 0.5) add(v.earlyRollRate + 0.1, `${pct(v.earlyRollRate)} of your rolls start the moment my blade rises.`);
    if (v.rollTowardRate >= 0.6) add(v.rollTowardRate, `You roll into me, not away: ${pct(v.rollTowardRate)} of your rolls.`);
    if (v.rollTowardRate <= 0.25 && v.rollRate >= 0.3) add(1 - v.rollTowardRate, `You roll away from me ${pct(1 - v.rollTowardRate)} of the time.`);
    if (v.parryRate >= 0.3) add(v.parryRate + 0.1, `You try to parry ${pct(v.parryRate)} of my parryable strikes; ${pct(v.parrySuccessRate)} of those parries land.`);
    if (v.jumpRate >= 0.3) add(v.jumpRate, `You leap at ${pct(v.jumpRate)} of my attacks.`);
    if (v.distance >= 0.5) add(v.distance, `You keep your distance: about ${Math.round(v.distance * 240)} paces from my blade.`);
    if (v.distance <= 0.2) add(1 - v.distance, `You fight at arm's length, about ${Math.round(v.distance * 240)} paces from me.`);
    if (v.healAtRange >= 0.65) add(v.healAtRange, `You drink from afar: ${pct(v.healAtRange)} of your heals.`);
    if (v.healAtRange <= 0.3) add(1 - v.healAtRange, `You heal within my reach ${pct(1 - v.healAtRange)} of the time.`);
    if (v.punishRate >= 0.45) add(v.punishRate, `You punish ${pct(v.punishRate)} of my recoveries.`);
    if (v.aggression >= 0.6) add(v.aggression, `${pct(v.aggression)} of what you do is attack.`);
    if (v.reactionTime <= 0.35) add(1 - v.reactionTime, `You react within ${Math.round(v.reactionTime * 800)} ms of my first movement.`);

    if (lines.length === 0) add(0, "Your habits are balanced. I am still watching.");
    return lines.sort((a, b) => b.strength - a.strength);
}

/** One line for the Fallen screen: the most notable thing the boss saw during this attempt. */
export function attemptLesson({ counters: c, moveStats }) {
    const options = [];
    if (c.rolls >= 3 && c.earlyRolls / c.rolls >= 0.5) options.push([c.earlyRolls / c.rolls + 0.2, `It saw you roll early ${c.earlyRolls} of ${c.rolls} times.`]);
    if (c.parries >= 3) options.push([c.parries / Math.max(1, c.parryable) + 0.1, `It saw you try ${c.parries} parries. ${c.parryHits} worked.`]);
    if (c.jumps >= 3) options.push([c.jumps / Math.max(1, c.attacks), `It saw you jump ${c.jumps} times against ${c.attacks} attacks.`]);
    if (c.heals >= 2 && c.farHeals / c.heals >= 0.5) options.push([0.5, `It saw you heal at range ${c.farHeals} of ${c.heals} times.`]);
    if (c.recoveries >= 3) options.push([c.punishes / c.recoveries, `You punished ${c.punishes} of its ${c.recoveries} recoveries.`]);
    let best = null;
    for (const [id, s] of Object.entries(moveStats)) if (s.hits > 0 && (!best || s.hits > best[1].hits)) best = [id, s];
    if (best) options.push([0.45, `${MOVES[best[0]].label} struck you ${best[1].hits} time${best[1].hits === 1 ? "" : "s"}.`]);
    if (options.length === 0) return "It watched you closely.";
    options.sort((a, b) => b[0] - a[0]);
    return options[0][1];
}

/** Moves whose preference changed most since before the boss met the player. */
export function preferenceChanges(before, now, limit = 5) {
    return Object.keys(now)
        .map((id) => ({ id, label: MOVES[id].label, before: before[id], now: now[id], ratio: now[id] / Math.max(before[id], 1e-6) }))
        .sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio)))
        .slice(0, limit);
}
