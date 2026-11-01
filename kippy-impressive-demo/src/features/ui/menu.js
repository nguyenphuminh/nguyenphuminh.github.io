import { glowSprite } from "../../core/paint.js";
import { SERIF, SANS } from "../story/captions.js";

const inside = (p, r) => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;

// Menu navigation shared by every list: arrow keys (and the bound swim up/down keys,
// unless they are arrows already) move the selection; Enter or Space confirms
export function navStep(input, controls) {
    const { up, down } = controls.keys;
    if (input.isKeyPressed("ArrowUp") || (!up.startsWith("Arrow") && controls.pressed(input, "up"))) return -1;
    if (input.isKeyPressed("ArrowDown") || (!down.startsWith("Arrow") && controls.pressed(input, "down"))) return 1;
    return 0;
}

export const confirmed = (input) => input.isKeyPressed("Enter") || input.isKeyPressed("Space");

// Vertical list of choices, picked by mouse (hover, click) or keyboard.
// Items: { id, label: string | () => string, detail?: () => string }
export function createMenu(items) {
    let index = 0;
    let rects = [];
    let fresh = true;
    const last = { x: 0, y: 0 };

    function update(input, controls) {
        const n = items.length;
        index = (index + navStep(input, controls) + n) % n;

        // Hover only counts once the mouse moves; a cursor resting where the menu opens selects nothing
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
            return hit >= 0 ? items[hit].id : null;
        }
        return confirmed(input) ? items[index].id : null;
    }

    function render(ctx, canvas, { y, size = 26, spacing = 2.1, alpha = 1 }) {
        const u = canvas.height / 900;
        const W = canvas.width;
        rects = [];
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        items.forEach((item, i) => {
            const label = typeof item.label === "function" ? item.label() : item.label;
            const yy = y + i * size * spacing * u;
            const selected = i === index;
            ctx.font = `${Math.round(size * u)}px ${SERIF}`;
            const w = ctx.measureText(label).width;
            ctx.globalAlpha = alpha * (selected ? 1 : 0.5);
            ctx.fillStyle = selected ? "#eef8fb" : "#b6cad3";
            ctx.fillText(label, W / 2, yy);
            if (item.detail) {
                ctx.font = `${Math.round(size * 0.52 * u)}px ${SANS}`;
                ctx.globalAlpha = alpha * (selected ? 0.75 : 0.4);
                ctx.fillText(item.detail(), W / 2, yy + size * 0.9 * u);
            }
            if (selected) {
                const s = 9 * u;
                ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.sin(performance.now() / 260));
                ctx.drawImage(glowSprite("rgba(150, 240, 255, 1)"), W / 2 - w / 2 - 26 * u - s, yy - s, s * 2, s * 2);
            }
            rects.push({ x0: W / 2 - w / 2 - 36 * u, x1: W / 2 + w / 2 + 36 * u, y0: yy - size * 0.75 * u, y1: yy + size * (item.detail ? 1.3 : 0.75) * u });
        });
        ctx.restore();
    }

    return {
        update,
        render,
        reset() {
            index = 0;
            fresh = true;
        }
    };
}
