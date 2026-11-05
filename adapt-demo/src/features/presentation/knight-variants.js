// Characters built on the knight's own rig, so their poses match the knight exactly:
//   the Reflection (final boss): the knight in dark silver with cold cyan eyes; phase 2 = magenta with cracks;
//   the Hollow Echo (mob): a lesser, greyish, translucent reflection of the knight.
import { ACCENT_TO_PHASE2, C, R } from "./palette.js";
import { Px, framesToSheet, hash2, lerpPose, ramp, rgba } from "./pixel.js";
import { buildCharacter } from "./rig.js";
import { PLAYER_FRAME, drawKnightWith, knightSpecs } from "./player-art.js";

const { w: FW, h: FH, ax: AX, ay: AY } = PLAYER_FRAME;
const lp = lerpPose;

export const REFLECTION_PALETTE = {
    steel: ramp("#b4bcd6", "#6e7694", "#3e445c"),
    steelDark: ramp("#7d86a4", "#4a516c", "#2a2f42"),
    cloth: ramp("#3c4560", "#272d42", "#171b2a"),
    clothDark: ramp("#2c3248", "#1c2030", "#10131c"),
    cape: ramp("#2e3550", "#1b2034", "#0f121e"),
    gold: ramp("#c8fbff", "#5ff0ff", "#2fb8cc"),
    crest: R.glass,
    blade: R.glass,
    leather: ramp("#4a4e62", "#33364a", "#1f2130"),
    trim: C.cyan1, belt: C.cyan1, beltDot: C.cyan3, vialDot: C.cyan3,
    visor: C.cyan2, visorDot: C.cyan3, pommel: C.cyan2, sparkA: C.white, sparkB: C.cyan3, moteA: C.cyan2, moteB: C.cyan3,
    swordLen: 18, // a slightly longer mirror blade than the knight's 15 px
};

export const ECHO_PALETTE = {
    steel: ramp("#dfe4ee", "#a9afc0", "#6e7486"),
    steelDark: ramp("#a9afc0", "#7c8296", "#505568"),
    cloth: ramp("#9096aa", "#6a7086", "#474c60"),
    clothDark: ramp("#6a7086", "#4f5468", "#34384a"),
    cape: ramp("#7c8296", "#5a6074", "#3a3f50"),
    gold: ramp("#eef2f8", "#bfc5d2", "#80869a"),
    crest: ramp("#eef2f8", "#bfc5d2", "#80869a"),
    blade: ramp("#ffffff", "#d6dce8", "#8c94a8"),
    leather: ramp("#6a7086", "#4f5468", "#343848"),
    trim: rgba("#c9cfdc"), belt: rgba("#c9cfdc"), beltDot: rgba("#eef2f8"), vialDot: rgba("#eef2f8"),
    visor: rgba("#1c1f2c"), visorDot: rgba("#e6f6ff"), pommel: rgba("#c9cfdc"),
    sparkA: C.white, sparkB: rgba("#e6f6ff"), moteA: rgba("#e6f6ff"), moteB: C.white,
    swordLen: 17,
};

// ---------------------------------------------------------------- per-frame effects (after the outline)

const isOutline = (c) => c === C.outline;

// Cyan cracks spreading over the armour from the chest (recoloured magenta on the phase-2 sheet).
function drawCracks(px, pts, amount, seed) {
    if (!amount || !pts) return;
    const cx = AX + Math.round((pts.hip[0] + pts.head[0]) / 2), cy = AY + Math.round(pts.hip[1] * 0.45 + pts.head[1] * 0.55);
    for (let i = 0; i < 4; i++) {
        let x = cx + (hash2(i, seed, 6) - 0.5) * 3, y = cy + (hash2(i, seed, 7) - 0.5) * 4;
        const a0 = (i / 4) * Math.PI * 2 + 0.4 + hash2(i, seed, 3) * 0.9;
        const steps = Math.max(1, Math.round(amount * 3));
        for (let s = 0; s < steps; s++) {
            const a = a0 + (hash2(i, s, 4) - 0.5) * 1.8, len = 1.2 + hash2(i, s, 5) * 1.8;
            const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
            const n = Math.ceil(len * 2);
            for (let k = 0; k <= n; k++) {
                const qx = Math.round(x + (nx - x) * (k / n)), qy = Math.round(y + (ny - y) * (k / n));
                const c = px.get(qx, qy);
                if (c && !isOutline(c)) px.set(qx, qy, s === 0 ? C.cyan2 : C.cyan1);
            }
            x = nx; y = ny;
        }
    }
    const c = px.get(cx, cy);
    if (c && !isOutline(c)) px.set(cx, cy, C.cyan3);
}

// A bright star glint and a cyan edge along the blade: the unmistakable parry guard.
function drawGlint(px, pts, size) {
    if (!pts?.bladeTip) return;
    const hx = pts.handF[0] + AX, hy = pts.handF[1] + AY, tx = pts.bladeTip[0] + AX, ty = pts.bladeTip[1] + AY;
    const n = Math.ceil(Math.hypot(tx - hx, ty - hy));
    for (let k = 3; k <= n; k++) {
        const x = Math.round(hx + (tx - hx) * (k / n)), y = Math.round(hy + (ty - hy) * (k / n));
        for (const [dx, dy] of [[1, 0], [-1, 0]]) if (!px.get(x + dx, y + dy)) px.set(x + dx, y + dy, C.cyan2);
    }
    const gx = Math.round(hx + (tx - hx) * 0.62), gy = Math.round(hy + (ty - hy) * 0.62);
    for (let k = -size; k <= size; k++) {
        px.set(gx + k, gy, Math.abs(k) < 2 ? C.white : C.cyan3);
        px.set(gx, gy + k, Math.abs(k) < 2 ? C.white : C.cyan3);
    }
    if (size > 3) for (const d of [-2, 2]) { px.set(gx + d, gy + d, C.cyan3); px.set(gx - d, gy + d, C.cyan3); }
}

// Three glass shards held up in the back hand.
function drawHeldShards(px, pts) {
    if (!pts) return;
    const hx = pts.handB[0] + AX, hy = pts.handB[1] + AY;
    [[-3, -1], [0, -3], [3, -1]].forEach(([dx, dy], i) => {
        const x = hx + dx, y = hy + dy - 2;
        for (let k = 0; k < 4; k++) px.set(x, y - k, k === 3 ? C.cyan3 : rgba("#9fdcef"));
        px.set(x - 1, y - 1, rgba("#4f88a8")); px.set(x + 1, y - 2, C.white);
        if (i === 1) px.set(x, y - 4, C.white);
    });
}

// Shatter into glass: pixels vanish and fly off as shards. keep (0..1) fades what remains.
function shatter(px, amount, seed, { fall = true, fade = 0 } = {}) {
    if (!amount && !fade) return;
    const src = px.data.slice();
    px.clear();
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
        const c = src[y * px.w + x];
        if (!c) continue;
        const h = hash2(x >> 1, y >> 1, seed);
        if (h > amount * 1.1) {
            const a = Math.round(((c >>> 24) & 0xff) * (1 - fade));
            if (a > 8) px.set(x, y, ((c & 0x00ffffff) | (a << 24)) >>> 0);
        } else if (hash2(x, y, seed + 1) < 0.16) {
            const r = amount * (fall ? 14 : 18) * hash2(x, y, seed + 2), ang = hash2(x, y, seed + 3) * Math.PI * 2;
            const nx = Math.round(x + Math.cos(ang) * r), ny = Math.round(y + Math.sin(ang) * r * (fall ? 0.5 : 1) + (fall ? amount * 6 : 0));
            px.set(nx, Math.min(AY, ny), hash2(x, y, seed + 4) < 0.5 ? C.cyan2 : C.cyan3);
        }
    }
}

// Emerging from a glassy surface: everything behind the plane is drawn as pale glass; the plane shimmers.
function mirrorPlane(px, planeX, strength) {
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
        const c = px.get(x, y);
        if (!c || x >= planeX) continue;
        px.set(x, y, (y + x) % 3 === 0 ? 0 : rgba("#9fdcef", 120));
    }
    if (strength <= 0) return;
    for (let y = AY - 34; y <= AY; y++) {
        const wob = Math.round(Math.sin(y * 0.7) * 0.8);
        px.set(planeX + wob, y, y % 4 === 0 ? C.white : C.cyan2);
        if (strength > 0.5 && y % 3 === 0) px.set(planeX + wob - 1, y, rgba("#9fdcef", 180));
    }
}

// ---------------------------------------------------------------- the Reflection

function reflectionSpecs() {
    const K = knightSpecs();
    const P = (n) => K[n].poses;
    const idle = P("idle");
    const walk = Array.from({ length: 8 }, (_, i) => {
        const f = (i / 8) * Math.PI * 2;
        return {
            lean: 7, hipF: 22 * Math.sin(f), kneeF: -(8 + 34 * Math.max(0, Math.cos(f))),
            hipB: 22 * Math.sin(f + Math.PI), kneeB: -(8 + 34 * Math.max(0, Math.cos(f + Math.PI))),
            shF: 30 - 8 * Math.sin(f), elF: 35, shB: -15 + 16 * Math.sin(f), elB: 30, sword: 68, cape: 0.35 + 0.08 * Math.sin(2 * f),
        };
    });
    const retreat = Array.from({ length: 6 }, (_, i) => {
        const f = (i / 6) * Math.PI * 2;
        return {
            lean: -3, hipF: 16 * Math.sin(-f), kneeF: -(10 + 26 * Math.max(0, -Math.cos(f))),
            hipB: 16 * Math.sin(-f + Math.PI), kneeB: -(10 + 26 * Math.max(0, -Math.cos(f + Math.PI))),
            shF: 50, elF: 45, sword: 110, cape: 0.15,
        };
    });
    const hold = [0, 1, 2, 1].map((b) => ({ lean: 2, hipF: 20, kneeF: -22 - b, hipB: -20, kneeB: -16 - b, shF: 55, elF: 55, sword: 128 + b, twoHand: 1, cape: 0.18 + b * 0.02 }));
    const parryGuard = { shF: 82, elF: 58, sword: 170, lean: -6, hipF: 18, kneeF: -16, hipB: -24, kneeB: -16, cape: 0.2 };
    const parryStance = [0, 1, 2, 1].map((b) => ({ ...parryGuard, kneeF: -16 - b, kneeB: -16 - b, glint: [5, 3, 4, 3][b] }));
    const restBase = { hipF: 78, kneeF: -78, hipB: -4, kneeB: -96, lean: 14, head: 30, shF: 55, elF: 25, sword: 40, twoHand: 1, cape: 0.06 };
    const staggered = [0, 1, 2, 1].map((b) => ({ ...restBase, lean: 14 + b, head: 30 + b * 2 }));
    const kneelPose = { hipF: 80, kneeF: -95, hipB: 0, kneeB: -92, lean: 12, head: 28, shF: 58, elF: 28, shB: 10, elB: 20, sword: 64, cape: 0.08 };
    const kneel = [0, 1, 2, 1].map((b) => ({ ...kneelPose, head: 28 + b, lean: 12 + b * 0.5 }));
    const dormant = [idle[0], idle[0]];
    const rise = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t, i) => ({ ...lp(walk[i % 8], idle[0], t), x: -12 + 12 * t, plane: 1 - t }));
    const roll = P("roll");
    const hurt = P("hurt");
    const recoil = [
        { ...hurt[0], sword: 215, shF: 160, elF: 30 },
        { ...hurt[1], sword: 175, shF: 120, elF: 30 },
        { ...lp(hurt[1], idle[0], 0.6) },
    ];
    const transition = [
        { ...kneelPose, crack: 0.1 },
        { ...kneelPose, crack: 0.3, glow: 0.2 },
        { ...lp(kneelPose, idle[0], 0.4), crack: 0.5, glow: 0.4 },
        { ...lp(kneelPose, idle[0], 0.8), crack: 0.7, glow: 0.6 },
        { lean: -10, head: -20, shF: 110, elF: 20, shB: 140, elB: 20, sword: 140, crack: 0.9, glow: 0.9, cape: 0.6, capeLift: 0.5 },
        { lean: -12, head: -24, shF: 115, elF: 15, shB: 150, elB: 15, sword: 145, crack: 1, glow: 1, cape: 0.7, capeLift: 0.7 },
        { lean: -6, head: -10, shF: 70, elF: 30, shB: 60, elB: 30, sword: 100, crack: 1, glow: 0.6, cape: 0.4 },
        { ...idle[0], crack: 1, glow: 0.3 },
    ];
    const drink = P("heal").map((pose) => ({ ...pose, sword: 40 }));
    const vanish = [0.25, 0.5, 0.75, 1].map((v) => ({ ...idle[0], vanish: v }));
    const death = [
        { ...hurt[0] },
        { ...lp(hurt[1], kneelPose, 0.5), dropSword: 1 },
        { ...kneelPose, dropSword: 1 },
        { ...kneelPose, dropSword: 1, head: 34, shatter: 0.15 },
        { ...kneelPose, dropSword: 1, head: 36, shatter: 0.35 },
        { ...kneelPose, dropSword: 1, head: 36, shatter: 0.55 },
        { ...kneelPose, dropSword: 1, head: 36, shatter: 0.8 },
        { ...kneelPose, dropSword: 1, head: 36, shatter: 1.2 },
    ];
    const ready = { shF: 30, elF: 30, sword: 70, lean: 6 };
    const leapSlash = [
        { lean: 16, hipF: 60, kneeF: -100, hipB: -12, kneeB: -84, shF: 150, elF: 30, sword: 205, twoHand: 1, cape: 0.3 },
        { lean: 20, hipF: 66, kneeF: -110, hipB: -16, kneeB: -92, shF: 160, elF: 28, sword: 215, twoHand: 1, cape: 0.25 },
        { lean: 10, hipF: 45, kneeF: -80, hipB: 20, kneeB: -95, shF: 125, elF: 12, sword: 135, twoHand: 1, cape: 0.2, capeLift: 0.9 },
        { lean: 22, hipF: 50, kneeF: -70, hipB: 10, kneeB: -80, shF: 80, elF: 6, sword: 98, twoHand: 1, cape: 0.3, capeLift: 1 },
        { lean: 24, hipF: 44, kneeF: -56, hipB: -30, kneeB: -30, shF: 58, elF: 8, sword: 64, twoHand: 1, x: 2, cape: 0.5 },
        { ...ready, x: 1 },
    ];
    const riposte = [
        { ...parryGuard, sword: 160, glint: 3 },
        { shF: 88, elF: 2, sword: 90, lean: 18, hipF: 42, kneeF: -30, hipB: -38, x: 4, cape: 0.6 },
        { shF: 92, elF: 0, sword: 90, lean: 20, hipF: 44, kneeF: -32, hipB: -40, x: 5, cape: 0.7 },
        { shF: 60, elF: 20, sword: 76, lean: 12, hipF: 30, kneeF: -24, hipB: -26, x: 3 },
        { ...ready, x: 1 },
    ];
    const l1 = P("light1");
    const appearSlash = [
        { ...l1[0], appear: 0.75 },
        { ...l1[1], appear: 0.25 },
        { ...l1[2] }, { ...l1[3] }, { ...l1[4] }, { ...l1[5] },
    ];
    const volleyUp = { shB: 155, elB: 50, shF: 35, elF: 30, sword: 55, lean: -4, hipB: -16, kneeF: -10 };
    const volley = [
        { ...volleyUp, shards: 1 },
        { ...volleyUp, shB: 165, elB: 45, lean: -7, kneeF: -14, kneeB: -12, shards: 1 },
        { shB: 70, elB: 0, shF: 35, elF: 30, sword: 55, lean: 14, hipF: 24, kneeF: -20, hipB: -22, x: 2, streak: 1 },
        { shB: 55, elB: 5, shF: 35, elF: 30, sword: 55, lean: 14, hipF: 24, kneeF: -20, hipB: -22, x: 2 },
        { shB: 30, elB: 25, ...ready, x: 1 },
        { ...ready },
    ];
    return {
        idle: { poses: idle, fps: 5, loop: true },
        walk: { poses: walk, fps: 10, loop: true },
        retreat: { poses: retreat, fps: 8, loop: true },
        hold: { poses: hold, fps: 4, loop: true },
        staggered: { poses: staggered, fps: 4, loop: true },
        parryStance: { poses: parryStance, fps: 8, loop: true },
        kneel: { poses: kneel, fps: 3, loop: true },
        dormant: { poses: dormant, fps: 2 },
        rise: { poses: rise, fps: 6 },
        roll: { poses: roll, fps: 16 },
        recoil: { poses: recoil, fps: 10 },
        transition: { poses: transition, fps: 8 / 1.5 },
        drink: { poses: drink, fps: 8 / 1.1 },
        vanish: { poses: vanish, fps: 4 / 0.35 },
        death: { poses: death, fps: 8 },
        chain1: { poses: P("light1"), fps: 14, phases: { windup: 2, active: 2, recovery: 2 } },
        chain2: { poses: P("light2"), fps: 14, phases: { windup: 2, active: 2, recovery: 2 } },
        chain3: { poses: P("light3"), fps: 14, phases: { windup: 2, active: 2, recovery: 3 } },
        heavy: { poses: P("heavy"), fps: 12, phases: { windup: 3, active: 2, recovery: 3 } },
        leapSlash: { poses: leapSlash, fps: 10, phases: { windup: 2, active: 2, recovery: 2 } },
        riposte: { poses: riposte, fps: 14, phases: { windup: 1, active: 2, recovery: 2 } },
        appearSlash: { poses: appearSlash, fps: 12, phases: { windup: 2, active: 2, recovery: 2 } },
        volley: { poses: volley, fps: 10, phases: { windup: 2, active: 2, recovery: 2 } },
    };
}

function makeVariant(palette, specs, { phase2 = false, translucent = 0 } = {}) {
    const points = {};
    const cracks = [];
    const draw = (px, pose, i, name) => {
        drawKnightWith(px, pose, palette, (pt) => {
            (points[name] ??= [])[i] = { bladeTip: pt.bladeTip, handF: pt.handF, handB: pt.handB };
            px.__pts = pt;
        });
    };
    const post = (px, pose, i, name) => {
        const pts = px.__pts;
        if (pose.crack) drawCracks(px, pts, pose.crack, 7);
        if (phase2) cracks.push({ pts, pose });
        if (pose.glint) drawGlint(px, pts, pose.glint);
        if (pose.shards) drawHeldShards(px, pts);
        if (pose.streak && pts) {
            const hx = pts.handB[0] + AX, hy = pts.handB[1] + AY;
            for (let k = 2; k < 14; k++) if (!px.get(hx + k, hy)) px.set(hx + k, hy + (k % 3 === 0 ? -1 : 0), k < 6 ? C.white : C.cyan2);
        }
        if (pose.plane !== undefined) mirrorPlane(px, AX - 6, pose.plane);
        if (pose.vanish) shatter(px, pose.vanish * 0.9, 13, { fall: false, fade: pose.vanish * 0.6 });
        if (pose.appear) shatter(px, pose.appear, 17, { fall: false, fade: pose.appear * 0.4 });
        if (pose.shatter) shatter(px, pose.shatter, 19, { fall: true });
        delete px.__pts;
    };
    const { frames, art } = buildCharacter({ fw: FW, fh: FH, ax: AX, ay: AY, specs, draw, outlineColor: C.outline, cols: 16, post });
    art.points = points;
    if (phase2) {
        // Phase 2: the same frames with cracks over the armour, then every accent recoloured to magenta.
        const p2 = frames.map((f, n) => {
            const copy = new Px(f.w, f.h);
            copy.data.set(f.data);
            const info = cracks[n];
            if (info && !info.pose.vanish && !info.pose.appear && !info.pose.shatter && info.pts) drawCracks(copy, info.pts, 1, 7);
            return copy;
        });
        art.sheetPhase2 = framesToSheet(p2, FW, FH, 16, (c) => ACCENT_TO_PHASE2.get(c) ?? c);
    }
    if (translucent) {
        const a = translucent;
        art.sheet = framesToSheet(frames, FW, FH, 16, (c) => ((c & 0x00ffffff) | (Math.min((c >>> 24) & 0xff, a) << 24)) >>> 0);
    }
    return { frames, art };
}

export function buildReflectionArt() {
    return makeVariant(REFLECTION_PALETTE, reflectionSpecs(), { phase2: true }).art;
}

// ---------------------------------------------------------------- the Hollow Echo

function echoSpecs() {
    const K = knightSpecs();
    const P = (n) => K[n].poses;
    const walk = Array.from({ length: 8 }, (_, i) => {
        const f = (i / 8) * Math.PI * 2;
        return {
            lean: 8, hipF: 22 * Math.sin(f), kneeF: -(8 + 34 * Math.max(0, Math.cos(f))),
            hipB: 22 * Math.sin(f + Math.PI), kneeB: -(8 + 34 * Math.max(0, Math.cos(f + Math.PI))),
            shF: 25 - 10 * Math.sin(f), elF: 40, shB: -10 + 16 * Math.sin(f), elB: 30, sword: 60, cape: 0.4,
        };
    });
    const hurt = P("hurt");
    const kneelPose = { hipF: 80, kneeF: -95, hipB: 0, kneeB: -92, lean: 12, head: 28, shF: 30, elF: 15, shB: 10, elB: 20, sword: 4, dropSword: 1, cape: 0.08 };
    const death = [
        { ...hurt[0] },
        { ...lp(hurt[1], kneelPose, 0.5) },
        { ...kneelPose, shatter: 0.25 },
        { ...kneelPose, shatter: 0.5 },
        { ...kneelPose, shatter: 0.8 },
        { ...kneelPose, shatter: 1.2 },
    ];
    return {
        idle: { poses: P("idle"), fps: 5, loop: true },
        walk: { poses: walk, fps: 10, loop: true },
        roll: { poses: P("roll"), fps: 16 },
        slash: { poses: P("light1"), fps: 14, phases: { windup: 2, active: 2, recovery: 2 } },
        flinch: { poses: hurt, fps: 10 },
        death: { poses: death, fps: 10 },
    };
}

export function buildEchoArt() {
    return makeVariant(ECHO_PALETTE, echoSpecs(), { translucent: 0xc4 }).art;
}

