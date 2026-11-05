// Boss memory screen (BRD 2.2.7): what the boss has learned about the player, in plain words.
import { drawText } from "../../presentation/index.js";
import { habitLines, preferenceChanges } from "../../brain/index.js";
import { PixelScene } from "./base.js";
import { menuInput } from "../input.js";
import { COLORS, drawMenu, drawPanel, navigate, wrapText } from "../ui.js";

export class MemoryScene extends PixelScene {
    constructor(app, params = {}) {
        super(app);
        this.afterVictory = params.from === "victory";
    }

    init() {
        const brain = this.app.brain;
        this.lines = habitLines(brain.habits).slice(0, 5);
        this.changes = preferenceChanges(brain.preferences(true), brain.preferences(false), 5);
        this.items = this.afterVictory ? ["Re-challenge", "Title"] : ["Back"];
        this.selected = 0;
        this.fade = 1;
        this.fadeTo(0, 2);
    }

    tick() {
        const app = this.app;
        if (this.time < 0.6) return; // a key pressed to skip the victory card must not pick a menu item here
        const menu = menuInput(this.input);
        this.selected = navigate(menu, this.selected, this.items.length, app.audio);
        if (menu.back && !this.afterVictory) {
            app.audio.play("uiBack");
            app.go("title");
            return;
        }
        if (!menu.confirm) return;
        app.audio.play("uiSelect");
        if (this.afterVictory && this.selected === 0) app.go("world");
        else app.go("title");
    }

    drawOverlay(ctx) {
        const s = this.app.memory.stats;
        drawText(ctx, "WHAT THE MIRRORWRIGHT KNOWS", 240, 14, { align: "center", scale: 2, color: COLORS.cyan });

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
        drawText(ctx, "Its choices against you", 280, 48, { color: COLORS.gold });
        drawText(ctx, "before", 380, 62, { color: COLORS.dim });
        drawText(ctx, "now", 430, 62, { color: COLORS.cyan });
        this.changes.forEach((c, i) => {
            const rowY = 78 + i * 28;
            drawText(ctx, c.label, 280, rowY, { color: COLORS.text });
            const scale = 60;
            ctx.fillStyle = "#4a4366";
            ctx.fillRect(280, rowY + 11, Math.max(1, Math.round(c.before * scale * 2.5)), 3);
            ctx.fillStyle = COLORS.cyan;
            ctx.fillRect(280, rowY + 16, Math.max(1, Math.round(c.now * scale * 2.5)), 3);
            drawText(ctx, `${Math.round(c.before * 100)}%`, 380, rowY + 10, { color: COLORS.dim });
            drawText(ctx, `${Math.round(c.now * 100)}%`, 430, rowY + 10, { color: COLORS.cyan });
        });

        drawText(ctx, `Attempts ${s.attempts}   Deaths ${s.deaths}   Victories ${s.victories}`, 12, 234, { color: COLORS.dim });
        drawMenu(ctx, this.items, this.selected, 468, 234, { align: "right", gap: 12 });
    }
}
