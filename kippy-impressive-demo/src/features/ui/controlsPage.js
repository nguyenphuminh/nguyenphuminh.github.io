import { ACTIONS } from "../controls/bindings.js";
import { SERIF, SANS } from "../story/captions.js";
import { navStep, confirmed } from "./menu.js";
import { keycap } from "./keycap.js";

const inside = (p, r) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;

// Lists every action with its key; choose one, then press the new key (Esc cancels)
export function createControlsPage(controls) {
    const rows = [...ACTIONS, { id: "reset", label: "Reset to defaults" }, { id: "back", label: "Back" }];
    let index = 0;
    let waiting = null;
    let rects = [];
    let fresh = true;
    const last = { x: 0, y: 0 };

    function choose(row) {
        if (row.id === "back") return "back";
        if (row.id === "reset") controls.reset();
        else waiting = row.id;
        return null;
    }

    // Returns "back" when the player leaves the page
    function update(input) {
        if (waiting) {
            if (input.isKeyPressed("Escape")) waiting = null;
            else {
                for (const code of input.keysPressed) {
                    controls.assign(waiting, code);
                    waiting = null;
                    break;
                }
            }
            return null;
        }
        if (input.isKeyPressed("Escape")) return "back";

        index = (index + navStep(input, controls) + rows.length) % rows.length;
        const p = input.pointer;
        if (fresh) {
            fresh = false;
            last.x = p.x;
            last.y = p.y;
        } else if (p.x !== last.x || p.y !== last.y) {
            last.x = p.x;
            last.y = p.y;
            const hit = rects.findIndex((r) => inside(p, r));
            if (hit >= 0) index = hit;
        }
        if (input.isPointerPressed(0)) {
            const hit = rects.findIndex((r) => inside(p, r));
            return hit >= 0 ? choose(rows[hit]) : null;
        }
        return confirmed(input) ? choose(rows[index]) : null;
    }

    function render(ctx, canvas, alpha = 1) {
        const u = canvas.height / 900;
        const W = canvas.width;
        const H = canvas.height;
        const left = W / 2 - 250 * u;
        const keyX = W / 2 + 70 * u;
        const rowH = 42 * u;
        const top = H * 0.25;
        rects = [];

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(2, 6, 12, 0.86)";
        ctx.fillRect(0, 0, W, H);
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillStyle = "#eef8fb";
        ctx.font = `${Math.round(38 * u)}px ${SERIF}`;
        ctx.fillText("Controls", W / 2, H * 0.14);

        rows.forEach((row, i) => {
            const selected = i === index;
            const action = i < ACTIONS.length;
            const y = top + i * rowH + (action ? 0 : rowH * 0.6);
            ctx.globalAlpha = alpha * (selected ? 1 : 0.6);
            ctx.fillStyle = selected ? "#eef8fb" : "#b6cad3";
            if (action) {
                ctx.textAlign = "left";
                ctx.font = `${Math.round(17 * u)}px ${SANS}`;
                ctx.fillText(row.label, left, y);
                if (waiting === row.id) {
                    ctx.globalAlpha = alpha * (0.55 + 0.45 * Math.sin(performance.now() / 180));
                    ctx.fillStyle = "#9fefff";
                    ctx.fillText("Press a key", keyX, y);
                } else {
                    const w = keycap(ctx, keyX, y, controls.label(row.id), { h: 28 * u, alpha: selected ? 1 : 0.8 });
                    if (row.mouse) {
                        ctx.globalAlpha = alpha * 0.45;
                        ctx.fillStyle = "#b6cad3";
                        ctx.font = `${Math.round(14 * u)}px ${SANS}`;
                        ctx.fillText(row.mouse, keyX + w + 14 * u, y);
                    }
                }
                if (selected) {
                    ctx.globalAlpha = alpha * 0.08;
                    ctx.fillStyle = "#bfefff";
                    ctx.fillRect(left - 16 * u, y - rowH / 2, keyX - left + 220 * u, rowH);
                }
                rects.push({ x0: left - 16 * u, x1: keyX + 204 * u, y0: y - rowH / 2, y1: y + rowH / 2 });
            } else {
                ctx.textAlign = "center";
                ctx.font = `${Math.round(21 * u)}px ${SERIF}`;
                ctx.fillText(row.label, W / 2, y);
                const w = ctx.measureText(row.label).width;
                rects.push({ x0: W / 2 - w / 2 - 30 * u, x1: W / 2 + w / 2 + 30 * u, y0: y - rowH / 2, y1: y + rowH / 2 });
            }
        });

        if (waiting) {
            ctx.globalAlpha = alpha * 0.5;
            ctx.textAlign = "center";
            ctx.fillStyle = "#b6cad3";
            ctx.font = `${Math.round(14 * u)}px ${SANS}`;
            ctx.fillText("Esc cancels", W / 2, H * 0.93);
        }
        ctx.restore();
    }

    return {
        update,
        render,
        open() {
            index = 0;
            waiting = null;
            fresh = true;
        }
    };
}
