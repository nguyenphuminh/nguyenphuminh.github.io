// The Mirror Archer: a hooded glass reflection (~24 px tall) that hurls glass shards from a sling-like
// crystal hand. Drawn facing right, anchored at the feet.
import { C, R } from "./palette.js";
import { hash2, lerpPose, ramp } from "./pixel.js";
import { Ops, add, buildCharacter, dir, renderOps } from "./rig.js";

export const ARCHER_FRAME = { w: 48, h: 40, ax: 22, ay: 37 };

const CLOAK = ramp("#5a7a9a", "#3a5470", "#22344a");
const CLOAK_DARK = ramp("#3a5470", "#26394f", "#16222f");
const GLASS = R.glass;
const L = { thigh: 4.6, shin: 4.4, torso: 7.5, upper: 4.2, fore: 3.8 };
const BASE = { x: 0, lean: 6, head: 0, hipF: 8, kneeF: -6, hipB: -8, kneeB: -6, shF: 40, elF: 40, sway: 0.2, holdShard: 0, release: 0, eyes: 0.8, dissolve: 0 };
const points = {};

function drawArcher(px, pose, frameIndex, animName) {
    const p = { ...BASE, ...pose };
    const { ax, ay } = ARCHER_FRAME;
    const o = new Ops();
    const top = { shade: "top" };
    const axis = dir(180 - p.lean), perp = dir(90 - p.lean);
    const at = (u, v) => add(add([0, 0], axis, u), perp, v);
    const leg = (root, a, k) => {
        const knee = add(root, dir(a), L.thigh);
        const ankle = add(knee, dir(a + k), L.shin);
        return { root, knee, ankle, toe: add(ankle, dir(a + k + 90), 2) };
    };
    const legF = leg(at(0, 0.8), p.hipF, p.kneeF), legB = leg(at(0, -0.8), p.hipB, p.kneeB);
    const neck = at(L.torso, 0.4), head = add(neck, dir(180 - p.lean - p.head), 3);
    const shF = at(6.4, 1);
    const elbowF = add(shF, dir(p.shF), L.upper), handF = add(elbowF, dir(p.shF + p.elF), L.fore);

    // Legs (mostly under the robe)
    for (const lg of [legB, legF]) {
        o.cap(lg.root, lg.knee, 1.2, 1.0, lg === legB ? CLOAK_DARK : CLOAK, top);
        o.cap(lg.knee, lg.ankle, 1.0, 0.9, CLOAK_DARK, top);
        o.cap(lg.ankle, lg.toe, 0.9, 0.7, GLASS, top);
    }
    // Robe: a hooded glass-tinted cloak with a tattered hem
    const s = p.sway;
    const hem = [];
    for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        hem.push(add(at(0, -4 - s * 4 + t * 10), [0, 5 + (i % 2 ? -1.6 : 0) + hash2(i, frameIndex, 3)]));
    }
    o.poly([at(L.torso + 0.5, -2.4), at(L.torso + 0.5, 2.4), at(2, 4.4), ...hem.reverse(), at(2, -4.6)], CLOAK, { sep: C.sep });
    o.line(at(5, -1), at(1, 2.6), C.cyan1);
    // Hood
    const hd = dir(180 - p.lean - p.head), hp2 = dir(90 - p.lean - p.head);
    const hpt = (u, v) => add(add(head, hd, u), hp2, v);
    o.poly([hpt(-3.2, -3), hpt(2.8, -3.2), hpt(5.2, -4.6), hpt(3.6, 1.6), hpt(1.2, 3.2), hpt(-2.6, 3)], CLOAK, { sep: C.sep });
    o.poly([hpt(-1.8, 0.2), hpt(2, 0.4), hpt(1.2, 2.6), hpt(-1.4, 2.4)], CLOAK_DARK);
    const eye = p.eyes > 0.5 ? C.cyan3 : C.cyan1;
    o.dot(hpt(0.4, 1.4), eye);
    o.dot(hpt(0.4, 2.2), C.cyan2);
    // Front arm ending in a crystal sling-hand
    o.cap(shF, elbowF, 1.1, 1.0, CLOAK, { sep: C.sep, shade: "top" });
    o.cap(elbowF, handF, 1.0, 0.9, GLASS, { sep: C.sep, shade: "top" });
    const fd = dir(p.shF + p.elF), fp = [fd[1], -fd[0]];
    for (const k of [-1.2, 0, 1.2]) o.cap(handF, add(add(handF, fd, 2.6), fp, k), 0.55, 0.4, GLASS);
    if (p.holdShard) {
        o.poly([add(handF, fp, -1.6), add(add(handF, fd, 4.5), fp, 0.2), add(handF, fp, 1.6), add(handF, fd, -1)], GLASS, { sep: C.sep, noPlant: true });
    }
    const { ox, oy } = renderOps(px, o, { plant: true, hx: ax + p.x, floorY: ay + 0.5 });
    const rel = (q) => [Math.round(q[0] + ox - ax), Math.round(q[1] + oy - ay)];
    (points[animName] ??= [])[frameIndex] = { hand: rel(handF) };
    // Emissive: the shard glows; a release streak
    px.emit = () => {
        const h = rel(handF);
        const hx = h[0] + ax, hy = h[1] + ay;
        if (p.holdShard) { px.set(hx + Math.round(fd[0] * 2), hy + Math.round(fd[1] * 2), C.cyan3); px.set(hx, hy - 1, C.white); }
        if (p.release) for (let k = 3; k < 12; k++) if (!px.get(hx + k, hy)) px.set(hx + k, hy, k < 6 ? C.white : C.cyan2);
    };
}

function dissolve(px, pose, floorY) {
    const d = pose.dissolve ?? 0;
    if (!d) return;
    const src = px.data.slice();
    px.clear();
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
        const c = src[y * px.w + x];
        if (!c) continue;
        const h = hash2(x, y, 23);
        if (h > d * 1.1) px.set(x, y, c);
        else if (h > d * 0.7 && hash2(x, y, 24) < 0.35) {
            const r = d * 9 * hash2(x, y, 25), a = hash2(x, y, 26) * Math.PI * 2;
            px.set(Math.round(x + Math.cos(a) * r), Math.min(floorY, Math.round(y + Math.abs(Math.sin(a)) * r * 0.6 + d * 4)), hash2(x, y, 27) < 0.5 ? C.cyan2 : C.cyan3);
        }
    }
}

function specs() {
    const lp = lerpPose;
    const idle = [0, 1, 2, 1].map((b) => ({ sway: 0.2 + b * 0.05, kneeF: -6 - b, kneeB: -6 - b, eyes: 0.7 + b * 0.1, shF: 40 + b }));
    const walk = Array.from({ length: 6 }, (_, i) => {
        const f = (i / 6) * Math.PI * 2;
        return { lean: 9, hipF: 22 * Math.sin(f), kneeF: -(6 + 30 * Math.max(0, Math.cos(f))), hipB: 22 * Math.sin(f + Math.PI), kneeB: -(6 + 30 * Math.max(0, Math.cos(f + Math.PI))), shF: 30 - 10 * Math.sin(f), sway: 0.4 };
    });
    const retreat = Array.from({ length: 6 }, (_, i) => {
        const f = (i / 6) * Math.PI * 2;
        return { lean: -4, hipF: 16 * Math.sin(-f), kneeF: -(8 + 24 * Math.max(0, -Math.cos(f))), hipB: 16 * Math.sin(-f + Math.PI), kneeB: -(8 + 24 * Math.max(0, -Math.cos(f + Math.PI))), shF: 70, elF: 50, sway: 0.1 };
    });
    // Throw: the shard is released at about 20 px above the floor, in front.
    const throwA = [
        { lean: -4, shF: 190, elF: 40, holdShard: 1, hipB: -14, kneeF: -10, eyes: 1 },
        { lean: -8, shF: 205, elF: 45, holdShard: 1, hipB: -16, kneeF: -14, eyes: 1 },
        { lean: 12, shF: 118, elF: -10, release: 1, hipF: 20, kneeF: -16, hipB: -18, x: 1 },
        { lean: 14, shF: 108, elF: -12, hipF: 22, kneeF: -18, hipB: -20, x: 1 },
        { lean: 8, shF: 55, elF: 30, hipF: 12, hipB: -12 },
        { ...idle[0] },
    ];
    const flinch = [{ lean: -18, head: -15, shF: 150, elF: 30, sway: 0.6, eyes: 0.2 }, { lean: -8, head: -6, shF: 80, elF: 40, sway: 0.4 }];
    const death = [0.15, 0.35, 0.55, 0.75, 0.9, 1].map((d, i) => ({ ...lp(flinch[0], { lean: -24, head: -20 }, i / 5), dissolve: d, eyes: 0 }));
    return {
        idle: { poses: idle, fps: 5, loop: true },
        walk: { poses: walk, fps: 10, loop: true },
        retreat: { poses: retreat, fps: 9, loop: true },
        throw: { poses: throwA, fps: 10, phases: { windup: 2, active: 2, recovery: 2 } },
        flinch: { poses: flinch, fps: 10 },
        death: { poses: death, fps: 12 },
    };
}

export function buildArcherArt() {
    const f = ARCHER_FRAME;
    const art = buildCharacter({ fw: f.w, fh: f.h, ax: f.ax, ay: f.ay, specs: specs(), draw: drawArcher, outlineColor: C.outline, cols: 16, post: (px, pose) => dissolve(px, pose, f.ay) }).art;
    art.points = points;
    return art;
}
