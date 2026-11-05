// Title screen and menu (BRD 2.2.0).
import { drawText } from "../../presentation/index.js";
import { WORLD, createWorldRenderer } from "../../world/index.js";
import { PixelScene } from "./base.js";
import { SpriteActor } from "../actors.js";
import { anyKeyPressed, menuInput } from "../input.js";
import { COLORS, drawControls, drawMenu, drawPanel, navigate, wrapText } from "../ui.js";

export class TitleScene extends PixelScene {
    init() {
        const app = this.app;
        this.renderer = createWorldRenderer(app.art);
        this.boss = new SpriteActor(app.art.boss, "dormant");
        this.boss.play("dormant");
        this.boss.position.x = 340;
        this.boss.position.y = WORLD.floorY;
        this.boss.flipX = true;
        this.boss.glowColor = COLORS.cyan;
        this.boss.glowBlur = 4;
        this.addEntity(this.boss);
        this.selected = 0;
        this.view = "menu"; // menu | controls | confirm
        this.confirmIndex = 0;
        this.fade = 1;
        this.fadeTo(0, 1.5);
    }

    items() {
        const continuing = this.app.memory.stats.attempts > 0;
        return [continuing ? "Continue" : "Begin", "Boss Memory", "Controls", "Forget Me"];
    }

    tick() {
        const app = this.app;
        if (anyKeyPressed(this.input)) app.startMusic();
        const menu = menuInput(this.input);

        if (this.view === "controls") {
            if (menu.back || menu.confirm) {
                app.audio.play("uiBack");
                this.view = "menu";
            }
            return;
        }
        if (this.view === "confirm") {
            this.confirmIndex = navigate(menu, this.confirmIndex, 2, app.audio);
            if (menu.back || (menu.confirm && this.confirmIndex === 0)) {
                app.audio.play("uiBack");
                this.view = "menu";
            } else if (menu.confirm && this.confirmIndex === 1) {
                app.forget();
                app.audio.play("uiSelect");
                this.view = "menu";
                this.selected = 0;
            }
            return;
        }

        this.selected = navigate(menu, this.selected, 4, app.audio);
        if (!menu.confirm) return;
        app.audio.play("uiSelect");
        if (this.selected === 0) app.go("world");
        else if (this.selected === 1) app.go("memory", { from: "title" });
        else if (this.selected === 2) this.view = "controls";
        else {
            this.view = "confirm";
            this.confirmIndex = 0;
        }
    }

    drawBackground(ctx) {
        this.renderer.drawBackground(ctx, this.time * 6);
    }

    drawWorldBack(ctx) {
        this.renderer.drawBack(ctx, this.camera.position.x, { sealed: false });
    }

    drawOverlay(ctx) {
        const app = this.app;
        drawText(ctx, "ADAPT", 240, 34, { align: "center", scale: 5, color: COLORS.text });
        drawText(ctx, "The Mirrorwright remembers.", 240, 72, { align: "center", color: COLORS.cyan });

        if (this.view === "controls") {
            drawPanel(ctx, 100, 92, 280, 140);
            drawText(ctx, "CONTROLS", 240, 100, { align: "center", color: COLORS.gold });
            drawControls(ctx, 122, 116);
            return;
        }
        if (this.view === "confirm") {
            drawPanel(ctx, 90, 100, 300, 92);
            drawText(ctx, "Forget everything?", 240, 110, { align: "center", color: COLORS.gold });
            wrapText("The Mirrorwright will lose all memory of you, and your progress will be wiped.", 270).forEach((line, i) => {
                drawText(ctx, line, 240, 126 + i * 11, { align: "center", color: COLORS.text });
            });
            drawMenu(ctx, ["No", "Yes, forget me"], this.confirmIndex, 200, 160);
            return;
        }

        drawMenu(ctx, this.items(), this.selected, 40, 120, { gap: 16 });
        const s = app.memory.stats;
        if (s.attempts > 0) {
            drawText(ctx, `Attempts ${s.attempts}   Deaths ${s.deaths}   Victories ${s.victories}`, 40, 196, { color: COLORS.dim });
        }
        if (!app.policy) {
            drawText(ctx, "Trained model not found: the boss will learn from scratch.", 240, 258, { align: "center", color: COLORS.red });
        } else {
            drawText(ctx, "W/S to choose, Enter to confirm", 240, 258, { align: "center", color: COLORS.dim });
        }
    }
}
