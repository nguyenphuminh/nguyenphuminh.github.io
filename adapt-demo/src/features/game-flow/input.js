// Keyboard mapping (BRD 2.2.2 Interface). Uses Kippy's physical key codes.
const KEYS = {
    left: ["KeyA", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
    jump: ["Space", "KeyW"],
    roll: ["ShiftLeft", "ShiftRight"],
    light: ["KeyJ"],
    heavy: ["KeyK"],
    parry: ["KeyL"],
    heal: ["KeyE"],
    interact: ["KeyF"],
    pause: ["Escape"],
    menuUp: ["ArrowUp", "KeyW"],
    menuDown: ["ArrowDown", "KeyS"],
    confirm: ["Enter", "Space", "KeyJ", "KeyF"],
    back: ["Escape", "Backspace"],
};

const any = (input, names, fn) => names.some((k) => input[fn](k));
export const pressed = (input, action) => any(input, KEYS[action], "isKeyPressed");
export const held = (input, action) => any(input, KEYS[action], "isKeyDown");

/** Player intent for one fixed step. */
export function readIntent(input) {
    const moveX = (held(input, "right") ? 1 : 0) - (held(input, "left") ? 1 : 0);
    return {
        moveX,
        jump: pressed(input, "jump"),
        jumpHeld: held(input, "jump"),
        roll: pressed(input, "roll"),
        light: pressed(input, "light"),
        heavy: pressed(input, "heavy"),
        parry: pressed(input, "parry"),
        heal: pressed(input, "heal"),
    };
}

export function menuInput(input) {
    return {
        up: pressed(input, "menuUp"),
        down: pressed(input, "menuDown"),
        confirm: pressed(input, "confirm"),
        back: pressed(input, "back"),
    };
}

/** True on the step where any key went down (used to unlock audio and skip screens). */
export const anyKeyPressed = (input) => input.keysPressed.size > 0;

export const CONTROLS = [
    ["Move", "A / D  or  Left / Right"],
    ["Jump", "Space  or  W"],
    ["Roll", "Shift"],
    ["Light attack", "J"],
    ["Heavy attack", "K"],
    ["Parry", "L"],
    ["Heal", "E"],
    ["Interact", "F"],
    ["Pause", "Escape"],
];
