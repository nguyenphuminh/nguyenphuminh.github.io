import { UI } from "./palette.js";

export function panel(ctx, x, y, w, h, { fill = UI.panel, border = UI.goldDark, studs = true } = {}) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.fillStyle = border;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = UI.ink;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = fill;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    if (studs) {
        ctx.fillStyle = border;
        for (const [sx, sy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) ctx.fillRect(sx, sy, 3, 3);
    }
}

export function bar(ctx, x, y, w, h, frac, color, back = UI.ink) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = "#000";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
}

export const inRect = (p, r) => r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

export function dim(ctx, w, h, alpha = 0.6) {
    ctx.fillStyle = `rgba(8, 6, 14, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
}

// Hover only changes a selection when the pointer actually moved, so a mouse
// resting over a card doesn't fight the keyboard.
export function pointerMoved(input, holder) {
    const p = input.pointer;
    if (holder.lastPointer && p.equals(holder.lastPointer)) return false;
    holder.lastPointer = p.copy();
    return true;
}
