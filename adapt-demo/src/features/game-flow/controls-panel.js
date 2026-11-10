// The Controls screen (BRD 2.2.2.8), shared by the title menu and the pause menu.
import { drawText } from "../presentation/index.js";
import { DEFAULT_CONTROLS, PLAYER_ACTIONS, assignKey, clearKey, copyControls, keyLabel } from "./controls.js";
import { padLabel } from "./gamepad.js";
import { menuInput } from "./input.js";
import { COLORS, drawPanel } from "./ui.js";

const RESET_ROW = PLAYER_ACTIONS.length;

export function createControlsPanel(app) {
    let row = 0;
    let slot = 0;
    let waiting = false; // waiting for the new key
    let armed = false; // the key that opened the prompt must not be captured
    let message = "";
    let time = 0;

    return {
        /** Advances one fixed step. Returns true when the player closes the screen. */
        tick(input, dt = 1 / 60) {
            time += dt;
            if (waiting) {
                if (!armed) {
                    armed = true;
                    return false;
                }
                if (input.isKeyPressed("Escape") || app.pad.pressed("back")) {
                    waiting = false;
                    message = "Change cancelled.";
                    app.audio.play("uiBack");
                    return false;
                }
                const code = [...input.keysPressed][0];
                if (!code) return false;
                const action = PLAYER_ACTIONS[row];
                const result = assignKey(app.controls, action.id, slot, code);
                if (result.error) {
                    message = result.error;
                    app.audio.play("uiBack");
                } else {
                    app.setControls(result.keys);
                    message = `${action.label}: ${keyLabel(code)}`;
                    app.audio.play("uiSelect");
                }
                waiting = false;
                return false;
            }

            const menu = menuInput(input, app.pad);
            if (input.isKeyPressed("Escape") || app.pad.pressed("back")) {
                app.audio.play("uiBack");
                return true;
            }
            if (menu.up || menu.down) {
                row = (row + (menu.up ? RESET_ROW : 1)) % (RESET_ROW + 1);
                app.audio.play("uiMove");
            }
            if (row < RESET_ROW && (menu.left || menu.right)) {
                slot = 1 - slot;
                app.audio.play("uiMove");
            }
            if (row < RESET_ROW && (input.isKeyPressed("Backspace") || input.isKeyPressed("Delete"))) {
                const result = clearKey(app.controls, PLAYER_ACTIONS[row].id, slot);
                message = result.error ?? `${PLAYER_ACTIONS[row].label}: key removed`;
                if (!result.error) app.setControls(result.keys);
                app.audio.play(result.error ? "uiBack" : "uiSelect");
                return false;
            }
            if (input.isKeyPressed("Enter") || input.isKeyPressed("Space") || app.pad.pressed("confirm")) {
                app.audio.play("uiSelect");
                if (row === RESET_ROW) {
                    app.setControls(copyControls(DEFAULT_CONTROLS));
                    message = "Controls reset to the defaults.";
                } else {
                    waiting = true;
                    armed = false;
                    message = "";
                }
            }
            return false;
        },

        draw(ctx, top = 78) {
            const left = 60;
            const width = 360;
            drawPanel(ctx, left, top, width, 182);
            drawText(ctx, "CONTROLS", 240, top + 7, { align: "center", color: COLORS.gold });
            const colA = left + 14;
            const col1 = left + 140;
            const col2 = left + 214;
            const colPad = left + 288;
            drawText(ctx, "key 1", col1, top + 21, { color: COLORS.dim });
            drawText(ctx, "key 2", col2, top + 21, { color: COLORS.dim });
            drawText(ctx, "controller", colPad, top + 21, { color: COLORS.dim });
            PLAYER_ACTIONS.forEach((action, i) => {
                const y = top + 33 + i * 12;
                const active = i === row;
                drawText(ctx, action.label, colA, y, { color: active ? COLORS.gold : COLORS.text });
                [col1, col2].forEach((x, s) => {
                    const selected = active && s === slot;
                    let label = keyLabel(app.controls[action.id][s]);
                    if (selected && waiting) label = Math.floor(time * 3) % 2 ? "press a key" : "";
                    if (selected) {
                        ctx.fillStyle = "rgba(242, 196, 107, 0.18)";
                        ctx.fillRect(x - 4, y - 2, 70, 11);
                    }
                    drawText(ctx, label, x, y, { color: selected ? COLORS.gold : COLORS.dim });
                });
                // The controller layout is fixed (BRD 2.2.2.9): shown, not changeable.
                drawText(ctx, padLabel(app.pad.style, action.id), colPad, y, { color: COLORS.dim });
            });
            const resetY = top + 33 + RESET_ROW * 12 + 2;
            drawText(ctx, row === RESET_ROW ? "> Reset to Defaults" : "  Reset to Defaults", colA, resetY, { color: row === RESET_ROW ? COLORS.gold : COLORS.text });
            drawText(ctx, `Pause: Esc / ${padLabel(app.pad.style, "pause")} (fixed)`, col1, resetY, { color: COLORS.dim });
            const back = app.hint("back");
            const hint = waiting ? `Press the new key, or ${back} to cancel` : `${app.hint("confirm")}: change   Left/Right: key 1 or 2   Backspace: clear   ${back}: back`;
            drawText(ctx, message || hint, 240, top + 164, { align: "center", color: message ? COLORS.cyan : COLORS.dim });
        },
    };
}
