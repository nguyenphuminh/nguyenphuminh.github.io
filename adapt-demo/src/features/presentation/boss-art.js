// The Mirrorwright: a tall obsidian construct with a mirror-glass greatsword, glass crown and
// glowing accent cracks (cyan in phase 1; recolored to magenta for phase 2). Drawn facing right.
import { ACCENT_TO_PHASE2, C, R } from "./palette.js";
import { framesToSheet, hash2, lerpPose, line, paint, poly } from "./pixel.js";
import { Ops, add, buildCharacter, dir, mix, renderOps } from "./rig.js";

export const BOSS_FRAME = { w: 144, h: 120, ax: 72, ay: 112 };

const L = { thigh: 14, shin: 13, torso: 22, upper: 12, fore: 11, blade: 36 };

const BASE = {
    x: 0, lean: 6, head: 0,
    hipF: 12, kneeF: -10, hipB: -12, kneeB: -8,
    shF: 20, elF: 30, shB: -10, elB: 25,
    sword: 40, twoHand: 0, blade: 1,
    sway: 0.2, spin: 0, plant: 1,
    eyes: 0.7, glow: 0, crack: 0, burst: 0, dissolve: 0,
    handOpen: 0, holdShard: 0,
    hammer: 0, restBlade: 0, strike: 0, // cutscene-only: a forging hammer in hand, the blade planted beside him
};

function ik(s, t, l1, l2, bend = 1) {
    const dx = t[0] - s[0], dy = t[1] - s[1];
    const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
    const a = Math.atan2(dy, dx);
    const b = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    return [s[0] + Math.cos(a + bend * b) * l1, s[1] + Math.sin(a + bend * b) * l1];
}

const points = {}; // filled while drawing: named points per anim/frame (anchor-relative)

function drawBoss(px, pose, frameIndex, animName) {
    const p = { ...BASE, ...pose };
    const o = new Ops();
    const top = { shade: "top" };
    const hip = [0, 0];
    const axis = dir(180 - p.lean);
    const perp = dir(90 - p.lean);
    const at = (u, v) => add(add(hip, axis, u), perp, v);

    const neck = at(L.torso, 0.5);
    const headAxis = dir(180 - p.lean - p.head);
    const headPerp = dir(90 - p.lean - p.head);
    const head = add(neck, headAxis, 7.5);
    const hp = (u, v) => add(add(head, headAxis, u), headPerp, v);
    const shF = at(19, 4), shB = at(19, -6);
    const core = at(15, 1.5);

    const leg = (root, a, k) => {
        const knee = add(root, dir(a), L.thigh);
        const ankle = add(knee, dir(a + k), L.shin);
        const toe = add(ankle, dir(a + k + 90), 7);
        const heel = add(ankle, dir(a + k + 90), -2);
        return { root, knee, ankle, toe, heel };
    };
    const legF = leg(at(1, 3), p.hipF, p.kneeF);
    const legB = leg(at(1, -3), p.hipB, p.kneeB);

    const elbowF = add(shF, dir(p.shF), L.upper);
    const handF = add(elbowF, dir(p.shF + p.elF), L.fore);
    const bd = dir(p.sword), bp = [bd[1], -bd[0]];
    let elbowB, handB;
    if (p.twoHand) {
        handB = add(handF, bd, -3.5);
        elbowB = ik(shB, handB, L.upper, L.fore, -1);
    } else {
        elbowB = add(shB, dir(p.shB), L.upper);
        handB = add(elbowB, dir(p.shB + p.elB), L.fore);
    }

    // Cloak behind the body, tattered hem
    const s = p.sway;
    const cl = [at(21, -1), at(19, -9.5)];
    const hemY = 30 - s * 6, hemX = -(10 + s * 14);
    const hem = [];
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const base = add(at(0, -10), [hemX * (1 - t) - 2 * t, hemY * (1 - t * 0.25)]);
        hem.push(add(base, [0, i % 2 ? -4 - hash2(i, frameIndex) * 2 : 0]));
    }
    o.poly([...cl, ...hem, at(4, 0)], R.tabardDark, { noPlant: true });

    // Back leg
    o.cap(legB.root, legB.knee, 4.6, 3.9, R.obsidianDark, top);
    o.cap(legB.knee, legB.ankle, 3.9, 3.0, R.obsidianDark, top);
    o.poly([add(legB.heel, [0, -2.5]), add(legB.ankle, dir(p.hipB + p.kneeB + 90), 2), legB.toe, add(legB.toe, [0, 0.8]), add(legB.heel, [0, 1.2])], R.obsidianDark);
    o.ell(legB.knee, 3.4, 3.0, 0, R.obsidianDark);

    // Back arm (free hand: grasp / shard); glass spikes on the back pauldron
    for (const [u, v, h] of [[3, -4, 7], [3.5, -1, 9], [3, 2, 6]]) {
        const b = add(add(shB, axis, u), perp, v);
        o.poly([add(b, perp, -1.3), add(add(b, axis, h), perp, -4), add(b, perp, 1.3)], R.glass);
    }
    o.ell(shB, 6.5, 5, -p.lean * Math.PI / 180, R.obsidianDark);
    o.cap(shB, elbowB, 3.5, 3.0, R.obsidianDark, top);
    o.cap(elbowB, handB, 3.1, 2.7, R.obsidianDark, top);
    if (p.handOpen) {
        const hd = dir(p.shB + p.elB);
        const hpp = [hd[1], -hd[0]];
        for (const k of [-1.8, 0, 1.8]) o.cap(add(handB, hpp, k), add(add(handB, hd, 6), hpp, k * 1.6), 1.1, 0.7, R.obsidianDark);
    }
    o.ell(handB, 3.2, 3.2, 0, R.obsidianDark);
    if (p.holdShard) {
        o.poly([add(handB, [-2, -1]), add(handB, [1, -9]), add(handB, [3, -1]), add(handB, [0.5, 1.5])], R.glass, { sep: C.sep });
        o.line(add(handB, [0.8, -7.5]), add(handB, [0.5, -1]), C.cyan2);
    }

    // Torso
    o.poly([at(-1, -7), at(-1, 7), at(4, 7.5), at(12, 9.5), at(19, 11.5), at(22.5, 8), at(23, -8), at(19, -11), at(12, -9), at(4, -7.5)], R.obsidian, { sep: C.sep });
    o.line(at(5, -6.5), at(5, 7), C.sep);
    o.line(at(8.5, -7), at(8.5, 8), C.sep);
    // Glass core and cracks (accent, emissive)
    const cr = 1 + p.crack * 2.5;
    o.poly([add(core, axis, 3.2), add(core, perp, 2.6), add(core, axis, -3.2), add(core, perp, -2.6)], R.accent);
    o.dot(add(core, axis, 0.8), C.cyan3);
    const cracks = [[[3.5, 1.5], [6, 4], [7.5, 6.5]], [[-3, -1], [-6, -3.5], [-7, -6]], [[2, -2.5], [4.5, -5.5], [8, -6]], [[-2.5, 2], [-5, 5], [-4.5, 8.5]]];
    for (const c of cracks) {
        let prev = core;
        for (const [u, v] of c) {
            const q = add(add(core, axis, u * cr * 0.8), perp, v * cr * 0.7);
            o.line(prev, q, C.cyan1);
            prev = q;
        }
    }
    // Belt
    o.cap(at(2, -7.2), at(2, 7.5), 1.3, 1.3, R.obsidianDark);
    o.ell(at(2, 1), 1.6, 1.6, 0, R.accent);

    // Front tabard
    const tb = [at(2, -4.5), at(2, 5.5)];
    const tBottom = 22 - s * 3;
    o.poly([...tb, add(at(2, 5.5), [s * -3 - 1, tBottom]), add(at(2, 2.5), [s * -4, tBottom - 3]), add(at(2, 0), [s * -5, tBottom + 1]), add(at(2, -4.5), [s * -6, tBottom - 2])], R.tabard, { sep: C.sep, noPlant: true });
    o.line(add(at(2, 5.5), [s * -3 - 1, tBottom - 1]), add(at(2, -4.5), [s * -6, tBottom - 3]), C.cyan0);

    // Front leg
    o.cap(legF.root, legF.knee, 4.8, 4.1, R.obsidian, { sep: C.sep, shade: "top" });
    o.cap(legF.knee, legF.ankle, 4.1, 3.2, R.obsidian, { sep: C.sep, shade: "top" });
    o.poly([add(legF.heel, [0, -2.5]), add(legF.ankle, dir(p.hipF + p.kneeF + 90), 2), legF.toe, add(legF.toe, [0, 0.8]), add(legF.heel, [0, 1.2])], R.obsidian, { sep: C.sep });
    o.ell(legF.knee, 3.6, 3.2, 0, R.obsidian, { sep: C.sep });
    o.dot(legF.knee, C.cyan1);

    // Head: tall helm, visor glow, glass crown
    const crown = [[-5, -3, -11, -5], [-5.5, 0, -14, -1.5], [-5, 2.5, -11.5, 2], [-4.5, -5.5, -8, -8.5]];
    for (const [u0, v0, u1, v1] of crown) {
        const b0 = hp(-u0, v0 - 1.4), b1 = hp(-u0, v0 + 1.4), tip = hp(-u1, v1);
        o.poly([b0, tip, b1], R.glass, { sep: C.sep });
        o.dot(mix(b0, tip, 0.75), C.cyan2);
    }
    o.poly([hp(6.5, -4.5), hp(7, 3), hp(4, 6), hp(-1, 6.5), hp(-5.5, 4.5), hp(-6.5, -1), hp(-5.5, -5), hp(0, -6.5)], R.obsidian, { sep: C.sep });
    const eye = p.eyes < 0.35 ? C.cyan0 : p.eyes < 0.85 ? C.cyan2 : C.cyan3;
    o.line(hp(-0.5, 0.5), hp(-0.5, 6), C.ink);
    o.line(hp(0.5, 0.5), hp(0.5, 6), C.ink);
    o.line(hp(-0.5, 2.5), hp(-0.5, 5.5), eye);
    if (p.eyes >= 0.85) o.line(hp(0.5, 3.5), hp(0.5, 5.5), C.cyan2);
    o.line(hp(2.5, 4.5), hp(5.5, 4), C.sep);

    // Mirror-glass greatsword
    if (p.blade > 0) {
        const len = L.blade * p.blade;
        const b0 = add(handF, bd, 4);
        const tip = add(handF, bd, 4 + len);
        o.poly([add(b0, bp, 3.4), add(add(b0, bd, len * 0.82), bp, 2.4), tip, add(add(b0, bd, len * 0.82), bp, -2.6), add(b0, bp, -3.4)], R.glass, { sep: C.sep, noPlant: true });
        o.line(add(add(b0, bd, 2), bp, 0.8), add(add(b0, bd, len * 0.85), bp, 0.6), C.white);
        const k1 = add(b0, bd, len * 0.35), k2 = add(b0, bd, len * 0.62);
        o.line(add(k1, bp, -2.2), add(add(k1, bd, 3), bp, 0.2), C.cyan1);
        o.line(add(add(k1, bd, 3), bp, 0.2), add(add(k1, bd, 5), bp, 2), C.cyan1);
        o.line(add(k2, bp, 1.6), add(add(k2, bd, 4), bp, -1.6), C.cyan2);
        o.cap(add(add(handF, bd, 3), bp, 5.5), add(add(handF, bd, 3), bp, -5.5), 1.4, 1.4, R.obsidianDark, { shade: "top", noPlant: true });
        o.dot(add(handF, bd, 3), C.cyan2);
        o.cap(add(handF, bd, -3), add(handF, bd, 2), 1.2, 1.2, R.obsidianDark);
    }

    // Forging hammer (cutscene): a dark haft with a glass-edged head
    let hammerHead = null;
    if (p.hammer) {
        const h0 = add(handF, bd, -2), h1 = add(handF, bd, 12);
        o.cap(h0, h1, 1.2, 1.2, R.obsidianDark, { noPlant: true, shade: "top" });
        hammerHead = add(handF, bd, 13.5);
        o.poly([add(add(hammerHead, bp, 4.5), bd, -2.5), add(add(hammerHead, bp, 4.5), bd, 2.5), add(add(hammerHead, bp, -4.5), bd, 2.5), add(add(hammerHead, bp, -4.5), bd, -2.5)], R.obsidian, { sep: C.sep, noPlant: true });
        o.line(add(add(hammerHead, bp, -4.5), bd, 2.5), add(add(hammerHead, bp, 4.5), bd, 2.5), C.cyan1);
    }

    // Front arm with a crowned pauldron
    o.cap(shF, elbowF, 3.7, 3.2, R.obsidian, { sep: C.sep, shade: "top" });
    o.cap(elbowF, handF, 3.3, 2.9, R.obsidian, { sep: C.sep, shade: "top" });
    const pr = -p.lean * Math.PI / 180;
    o.ell(shF, 6.2, 4.6, pr, R.obsidian, { sep: C.sep });
    o.line(add(add(shF, axis, -1.5), perp, -6), add(add(shF, axis, -1.5), perp, 6), C.cyan0);
    o.ell(handF, 3.4, 3.4, 0, R.obsidian, top);

    const { ox, oy } = renderOps(px, o, { spin: p.spin, plant: p.plant, hx: BOSS_FRAME.ax + p.x, floorY: BOSS_FRAME.ay + 0.5 });

    // Record useful points (anchor-relative) for the game, e.g. where a grabbed player hangs.
    const rel = (q) => [Math.round(q[0] + ox - BOSS_FRAME.ax), Math.round(q[1] + oy - BOSS_FRAME.ay)];
    (points[animName] ??= [])[frameIndex] = { backHand: rel(handB), bladeTip: rel(add(handF, bd, 4 + L.blade * p.blade)), core: rel(core), ...(hammerHead ? { hammerHead: rel(hammerHead) } : {}) };

    // The mirror-glass greatsword planted in the floor behind him (cutscene), drawn in frame space.
    if (p.restBlade) {
        const bx = BOSS_FRAME.ax - 34, fy = BOSS_FRAME.ay;
        paint(px, poly([[bx - 3, fy - 34], [bx + 3, fy - 34], [bx + 2, fy - 4], [bx, fy + 1], [bx - 2, fy - 4]]), R.glass, { sep: C.sep });
        line(px, bx, fy - 32, bx, fy - 6, C.white);
        paint(px, poly([[bx - 6, fy - 37], [bx + 6, fy - 37], [bx + 6, fy - 34], [bx - 6, fy - 34]]), R.obsidianDark, { sep: C.sep });
        paint(px, poly([[bx - 1.5, fy - 46], [bx + 1.5, fy - 46], [bx + 1.5, fy - 37], [bx - 1.5, fy - 37]]), R.obsidianDark);
        px.set(bx, fy - 36, C.cyan2);
        line(px, bx - 1, fy - 22, bx + 1, fy - 16, C.cyan1);
    }

    // Emissive aura: glow and burst shards (outside the outline)
    const cx = core[0] + ox, cy = core[1] + oy;
    const sparkAt = p.strike && hammerHead ? [Math.round(hammerHead[0] + ox), Math.round(hammerHead[1] + oy + 3)] : null;
    px.emit = () => {
        emitBoss(px, p, frameIndex, cx, cy);
        if (sparkAt) {
            for (let i = 0; i < 12; i++) {
                const a = -Math.PI * (0.1 + hash2(i, frameIndex, 21) * 0.8), r = 2 + hash2(i, frameIndex, 22) * 7;
                const gx = Math.round(sparkAt[0] + Math.cos(a) * r), gy = Math.round(sparkAt[1] + Math.sin(a) * r);
                if (!px.get(gx, gy)) px.set(gx, gy, i % 3 ? C.cyan2 : C.white);
            }
        }
    };
}

function emitBoss(px, p, frameIndex, cx, cy) {
    if (p.glow > 0) {
        const n = Math.round(p.glow * 26);
        for (let i = 0; i < n; i++) {
            const a = hash2(i, frameIndex, 7) * Math.PI * 2, r = 10 + hash2(i, frameIndex, 8) * 22 * p.glow;
            const gx = Math.round(cx + Math.cos(a) * r), gy = Math.round(cy + Math.sin(a) * r * 1.3);
            if (!px.get(gx, gy)) px.set(gx, gy, i % 4 ? C.cyan2 : C.cyan3);
        }
    }
    if (p.burst > 0) {
        for (let i = 0; i < 36; i++) {
            const a = hash2(i, 3) * Math.PI * 2, r = 8 + p.burst * (20 + hash2(i, 4) * 34);
            const gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r * 0.9;
            px.set(Math.round(gx), Math.round(gy), i % 3 ? C.cyan2 : C.cyan3);
            px.set(Math.round(gx + Math.cos(a)), Math.round(gy + Math.sin(a)), C.cyan1);
        }
    }
}

// Death: crumble the figure into falling glass.
function dissolve(px, pose, frameIndex) {
    const d = pose.dissolve ?? 0;
    if (!d) return;
    const src = px.data.slice();
    px.clear();
    for (let y = 0; y < px.h; y++) {
        for (let x = 0; x < px.w; x++) {
            const c = src[y * px.w + x];
            if (!c) continue;
            const h = hash2(x >> 1, y >> 1, 11);
            if (h > d * 1.15 - (px.h - y) / px.h * 0.25) px.set(x, y, c);
            else if (h > d * 0.85 && hash2(x, y, 5) < 0.18) {
                const fall = Math.round(d * 30 * hash2(x, y, 6));
                px.set(x + Math.round((hash2(x, y, 9) - 0.5) * d * 16), Math.min(px.h - 9 + Math.round(hash2(x, y, 2) * 4), y + fall), hash2(x, y, 3) < 0.5 ? C.cyan2 : C.cyan3);
            }
        }
    }
}

const lp = lerpPose;

function specs() {
    const idle = [0, 1, 2, 3, 2, 1].map((b) => ({ lean: 6 + b * 0.4, sword: 40 - b, kneeF: -10 - b, kneeB: -8 - b, shF: 20 + b * 0.5, eyes: 0.6 + b * 0.1, sway: 0.2 + b * 0.03 }));

    const dormantBase = { hipF: 82, kneeF: -92, hipB: -4, kneeB: -96, lean: 18, head: 34, sword: 2, twoHand: 1, shF: 60, elF: 30, sway: 0.05 };
    const dormant = [0.15, 0.3, 0.45, 0.3].map((e) => ({ ...dormantBase, eyes: e }));
    const rise = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => ({ ...lp(dormantBase, idle[0], t), twoHand: t < 0.5 ? 1 : 0, eyes: 0.3 + t, glow: t > 0.6 ? 0.4 : 0 }));

    const walk = [];
    for (let i = 0; i < 8; i++) {
        const f = (i / 8) * Math.PI * 2;
        walk.push({
            lean: 10, hipF: 24 * Math.sin(f), kneeF: -(8 + 34 * Math.max(0, Math.cos(f))),
            hipB: 24 * Math.sin(f + Math.PI), kneeB: -(8 + 34 * Math.max(0, Math.cos(f + Math.PI))),
            shF: 22 - 8 * Math.sin(f), elF: 28, shB: -8 + 14 * Math.sin(f), elB: 25, sword: 34, sway: 0.4 + 0.1 * Math.sin(f * 2),
        });
    }
    const retreat = [];
    for (let i = 0; i < 6; i++) {
        const f = (i / 6) * Math.PI * 2;
        retreat.push({
            lean: -2, hipF: 16 * Math.sin(-f), kneeF: -(10 + 26 * Math.max(0, -Math.cos(f))),
            hipB: 16 * Math.sin(-f + Math.PI), kneeB: -(10 + 26 * Math.max(0, -Math.cos(f + Math.PI))),
            shF: 40, elF: 40, sword: 75, shB: -20, elB: 30, sway: 0.1,
        });
    }
    const hold = [0, 1, 2, 1].map((b) => ({ lean: 4, hipF: 22, kneeF: -24 - b, hipB: -20, kneeB: -18 - b, shF: 65, elF: 55, sword: 140 + b, twoHand: 1, sway: 0.15, eyes: 0.8 }));

    const quickCut = [
        { shF: 110, elF: 60, sword: 165, lean: 0 },
        { shF: 145, elF: 70, sword: 235, lean: -6, kneeF: -16 },
        { shF: 155, elF: 70, sword: 252, lean: -10, kneeF: -20, kneeB: -14, eyes: 1 },
        { shF: 30, elF: 40, sword: 88, lean: 14, hipF: 30, kneeF: -26, hipB: -26, sway: 0.6 },
        { shF: 40, elF: 12, sword: 52, lean: 18, hipF: 32, kneeF: -28, hipB: -28, x: 3, sway: 0.7 },
        { shF: 32, elF: 22, sword: 44, lean: 13, hipF: 24, kneeF: -20, hipB: -22, x: 2, sway: 0.5 },
        { ...idle[0], x: 1 },
    ];
    const feintStep = [
        { shF: 130, elF: 50, sword: 160, lean: -6, hipB: -28, kneeB: -20, hipF: 6, x: -2 },
        { shF: 70, elF: 50, sword: 95, lean: -4, hipB: -22, kneeB: -14, hipF: 4, x: -4 },
        { ...idle[0], x: -3 },
    ];
    const lunge = [
        { lean: -2, hipF: 24, kneeF: -32, hipB: -22, kneeB: -14, shF: -35, elF: 105, sword: 90 },
        { lean: -6, hipF: 28, kneeF: -40, hipB: -24, kneeB: -20, shF: -48, elF: 115, sword: 91, eyes: 1 },
        { lean: -8, hipF: 30, kneeF: -46, hipB: -26, kneeB: -24, shF: -52, elF: 118, sword: 91, eyes: 1 },
        { lean: 18, hipF: 46, kneeF: -40, hipB: -42, kneeB: -6, shF: 30, elF: 58, sword: 90, sway: 0.9 },
        { lean: 20, hipF: 48, kneeF: -42, hipB: -44, kneeB: -6, shF: 38, elF: 50, sword: 89, x: 1, sway: 1 },
        { lean: 12, hipF: 36, kneeF: -32, hipB: -32, kneeB: -8, shF: 35, elF: 30, sword: 70, x: 1, sway: 0.6 },
        { ...idle[0] },
    ];
    const slam = [
        { shF: 160, elF: 20, sword: 182, twoHand: 1, lean: 0 },
        { shF: 182, elF: 22, sword: 208, twoHand: 1, lean: -8, kneeF: -14, kneeB: -12 },
        { shF: 195, elF: 28, sword: 222, twoHand: 1, lean: -12, kneeF: -18, kneeB: -16, eyes: 1 },
        { shF: 115, elF: 5, sword: 100, twoHand: 1, lean: 16, hipF: 34, kneeF: -34, hipB: -32, sway: 0.6 },
        { shF: 62, elF: 5, sword: 52, twoHand: 1, lean: 30, hipF: 46, kneeF: -60, hipB: -30, kneeB: -30, sway: 0.7 },
        { shF: 60, elF: 6, sword: 50, twoHand: 1, lean: 30, hipF: 46, kneeF: -60, hipB: -30, kneeB: -30, sway: 0.4 },
        { shF: 55, elF: 18, sword: 55, lean: 22, hipF: 36, kneeF: -40, hipB: -26, kneeB: -18 },
        { ...idle[0] },
    ];
    const sweep = [
        { lean: 10, hipF: 30, kneeF: -40, hipB: -28, kneeB: -30, shF: -30, elF: 15, sword: -60 },
        { lean: 14, hipF: 34, kneeF: -48, hipB: -32, kneeB: -36, shF: -45, elF: 12, sword: -78, eyes: 1 },
        { lean: 16, hipF: 36, kneeF: -52, hipB: -34, kneeB: -40, shF: -52, elF: 10, sword: -86, eyes: 1 },
        { lean: 22, hipF: 40, kneeF: -58, hipB: -36, kneeB: -44, shF: 40, elF: 4, sword: 76, sway: 0.7 },
        { lean: 24, hipF: 40, kneeF: -58, hipB: -36, kneeB: -44, shF: 52, elF: 2, sword: 80, x: 1, sway: 0.8 },
        { lean: 16, hipF: 32, kneeF: -42, hipB: -30, kneeB: -28, shF: 48, elF: 12, sword: 66, x: 1 },
        { ...idle[0] },
    ];
    const leap = [
        { lean: 22, hipF: 48, kneeF: -64, hipB: -22, kneeB: -52, shF: 150, elF: 20, sword: 185, twoHand: 1 },
        { lean: 26, hipF: 52, kneeF: -74, hipB: -24, kneeB: -60, shF: 165, elF: 22, sword: 200, twoHand: 1, eyes: 1 },
        { lean: -4, hipF: 62, kneeF: -95, hipB: 22, kneeB: -85, shF: 190, elF: 18, sword: 205, twoHand: 1, sway: 0.9 },
        { lean: 8, hipF: 24, kneeF: -26, hipB: -18, kneeB: -30, shF: 175, elF: 15, sword: 170, twoHand: 1, sway: 1 },
        { lean: 30, hipF: 50, kneeF: -70, hipB: -26, kneeB: -50, shF: 55, elF: 8, sword: 48, twoHand: 1, sway: 0.5 },
        { lean: 26, hipF: 46, kneeF: -62, hipB: -24, kneeB: -44, shF: 55, elF: 10, sword: 46, twoHand: 1, sway: 0.3 },
        { lean: 14, hipF: 30, kneeF: -32, hipB: -18, kneeB: -20, shF: 45, elF: 25, sword: 55 },
    ];
    const shard = [
        { lean: -4, hipB: -26, kneeB: -16, hipF: 6, shB: 185, elB: 55, holdShard: 1, sword: 45, x: -2 },
        { lean: -8, hipB: -30, kneeB: -20, hipF: 4, shB: 205, elB: 60, holdShard: 1, sword: 45, x: -3, eyes: 1 },
        { lean: 14, hipF: 22, kneeF: -16, hipB: -24, shB: 85, elB: 2, sword: 45, x: -1, sway: 0.6 },
        { lean: 16, hipF: 24, kneeF: -18, hipB: -26, shB: 65, elB: 8, sword: 45, x: -1, sway: 0.5 },
        { lean: 10, hipF: 16, hipB: -18, shB: 30, elB: 20, sword: 38 },
        { ...idle[0] },
    ];
    const grasp = [
        { lean: -4, hipB: -22, kneeB: -14, shB: -55, elB: 40, handOpen: 1, sword: 45 },
        { lean: 4, hipF: 20, kneeF: -20, hipB: -22, shB: -30, elB: 30, handOpen: 1, sword: 45, eyes: 1 },
        { lean: 24, hipF: 40, kneeF: -32, hipB: -40, kneeB: -6, shB: 62, elB: 6, handOpen: 1, sword: 45, x: 11, sway: 0.8 },
        { lean: 26, hipF: 42, kneeF: -34, hipB: -42, kneeB: -6, shB: 64, elB: 4, handOpen: 1, sword: 45, x: 12, sway: 0.9 },
        { lean: 12, hipF: 24, kneeF: -20, hipB: -26, shB: 50, elB: 20, sword: 45, x: 7 },
    ];
    const grabHold = [0, 1, 2, 3].map((i) => ({ lean: -2 + (i % 2), hipF: 16, hipB: -16, kneeF: -14, kneeB: -12, shB: 100 + (i % 2) * 2, elB: -8, sword: 36, eyes: 1, sway: 0.25 }));
    const shardRain = [
        { lean: -2, shF: 120, elF: 30, sword: 165, shB: 40, elB: 30 },
        { lean: -6, shF: 130, elF: 25, sword: 175, shB: 70, elB: 30, glow: 0.4, eyes: 1 },
        { lean: -8, shF: 140, elF: 20, sword: 180, shB: 90, elB: 25, glow: 0.8, eyes: 1 },
        { lean: -8, shF: 142, elF: 20, sword: 181, shB: 95, elB: 25, glow: 1, burst: 0.4, eyes: 1 },
        { lean: -6, shF: 138, elF: 20, sword: 179, shB: 90, elB: 25, glow: 0.6, burst: 0.8, eyes: 1 },
        { lean: 0, shF: 110, elF: 30, sword: 140, shB: 40, elB: 30, glow: 0.2 },
        { ...idle[0] },
    ];
    const recoil = [
        { lean: -24, head: -16, shF: 205, elF: 30, sword: 232, hipF: 26, kneeF: -10, hipB: -26, kneeB: -14, sway: 0.9, eyes: 0.4 },
        { lean: -16, head: -10, shF: 170, elF: 40, sword: 205, hipF: 22, kneeF: -14, hipB: -22, kneeB: -18, sway: 0.6, eyes: 0.5 },
        { lean: -6, head: -4, shF: 90, elF: 40, sword: 120, hipF: 16, hipB: -16, sway: 0.4 },
    ];
    const kneel = { hipF: 80, kneeF: -92, hipB: 0, kneeB: -95, lean: 34, head: 40, shF: 10, elF: 10, sword: 80, shB: 0, elB: 10, sway: 0.05, eyes: 0.2 };
    const staggered = [0, 1, 2, 1].map((b) => ({ ...kneel, lean: 34 + b, head: 40 + b * 2, eyes: 0.2 + b * 0.05 }));
    const transition = [
        { ...kneel, eyes: 0.4 },
        { ...kneel, lean: 28, shB: 60, elB: 110, crack: 0.2, eyes: 0.6, glow: 0.2 },
        { ...lp(kneel, idle[0], 0.35), shB: 70, elB: 105, crack: 0.4, eyes: 0.8, glow: 0.4 },
        { ...lp(kneel, idle[0], 0.7), shB: 60, elB: 100, crack: 0.6, eyes: 1, glow: 0.6 },
        { lean: -10, head: -22, shF: 120, elF: 10, shB: 140, elB: 10, sword: 150, crack: 0.8, eyes: 1, glow: 0.8, sway: 0.6 },
        { lean: -14, head: -28, shF: 128, elF: 5, shB: 150, elB: 5, sword: 156, crack: 1, eyes: 1, glow: 1, sway: 0.8 },
        { lean: -14, head: -28, shF: 130, elF: 5, shB: 152, elB: 5, sword: 158, crack: 1, eyes: 1, glow: 1, burst: 0.35, sway: 0.9 },
        { lean: -12, head: -24, shF: 128, elF: 8, shB: 150, elB: 8, sword: 156, crack: 1, eyes: 1, glow: 0.8, burst: 0.75, sway: 1 },
        { lean: 0, head: -6, shF: 50, elF: 30, shB: 40, elB: 30, sword: 60, crack: 1, eyes: 1, glow: 0.5, sway: 0.5 },
        { ...idle[0], crack: 1, eyes: 1, glow: 0.3 },
    ];
    const death = [
        { ...recoil[0], crack: 0.5 },
        { ...lp(recoil[1], kneel, 0.4), crack: 0.7, eyes: 0.6 },
        { ...lp(recoil[2], kneel, 0.8), crack: 0.9, eyes: 0.5 },
        { ...kneel, crack: 1, eyes: 0.4, glow: 0.3 },
        { ...kneel, head: 50, lean: 40, crack: 1, eyes: 0.3, glow: 0.5 },
        { ...kneel, head: 50, lean: 40, crack: 1, eyes: 0.3, dissolve: 0.15 },
        { ...kneel, head: 50, lean: 40, crack: 1, eyes: 0.2, dissolve: 0.35 },
        { ...kneel, head: 50, lean: 40, crack: 1, eyes: 0.1, dissolve: 0.55 },
        { ...kneel, head: 50, lean: 40, crack: 1, eyes: 0.1, dissolve: 0.78 },
        { ...kneel, head: 50, lean: 40, crack: 1, eyes: 0.1, dissolve: 1 },
    ];

    // Cutscene: hammering at the glass anvil ~30 px in front of him, his blade planted behind him.
    const smith = { blade: 0, hammer: 1, restBlade: 1, shB: -5, elB: 30, hipF: 18, kneeF: -14, hipB: -14, kneeB: -10, sway: 0.25, eyes: 0.7 };
    const forge = [
        { ...smith, shF: 150, elF: 40, sword: 195, lean: 6 },
        { ...smith, shF: 168, elF: 45, sword: 212, lean: 2 },
        { ...smith, shF: 90, elF: 0, sword: 160, lean: 14 },
        { ...smith, shF: 18, elF: -14, sword: 112, lean: 25, strike: 1, eyes: 1 },
        { ...smith, shF: 45, elF: -5, sword: 125, lean: 17 },
        { ...smith, shF: 110, elF: 20, sword: 165, lean: 10 },
    ];
    const liftBlade = [
        { ...smith, shF: 40, elF: -10, sword: 112, lean: 16 },
        { ...smith, hammer: 0, shF: -10, elF: 30, sword: 100, lean: 0, eyes: 0.9 },
        { ...smith, hammer: 0, shF: -75, elF: 8, sword: 100, lean: -16, hipB: -24, kneeB: -16, hipF: 24, kneeF: -22 },
        { ...smith, hammer: 0, restBlade: 0, blade: 1, shF: -35, elF: 20, sword: -75, lean: -6, eyes: 1 },
        { ...lp(smith, hold[0], 0.6), hammer: 0, restBlade: 0, blade: 1, shF: 110, elF: 45, sword: 150, eyes: 1 },
        { ...idle[0] },
    ];
    // Defeated: kneeling on one knee, both hands on the hilt of the planted blade.
    const fallenBase = { hipF: 82, kneeF: -94, hipB: -2, kneeB: -96, lean: 20, head: 30, shF: 62, elF: 18, sword: 0, twoHand: 1, blade: 0.78, sway: 0.05, eyes: 0.25 };
    const fallen = [0, 1, 2, 1].map((b) => ({ ...fallenBase, lean: 20 + b * 0.6, head: 30 + b * 1.5, eyes: 0.2 + b * 0.05 }));

    return {
        dormant: { poses: dormant, fps: 3, loop: true },
        rise: { poses: rise, fps: 6 },
        idle: { poses: idle, fps: 6, loop: true },
        walk: { poses: walk, fps: 9, loop: true },
        retreat: { poses: retreat, fps: 8, loop: true },
        hold: { poses: hold, fps: 4, loop: true },
        quickCut: { poses: quickCut, fps: 12, phases: { windup: 3, active: 2, recovery: 2 } },
        feintStep: { poses: feintStep, fps: 10 },
        lunge: { poses: lunge, fps: 12, phases: { windup: 3, active: 2, recovery: 2 } },
        slam: { poses: slam, fps: 10, phases: { windup: 3, active: 2, recovery: 3 } },
        sweep: { poses: sweep, fps: 12, phases: { windup: 3, active: 2, recovery: 2 } },
        leap: { poses: leap, fps: 10, phases: { windup: 2, active: 3, recovery: 2 } },
        shard: { poses: shard, fps: 10, phases: { windup: 2, active: 2, recovery: 2 } },
        grasp: { poses: grasp, fps: 10, phases: { windup: 2, active: 2, recovery: 1 } },
        grabHold: { poses: grabHold, fps: 6, loop: true },
        shardRain: { poses: shardRain, fps: 8, phases: { windup: 3, active: 2, recovery: 2 } },
        recoil: { poses: recoil, fps: 10 },
        staggered: { poses: staggered, fps: 4, loop: true },
        transition: { poses: transition, fps: 10 / 1.8 },
        death: { poses: death, fps: 6 },
        // Appended (cutscenes) so the frames of every earlier anim keep their sheet positions.
        forge: { poses: forge, fps: 8, loop: true },
        liftBlade: { poses: liftBlade, fps: 6 },
        fallen: { poses: fallen, fps: 3, loop: true },
    };
}

export function buildBossArt() {
    const { w, h, ax, ay } = BOSS_FRAME;
    const { frames, art } = buildCharacter({ fw: w, fh: h, ax, ay, specs: specs(), draw: drawBoss, outlineColor: C.outline, cols: 12, post: dissolve });
    art.sheetPhase2 = framesToSheet(frames, w, h, 12, (c) => ACCENT_TO_PHASE2.get(c) ?? c);
    art.points = points;
    return art;
}
