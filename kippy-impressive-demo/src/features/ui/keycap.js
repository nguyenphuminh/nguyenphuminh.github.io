import { SANS } from "../story/captions.js";

export function keycapWidth(ctx, label, h) {
    ctx.font = `${Math.round(h * 0.48)}px ${SANS}`;
    return Math.max(h, ctx.measureText(label).width + h * 0.75);
}

// A keyboard key drawn as a small rounded cap; (x, y) is its left edge, vertically centered.
// `fill` (0..1) shows a charge bar inside the cap. Returns the cap's width.
export function keycap(ctx, x, y, label, { h = 26, alpha = 1, fill = -1 } = {}) {
    const w = keycapWidth(ctx, label, h);
    const top = y - h / 2;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, h * 0.22);
    ctx.fillStyle = "rgba(8, 18, 26, 0.8)";
    ctx.fill();
    if (fill > 0) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = "rgba(130, 235, 255, 0.4)";
        ctx.fillRect(x, top + h * (1 - fill), w, h * fill);
        ctx.restore();
    }
    ctx.lineWidth = Math.max(1, h * 0.06);
    ctx.strokeStyle = "rgba(205, 230, 240, 0.85)";
    ctx.stroke();
    ctx.fillStyle = "rgba(225, 240, 246, 0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h * 0.04);
    ctx.restore();
    return w;
}
