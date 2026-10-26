import { drawText, drawWrapped, wrappedLines } from "../../shared/font.js";
import { panel, dim, inRect, pointerMoved } from "../../shared/ui.js";
import { UI } from "../../shared/palette.js";
import { formatTime } from "../../shared/math.js";
import { view } from "../../shared/view.js";
import { sfx } from "../../shared/audio.js";
import { ICONS, iconOf } from "../art/atlas.js";
import { evolutionOf, canEvolve } from "../techniques/evolutions.js";
import { choiceInfo } from "../progression/levelup.js";
import { REALMS, realmLabel } from "../progression/realms.js";

// Keyboard, number keys, hover and click for a vertical list of options.
// Returns the chosen index, or -1.
export function menuInput(input, menu) {
    const n = menu.rects.length;
    if (!n || menu.wait > 0) return -1;
    if (input.isKeyPressed("KeyW") || input.isKeyPressed("ArrowUp")) {
        menu.selected = (menu.selected - 1 + n) % n;
        sfx.move();
    }
    if (input.isKeyPressed("KeyS") || input.isKeyPressed("ArrowDown")) {
        menu.selected = (menu.selected + 1) % n;
        sfx.move();
    }
    for (let i = 0; i < n; i++) if (input.isKeyPressed(`Digit${i + 1}`)) return i;
    if (input.isKeyPressed("Enter") || input.isKeyPressed("Space")) return menu.selected;

    const ptr = input.pointer;
    if (pointerMoved(input, menu)) {
        const hover = menu.rects.findIndex(r => inRect(ptr, r));
        if (hover >= 0) menu.selected = hover;
    }
    if (input.isPointerPressed(0)) return menu.rects.findIndex(r => inRect(ptr, r));
    return -1;
}

export function drawLevelUp(ctx, scene) {
    const m = scene.menu, W = view.w, H = view.h;
    dim(ctx, W, H, 0.55);
    const cw = Math.min(300, W - 16), ch = 44, gap = 5;
    let y = Math.max(52, Math.round((H - m.choices.length * (ch + gap)) / 2) + 12);
    drawText(ctx, m.title, W / 2, y - 38, { color: UI.gold, scale: 2, align: "center" });
    drawText(ctx, m.subtitle, W / 2, y - 17, { color: UI.paper, align: "center" });
    m.rects = [];
    m.choices.forEach((c, i) => {
        const info = choiceInfo(c), x = Math.round((W - cw) / 2), sel = i === m.selected;
        panel(ctx, x, y, cw, ch, { border: sel ? UI.jade : UI.goldDark, fill: sel ? "rgba(30, 50, 42, 0.97)" : UI.panel });
        ctx.drawImage(ICONS[info.icon], x + 6, y + 6, 32, 32);
        drawText(ctx, info.name, x + 44, y + 6, { color: UI.gold });
        if (info.tag) drawText(ctx, info.tag, x + cw - 6, y + 6, { color: info.tag === "New!" ? UI.qi : UI.paper, align: "right" });
        // Evolution partners, so recipes can be discovered while choosing.
        info.hints.forEach((id, k) => {
            const hx = x + cw - 22 - k * 18;
            ctx.drawImage(ICONS[id], hx, y + 21);
            if (k === info.hints.length - 1) drawText(ctx, "+", hx - 7, y + 26, { color: UI.dim });
        });
        const descWidth = cw - 52 - (info.hints.length ? info.hints.length * 18 + 8 : 0);
        drawWrapped(ctx, info.desc, x + 44, y + 19, descWidth, { maxLines: 2, color: "#d8d2c4" });
        m.rects.push({ x, y, w: cw, h: ch });
        y += ch + gap;
    });
    drawText(ctx, "Arrow keys and Enter, number keys, or click", W / 2, y + 4, { color: UI.dim, align: "center" });
}

export function drawPause(ctx, scene) {
    const p = scene.player, s = p.stats, W = view.w, H = view.h;
    dim(ctx, W, H, 0.6);
    const pw = Math.min(320, W - 16), ph = Math.min(250, H - 16), x = Math.round((W - pw) / 2), y = Math.round((H - ph) / 2);
    panel(ctx, x, y, pw, ph);
    drawText(ctx, "Meditating", W / 2, y + 8, { color: UI.gold, scale: 2, align: "center" });
    drawText(ctx, realmLabel(p.level), W / 2, y + 28, { color: REALMS[p.realm].color, align: "center" });

    const ly = y + 44;
    // Techniques: level, the treasure that evolves them, and whether they're ready.
    p.techniques.forEach((t, i) => {
        const ty = ly + i * 18, max = t.level === t.def.maxLevel;
        ctx.drawImage(iconOf(t.def), x + 12, ty);
        if (t.def.evolvesFrom) {
            drawText(ctx, "Evolved", x + 32, ty + 5, { color: UI.gold });
            return;
        }
        drawText(ctx, max ? "Max" : `Lv ${t.level}`, x + 32, ty + 5, { color: max ? UI.gold : UI.paper });
        const evo = evolutionOf(t.def);
        drawText(ctx, "+", x + 58, ty + 5, { color: UI.dim });
        ctx.globalAlpha = p.treasures.some(tr => tr.def.id === evo.treasure) ? 1 : 0.35;
        ctx.drawImage(ICONS[evo.treasure], x + 66, ty);
        ctx.globalAlpha = 1;
        if (canEvolve(p, t)) drawText(ctx, "Ready", x + 86, ty + 5, { color: UI.qi });
    });
    p.treasures.forEach((t, i) => {
        const ty = ly + i * 18, max = t.level === t.def.maxLevel;
        ctx.drawImage(ICONS[t.def.id], x + 130, ty);
        drawText(ctx, max ? "Max" : `Lv ${t.level}`, x + 150, ty + 5, { color: max ? UI.gold : UI.paper });
    });

    const stats = [
        ["Might", `${Math.round(s.might * 100)}%`],
        ["Cooldown", `${Math.round(s.cooldown * 100)}%`],
        ["Area", `${Math.round(s.area * 100)}%`],
        ["Speed", `${Math.round(s.speed)}`],
        ["Armor", `${s.armor}`],
        ["Regen", `${s.regen.toFixed(1)}/s`],
        ["Max HP", `${s.maxHp}`],
        ["Extra", `+${s.amount}`],
    ];
    const sx = x + pw - 112;
    stats.forEach(([k, v], i) => {
        drawText(ctx, k, sx, ly + i * 12, { color: UI.dim });
        drawText(ctx, v, x + pw - 12, ly + i * 12, { color: UI.paper, align: "right" });
    });
    const hint = "Evolve: max a technique, own its treasure, then open a Spirit Chest.";
    drawWrapped(ctx, hint, W / 2, y + ph - 28 - (wrappedLines(hint, pw - 24) - 1) * 10, pw - 24, { color: UI.goldDark, align: "center" });
    drawText(ctx, "Esc or tap to resume, Q to quit, M to mute", W / 2, y + ph - 14, { color: UI.dim, align: "center" });
}

export function drawResults(ctx, scene) {
    const W = view.w, H = view.h, won = scene.state === "won", p = scene.player, stage = scene.stage;
    dim(ctx, W, H, Math.min(0.75, scene.resultTime));
    if (scene.resultTime < 0.8) return;
    const pw = Math.min(300, W - 16), ph = 190, x = Math.round((W - pw) / 2), y = Math.round((H - ph) / 2);
    panel(ctx, x, y, pw, ph, { border: won ? UI.gold : UI.red });
    drawText(ctx, won ? stage.victory[0] : "Dao Heart Shattered", W / 2, y + 10, { color: won ? UI.gold : UI.red, scale: 2, align: "center" });
    drawText(ctx, won ? stage.victory[1] : `The ${stage.name} claims another cultivator`, W / 2, y + 32, { color: UI.paper, align: "center" });
    const rows = [
        ["Stage", stage.name],
        ["Cultivator", p.character.name],
        ["Survived", formatTime(scene.time)],
        ["Realm", REALMS[p.realm].name],
        ["Level", `${p.level}`],
        ["Demons slain", `${scene.kills}`],
    ];
    rows.forEach(([k, v], i) => {
        drawText(ctx, k, x + 20, y + 50 + i * 13, { color: UI.dim });
        drawText(ctx, v, x + pw - 20, y + 50 + i * 13, { color: UI.paper, align: "right" });
    });
    let ny = y + 132;
    if (scene.unlockedStage) {
        drawText(ctx, `New stage unlocked: ${scene.unlockedStage.name}`, W / 2, ny, { color: UI.gold, align: "center" });
        ny += 12;
    }
    if (scene.newRecord) drawText(ctx, "New personal best!", W / 2, ny, { color: UI.qi, align: "center" });
    if (Math.floor(scene.resultTime * 2) % 2 === 0) drawText(ctx, "Press Enter or click to continue", W / 2, y + ph - 16, { color: UI.gold, align: "center" });
}
