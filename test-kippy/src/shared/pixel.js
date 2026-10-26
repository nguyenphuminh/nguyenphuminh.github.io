import { PALETTE } from "./palette.js";

export function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
}

// Paints rows of palette letters into a canvas. "." is transparent.
export function paint(rows, pal = PALETTE) {
    const w = Math.max(...rows.map(r => r.length));
    const c = makeCanvas(w, rows.length);
    const ctx = c.getContext("2d");
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const color = pal[row[x]];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
        }
    });
    return c;
}

// Swaps palette letters, e.g. recolor(rows, { w: "p" }) turns a white robe violet.
export function recolor(rows, map) {
    return rows.map(row => row.replace(/./g, ch => map[ch] ?? ch));
}

export function mirrored(src) {
    const c = makeCanvas(src.width, src.height);
    const ctx = c.getContext("2d");
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return c;
}

export function silhouette(src, color) {
    const c = makeCanvas(src.width, src.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
}

// Lays equally sized frames out in one row, the layout Kippy's SpriteSheet expects.
export function strip(frames) {
    const fw = frames[0].width, fh = frames[0].height;
    const c = makeCanvas(fw * frames.length, fh);
    const ctx = c.getContext("2d");
    frames.forEach((f, i) => ctx.drawImage(f, i * fw, 0));
    return c;
}

export function fadeFrames(src, count) {
    return Array.from({ length: count }, (_, i) => {
        const c = makeCanvas(src.width, src.height);
        const ctx = c.getContext("2d");
        ctx.globalAlpha = 1 - i / count;
        ctx.drawImage(src, 0, 0);
        return c;
    });
}

// Centers a sprite on a square canvas, e.g. to turn a projectile into an icon.
export function framed(src, size) {
    const c = makeCanvas(size, size);
    c.getContext("2d").drawImage(src, Math.floor((size - src.width) / 2), Math.floor((size - src.height) / 2));
    return c;
}
