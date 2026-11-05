// Mobs: the Shardling (a small glass crawler) and the Glass Sentinel (a guard's reflection with a tower
// shield and a spear). Drawn facing right, anchored at the feet, same outline style as the bosses.
import { C, R } from "./palette.js";
import { hash2, lerpPose, line as pxLine, ramp } from "./pixel.js";
import { Ops, add, buildCharacter, dir, renderOps } from "./rig.js";

export const SHARDLING_FRAME = { w: 32, h: 24, ax: 16, ay: 21 };
export const SENTINEL_FRAME = { w: 96, h: 72, ax: 40, ay: 68 };

const GLASS = R.glass;
const GLASS_DARK = ramp("#9fdcef", "#4f88a8", "#2a4f6a");
const ARMOR = ramp("#8f98b8", "#5a6282", "#353a52");
const ARMOR_DARK = ramp("#5f6786", "#3d4360", "#262a3e");
const SHAFT = ramp("#7a6a5a", "#54473a", "#352c24");

function glassDissolve(px, pose, floorY) {
    const d = pose.dissolve ?? 0;
    if (!d) return;
    const src = px.data.slice();
    px.clear();
    for (let y = 0; y < px.h; y++) {
        for (let x = 0; x < px.w; x++) {
            const c = src[y * px.w + x];
            if (!c) continue;
            const h = hash2(x, y, 17);
            if (h > d * 1.1) px.set(x, y, c);
            else if (h > d * 0.7 && hash2(x, y, 4) < 0.35) {
                const r = d * 10 * hash2(x, y, 8);
                const a = hash2(x, y, 9) * Math.PI * 2;
                px.set(Math.round(x + Math.cos(a) * r), Math.min(floorY, Math.round(y + Math.abs(Math.sin(a)) * r * 0.6 + d * 4)), hash2(x, y, 3) < 0.5 ? C.cyan2 : C.cyan3);
            }
        }
    }
}

// ------------------------------------------------------------------ Shardling

function drawShardling(px, pose) {
    const p = { x: 0, bob: 0, crouch: 0, stretch: 0, tilt: 0, phase: 0, eye: 1, ...pose };
    const { ax, ay } = SHARDLING_FRAME;
    const o = new Ops();
    const t = p.tilt * Math.PI / 180;
    const rot = ([u, v]) => [u * Math.cos(t) - v * Math.sin(t), u * Math.sin(t) + v * Math.cos(t)];
    const bodyY = -7 - p.bob + p.crouch * 3 - p.stretch * 1;
    const B = (u, v) => { const r = rot([u * (1 + p.stretch * 0.35), v * (1 - p.stretch * 0.25)]); return [r[0] + p.x, r[1] + bodyY]; };

    // Legs (drawn first, behind the body): four spindly glass legs
    const hips = [-4, -1.5, 1.5, 4];
    hips.forEach((hx, i) => {
        const hipP = B(hx, 2.5);
        const side = i < 2 ? -1 : 1;
        const ph = p.phase + i * Math.PI / 2;
        let foot;
        if (p.stretch > 0.5) foot = [hipP[0] - 4 - i * 0.6, hipP[1] + 3.5]; // trailing behind in a leap
        else foot = [hipP[0] + side * (3.2 - p.crouch) + Math.sin(ph) * 1.6, 0];
        const knee = [(hipP[0] + foot[0]) / 2 + side * 1.2, Math.min(hipP[1], foot[1]) - 2.6 + p.crouch];
        o.cap(hipP, knee, 0.7, 0.6, GLASS_DARK, { shade: "top" });
        o.cap(knee, foot, 0.6, 0.5, GLASS_DARK, { shade: "top" });
    });
    // Body: a hunched cluster of glass shards with a glowing core and an eye in front
    o.poly([B(-6.5, 3), B(-4, -3), B(-1, -6), B(3, -4.5), B(6.5, 0), B(5.5, 3.2)], GLASS, { sep: C.sep });
    o.poly([B(-3.5, -2.5), B(-5, -8.5), B(-1, -4.5)], GLASS, { sep: C.sep });
    o.poly([B(0, -5), B(1.5, -9.5), B(3, -4)], GLASS, { sep: C.sep });
    o.poly([B(-1.5, 0.5), B(1.5, -2.5), B(4.5, 0), B(1.5, 2.6)], GLASS_DARK);
    o.dot(B(1.5, 0), C.cyan2);
    o.dot(B(5, -0.8), p.eye ? C.cyan3 : C.cyan0);
    o.dot(B(4.2, -0.8), C.ink);
    renderOps(px, o, { plant: true, hx: ax, floorY: ay + 0.5 });
}

function shardlingSpecs() {
    const idle = [0, 1, 2, 1].map((b) => ({ bob: b * 0.5, phase: 0 }));
    const crawl = Array.from({ length: 6 }, (_, i) => ({ phase: (i / 6) * Math.PI * 2, bob: Math.abs(Math.sin((i / 6) * Math.PI * 2)) * 0.8, x: 0 }));
    const leap = [
        { crouch: 0.6, tilt: -6 },
        { crouch: 1, tilt: -10, eye: 1 },
        { stretch: 1, tilt: 14, x: 2 },
        { stretch: 0.8, tilt: 22, x: 3 },
        { crouch: 0.8, tilt: 6, x: 2 },
        { crouch: 0.3, x: 1 },
    ];
    const flinch = [{ tilt: -22, x: -1.5, bob: 1, eye: 0 }, { tilt: -10, x: -0.5, eye: 1 }];
    const death = [0.15, 0.35, 0.55, 0.75, 0.9, 1].map((d, i) => ({ tilt: -18 - i * 4, crouch: 0.5, dissolve: d, eye: 0 }));
    return {
        idle: { poses: idle, fps: 5, loop: true },
        crawl: { poses: crawl, fps: 12, loop: true },
        leap: { poses: leap, fps: 12, phases: { windup: 2, active: 2, recovery: 2 } },
        flinch: { poses: flinch, fps: 10 },
        death: { poses: death, fps: 12 },
    };
}

// ------------------------------------------------------------------ Glass Sentinel

const SL = { thigh: 7.4, shin: 7, torso: 10, upper: 5.8, fore: 5.3, spear: 34 };
const SBASE = {
    x: 0, lean: 3, head: 0,
    hipF: 12, kneeF: -10, hipB: -10, kneeB: -8,
    shF: 70, elF: 30, shB: 60, elB: 60, spear: 150,
    shieldX: 0, shieldY: 0, shieldTilt: 0, shieldLow: 0,
    glint: 0, dissolve: 0, eyes: 0.8, spearBack: 0,
};
const points = {};

function drawSentinel(px, pose, frameIndex, animName) {
    const p = { ...SBASE, ...pose };
    const { ax, ay } = SENTINEL_FRAME;
    const o = new Ops();
    const top = { shade: "top" };
    const axis = dir(180 - p.lean), perp = dir(90 - p.lean);
    const at = (u, v) => add(add([0, 0], axis, u), perp, v);
    const neck = at(SL.torso, 0);
    const head = add(neck, axis, 3.8);
    const shF = at(8.8, 1), shB = at(8.8, -1.5);
    const leg = (root, a, k) => {
        const knee = add(root, dir(a), SL.thigh);
        const ankle = add(knee, dir(a + k), SL.shin);
        return { root, knee, ankle, toe: add(ankle, dir(a + k + 90), 3) };
    };
    const legF = leg(at(0, 1.2), p.hipF, p.kneeF);
    const legB = leg(at(0, -1.2), p.hipB, p.kneeB);
    const elbowB = add(shB, dir(p.shB), SL.upper);
    const handB = add(elbowB, dir(p.shB + p.elB), SL.fore);
    const elbowF = add(shF, dir(p.shF), SL.upper);
    const handF = add(elbowF, dir(p.shF + p.elF), SL.fore);
    const sd = dir(p.spear);

    // Spear (behind the body, in the back hand): wooden shaft with a long glass head
    const butt = add(handB, sd, -9 - p.spearBack);
    const headBase = add(handB, sd, SL.spear - 9 - p.spearBack);
    const tip = add(headBase, sd, 8);
    o.cap(butt, headBase, 0.8, 0.8, SHAFT, { noPlant: true, shade: "top" });
    const sp = [sd[1], -sd[0]];
    o.poly([add(headBase, sp, 1.8), tip, add(headBase, sp, -1.8), add(headBase, sd, -1.5)], GLASS, { sep: C.sep, noPlant: true });
    o.line(add(headBase, sd, 1), add(tip, sd, -1.5), C.white);

    // Back leg & arm
    o.cap(legB.root, legB.knee, 2.1, 1.8, ARMOR_DARK, top);
    o.cap(legB.knee, legB.ankle, 1.8, 1.5, ARMOR_DARK, top);
    o.cap(legB.ankle, legB.toe, 1.4, 1.2, ARMOR_DARK, top);
    o.cap(shB, elbowB, 1.7, 1.5, ARMOR_DARK, top);
    o.cap(elbowB, handB, 1.6, 1.4, ARMOR_DARK, top);
    o.ell(handB, 1.5, 1.5, 0, ARMOR_DARK, top);

    // Torso: glassy plate with a cyan seam
    o.poly([at(-3, -3.4), at(-3, 3.6), at(6, 4.2), at(SL.torso + 0.5, 3), at(SL.torso + 0.5, -3.2), at(6, -3.8)], ARMOR, { sep: C.sep });
    o.line(at(1, -3.2), at(1, 3.8), C.sep);
    o.line(at(5.5, 0.4), at(8.5, 0.4), C.cyan1);
    // Front leg
    o.cap(legF.root, legF.knee, 2.2, 1.9, ARMOR, { sep: C.sep, shade: "top" });
    o.cap(legF.knee, legF.ankle, 1.9, 1.6, ARMOR, { sep: C.sep, shade: "top" });
    o.cap(legF.ankle, legF.toe, 1.5, 1.3, ARMOR_DARK, { sep: C.sep, shade: "top" });
    // Head: a tall barbute with a cyan eye slit and a glass crest
    const hd = axis, hpp = perp;
    const hp = (u, v) => add(add(head, hd, u), hpp, v);
    o.poly([hp(4.5, -3.4), hp(4.8, 2.4), hp(3.2, 3.8), hp(-3.6, 3.6), hp(-3.8, -3.4)], ARMOR, { sep: C.sep });
    o.poly([hp(3.8, -2.6), hp(8, -4.6), hp(4.6, -0.4)], GLASS, { sep: C.sep });
    o.line(hp(0.6, 0.6), hp(0.6, 3.6), C.ink);
    o.line(hp(0.6, 1.6), hp(0.6, 3.4), p.eyes > 0.5 ? C.cyan2 : C.cyan0);
    // Front arm (holds the shield)
    o.cap(shF, elbowF, 1.8, 1.6, ARMOR, { sep: C.sep, shade: "top" });
    o.cap(elbowF, handF, 1.7, 1.5, ARMOR, { sep: C.sep, shade: "top" });
    o.ell(shF, 2.8, 2.4, 0, ARMOR, { sep: C.sep });

    // Tower shield in front: tall pane of glass with a dark frame; lowered when the guard is broken
    const sc = add(handF, [1.5 + p.shieldX, p.shieldY + p.shieldLow * 9]);
    const tl = (p.shieldTilt + p.shieldLow * 35) * Math.PI / 180;
    const R2 = ([u, v]) => [sc[0] + u * Math.cos(tl) - v * Math.sin(tl), sc[1] + u * Math.sin(tl) + v * Math.cos(tl)];
    const shield = [[-2, -14], [2.5, -13], [3.2, 0], [2.5, 11], [-2, 12], [-2.8, 0]].map(R2);
    o.poly(shield, ARMOR_DARK, { sep: C.sep, noPlant: true });
    o.poly([[-1, -12.4], [1.7, -11.6], [2.2, 0], [1.7, 9.6], [-1, 10.4], [-1.6, 0]].map(R2), GLASS);
    o.line(R2([0.3, -10]), R2([1.2, 6]), C.white);
    o.line(R2([-0.6, -4]), R2([1, -1]), C.cyan1);
    o.line(R2([1, -1]), R2([-0.4, 3]), C.cyan1);

    const { ox, oy } = renderOps(px, o, { plant: true, hx: ax + p.x, floorY: ay + 0.5 });
    const rel = (q) => [Math.round(q[0] + ox - ax), Math.round(q[1] + oy - ay)];
    const front = shield.reduce((m, q) => (q[0] > m[0] ? q : m), shield[0]);
    (points[animName] ??= [])[frameIndex] = { spearTip: rel(tip), shieldFront: rel(front) };

    if (p.glint) {
        px.emit = () => {
            const g = rel(R2([1, -4]));
            const gx = g[0] + ax, gy = g[1] + ay;
            for (let k = -3; k <= 3; k++) {
                if (!px.get(gx + k, gy)) px.set(gx + k, gy, C.white);
                if (!px.get(gx, gy + k)) px.set(gx, gy + k, k % 2 ? C.cyan3 : C.white);
            }
            pxLine(px, gx - 2, gy - 2, gx + 2, gy + 2, C.cyan3);
        };
    }
}

function sentinelSpecs() {
    const lp = lerpPose;
    const idle = [0, 1, 2, 1].map((b) => ({ kneeF: -10 - b * 2, kneeB: -8 - b * 2, hipF: 12 + b, spear: 150 - b, eyes: 0.7 + b * 0.1 }));
    const walk = Array.from({ length: 6 }, (_, i) => {
        const f = (i / 6) * Math.PI * 2;
        return {
            lean: 6, hipF: 20 * Math.sin(f), kneeF: -(8 + 30 * Math.max(0, Math.cos(f))),
            hipB: 20 * Math.sin(f + Math.PI), kneeB: -(8 + 30 * Math.max(0, Math.cos(f + Math.PI))), spear: 148 + 2 * Math.sin(f),
        };
    });
    // Spear thrust over the top of the shield (reach ≈ 46 px from the anchor)
    const thrust = [
        { spear: 100, shB: 40, elB: 75, spearBack: 2, lean: -2, hipB: -16, kneeF: -16 },
        { spear: 95, shB: 25, elB: 85, spearBack: 5, lean: -6, hipB: -18, kneeF: -20, eyes: 1 },
        { spear: 93, shB: 20, elB: 88, spearBack: 7, lean: -8, hipB: -20, kneeF: -22, eyes: 1 },
        { spear: 90, shB: 85, elB: 6, spearBack: 3, lean: 14, hipF: 28, kneeF: -24, hipB: -24, x: 3 },
        { spear: 90, shB: 88, elB: 4, spearBack: 2, lean: 16, hipF: 30, kneeF: -26, hipB: -26, x: 4 },
        { spear: 100, shB: 60, elB: 40, spearBack: 4, lean: 8, hipF: 20, hipB: -16, x: 2 },
        { ...idle[0] },
    ];
    // Shield bash (shield front reaches ≈ 24 px)
    const bash = [
        { shieldX: -3, shieldTilt: -6, lean: -6, hipB: -16, kneeF: -16, shF: 50 },
        { shieldX: -5, shieldTilt: -10, lean: -10, hipB: -18, kneeF: -20, shF: 40, eyes: 1 },
        { shieldX: 2, shieldTilt: 6, lean: 14, hipF: 28, kneeF: -24, hipB: -24, shF: 80, elF: 6, x: 2 },
        { shieldX: 3, shieldTilt: 8, lean: 16, hipF: 30, kneeF: -26, hipB: -26, shF: 84, elF: 4, x: 2 },
        { shieldX: 3, lean: 8, hipF: 20, hipB: -16, x: 2 },
        { ...idle[0] },
    ];
    const block = [
        { shieldX: -3, shieldTilt: -8, lean: -4, glint: 1, kneeF: -16 },
        { shieldX: -1, shieldTilt: -3, lean: 0, glint: 0 },
    ];
    const guardBroken = [0, 1, 2, 1].map((b) => ({ shieldLow: 1, shieldX: -2, lean: -12 + b, head: -10, hipF: 20, kneeF: -24, hipB: -22, kneeB: -14, spear: 120 - b * 3, shB: 20, elB: 50, eyes: 0.3 + b * 0.1 }));
    const death = [0.12, 0.3, 0.5, 0.7, 0.88, 1].map((d, i) => ({ ...lp(guardBroken[0], { lean: -20, head: -18 }, i / 5), shieldLow: 1, dissolve: d, eyes: 0.1 }));
    return {
        idle: { poses: idle, fps: 4, loop: true },
        walk: { poses: walk, fps: 8, loop: true },
        thrust: { poses: thrust, fps: 12, phases: { windup: 3, active: 2, recovery: 2 } },
        bash: { poses: bash, fps: 12, phases: { windup: 2, active: 2, recovery: 2 } },
        block: { poses: block, fps: 10 },
        guardBroken: { poses: guardBroken, fps: 4, loop: true },
        death: { poses: death, fps: 10 },
    };
}

export function buildMobArt() {
    const sh = SHARDLING_FRAME, se = SENTINEL_FRAME;
    const shardling = buildCharacter({
        fw: sh.w, fh: sh.h, ax: sh.ax, ay: sh.ay, specs: shardlingSpecs(), draw: drawShardling, outlineColor: C.outline, cols: 16,
        post: (px, pose) => glassDissolve(px, pose, sh.ay),
    }).art;
    const sentinel = buildCharacter({
        fw: se.w, fh: se.h, ax: se.ax, ay: se.ay, specs: sentinelSpecs(), draw: drawSentinel, outlineColor: C.outline, cols: 12,
        post: (px, pose) => glassDissolve(px, pose, se.ay),
    }).art;
    sentinel.points = points;
    return { shardling, sentinel };
}
