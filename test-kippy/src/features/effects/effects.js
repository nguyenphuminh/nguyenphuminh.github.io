import { Entity, Vector2 } from "../../shared/kippy.js";
import { drawText } from "../../shared/font.js";
import { rand, TAU } from "../../shared/math.js";
import { view } from "../../shared/view.js";
import { fxAnimator } from "../art/atlas.js";

// Visual feedback: one-shot Kippy animations, plus lightweight particles, damage
// numbers, banners, flashes and screen shake drawn directly on the canvas.

export function createFxState() {
    return { numbers: [], particles: [], banners: [], shakeMag: 0, shakeTime: 0, flash: 0, flashColor: "#fff", hurt: 0, poison: false };
}

export function spawnFx(scene, id, x, y, { scale = 1, z = 5, rotation = 0 } = {}) {
    const e = new Entity({ animator: fxAnimator(id, scale), position: new Vector2(x, y), rotation });
    e.z = z;
    e.animator.onEnd = () => scene.remove(e);
    scene.addEntity(e);
    return e;
}

export function damageNumber(scene, x, y, amount, color = "#f3eee0") {
    const list = scene.fx.numbers;
    if (list.length > 80) list.shift();
    list.push({ x: x + rand(-3, 3), y, text: String(Math.max(1, Math.round(amount))), t: 0.55, color });
}

export function burst(scene, x, y, color, count = 6, speed = 70) {
    const list = scene.fx.particles;
    for (let i = 0; i < count && list.length < 500; i++) {
        const a = rand(TAU), v = rand(speed * 0.3, speed);
        list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rand(0.25, 0.5), color });
    }
}

export function shake(scene, mag, time) {
    scene.fx.shakeMag = Math.max(scene.fx.shakeMag, mag);
    scene.fx.shakeTime = Math.max(scene.fx.shakeTime, time);
}

export function flash(scene, alpha, color = "#ffffff") {
    scene.fx.flash = Math.max(scene.fx.flash, alpha);
    scene.fx.flashColor = color;
}

export function banner(scene, text, sub = "", color = "#f0c24b", time = 2.6) {
    scene.fx.banners = [{ text, sub, color, t: time, total: time }];
}

export function updateFx(scene, dt) {
    const fx = scene.fx;
    for (const n of fx.numbers) { n.t -= dt; n.y -= 22 * dt; }
    fx.numbers = fx.numbers.filter(n => n.t > 0);
    for (const p of fx.particles) {
        p.t -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.9;
        p.vy *= 0.9;
    }
    fx.particles = fx.particles.filter(p => p.t > 0);
    for (const b of fx.banners) b.t -= dt;
    fx.banners = fx.banners.filter(b => b.t > 0);
    fx.shakeTime = Math.max(0, fx.shakeTime - dt);
    if (fx.shakeTime === 0) fx.shakeMag = 0;
    fadeOverlays(fx, dt);
}

// Screen flashes keep fading while menus hold the rest of the world still.
export function fadeOverlays(fx, dt) {
    fx.flash = Math.max(0, fx.flash - dt * 1.8);
    fx.hurt = Math.max(0, fx.hurt - dt);
}

export function shakeOffset(fx) {
    if (!fx.shakeMag) return [0, 0];
    return [Math.round(rand(-fx.shakeMag, fx.shakeMag)), Math.round(rand(-fx.shakeMag, fx.shakeMag))];
}

// World space: the caller has already translated by the camera.
export function drawWorldFx(ctx, scene) {
    for (const p of scene.fx.particles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    for (const n of scene.fx.numbers) drawText(ctx, n.text, n.x, n.y, { color: n.color, align: "center" });
}

export function drawScreenFx(ctx, scene) {
    const fx = scene.fx;
    if (fx.poison) {
        ctx.fillStyle = "rgba(120, 200, 80, 0.35)";
        ctx.fillRect(0, 0, view.w, 2);
        ctx.fillRect(0, view.h - 2, view.w, 2);
        ctx.fillRect(0, 0, 2, view.h);
        ctx.fillRect(view.w - 2, 0, 2, view.h);
    }
    if (fx.hurt > 0) {
        ctx.fillStyle = `rgba(211, 57, 63, ${fx.hurt * 0.5})`;
        ctx.fillRect(0, 0, view.w, 3);
        ctx.fillRect(0, view.h - 3, view.w, 3);
        ctx.fillRect(0, 0, 3, view.h);
        ctx.fillRect(view.w - 3, 0, 3, view.h);
    }
    if (fx.flash > 0) {
        ctx.globalAlpha = Math.min(1, fx.flash);
        ctx.fillStyle = fx.flashColor;
        ctx.fillRect(0, 0, view.w, view.h);
        ctx.globalAlpha = 1;
    }
}

export function drawBanners(ctx, scene) {
    for (const b of scene.fx.banners) {
        const fade = Math.min(1, b.t / 0.4, (b.total - b.t) / 0.25);
        ctx.globalAlpha = Math.max(0, fade);
        const y = Math.round(view.h * 0.26);
        drawText(ctx, b.text, view.w / 2, y, { color: b.color, scale: 2, align: "center" });
        if (b.sub) drawText(ctx, b.sub, view.w / 2, y + 20, { color: "#f3eee0", align: "center" });
        ctx.globalAlpha = 1;
    }
}
