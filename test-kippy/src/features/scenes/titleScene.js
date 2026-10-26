import { Scene, Entity } from "../../shared/kippy.js";
import { view } from "../../shared/view.js";
import { drawText, drawWrapped, wrappedLines } from "../../shared/font.js";
import { panel, inRect, pointerMoved } from "../../shared/ui.js";
import { UI } from "../../shared/palette.js";
import { rand, TAU, formatTime } from "../../shared/math.js";
import { sfx } from "../../shared/audio.js";
import { writeSave } from "../../shared/store.js";
import { actor, makeAnimator, actorFrame } from "../art/atlas.js";
import { createGround, updateGround, stagePreview } from "../world/ground.js";
import { CHARACTERS } from "../player/characters.js";
import { TECH_BY_ID } from "../techniques/techniques.js";
import { REALMS } from "../progression/realms.js";
import { STAGES } from "../stages/stages.js";
import { loadProgress, recordFor, isUnlocked, ascendedCount } from "../stages/progress.js";
import { handleGlobalKeys } from "./controls.js";

// Title, cultivator select, then stage select. The three heroes are Kippy
// entities walking in place; they are kept out of the scene list so they can be
// drawn over the cards.
export class TitleScene extends Scene {
    constructor(onStart) {
        super();
        this.onStart = onStart;
    }

    init() {
        this.save = loadProgress();
        this.mode = "character";
        this.selected = Math.max(0, CHARACTERS.findIndex(c => c.id === this.save.lastCharacter));
        this.stageIndex = Math.max(0, STAGES.findIndex(s => s.id === this.save.lastStage));
        if (!isUnlocked(this.save, this.stageIndex)) this.stageIndex = 0;
        this.time = 0;
        this.rects = [];
        this.ground = createGround(this, STAGES[0]);
        this.heroes = CHARACTERS.map(c => new Entity({ animator: makeAnimator(actor(c.art, 3)) }));
        this.previews = STAGES.map(s => stagePreview(s, 150, 48));
        this.motes = Array.from({ length: 50 }, () => ({ x: rand(1), y: rand(1), v: rand(0.01, 0.04), phase: rand(TAU) }));
    }

    animationUpdate(dt) {
        super.animationUpdate(dt);
        for (const h of this.heroes) h.animator.update(dt);
    }

    update(dt) {
        const input = this.game.input;
        handleGlobalKeys(input);
        this.time += dt;
        for (const m of this.motes) {
            m.y -= m.v * dt;
            if (m.y < -0.02) m.y = 1.02;
        }
        const n = this.mode === "character" ? CHARACTERS.length : STAGES.length;
        const current = this.mode === "character" ? this.selected : this.stageIndex;
        const choose = i => {
            if (this.mode === "character") this.selected = i;
            else this.stageIndex = i;
            sfx.move();
        };
        if (input.isKeyPressed("KeyA") || input.isKeyPressed("ArrowLeft")) choose((current - 1 + n) % n);
        if (input.isKeyPressed("KeyD") || input.isKeyPressed("ArrowRight")) choose((current + 1) % n);
        for (let i = 0; i < n; i++) if (input.isKeyPressed(`Digit${i + 1}`)) choose(i);

        const ptr = input.pointer;
        if (pointerMoved(input, this)) {
            const hover = this.rects.findIndex(r => inRect(ptr, r));
            if (hover >= 0 && hover !== current) choose(hover);
        }
        if (this.mode === "stage" && (input.isKeyPressed("Escape") || input.isKeyPressed("Backspace") || (input.isPointerPressed(0) && inRect(ptr, this.backRect)))) {
            this.mode = "character";
            sfx.move();
            return;
        }
        if (input.isPointerPressed(0)) {
            const hit = this.rects.findIndex(r => inRect(ptr, r));
            if (hit >= 0) this.confirm(hit);
        } else if (input.isKeyPressed("Enter") || input.isKeyPressed("Space")) {
            this.confirm(current);
        }

        this.heroes.forEach((h, i) => {
            h.animator.stopped = i !== this.selected;
            if (h.animator.stopped) h.animator.frameIndex = 0;
        });
    }

    confirm(i) {
        if (this.mode === "character") {
            this.selected = i;
            this.mode = "stage";
            sfx.select();
            return;
        }
        if (!isUnlocked(this.save, i)) {
            sfx.hurt();
            return;
        }
        sfx.select();
        writeSave({ ...this.save, lastCharacter: CHARACTERS[this.selected].id, lastStage: STAGES[i].id });
        this.onStart(CHARACTERS[this.selected], STAGES[i]);
    }

    // Stacks title, cards, blurb and controls vertically, shrinking cards on short screens.
    layout() {
        const W = view.w, H = view.h, n = this.mode === "character" ? CHARACTERS.length : STAGES.length;
        const titleScale = W >= 360 ? 3 : 2;
        const textWidth = Math.min(W - 16, 400);
        const blurb = this.mode === "character"
            ? "Techniques fire on their own. Gather spirit qi, break through realms, and endure 15 minutes until the final trial."
            : "Ascend on a stage to unlock the next one.";
        const help = this.mode === "character"
            ? "Left/Right to choose, Enter to continue. WASD or hold the mouse to move. Esc pauses, M mutes."
            : "Left/Right to choose, Enter to begin, Esc to go back.";
        const blurbLines = wrappedLines(blurb, textWidth);
        const head = titleScale * 7 + 24, foot = 8 + blurbLines * 10 + 6 + wrappedLines(help, textWidth) * 10;
        const chh = Math.max(150, Math.min(178, H - head - foot - 16));
        const top = Math.max(6, Math.round((H - (head + chh + foot)) / 2));
        const cw = Math.min(150, Math.floor((W - 28) / n)), gap = 6;
        const x0 = Math.round((W - (cw * n + gap * (n - 1))) / 2);
        const cardY = top + head;
        return {
            titleScale, blurb, help, textWidth, top,
            cards: Array.from({ length: n }, (_, i) => ({ x: x0 + i * (cw + gap), y: cardY, w: cw, h: chh })),
            blurbY: cardY + chh + 8,
            helpY: cardY + chh + 8 + blurbLines * 10 + 6,
        };
    }

    render() {
        const ctx = this.game.ctx, cam = this.camera, W = view.w, H = view.h;
        cam.position.x = Math.round(this.time * 10);
        cam.position.y = Math.round(this.time * 4);
        updateGround(this.ground, cam);

        const L = this.layout();
        this.rects = L.cards;
        ctx.imageSmoothingEnabled = false;
        super.render();
        ctx.fillStyle = "rgba(10, 8, 20, 0.45)";
        ctx.fillRect(0, 0, W, H);
        for (const m of this.motes) {
            ctx.fillStyle = m.phase > Math.PI ? UI.qi : "#c4ecff";
            ctx.fillRect(Math.round(m.x * W + Math.sin(this.time + m.phase) * 6), Math.round(m.y * H), 1, 1);
        }

        drawText(ctx, "Immortal Ascension", W / 2, L.top, { color: UI.gold, scale: L.titleScale, align: "center" });
        const subtitle = this.mode === "character"
            ? "Survive, cultivate, defy the heavens"
            : `Choose a trial ground for ${CHARACTERS[this.selected].name}`;
        drawText(ctx, subtitle, W / 2, L.top + L.titleScale * 7 + 8, { color: UI.paper, align: "center" });

        if (this.mode === "character") {
            CHARACTERS.forEach((c, i) => this.drawCharacterCard(ctx, c, this.rects[i], i === this.selected));
            this.heroes.forEach((h, i) => {
                const r = this.rects[i];
                h.position.x = cam.position.x + r.x + r.w / 2;
                h.position.y = cam.position.y + r.y + 34;
            });
            ctx.save();
            this.camera.apply();
            this.heroes.forEach(h => h.render(ctx));
            ctx.restore();
            this.backRect = null;
        } else {
            STAGES.forEach((s, i) => this.drawStageCard(ctx, s, i, this.rects[i], i === this.stageIndex));
            this.backRect = { x: 6, y: H - 20, w: 40, h: 14 };
            panel(ctx, this.backRect.x, this.backRect.y, this.backRect.w, this.backRect.h, { studs: false });
            drawText(ctx, "Back", this.backRect.x + 20, this.backRect.y + 4, { color: UI.paper, align: "center" });
        }

        drawWrapped(ctx, L.blurb, W / 2, L.blurbY, L.textWidth, { color: UI.dim, align: "center" });
        drawWrapped(ctx, L.help, W / 2, L.helpY, L.textWidth, { color: UI.goldDark, align: "center" });
    }

    drawCharacterCard(ctx, c, r, selected) {
        cardPanel(ctx, r, selected);
        const cx = r.x + r.w / 2, inner = r.w - 12, center = { align: "center" };
        drawText(ctx, c.name, cx, r.y + 66, { color: selected ? UI.gold : UI.paper, align: "center" });
        let y = drawWrapped(ctx, c.title, cx, r.y + 78, inner, { color: "#d8d2c4", ...center });
        y = drawWrapped(ctx, TECH_BY_ID[c.start].name, cx, y + 4, inner, { color: UI.jade, ...center });
        drawWrapped(ctx, c.perk, cx, y, inner, { color: UI.dim, ...center });
        const ascended = ascendedCount(this.save, c.id);
        const best = Math.max(0, ...STAGES.map(s => recordFor(this.save, s.id, c.id)?.bestTime ?? 0));
        cardFooter(ctx, r, ascended ? `Ascended ${ascended} of ${STAGES.length} stages` : best ? `Best ${formatTime(best)}` : "No runs yet", ascended ? UI.gold : UI.qi);
    }

    drawStageCard(ctx, s, i, r, selected) {
        const open = isUnlocked(this.save, i);
        cardPanel(ctx, r, selected);
        const cx = r.x + r.w / 2, inner = r.w - 12, pw = Math.min(r.w - 12, 150);
        const px = Math.round(cx - pw / 2), py = r.y + 6;
        ctx.drawImage(this.previews[i], 0, 0, pw, 48, px, py, pw, 48);
        s.preview.forEach((id, k) => {
            const img = actorFrame(id);
            ctx.drawImage(img, Math.round(px + (pw * (k + 1)) / 4 - img.width / 2), py + 46 - img.height);
        });
        ctx.strokeStyle = UI.ink;
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, 47);
        let y = r.y + 60;
        drawText(ctx, s.name, cx, y, { color: selected ? UI.gold : UI.paper, align: "center" });
        y += 12;
        if (!open) {
            ctx.fillStyle = "rgba(8, 6, 14, 0.65)";
            ctx.fillRect(px, py, pw, 48);
            drawText(ctx, "Locked", cx, y + 14, { color: UI.red, scale: 2, align: "center" });
            drawWrapped(ctx, `Ascend on ${STAGES[i - 1].name} to unlock`, cx, y + 36, inner, { color: UI.paper, align: "center" });
            return;
        }
        for (const [text, color] of [[s.blurb, "#d8d2c4"], [s.bossLine, UI.dim], [s.hazardLine, s.hazard ? "#9be36b" : UI.dim]]) {
            y = drawWrapped(ctx, text, cx, y, inner, { color, align: "center" }) + 3;
        }
        const rec = recordFor(this.save, s.id, CHARACTERS[this.selected].id);
        cardFooter(ctx, r, !rec ? "No runs yet" : rec.ascended ? "Ascended!" : `Best ${formatTime(rec.bestTime)}, ${REALMS[rec.bestRealm ?? 0].name}`, rec?.ascended ? UI.gold : UI.qi);
    }
}

function cardPanel(ctx, r, selected) {
    panel(ctx, r.x, r.y, r.w, r.h, { border: selected ? UI.gold : UI.goldDark, fill: selected ? "rgba(40, 32, 58, 0.95)" : "rgba(22, 18, 34, 0.9)" });
}

// A card's bottom line (records), anchored to the card's bottom edge.
function cardFooter(ctx, r, text, color) {
    const inner = r.w - 12;
    drawWrapped(ctx, text, r.x + r.w / 2, r.y + r.h - 12 - (wrappedLines(text, inner) - 1) * 10, inner, { color, align: "center" });
}
