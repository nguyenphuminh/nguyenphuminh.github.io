// Rebindable keys, one physical key (KeyboardEvent.code) per action, saved in the browser
const STORAGE_KEY = "abyssal-choir/keys";

export const ACTIONS = [
    { id: "up", label: "Swim up" },
    { id: "down", label: "Swim down" },
    { id: "left", label: "Swim left" },
    { id: "right", label: "Swim right" },
    { id: "sing", label: "Sing (hold, then let go)", mouse: "or left click" },
    { id: "glide", label: "Glide quietly (hold)" },
    { id: "dash", label: "Dash" },
    { id: "throw", label: "Throw a pearl", mouse: "or right click" },
    { id: "map", label: "Memory map (hold)" }
];

export const DEFAULTS = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", sing: "Space", glide: "ShiftLeft", dash: "KeyQ", throw: "KeyE", map: "Tab" };

// Esc always pauses and backs out of menus, so it can never be taken by an action
export const RESERVED = "Escape";

function defaultStorage() {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

function valid(keys) {
    const codes = Object.keys(DEFAULTS).map((a) => keys[a]);
    return codes.every((c) => typeof c === "string" && c && c !== RESERVED) && new Set(codes).size === codes.length;
}

export function createBindings(storage = defaultStorage()) {
    const keys = { ...DEFAULTS };

    try {
        const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
        const merged = { ...DEFAULTS, ...saved };
        // Only known actions are copied, so stray keys (or "__proto__") never reach the bindings
        if (saved && typeof saved === "object" && valid(merged)) for (const a of Object.keys(DEFAULTS)) keys[a] = merged[a];
    } catch {
        // Broken or blocked storage: keep the defaults
    }

    function save() {
        try {
            storage?.setItem(STORAGE_KEY, JSON.stringify(keys));
        } catch {
            // Not saving is fine
        }
    }

    // Taking a key that another action uses swaps the two, so keys stay unique
    function assign(action, code) {
        if (code === RESERVED || !(action in DEFAULTS)) return false;
        const other = Object.keys(keys).find((a) => a !== action && keys[a] === code);
        if (other) keys[other] = keys[action];
        keys[action] = code;
        save();
        return true;
    }

    function reset() {
        Object.assign(keys, DEFAULTS);
        save();
    }

    return {
        keys,
        assign,
        reset,
        down: (input, action) => input.isKeyDown(keys[action]),
        pressed: (input, action) => input.isKeyPressed(keys[action]),
        label: (action) => keyLabel(keys[action])
    };
}

const NAMED = {
    Space: "Space", Tab: "Tab", Enter: "Enter", Backspace: "Backspace", CapsLock: "Caps Lock",
    ShiftLeft: "Shift", ShiftRight: "Right Shift", ControlLeft: "Ctrl", ControlRight: "Right Ctrl",
    AltLeft: "Alt", AltRight: "Right Alt", MetaLeft: "Meta", MetaRight: "Right Meta",
    ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    Comma: ",", Period: ".", Slash: "/", Semicolon: ";", Quote: "'", Backquote: "`",
    BracketLeft: "[", BracketRight: "]", Backslash: "\\", Minus: "-", Equal: "="
};

// Short label printed on a keycap
export function keyLabel(code) {
    if (NAMED[code]) return NAMED[code];
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Numpad/.test(code)) return `Num ${code.slice(6)}`;
    return code;
}
