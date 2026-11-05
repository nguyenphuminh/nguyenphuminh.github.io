// Screen-space HUD (480x270): player bars + heal charges top-left, boss bar along the bottom, interaction prompt.
import { drawText, measureText } from "./font.js";
import { HEX } from "./palette.js";

const trails = new Map(); // key -> { value, trail, holdUntil, max, last }

function trailOf(key, value, max) {
    const now = performance.now() / 1000;
    let t = trails.get(key);
    if (!t || t.max !== max) {
        t = { value, trail: value, holdUntil: 0, max, last: now };
        trails.set(key, t);
    }
    const dt = Math.min(0.1, now - t.last);
    t.last = now;
    if (value < t.value) t.holdUntil = now + 0.45;
    if (value > t.trail) t.trail = value;
    t.value = value;
    if (now > t.holdUntil && t.trail > value) t.trail = Math.max(value, t.trail - max * 0.6 * dt);
    return t.trail;
}

function frame(ctx, x, y, w, h, border) {
    ctx.fillStyle = "#07060c";
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = border;
    ctx.fillRect(x - 1, y - 1, w + 2, 1);
    ctx.fillRect(x - 1, y + h, w + 2, 1);
    ctx.fillRect(x - 1, y, 1, h);
    ctx.fillRect(x + w, y, 1, h);
    ctx.fillStyle = "#14121e";
    ctx.fillRect(x, y, w, h);
}

function bar(ctx, x, y, w, h, frac, trailFrac, { fill, hi, lo, trail = "#f3d6b0", border = "#3a3550" }) {
    frame(ctx, x, y, w, h, border);
    const tw = Math.round(w * Math.max(0, Math.min(1, trailFrac)));
    const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
    if (tw > fw) {
        ctx.fillStyle = trail;
        ctx.fillRect(x + fw, y, tw - fw, h);
    }
    if (fw > 0) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, fw, h);
        ctx.fillStyle = hi;
        ctx.fillRect(x, y, fw, 1);
        ctx.fillStyle = lo;
        ctx.fillRect(x, y + h - 1, fw, 1);
    }
}

function flask(ctx, x, y, full) {
    const body = full ? HEX.gold2 : "#2a2638", hi = full ? HEX.gold4 : "#3c3850", rim = full ? HEX.gold0 : "#4a4560";
    ctx.fillStyle = "#07060c";
    ctx.fillRect(x + 1, y - 1, 5, 11);
    ctx.fillRect(x - 1, y + 3, 9, 7);
    ctx.fillStyle = rim;
    ctx.fillRect(x + 2, y, 3, 2);
    ctx.fillStyle = body;
    ctx.fillRect(x + 2, y + 2, 3, 2);
    ctx.fillRect(x, y + 4, 7, 5);
    ctx.fillStyle = hi;
    ctx.fillRect(x + 1, y + 5, 1, 2);
    if (full) {
        ctx.fillStyle = HEX.gold1;
        ctx.fillRect(x, y + 8, 7, 1);
    }
}

export function drawHud(ctx, hud) {
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    const p = hud?.player;
    if (p) {
        const hpW = Math.round(Math.min(170, p.maxHp * 1.3));
        const stW = Math.round(Math.min(150, p.maxStamina * 1.1));
        const x = 12, y = 12;
        bar(ctx, x, y, hpW, 6, p.hp / p.maxHp, trailOf("php", p.hp, p.maxHp) / p.maxHp, { fill: "#b8202e", hi: "#ff5a5a", lo: "#6a0f18" });
        const blink = p.staminaEmpty && Math.floor(performance.now() / 120) % 2 === 0;
        bar(ctx, x, y + 11, stW, 4, p.stamina / p.maxStamina, trailOf("pst", p.stamina, p.maxStamina) / p.maxStamina, {
            fill: "#4f9a3c", hi: "#9be07a", lo: "#2a5a22", trail: "#cfe6a8", border: blink ? HEX.red2 : "#3a3550",
        });
        for (let i = 0; i < p.maxHeals; i++) flask(ctx, x + i * 11, y + 22, i < p.heals);
    }
    const b = hud?.boss;
    if (b) {
        const accent = b.phase >= 2 ? HEX.mag2 : HEX.cyan2;
        const accentDim = b.phase >= 2 ? HEX.mag0 : HEX.cyan0;
        const w = 300, x = Math.round((480 - w) / 2), y = 248;
        drawText(ctx, b.name, x, y - 12, { color: "#e8e6f0" });
        bar(ctx, x, y, w, 5, b.hp / b.maxHp, trailOf("bhp", b.hp, b.maxHp) / b.maxHp, { fill: "#9a1e2a", hi: "#e84a52", lo: "#55101a", border: accentDim });
        ctx.fillStyle = accent;
        ctx.fillRect(x - 3, y - 3, 2, 1); ctx.fillRect(x - 3, y - 3, 1, 2);
        ctx.fillRect(x + w + 1, y - 3, 2, 1); ctx.fillRect(x + w + 2, y - 3, 1, 2);
        if (b.maxStagger) {
            const sw = Math.round(w * Math.max(0, Math.min(1, b.stagger / b.maxStagger)));
            ctx.fillStyle = "#1c1a2a";
            ctx.fillRect(x, y + 8, w, 2);
            ctx.fillStyle = accent;
            ctx.fillRect(x, y + 8, sw, 2);
            ctx.fillStyle = "#ffffff";
            if (sw > 0) ctx.fillRect(x + sw - 1, y + 8, 1, 2);
        }
    } else {
        trails.delete("bhp");
    }
    if (hud?.prompt) {
        const py = b ? 220 : 244;
        const w = measureText(hud.prompt) + 10;
        ctx.fillStyle = "rgba(7,6,12,0.75)";
        ctx.fillRect(Math.round(240 - w / 2), py - 3, w, 15);
        drawText(ctx, hud.prompt, 240, py, { align: "center", color: HEX.gold3 });
    }
    ctx.imageSmoothingEnabled = prev;
}
