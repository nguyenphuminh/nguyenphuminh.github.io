import { makeCanvas } from "../../shared/pixel.js";
import { PALETTE as P } from "../../shared/palette.js";
import { seeded, TAU, clamp } from "../../shared/math.js";

// Pixel-exact shapes for effects that would be tedious to hand-draw.

export function disc(ctx, cx, cy, r, color) {
    if (r < 0) return;
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
        const w = Math.floor(Math.sqrt((r + 0.5) ** 2 - y * y));
        ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
}

export function ring(ctx, cx, cy, r, thickness, color, dash = 0) {
    ctx.fillStyle = color;
    const outer = (r + 0.5) ** 2, inner = (r - thickness + 0.5) ** 2;
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            const d = x * x + y * y;
            if (d > outer || d <= inner) continue;
            if (dash && Math.floor(((Math.atan2(y, x) + Math.PI) * r) / dash) % 2) continue;
            ctx.fillRect(cx + x, cy + y, 1, 1);
        }
    }
}

export function orb(r, fill, shade, light) {
    const m = r + 1, c = makeCanvas(m * 2 + 1, m * 2 + 1), ctx = c.getContext("2d");
    disc(ctx, m, m, r + 1, P.k);
    disc(ctx, m, m, r, fill);
    ctx.fillStyle = shade;
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            if (x * x + y * y <= (r + 0.5) ** 2 && x + y > r * 0.55) ctx.fillRect(m + x, m + y, 1, 1);
        }
    }
    const hl = Math.max(1, r >> 1);
    ctx.fillStyle = light;
    ctx.fillRect(m - Math.ceil(r / 2), m - Math.ceil(r / 2), hl, hl);
    return c;
}

function line(ctx, pts, width, color) {
    ctx.fillStyle = color;
    for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= steps; s++) {
            const x = x0 + ((x1 - x0) * s) / steps, y = y0 + ((y1 - y0) * s) / steps;
            ctx.fillRect(Math.round(x - width / 2), Math.round(y - width / 2), width, width);
        }
    }
}

// A jagged lightning bolt whose bottom-center is the strike point.
export function bolt(h, seed, core = "#ffffff", glow = P.b) {
    const R = seeded(seed), w = 18, c = makeCanvas(w, h), ctx = c.getContext("2d");
    const pts = [];
    let x = w / 2;
    for (let y = 0; y < h; y += 7) {
        pts.push([x, y]);
        x = clamp(x + (R() - 0.5) * 10, 4, w - 4);
    }
    pts.push([w / 2, h - 2]);
    line(ctx, pts, 4, glow);
    line(ctx, pts, 2, core);
    return c;
}

// The Heavenly Tribulation: a brooding storm cloud with burning eyes.
export function stormCloud(crackle) {
    const w = 64, h = 36, c = makeCanvas(w, h), ctx = c.getContext("2d");
    const blobs = [[14, 21, 10], [26, 14, 12], [40, 13, 12], [51, 21, 10], [33, 23, 12], [20, 25, 8], [45, 26, 8]];
    for (const [x, y, r] of blobs) disc(ctx, x, y, r + 1, P.k);
    for (const [x, y, r] of blobs) disc(ctx, x, y, r, "#34304a");
    for (const [x, y, r] of blobs) disc(ctx, x - 1, y - 2, r - 3, "#474262");
    for (const [x, y, r] of blobs) disc(ctx, x - 2, y - 4, r - 7, "#5f5980");
    for (const ex of [24, 38]) {
        ctx.fillStyle = P.k;
        ctx.fillRect(ex - 1, 18, 8, 5);
        ctx.fillStyle = crackle ? "#ffffff" : P.v;
        ctx.fillRect(ex, 19, 6, 3);
        ctx.fillStyle = P.e;
        ctx.fillRect(ex + 2, 19, 2, 3);
    }
    if (crackle) {
        line(ctx, [[8, 28], [14, 31], [12, 33], [20, 34]], 1, P.v);
        line(ctx, [[44, 31], [50, 29], [49, 33], [56, 31]], 1, P.v);
        line(ctx, [[28, 30], [31, 34], [35, 31], [37, 35]], 1, "#ffffff");
    }
    return c;
}

// Rotating ring of lotus petals for the Lotus Flame aura (gold once evolved).
export function lotusRing(r, gold = false) {
    const m = r + 4, c = makeCanvas(m * 2 + 1, m * 2 + 1), ctx = c.getContext("2d");
    disc(ctx, m, m, r, gold ? "rgba(240, 194, 75, 0.12)" : "rgba(245, 120, 170, 0.10)");
    ring(ctx, m, m, r, 1, gold ? "rgba(255, 246, 168, 0.6)" : "rgba(255, 180, 210, 0.55)", 3);
    const petals = Math.max(6, Math.round(r / 5));
    for (let i = 0; i < petals; i++) {
        const a = (i / petals) * TAU;
        const px = Math.round(m + Math.cos(a) * r), py = Math.round(m + Math.sin(a) * r);
        disc(ctx, px, py, 2, gold ? P.g : P.m);
        ctx.fillStyle = "#fff";
        ctx.fillRect(px, py, 1, 1);
    }
    return c;
}

// Danger zone marker for boss attacks.
export function warnRing(r, rgb = "255, 70, 70") {
    const m = r + 1, c = makeCanvas(m * 2 + 1, m * 2 + 1), ctx = c.getContext("2d");
    disc(ctx, m, m, r, `rgba(${rgb}, 0.16)`);
    ring(ctx, m, m, r, 1, `rgba(${rgb}, 0.9)`, 3);
    return c;
}

export function ringFrames(r, color, count = 6) {
    const m = r + 1;
    return Array.from({ length: count }, (_, i) => {
        const c = makeCanvas(m * 2 + 1, m * 2 + 1), ctx = c.getContext("2d");
        ctx.globalAlpha = 1 - (i / count) * 0.8;
        ring(ctx, m, m, Math.max(2, Math.round((r * (i + 1)) / count)), i < 2 ? 3 : 2, color);
        return c;
    });
}

export function puffFrames(colors = ["#d6cde8", "#8f86a8", "#5c5476"]) {
    return Array.from({ length: 5 }, (_, i) => {
        const c = makeCanvas(14, 14), ctx = c.getContext("2d");
        ctx.globalAlpha = 1 - i * 0.18;
        disc(ctx, 7, 7, 2 + i, colors[Math.min(2, i >> 1)]);
        // Hollow the puff out as it expands.
        ctx.globalCompositeOperation = "destination-out";
        if (i > 1) disc(ctx, 7, 7, i - 2, "#000");
        return c;
    });
}

export function explosionFrames(r = 12) {
    const m = r + 1;
    const stages = [[P.v, "#fff"], [P.g, P.v], [P.o, P.g], [P.r, P.o], ["#5c5476", "#8f86a8"], ["#3a3550", "#5c5476"]];
    return stages.map(([outer, inner], i) => {
        const c = makeCanvas(m * 2 + 1, m * 2 + 1), ctx = c.getContext("2d");
        const rr = Math.round(r * (0.45 + i * 0.12));
        ctx.globalAlpha = i < 4 ? 1 : 0.7 - (i - 4) * 0.3;
        disc(ctx, m, m, Math.min(r, rr), outer);
        disc(ctx, m, m, Math.max(0, Math.min(r, rr) - 3), inner);
        return c;
    });
}

export function shadow(w, h) {
    const c = makeCanvas(w, h), ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(10, 6, 20, 0.45)";
    for (let y = 0; y < h; y++) {
        const t = (y + 0.5) / h * 2 - 1;
        const half = Math.round((w / 2) * Math.sqrt(1 - t * t));
        ctx.fillRect(w / 2 - half, y, half * 2, 1);
    }
    return c;
}

// Golden afterimage of a palm strike, fading toward its tail.
export function streak(w, h, color = "240, 194, 75") {
    const c = makeCanvas(w, h), ctx = c.getContext("2d");
    for (let x = 0; x < w; x++) {
        const t = x / w;
        const half = Math.round((h / 2) * (0.35 + 0.65 * t));
        ctx.fillStyle = `rgba(${color}, ${0.15 + 0.6 * t})`;
        ctx.fillRect(x, Math.round(h / 2 - half), 1, half * 2);
    }
    return c;
}

export function solid(w, h, color) {
    const c = makeCanvas(w, h), ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    return c;
}

export function bamboo(seed) {
    const R = seeded(seed), c = makeCanvas(14, 30), ctx = c.getContext("2d");
    for (const sx of [3, 7, 10]) {
        const top = Math.floor(R() * 8);
        ctx.fillStyle = P.k;
        ctx.fillRect(sx - 1, top, 4, 30 - top);
        ctx.fillStyle = P.j;
        ctx.fillRect(sx, top, 2, 30 - top);
        ctx.fillStyle = P.J;
        for (let y = top + 4; y < 30; y += 6) ctx.fillRect(sx - 1, y, 4, 1);
        ctx.fillStyle = P.l;
        ctx.fillRect(sx + 2, top + 2, 2, 1);
        ctx.fillRect(sx - 2, top + 6, 2, 1);
    }
    return c;
}

export function groundTile(seed, base, dark, light, extra) {
    const R = seeded(seed), T = 32, c = makeCanvas(T, T), ctx = c.getContext("2d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, T, T);
    for (let i = 0; i < 46; i++) {
        ctx.fillStyle = dark;
        ctx.fillRect(Math.floor(R() * T), Math.floor(R() * T), 1 + (R() < 0.3), 1);
    }
    for (let i = 0; i < 22; i++) {
        ctx.fillStyle = light;
        const x = Math.floor(R() * T), y = Math.floor(R() * T);
        ctx.fillRect(x, y, 1, 1 + (R() < 0.5));
    }
    if (extra) extra(ctx, R);
    return c;
}

