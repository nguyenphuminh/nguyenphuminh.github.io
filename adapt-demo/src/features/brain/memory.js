// Persistent memory (BRD 2.2.4.4): the brain's learning plus attempt history, saved on the player's device.
export const MEMORY_KEY = "adapt.memory.v1";

export function freshMemory() {
    return {
        version: 1,
        brain: null,
        stats: { attempts: 0, deaths: 0, victories: 0, quits: 0, bestBossHpPct: 100 },
    };
}

/** Reads memory; anything missing or damaged gives a fresh memory instead of an error. */
export function loadMemory(storage) {
    try {
        const raw = storage?.getItem(MEMORY_KEY);
        if (!raw) return freshMemory();
        const data = JSON.parse(raw);
        if (!data || data.version !== 1 || typeof data.stats !== "object") return freshMemory();
        const fresh = freshMemory();
        for (const k of Object.keys(fresh.stats)) if (!Number.isFinite(data.stats[k])) data.stats[k] = fresh.stats[k];
        return data;
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
