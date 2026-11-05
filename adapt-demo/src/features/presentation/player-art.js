// The player: a lone knight with a sword and gold accents. Drawn facing right.
import { C, R } from "./palette.js";
import { hash2, lerpPose } from "./pixel.js";
import { Ops, add, buildCharacter, dir, mix, renderOps } from "./rig.js";

export const PLAYER_FRAME = { w: 80, h: 56, ax: 40, ay: 52 };

const L = { thigh: 6.5, shin: 6, torso: 8.5, upper: 5, fore: 4.6, sword: 15 };

const BASE = {
    x: 0, lean: 4, head: 0,
    hipF: 10, kneeF: -6, hipB: -9, kneeB: -6,
    shF: 25, elF: 35, shB: -15, elB: 25,
    sword: 65, twoHand: 0,
    cape: 0.2, capeLift: 0,
    spin: 0, plant: 1, hy: 31.5,
    vial: 0, glow: 0, spark: 0, dropSword: 0, shard: 0,
};

// Two-bone IK: returns the elbow for a shoulder→target reach (bend chooses the side).
function ik(s, t, l1, l2, bend = 1) {
    const dx = t[0] - s[0], dy = t[1] - s[1];
    const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
    const a = Math.atan2(dy, dx);
    const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const b = Math.acos(Math.max(-1, Math.min(1, cos)));
    return [s[0] + Math.cos(a + bend * b) * l1, s[1] + Math.sin(a + bend * b) * l1];
}

// The knight's own palette (any other rig user passes its own: the Reflection, the Hollow Echo).
export const KNIGHT_PALETTE = {
    steel: R.steel, steelDark: R.steelDark, cloth: R.cloth, clothDark: R.clothDark, cape: R.cape,
    gold: R.gold, crest: R.gold, blade: R.blade, leather: R.leather,
    trim: C.gold1, belt: C.gold2, beltDot: C.gold4, vialDot: C.gold4,
    visor: C.ink, visorDot: C.gold3, pommel: C.gold3, sparkA: C.white, sparkB: C.gold3, moteA: C.gold3, moteB: C.gold4,
};

// Mid-roll frames: a cape-wrapped ball with helm, crest, boots and gauntlet spinning around it.
function drawBall(px, p, K) {
    const o = new Ops();
    const top = { shade: "top" };
    o.cap([-4.8, 2.6], [-7.4, 4.4], 1.3, 1.0, K.leather, top);
    o.ell([0, 0], 6.6, 6.0, 0, K.cape);
    o.line([-6, 1], [-2, 5.6], K.trim);
    o.ell([1.2, 1.6], 4.2, 3.4, 0.3, K.cloth, { sep: C.sep });
    o.cap([3.4, 3.4], [6.4, 4.2], 1.3, 1.1, K.leather, { sep: C.sep, shade: "top" });
    o.ell([2.6, -3.4], 3.1, 3.3, 0, K.steel, { sep: C.sep });
    o.cap([1.6, -6.0], [-3.6, -6.4], 1.3, 0.6, K.crest, top);
    o.line([4.2, -3.6], [5.4, -3.6], K.visor);
    o.ell([5.4, 0.4], 1.5, 1.5, 0, K.steel, { sep: C.sep, shade: "top" });
    o.dot([6.4, -0.8], K.visorDot);
    renderOps(px, o, { spin: p.spin, plant: true, hx: PLAYER_FRAME.ax + p.x, floorY: PLAYER_FRAME.ay + 0.5 });
}

// Draws the knight rig with palette K. rec(info) receives anchor-relative points (blade tip, hands, hip) when given.
export function drawKnightWith(px, pose, K, rec = null) {
    if (pose.ball) return drawBall(px, { x: 0, ...pose }, K);
    const p = { ...BASE, ...pose };
    const SW = K.swordLen ?? L.sword;
    const o = new Ops();
    const hip = [0, 0];
    const axis = dir(180 - p.lean);
    const perp = dir(90 - p.lean);
    const at = (u, v) => add(add(hip, axis, u), perp, v);

    const neck = at(L.torso, 0);
    const chest = at(6, 0);
    const headAxis = dir(180 - p.lean - p.head);
    const headPerp = dir(90 - p.lean - p.head);
    const head = add(neck, headAxis, 3.2);
    const shF = at(7.4, 0.6), shB = at(7.4, -1.2);

    // Legs
    const leg = (root, a, k) => {
        const knee = add(root, dir(a), L.thigh);
        const ankle = add(knee, dir(a + k), L.shin);
        const toe = add(ankle, dir(a + k + 90), 2.6);
        return { root, knee, ankle, toe };
    };
    const legF = leg(at(0, 1), p.hipF, p.kneeF);
    const legB = leg(at(0, -1), p.hipB, p.kneeB);

    // Arms
    const elbowF = add(shF, dir(p.shF), L.upper);
    const handF = add(elbowF, dir(p.shF + p.elF), L.fore);
    const bd = dir(p.sword);
    const bp = [bd[1], -bd[0]];
    let elbowB, handB;
    if (p.twoHand) {
        handB = add(handF, bd, -1.6);
        elbowB = ik(shB, handB, L.upper, L.fore, -1);
    } else {
        elbowB = add(shB, dir(p.shB), L.upper);
        handB = add(elbowB, dir(p.shB + p.elB), L.fore);
    }

    const top = { shade: "top" };

    // Cape (behind everything): long royal-blue cloak with a gold hem
    const w = p.cape, lift = p.capeLift;
    const c0 = at(L.torso - 0.2, -0.6), c1 = at(7.2, -3.0);
    const cb = add(at(0, -3.2), [-(2.5 + w * 9), 9.5 - w * 4 - lift * 8]);
    const cm = add(cb, [2.6 + w, -1.2]);
    const cj = add(cm, [1.8, 1.6 - lift]);
    const cn = add(at(-1, -1.6), [-w, 4.5 - lift * 4]);
    o.poly([c0, c1, cb, cm, cj, cn], K.cape, { noPlant: true });
    o.line(cb, mix(cb, cm, 0.95), K.trim);
    o.line(cm, mix(cm, cj, 0.9), K.trim);

    // Back leg & arm (darker: further from the light)
    o.cap(legB.root, legB.knee, 1.7, 1.5, K.clothDark, top);
    o.cap(legB.knee, legB.ankle, 1.5, 1.3, K.steelDark, top);
    o.cap(legB.ankle, legB.toe, 1.2, 1.0, K.leather, top);
    o.cap(shB, elbowB, 1.3, 1.2, K.steelDark, top);
    o.cap(elbowB, handB, 1.25, 1.15, K.steelDark, top);
    if (p.vial) {
        o.cap(add(handB, [0, -0.5]), add(handB, [0.4, -3.2]), 1.2, 1.0, K.gold, { sep: C.sep, shade: "top" });
        o.dot(add(handB, [0.4, -2.4]), K.vialDot);
    }
    if (p.shard) {
        // A small mirror shard held in the back hand (Arrival cutscene)
        o.poly([add(handB, [-1.4, -0.6]), add(handB, [0.2, -5.2]), add(handB, [1.8, -1.0]), add(handB, [0.4, 0.8])], R.glass, { sep: C.sep, noPlant: true });
        o.dot(add(handB, [0.4, -3.6]), C.cyan2);
    }
    o.ell(handB, 1.2, 1.2, 0, K.leather, top);

    // Torso: steel breastplate over a blue tabard, gold belt
    o.poly([at(-3.6, -2.8), at(-3.6, 3.0), at(1.5, 2.9), at(1.5, -2.8)], K.cloth, { sep: C.sep });
    o.poly([at(1.2, -2.4), at(1.2, 2.6), at(6, 3.1), at(L.torso + 0.5, 2.0), at(L.torso + 0.5, -2.6), at(6, -3.0)], K.steel, { sep: C.sep });
    o.line(at(1.4, -2.6), at(1.4, 2.8), K.belt);
    o.dot(at(1.4, 1.2), K.beltDot);
    o.line(at(-3.4, -2.6), at(-3.4, 2.8), K.trim);

    // Front leg
    o.cap(legF.root, legF.knee, 1.8, 1.6, K.cloth, { sep: C.sep, shade: "top" });
    o.cap(legF.knee, legF.ankle, 1.6, 1.35, K.steel, { sep: C.sep, shade: "top" });
    o.cap(legF.ankle, legF.toe, 1.25, 1.05, K.leather, { sep: C.sep, shade: "top" });

    // Head: rounded great helm, T-visor, gold crest
    const hp = (u, v) => add(add(head, headAxis, u), headPerp, v);
    o.poly([hp(3.4, -2.6), hp(3.6, 1.6), hp(2.4, 3.3), hp(-2.6, 3.2), hp(-3.4, 1.0), hp(-3.2, -2.8), hp(0, -3.4)], K.steel, { sep: C.sep });
    const crestBase = hp(3.2, -0.6);
    const crestMid = add(hp(4.6, -3.2), [-w * 1.5, -lift]);
    const crestTip = add(hp(3.0, -6.6), [-(w * 3.5), 2 - lift * 2.5]);
    o.cap(crestBase, crestMid, 1.5, 1.2, K.crest, top);
    o.cap(crestMid, crestTip, 1.2, 0.6, K.crest, top);
    o.line(hp(0.6, 0.2), hp(0.6, 3.4), K.visor);
    o.line(hp(0.6, 2.0), hp(-1.6, 2.0), K.visor);
    o.dot(hp(0.6, 2.6), K.visorDot);

    // Sword
    if (!p.dropSword) {
        o.cap(add(handF, bd, 1.8), add(handF, bd, SW), 1.1, 0.5, K.blade, { sep: C.sep, noPlant: true });
        o.cap(add(add(handF, bd, 1.3), bp, 2.4), add(add(handF, bd, 1.3), bp, -2.4), 0.75, 0.75, K.gold, top);
        o.dot(add(handF, bd, -1.6), K.pommel);
    }

    // Front arm with a gold-rimmed pauldron
    o.cap(shF, elbowF, 1.45, 1.3, K.steel, { sep: C.sep, shade: "top" });
    o.cap(elbowF, handF, 1.35, 1.2, K.steel, { sep: C.sep, shade: "top" });
    o.ell(shF, 2.5, 2.0, -p.lean * Math.PI / 180, K.steel, { sep: C.sep });
    o.line(add(shF, perp, -1.8), add(shF, perp, 1.8), K.trim);
    o.ell(handF, 1.3, 1.3, 0, K.leather, top);

    if (p.spark) {
        const s = add(handF, bd, 9);
        o.line(add(s, [-3, -3]), add(s, [3, 3]), K.sparkA);
        o.line(add(s, [-3, 3]), add(s, [3, -3]), K.sparkB);
    }

    const { ox, oy } = renderOps(px, o, { spin: p.spin, plant: p.plant, hx: PLAYER_FRAME.ax + p.x, hy: p.hy, floorY: PLAYER_FRAME.ay + 0.5 });
    if (rec) {
        const rel = (q) => [Math.round(q[0] + ox - PLAYER_FRAME.ax), Math.round(q[1] + oy - PLAYER_FRAME.ay)];
        rec({ bladeTip: p.dropSword ? null : rel(add(handF, bd, SW)), handF: rel(handF), handB: rel(handB), hip: rel(hip), head: rel(head), ox, oy });
    }

    // Gold healing aura motes (added after the outline pass)
    if (p.glow > 0) {
        px.emit = () => {
            const n = Math.round(p.glow * 14);
            for (let i = 0; i < n; i++) {
                const gx = Math.round(ox - 7 + hash2(i, 3) * 14), gy = Math.round(oy - 16 + hash2(i, 9) * 22 - p.glow * 3);
                if (!px.get(gx, gy)) px.set(gx, gy, i % 3 ? K.moteA : K.moteB);
            }
        };
    }
}

function drawKnight(px, pose) {
    drawKnightWith(px, pose, KNIGHT_PALETTE);
}

const lp = lerpPose;

export function knightSpecs() {
    const idle = [0, 1, 2, 1].map((b, i) => ({ kneeF: -6 - b * 3, kneeB: -6 - b * 3, hipF: 10 + b, hipB: -9 - b, cape: 0.15 + i * 0.03, sword: 65 - b * 2, elF: 35 + b * 2 }));

    const run = [];
    for (let i = 0; i < 8; i++) {
        const f = (i / 8) * Math.PI * 2;
        run.push({
            lean: 14, hipF: 34 * Math.sin(f), kneeF: -(12 + 60 * Math.max(0, Math.cos(f))),
            hipB: 34 * Math.sin(f + Math.PI), kneeB: -(12 + 60 * Math.max(0, Math.cos(f + Math.PI))),
            shF: 15 - 20 * Math.sin(f), elF: 45, shB: 35 * Math.sin(f), elB: 40,
            sword: -55 + 6 * Math.sin(f), cape: 0.7 + 0.12 * Math.sin(2 * f), capeLift: 0.15,
        });
    }

    const air = {};
    const jump = [
        { ...air, hipF: 45, kneeF: -70, hipB: -5, kneeB: -45, shF: -25, elF: 60, shB: 50, elB: 30, lean: 10, cape: 0.3, capeLift: 0.6, sword: -40 },
        { ...air, hipF: 35, kneeF: -85, hipB: 15, kneeB: -95, shF: 10, elF: 50, shB: 70, elB: 20, lean: 6, cape: 0.2, capeLift: 0.9, sword: -20 },
    ];
    const fall = [
        { ...air, hipF: 18, kneeF: -25, hipB: -15, kneeB: -40, shF: 110, elF: -10, shB: 140, elB: 15, lean: 0, cape: 0.15, capeLift: 1, sword: 120 },
        { ...air, hipF: 15, kneeF: -30, hipB: -18, kneeB: -35, shF: 115, elF: -15, shB: 145, elB: 10, lean: 0, cape: 0.25, capeLift: 1.15, sword: 125 },
    ];

    const roll = [
        { hipF: 60, kneeF: -110, hipB: 10, kneeB: -80, lean: 40, head: 20, shF: 70, elF: 60, shB: 40, elB: 60, sword: -80, dropSword: 1, cape: 0.5, capeLift: 0.3 },
        { ball: 1, spin: 40 },
        { ball: 1, spin: 130 },
        { ball: 1, spin: 220 },
        { ball: 1, spin: 310 },
        { hipF: 50, kneeF: -95, hipB: -10, kneeB: -70, lean: 25, head: 10, shF: 40, elF: 50, shB: 20, elB: 50, sword: -40, cape: 0.45, capeLift: 0.2 },
    ];

    const ready = { shF: 30, elF: 30, sword: 70, lean: 6 };
    const light1 = [
        { shF: -90, elF: -95, sword: 250, lean: -4, hipF: 6, hipB: -14 },
        { shF: -100, elF: -85, sword: 240, lean: -7, hipF: 4, hipB: -16, kneeF: -12, kneeB: -12 },
        { shF: 75, elF: 8, sword: 96, lean: 12, hipF: 28, kneeF: -22, hipB: -22, x: 2 },
        { shF: 45, elF: 10, sword: 45, lean: 14, hipF: 30, kneeF: -24, hipB: -24, x: 3 },
        { shF: 35, elF: 25, sword: 52, lean: 10, hipF: 22, hipB: -18, x: 2 },
        { ...ready, x: 1 },
    ];
    const light2 = [
        { shF: -25, elF: 35, sword: -45, lean: 8, kneeF: -22, kneeB: -22 },
        { shF: -35, elF: 30, sword: -55, lean: 10, kneeF: -26, kneeB: -26 },
        { shF: 120, elF: 12, sword: 150, lean: 2, hipF: 24, kneeF: -16, hipB: -20, x: 2 },
        { shF: 160, elF: 10, sword: 178, lean: -4, hipF: 26, kneeF: -14, hipB: -22, x: 2 },
        { shF: 130, elF: 30, sword: 150, lean: 0, hipF: 18, hipB: -16, x: 1 },
        { ...ready },
    ];
    const light3 = [
        { shF: -40, elF: 115, sword: 92, lean: -4, hipF: 20, kneeF: -30, hipB: -25 },
        { shF: -55, elF: 125, sword: 91, lean: -7, hipF: 22, kneeF: -34, hipB: -28 },
        { shF: 88, elF: 2, sword: 90, lean: 18, hipF: 42, kneeF: -30, hipB: -38, x: 4 },
        { shF: 92, elF: 0, sword: 90, lean: 20, hipF: 44, kneeF: -32, hipB: -40, x: 5 },
        { shF: 70, elF: 20, sword: 80, lean: 14, hipF: 34, kneeF: -26, hipB: -30, x: 4 },
        { shF: 45, elF: 30, sword: 72, lean: 9, hipF: 22, hipB: -18, x: 2 },
        { ...ready, x: 1 },
    ];
    const heavy = [
        { shF: 145, elF: 20, sword: 190, twoHand: 1, lean: -2 },
        { shF: 165, elF: 30, sword: 212, twoHand: 1, lean: -7, kneeF: -10, kneeB: -10 },
        { shF: 178, elF: 35, sword: 228, twoHand: 1, lean: -11, kneeF: -16, kneeB: -16, hipB: -16 },
        { shF: 100, elF: 6, sword: 112, twoHand: 1, lean: 16, hipF: 36, kneeF: -36, hipB: -32, x: 3 },
        { shF: 62, elF: 6, sword: 72, twoHand: 1, lean: 24, hipF: 40, kneeF: -48, hipB: -36, kneeB: -16, x: 5 },
        { shF: 55, elF: 8, sword: 66, twoHand: 1, lean: 22, hipF: 38, kneeF: -46, hipB: -34, kneeB: -16, x: 5 },
        { shF: 45, elF: 18, sword: 66, lean: 14, hipF: 26, kneeF: -24, hipB: -24, x: 3 },
        { ...ready, x: 1 },
    ];
    const parry = [
        { shF: 65, elF: 75, sword: 168, lean: -2, hipB: -16 },
        { shF: 80, elF: 60, sword: 142, lean: -8, hipF: 16, hipB: -26, kneeB: -14, spark: 0 },
        { shF: 82, elF: 58, sword: 150, lean: -9, hipF: 16, hipB: -26, kneeB: -14, spark: 1 },
        { shF: 55, elF: 55, sword: 120, lean: -3, hipB: -18 },
        { ...ready },
    ];
    const healBase = { sword: 15, shF: 8, elF: 12, kneeF: -10, kneeB: -10, vial: 1 };
    const heal = [
        { ...healBase, shB: 15, elB: 70, glow: 0.1 },
        { ...healBase, shB: 70, elB: 90, glow: 0.25 },
        { ...healBase, shB: 105, elB: 110, head: -10, glow: 0.4 },
        { ...healBase, shB: 112, elB: 115, head: -18, glow: 0.6 },
        { ...healBase, shB: 112, elB: 118, head: -20, glow: 0.8 },
        { ...healBase, shB: 110, elB: 115, head: -16, glow: 1 },
        { ...healBase, shB: 60, elB: 80, head: -4, glow: 0.7, vial: 0 },
        { ...healBase, shB: 10, elB: 40, glow: 0.35, vial: 0 },
    ];
    const hurt = [
        { lean: -18, head: -15, shF: -25, elF: 45, shB: -60, elB: 30, sword: 200, hipF: 22, kneeF: -10, cape: 0.5 },
        { lean: -12, head: -8, shF: -5, elF: 40, shB: -40, elB: 30, sword: 140, hipF: 18, kneeF: -10, cape: 0.4 },
    ];
    const kneel = { hipF: 80, kneeF: -95, hipB: 0, kneeB: -92, lean: 10, head: 25, shF: 20, elF: 10, shB: 10, elB: 20, sword: 20, dropSword: 1, cape: 0.1 };
    const death = [
        { ...hurt[0] },
        { lean: -10, head: -5, shF: 10, elF: 30, shB: -20, elB: 30, sword: 40, hipF: 20, kneeF: -40, hipB: -10, kneeB: -40, dropSword: 1 },
        { ...lp(hurt[1], kneel, 0.6), dropSword: 1 },
        { ...kneel },
        { ...kneel, lean: 35, head: 35, shF: 0, shB: -10 },
        { ...kneel, lean: 30, head: 30, spin: 40 },
        { ...kneel, lean: 15, head: 20, hipF: 40, kneeF: -40, hipB: 20, kneeB: -30, spin: 75 },
        { lean: 0, head: 10, hipF: 10, kneeF: -10, hipB: -5, kneeB: -10, shF: 120, elF: 10, shB: 140, elB: 10, dropSword: 1, spin: 90, cape: 0.05 },
    ];
    const restBase = { hipF: 78, kneeF: -78, hipB: -4, kneeB: -96, lean: 8, head: 24, shF: 55, elF: 25, sword: 2, twoHand: 1, cape: 0.08 };
    const rest = [0, 1, 2, 1].map((b) => ({ ...restBase, lean: 8 + b * 0.8, head: 24 + b, cape: 0.08 + b * 0.03 }));
    const grabbed = [0, 1, 2, 3].map((i) => {
        const f = (i / 4) * Math.PI * 2;
        return {
            lean: -12, head: -18,
            hipF: 12 + 18 * Math.sin(f), kneeF: -25 - 15 * Math.max(0, Math.sin(f)),
            hipB: -8 - 18 * Math.sin(f), kneeB: -30 - 15 * Math.max(0, -Math.sin(f)),
            shF: 125 + 6 * Math.sin(f), elF: 20, shB: 110 - 6 * Math.sin(f), elB: 30, sword: -5, cape: 0.1, capeLift: 0.2,
        };
    });

    // Cutscene: kneel to pick something up from the road, then rise (the shard appears in hand at the end).
    const pick = { ...kneel, lean: 24, head: 30, shB: 40, elB: 30, shF: 40, elF: 30, sword: 78, dropSword: 0, cape: 0.12 };
    const kneelPick = [
        { ...idle[0] },
        { ...lp(idle[0], kneel, 0.5), sword: 72, dropSword: 0 },
        { ...pick },
        { ...pick, shB: 20, elB: 20, lean: 30, head: 34 },
        { ...lp(pick, idle[0], 0.5), shard: 1, shB: 70, elB: 70 },
        { ...idle[0], shard: 1, shB: 90, elB: 80 },
    ];
    // Cutscene: standing, holding the shard up to the helm.
    const holdShard = [0, 1, 2, 1].map((b) => ({ ...idle[b], shard: 1, shB: 118 + b, elB: 100 - b, head: -6 - b, cape: 0.12 + b * 0.02 }));

    return {
        idle: { poses: idle, fps: 5, loop: true },
        run: { poses: run, fps: 14, loop: true },
        jump: { poses: jump, fps: 10 },
        fall: { poses: fall, fps: 8, loop: true },
        roll: { poses: roll, fps: 16 },
        light1: { poses: light1, fps: 14, phases: { windup: 2, active: 2, recovery: 2 } },
        light2: { poses: light2, fps: 14, phases: { windup: 2, active: 2, recovery: 2 } },
        light3: { poses: light3, fps: 14, phases: { windup: 2, active: 2, recovery: 3 } },
        heavy: { poses: heavy, fps: 12, phases: { windup: 3, active: 2, recovery: 3 } },
        parry: { poses: parry, fps: 14, phases: { windup: 1, active: 2, recovery: 2 } },
        heal: { poses: heal, fps: 8 },
        hurt: { poses: hurt, fps: 10 },
        death: { poses: death, fps: 8 },
        rest: { poses: rest, fps: 3, loop: true },
        grabbed: { poses: grabbed, fps: 8, loop: true },
        // Appended last so the frames of every earlier anim keep their sheet positions.
        kneel: { poses: kneelPick, fps: 6 },
        holdShard: { poses: holdShard, fps: 3, loop: true },
    };
}

export function buildPlayerArt() {
    const { w, h, ax, ay } = PLAYER_FRAME;
    const { art } = buildCharacter({ fw: w, fh: h, ax, ay, specs: knightSpecs(), draw: drawKnight, outlineColor: C.outline });
    return art;
}

