// Control settings (BRD 2.2.2.8): two keys per player action, saved on the device.
export const PLAYER_ACTIONS = [
    { id: "left", label: "Move left" },
    { id: "right", label: "Move right" },
    { id: "jump", label: "Jump" },
    { id: "roll", label: "Roll" },
    { id: "light", label: "Light attack" },
    { id: "heavy", label: "Heavy attack" },
    { id: "parry", label: "Parry" },
    { id: "heal", label: "Heal" },
    { id: "interact", label: "Interact" },
];

export const DEFAULT_CONTROLS = Object.freeze({
    left: ["KeyA", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
    jump: ["Space", "KeyW"],
    roll: ["ShiftLeft", "ShiftRight"],
    light: ["KeyJ", null],
    heavy: ["KeyK", null],
    parry: ["KeyL", null],
    heal: ["KeyE", null],
    interact: ["KeyF", null],
});

export const RESERVED_KEYS = new Set(["Escape"]); // pause, back and skipping cutscenes
const SETTINGS_KEY = "adapt.settings.v1";

export const copyControls = (keys) => Object.fromEntries(PLAYER_ACTIONS.map(({ id }) => [id, [...keys[id]]]));

/** Valid when every action has one or two distinct, non-reserved keys and no key serves two actions. */
export function isValidControls(keys) {
    if (!keys || typeof keys !== "object") return false;
    const seen = new Set();
    for (const { id } of PLAYER_ACTIONS) {
        const slots = keys[id];
        if (!Array.isArray(slots) || slots.length !== 2) return false;
        const codes = slots.filter((c) => c !== null);
        if (codes.length === 0) return false;
        for (const c of codes) {
            if (typeof c !== "string" || RESERVED_KEYS.has(c) || seen.has(c)) return false;
            seen.add(c);
        }
    }
    return true;
}

export function loadControls(storage) {
    try {
        const saved = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? "null");
        if (isValidControls(saved?.keys)) return copyControls(saved.keys);
    } catch {
        // damaged settings: fall back to the defaults
    }
    return copyControls(DEFAULT_CONTROLS);
}

export function saveControls(storage, keys) {
    try {
        storage?.setItem(SETTINGS_KEY, JSON.stringify({ keys }));
    } catch {
        // storage unavailable: the choice lasts for this session
    }
}

/**
 * Puts `code` in an action's slot. A key used by another action is taken from it and that action receives
 * this slot's previous key instead (a swap), so no key serves two actions and no action is left without a key.
 * Returns { keys, error } — keys unchanged when the change is refused.
 */
export function assignKey(keys, actionId, slot, code) {
    if (RESERVED_KEYS.has(code)) return { keys, error: "Escape is reserved for pausing and going back." };
    const next = copyControls(keys);
    const previous = next[actionId][slot];
    if (previous === code) return { keys: next, error: null };
    let owner = null;
    for (const { id } of PLAYER_ACTIONS) {
        const s = next[id].indexOf(code);
        if (s >= 0) owner = { id, slot: s };
    }
    next[actionId][slot] = code;
    if (owner) next[owner.id][owner.slot] = previous;
    if (!isValidControls(next)) {
        const label = PLAYER_ACTIONS.find((a) => a.id === owner?.id)?.label ?? "Another action";
        return { keys, error: `${label} would be left without a key.` };
    }
    return { keys: next, error: null };
}

/** Removes a slot's key, unless it is the action's only key. */
export function clearKey(keys, actionId, slot) {
    const next = copyControls(keys);
    next[actionId][slot] = null;
    if (!isValidControls(next)) return { keys, error: "Every action needs at least one key." };
    return { keys: next, error: null };
}

const NAMED = {
    Space: "Space", Enter: "Enter", Backspace: "Backspace", Tab: "Tab", Escape: "Esc",
    ShiftLeft: "L-Shift", ShiftRight: "R-Shift", ControlLeft: "L-Ctrl", ControlRight: "R-Ctrl", AltLeft: "L-Alt", AltRight: "R-Alt",
    ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down",
    Comma: ",", Period: ".", Slash: "/", Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=", Backquote: "`",
};

/** A short readable name for a physical key code. */
export function keyLabel(code) {
    if (!code) return "-";
    if (NAMED[code]) return NAMED[code];
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
    return code;
}

/** The label of an action's first key, for hints such as "[F] Rest". */
export const actionKeyLabel = (keys, actionId) => keyLabel(keys[actionId].find((c) => c !== null));
