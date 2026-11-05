// Stage 2 environment: the Hall of Panes, a long interior hall of broken mirrors and stained glass.
// Cooler blues and violet with stained-glass colour. All generated.
import { C, R } from "./palette.js";
import { Px, capsule, ellipse, fill, framesToSheet, hash2, line, outline, paint, poly, pxToCanvas, ramp, rect, rgba } from "./pixel.js";
import { arenaBackdropPx, dither, gradient } from "./world-art.js";

const W2 = 960;
const IRON = ramp("#5a5e78", "#3a3d55", "#24263a");
const FRAME = ramp("#6a6290", "#463e66", "#2a2442");
const GLASS = R.glass;

function sheetProp(frames, fps, loop = true) {
    const fw = frames[0].w, fh = frames[0].h;
    return { sheet: framesToSheet(frames, fw, fh, frames.length), frameWidth: fw, frameHeight: fh, frames: frames.map((_, i) => i), fps, loop };
}

// Lancet (pointed-arch) mask: centre x, top of the straight sides, bottom, half width.
function inLancet(x, y, cx, top, bottom, hw) {
    if (y > bottom) return false;
    if (y >= top) return Math.abs(x + 0.5 - cx) <= hw;
    // Pointed arch: two circles of radius 2*hw centred at the opposite sides.
    const r = hw * 2, dy = top - (y + 0.5);
    if (dy > Math.sqrt(3) * hw) return false;
    const dl = Math.hypot(x + 0.5 - (cx - hw), dy), dr = Math.hypot(x + 0.5 - (cx + hw), dy);
    return dl <= r && dr <= r;
}

const STAIN = ["#2a4f8a", "#3a2f7a", "#5a2f6a", "#2f6a7a", "#7a2f4f", "#3f5aa0", "#6a3f8a"].map((h) => rgba(h));
const STAIN_HI = ["#6a9ae0", "#7a6ad0", "#b070c0", "#6ac8d8", "#d0709a", "#90a8f0", "#b090e0"].map((h) => rgba(h));

// ---------------------------------------------------------------- backgrounds

// Dark vaulted interior with a high distant window glinting with the Great Mirror.
function hallSky() {
    const px = new Px(480, 270);
    gradient(px, 0, 0, 480, 270, ["#06050d", "#0b0a18", "#121228", "#181a34", "#1d2040"]);
    // Ribbed vault: pointed ribs converging toward the top centre
    const rib = rgba("#232744"), ribHi = rgba("#2f3456");
    for (let k = -6; k <= 6; k++) {
        const x0 = 240 + k * 64, x1 = 240 + k * 10;
        for (let t = 0; t <= 1; t += 0.004) {
            const x = x0 + (x1 - x0) * t, y = 150 - Math.sin(t * Math.PI * 0.5) * 140;
            px.set(Math.round(x), Math.round(y), rib);
            px.set(Math.round(x) + 1, Math.round(y), ribHi);
        }
    }
    // A cross rib arc
    for (let x = 0; x < 480; x++) {
        const y = Math.round(40 + Math.pow((x - 240) / 240, 2) * 70);
        px.set(x, y, rib); px.set(x, y + 1, rgba("#151830"));
    }
    // The high distant window (narrow lancet) with the Great Mirror's glint
    const cx = 240, top = 46, bottom = 104, hw = 9;
    for (let y = 20; y <= bottom + 2; y++) for (let x = cx - hw - 3; x <= cx + hw + 3; x++) {
        if (inLancet(x, y, cx, top, bottom, hw)) {
            const t = (y - 20) / (bottom - 20);
            px.set(x, y, rgba(t < 0.3 ? "#3a4e7a" : t < 0.7 ? "#2c3a62" : "#22304e"));
        } else if (inLancet(x, y, cx, top, bottom, hw + 2)) px.set(x, y, rgba("#2a2e4c"));
    }
    line(px, cx, 32, cx, bottom, rgba("#1a1e36"));
    for (let y = 62; y < bottom; y += 14) line(px, cx - hw, y, cx + hw, y, rgba("#1a1e36"));
    // Glint of the Great Mirror deep inside the window
    const gx = 243, gy = 74;
    for (const [dx, dy, c] of [[0, 0, "#ffffff"], [-1, 0, "#c8fbff"], [1, 0, "#c8fbff"], [0, -1, "#c8fbff"], [0, 1, "#c8fbff"], [-2, 0, "#5ff0ff"], [2, 0, "#5ff0ff"], [0, -2, "#5ff0ff"], [0, 2, "#5ff0ff"], [0, -3, "#2fb8cc"], [0, 3, "#2fb8cc"]]) px.set(gx + dx, gy + dy, rgba(c));
    // Soft light falling from the window
    for (let y = bottom; y < 270; y++) {
        const spread = (y - bottom) * 0.35 + hw;
        for (let x = Math.floor(cx - spread); x <= cx + spread; x++) {
            const k = 1 - Math.abs(x - cx) / spread;
            if (dither(x, y, k * 0.16 * (1 - (y - bottom) / 200))) px.set(x, y, rgba("#2a3358"));
        }
    }
    // Dust motes
    for (let i = 0; i < 90; i++) {
        const x = Math.floor(hash2(i, 1, 33) * 480), y = Math.floor(hash2(i, 2, 33) * 250);
        px.set(x, y, rgba(hash2(i, 3, 33) < 0.2 ? "#6a78a8" : "#30385c"));
    }
    return pxToCanvas(px);
}

// Tall stained-glass windows and broken mirror panes along the far wall (tileable, 960 wide).
function hallFar() {
    const px = new Px(W2, 270);
    const wallTop = 70, floor = 232;
    // Wall masonry band (sky shows above it)
    for (let y = wallTop; y < 270; y++) for (let x = 0; x < W2; x++) {
        const row = Math.floor(y / 11), off = row % 2 ? 9 : 0;
        const mortar = y % 11 === 0 || (x + off) % 18 === 0;
        const sh = hash2(Math.floor((x + off) / 18) % (W2 / 18), row, 3);
        px.set(x, y, rgba(mortar ? "#0b0b16" : sh < 0.4 ? "#161829" : sh < 0.8 ? "#13152a" : "#1a1c30"));
    }
    // Crenellated top of the wall
    for (let x = 0; x < W2; x++) if (Math.floor(x / 12) % 2 === 0) for (let y = wallTop - 5; y < wallTop; y++) px.set(x, y, rgba("#161829"));
    // Windows every 160 px
    for (let k = 0; k < 6; k++) {
        const cx = 80 + k * 160, hw = 20, top = 118, bottom = 214;
        const mirror = k === 2 || k === 5; // broken mirror panes instead of stained glass
        for (let y = 40; y <= bottom + 3; y++) for (let x = cx - hw - 4; x <= cx + hw + 4; x++) {
            if (inLancet(x, y, cx, top, bottom, hw)) {
                const cell = Math.floor((x - cx + hw) / 8) + Math.floor(y / 12) * 7;
                if (mirror) {
                    const t = ((x - cx + hw) + (bottom - y) * 0.6) / 70;
                    px.set(x, y, rgba(t % 0.33 < 0.05 ? "#c8d4e8" : dither(x, y, 0.4) ? "#5a6a88" : "#46526e"));
                } else {
                    const ci = Math.floor(hash2(cell, k, 7) * STAIN.length);
                    const lit = (y - 40) / (bottom - 40) < 0.5 && hash2(cell, k, 8) < 0.5;
                    px.set(x, y, lit && dither(x, y, 0.4) ? STAIN_HI[ci] : STAIN[ci]);
                }
            } else if (inLancet(x, y, cx, top, bottom, hw + 3)) {
                px.set(x, y, rgba(x < cx ? "#2c2a48" : "#1e1c34"));
            }
        }
        // Lead / mullions
        for (let y = 40; y <= bottom; y++) for (let x = cx - hw; x <= cx + hw; x++) {
            if (!inLancet(x, y, cx, top, bottom, hw)) continue;
            if ((x - cx + hw) % 8 === 0 || y % 12 === 0) px.set(x, y, rgba(mirror ? "#2a3048" : "#0e0c1a"));
        }
        line(px, cx, 36, cx, bottom, rgba("#24223c"));
        if (mirror) {
            // Cracks and missing pieces in the mirror panes
            for (let i = 0; i < 6; i++) {
                const sx = cx - hw + 4 + hash2(i, k, 9) * (hw * 2 - 8), sy = top + hash2(i, k, 10) * 80;
                const ang = hash2(i, k, 11) * Math.PI * 2, len = 6 + hash2(i, k, 12) * 14;
                line(px, sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, rgba("#0e1020"));
            }
            for (let i = 0; i < 3; i++) {
                const sx = cx - hw + 6 + hash2(i, k, 14) * (hw * 2 - 12), sy = top + 10 + hash2(i, k, 15) * 70;
                fill(px, poly([[sx, sy], [sx + 6, sy + 2], [sx + 3, sy + 9]]), rgba("#0a0a14"));
            }
        }
        // Sill
        fill(px, rect(cx - hw - 6, bottom + 2, hw * 2 + 12, 4), rgba("#22243a"));
        line(px, cx - hw - 6, bottom + 2, cx + hw + 5, bottom + 2, rgba("#30334e"));
    }
    // Pilasters between windows
    for (let k = 0; k < 6; k++) {
        const x = k * 160;
        fill(px, rect(x - 7, wallTop - 8, 14, floor - wallTop + 40), rgba("#1a1c30"));
        line(px, x - 7, wallTop - 8, x - 7, 270, rgba("#262a44"));
        line(px, x + 6, wallTop - 8, x + 6, 270, rgba("#0e0f1c"));
    }
    // Floor-level darkness
    for (let y = 200; y < 270; y++) for (let x = 0; x < W2; x++) if (px.get(x, y) && dither(x, y, (y - 200) / 50)) px.set(x, y, rgba("#08080f"));
    return pxToCanvas(px);
}

// Pillars with hanging chains and mirror shards (tileable, 960 wide, transparent between).
function hallMid() {
    const px = new Px(W2, 270);
    const stone = rgba("#0f1022"), rim = rgba("#262a48"), dark = rgba("#090a16");
    const pillars = [60, 300, 540, 780];
    for (const cx of pillars) {
        fill(px, rect(cx - 14, 0, 28, 236), stone);
        line(px, cx - 14, 0, cx - 14, 236, rim);
        line(px, cx + 13, 0, cx + 13, 236, dark);
        for (const x of [cx - 6, cx + 2]) line(px, x, 30, x, 210, rgba("#151830"));
        // Capital and base
        fill(px, rect(cx - 19, 24, 38, 8), stone); line(px, cx - 19, 24, cx + 18, 24, rim);
        fill(px, rect(cx - 18, 212, 36, 24), stone); line(px, cx - 18, 212, cx + 17, 212, rim);
        // A cracked mirror plate set into the pillar
        fill(px, rect(cx - 8, 80, 16, 34), rgba("#2a3450"));
        line(px, cx - 8, 80, cx + 7, 80, rgba("#5a6a90"));
        line(px, cx - 5, 84, cx + 4, 108, rgba("#8fa0c8"));
        line(px, cx + 2, 86, cx - 3, 96, rgba("#0e1020"));
    }
    // Chains strung between pillars, with mirror shards dangling from them
    for (let i = 0; i < pillars.length; i++) {
        const a = pillars[i] + 14, b = (pillars[(i + 1) % pillars.length] - 14 + (i === pillars.length - 1 ? W2 : 0));
        const sag = 34 + hash2(i, 1, 44) * 14;
        for (let x = a; x <= b; x++) {
            const t = (x - a) / (b - a), y = 46 + Math.sin(t * Math.PI) * sag;
            const xx = x % W2;
            px.set(xx, Math.round(y), rgba(x % 3 ? "#3a3d58" : "#24263c"));
        }
        for (let s = 0; s < 3; s++) {
            const t = 0.25 + s * 0.25 + (hash2(i, s, 45) - 0.5) * 0.1;
            const x = Math.round(a + (b - a) * t) % W2, y0 = Math.round(46 + Math.sin(t * Math.PI) * sag);
            const len = 10 + Math.floor(hash2(i, s, 46) * 18);
            line(px, x, y0, x, y0 + len, rgba("#2a2c42"));
            const sy = y0 + len;
            fill(px, poly([[x - 3, sy], [x + 3, sy + 1], [x + 1, sy + 9], [x - 1, sy + 8]]), rgba("#3a4a6a"));
            px.set(x, sy + 2, rgba("#c8d8f0")); px.set(x + 1, sy + 3, rgba("#8fa8d0"));
        }
    }
    // Low balustrade
    for (let x = 0; x < W2; x++) {
        px.set(x, 214, rim); px.set(x, 215, stone); px.set(x, 216, stone);
        if (x % 20 < 5) for (let y = 217; y < 236; y++) px.set(x, y, stone);
    }
    for (let x = 0; x < W2; x++) for (let y = 232; y < 270; y++) px.set(x, y, dark);
    return pxToCanvas(px);
}

// ---------------------------------------------------------------- tiles

// Polished dark stone with an inlaid glass line and a diamond of glass in each slab.
function hallFloor() {
    const px = new Px(32, 42);
    gradient(px, 0, 0, 32, 42, ["#2a2c48", "#1b1c32", "#111222", "#09090f"]);
    for (let x = 0; x < 32; x++) {
        px.set(x, 0, rgba("#6a6c96"));
        px.set(x, 1, rgba("#46486a"));
        px.set(x, 6, rgba("#3a6a8a"));
        if (dither(x, 10, 0.3)) px.set(x, 10, rgba("#34365a"));
    }
    for (let y = 2; y < 42; y++) px.set(31, y, rgba("#0c0c18"));
    for (let y = 2; y < 28; y++) if (dither(0, y, 0.25)) px.set(0, y, rgba("#34365a"));
    // Small glass inlay
    fill(px, poly([[16, 14], [18.5, 16.5], [16, 19], [13.5, 16.5]]), rgba("#24405a"));
    px.set(15, 15, rgba("#6aa0c0")); px.set(16, 16, rgba("#3a6a8a"));
    px.set(10, 6, rgba("#5a9ab8"));
    return pxToCanvas(px);
}

// A narrow stone bridge over a dark drop: the deck on top, a corbel under it, the void below.
function bridgeFloor() {
    const px = new Px(32, 42);
    gradient(px, 0, 12, 32, 30, ["#07070e", "#05050a", "#030306"]);
    // Deck
    gradient(px, 0, 0, 32, 9, ["#5a5e7c", "#3e4260", "#2a2c44"]);
    for (let x = 0; x < 32; x++) {
        px.set(x, 0, rgba("#7a7f9c"));
        px.set(x, 9, rgba("#14152a"));
        px.set(x, 10, rgba("#1c1e34"));
        px.set(x, 11, rgba("#101120"));
    }
    for (const x of [0, 16]) for (let y = 1; y < 9; y++) px.set(x, y, rgba("#1c1e34"));
    for (let i = 0; i < 6; i++) px.set(Math.floor(hash2(i, 51) * 32), 2 + Math.floor(hash2(i, 52) * 6), rgba("#2a2c44"));
    // Corbel under the deck
    fill(px, poly([[10, 12], [22, 12], [19, 20], [13, 20]]), rgba("#1c1e34"));
    line(px, 10, 12, 13, 20, rgba("#2e3150"));
    // Mist far below
    for (let y = 26; y < 42; y++) for (let x = 0; x < 32; x++) if (dither(x, y, ((y - 26) / 16) * 0.35)) px.set(x, y, rgba("#151730"));
    return pxToCanvas(px);
}

// ---------------------------------------------------------------- props

// Free-standing tall mirror: dark ornate frame on feet; the glass is dark and partly transparent so the
// game can draw a reflection inside it. Glass rectangle: MIRROR_PANE_GLASS (sprite top-left relative).
export const MIRROR_PANE_GLASS = { x: 7, y: 10, w: 22, h: 56 };
function mirrorPane() {
    const px = new Px(36, 76);
    const g = MIRROR_PANE_GLASS;
    // Feet and frame
    paint(px, poly([[4, 76], [8, 70], [12, 70], [10, 76]]), IRON);
    paint(px, poly([[26, 76], [24, 70], [28, 70], [32, 76]]), IRON);
    paint(px, rect(g.x - 4, g.y - 4, g.w + 8, g.h + 8), FRAME, { sep: C.sep });
    paint(px, poly([[g.x - 4, g.y - 4], [18, 0], [g.x + g.w + 4, g.y - 4]]), FRAME, { sep: C.sep });
    px.set(18, 3, C.cyan2);
    // Glass (cut out, then filled semi-transparent)
    for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) {
        const t = (y - g.y) / g.h;
        const streak = ((x - g.x) + (y - g.y) * 0.5) % 18;
        let c = rgba(t < 0.5 ? "#1a2238" : "#121a2c", 150);
        if (streak < 1.2) c = rgba("#9fb4d8", 120);
        else if (streak < 2.2 && dither(x, y, 0.5)) c = rgba("#4a5a80", 130);
        px.set(x, y, c);
    }
    // Inner bevel
    for (let x = g.x; x < g.x + g.w; x++) { px.set(x, g.y, rgba("#6a7aa0", 200)); px.set(x, g.y + g.h - 1, rgba("#0c0e1a", 220)); }
    for (let y = g.y; y < g.y + g.h; y++) { px.set(g.x, y, rgba("#5a6a90", 200)); px.set(g.x + g.w - 1, y, rgba("#0c0e1a", 220)); }
    // A crack across the lower glass
    line(px, g.x + 3, g.y + 40, g.x + 12, g.y + 34, rgba("#c8d8f0", 200));
    line(px, g.x + 12, g.y + 34, g.x + 19, g.y + 44, rgba("#c8d8f0", 180));
    outline(px, C.outline);
    return { sprite: pxToCanvas(px), glass: { ...g } };
}

function candelabra() {
    const frames = [];
    for (let f = 0; f < 3; f++) {
        const px = new Px(16, 40);
        paint(px, poly([[3, 40], [6, 36], [10, 36], [13, 40]]), IRON);
        paint(px, rect(7, 14, 2, 23), IRON);
        paint(px, capsule(2, 15, 14, 15, 1, 1), IRON);
        for (const x of [2, 8, 14]) paint(px, rect(x - 1, x === 8 ? 8 : 10, 2, x === 8 ? 6 : 5), ramp("#f0e8d0", "#d8cfb8", "#a89e86"));
        outline(px, C.outline);
        for (const [x, top] of [[2, 10], [8, 8], [14, 10]]) {
            const fl = (f + x) % 3;
            px.set(x, top - 1, C.gold3); px.set(x, top - 2, fl ? C.gold4 : C.gold2);
            if (fl === 1) px.set(x, top - 3, C.gold2);
        }
        frames.push(px);
    }
    return sheetProp(frames, 7);
}

function brokenMirror() {
    const px = new Px(30, 20);
    // A broken frame corner lying on the floor
    paint(px, poly([[2, 20], [2, 9], [5, 9], [5, 17], [14, 17], [14, 20]]), FRAME, { sep: C.sep });
    // Mirror shards
    const shards = [[[8, 20], [12, 12], [15, 20]], [[15, 20], [20, 14], [22, 20]], [[22, 20], [25, 16], [28, 20]], [[6, 16], [9, 11], [11, 15]]];
    shards.forEach((pts, i) => {
        paint(px, poly(pts), i % 2 ? GLASS : ramp("#d8e4f4", "#8a9cc0", "#4a5a80"), { sep: C.sep });
    });
    outline(px, C.outline);
    px.set(12, 14, C.white); px.set(20, 16, C.cyan3); px.set(25, 18, C.white);
    return { sprite: pxToCanvas(px) };
}

// The Mirrorwright's anvil of glass on a dark stone block, faintly glowing.
function glassAnvil() {
    const px = new Px(40, 24);
    paint(px, poly([[8, 24], [10, 16], [30, 16], [32, 24]]), R.stoneDark, { sep: C.sep });
    paint(px, poly([[13, 16], [15, 11], [26, 11], [28, 16]]), R.obsidianDark, { sep: C.sep });
    // Glass anvil body with a horn
    paint(px, poly([[2, 5], [8, 4], [32, 4], [38, 2], [36, 6], [30, 9], [10, 9], [6, 8]]), GLASS, { sep: C.sep });
    paint(px, poly([[12, 9], [28, 9], [26, 12], [14, 12]]), GLASS, { sep: C.sep });
    outline(px, C.outline);
    line(px, 9, 5, 31, 5, C.white);
    for (const [x, y] of [[17, 7], [22, 6], [27, 7], [20, 10]]) px.set(x, y, C.cyan2);
    // Faint glow above the face
    for (let i = 0; i < 10; i++) {
        const x = 8 + Math.floor(hash2(i, 61) * 24), y = Math.floor(hash2(i, 62) * 3);
        if (!px.get(x, y)) px.set(x, y, i % 3 ? C.cyan1 : C.cyan2);
    }
    return { sprite: pxToCanvas(px) };
}

// The arena's back wall cracked open onto a lit stair leading up (after the Mirrorwright falls).
function arenaBackdropOpen() {
    const px = arenaBackdropPx();
    const hole = [[320, 228], [314, 214], [318, 204], [311, 192], [319, 180], [316, 166], [324, 156], [321, 144], [333, 136], [338, 124],
        [348, 128], [356, 116], [366, 124], [374, 120], [378, 134], [386, 140], [382, 154], [389, 166], [385, 180], [393, 192], [388, 206], [392, 216], [386, 228]];
    const shape = poly(hole);
    const inside = (x, y) => shape.test(x + 0.5, y + 0.5);
    // Light from the stair
    for (let y = 110; y < 230; y++) for (let x = 300; x < 400; x++) {
        if (!inside(x, y)) continue;
        const t = (y - 116) / 112;
        px.set(x, y, rgba(t < 0.25 ? "#6fa6bc" : t < 0.55 ? dither(x, y, 0.5) ? "#4a7e96" : "#3e6e86" : "#2a4a60"));
    }
    // Steps ascending to the right, lit faces facing the viewer
    for (let s = 0; s < 9; s++) {
        const sy = 226 - s * 11, sx = 320 + s * 7;
        for (let y = sy - 11; y < sy; y++) for (let x = sx; x < 392; x++) {
            if (!inside(x, y)) continue;
            px.set(x, y, rgba(y < sy - 9 ? "#8fc6d8" : y < sy - 7 ? "#5a92aa" : "#203a4e"));
        }
        for (let x = sx; x < 392; x++) if (inside(x, sy - 11)) px.set(x, sy - 11, rgba("#c8f0f8"));
    }
    // Jagged rim and cracks running out from the hole
    for (let y = 110; y < 230; y++) for (let x = 300; x < 400; x++) {
        if (inside(x, y)) continue;
        if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) px.set(x, y, rgba("#5a6080"));
    }
    for (const [x0, y0, x1, y1] of [[334, 128, 318, 98], [318, 98, 326, 74], [372, 126, 396, 102], [396, 102, 404, 80], [312, 196, 290, 190], [392, 192, 412, 200]]) {
        line(px, x0, y0, x1, y1, rgba("#0a0a14"));
        line(px, x0 + 1, y0, x1 + 1, y1, rgba("#3e7088"));
    }
    // Rubble at the foot of the hole
    for (let i = 0; i < 12; i++) {
        const x = 300 + hash2(i, 71) * 100, r = 2 + hash2(i, 72) * 4;
        fill(px, ellipse(x, 228 - r * 0.6, r, r * 0.7), rgba(hash2(i, 73) < 0.5 ? "#2f3248" : "#1e2032"));
        px.set(Math.round(x), Math.round(228 - r * 1.2), rgba("#474b66"));
    }
    return pxToCanvas(px);
}

export function buildHallArt() {
    return {
        tiles: { hallFloor: hallFloor(), bridgeFloor: bridgeFloor() },
        backgrounds: { hallSky: hallSky(), hallFar: hallFar(), hallMid: hallMid(), arenaBackdropOpen: arenaBackdropOpen() },
        props: { mirrorPane: mirrorPane(), candelabra: candelabra(), brokenMirror: brokenMirror(), glassAnvil: glassAnvil() },
    };
}
