// Controller support (BRD 2.2.2.9): game controllers read through the browser's Gamepad API, using the
// "standard" button layout every major browser reports for Xbox, PlayStation and most other controllers.
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const STICK_DEADZONE = 0.35; // a slightly off-centre stick never moves the knight
const MENU_TILT = 0.6;
const TRIGGER_PULL = 0.5;

/** The fixed layout: player action → standard button. */
export const PAD_LAYOUT = Object.freeze({
    jump: BTN.A, roll: BTN.B, heal: BTN.X, interact: BTN.Y, parry: BTN.LB, light: BTN.RB, heavy: BTN.RT,
});

/** Logical state of one controller snapshot: held buttons (by meaning) and horizontal movement. */
export function readPadState(gp) {
    const down = (i) => {
        const b = gp.buttons?.[i];
        return Boolean(b && (b.pressed || b.value > TRIGGER_PULL));
    };
    const lx = gp.axes?.[0] ?? 0;
    const ly = gp.axes?.[1] ?? 0;
    const held = new Set();
    for (const [action, i] of Object.entries(PAD_LAYOUT)) if (down(i)) held.add(action);
    if (down(BTN.START)) held.add("pause");
    if (down(BTN.A)) held.add("confirm");
    if (down(BTN.B)) held.add("back");
    if (down(BTN.UP) || ly < -MENU_TILT) held.add("menuUp");
    if (down(BTN.DOWN) || ly > MENU_TILT) held.add("menuDown");
    if (down(BTN.LEFT) || lx < -MENU_TILT) held.add("menuLeft");
    if (down(BTN.RIGHT) || lx > MENU_TILT) held.add("menuRight");
    const stickX = Math.abs(lx) > STICK_DEADZONE ? Math.sign(lx) : 0;
    const moveX = down(BTN.LEFT) ? -1 : down(BTN.RIGHT) ? 1 : stickX;
    return { held, moveX, active: held.size > 0 || moveX !== 0 };
}

/** PlayStation controllers are recognised by name (Sony's vendor id 054c, or the product names). */
export const padStyle = (id = "") => (/054c|playstation|dualshock|dualsense/i.test(id) ? "playstation" : "xbox");

const NAMES = {
    xbox: { jump: "A", roll: "B", heal: "X", interact: "Y", parry: "LB", light: "RB", heavy: "RT", left: "Stick/D-pad", right: "Stick/D-pad", pause: "Start", confirm: "A", back: "B" },
    playstation: { jump: "Cross", roll: "Circle", heal: "Square", interact: "Triangle", parry: "L1", light: "R1", heavy: "R2", left: "Stick/D-pad", right: "Stick/D-pad", pause: "Options", confirm: "Cross", back: "Circle" },
};
export const padLabel = (style, name) => NAMES[style]?.[name] ?? NAMES.xbox[name] ?? "";

const EMPTY = Object.freeze({ held: new Set(), moveX: 0, active: false });

/** Reads the first connected controller once per fixed step and tracks presses (held now, not on the step before). */
export function createGamepad(getPads = () => globalThis.navigator?.getGamepads?.() ?? []) {
    let state = EMPTY;
    let previous = new Set();
    let pressedNow = new Set();
    let style = "xbox";
    let connected = false;

    return {
        poll() {
            let pad = null;
            try {
                const pads = [...getPads()].filter((g) => g && g.connected !== false);
                pad = pads.find((g) => g.mapping === "standard") ?? pads[0] ?? null;
            } catch {
                pad = null;
            }
            connected = Boolean(pad);
            state = pad ? readPadState(pad) : EMPTY;
            if (pad) style = padStyle(pad.id);
            pressedNow = new Set([...state.held].filter((h) => !previous.has(h)));
            previous = state.held;
        },
        held: (name) => state.held.has(name),
        pressed: (name) => pressedNow.has(name),
        get moveX() {
            return state.moveX;
        },
        /** Any button newly pressed, or the stick tilted, this step. */
        get used() {
            return pressedNow.size > 0 || state.moveX !== 0;
        },
        get anyPressed() {
            return pressedNow.size > 0;
        },
        get style() {
            return style;
        },
        get connected() {
            return connected;
        },
    };
}
