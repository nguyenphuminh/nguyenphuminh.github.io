// Per-browser save data (best runs, mute). Storage can be unavailable, so it never throws.
const KEY = "immortal-ascension.v1";

export function loadSave() {
    try {
        return JSON.parse(localStorage.getItem(KEY)) ?? {};
    } catch {
        return {};
    }
}

export function writeSave(data) {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
        // Private mode or blocked storage: progress just isn't remembered.
    }
}
