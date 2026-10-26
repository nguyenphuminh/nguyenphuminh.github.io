import { drawText } from "../../shared/font.js";
import { bar, panel } from "../../shared/ui.js";
import { UI } from "../../shared/palette.js";
import { formatTime } from "../../shared/math.js";
import { view } from "../../shared/view.js";
import { isMuted } from "../../shared/audio.js";
import { iconOf, SPRITES } from "../art/atlas.js";
import { canEvolve } from "../techniques/evolutions.js";
import { REALMS, realmLabel } from "../progression/realms.js";

export function drawHud(ctx, scene) {
    const p = scene.player, W = view.w;

    // A dark band keeps the top row readable on bright ground (the snowy peak).
    ctx.fillStyle = "rgba(10, 8, 20, 0.45)";
    ctx.fillRect(0, 0, W, 24);

    // Qi (experience) bar across the top.
    bar(ctx, 1, 1, W - 2, 9, p.qi / p.qiNext, UI.jade, "#14221b");
    drawText(ctx, `Lv ${p.level}`, W - 4, 2, { color: UI.paper, align: "right" });

    drawText(ctx, realmLabel(p.level), 4, 14, { color: REALMS[p.realm].color });
    drawText(ctx, formatTime(scene.time), W / 2, 14, { color: UI.paper, scale: 2, align: "center" });
    drawText(ctx, `Slain ${scene.kills}`, W - 4, 14, { color: UI.paper, align: "right" });
    if (isMuted()) drawText(ctx, "Muted", W - 4, 24, { color: UI.dim, align: "right" });

    let y = 25;
    for (const row of [p.techniques, p.treasures]) {
        row.forEach((item, i) => drawSlot(ctx, 4 + i * 19, y, item, row === p.techniques && canEvolve(p, item), scene.time));
        if (row.length) y += 22;
    }

    drawChestPointers(ctx, scene);

    // Vitality bar under the cultivator.
    const sx = Math.round(p.position.x - scene.camera.position.x), sy = Math.round(p.position.y - scene.camera.position.y);
    bar(ctx, sx - 9, sy + 11, 18, 2, p.hp / p.stats.maxHp, UI.red);

    if (scene.boss && !scene.boss.dead) {
        const b = scene.boss, bw = Math.min(260, W - 40), bx = (W - bw) / 2, by = view.h - 14;
        drawText(ctx, b.def.name, W / 2, by - 11, { color: b.def.color, align: "center" });
        bar(ctx, bx, by, bw, 5, b.hp / b.maxHp, b.def.color);
    }
}

// Spirit Chests (the key to evolutions) that are off screen get a blinking
// marker where the line toward them meets a frame kept clear of the HUD text.
function drawChestPointers(ctx, scene) {
    const cam = scene.camera.position, cx = view.w / 2, cy = view.h / 2;
    const left = 10, right = view.w - 10, top = 36, bottom = view.h - 24;
    for (const o of scene.pickups) {
        if (o.kind !== "chest" || o.dead) continue;
        const dx = o.position.x - cam.x - cx, dy = o.position.y - cam.y - cy;
        if (Math.abs(dx) < cx && Math.abs(dy) < cy) continue;
        const t = Math.min(
            dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity,
            dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity,
        );
        const x = Math.round(cx + dx * t), y = Math.round(cy + dy * t);
        if (Math.floor(scene.time * 4) % 2) ctx.drawImage(SPRITES.chest, x - 6, y - 5);
        const d = Math.hypot(dx, dy);
        ctx.fillStyle = UI.gold;
        ctx.fillRect(Math.round(x + (dx / d) * 9) - 1, Math.round(y + (dy / d) * 9) - 1, 3, 3);
    }
}

// Level pips under each slot; they blink white when the technique can evolve.
function drawSlot(ctx, x, y, item, ready, time) {
    const evolved = Boolean(item.def.evolvesFrom);
    panel(ctx, x, y, 18, 18, { fill: "rgba(22, 18, 34, 0.85)", border: evolved ? UI.gold : UI.goldDark, studs: false });
    ctx.drawImage(iconOf(item.def), x + 1, y + 1);
    if (evolved) return;
    const max = item.def.maxLevel, blink = ready && Math.floor(time * 3) % 2 === 0;
    for (let i = 0; i < max; i++) {
        ctx.fillStyle = blink ? "#ffffff" : i < item.level ? (item.level === max ? UI.gold : UI.qi) : "#3a3550";
        ctx.fillRect(x + 1 + i * 2, y + 19, 1, 2);
    }
}
