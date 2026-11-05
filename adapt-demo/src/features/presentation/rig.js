// Pose rig helpers: forward kinematics produces shape ops in hip-local space; ops are then
// rotated (spin), planted on the floor (or placed), rasterized and outlined.
import { capsule, ellipse, line, paint, poly, fill, framesToSheet, Px, outline } from "./pixel.js";

const D = Math.PI / 180;

// Direction for an angle in degrees: 0 = straight down, 90 = forward (+x), 180 = straight up.
export const dir = (a) => [Math.sin(a * D), Math.cos(a * D)];
export const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export class Ops {
    constructor() {
        this.list = [];
    }
    cap(a, b, ra, rb, r, o = {}) { this.list.push({ k: "cap", pts: [a, b], ra, rb, r, o }); }
    poly(pts, r, o = {}) { this.list.push({ k: "poly", pts, r, o }); }
    ell(c, rx, ry, rot, r, o = {}) { this.list.push({ k: "ell", pts: [c], rx, ry, rot, r, o }); }
    line(a, b, color) { this.list.push({ k: "line", pts: [a, b], color }); }
    dot(p, color) { this.list.push({ k: "dot", pts: [p], color }); }
    flat(pts, color) { this.list.push({ k: "flat", pts, color }); }
}

// Rasterizes ops into px. spin (degrees) rotates around the hip origin; then the figure is either
// planted so its lowest point touches floorY, or placed with the hip at (hx, hy).
export function renderOps(px, ops, { spin = 0, plant = true, hx, hy, floorY, extraY = 0 }) {
    const c = Math.cos(spin * D), s = Math.sin(spin * D);
    const rot = ([x, y]) => [x * c - y * s, x * s + y * c];
    let lowest = -Infinity;
    for (const op of ops.list) {
        op.tp = op.pts.map(rot);
        if (op.o?.noPlant || op.k === "line" || op.k === "dot") continue;
        const rad = op.k === "cap" ? Math.max(op.ra, op.rb) : op.k === "ell" ? Math.max(op.rx, op.ry) : 0;
        for (const p of op.tp) lowest = Math.max(lowest, p[1] + rad);
    }
    const ox = hx;
    const oy = plant ? floorY - lowest + extraY : hy;
    const T = ([x, y]) => [x + ox, y + oy];
    for (const op of ops.list) {
        const p = op.tp.map(T);
        if (op.k === "cap") paint(px, capsule(p[0][0], p[0][1], p[1][0], p[1][1], op.ra, op.rb), op.r, op.o);
        else if (op.k === "poly") paint(px, poly(p), op.r, op.o);
        else if (op.k === "ell") paint(px, ellipse(p[0][0], p[0][1], op.rx, op.ry, op.rot + spin * D), op.r, op.o);
        else if (op.k === "line") line(px, p[0][0], p[0][1], p[1][0], p[1][1], op.color);
        else if (op.k === "dot") px.set(Math.round(p[0][0] - 0.5), Math.round(p[0][1] - 0.5), op.color);
        else if (op.k === "flat") fill(px, poly(p), op.color);
    }
    return { ox, oy };
}

// Builds a CharacterArt sheet from animation specs.
// specs: { name: { poses: [...], fps, loop, phases? } } ; draw(px, pose, frameIndexInAnim, animName)
export function buildCharacter({ fw, fh, ax, ay, specs, draw, outlineColor, cols = 16, post }) {
    const frames = [];
    const anims = {};
    for (const [name, spec] of Object.entries(specs)) {
        const indices = [];
        spec.poses.forEach((pose, i) => {
            const px = new Px(fw, fh);
            draw(px, pose, i, name);
            outline(px, outlineColor);
            if (px.emit) px.emit(); // emissive pixels (glows, sparks) are added after the outline pass
            if (post) post(px, pose, i, name);
            indices.push(frames.length);
            frames.push(px);
        });
        anims[name] = { frames: indices, fps: spec.fps, loop: !!spec.loop };
        if (spec.phases) {
            const { windup, active, recovery } = spec.phases;
            if (windup + active + recovery !== indices.length) throw new Error(`Bad phases for ${name}`);
            anims[name].phases = { windup, active, recovery };
        }
    }
    const white = 0xffffffff, red = 0xff3c32e8; // ABGR of #e8323c
    return {
        frames,
        art: {
            __frames: frames,
            sheet: framesToSheet(frames, fw, fh, cols),
            flash: framesToSheet(frames, fw, fh, cols, () => white),
            flashRed: framesToSheet(frames, fw, fh, cols, () => red),
            frameWidth: fw,
            frameHeight: fh,
            anchorX: ax,
            anchorY: ay,
            anims,
        },
    };
}

// Expands key poses into evenly timed in-between frames.
export function tween(keys, counts, lerp) {
    const out = [];
    for (let i = 0; i < counts.length; i++) {
        const a = keys[i], b = keys[i + 1] ?? keys[i];
        for (let j = 0; j < counts[i]; j++) out.push(lerp(a, b, j / counts[i]));
    }
    return out;
}
