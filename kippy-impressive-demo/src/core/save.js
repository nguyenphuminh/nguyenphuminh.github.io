import { DEPTHS } from "../config/depths.js";

// Progress storage. Storage can be blocked, corrupted, or written by another page on the
// same origin, so every access is guarded and loaded data is rebuilt field by field.
const KEY = "abyssal-choir/run";
const VOICES = DEPTHS.reduce((n, d) => n + d.beacons + (d.heart ? 1 : 0), 0);
const STATS = ["time", "songs", "heard", "lightsLost", "pearlsThrown"];

const count = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);

// A clean run object, or null when the stored data can't describe a real run
export function sanitizeRun(raw) {
    if (!raw || typeof raw !== "object") return null;
    const { depth, seed, voices = [], stats = {}, taught = {} } = raw;
    if (!Number.isInteger(depth) || depth < 0 || depth >= DEPTHS.length) return null;
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return null;
    // Voices are always 0, 1, 2... in the order beacons were woken
    if (!Array.isArray(voices) || voices.length > VOICES || voices.some((v, i) => v !== i)) return null;

    const run = { depth, seed, voices: [...voices], stats: {}, taught: {} };
    for (const k of STATS) run.stats[k] = count(stats?.[k]);
    if (taught && typeof taught === "object") {
        for (const [k, v] of Object.entries(taught)) if (/^[a-z]+$/.test(k) && v === true) run.taught[k] = true;
    }
    return run;
}

export function loadRun() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? sanitizeRun(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

export function saveRun(run) {
    try {
        localStorage.setItem(KEY, JSON.stringify(run));
    } catch {
        // Not saving is fine
    }
}

export function clearRun() {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // Ignore
    }
}
