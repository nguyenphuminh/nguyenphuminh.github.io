// Story UI (BRD 2.2.12): dialogue box, skip ring, inscription panel, mob health bars and the Arrival
// shard vision. All screen-space 480×270 except drawMobBar (world-space).
import { drawText, measureText, LINE_HEIGHT } from "./font.js";
import { C } from "./palette.js";
import { Px, hash2, pxToCanvas, rgba } from "./pixel.js";

const W = 480, H = 270;

function wrap(text, maxWidth) {
    const out = [];
    for (const para of String(text).split("\n")) {
        let line = "";
        for (const word of para.split(" ")) {
            const next = line ? `${line} ${word}` : word;
            if (line && measureText(next) > maxWidth) {
                out.push(line);
                line = word;
            } else line = next;
        }
        out.push(line);
    }
    return out;
}

function panel(ctx, x, y, w, h) {
    ctx.fillStyle = "#07060c";
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = "rgba(11, 10, 20, 0.94)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#4a4366";
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = "#2a2640";
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
}

/** Dialogue box across the bottom: portrait, speaker name, the typed part of the line, a blinking marker. */
export function drawDialogue(ctx, { name = "", portrait = null, text = "", shown = Infinity, color = "#f2c46b" } = {}) {
    const x = 8, y = 196, w = 464, h = 66;
    panel(ctx, x, y, w, h);
    let tx = x + 10;
    if (portrait) {
        ctx.drawImage(portrait, x + 8, y + 13, 40, 40);
        tx = x + 56;
    }
    if (name) drawText(ctx, name, tx, y + 7, { color });
    const lines = wrap(text, x + w - 12 - tx);
    let left = Math.max(0, Math.floor(shown));
    lines.slice(0, 4).forEach((ln, i) => {
        if (left <= 0) return;
        drawText(ctx, ln.slice(0, left), tx, y + 21 + i * (LINE_HEIGHT + 1), { color: "#e8e6f0" });
        left -= ln.length + 1;
    });
    if (shown >= text.length && Math.floor(performance.now() / 380) % 2 === 0) {
        const mx = x + w - 13, my = y + h - 10;
        ctx.fillStyle = color;
        ctx.fillRect(mx, my, 5, 1);
        ctx.fillRect(mx + 1, my + 1, 3, 1);
        ctx.fillRect(mx + 2, my + 2, 1, 1);
    }
}

/** "Hold Esc to skip" with a pixel ring that fills with the hold progress (drawn only while holding). */
export function drawSkipRing(ctx, progress, label = "Hold Esc to skip") {
    if (!(progress > 0)) return;
    const cx = 463, cy = 14, steps = 64;
    for (let i = 0; i < steps; i++) {
        const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
        const on = i / steps < progress;
        ctx.fillStyle = on ? "#e8e6f0" : "#3a3550";
        for (const r of [6, 7]) ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
    drawText(ctx, label, 451, 10, { align: "right", color: "#b8b4cc" });
}

let tabletCanvas = null;
function tabletTexture() {
    if (tabletCanvas) return tabletCanvas;
    const tw = 300, th = 156;
    const px = new Px(tw, th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
        const corner = (y < 10 && (x < 10 - y || x > tw - 11 + y));
        if (corner) continue;
        const n = hash2(x >> 2, y >> 2, 91), f = hash2(x, y, 92);
        px.set(x, y, rgba(f < 0.06 ? "#1c1e2e" : n < 0.33 ? "#2c2f45" : n < 0.66 ? "#2f3248" : "#33364d"));
    }
    // carved border and highlights
    for (let x = 6; x < tw - 6; x++) { px.set(x, 6, rgba("#1a1c2c")); px.set(x, 7, rgba("#474b66")); px.set(x, th - 7, rgba("#1a1c2c")); px.set(x, th - 6, rgba("#474b66")); }
    for (let y = 6; y < th - 6; y++) { px.set(6, y, rgba("#1a1c2c")); px.set(7, y, rgba("#474b66")); px.set(tw - 7, y, rgba("#1a1c2c")); px.set(tw - 6, y, rgba("#474b66")); }
    for (let x = 0; x < tw; x++) for (let y = 0; y < th; y++) if (px.get(x, y) && !px.get(x, y - 1)) { px.set(x, y, rgba("#5a5f7c")); break; }
    for (let i = 0; i < 9; i++) px.set(tw / 2 - 4 + i, 22, C.cyan1);
    tabletCanvas = pxToCanvas(px);
    return tabletCanvas;
}

/** A stone tablet in the middle of the screen for reading an inscription. */
export function drawInscription(ctx, { title = "", text = "" } = {}) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, W, H);
    const x = 90, y = 52;
    ctx.drawImage(tabletTexture(), x, y);
    drawText(ctx, title, W / 2, y + 12, { align: "center", color: "#f2c46b" });
    wrap(text, 256).slice(0, 9).forEach((ln, i) => drawText(ctx, ln, x + 22, y + 32 + i * (LINE_HEIGHT + 1), { color: "#d8d4e8" }));
    drawText(ctx, "[F] / [Esc] Close", W / 2, y + 140, { align: "center", color: "#8d88a6" });
}

/** World-space: a tiny health bar centred at x, with its top at y. */
export function drawMobBar(ctx, x, y, frac) {
    const w = 20, x0 = Math.round(x - w / 2), y0 = Math.round(y);
    const f = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = "#07060c";
    ctx.fillRect(x0 - 1, y0 - 1, w + 2, 4);
    ctx.fillStyle = "#3a1018";
    ctx.fillRect(x0, y0, w, 2);
    const fw = Math.round(w * f);
    if (fw > 0) {
        ctx.fillStyle = "#e8323c";
        ctx.fillRect(x0, y0, fw, 2);
        ctx.fillStyle = "#ff8a8a";
        ctx.fillRect(x0, y0, fw, 1);
    }
}

// ---------------------------------------------------------------- Arrival shard vision

let vision = null; // { real, ghost, cold } knight close-up canvases, set by buildArt
let shardLayers = null;
const SHARD = [[150, 46], [256, 20], [336, 78], [322, 224], [204, 252], [136, 170]];

export function setVisionFace(face) {
    vision = face;
}

function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

function buildShardLayers() {
    const glass = new Px(W, H), edges = new Px(W, H), vignette = new Px(W, H);
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dither = (x, y, t) => t * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (inPoly(x + 0.5, y + 0.5, SHARD)) {
            const t = (y - 20) / 232;
            glass.set(x, y, rgba(dither(x, y, t) ? "#071622" : "#0e2a3c"));
            const edge = !inPoly(x - 1.5, y + 0.5, SHARD) || !inPoly(x + 2.5, y + 0.5, SHARD) || !inPoly(x + 0.5, y - 1.5, SHARD) || !inPoly(x + 0.5, y + 2.5, SHARD);
            if (edge) edges.set(x, y, rgba(y < 120 ? "#c8fbff" : "#4f88a8"));
        }
        const d = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2));
        if (d > 0.7 && dither(x, y, Math.min(1, (d - 0.7) / 0.45))) vignette.set(x, y, rgba("#000000"));
    }
    // A few cracks across the shard
    const crack = (pts) => {
        for (let i = 1; i < pts.length; i++) {
            const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
            const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
            for (let k = 0; k <= n; k++) edges.set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), rgba("#9fdcef", 200));
        }
    };
    crack([[256, 20], [244, 62], [262, 96]]);
    crack([[136, 170], [170, 176], [184, 204]]);
    crack([[322, 224], [298, 196], [306, 168], [292, 150]]);
    shardLayers = { glass: pxToCanvas(glass), edges: pxToCanvas(edges), vignette: pxToCanvas(vignette) };
}

const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
// The knight's head movement over a 4 s loop: still, turn one way, hold, turn the other way, return.
function visionPose(t) {
    const u = ((t % 4) + 4) % 4;
    const keys = [[0, 0, 0], [0.6, 0, 0], [1.3, 14, -2], [2.0, 14, -2], [2.7, -10, 1], [3.4, 0, 0], [4, 0, 0]];
    for (let i = 1; i < keys.length; i++) {
        if (u <= keys[i][0]) {
            const [t0, x0, y0] = keys[i - 1], [t1, x1, y1] = keys[i];
            const k = ease((u - t0) / Math.max(1e-6, t1 - t0));
            return { dx: x0 + (x1 - x0) * k, dy: y0 + (y1 - y0) * k };
        }
    }
    return { dx: 0, dy: 0 };
}

/** Full-screen Arrival close-up: the knight's reflection in a shard moves a beat after the real knight. */
export function drawShardVision(ctx, t) {
    if (!shardLayers) buildShardLayers();
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#05040a";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
        const sx = Math.floor(hash2(i, 101) * W), sy = Math.floor(hash2(i, 102) * H);
        if (Math.floor(t * 2 + i) % 7 !== 0) {
            ctx.fillStyle = i % 3 ? "#1b2440" : "#2a3a60";
            ctx.fillRect(sx, sy, 1, 1);
        }
    }
    ctx.drawImage(shardLayers.glass, 0, 0);

    ctx.save();
    ctx.beginPath();
    SHARD.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    if (vision) {
        const fw = vision.cold.width, fh = vision.cold.height;
        const baseX = 236 - fw / 2, baseY = 150 - fh / 2;
        const real = visionPose(t), refl = visionPose(t - 0.45);
        // The reflection (cold, glowing visor) lags behind…
        ctx.globalAlpha = 0.95;
        ctx.drawImage(vision.cold, Math.round(baseX + refl.dx * 1.6), Math.round(baseY + refl.dy * 1.6));
        // …the ghost of where the knight actually is.
        ctx.globalAlpha = 0.14;
        ctx.drawImage(vision.ghost, Math.round(baseX + real.dx * 1.6), Math.round(baseY + real.dy * 1.6));
        ctx.globalAlpha = 1;
    }
    // A glint sweeping across the glass every loop
    const g = ((t % 4) + 4) % 4 / 4;
    ctx.fillStyle = "rgba(200, 251, 255, 0.10)";
    for (let k = 0; k < 14; k++) {
        const gx = Math.round(80 + g * 360 + k);
        ctx.fillRect(gx, 0, 1, H);
    }
    ctx.restore();

    ctx.drawImage(shardLayers.edges, 0, 0);
    ctx.drawImage(shardLayers.vignette, 0, 0);
    ctx.imageSmoothingEnabled = prev;
}

