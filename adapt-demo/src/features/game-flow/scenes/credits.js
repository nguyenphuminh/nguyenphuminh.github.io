// Credits (BRD 2.2.12.5): over the dawn-lit Keep, then the journey's numbers; any key after a moment returns to the title.
import { ENEMIES, BOSS_IDS } from "../../combat/index.js";
import { drawText } from "../../presentation/index.js";
import { PixelScene } from "./base.js";
import { anyKeyPressed } from "../input.js";
import { COLORS, formatTime } from "../ui.js";

const SCROLL_SPEED = 18; // px per second

export class CreditsScene extends PixelScene {
    init() {
        const j = this.app.memory.journey;
        this.lines = [
            ["ADAPT", 3, COLORS.text],
            ["", 1],
            ["The Silvered Keep is quiet.", 1, COLORS.cyan],
            ["Every reflection in it has shattered.", 1, COLORS.cyan],
            ["", 1], ["", 1],
            ["Built with", 1, COLORS.dim],
            ["Kippy, a 2D game engine", 1, COLORS.text],
            ["Catniff, a deep learning framework", 1, COLORS.text],
            ["", 1], ["", 1],
            ["YOUR JOURNEY", 2, COLORS.gold],
            ["", 1],
            [`Time in the Keep   ${formatTime(j.time)}`, 1, COLORS.text],
            [`Falls   ${j.falls}`, 1, COLORS.text],
            ...BOSS_IDS.map((id) => [`${ENEMIES[id].name}   ${j.attempts[id] ?? 0} attempt${(j.attempts[id] ?? 0) === 1 ? "" : "s"}`, 1, COLORS.text]),
            ["", 1], ["", 1],
            ["The Mirror forgets. You remember.", 1, COLORS.cyan],
            ["", 1], ["", 1],
            ["Thank you for playing.", 2, COLORS.gold],
        ];
        this.height = this.lines.reduce((sum, [, scale]) => sum + 12 * scale + 2, 0);
        this.fade = 1;
        this.fadeTo(0, 1);
        this.app.playMusic("ending");
    }

    tick() {
        const done = this.scrollY() < -this.height - 20;
        if ((this.time > 4 && anyKeyPressed(this.input)) || done) {
            if (this.fadeTarget !== 1) this.fadeTo(1, 1.5);
        }
        if (this.fadeTarget === 1 && this.fade >= 1) this.app.go("title");
    }

    scrollY() {
        return 280 - this.time * SCROLL_SPEED;
    }

    drawOverlay(ctx) {
        const bg = this.app.art.backgrounds?.dawnBackdrop;
        if (bg) ctx.drawImage(bg, 0, 0);
        ctx.fillStyle = "rgba(8, 6, 16, 0.55)";
        ctx.fillRect(0, 0, 480, 270);
        let y = this.scrollY();
        for (const [text, scale, color] of this.lines) {
            if (text && y > -30 && y < 280) drawText(ctx, text, 240, Math.round(y), { align: "center", scale, color });
            y += 12 * scale + 2;
        }
        if (this.time > 4) drawText(ctx, "Press any key", 470, 258, { align: "right", color: COLORS.dim });
    }
}
