import { raycast } from "../level/field.js";
import { glowSprite } from "../../core/paint.js";
import { TAU } from "../../core/math.js";
import { inBounds } from "../../core/view.js";

export const WAVE_SPEED = 1100;
const RESIDUE = 0.13; // what the dark keeps of an echo once it has faded
const FADE = 1.9;
const BINS = 12;
const QUANT = 5;

// Reach and loudness of a song: loudness grows faster than reach, so soft songs are "cheaper"
export const songReach = (strength) => 260 + 740 * strength;
export const songNoise = (strength) => 160 + 1100 * strength * strength;

const PALETTES = [
    { dot: [127, 246, 255], spark: "rgba(200, 255, 255, 1)" },
    { dot: [255, 205, 120], spark: "rgba(255, 235, 190, 1)" }
];
const fills = PALETTES.map(({ dot }) => Array.from({ length: BINS }, (_, b) => `rgba(${dot[0]}, ${dot[1]}, ${dot[2]}, ${((b + 0.5) / BINS).toFixed(3)})`));

// Echolocation: rays from the singer reveal wall surfaces as the wavefront reaches them,
// and the dark remembers every point it was shown (one point per spot, re-lit on repeat).
export function createSonar(world) {
    let cap = 4096;
    let n = 0;
    let xs = new Float32Array(cap);
    let ys = new Float32Array(cap);
    let ts = new Float32Array(cap);
    let kinds = new Uint8Array(cap);
    let order = new Int32Array(cap);
    let bins = new Int16Array(cap);
    const index = new Map();
    const waves = [];
    const targets = new Set();
    const sparks = [];

    function grow() {
        cap *= 2;
        const resize = (a, T) => {
            const b = new T(cap);
            b.set(a);
            return b;
        };
        xs = resize(xs, Float32Array);
        ys = resize(ys, Float32Array);
        ts = resize(ts, Float32Array);
        kinds = resize(kinds, Uint8Array);
        order = new Int32Array(cap);
        bins = new Int16Array(cap);
    }

    function addEcho(x, y, t, kind) {
        const key = Math.floor(x / QUANT) * 65536 + Math.floor(y / QUANT);
        const i = index.get(key);
        if (i !== undefined) {
            // Already shown: flash again when this wave arrives; still pending: keep the earliest
            ts[i] = ts[i] <= world.time ? t : Math.min(ts[i], t);
            kinds[i] = kind;
            return;
        }
        if (n >= cap) grow();
        xs[n] = x;
        ys[n] = y;
        ts[n] = t;
        kinds[n] = kind;
        index.set(key, n++);
    }

    // Things the wave can bounce off: { x, y, radius, onEcho(delay, strength, source) }
    const track = (target) => targets.add(target);
    const untrack = (target) => targets.delete(target);

    function cast(x, y, strength, { source = "player", kind = 0, reach = songReach(strength) } = {}) {
        const level = world.level;
        const rays = Math.round(360 + 360 * Math.min(1, strength));
        const dists = new Float32Array(rays);
        const dirs = new Float32Array(rays * 2);
        const near = [...targets].filter((t) => (t.x - x) ** 2 + (t.y - y) ** 2 < (reach + t.radius) ** 2);
        const first = new Map();
        const offset = Math.random() * (TAU / rays);

        for (let i = 0; i < rays; i++) {
            const a = offset + (i / rays) * TAU;
            const dx = Math.cos(a);
            const dy = Math.sin(a);
            const hit = raycast(level, x, y, dx, dy, reach, 6);
            const wall = hit < 0 ? reach : hit;
            dirs[i * 2] = dx;
            dirs[i * 2 + 1] = dy;
            dists[i] = wall;
            if (hit >= 0) addEcho(x + dx * hit, y + dy * hit, world.time + hit / WAVE_SPEED, kind);

            for (const t of near) {
                const fx = t.x - x;
                const fy = t.y - y;
                const along = fx * dx + fy * dy;
                if (along <= 0) continue;
                const off2 = fx * fx + fy * fy - along * along;
                if (off2 > t.radius * t.radius) continue;
                const d = Math.max(0, along - Math.sqrt(t.radius * t.radius - off2));
                if (d < wall && d < (first.get(t) ?? Infinity)) first.set(t, d);
            }
        }

        for (const [t, d] of first) t.onEcho(d / WAVE_SPEED, strength, source);
        waves.push({ x, y, t0: world.time, reach, rays, dirs, dists, kind });
        world.events.emit("song", { x, y, strength, reach, source });
    }

    // Ending: every wall surface in the depth answers, spreading outward from one point
    function revealAll(points, fromX, fromY, speed, kind) {
        for (let i = 0; i < points.length; i += 2) {
            const d = Math.hypot(points[i] - fromX, points[i + 1] - fromY);
            addEcho(points[i], points[i + 1], world.time + d / speed, kind);
        }
    }

    function update() {
        for (let i = waves.length - 1; i >= 0; i--) {
            if ((world.time - waves[i].t0) * WAVE_SPEED > waves[i].reach) waves.splice(i, 1);
        }
    }

    function renderOver(ctx, view, { boost = 0, zoom = 1 } = {}) {
        const now = world.time;
        const size = Math.max(2.4, 1.8 / zoom);
        const half = size / 2;
        const counts = new Int32Array(BINS * 2);
        sparks.length = 0;

        for (let i = 0; i < n; i++) {
            bins[i] = -1;
            const t = ts[i];
            if (t > now || !inBounds(view, xs[i], ys[i])) continue;
            const age = now - t;
            let a = RESIDUE + (1 - RESIDUE) * Math.exp(-age / FADE);
            if (boost > a) a = boost;
            const b = kinds[i] * BINS + Math.min(BINS - 1, Math.floor(a * BINS));
            bins[i] = b;
            counts[b]++;
            if (age < 0.3) sparks.push(i);
        }

        // Counting sort by bin so each fill color is set once
        const starts = new Int32Array(BINS * 2);
        for (let b = 1; b < BINS * 2; b++) starts[b] = starts[b - 1] + counts[b - 1];
        const cursor = starts.slice();
        for (let i = 0; i < n; i++) if (bins[i] >= 0) order[cursor[bins[i]]++] = i;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let b = 0; b < BINS * 2; b++) {
            if (!counts[b]) continue;
            ctx.fillStyle = fills[Math.floor(b / BINS)][b % BINS];
            for (let k = starts[b]; k < starts[b] + counts[b]; k++) {
                const i = order[k];
                ctx.fillRect(xs[i] - half, ys[i] - half, size, size);
            }
        }

        // Fresh hits sparkle
        for (const i of sparks) {
            const age = now - ts[i];
            const s = 9 * (1 - age / 0.3) + 2;
            ctx.globalAlpha = 1 - age / 0.3;
            ctx.drawImage(glowSprite(PALETTES[kinds[i]].spark), xs[i] - s, ys[i] - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;

        // Wavefronts: dots on every ray that has not hit anything yet
        for (const w of waves) {
            const r = (now - w.t0) * WAVE_SPEED;
            const [cr, cg, cb] = PALETTES[w.kind].dot;
            ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(0.6 * (1 - r / w.reach)).toFixed(3)})`;
            for (let i = 0; i < w.rays; i++) {
                if (w.dists[i] <= r) continue;
                ctx.fillRect(w.x + w.dirs[i * 2] * r - 1.5, w.y + w.dirs[i * 2 + 1] * r - 1.5, 3, 3);
            }
        }
        ctx.restore();
    }

    return { cast, revealAll, track, untrack, update, renderOver, get count() { return n; } };
}
