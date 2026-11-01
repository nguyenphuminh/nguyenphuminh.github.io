import { glowSprite } from "../../core/paint.js";
import { TAU } from "../../core/math.js";

// Pooled additive glow particles: trails, bubbles, sparks, embers
export function createParticles(max = 1800) {
    const x = new Float32Array(max);
    const y = new Float32Array(max);
    const vx = new Float32Array(max);
    const vy = new Float32Array(max);
    const life = new Float32Array(max);
    const total = new Float32Array(max);
    const size = new Float32Array(max);
    const drag = new Float32Array(max);
    const lift = new Float32Array(max);
    const color = new Array(max);
    let n = 0;

    function spawn(px, py, pvx, pvy, plife, psize, pcolor, pdrag = 1.5, plift = 0) {
        if (n >= max) return;
        const i = n++;
        x[i] = px;
        y[i] = py;
        vx[i] = pvx;
        vy[i] = pvy;
        life[i] = total[i] = plife;
        size[i] = psize;
        color[i] = pcolor;
        drag[i] = pdrag;
        lift[i] = plift;
    }

    function burst(px, py, count, { speed = 120, life: l = 0.8, size: s = 6, color: c, drag: d = 2.5, lift: b = 0, angle = 0, spread = TAU }) {
        for (let k = 0; k < count; k++) {
            const a = angle + (Math.random() - 0.5) * spread;
            const v = speed * (0.3 + 0.7 * Math.random());
            spawn(px, py, Math.cos(a) * v, Math.sin(a) * v, l * (0.6 + 0.4 * Math.random()), s * (0.6 + 0.4 * Math.random()), c, d, b);
        }
    }

    function update(dt) {
        for (let i = 0; i < n; i++) {
            life[i] -= dt;
            if (life[i] <= 0) {
                const j = --n;
                x[i] = x[j];
                y[i] = y[j];
                vx[i] = vx[j];
                vy[i] = vy[j];
                life[i] = life[j];
                total[i] = total[j];
                size[i] = size[j];
                color[i] = color[j];
                drag[i] = drag[j];
                lift[i] = lift[j];
                i--;
                continue;
            }
            const k = Math.exp(-drag[i] * dt);
            vx[i] *= k;
            vy[i] = vy[i] * k - lift[i] * dt;
            x[i] += vx[i] * dt;
            y[i] += vy[i] * dt;
        }
    }

    function renderOver(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < n; i++) {
            const a = life[i] / total[i];
            const s = size[i] * (0.4 + 0.6 * a);
            ctx.globalAlpha = a;
            ctx.drawImage(glowSprite(color[i]), x[i] - s, y[i] - s, s * 2, s * 2);
        }
        ctx.restore();
    }

    return { spawn, burst, update, renderOver };
}
