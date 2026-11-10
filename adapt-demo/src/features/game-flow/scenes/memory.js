// Boss memory screen (BRD 2.2.7): what the bosses have learned, in plain words; one tab per boss met.
import { drawText } from "../../presentation/index.js";
import { BOSS_IDS, ENEMIES } from "../../combat/index.js";
import { habitLines, preferenceChanges } from "../../brain/index.js";
import { AREAS } from "../../world/index.js";
import { PixelScene } from "./base.js";
import { menuInput } from "../input.js";
import { COLORS, drawMenu, drawPanel, navigate, wrapText } from "../ui.js";

export class MemoryScene extends PixelScene {
    constructor(app, params = {}) {
        super(app);
        this.afterVictory = params.from === "victory";
        this.focusBoss = params.bossId ?? null;
    }

    init() {
        const app = this.app;
        this.bosses = BOSS_IDS.filter((id) => (app.memory.bosses[id]?.attempts ?? 0) > 0 || id === this.focusBoss);
        this.tab = Math.max(0, this.bosses.indexOf(this.focusBoss));
        this.lines = habitLines(app.habits).slice(0, 5);
        this.changes = {};
        for (const id of this.bosses) {
            const brain = app.brains[id];
            this.changes[id] = preferenceChanges(brain.preferences(true), brain.preferences(false), ENEMIES[id], 5);
        }
        if (this.afterVictory) {
            // After a victory the journey has moved on to the next area, or (after the last boss) to the ending.
            const j = app.memory.journey;
            const advanced = j.awaitingEnding || j.area !== this.areaOfBoss(this.focusBoss);
            this.items = [advanced ? "Continue" : "Return to Title"];
        } else {
            this.items = ["Back"];
        }
        this.selected = 0;
        this.fade = 1;
        this.fadeTo(0, 2);
    }

    areaOfBoss(bossId) {
        return Object.values(AREAS).find((a) => a.bossId === bossId)?.id;
    }

    tick() {
        const app = this.app;
        if (this.time < 0.6) return; // a key pressed to skip the victory card must not pick a menu item here
        const menu = menuInput(this.input, this.pad);
        if (this.bosses.length > 1 && (menu.left || menu.right)) {
            this.tab = (this.tab + (menu.right ? 1 : this.bosses.length - 1)) % this.bosses.length;
            app.audio.play("uiMove");
        }
        this.selected = navigate(menu, this.selected, this.items.length, app.audio);
        if (menu.back && !this.afterVictory) {
            app.audio.play("uiBack");
            app.go("title");
            return;
        }
        if (!menu.confirm) return;
        app.audio.play("uiSelect");
        if (this.items[this.selected] === "Continue") app.continueJourney();
        else app.go("title");
    }

    drawOverlay(ctx) {
        const app = this.app;
        drawText(ctx, "WHAT THE REFLECTIONS KNOW", 240, 12, { align: "center", scale: 2, color: COLORS.cyan });

        drawPanel(ctx, 12, 40, 250, 186);
        drawText(ctx, "Your habits", 22, 48, { color: COLORS.gold });
        let y = 64;
        for (const line of this.lines) {
            for (const part of wrapText(`"${line.text}"`, 228)) {
                if (y > 214) break;
                drawText(ctx, part, 22, y, { color: COLORS.text });
                y += 10;
            }
            y += 6;
        }

        drawPanel(ctx, 270, 40, 198, 186);
        if (this.bosses.length === 0) {
            wrapText("You have not faced a reflection yet.", 178).forEach((l, i) => drawText(ctx, l, 280, 60 + i * 11, { color: COLORS.dim }));
        } else {
            const id = this.bosses[this.tab];
            const tabs = this.bosses.length > 1 ? "< A / D >" : "";
            drawText(ctx, ENEMIES[id].name, 280, 48, { color: COLORS.gold });
            if (tabs) drawText(ctx, tabs, 460, 48, { align: "right", color: COLORS.dim });
            drawText(ctx, "before", 380, 62, { color: COLORS.dim });
            drawText(ctx, "now", 430, 62, { color: COLORS.cyan });
            this.changes[id].forEach((c, i) => {
                const rowY = 78 + i * 26;
                drawText(ctx, c.label, 280, rowY, { color: COLORS.text });
                ctx.fillStyle = "#4a4366";
                ctx.fillRect(280, rowY + 11, Math.max(1, Math.round(c.before * 150)), 3);
                ctx.fillStyle = COLORS.cyan;
                ctx.fillRect(280, rowY + 16, Math.max(1, Math.round(c.now * 150)), 3);
                drawText(ctx, `${Math.round(c.before * 100)}%`, 380, rowY + 10, { color: COLORS.dim });
                drawText(ctx, `${Math.round(c.now * 100)}%`, 430, rowY + 10, { color: COLORS.cyan });
            });
            const r = app.memory.bosses[id] ?? { attempts: 0, victories: 0 };
            drawText(ctx, `Attempts ${r.attempts}   Victories ${r.victories}`, 280, 212, { color: COLORS.dim });
        }

        drawText(ctx, `Falls in the Keep ${app.memory.stats.falls}`, 12, 234, { color: COLORS.dim });
        drawMenu(ctx, this.items, this.selected, 468, 234, { align: "right", gap: 12 });
    }
}
