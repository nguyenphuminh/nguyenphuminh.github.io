import { rand } from "../../shared/math.js";
import { view } from "../../shared/view.js";

// Screen-space weather: falling snow on the peak; low mist strands and fireflies
// in the marsh. Particles shift with the camera so they feel part of the world.
export function createWeather(kind) {
    if (!kind) return null;
    const part = () => ({ x: rand(view.w), y: rand(view.h), v: rand(1), s: rand(1), phase: rand(6.28) });
    return {
        kind,
        lastCam: null,
        parts: Array.from({ length: kind === "snow" ? 110 : 14 }, part),
        flies: kind === "mist" ? Array.from({ length: 12 }, part) : [],
    };
}

function wrap(p) {
    const W = view.w + 120, H = view.h + 40;
    p.x = ((p.x + 60) % W + W) % W - 60;
    p.y = ((p.y + 20) % H + H) % H - 20;
}

export function drawWeather(ctx, w, cam, dt) {
    if (!w) return;
    const dx = w.lastCam ? cam.x - w.lastCam.x : 0, dy = w.lastCam ? cam.y - w.lastCam.y : 0;
    w.lastCam = { x: cam.x, y: cam.y };
    if (w.kind === "snow") {
        for (const p of w.parts) {
            p.phase += dt * 2;
            p.x += (-14 + Math.sin(p.phase) * 8) * dt - dx * (0.4 + p.s * 0.4);
            p.y += (16 + p.v * 22) * dt - dy * (0.4 + p.s * 0.4);
            wrap(p);
            ctx.fillStyle = p.s > 0.7 ? "#ffffff" : "rgba(255, 255, 255, 0.7)";
            const size = p.s > 0.85 ? 2 : 1;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
        }
        return;
    }
    // Mist: thin tapered strands of fog drifting sideways.
    for (const p of w.parts) {
        p.x += (5 + p.v * 8) * dt - dx * 0.8;
        p.y -= dy * 0.8;
        wrap(p);
        const len = Math.round(50 + p.s * 70);
        for (let row = 0; row < 3; row++) {
            ctx.fillStyle = `rgba(200, 230, 220, ${0.05 + 0.04 * (row === 1)})`;
            const inset = row === 1 ? 0 : Math.round(len * 0.2);
            ctx.fillRect(Math.round(p.x + inset), Math.round(p.y + row), len - inset * 2, 1);
        }
    }
    // Fireflies: slow wandering specks that pulse.
    for (const f of w.flies) {
        f.phase += dt;
        f.x += Math.cos(f.phase * 0.7 + f.s * 6) * 6 * dt - dx;
        f.y += Math.sin(f.phase * 0.9 + f.v * 6) * 6 * dt - dy;
        wrap(f);
        const glow = 0.5 + 0.5 * Math.sin(f.phase * 3 + f.s * 6);
        ctx.fillStyle = `rgba(200, 255, 138, ${0.25 + glow * 0.6})`;
        ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
    }
}
