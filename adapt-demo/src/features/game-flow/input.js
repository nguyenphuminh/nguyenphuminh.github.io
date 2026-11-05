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
/** Fixed keys: pause, menu navigation, confirm, back. */
export const pressed = (input, action) => any(input, FIXED[action], "isKeyPressed");
/** A player action through the player's chosen keys. */
export const actionPressed = (input, keys, action) => any(input, keys[action], "isKeyPressed");
export const actionHeld = (input, keys, action) => any(input, keys[action], "isKeyDown");

/** Player intent for one fixed step. */
export function readIntent(input, keys) {
    const moveX = (actionHeld(input, keys, "right") ? 1 : 0) - (actionHeld(input, keys, "left") ? 1 : 0);
    return {
        moveX,
        jump: actionPressed(input, keys, "jump"),
        jumpHeld: actionHeld(input, keys, "jump"),
        roll: actionPressed(input, keys, "roll"),
        light: actionPressed(input, keys, "light"),
        heavy: actionPressed(input, keys, "heavy"),
        parry: actionPressed(input, keys, "parry"),
        heal: actionPressed(input, keys, "heal"),
    };
}

export function menuInput(input) {
    return {
        up: pressed(input, "menuUp"),
        down: pressed(input, "menuDown"),
        left: pressed(input, "menuLeft"),
        right: pressed(input, "menuRight"),
        confirm: pressed(input, "confirm"),
        back: pressed(input, "back"),
    };
}

/** True on the step where any key went down (used to unlock audio and skip screens). */
export const anyKeyPressed = (input) => input.keysPressed.size > 0;
