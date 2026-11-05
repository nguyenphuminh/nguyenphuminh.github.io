// Environment art: floor tiles, parallax backgrounds, arena backdrop and props. All generated.
import { C, HEX, R } from "./palette.js";
import { Px, capsule, ellipse, fill, framesToSheet, hash2, line, outline, paint, poly, pxToCanvas, rect, rgba } from "./pixel.js";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const dither = (x, y, t) => t * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5;

// Vertical banded gradient with ordered dithering between bands.
export function gradient(px, x0, y0, w, h, stops) {
    const bands = stops.length - 1;
    for (let y = y0; y < y0 + h; y++) {
        const t = ((y - y0) / Math.max(1, h - 1)) * bands;
        const i = Math.min(bands - 1, Math.floor(t)), f = t - i;
        const a = rgba(stops[i]), b = rgba(stops[i + 1]);
        for (let x = x0; x < x0 + w; x++) px.set(x, y, dither(x, y, f) ? b : a);
    }
}

// ---------------------------------------------------------------- tiles

function floorTile(arena) {
    const px = new Px(32, 42);
    gradient(px, 0, 0, 32, 42, arena ? ["#2c3048", "#1c1f30", "#11121e", "#0a0a12"] : ["#3a3e58", "#262940", "#171928", "#0b0b14"]);
    if (arena) {
        // Polished slabs with a cyan inlay and a faint reflection band
        for (let x = 0; x < 32; x++) {
            px.set(x, 0, rgba("#6a7294"));
            px.set(x, 1, rgba("#4a5070"));
            px.set(x, 5, C.cyan0);
            if (dither(x, 9, 0.35)) px.set(x, 9, rgba("#3d4360"));
        }
        for (let y = 2; y < 42; y++) px.set(15, y, rgba("#151726"));
        for (let y = 2; y < 30; y++) if (dither(16, y, 0.3)) px.set(16, y, rgba("#3d4360"));
        px.set(15, 5, C.cyan2);
    } else {
        // Worn stone bricks, mossy lip
        for (let x = 0; x < 32; x++) {
            px.set(x, 0, rgba("#7a7f9c"));
            px.set(x, 1, rgba("#555a76"));
            if (hash2(x, 0, 4) < 0.35) px.set(x, 0, rgba("#4f6a4a"));
            if (hash2(x, 1, 4) < 0.15) px.set(x, 1, rgba("#3c5238"));
        }
        const rows = [2, 10, 19, 29];
        rows.forEach((ry, r) => {
            for (let x = 0; x < 32; x++) px.set(x, ry, rgba("#11121c"));
            const off = r % 2 ? 8 : 0;
            for (let bx = off; bx < 32 + off; bx += 16) {
                const xx = bx % 32;
                for (let y = ry + 1; y < (rows[r + 1] ?? 42); y++) px.set(xx, y, rgba("#11121c"));
                for (let y = ry + 1; y < Math.min(ry + 4, rows[r + 1] ?? 42); y++) {
                    for (let x = xx + 1; x < Math.min(xx + 16, 32); x++) {
                        if (hash2(x, y, r) < 0.25 + (y - ry) * 0.05) continue;
                        if (y === ry + 1) px.set(x, y, rgba(r === 0 ? "#4d5170" : "#33364e"));
                    }
                }
            }
        });
        for (let i = 0; i < 18; i++) px.set(Math.floor(hash2(i, 1) * 32), 3 + Math.floor(hash2(i, 2) * 36), rgba("#11121c"));
    }
    return pxToCanvas(px);
}

// ---------------------------------------------------------------- backgrounds

function sky() {
    const px = new Px(480, 270);
    gradient(px, 0, 0, 480, 270, ["#05060f", "#0b0d22", "#151634", "#261d48", "#3a2552"]);
    // Stars
    for (let i = 0; i < 260; i++) {
        const x = Math.floor(hash2(i, 1, 2) * 480), y = Math.floor(hash2(i, 2, 2) * 190);
        const b = hash2(i, 3, 2);
        px.set(x, y, rgba(b > 0.9 ? "#ffffff" : b > 0.6 ? "#a9a6d0" : "#5c5a88"));
        if (b > 0.97) {
            px.set(x - 1, y, rgba("#6a68a0")); px.set(x + 1, y, rgba("#6a68a0"));
            px.set(x, y - 1, rgba("#6a68a0")); px.set(x, y + 1, rgba("#6a68a0"));
        }
    }
    // Moon with dithered halo
    const mx = 352, my = 64, mr = 24;
    for (let y = my - 70; y < my + 70; y++) {
        for (let x = mx - 70; x < mx + 70; x++) {
            const d = Math.hypot(x - mx, y - my);
            if (d > mr && d < mr + 40 && dither(x, y, (1 - (d - mr) / 40) * 0.45)) px.set(x, y, rgba(d < mr + 12 ? "#3c3466" : "#2a2552"));
        }
    }
    fill(px, ellipse(mx, my, mr, mr), rgba("#e9e4f2"));
    for (let y = my - mr; y <= my + mr; y++) {
        for (let x = mx - mr; x <= mx + mr; x++) {
            const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
            if (d > mr) continue;
            if (x - mx > mr * 0.35 && dither(x, y, (x - mx) / mr - 0.25)) px.set(x, y, rgba("#c6bedc"));
        }
    }
    for (const [cx, cy, r] of [[-8, -6, 5], [6, 4, 7], [-4, 12, 3], [10, -10, 3], [-12, 6, 2]]) {
        fill(px, ellipse(mx + cx, my + cy, r, r), rgba("#c6bedc"));
        fill(px, ellipse(mx + cx + 1, my + cy + 1, r - 1, r - 1), rgba("#d6d0e6"));
    }
    // Thin cloud streaks
    for (const [cx, cy, w] of [[300, 78, 160], [90, 120, 200], [400, 150, 140], [180, 40, 90]]) {
        for (let x = cx - w / 2; x < cx + w / 2; x++) {
            const t = 1 - Math.abs(x - cx) / (w / 2);
            for (let k = 0; k < 3; k++) {
                const y = cy + k + Math.round(Math.sin(x * 0.05) * 1.5);
                if (dither(Math.floor(x), y, t * (k === 1 ? 0.7 : 0.35))) px.set(Math.floor(x), y, rgba(k === 0 ? "#4a3f70" : "#2e2850"));
            }
        }
    }
    return pxToCanvas(px);
}

// Horizontally periodic height field (integer harmonics over the strip width).
export function periodic(x, W, seed, terms) {
    let h = 0;
    for (const [k, a] of terms) h += a * Math.sin((2 * Math.PI * k * x) / W + hash2(k, seed) * 6.28);
    return h;
}

function farStrip() {
    const W = 960, px = new Px(W, 270);
    // Mountains
    for (let x = 0; x < W; x++) {
        const h = 168 + periodic(x, W, 1, [[2, 18], [5, 9], [11, 4], [23, 2]]);
        for (let y = Math.floor(h); y < 270; y++) px.set(x, y, rgba(y < h + 1 ? "#3a3d66" : "#1b1e3a"));
    }
    // Distant castle spires
    const towers = [[120, 70, 9], [150, 95, 6], [170, 60, 12], [200, 88, 7], [560, 80, 10], [590, 64, 8], [612, 100, 6], [820, 90, 8]];
    for (const [tx, ty, tw] of towers) {
        fill(px, rect(tx - tw / 2, ty, tw, 270 - ty), rgba("#181a34"));
        fill(px, poly([[tx - tw / 2 - 1, ty], [tx, ty - tw * 2.2], [tx + tw / 2 + 1, ty]]), rgba("#181a34"));
        for (let y = ty + 4; y < 200; y += 9) if (hash2(tx, y) < 0.45) px.set(Math.round(tx + (hash2(y, tx) - 0.5) * (tw - 3)), y, rgba(HEX.gold1));
        line(px, tx + tw / 2, ty, tx + tw / 2, 200, rgba("#2a2d55"));
    }
    // Low mist
    for (let y = 200; y < 270; y++) for (let x = 0; x < W; x++) if (dither(x, y, (y - 200) / 120)) px.set(x, y, rgba("#14162c"));
    return pxToCanvas(px);
}

function tree(px, x, y, len, ang, depth, color) {
    const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
    if (depth > 3) fill(px, capsule(x, y, x2, y2, depth * 0.45, depth * 0.35), color);
    else line(px, x, y, x2, y2, color);
    if (depth <= 0) return;
    tree(px, x2, y2, len * 0.72, ang - 0.45 - hash2(x2 | 0, depth) * 0.3, depth - 1, color);
    tree(px, x2, y2, len * 0.68, ang + 0.35 + hash2(depth, y2 | 0) * 0.35, depth - 1, color);
}

function midStrip() {
    const W = 960, px = new Px(W, 270);
    const ruin = rgba("#0f1024"), rim = rgba("#2c2b52");
    // Gothic arcade ruins
    for (const [ax, aw, ah, broken] of [[60, 70, 120, 0], [300, 90, 140, 1], [640, 80, 110, 0], [820, 60, 90, 1]]) {
        const base = 230, top = base - ah;
        for (const side of [ax, ax + aw - 12]) {
            const ph = broken && side === ax ? ah * 0.55 : ah;
            fill(px, rect(side, base - ph, 12, ph), ruin);
            line(px, side + 11, base - ph, side + 11, base, rim);
            fill(px, rect(side - 2, base - ph - 3, 16, 4), ruin);
        }
        if (!broken) {
            for (let a = 0; a <= 1; a += 0.01) {
                const cx = ax + aw / 2, r = aw / 2;
                const x = cx - Math.cos(a * Math.PI) * r, y = top - Math.sin(a * Math.PI) * r * 0.9;
                fill(px, ellipse(x, y, 5, 5), ruin);
                if (a > 0.5) px.set(Math.round(x + 4), Math.round(y), rim);
            }
        }
    }
    // Dead trees
    tree(px, 220, 232, 26, 0.05, 6, ruin);
    tree(px, 520, 232, 30, -0.08, 6, ruin);
    tree(px, 760, 232, 22, 0.1, 5, ruin);
    // Gravestones and ground
    for (let i = 0; i < 14; i++) {
        const gx = Math.floor(hash2(i, 5) * W), gh = 8 + Math.floor(hash2(i, 6) * 8);
        fill(px, rect(gx, 230 - gh, 6, gh), ruin);
        fill(px, ellipse(gx + 3, 230 - gh, 3, 3), ruin);
    }
    for (let x = 0; x < W; x++) {
        const h = 226 + periodic(x, W, 3, [[3, 2], [9, 1.5]]);
        for (let y = Math.floor(h); y < 270; y++) px.set(x, y, ruin);
    }
    // Fog band
    for (let y = 205; y < 232; y++) for (let x = 0; x < W; x++) {
        const t = (1 - Math.abs(y - 222) / 17) * (0.35 + 0.25 * Math.sin(x * 0.03 + y * 0.2));
        if (dither(x, y, t)) px.set(x, y, rgba("#2a2850"));
    }
    return pxToCanvas(px);
}

// The arena back wall as pixels (the Hall of Panes' opened version is derived from it).
export function arenaBackdropPx() {
    const px = new Px(480, 270);
    // Back wall of stone blocks
    for (let y = 0; y < 270; y++) {
        for (let x = 0; x < 480; x++) {
            const row = Math.floor(y / 10), off = row % 2 ? 12 : 0;
            const mortar = y % 10 === 0 || (x + off) % 24 === 0;
            const shade = hash2(Math.floor((x + off) / 24), row, 7);
            px.set(x, y, rgba(mortar ? "#0c0c18" : shade < 0.3 ? "#1d1f33" : shade < 0.7 ? "#1a1c2e" : "#20223a"));
        }
    }
    // Great shattered window (transparent → sky shows through)
    const wx = 240, wTop = 30, wBottom = 196, wr = 74;
    const inWin = (x, y) => (y > wTop + wr ? Math.abs(x - wx) < wr : Math.hypot(x - wx, (y - (wTop + wr)) * 1.0) < wr) && y < wBottom;
    for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) {
        if (inWin(x, y)) px.set(x, y, 0);
        else if (inWin(x - 3, y) || inWin(x + 3, y) || inWin(x, y + 3) || inWin(x, y - 3)) px.set(x, y, rgba("#3a3e5c"));
    }
    // Mullions and broken glass panes with cyan edges
    const frame = rgba("#2b2e48");
    for (const dx of [-37, 0, 37]) fill(px, rect(wx + dx - 2, wTop + 10, 4, wBottom - wTop - 10), frame);
    fill(px, rect(wx - wr, 120, wr * 2, 4), frame);
    // Remaining glass: jagged shards still clinging to the frame and mullions (the rest is shattered).
    const glassFill = rgba("#2a5a78", 210), glassHi = rgba("#9fdcef", 230);
    const anchors = [];
    for (let a = 0.05; a < 0.96; a += 0.06) anchors.push([wx - Math.cos(a * Math.PI) * (wr - 1), wTop + wr - Math.sin(a * Math.PI) * (wr - 1), Math.PI / 2 + (a - 0.5) * Math.PI]);
    for (let y = wTop + wr + 6; y < wBottom - 4; y += 12) { anchors.push([wx - wr + 1, y, 0]); anchors.push([wx + wr - 1, y, Math.PI]); }
    for (const dx of [-37, 0, 37]) for (let y = wTop + 22; y < wBottom - 8; y += 15) anchors.push([wx + dx + (hash2(dx, y) < 0.5 ? 2 : -2), y, hash2(dx, y) < 0.5 ? 0 : Math.PI]);
    anchors.forEach(([ax, ay, ang], i) => {
        if (hash2(i, 13) < 0.3) return;
        const len = 5 + hash2(i, 14) * 13, wid = 3 + hash2(i, 15) * 5, tw = (hash2(i, 16) - 0.5) * 0.9;
        const dx = Math.cos(ang + tw), dy = Math.sin(ang + tw);
        const pts = [[ax - dy * wid, ay + dx * wid], [ax + dx * len, ay + dy * len], [ax + dy * wid * 0.6, ay - dx * wid * 0.6]];
        fill(px, poly(pts), glassFill);
        line(px, pts[0][0], pts[0][1], pts[1][0], pts[1][1], glassHi);
        if (hash2(i, 17) < 0.4) px.set(Math.round(ax + dx * len * 0.5), Math.round(ay + dy * len * 0.5), C.cyan2);
    });
    // Columns
    for (const cx of [60, 420]) {
        fill(px, rect(cx - 14, 20, 28, 250), rgba("#24263c"));
        line(px, cx - 14, 20, cx - 14, 270, rgba("#353852"));
        line(px, cx + 13, 20, cx + 13, 270, rgba("#14152a"));
        fill(px, rect(cx - 18, 16, 36, 8), rgba("#2e3150"));
        for (let y = 40; y < 228; y += 24) line(px, cx - 13, y, cx + 12, y, rgba("#1a1c30"));
        // cyan rune
        for (let k = 0; k < 4; k++) px.set(cx - 1 + (k % 2), 100 + k * 3, C.cyan1);
    }
    // Floor-level shadow
    for (let y = 196; y < 270; y++) for (let x = 0; x < 480; x++) if (px.get(x, y) && dither(x, y, (y - 196) / 40)) px.set(x, y, rgba("#0c0c18"));
    return px;
}

function arenaBackdrop() {
    return pxToCanvas(arenaBackdropPx());
}

// ---------------------------------------------------------------- props

function sheetProp(frames, fps, loop = true) {
    const fw = frames[0].w, fh = frames[0].h;
    return { sheet: framesToSheet(frames, fw, fh, frames.length), frameWidth: fw, frameHeight: fh, frames: frames.map((_, i) => i), fps, loop };
}

function flame(px, cx, by, t, scale, ramp3) {
    const hgt = 9 * scale;
    for (let y = 0; y < hgt; y++) {
        const k = y / hgt;
        const wob = Math.sin(t * 6.28 + y * 0.6) * k * 1.4;
        const w = (1 - k) * 3.2 * scale * (0.85 + 0.15 * Math.sin(t * 6.28 * 2 + y));
        for (let x = Math.floor(cx - w + wob); x <= Math.ceil(cx + w + wob); x++) {
            const d = Math.abs(x - (cx + wob)) / Math.max(w, 0.5);
            px.set(x, Math.round(by - y), d < 0.4 && k < 0.6 ? ramp3[0] : d < 0.75 ? ramp3[1] : ramp3[2]);
        }
    }
}

function shrine() {
    const frames = [];
    for (let f = 0; f < 6; f++) {
        const px = new Px(32, 48);
        const t = f / 6;
        // Glow halo
        for (let y = 2; y < 30; y++) for (let x = 2; x < 30; x++) {
            const d = Math.hypot(x - 16, y - 16);
            if (d < 11 && d > 5 && dither(x + f, y, (1 - d / 11) * 0.22)) px.set(x, y, rgba("#4a3418"));
        }
        paint(px, poly([[4, 47], [6, 41], [26, 41], [28, 47]]), R.stone);
        paint(px, rect(11, 26, 10, 15), R.stone, { sep: C.sep });
        paint(px, poly([[7, 26], [9, 23], [23, 23], [25, 26]]), R.stone, { sep: C.sep });
        paint(px, poly([[8, 12], [24, 12], [22, 23], [10, 23]]), R.stoneDark, { sep: C.sep });
        paint(px, poly([[7, 12], [16, 6], [25, 12]]), R.stone, { sep: C.sep });
        fill(px, rect(11, 14, 10, 8), rgba("#2a1608"));
        flame(px, 16, 21, t, 0.85, [C.gold4, C.gold3, C.gold2]);
        outline(px, C.outline);
        // carved glyph
        px.set(15, 31, C.gold1); px.set(16, 32, C.gold1); px.set(15, 33, C.gold1); px.set(16, 34, C.gold1);
        frames.push(px);
    }
    return sheetProp(frames, 8);
}

function veil() {
    const frames = [];
    for (let f = 0; f < 8; f++) {
        const px = new Px(32, 96);
        const t = f / 8;
        for (let y = 6; y < 96; y++) {
            for (let x = 5; x < 27; x++) {
                const n = Math.sin(x * 0.7 + t * 6.28) * 0.5 + Math.sin(y * 0.18 - t * 6.28 * 2 + x * 0.3) * 0.5;
                const edge = Math.min(x - 5, 26 - x) / 6;
                const v = (n * 0.5 + 0.5) * Math.min(1, edge) * (y < 14 ? (y - 6) / 8 : 1);
                if (dither(x, y + f, v * 0.9)) px.set(x, y, rgba(v > 0.75 ? "#e6fbff" : v > 0.45 ? "#8fe6f5" : "#3fa7c0", v > 0.75 ? 230 : 170));
            }
        }
        paint(px, rect(1, 4, 4, 92), R.stone);
        paint(px, rect(27, 4, 4, 92), R.stone);
        paint(px, poly([[0, 6], [16, 0], [32, 6], [32, 9], [16, 4], [0, 9]]), R.stone);
        px.set(16, 2, C.cyan2);
        frames.push(px);
    }
    return sheetProp(frames, 10);
}

function glassShard() {
    const px = new Px(12, 6);
    paint(px, poly([[0, 3], [4, 0.5], [12, 2.6], [4, 5.5]]), R.glass);
    line(px, 2, 3, 10, 3, C.cyan3);
    return { sprite: pxToCanvas(px) };
}

function shockwave() {
    const frames = [];
    for (let f = 0; f < 4; f++) {
        const px = new Px(24, 16);
        const h = [6, 12, 15, 9][f];
        for (let x = 0; x < 24; x++) {
            const k = 1 - Math.abs(x - 12) / 12;
            const top = 16 - Math.round(h * Math.sqrt(k));
            for (let y = top; y < 16; y++) {
                const edge = y - top;
                if (edge === 0) px.set(x, y, C.cyan3);
                else if (edge < 2) px.set(x, y, C.cyan2);
                else if (dither(x + f, y, 0.55 - edge * 0.05)) px.set(x, y, C.cyan1);
            }
        }
        for (let i = 0; i < 6; i++) px.set(Math.floor(hash2(i, f) * 24), 15 - Math.floor(hash2(f, i) * 6), rgba("#6a6f8c"));
        frames.push(px);
    }
    return sheetProp(frames, 16);
}

function fallingShard() {
    const px = new Px(10, 24);
    paint(px, poly([[1, 0], [9, 0], [6, 18], [5, 24], [4, 18]]), { hi: rgba("#ffeefa"), mid: rgba("#e7a2dc"), lo: rgba("#8a4f9a") });
    line(px, 5, 1, 5, 20, C.mag2);
    outline(px, C.outline);
    return { sprite: pxToCanvas(px) };
}

function rainMarker() {
    const frames = [];
    for (let f = 0; f < 4; f++) {
        const px = new Px(20, 6);
        const s = [0.6, 0.8, 1, 0.8][f];
        for (let y = 0; y < 6; y++) for (let x = 0; x < 20; x++) {
            const d = Math.hypot((x + 0.5 - 10) / (10 * s), (y + 0.5 - 3) / (3 * s));
            if (d > 1) continue;
            px.set(x, y, d > 0.75 ? C.red2 : dither(x, y + f, 0.5 * s) ? C.red1 : 0);
            if (d < 0.25) px.set(x, y, C.red3);
        }
        frames.push(px);
    }
    return sheetProp(frames, 8);
}

function wall(gate) {
    const px = new Px(24, 200);
    for (let y = 0; y < 200; y++) for (let x = 0; x < 24; x++) {
        const row = Math.floor(y / 12), off = row % 2 ? 6 : 0;
        const mortar = y % 12 === 0 || (x + off) % 12 === 0;
        px.set(x, y, rgba(mortar ? "#12131f" : hash2((x + off) >> 3, row, 2) < 0.5 ? "#2f3248" : "#2a2d42"));
    }
    for (let y = 0; y < 200; y++) { px.set(0, y, rgba("#474b66")); px.set(23, y, rgba("#16172a")); }
    fill(px, rect(0, 0, 24, 6), rgba("#474b66"));
    if (gate) {
        fill(px, rect(3, 120, 18, 80), rgba("#07070e"));
        for (let x = 4; x < 21; x += 4) { line(px, x, 118, x, 199, rgba("#5a5e78")); line(px, x + 1, 118, x + 1, 199, rgba("#2a2c3e")); }
        for (let y = 130; y < 200; y += 14) line(px, 3, y, 20, y, rgba("#4a4e68"));
        // Seal sigil
        for (const [x, y] of [[12, 150], [11, 151], [13, 151], [10, 152], [14, 152], [11, 153], [13, 153], [12, 154], [12, 148], [12, 156], [8, 152], [16, 152]]) px.set(x, y, C.cyan2);
    } else {
        for (let k = 0; k < 6; k++) px.set(11 + (k % 2), 90 + k * 4, C.cyan1);
    }
    return { sprite: pxToCanvas(px) };
}

function statue() {
    const px = new Px(36, 60);
    const S = R.stone, D = R.stoneDark;
    paint(px, rect(2, 50, 32, 10), D);
    paint(px, poly([[8, 50], [10, 34], [24, 34], [28, 50]]), S, { sep: C.sep });
    paint(px, ellipse(16, 30, 8, 6), S, { sep: C.sep });
    paint(px, ellipse(17, 20, 5, 5.5), S, { sep: C.sep });
    paint(px, capsule(22, 26, 26, 40, 2.2, 2), S, { sep: C.sep });
    paint(px, capsule(26, 14, 26, 50, 1.2, 0.8), R.stone, { sep: C.sep });
    paint(px, capsule(21, 16, 31, 16, 1, 1), D, { sep: C.sep });
    for (let i = 0; i < 40; i++) {
        const x = Math.floor(hash2(i, 1, 9) * 36), y = Math.floor(hash2(i, 2, 9) * 60);
        if (px.get(x, y) && px.get(x, y - 1) === 0) px.set(x, y, rgba("#4f6a4a"));
    }
    outline(px, C.outline);
    return { sprite: pxToCanvas(px) };
}

function brokenPillar() {
    const px = new Px(24, 66);
    paint(px, rect(1, 58, 22, 8), R.stoneDark);
    paint(px, poly([[4, 58], [4, 14], [9, 8], [12, 12], [16, 4], [20, 16], [20, 58]]), R.stone, { sep: C.sep });
    for (const x of [8, 12, 16]) line(px, x, 16, x, 57, rgba("#2f3248"));
    paint(px, poly([[0, 66], [3, 61], [8, 63], [6, 66]]), R.stoneDark);
    outline(px, C.outline);
    return { sprite: pxToCanvas(px) };
}

function chains() {
    const px = new Px(8, 80);
    for (let y = 0; y < 76; y += 5) {
        if ((y / 5) % 2) { line(px, 3, y, 3, y + 5, rgba("#5a5e78")); line(px, 4, y, 4, y + 5, rgba("#2a2c3e")); }
        else { fill(px, ellipse(3.5, y + 2.5, 2.5, 3), rgba("#5a5e78")); fill(px, ellipse(3.5, y + 2.5, 1, 1.5), 0); }
    }
    fill(px, capsule(3.5, 76, 3.5, 79, 2, 1), rgba("#3a3d55"));
    return { sprite: pxToCanvas(px) };
}

function banner() {
    const px = new Px(16, 48);
    paint(px, capsule(0, 2, 16, 2, 1.2, 1.2), R.stoneDark);
    const pts = [[2, 3], [14, 3], [14, 40], [12, 46], [10, 41], [8, 47], [6, 40], [4, 45], [2, 39]];
    paint(px, poly(pts), R.tabard, { sep: C.sep });
    for (let i = 0; i < 12; i++) {
        const x = 3 + Math.floor(hash2(i, 4) * 10), y = 30 + Math.floor(hash2(i, 5) * 14);
        px.set(x, y, 0);
    }
    for (const [x, y] of [[8, 14], [7, 15], [9, 15], [8, 16], [8, 17], [6, 18], [10, 18], [8, 19], [8, 20]]) px.set(x, y, C.gold2);
    outline(px, C.outline);
    return { sprite: pxToCanvas(px) };
}

function candles() {
    const frames = [];
    for (let f = 0; f < 3; f++) {
        const px = new Px(16, 14);
        for (const [x, h] of [[3, 6], [8, 9], [12, 5]]) {
            fill(px, rect(x - 1, 14 - h, 3, h), rgba("#d8cfb8"));
            px.set(x - 1, 14 - h, rgba("#f0e8d0"));
            const fl = (f + x) % 3;
            px.set(x, 13 - h, C.gold3); px.set(x, 12 - h, fl ? C.gold4 : C.gold2);
            if (fl === 1) px.set(x, 11 - h, C.gold2);
        }
        frames.push(px);
    }
    return sheetProp(frames, 6);
}

function rubble() {
    const px = new Px(32, 10);
    for (let i = 0; i < 9; i++) {
        const x = 2 + hash2(i, 1) * 28, r = 1.5 + hash2(i, 2) * 2.8;
        paint(px, ellipse(x, 10 - r * 0.8, r, r * 0.8), hash2(i, 3) < 0.5 ? R.stone : R.stoneDark);
    }
    outline(px, C.outline);
    return { sprite: pxToCanvas(px) };
}

// ---------------------------------------------------------------- stage 1 additions

// The Keep's open entrance: stone arch with raised portcullis, doors folded open, dark passage inside.
function keepGate() {
    const px = new Px(80, 140);
    const W = 80, H = 140, inX0 = 18, inX1 = 62, archTop = 30;
    const inside = (x, y) => x >= inX0 && x < inX1 && (y > archTop + 22 || Math.hypot(x + 0.5 - 40, (y - (archTop + 22)) * 1.0) < 22);
    // Masonry
    for (let y = 8; y < H; y++) for (let x = 2; x < W - 2; x++) {
        if (inside(x, y)) continue;
        const row = Math.floor(y / 8), off = row % 2 ? 6 : 0;
        const mortar = y % 8 === 0 || (x + off) % 12 === 0;
        const sh = hash2(Math.floor((x + off) / 12), row, 21);
        px.set(x, y, rgba(mortar ? "#1e2032" : sh < 0.35 ? "#474b66" : sh < 0.75 ? "#3d4158" : "#525773"));
    }
    // Battlements
    for (let k = 0; k < 6; k++) fill(px, rect(2 + k * 13, 0, 9, 9), rgba(k % 2 ? "#474b66" : "#3d4158"));
    // Dark passage with depth
    gradient(px, inX0, archTop, inX1 - inX0, H - archTop, ["#0b0b14", "#0e0f1c", "#090911"]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inside(x, y) && px.get(x, y) === rgba("#0b0b14")) px.set(x, y, 0);
    for (let y = archTop; y < H; y++) for (let x = inX0; x < inX1; x++) {
        if (!inside(x, y)) { if (px.get(x, y) && (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1))) px.set(x, y, rgba("#6a6f8c")); continue; }
    }
    // Raised portcullis teeth at the top of the passage
    for (let x = inX0 + 3; x < inX1 - 2; x += 5) {
        for (let y = archTop + 4; y < archTop + 18; y++) if (inside(x, y)) px.set(x, y, rgba("#2b2e48"));
        px.set(x, archTop + 18, rgba("#5a5e78"));
    }
    for (let x = inX0; x < inX1; x++) if (inside(x, archTop + 12)) px.set(x, archTop + 12, rgba("#2b2e48"));
    // Doors folded open against the jambs
    for (const [x0, x1] of [[inX0, inX0 + 6], [inX1 - 6, inX1]]) {
        fill(px, rect(x0, 58, x1 - x0, H - 58), rgba("#3a2a20"));
        for (let y = 58; y < H; y += 9) line(px, x0, y, x1 - 1, y, rgba("#241912"));
        line(px, x0, 58, x0, H - 1, rgba("#5a4232"));
        for (const y of [70, 110]) { px.set(x0 + 2, y, rgba("#9196b0")); px.set(x0 + 3, y, rgba("#9196b0")); }
    }
    // Keystone with a mirror emblem
    fill(px, poly([[34, 24], [46, 24], [44, 33], [36, 33]]), rgba("#6a6f8c"));
    fill(px, ellipse(40, 28.5, 2.6, 3), rgba("#9fdcef"));
    px.set(39, 27, C.cyan3); px.set(40, 28, C.cyan2);
    // Moss and cracks
    for (let i = 0; i < 70; i++) {
        const x = 2 + Math.floor(hash2(i, 31) * 76), y = 8 + Math.floor(hash2(i, 32) * 130);
        if (px.get(x, y) && !px.get(x, y - 1)) px.set(x, y, rgba("#4f6a4a"));
    }
    line(px, 8, 40, 12, 60, rgba("#1e2032")); line(px, 12, 60, 10, 75, rgba("#1e2032"));
    line(px, 70, 90, 66, 104, rgba("#1e2032"));
    outline(px, C.outline);
    return { sprite: pxToCanvas(px) };
}

// A wooden practice post wrapped in straw, notched by sword strikes.
function trainingPost() {
    const px = new Px(20, 40);
    paint(px, rect(8, 6, 4, 34), R.leather, { sep: C.sep });
    paint(px, capsule(2, 12, 18, 12, 1.4, 1.4), R.leather, { sep: C.sep });
    const straw = { hi: rgba("#c9b77a"), mid: rgba("#9a8a54"), lo: rgba("#6a5e38") };
    paint(px, ellipse(10, 21, 5.4, 7.5), straw, { sep: C.sep });
    for (let y = 15; y < 28; y += 3) line(px, 6, y, 14, y + 1, rgba("#5a4e30"));
    for (const [x, y] of [[8, 18], [12, 23], [9, 26]]) { px.set(x, y, rgba("#3a3020")); px.set(x + 1, y + 1, rgba("#3a3020")); }
    paint(px, poly([[4, 40], [7, 36], [13, 36], [16, 40]]), R.stoneDark);
    outline(px, C.outline);
    return { sprite: pxToCanvas(px) };
}

// An inscription stone with a faintly pulsing cyan rune.
function tablet() {
    const frames = [];
    const runes = [[11, 9], [10, 10], [12, 10], [11, 11], [11, 12], [9, 13], [13, 13], [11, 14], [11, 15], [10, 17], [12, 17], [11, 18]];
    for (let f = 0; f < 3; f++) {
        const px = new Px(22, 30);
        paint(px, poly([[2, 30], [3, 26], [19, 26], [20, 30]]), R.stoneDark);
        paint(px, poly([[4, 26], [4, 7], [7, 3], [11, 2], [15, 3], [18, 7], [18, 26]]), R.stone, { sep: C.sep });
        for (let i = 0; i < 14; i++) {
            const x = 5 + Math.floor(hash2(i, 41) * 12), y = 6 + Math.floor(hash2(i, 42) * 19);
            if (px.get(x, y)) px.set(x, y, rgba(hash2(i, 43) < 0.5 ? "#3d4158" : "#525773"));
        }
        for (let y = 21; y < 25; y++) line(px, 6, y, 16, y, rgba(y % 2 ? "#3d4158" : "#2f3248"));
        outline(px, C.outline);
        const glow = [C.cyan0, C.cyan1, C.cyan2][f];
        for (const [x, y] of runes) px.set(x, y, glow);
        if (f === 2) { px.set(11, 8, C.cyan3); px.set(11, 16, C.cyan3); }
        frames.push(px);
    }
    return sheetProp([frames[0], frames[1], frames[2], frames[1]], 3);
}

// A tiny shard lying on the road with a travelling glint.
function roadShard() {
    const frames = [];
    for (let f = 0; f < 4; f++) {
        const px = new Px(10, 6);
        fill(px, poly([[1, 5], [4, 2], [8, 1], [9, 4], [6, 5]]), rgba("#4f88a8"));
        line(px, 2, 4, 7, 2, rgba("#9fdcef"));
        const gx = [3, 5, 7, -1][f];
        if (gx > 0) { px.set(gx, 3 - (gx > 5 ? 1 : 0), C.white); px.set(gx, 2 - (gx > 5 ? 1 : 0), C.cyan3); }
        if (f === 3) px.set(8, 1, C.cyan3);
        frames.push(px);
    }
    return sheetProp(frames, 4);
}

// Backdrop for the Pale Squire's arena: an open-air training courtyard of the Outer Ward.
function yardBackdrop() {
    const px = new Px(480, 270);
    const wallRows = (x0, x1, yTop, seed) => {
        for (let x = x0; x < x1; x++) {
            const crumble = Math.floor(hash2(Math.floor(x / 3), seed, 51) * 10) + (hash2(Math.floor(x / 9), seed, 52) < 0.3 ? 12 : 0);
            for (let y = yTop + crumble; y < 228; y++) {
                const row = Math.floor(y / 9), off = row % 2 ? 7 : 0;
                const mortar = y % 9 === 0 || (x + off) % 14 === 0;
                const sh = hash2(Math.floor((x + off) / 14), row, seed);
                px.set(x, y, rgba(mortar ? "#10111c" : sh < 0.3 ? "#22243a" : sh < 0.7 ? "#1d1f33" : "#262940"));
            }
        }
    };
    // Back courtyard wall, broken into sections at different heights (sky shows above)
    wallRows(0, 140, 120, 3);
    wallRows(140, 200, 150, 4);
    wallRows(200, 300, 104, 5);
    wallRows(300, 350, 160, 6);
    wallRows(350, 480, 112, 7);
    // An arched opening in the middle section (transparent → far layers show through)
    for (let y = 120; y < 228; y++) for (let x = 224; x < 276; x++) {
        const inArch = y > 150 ? Math.abs(x - 250) < 18 : Math.hypot(x - 250, y - 150) < 18;
        if (inArch) px.set(x, y, 0);
        else if ((y > 150 ? Math.abs(x - 250) < 20 : Math.hypot(x - 250, y - 150) < 20) && px.get(x, y)) px.set(x, y, rgba("#3a3e5c"));
    }
    // Wall coping highlights
    for (let x = 0; x < 480; x++) {
        for (let y = 90; y < 228; y++) if (px.get(x, y)) { px.set(x, y, rgba("#3a3e5c")); if (px.get(x, y + 1)) px.set(x, y + 1, rgba("#2c2f48")); break; }
    }
    // Weapon rack (left): a frame with spears and swords
    fill(px, rect(56, 176, 46, 4), rgba("#4a3328"));
    fill(px, rect(56, 206, 46, 4), rgba("#4a3328"));
    fill(px, rect(56, 176, 3, 52), rgba("#3a281e"));
    fill(px, rect(99, 176, 3, 52), rgba("#3a281e"));
    for (let k = 0; k < 6; k++) {
        const x = 62 + k * 7;
        line(px, x, 160 - (k % 2) * 6, x, 226, rgba(k % 3 === 0 ? "#6a5a4a" : "#5a4a3a"));
        if (k % 2) { fill(px, poly([[x - 1, 160], [x, 152], [x + 1, 160]]), rgba("#9196b0")); }
        else { line(px, x, 166, x, 150, rgba("#a9b3cc")); line(px, x - 2, 166, x + 2, 166, rgba("#7a6a5a")); }
    }
    // Training dummies standing in the yard
    const dummy = (cx) => {
        fill(px, rect(cx - 1, 182, 3, 46), rgba("#3a281e"));
        fill(px, rect(cx - 11, 190, 23, 3), rgba("#3a281e"));
        fill(px, ellipse(cx + 0.5, 198, 7, 10), rgba("#6a5e38"));
        for (let y = 190; y < 208; y += 3) line(px, cx - 5, y, cx + 6, y + 1, rgba("#4f4428"));
        fill(px, ellipse(cx + 0.5, 183, 4.5, 4.5), rgba("#7a6c44"));
        px.set(cx - 1, 182, rgba("#2a2418")); px.set(cx + 2, 182, rgba("#2a2418"));
    };
    dummy(150); dummy(372);
    // A torn banner on a pole (right)
    fill(px, rect(420, 132, 2, 96), rgba("#3a281e"));
    fill(px, poly([[422, 136], [440, 136], [440, 170], [434, 164], [430, 172], [426, 162], [422, 168]]), rgba("#2c4280"));
    for (let i = 0; i < 6; i++) px.set(426 + (i % 3) * 4, 145 + i * 3, rgba("#e0b050"));
    // Ivy on the wall
    for (let i = 0; i < 160; i++) {
        const x = Math.floor(hash2(i, 61) * 480), y = 130 + Math.floor(hash2(i, 62) * 90);
        if (px.get(x, y) && hash2(i, 63) < 0.7) { px.set(x, y, rgba("#2e4a30")); if (px.get(x, y + 1)) px.set(x, y + 1, rgba("#3e5e3a")); }
    }
    // Ground shadow
    for (let y = 200; y < 228; y++) for (let x = 0; x < 480; x++) if (px.get(x, y) && dither(x, y, (y - 200) / 40)) px.set(x, y, rgba("#0c0c18"));
    return pxToCanvas(px);
}

export function buildWorldArt() {
    return {
        tiles: { floor: floorTile(false), arenaFloor: floorTile(true) },
        backgrounds: { sky: sky(), far: farStrip(), mid: midStrip(), arenaBackdrop: arenaBackdrop(), yardBackdrop: yardBackdrop() },
        props: {
            shrine: shrine(), veil: veil(),
            shard: glassShard(), shockwave: shockwave(), fallingShard: fallingShard(), rainMarker: rainMarker(),
            arenaWall: wall(false), gate: wall(true),
            statue: statue(), brokenPillar: brokenPillar(), chains: chains(), banner: banner(), candles: candles(), rubble: rubble(),
            keepGate: keepGate(), trainingPost: trainingPost(), tablet: tablet(), roadShard: roadShard(),
        },
    };
}

