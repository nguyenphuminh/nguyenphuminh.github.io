// Persistent memory (BRD 2.2.4.4, 2.2.13): the shared habit profile, every boss's learning and record,
// and the current journey. Saved on the player's device.
export const MEMORY_KEY = "adapt.memory.v1"; // the key is kept so earlier saves are found and migrated
const VERSION = 2;

export const freshBossRecord = () => ({ online: null, attempts: 0, victories: 0, quits: 0, deaths: 0 });

export function freshJourney() {
    return { started: false, completed: false, awaitingEnding: false, area: "outerWard", defeated: [], seen: [], time: 0, falls: 0, attempts: {} };
}

export function freshMemory() {
    return { version: VERSION, habits: null, bosses: {}, stats: { falls: 0, journeysCompleted: 0 }, journey: freshJourney() };
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

// A save from the single-boss version: keep the habits and the Mirrorwright's learning; the journey starts over.
function migrateV1(old) {
    const m = freshMemory();
    m.habits = old.brain?.habits ?? null;
    m.bosses.mirrorwright = {
        ...freshBossRecord(),
        online: old.brain?.online ?? null,
        attempts: num(old.stats?.attempts),
        victories: num(old.stats?.victories),
        quits: num(old.stats?.quits),
        deaths: num(old.stats?.deaths),
    };
    m.stats.falls = num(old.stats?.deaths);
    return m;
}

function sanitize(data) {
    const m = freshMemory();
    m.habits = isObject(data.habits) ? data.habits : null;
    if (isObject(data.bosses)) {
        for (const [id, rec] of Object.entries(data.bosses)) {
            if (!isObject(rec)) continue;
            m.bosses[id] = { ...freshBossRecord(), online: isObject(rec.online) ? rec.online : null };
            for (const k of ["attempts", "victories", "quits", "deaths"]) m.bosses[id][k] = num(rec[k]);
        }
    }
    if (isObject(data.stats)) for (const k of Object.keys(m.stats)) m.stats[k] = num(data.stats[k]);
    if (isObject(data.journey)) {
        const j = data.journey;
        m.journey = {
            started: Boolean(j.started), completed: Boolean(j.completed), awaitingEnding: Boolean(j.awaitingEnding),
            area: typeof j.area === "string" ? j.area : "outerWard",
            defeated: Array.isArray(j.defeated) ? j.defeated.filter((x) => typeof x === "string") : [],
            seen: Array.isArray(j.seen) ? j.seen.filter((x) => typeof x === "string") : [],
            time: num(j.time), falls: num(j.falls),
            attempts: isObject(j.attempts) ? Object.fromEntries(Object.entries(j.attempts).map(([k, v]) => [k, num(v)])) : {},
        };
    }
    return m;
}

/** Reads memory; anything missing or damaged gives a fresh memory instead of an error. */
export function loadMemory(storage) {
    try {
        const raw = storage?.getItem(MEMORY_KEY);
        if (!raw) return freshMemory();
        const data = JSON.parse(raw);
        if (!isObject(data)) return freshMemory();
        if (data.version === 1 && isObject(data.stats)) return migrateV1(data);
        if (data.version !== VERSION) return freshMemory();
        return sanitize(data);
    } catch {
        return freshMemory();
    }
}

export function saveMemory(storage, memory) {
    try {
        storage?.setItem(MEMORY_KEY, JSON.stringify(memory));
        return true;
    } catch {
        return false;
    }
}

export function forgetMemory(storage) {
    try {
        storage?.removeItem(MEMORY_KEY);
    } catch {
        // storage unavailable: nothing to wipe
    }
    return freshMemory();
}
