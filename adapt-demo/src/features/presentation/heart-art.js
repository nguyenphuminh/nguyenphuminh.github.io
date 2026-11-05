// Stage 3 environment: the Silvered Heart (the mirror chamber around the Great Mirror; silver, white and cyan)
// and the ending's dawn. All generated.
import { C, R } from "./palette.js";
import { Px, capsule, ellipse, fill, framesToSheet, hash2, line, outline, paint, poly, pxToCanvas, ramp, rect, rgba } from "./pixel.js";
import { dither, gradient } from "./world-art.js";

const W2 = 960;
const SILVER = ramp("#e4ecf6", "#a8b6cc", "#64728c");
const SILVER_DARK = ramp("#a8b6cc", "#6a7892", "#3e4a62");

function sheetProp(frames, fps, loop = true) {
    const fw = frames[0].w, fh = frames[0].h;
    return { sheet: framesToSheet(frames, fw, fh, frames.length), frameWidth: fw, frameHeight: fh, frames: frames.map((_, i) => i), fps, loop };
}

// A kneeling or standing knight silhouette (frozen behind glass), drawn with a single colour.
function knightSilhouette(px, x, floor, scale, pose, color) {
    const s = scale;
    const kneel = pose === "kneel", reach = pose === "reach";
    const hipY = floor - (kneel ? 10 : 15) * s;
    fill(px, capsule(x, hipY, x + (kneel ? 6 : 1) * s, floor - (kneel ? 4 : 7) * s, 2 * s, 1.8 * s), color);
    fill(px, capsule(x + (kneel ? 6 : 1) * s, floor - (kneel ? 4 : 7) * s, x + (kneel ? 6 : 1) * s, floor, 1.6 * s, 1.4 * s), color);
    fill(px, capsule(x - 1 * s, hipY, x - (kneel ? 5 : 2) * s, floor, 1.8 * s, 1.4 * s), color);
    fill(px, capsule(x, hipY, x + 1 * s, hipY - 10 * s, 3.2 * s, 3.6 * s), color);
    fill(px, ellipse(x + 1.5 * s, hipY - 13.5 * s, 3.2 * s, 3.4 * s), color);
    fill(px, capsule(x + 3 * s, hipY - 13 * s, x - 3 * s, hipY - 18 * s, 1 * s, 0.5 * s), color); // crest
    if (reach) fill(px, capsule(x + 2 * s, hipY - 9 * s, x + 11 * s, hipY - 15 * s, 1.2 * s, 1 * s), color);
    else fill(px, capsule(x + 2 * s, hipY - 9 * s, x + 5 * s, hipY - 2 * s, 1.2 * s, 1 * s), color);
    // sword
    if (!reach) line(px, x + 5 * s, hipY - 2 * s, x + 6 * s, floor, color);
}

// ---------------------------------------------------------------- backgrounds

// Silver-white vaulted chamber lit by cyan light from above.
function heartSky() {
    const px = new Px(480, 270);
    gradient(px, 0, 0, 480, 270, ["#0f1420", "#1c2434", "#2e3a4e", "#46566e", "#5a6c86"]);
    // Central brightness behind where the Great Mirror stands
    for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) {
        const d = Math.hypot((x - 240) / 1.6, y - 150) / 170;
        if (d < 1 && dither(x, y, (1 - d) * 0.45)) px.set(x, y, rgba(d < 0.45 ? "#8a9cb6" : "#6c7e98"));
    }
    // Vault ribs in pale silver
    for (let k = -5; k <= 5; k++) {
        const x0 = 240 + k * 70, x1 = 240 + k * 8;
        for (let t = 0; t <= 1; t += 0.004) {
            const x = x0 + (x1 - x0) * t, y = 160 - Math.sin(t * Math.PI * 0.5) * 150;
            px.set(Math.round(x), Math.round(y), rgba("#8a98b0"));
            px.set(Math.round(x) + 1, Math.round(y), rgba("#4a586e"));
        }
    }
    // Cyan light shafts falling diagonally
    for (const [sx, w] of [[140, 26], [250, 34], [350, 22]]) {
        for (let y = 0; y < 230; y++) {
            const cx = sx + y * 0.25;
            for (let x = Math.floor(cx - w / 2); x <= cx + w / 2; x++) {
                const k = 1 - Math.abs(x - cx) / (w / 2);
                if (dither(x, y, k * 0.28 * (1 - y / 300))) px.set(x, y, rgba("#9fe4f0"));
            }
        }
    }
    // Glints
    for (let i = 0; i < 70; i++) {
        const x = Math.floor(hash2(i, 1, 91) * 480), y = Math.floor(hash2(i, 2, 91) * 220);
        px.set(x, y, rgba(hash2(i, 3, 91) < 0.3 ? "#ffffff" : "#c8fbff"));
    }
    return pxToCanvas(px);
}

// Mirror walls with frozen silhouettes of fallen knights behind the glass (tileable, 960 wide).
function heartFar() {
    const px = new Px(W2, 270);
    const top = 60, floor = 232;
    const panelW = 100;
    for (let k = 0; k < W2 / 120; k++) {
        const x0 = k * 120 + 10, x1 = x0 + panelW;
        // Frame
        fill(px, rect(x0 - 4, top - 6, panelW + 8, floor - top + 12), rgba("#4a586e"));
        for (let x = x0 - 4; x < x1 + 4; x++) px.set(x, top - 6, rgba("#c8d4e4"));
        // Glass: cool silver gradient with diagonal sheen
        for (let y = top; y < floor; y++) for (let x = x0; x < x1; x++) {
            const t = (y - top) / (floor - top);
            const sheen = ((x - x0) - (y - top) * 0.5 + 400) % 70;
            let c = t < 0.4 ? "#3e4e66" : t < 0.75 ? "#34425a" : "#2a364c";
            if (sheen < 3) c = "#8ea2bc";
            else if (sheen < 6 && dither(x, y, 0.5)) c = "#5a6c86";
            px.set(x, y, rgba(c));
        }
        // A frozen knight inside the glass, a little closer to the surface in each panel
        const poses = ["stand", "kneel", "reach", "stand", "kneel", "reach", "stand", "kneel"];
        const sc = 1.6 + (k % 3) * 0.2;
        knightSilhouette(px, x0 + 40 + (k % 2) * 16, floor - 4, sc, poses[k % poses.length], rgba(k % 2 ? "#1e2638" : "#222c40"));
        // Edge shine on the silhouette side facing the light (read from a snapshot so it does not cascade)
        const snap = px.data.slice();
        const sil = (c) => c === rgba("#1e2638") || c === rgba("#222c40");
        for (let y = top; y < floor; y++) for (let x = x0 + 1; x < x1; x++) {
            if (sil(snap[y * W2 + x]) && !sil(snap[y * W2 + x - 1])) px.set(x, y, rgba("#5a6c86"));
        }
        // Cracks on some panels
        if (k % 3 === 1) {
            for (let i = 0; i < 5; i++) {
                const sx = x0 + 20 + hash2(i, k, 3) * 60, sy = top + 30 + hash2(i, k, 4) * 120;
                const ang = hash2(i, k, 5) * Math.PI * 2, len = 10 + hash2(i, k, 6) * 18;
                line(px, sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len, rgba("#c8d8ec"));
            }
        }
    }
    // Floor-level shadow
    for (let y = 205; y < 270; y++) for (let x = 0; x < W2; x++) if (px.get(x, y) && dither(x, y, (y - 205) / 45)) px.set(x, y, rgba("#141a26"));
    return pxToCanvas(px);
}

// Mirror pillars with glass facets and hanging shards on threads (tileable, 960 wide).
function heartMid() {
    const px = new Px(W2, 270);
    for (const cx of [100, 420, 740]) {
        for (let y = 0; y < 236; y++) for (let x = cx - 16; x < cx + 16; x++) {
            const facet = Math.floor((x - cx + 16) / 8);
            const shade = ["#3e4a62", "#6a7892", "#a8b6cc", "#5a6880"][facet];
            px.set(x, y, rgba(facet === 2 && ((y + 7) % 72) === 0 ? "#c8d4e4" : shade));
        }
        line(px, cx - 16, 0, cx - 16, 236, rgba("#1c2232"));
        line(px, cx + 15, 0, cx + 15, 236, rgba("#1c2232"));
        fill(px, rect(cx - 21, 26, 42, 7), rgba("#4a586e")); line(px, cx - 21, 26, cx + 20, 26, rgba("#c8d4e4"));
        fill(px, rect(cx - 20, 212, 40, 24), rgba("#3e4a62")); line(px, cx - 20, 212, cx + 19, 212, rgba("#a8b6cc"));
        px.set(cx - 4, 120, C.cyan3); px.set(cx + 4, 160, C.cyan2);
    }
    // Hanging shards on threads
    for (let i = 0; i < 22; i++) {
        const x = Math.floor(hash2(i, 1, 101) * W2), len = 20 + Math.floor(hash2(i, 2, 101) * 90);
        line(px, x, 0, x, len, rgba("#4a586e"));
        const h = 6 + Math.floor(hash2(i, 3, 101) * 8);
        fill(px, poly([[x - 3, len], [x + 3, len + 1], [x, len + h]]), rgba("#8ea2bc"));
        px.set(x, len + 2, rgba("#ffffff"));
        line(px, x + 2, len + 1, x, len + h - 1, rgba("#3e4e66"));
    }
    for (let x = 0; x < W2; x++) for (let y = 232; y < 270; y++) px.set(x, y, rgba("#141a26"));
    return pxToCanvas(px);
}

// The Keep at dawn from outside: warm sunrise, the Keep on its cliff.
function dawnBackdrop() {
    const px = new Px(480, 270);
    gradient(px, 0, 0, 480, 200, ["#1b2448", "#3a3666", "#7a4a72", "#c86a5a", "#f0a860", "#ffd890"]);
    gradient(px, 0, 200, 480, 70, ["#ffd890", "#e8a868", "#7a4a52"]);
    // Sun half risen on the horizon with a halo
    const sx = 300, sy = 196, sr = 26;
    for (let y = sy - 90; y < sy + 10; y++) for (let x = sx - 120; x < sx + 120; x++) {
        const d = Math.hypot(x - sx, y - sy);
        if (d > sr && d < sr + 70 && dither(x, y, (1 - (d - sr) / 70) * 0.5)) px.set(x, y, rgba(d < sr + 20 ? "#fff0b8" : "#ffd890"));
    }
    fill(px, ellipse(sx, sy, sr, sr), rgba("#fff6d8"));
    fill(px, ellipse(sx, sy, sr - 4, sr - 4), rgba("#ffffff"));
    // Rays
    for (let a = -2.9; a < -0.2; a += 0.22) {
        for (let r = sr + 6; r < 200; r += 1) {
            const x = Math.round(sx + Math.cos(a) * r), y = Math.round(sy + Math.sin(a) * r);
            if (dither(x, y, 0.22 * (1 - r / 200))) px.set(x, y, rgba("#fff0c8"));
        }
    }
    // Lit clouds
    for (const [cx, cy, w] of [[110, 70, 150], [380, 52, 170], [230, 112, 120], [440, 132, 90]]) {
        for (let x = cx - w / 2; x < cx + w / 2; x++) {
            const t = 1 - Math.abs(x - cx) / (w / 2);
            for (let k = 0; k < 5; k++) {
                const y = cy + k + Math.round(Math.sin(x * 0.06 + cx) * 2);
                if (dither(Math.floor(x), y, t * (k < 2 ? 0.85 : 0.45))) px.set(Math.floor(x), y, rgba(k === 0 ? "#ffe0b0" : k < 3 ? "#e89a8a" : "#9a5a7a"));
            }
        }
    }
    // Distant hills
    for (let x = 0; x < 480; x++) {
        const h = 200 + Math.sin(x * 0.02) * 6 + Math.sin(x * 0.057 + 1) * 3;
        for (let y = Math.floor(h); y < 270; y++) px.set(x, y, rgba(y < h + 1 ? "#c87a6a" : "#7a4a5a"));
    }
    // The Keep on its cliff (left), in dark violet silhouette with the shattered great window glinting
    const keep = rgba("#2a1c3a"), rim = rgba("#e8a070");
    fill(px, poly([[0, 270], [0, 150], [40, 140], [80, 160], [120, 175], [150, 205], [170, 270]]), keep);
    for (const [tx, tw, th] of [[30, 18, 90], [62, 26, 120], [98, 16, 80], [12, 12, 60]]) {
        fill(px, rect(tx - tw / 2, 150 - th, tw, th + 10), keep);
        fill(px, poly([[tx - tw / 2 - 2, 150 - th], [tx, 150 - th - tw * 1.4], [tx + tw / 2 + 2, 150 - th]]), keep);
        line(px, tx + tw / 2, 150 - th, tx + tw / 2, 150, rim);
    }
    fill(px, ellipse(62, 72, 6, 8), rgba("#ffd890"));
    px.set(62, 70, rgba("#ffffff"));
    for (let x = 0; x < 170; x++) for (let y = 140; y < 270; y++) if (px.get(x, y) === keep && px.get(x + 1, y) !== keep && px.get(x + 1, y)) px.set(x, y, rim);
    // Birds
    for (const [bx, by] of [[200, 90], [214, 96], [226, 88], [340, 120]]) {
        px.set(bx - 1, by, rgba("#3a2a4a")); px.set(bx + 1, by, rgba("#3a2a4a")); px.set(bx, by + 1, rgba("#3a2a4a"));
    }
    return pxToCanvas(px);
}

// ---------------------------------------------------------------- tile

// A polished mirror-like floor: the top ~10 px are flat and dark so faint reflections read on it.
function heartFloor() {
    const px = new Px(32, 42);
    gradient(px, 0, 11, 32, 31, ["#28324a", "#1a2234", "#0e1320"]);
    for (let x = 0; x < 32; x++) {
        px.set(x, 0, rgba("#c8d4e4"));
        for (let y = 1; y < 11; y++) px.set(x, y, rgba(y === 1 ? "#4a586e" : "#1c2232"));
        px.set(x, 11, rgba("#3e4a62"));
    }
    for (let y = 12; y < 42; y++) px.set(31, y, rgba("#0a0e18"));
    // Faint mirror streaks below the reflective band
    for (let y = 14; y < 40; y++) for (let x = 0; x < 32; x++) if (((x + y) % 23) === 0) px.set(x, y, rgba("#46566e"));
    px.set(8, 12, C.cyan1); px.set(24, 12, rgba("#8ea2bc"));
    return pxToCanvas(px);
}

// ---------------------------------------------------------------- props

// The Great Mirror: huge and ornate, its surface shimmering. Glass rectangle: GREAT_MIRROR_GLASS.
export const GREAT_MIRROR_GLASS = { x: 22, y: 34, w: 106, h: 148 };
const GM_W = 150, GM_H = 200;

function greatMirrorFrame(px) {
    const g = GREAT_MIRROR_GLASS;
    // Base / steps
    paint(px, poly([[6, 200], [12, 190], [138, 190], [144, 200]]), SILVER_DARK, { sep: C.sep });
    // Side pillars
    for (const x of [g.x - 14, g.x + g.w + 2]) {
        paint(px, rect(x, g.y - 6, 12, g.h + 14), SILVER, { sep: C.sep });
        for (let y = g.y + 6; y < g.y + g.h; y += 16) line(px, x + 1, y, x + 10, y, rgba("#64728c"));
        paint(px, rect(x - 2, g.y - 10, 16, 6), SILVER, { sep: C.sep });
    }
    // Inner frame
    paint(px, rect(g.x - 3, g.y - 3, g.w + 6, g.h + 6), SILVER_DARK, { sep: C.sep });
    // Crown arch on top with spikes
    paint(px, poly([[g.x - 14, g.y - 8], [g.x + 10, 14], [75, 4], [g.x + g.w - 10, 14], [g.x + g.w + 14, g.y - 8]]), SILVER, { sep: C.sep });
    for (const [x, h] of [[40, 14], [58, 20], [75, 30], [92, 20], [110, 14]]) {
        const base = 18 - (x === 75 ? 10 : 0) + Math.abs(x - 75) * 0.15;
        paint(px, poly([[x - 3, base + 6], [x, base - h + 6], [x + 3, base + 6]]), R.glass, { sep: C.sep });
    }
    paint(px, ellipse(75, 20, 6, 6), R.glass, { sep: C.sep });
}

function greatMirrorGlass(px, f, cracked) {
    const g = GREAT_MIRROR_GLASS;
    for (let y = g.y; y < g.y + g.h; y++) for (let x = g.x; x < g.x + g.w; x++) {
        const t = (y - g.y) / g.h;
        const band = ((x - g.x) * 0.8 - (y - g.y) * 0.45 + f * 26 + 600) % 90;
        let c = rgba(t < 0.3 ? "#4a5e7a" : t < 0.7 ? "#3a4c66" : "#2e3e56", 230);
        if (band < 4) c = rgba("#c8e4f4", 230);
        else if (band < 8 && dither(x + f, y, 0.55)) c = rgba("#7c94b4", 230);
        else if (band > 40 && band < 43 && dither(x, y + f, 0.4)) c = rgba("#5ff0ff", 200);
        px.set(x, y, c);
    }
    // Fallen knights frozen faintly inside
    const ghost = rgba("#26344c", 230);
    knightSilhouette(px, g.x + 24, g.y + g.h - 8, 2.2, "kneel", ghost);
    knightSilhouette(px, g.x + 56, g.y + g.h - 6, 2.6, "stand", ghost);
    knightSilhouette(px, g.x + 84, g.y + g.h - 8, 2.2, "reach", ghost);
    if (cracked) {
        const cx = 76, cy = 104;
        for (let i = 0; i < 11; i++) {
            const a = (i / 11) * Math.PI * 2 + hash2(i, 5, 111) * 0.4;
            let x = cx, y = cy;
            for (let s = 0; s < 4; s++) {
                const len = 10 + hash2(i, s, 112) * 16;
                const nx = x + Math.cos(a + (hash2(i, s, 113) - 0.5) * 0.7) * len, ny = y + Math.sin(a + (hash2(i, s, 113) - 0.5) * 0.7) * len;
                if (nx < g.x || nx >= g.x + g.w || ny < g.y || ny >= g.y + g.h) break;
                line(px, x, y, nx, ny, rgba("#ffffff"));
                line(px, x + 1, y, nx + 1, ny, rgba("#5ff0ff"));
                x = nx; y = ny;
            }
        }
        // Missing pieces show darkness behind
        for (let i = 0; i < 6; i++) {
            const a = hash2(i, 9, 114) * Math.PI * 2, r = 10 + hash2(i, 10, 114) * 30;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            fill(px, poly([[x, y], [x + 7, y + 3], [x + 2, y + 10], [x - 4, y + 5]]), rgba("#0a0e18", 240));
        }
        fill(px, ellipse(cx, cy, 4, 4), rgba("#ffffff"));
    }
}

function greatMirror(cracked) {
    const frames = [];
    for (let f = 0; f < 4; f++) {
        const px = new Px(GM_W, GM_H);
        greatMirrorFrame(px);
        outline(px, C.outline);
        greatMirrorGlass(px, f, cracked);
        frames.push(px);
    }
    const prop = sheetProp(frames, cracked ? 4 : 5);
    prop.glass = { ...GREAT_MIRROR_GLASS };
    return prop;
}

function puddle() {
    const px = new Px(40, 6);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 40; x++) {
        const d = Math.hypot((x + 0.5 - 20) / 20, (y + 0.5 - 3) / 3);
        if (d > 1) continue;
        px.set(x, y, rgba(d > 0.82 ? "#5a3a4a" : y < 2 ? "#ffd890" : y < 4 ? "#e8a070" : "#9a5a6a"));
    }
    line(px, 10, 2, 22, 2, rgba("#fff6d8"));
    px.set(26, 3, rgba("#ffffff"));
    return { sprite: pxToCanvas(px) };
}

export function buildHeartArt() {
    return {
        tiles: { heartFloor: heartFloor() },
        backgrounds: { heartSky: heartSky(), heartFar: heartFar(), heartMid: heartMid(), dawnBackdrop: dawnBackdrop() },
        props: { greatMirror: greatMirror(false), greatMirrorCracked: greatMirror(true), puddle: puddle() },
    };
}
