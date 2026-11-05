// Turns a visible view + habit profile into the policy network's input vector.
import { HABIT_NAMES } from "./habits.js";
import { clamp } from "../../shared/math.js";

const MODES = ["neutral", "attack", "heavy", "roll", "parry", "heal", "hurt"];
const MODE_INDEX = { neutral: 0, air: 0, attack: 1, heavy: 2, roll: 3, parry: 4, heal: 5, hurt: 6, dead: 6 };
export const SITUATION_SIZE = 13 + MODES.length;
export const FEATURE_SIZE = SITUATION_SIZE + HABIT_NAMES.length + 1;

export function encodeFeatures(view, habits, out = new Array(FEATURE_SIZE)) {
    const p = view.player;
    const b = view.boss;
    const { minX, maxX } = view.bounds;
    const dx = p.x - b.x;
    const towardBoss = -Math.sign(dx) || 1;
    let i = 0;

    out[i++] = Math.min(Math.abs(dx), 300) / 300;
    out[i++] = Math.abs(dx) < 60 ? 1 : 0;
    out[i++] = clamp((p.vx * towardBoss) / 92, -1, 1);
    out[i++] = p.grounded ? 0 : 1;
    out[i++] = clamp(p.vy / 300, -1, 1);
    for (let m = 0; m < MODES.length; m++) out[i++] = 0;
    out[i - MODES.length + (MODE_INDEX[p.mode] ?? 0)] = 1;
    out[i++] = p.hp / p.maxHp;
    out[i++] = p.stamina / p.maxStamina;
    out[i++] = p.heals / p.maxHeals;
    out[i++] = b.hp / b.maxHp;
    out[i++] = b.stagger / b.maxStagger;
    out[i++] = b.phase === 2 ? 1 : 0;
    out[i++] = 1 - clamp(Math.min(p.x - minX, maxX - p.x) / 80, 0, 1);
    const wallBehindBoss = dx >= 0 ? b.x - minX : maxX - b.x;
    out[i++] = 1 - clamp(wallBehindBoss / 80, 0, 1);

    for (const name of HABIT_NAMES) out[i++] = habits.value(name);
    out[i++] = habits.familiarity();
    return out;
}
