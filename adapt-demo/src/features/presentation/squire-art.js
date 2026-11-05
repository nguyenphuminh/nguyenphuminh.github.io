// The Pale Squire: reflection of the Keep's last squire, a would-be knight in pale bone armour with a
// muted blue surcoat, a sword and a small round buckler. ~40 px tall. Drawn facing right.
import { C, R } from "./palette.js";
import { hash2, lerpPose, ramp } from "./pixel.js";
import { Ops, add, buildCharacter, dir, renderOps } from "./rig.js";

export const SQUIRE_FRAME = { w: 96, h: 80, ax: 48, ay: 74 };

const L = { thigh: 9.5, shin: 9, torso: 12.5, upper: 7.2, fore: 6.6, sword: 22 };

const S = {
    bone: ramp("#f4eedf", "#cdc2a8", "#8c826c"),
    boneDark: ramp("#c9bfa6", "#9a9079", "#625a49"),
    cloth: ramp("#8aa0c4", "#5c7096", "#3a4766"),
    clothDark: ramp("#62749a", "#45536f", "#2b3349"),
    plume: ramp("#c8d6f0", "#93a8d0", "#5f7096"),
    blade: ramp("#ffffff", "#e4ecf4", "#97a4b9"),
    leather: R.leather,
};

const BASE = {
    x: 0, lean: 4, head: 0,
    hipF: 10, kneeF: -8, hipB: -9, kneeB: -8,
    shF: 30, elF: 30, shB: 25, elB: 60,
    sword: 70, twoHand: 0,
    spin: 0, plant: 1, ball: 0, dissolve: 0, dropSword: 0, wobble: 0,
    eyes: 0.6, buckler: 1,
};

function ik(s, t, l1, l2, bend = 1) {
    const dx = t[0] - s[0], dy = t[1] - s[1];
    const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
    const a = Math.atan2(dy, dx);
    const b = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    return [s[0] + Math.cos(a + bend * b) * l1, s[1] + Math.sin(a + bend * b) * l1];
}

const points = {};

// Mid-roll: a tumbling ball of surcoat, helm and buckler.
function drawBall(px, p, frameIndex, animName) {
    const o = new Ops();
    o.ell([0, 0], 9.5, 8.6, 0, S.cloth);
    o.ell([1.8, 2.2], 6.2, 5, 0.3, S.clothDark, { sep: C.sep });
    o.ell([3.8, -5], 4.6, 4.8, 0, S.bone, { sep: C.sep });
    o.line([6.4, -5.4], [8, -5.4], C.ink);
    o.ell([-5.4, 3.2], 4.2, 4.2, 0, S.boneDark, { sep: C.sep });
    o.dot([-5.4, 3.2], C.cyan1);
    o.cap([6, 3], [10, 5], 1.8, 1.4, S.leather, { sep: C.sep, shade: "top" });
    const { ox, oy } = renderOps(px, o, { spin: p.spin, plant: true, hx: SQUIRE_FRAME.ax + (p.x ?? 0), floorY: SQUIRE_FRAME.ay + 0.5 });
    (points[animName] ??= [])[frameIndex] = { bladeTip: null, core: [Math.round(ox - SQUIRE_FRAME.ax), Math.round(oy - SQUIRE_FRAME.ay)] };
}

function drawSquire(px, pose, frameIndex, animName) {
    if (pose.ball) return drawBall(px, pose, frameIndex, animName);
    const p = { ...BASE, ...pose };
    const o = new Ops();
    const top = { shade: "top" };
    const hip = [0, 0];
    const axis = dir(180 - p.lean);
    const perp = dir(90 - p.lean);
    const at = (u, v) => add(add(hip, axis, u), perp, v);

    const neck = at(L.torso, 0);
    const headAxis = dir(180 - p.lean - p.head);
    const headPerp = dir(90 - p.lean - p.head);
    const head = add(neck, headAxis, 5);
    const hp = (u, v) => add(add(head, headAxis, u), headPerp, v);
    const shF = at(11, 1), shB = at(11, -2);

    const leg = (root, a, k) => {
        const knee = add(root, dir(a), L.thigh);
        const ankle = add(knee, dir(a + k), L.shin);
        const toe = add(ankle, dir(a + k + 90), 4);
        return { root, knee, ankle, toe };
    };
    const legF = leg(at(0, 1.5), p.hipF, p.kneeF);
    const legB = leg(at(0, -1.5), p.hipB, p.kneeB);

    const elbowF = add(shF, dir(p.shF), L.upper);
    const handF = add(elbowF, dir(p.shF + p.elF), L.fore);
    const bd = dir(p.sword), bp = [bd[1], -bd[0]];
    let elbowB, handB;
    if (p.twoHand) {
        handB = add(handF, bd, -2.4);
        elbowB = ik(shB, handB, L.upper, L.fore, -1);
    } else {
        elbowB = add(shB, dir(p.shB), L.upper);
        handB = add(elbowB, dir(p.shB + p.elB), L.fore);
    }

    // Back leg, back arm with the buckler
    o.cap(legB.root, legB.knee, 2.6, 2.3, S.clothDark, top);
    o.cap(legB.knee, legB.ankle, 2.3, 2.0, S.boneDark, top);
    o.cap(legB.ankle, legB.toe, 1.8, 1.5, S.leather, top);
    o.cap(shB, elbowB, 2.0, 1.8, S.boneDark, top);
    o.cap(elbowB, handB, 1.9, 1.7, S.boneDark, top);
    o.ell(handB, 1.8, 1.8, 0, S.leather, top);

    // Torso: bone breastplate over a blue surcoat with a pale hem
    o.poly([at(-5, -4.4), at(-5.6, 4.8), at(2, 4.6), at(2, -4.2)], S.cloth, { sep: C.sep });
    o.line(at(-5.4, -4.2), at(-5.8, 4.6), C.cyan0);
    o.poly([at(1.5, -3.8), at(1.5, 4.2), at(8, 4.8), at(L.torso + 0.6, 3.2), at(L.torso + 0.6, -3.8), at(8, -4.4)], S.bone, { sep: C.sep });
    o.line(at(5, -4), at(5, 4.4), C.sep);
    o.line(at(1.8, -4), at(1.8, 4.4), S.leather.mid);

    // Front leg
    o.cap(legF.root, legF.knee, 2.7, 2.4, S.cloth, { sep: C.sep, shade: "top" });
    o.cap(legF.knee, legF.ankle, 2.4, 2.0, S.bone, { sep: C.sep, shade: "top" });
    o.cap(legF.ankle, legF.toe, 1.9, 1.6, S.leather, { sep: C.sep, shade: "top" });
    o.ell(legF.knee, 2.2, 2.0, 0, S.bone, { sep: C.sep });

    // Buckler, held in front of the body by the far arm
    if (p.buckler && !p.twoHand) {
        const fd = dir(p.shB + p.elB);
        const bc = add(handB, [fd[1] * 0.8, -fd[0] * 0.8]);
        o.ell(bc, 4.6, 5.2, 0, S.bone, { sep: C.sep });
        o.ell(bc, 3.1, 3.7, 0, S.cloth);
        o.ell(bc, 1.2, 1.2, 0, S.bone, top);
        o.dot(add(bc, [-1.4, -2.6]), C.white);
    }

    // Head: a rounded sallet with a flared tail, a visor slit with a glassy eye glint (he is a reflection)
    // and a small curved plume.
    const plumeA = hp(3.6, -1.2), plumeB = add(hp(6.2, -3.4), [-p.wobble, 0]), plumeC = add(hp(5.4, -6.6), [-1.2 - p.wobble * 1.6, 0.8]);
    o.cap(plumeA, plumeB, 1.2, 1.0, S.plume, top);
    o.cap(plumeB, plumeC, 1.0, 0.4, S.plume, top);
    o.poly([hp(0.8, -3.2), hp(-1.6, -6.6), hp(-3.6, -5.6), hp(-2.6, -2.4)], S.boneDark, { sep: C.sep });
    o.ell(hp(0.6, 0.4), 4.6, 4.2, -(p.lean + p.head) * Math.PI / 180, S.bone, { sep: C.sep });
    o.poly([hp(-1.2, 1), hp(-1.2, 4.8), hp(-3.6, 4.2), hp(-3.6, 1)], S.bone, { sep: C.sep });
    o.line(hp(0.9, 1.0), hp(0.9, 4.8), C.ink);
    const eye = p.eyes < 0.35 ? C.cyan0 : p.eyes < 0.85 ? C.cyan1 : C.cyan2;
    o.dot(hp(0.9, 3.4), eye);
    if (p.eyes >= 0.85) o.dot(hp(0.9, 2.6), C.cyan1);
    o.line(hp(2.4, -1.6), hp(2.4, 4.2), S.boneDark.lo);

    // Sword
    const tip = add(handF, bd, L.sword);
    if (!p.dropSword) {
        o.cap(add(handF, bd, 2.4), tip, 1.5, 0.6, S.blade, { sep: C.sep, noPlant: true });
        o.line(add(add(handF, bd, 3), bp, 0.4), add(add(handF, bd, L.sword - 3), bp, 0.2), C.white);
        o.cap(add(add(handF, bd, 1.8), bp, 3.2), add(add(handF, bd, 1.8), bp, -3.2), 0.95, 0.95, S.boneDark, top);
        o.dot(add(handF, bd, -2.2), C.cyan1);
    }

    // Front arm with a rounded pauldron
    o.cap(shF, elbowF, 2.1, 1.9, S.bone, { sep: C.sep, shade: "top" });
    o.cap(elbowF, handF, 2.0, 1.8, S.bone, { sep: C.sep, shade: "top" });
    o.ell(shF, 3.6, 3.0, -p.lean * Math.PI / 180, S.bone, { sep: C.sep });
    o.line(add(shF, perp, -2.8), add(shF, perp, 2.8), S.clothDark.mid);
    o.ell(handF, 1.9, 1.9, 0, S.leather, top);

    const { ox, oy } = renderOps(px, o, { spin: p.spin, plant: p.plant, hx: SQUIRE_FRAME.ax + p.x, floorY: SQUIRE_FRAME.ay + 0.5 });
    const rel = (q) => [Math.round(q[0] + ox - SQUIRE_FRAME.ax), Math.round(q[1] + oy - SQUIRE_FRAME.ay)];
    (points[animName] ??= [])[frameIndex] = { bladeTip: p.dropSword ? null : rel(tip), core: rel(at(7, 0)) };
}

// Death: crumble into pale shards that fall to the floor.
function dissolve(px, pose) {
    const d = pose.dissolve ?? 0;
    if (!d) return;
    const src = px.data.slice();
    px.clear();
    for (let y = 0; y < px.h; y++) {
        for (let x = 0; x < px.w; x++) {
            const c = src[y * px.w + x];
            if (!c) continue;
            const h = hash2(x >> 1, y >> 1, 13);
            if (h > d * 1.15 - (px.h - y) / px.h * 0.25) px.set(x, y, c);
            else if (h > d * 0.85 && hash2(x, y, 5) < 0.2) {
                const fall = Math.round(d * 20 * hash2(x, y, 6));
                const fy = Math.min(SQUIRE_FRAME.ay - Math.round(hash2(x, y, 2) * 3), y + fall);
                px.set(x + Math.round((hash2(x, y, 9) - 0.5) * d * 12), fy, hash2(x, y, 3) < 0.5 ? C.cyan3 : 0xffdfeef4);
            }
        }
    }
}

const lp = lerpPose;

function specs() {
    const idle = [0, 1, 2, 1].map((b) => ({ kneeF: -8 - b * 2, kneeB: -8 - b * 2, hipF: 10 + b, hipB: -9 - b, sword: 70 - b * 2, elF: 30 + b * 2, shB: 25 + b, eyes: 0.6 + b * 0.05 }));

    const walk = [];
    for (let i = 0; i < 8; i++) {
        const f = (i / 8) * Math.PI * 2;
        walk.push({
            lean: 8, hipF: 24 * Math.sin(f), kneeF: -(8 + 38 * Math.max(0, Math.cos(f))),
            hipB: 24 * Math.sin(f + Math.PI), kneeB: -(8 + 38 * Math.max(0, Math.cos(f + Math.PI))),
            shF: 26 - 8 * Math.sin(f), elF: 34, shB: 25 + 10 * Math.sin(f), elB: 60, sword: 64,
        });
    }
    const retreat = [];
    for (let i = 0; i < 6; i++) {
        const f = (i / 6) * Math.PI * 2;
        retreat.push({
            lean: -2, hipF: 16 * Math.sin(-f), kneeF: -(10 + 28 * Math.max(0, -Math.cos(f))),
            hipB: 16 * Math.sin(-f + Math.PI), kneeB: -(10 + 28 * Math.max(0, -Math.cos(f + Math.PI))),
            shF: 40, elF: 40, sword: 80, shB: 70, elB: 30,
        });
    }
    const hold = [0, 1, 2, 1].map((b) => ({ lean: 2, hipF: 20, kneeF: -22 - b, hipB: -18, kneeB: -16 - b, shB: 80, elB: 15, shF: -10, elF: 70, sword: 130 + b, eyes: 0.8 }));

    // Practising at the training post (which stands ~40 px to his right)
    const ready = { ...idle[0] };
    const raise = { shF: 150, elF: 50, sword: 220, lean: -4, kneeF: -14, hipB: -14, eyes: 0.5 };
    const strike = { shF: 70, elF: 10, sword: 92, lean: 12, hipF: 26, kneeF: -20, hipB: -20, x: 2, eyes: 0.5 };
    const follow = { shF: 45, elF: 15, sword: 55, lean: 14, hipF: 28, kneeF: -22, hipB: -22, x: 2, eyes: 0.5 };
    const dormant = [ready, lp(ready, raise, 0.6), raise, strike, follow, lp(follow, ready, 0.5)];
    const rise = [follow, lp(follow, ready, 0.4), { ...ready, head: -8, eyes: 0.8 }, { ...idle[1], head: -4, eyes: 1 }, { ...hold[0], eyes: 1 }, { ...idle[0], eyes: 0.9 }];

    // Wobbly, slightly wrong imitation of the knight's idle (sword too high, knees too bent, leaning).
    const mimicStance = [0, 1, 2, 3].map((i) => {
        const w = Math.sin((i / 4) * Math.PI * 2);
        return { lean: 6 + w * 6, head: -6 - w * 4, hipF: 14, kneeF: -22, hipB: -14, kneeB: -20, shF: 55 + w * 8, elF: 20, sword: 110 + w * 14, shB: 40, elB: 40, wobble: w, eyes: 0.9 };
    });

    const kneelBase = { hipF: 80, kneeF: -95, hipB: 0, kneeB: -92, lean: 30, head: 36, shF: 15, elF: 10, sword: 62, shB: 10, elB: 20, eyes: 0.3 };
    const staggered = [0, 1, 2, 1].map((b) => ({ ...kneelBase, lean: 30 + b, head: 36 + b * 2, eyes: 0.25 + b * 0.05 }));
    const kneel = [0, 1, 2, 1].map((b) => ({ ...kneelBase, lean: 34 + b * 0.5, head: 44 + b, sword: 66, shF: 4, elF: 6, eyes: 0.15 + b * 0.05 }));

    const roll = [
        { hipF: 60, kneeF: -110, hipB: 10, kneeB: -80, lean: 36, head: 20, shF: 70, elF: 60, shB: 50, elB: 50, sword: -60 },
        { ball: 1, spin: 50 },
        { ball: 1, spin: 140 },
        { ball: 1, spin: 230 },
        { ball: 1, spin: 320 },
        { hipF: 40, kneeF: -80, hipB: -20, kneeB: -60, lean: 26, head: -10, shF: 10, elF: 60, shB: 60, elB: 40, sword: 30, x: 2 },
    ];
    const recoil = [
        { lean: -24, head: -16, shF: 195, elF: 30, sword: 230, hipF: 26, kneeF: -10, hipB: -26, kneeB: -14, shB: -40, elB: 30, eyes: 0.4 },
        { lean: -14, head: -8, shF: 150, elF: 40, sword: 190, hipF: 20, kneeF: -14, hipB: -22, kneeB: -18, shB: -10, elB: 40, eyes: 0.5 },
        { lean: -4, head: -2, shF: 70, elF: 40, sword: 110, hipF: 14, hipB: -14, shB: 20, elB: 50 },
    ];
    const death = [
        { ...recoil[0] },
        { ...lp(recoil[1], kneelBase, 0.5), eyes: 0.4 },
        { ...kneelBase, eyes: 0.3 },
        { ...kneelBase, head: 46, lean: 36, eyes: 0.2 },
        { ...kneelBase, head: 46, lean: 36, eyes: 0.1, dissolve: 0.25 },
        { ...kneelBase, head: 46, lean: 36, eyes: 0.1, dissolve: 0.5 },
        { ...kneelBase, head: 46, lean: 36, eyes: 0.1, dissolve: 0.78 },
        { ...kneelBase, head: 46, lean: 36, eyes: 0.1, dissolve: 1 },
    ];

    const wideSlash = [
        { shF: 135, elF: 55, sword: 215, lean: -2, hipB: -14 },
        { shF: 158, elF: 60, sword: 240, lean: -8, kneeF: -16, hipB: -16 },
        { shF: 165, elF: 62, sword: 252, lean: -11, kneeF: -20, kneeB: -14, hipB: -18, eyes: 1 },
        { shF: 84, elF: 6, sword: 92, lean: 18, hipF: 32, kneeF: -28, hipB: -28, x: 5 },
        { shF: 62, elF: 6, sword: 66, lean: 20, hipF: 34, kneeF: -30, hipB: -30, x: 6 },
        { shF: 40, elF: 20, sword: 50, lean: 12, hipF: 24, kneeF: -20, hipB: -20, x: 3 },
        { ...idle[0], x: 1 },
    ];
    const backSlash = [
        { shF: 20, elF: 95, sword: 15, lean: 10, hipF: 22, kneeF: -20, hipB: -20, x: 2 },
        { shF: 5, elF: 110, sword: -10, lean: 12, hipF: 24, kneeF: -22, hipB: -22, x: 2, eyes: 1 },
        { shF: 92, elF: 4, sword: 102, lean: 14, hipF: 30, kneeF: -24, hipB: -26, x: 3 },
        { shF: 130, elF: 8, sword: 140, lean: 8, hipF: 28, kneeF: -22, hipB: -24, x: 3 },
        { shF: 110, elF: 30, sword: 130, lean: 4, hipF: 18, hipB: -16, x: 2 },
        { ...idle[0], x: 1 },
    ];
    const thrust = [
        { lean: -2, hipF: 22, kneeF: -30, hipB: -22, kneeB: -14, shF: -38, elF: 110, sword: 90 },
        { lean: -6, hipF: 26, kneeF: -38, hipB: -24, kneeB: -20, shF: -50, elF: 120, sword: 91, eyes: 1 },
        { lean: -8, hipF: 28, kneeF: -44, hipB: -26, kneeB: -24, shF: -54, elF: 122, sword: 91, eyes: 1 },
        { lean: 16, hipF: 42, kneeF: -38, hipB: -40, kneeB: -6, shF: 84, elF: 4, sword: 90 },
        { lean: 18, hipF: 44, kneeF: -40, hipB: -42, kneeB: -6, shF: 88, elF: 2, sword: 90, x: 1 },
        { lean: 10, hipF: 32, kneeF: -30, hipB: -30, kneeB: -8, shF: 60, elF: 20, sword: 80, x: 1 },
        { ...idle[0] },
    ];
    const chop = [
        { shF: 160, elF: 20, sword: 185, twoHand: 1, lean: 0, buckler: 0 },
        { shF: 180, elF: 22, sword: 208, twoHand: 1, lean: -8, kneeF: -14, kneeB: -12, buckler: 0 },
        { shF: 192, elF: 26, sword: 222, twoHand: 1, lean: -12, kneeF: -18, kneeB: -16, buckler: 0, eyes: 1 },
        { shF: 104, elF: 4, sword: 104, twoHand: 1, lean: 20, hipF: 38, kneeF: -38, hipB: -32, x: 3, buckler: 0 },
        { shF: 70, elF: 2, sword: 62, twoHand: 1, lean: 34, hipF: 50, kneeF: -66, hipB: -32, kneeB: -30, x: 5, buckler: 0 },
        { shF: 68, elF: 3, sword: 60, twoHand: 1, lean: 34, hipF: 50, kneeF: -66, hipB: -32, kneeB: -30, x: 5, buckler: 0 },
        { shF: 50, elF: 16, sword: 54, lean: 22, hipF: 36, kneeF: -40, hipB: -26, kneeB: -18, x: 1 },
        { ...idle[0] },
    ];
    const turnSlash = [
        { lean: 22, head: -6, hipF: 40, kneeF: -70, hipB: -26, kneeB: -50, shF: -30, elF: 40, sword: -50, shB: 60, elB: 40 },
        { lean: 18, head: -2, hipF: 36, kneeF: -60, hipB: -28, kneeB: -44, shF: -45, elF: 35, sword: -70, shB: 60, elB: 40, eyes: 1 },
        { lean: 16, hipF: 34, kneeF: -40, hipB: -30, kneeB: -24, shF: 80, elF: 6, sword: 86, x: 2 },
        { lean: 18, hipF: 36, kneeF: -42, hipB: -32, kneeB: -24, shF: 52, elF: 6, sword: 60, x: 3 },
        { lean: 12, hipF: 26, kneeF: -28, hipB: -24, shF: 40, elF: 20, sword: 54, x: 2 },
        { ...idle[0], x: 1 },
    ];

    return {
        dormant: { poses: dormant, fps: 6, loop: true },
        rise: { poses: rise, fps: 8 },
        idle: { poses: idle, fps: 5, loop: true },
        walk: { poses: walk, fps: 10, loop: true },
        retreat: { poses: retreat, fps: 9, loop: true },
        hold: { poses: hold, fps: 4, loop: true },
        staggered: { poses: staggered, fps: 4, loop: true },
        mimicStance: { poses: mimicStance, fps: 4, loop: true },
        kneel: { poses: kneel, fps: 3, loop: true },
        roll: { poses: roll, fps: 14 },
        recoil: { poses: recoil, fps: 10 },
        death: { poses: death, fps: 7 },
        wideSlash: { poses: wideSlash, fps: 12, phases: { windup: 3, active: 2, recovery: 2 } },
        backSlash: { poses: backSlash, fps: 12, phases: { windup: 2, active: 2, recovery: 2 } },
        thrust: { poses: thrust, fps: 12, phases: { windup: 3, active: 2, recovery: 2 } },
        chop: { poses: chop, fps: 10, phases: { windup: 3, active: 3, recovery: 2 } },
        turnSlash: { poses: turnSlash, fps: 12, phases: { windup: 2, active: 2, recovery: 2 } },
    };
}

export function buildSquireArt() {
    const { w, h, ax, ay } = SQUIRE_FRAME;
    const { art } = buildCharacter({ fw: w, fh: h, ax, ay, specs: specs(), draw: drawSquire, outlineColor: C.outline, cols: 12, post: dissolve });
    art.points = points;
    return art;
}

