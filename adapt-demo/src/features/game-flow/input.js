// Keyboard input. Player actions use the player's chosen keys (BRD 2.2.2.8); menus, pause and back always use
// fixed keys too, so the player can never lock themselves out. Uses Kippy's physical key codes.
const FIXED = {
    pause: ["Escape"],
    menuUp: ["ArrowUp", "KeyW"],
    menuDown: ["ArrowDown", "KeyS"],
    menuLeft: ["ArrowLeft", "KeyA"],
    menuRight: ["ArrowRight", "KeyD"],
    confirm: ["Enter", "Space", "KeyJ", "KeyF"],
    back: ["Escape", "Backspace"],
};

const any = (input, codes, fn) => codes.some((k) => k && input[fn](k));
// `pad` (optional) is the controller (BRD 2.2.2.9); keyboard and controller work together.
/** Fixed keys: pause, menu navigation, confirm, back. */
export const pressed = (input, action, pad = null) => any(input, FIXED[action], "isKeyPressed") || Boolean(pad?.pressed(action));
/** A player action through the player's chosen keys or the controller's fixed button. */
export const actionPressed = (input, keys, action, pad = null) => any(input, keys[action], "isKeyPressed") || Boolean(pad?.pressed(action));
export const actionHeld = (input, keys, action, pad = null) => any(input, keys[action], "isKeyDown") || Boolean(pad?.held(action));

/** Player intent for one fixed step. */
export function readIntent(input, keys, pad = null) {
    const keyX = (actionHeld(input, keys, "right") ? 1 : 0) - (actionHeld(input, keys, "left") ? 1 : 0);
    return {
        moveX: keyX !== 0 ? keyX : pad?.moveX ?? 0,
        jump: actionPressed(input, keys, "jump", pad),
        jumpHeld: actionHeld(input, keys, "jump", pad),
        roll: actionPressed(input, keys, "roll", pad),
        light: actionPressed(input, keys, "light", pad),
        heavy: actionPressed(input, keys, "heavy", pad),
        parry: actionPressed(input, keys, "parry", pad),
        heal: actionPressed(input, keys, "heal", pad),
    };
}

export function menuInput(input, pad = null) {
    return {
        up: pressed(input, "menuUp", pad),
        down: pressed(input, "menuDown", pad),
        left: pressed(input, "menuLeft", pad),
        right: pressed(input, "menuRight", pad),
        confirm: pressed(input, "confirm", pad),
        back: pressed(input, "back", pad),
    };
}

/** True on the step where any key or controller button went down (used to start music and skip screens). */
export const anyKeyPressed = (input, pad = null) => input.keysPressed.size > 0 || Boolean(pad?.anyPressed);
