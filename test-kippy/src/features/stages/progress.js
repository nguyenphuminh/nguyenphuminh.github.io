import { loadSave, writeSave } from "../../shared/store.js";
import { STAGES } from "./stages.js";

// Best runs per stage and cultivator: save.records[stageId][characterId].
// Saves from before stages existed kept records per cultivator only; those
// belonged to the first stage and are moved under it.
export function loadProgress() {
    const save = loadSave();
    const records = save.records ?? {};
    const legacy = Object.values(records).some(r => r && typeof r.bestTime === "number");
    if (legacy) {
        save.records = { [STAGES[0].id]: records };
        writeSave(save);
    }
    save.records ??= {};
    return save;
}

export const recordFor = (save, stageId, characterId) => save.records?.[stageId]?.[characterId];

export function isUnlocked(save, index) {
    if (index === 0) return true;
    return Object.values(save.records?.[STAGES[index - 1].id] ?? {}).some(r => r.ascended);
}

export const ascendedCount = (save, characterId) => STAGES.filter(s => recordFor(save, s.id, characterId)?.ascended).length;

// Returns whether this beat the old best, and the stage this run newly unlocked (if any).
export function recordRun(stageId, characterId, run) {
    const save = loadProgress();
    const index = STAGES.findIndex(s => s.id === stageId);
    const nextWasLocked = index + 1 < STAGES.length && !isUnlocked(save, index + 1);
    const old = recordFor(save, stageId, characterId) ?? {};
    const stage = (save.records[stageId] ??= {});
    stage[characterId] = {
        bestTime: Math.max(old.bestTime ?? 0, run.time),
        bestKills: Math.max(old.bestKills ?? 0, run.kills),
        bestLevel: Math.max(old.bestLevel ?? 0, run.level),
        bestRealm: Math.max(old.bestRealm ?? 0, run.realm),
        ascended: Boolean(old.ascended || run.won),
    };
    writeSave(save);
    return {
        newRecord: run.time > (old.bestTime ?? 0) || (run.won && !old.ascended),
        unlocked: nextWasLocked && run.won ? STAGES[index + 1] : null,
    };
}
