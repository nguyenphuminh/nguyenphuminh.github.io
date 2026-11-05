// World-space particle effects with a fixed-size pool (no per-frame allocation).
import { HEX } from "./palette.js";

const MAX = 900;
const RNG = () => Math.random();

export function createFx() {
    const x = new Float32Array(MAX), y = new Float32Array(MAX), vx = new Float32Array(MAX), vy = new Float32Array(MAX);
    const life = new Float32Array(MAX), maxLife = new Float32Array(MAX), grav = new Float32Array(MAX), drag = new Float32Array(MAX);
    const size = new Uint8Array(MAX), streak = new Uint8Array(MAX), wobble = new Float32Array(MAX);
    const color = new Array(MAX).fill("#fff");
    let next = 0;
    const arcs = []; // slash crescents (few at a time)

    function emit(px, py, pvx, pvy, plife, c, { g = 0, d = 0, s = 1, st = 0, wb = 0 } = {}) {
        const i = next;
        next = (next + 1) % MAX;
        x[i] = px; y[i] = py; vx[i] = pvx; vy[i] = pvy;
        life[i] = plife; maxLife[i] = plife; color[i] = c; grav[i] = g; drag[i] = d; size[i] = s; streak[i] = st; wobble[i] = wb;
    }
    const pick = (arr) => arr[Math.floor(RNG() * arr.length)];

    const spawners = {
        sparks(px, py, o) {
            const dir = o.dir ?? 1;
            for (let k = 0; k < (o.count ?? 12); k++) {
                const a = (RNG() - 0.5) * 1.6 + (dir > 0 ? 0 : Math.PI) - 0.35 * dir;
                const sp = 90 + RNG() * 160;
                emit(px, py, Math.cos(a) * sp, Math.sin(a) * sp - 30, 0.2 + RNG() * 0.25, pick(["#ffffff", HEX.gold4, HEX.gold3, HEX.gold2]), { g: 380, d: 2, st: 1 });
            }
        },
        dust(px, py, o) {
            for (let k = 0; k < (o.count ?? 7); k++) {
                emit(px + (RNG() - 0.5) * 8, py - RNG() * 2, (RNG() - 0.5) * 50 + (o.dir ?? 0) * 25, -10 - RNG() * 18, 0.35 + RNG() * 0.35, pick(["#6a6f8c", "#555a76", "#474b66"]), { g: -6, d: 3, s: RNG() < 0.3 ? 2 : 1 });
            }
        },
        glass(px, py, o) {
            const c = o.color ?? HEX.cyan2;
            for (let k = 0; k < (o.count ?? 12); k++) {
                const a = -Math.PI / 2 + (RNG() - 0.5) * 2.4 + (o.dir ?? 0) * 0.5;
                const sp = 60 + RNG() * 130;
                emit(px, py, Math.cos(a) * sp, Math.sin(a) * sp, 0.45 + RNG() * 0.45, pick([c, c, "#ffffff", "#9fdcef"]), { g: 460, d: 0.5, s: RNG() < 0.35 ? 2 : 1 });
            }
        },
        ink(px, py, o) {
            for (let k = 0; k < (o.count ?? 10); k++) {
                const a = -Math.PI / 2 + (RNG() - 0.5) * 2.6 + (o.dir ?? 0) * 0.6;
                const sp = 50 + RNG() * 110;
                emit(px, py, Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + RNG() * 0.3, pick([HEX.blood, "#7a1626", "#2a1830"]), { g: 380, d: 1, s: RNG() < 0.4 ? 2 : 1 });
            }
        },
        healMotes(px, py, o) {
            for (let k = 0; k < (o.count ?? 10); k++) {
                emit(px + (RNG() - 0.5) * 16, py - RNG() * 20, (RNG() - 0.5) * 8, -18 - RNG() * 22, 0.7 + RNG() * 0.6, pick([HEX.gold3, HEX.gold4, HEX.gold2]), { d: 0.5, wb: 6 });
            }
        },
        embers(px, py, o) {
            for (let k = 0; k < (o.count ?? 1); k++) {
                emit(px + (RNG() - 0.5) * 6, py, (RNG() - 0.5) * 6, -8 - RNG() * 12, 2 + RNG() * 2.5, pick([HEX.gold1, HEX.gold2, "#c0602a"]), { wb: 10 });
            }
        },
        shockDust(px, py, o) {
            for (let k = 0; k < (o.count ?? 18); k++) {
                const side = k % 2 ? 1 : -1;
                emit(px + side * RNG() * 10, py - RNG() * 3, side * (40 + RNG() * 120), -20 - RNG() * 60, 0.4 + RNG() * 0.4, pick(["#6a6f8c", "#8a8fa8", "#474b66", HEX.cyan1]), { g: 260, d: 1.5, s: RNG() < 0.3 ? 2 : 1 });
            }
        },
        slash(px, py, o) {
            arcs.push({ x: px, y: py, dir: o.dir ?? 1, r: o.radius ?? 16, color: o.color ?? "#ffffff", life: o.life ?? 0.14, max: o.life ?? 0.14, tilt: o.tilt ?? 0 });
        },
    };

    return {
        spawn(kind, px, py, opts = {}) {
            spawners[kind]?.(px, py, opts);
        },
        update(dt) {
            for (let i = 0; i < MAX; i++) {
                if (life[i] <= 0) continue;
                life[i] -= dt;
                const k = Math.max(0, 1 - drag[i] * dt);
                vx[i] *= k; vy[i] = vy[i] * k + grav[i] * dt;
                x[i] += vx[i] * dt + (wobble[i] ? Math.sin((maxLife[i] - life[i]) * 6 + i) * wobble[i] * dt : 0);
                y[i] += vy[i] * dt;
            }
            for (let i = arcs.length - 1; i >= 0; i--) {
                arcs[i].life -= dt;
                if (arcs[i].life <= 0) arcs.splice(i, 1);
            }
        },
        draw(ctx) {
            for (let i = 0; i < MAX; i++) {
                if (life[i] <= 0) continue;
                const fade = life[i] / maxLife[i];
                if (fade < 0.25 && (i + Math.floor(life[i] * 30)) % 2) continue; // flicker out
                ctx.fillStyle = color[i];
                const px = Math.round(x[i]), py = Math.round(y[i]);
                ctx.fillRect(px, py, size[i], size[i]);
                if (streak[i]) ctx.fillRect(Math.round(x[i] - vx[i] * 0.012), Math.round(y[i] - vy[i] * 0.012), 1, 1);
            }
            for (const a of arcs) {
                const t = 1 - a.life / a.max;
                const span = 1.9;
                const start = -span / 2 + a.tilt, steps = Math.ceil(a.r * span);
                ctx.fillStyle = a.color;
                for (let s = 0; s <= steps; s++) {
                    const u = s / steps;
                    if (u < t * 0.8) continue; // tail eats the arc as it fades
                    const ang = start + u * span;
                    const thick = Math.max(1, Math.round(3 * Math.sin(u * Math.PI) * (1 - t)));
                    const cx = a.x + Math.cos(ang) * a.r * a.dir, cy = a.y + Math.sin(ang) * a.r;
                    ctx.fillRect(Math.round(cx), Math.round(cy), 1, thick);
                }
            }
        },
    };
}
