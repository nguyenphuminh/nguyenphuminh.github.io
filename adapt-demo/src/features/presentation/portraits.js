// Dialogue portraits (40×40) cut from the characters' own frames, plus the Mirror's eye.
// Also prepares the knight close-up used by the Arrival shard vision.
import { C, R } from "./palette.js";
import { Px, capsule, ellipse, fill, hash2, line, outline, paint, poly, pxToCanvas, rect, rgba } from "./pixel.js";

const SIZE = 40;

// Top-left of a square crop around a frame's head: the topmost opaque rows, centred on their mass.
function headOrigin(frame, size, above = 1) {
    const { w, h, data } = frame;
    let top = 0;
    search: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x]) { top = y; break search; }
    let sx = 0, n = 0;
    for (let y = top; y < Math.min(h, top + Math.round(size * 0.6)); y++) for (let x = 0; x < w; x++) if (data[y * w + x]) { sx += x; n++; }
    return { x0: Math.round(sx / Math.max(1, n)) - Math.floor(size / 2), y0: top - above };
}

function frameBorder(px, accent) {
    for (let i = 0; i < SIZE; i++) {
        for (const [x, y] of [[i, 0], [i, SIZE - 1], [0, i], [SIZE - 1, i]]) px.set(x, y, C.outline);
        for (const [x, y] of [[i, 1], [i, SIZE - 2], [1, i], [SIZE - 2, i]]) if (i > 0 && i < SIZE - 1) px.set(x, y, accent);
    }
    for (const [x, y] of [[1, 1], [SIZE - 2, 1], [1, SIZE - 2], [SIZE - 2, SIZE - 2]]) px.set(x, y, C.outline);
}

function background(px, top, bottom) {
    const a = rgba(top), b = rgba(bottom);
    for (let y = 2; y < SIZE - 2; y++) for (let x = 2; x < SIZE - 2; x++) {
        const t = (y - 2) / (SIZE - 4);
        px.set(x, y, hash2(x, y, 71) < t ? b : a);
    }
}

/** A portrait from a character frame: crop `size` px around the head, scaled by `scale` (size × scale = 36). */
function fromFrame(frame, { size, scale, accent, bg = ["#1a1d36", "#0c0b16"] }) {
    const px = new Px(SIZE, SIZE);
    background(px, bg[0], bg[1]);
    const { x0, y0 } = headOrigin(frame, size);
    for (let iy = 0; iy < SIZE - 4; iy++) for (let ix = 0; ix < SIZE - 4; ix++) {
        const c = frame.get(x0 + Math.floor(ix / scale), y0 + Math.floor(iy / scale));
        if (c) px.set(ix + 2, iy + 2, c);
    }
    frameBorder(px, accent);
    return pxToCanvas(px);
}

// The Mirror's voice: an eye opening inside a glass shard.
function mirrorPortrait() {
    const px = new Px(SIZE, SIZE);
    background(px, "#081a26", "#04080e");
    fill(px, poly([[9, 34], [6, 14], [17, 4], [33, 9], [35, 29], [24, 37]]), rgba("#1f4a62"));
    fill(px, poly([[11, 31], [9, 15], [18, 7], [31, 11], [32, 28], [23, 34]]), rgba("#2a5a78"));
    line(px, 18, 7, 31, 11, rgba("#9fdcef"));
    line(px, 9, 15, 18, 7, rgba("#c8fbff"));
    fill(px, ellipse(20.5, 20.5, 9, 4.6), rgba("#e8f6fb"));
    fill(px, ellipse(20.5, 20.5, 4.2, 4.2), C.cyan1);
    fill(px, ellipse(20.5, 20.5, 2.6, 2.6), C.cyan2);
    fill(px, ellipse(20.5, 20.5, 1.2, 1.6), C.ink);
    px.set(19, 18, C.white); px.set(18, 18, C.white);
    for (const [x, y] of [[11, 20], [12, 18], [12, 23], [29, 20], [28, 18], [28, 23]]) px.set(x, y, rgba("#0c1a26"));
    line(px, 24, 30, 28, 25, rgba("#9fdcef"));
    for (let i = 0; i < 10; i++) px.set(4 + Math.floor(hash2(i, 81) * 32), 3 + Math.floor(hash2(i, 82) * 34), C.cyan2);
    outline(px, 0);
    frameBorder(px, C.cyan1);
    return pxToCanvas(px);
}

export function buildPortraits({ player, squire, boss, reflection }) {
    const idle = (art) => art.__frames[art.anims.idle.frames[0]];
    const out = {
        knight: fromFrame(idle(player), { size: 18, scale: 2, accent: C.gold1 }),
        squire: fromFrame(idle(squire), { size: 18, scale: 2, accent: rgba("#93a8d0") }),
        mirrorwright: fromFrame(idle(boss), { size: 36, scale: 1, accent: C.cyan1, bg: ["#1d1430", "#0c0b16"] }),
        mirror: mirrorPortrait(),
    };
    if (reflection) out.reflection = fromFrame(idle(reflection), { size: 18, scale: 2, accent: C.cyan2, bg: ["#121a2c", "#06070d"] });
    return out;
}

// ---- Knight close-up for the shard vision: a native-resolution great helm, its white ghost and its cold reflection.
const unpack = (c) => [c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, (c >>> 24) & 0xff];
const pack = (r, g, b, a) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;

function helmCloseup() {
    const px = new Px(124, 120);
    // Cape collar and shoulders
    paint(px, ellipse(62, 116, 60, 14), R.cape);
    paint(px, ellipse(26, 104, 26, 13, -0.15), R.steel, { sep: C.sep });
    paint(px, ellipse(98, 104, 26, 13, 0.15), R.steel, { sep: C.sep });
    for (const x of [12, 112]) paint(px, ellipse(x, 98, 4, 3), R.gold);
    paint(px, rect(42, 86, 40, 26), R.steelDark, { sep: C.sep });
    for (let y = 92; y < 112; y += 6) line(px, 43, y, 80, y, C.sep);
    // Helm: rounded great helm with a narrowing jaw
    paint(px, ellipse(62, 50, 31, 34), R.steel, { sep: C.sep });
    paint(px, poly([[33, 54], [91, 54], [86, 84], [62, 94], [38, 84]]), R.steel, { sep: C.sep });
    // Brow band with gold rivets
    paint(px, rect(31, 42, 62, 5), R.gold, { sep: C.sep });
    for (let x = 36; x < 90; x += 8) px.set(x, 44, C.gold4);
    // T-visor and breaths
    fill(px, rect(36, 52, 52, 6), C.ink);
    fill(px, rect(58, 52, 7, 27), C.ink);
    for (const [x, y] of [[76, 66], [80, 66], [76, 71], [80, 71], [78, 76]]) fill(px, rect(x, y, 2, 2), C.ink);
    line(px, 62, 16, 62, 41, C.sep);
    // Gold crest sweeping back over the helm
    const crest = [[66, 20], [58, 10], [46, 4], [32, 4], [20, 10]];
    for (let i = 0; i < crest.length - 1; i++) paint(px, capsule(crest[i][0], crest[i][1], crest[i + 1][0], crest[i + 1][1], 5.5 - i, 4.5 - i), R.gold);
    // Glints
    for (const [x, y] of [[44, 26], [45, 27], [40, 34], [52, 20]]) px.set(x, y, C.white);
    outline(px, C.outline);
    return px;
}

export function buildVisionFace() {
    const src = helmCloseup();
    const ghost = new Px(src.w, src.h), cold = new Px(src.w, src.h);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (!c) continue;
        ghost.set(x, y, 0xffffffff);
        if (c === C.ink) { cold.set(x, y, (y > 52 && y < 58) || (x > 58 && x < 65 && y < 79) ? C.cyan2 : C.cyan1); continue; } // the reflection's visor glows
        const [r, g, b, a] = unpack(c);
        cold.set(x, y, pack(Math.round(r * 0.5 + 30), Math.round(g * 0.65 + 50), Math.round(b * 0.7 + 70), a));
    }
    return { real: pxToCanvas(src), ghost: pxToCanvas(ghost), cold: pxToCanvas(cold) };
}
