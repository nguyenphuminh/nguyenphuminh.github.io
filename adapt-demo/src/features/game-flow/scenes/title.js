// Title screen and menu (BRD 2.2.0, 2.2.13).
import { drawText } from "../../presentation/index.js";
import { AREAS, createWorldRenderer } from "../../world/index.js";
import { BOSS_IDS } from "../../combat/index.js";
import { PixelScene } from "./base.js";
import { SpriteActor } from "../actors.js";
import { anyKeyPressed, menuInput } from "../input.js";
import { COLORS, drawMenu, drawPanel, navigate, wrapText } from "../ui.js";
import { createControlsPanel } from "../controls-panel.js";

const ART_KEY = { squire: "squire", mirrorwright: "boss", reflection: "reflection" };

export class TitleScene extends PixelScene {
    init() {
        const app = this.app;
        this.renderer = createWorldRenderer(app.art, AREAS.outerWard);
        const art = app.art[ART_KEY[app.nextBossId()]] ?? app.art.boss;
        this.silhouette = new SpriteActor(art, "dormant");
        this.silhouette.play(art.anims.dormant ? "dormant" : "idle");
        this.silhouette.position.x = 340;
        this.silhouette.position.y = AREAS.outerWard.floorY;
        this.silhouette.flipX = art === app.art.boss;
        this.silhouette.glowColor = COLORS.cyan;
        this.silhouette.glowBlur = 4;
        this.addEntity(this.silhouette);
        this.selected = 0;
        this.view = "menu"; // menu | controls | confirmForget | confirmJourney
        this.confirmIndex = 0;
        this.fade = 1;
        this.fadeTo(0, 1.5);
        if (app.musicStarted) app.playMusic("title"); // back from a journey or the credits
    }

    items() {
        const app = this.app;
        const items = [];
        if (app.journeyInProgress()) items.push(["Continue", "continue"], ["New Journey", "new"]);
        else items.push([app.memory.stats.journeysCompleted > 0 ? "Begin Again" : "Begin", "new"]);
        items.push(["Boss Memory", "memory"], ["Controls", "controls"], ["Forget Me", "forget"]);
        return items;
    }

    tick() {
        const app = this.app;
        if (anyKeyPressed(this.input, this.pad)) app.startMusic();
        const menu = menuInput(this.input, this.pad);

        if (this.view === "controls") {
            if (this.controlsPanel.tick(this.input)) this.view = "menu";
            return;
        }
        if (this.view === "confirmForget" || this.view === "confirmJourney") {
            this.confirmIndex = navigate(menu, this.confirmIndex, 2, app.audio);
            if (menu.back || (menu.confirm && this.confirmIndex === 0)) {
                app.audio.play("uiBack");
                this.view = "menu";
            } else if (menu.confirm && this.confirmIndex === 1) {
                app.audio.play("uiSelect");
                if (this.view === "confirmForget") {
                    app.forget();
                    this.view = "menu";
                    this.selected = 0;
                } else {
                    app.startJourney();
                }
            }
            return;
        }

        const items = this.items();
        this.selected = navigate(menu, Math.min(this.selected, items.length - 1), items.length, app.audio);
        if (!menu.confirm) return;
        app.audio.play("uiSelect");
        const action = items[this.selected][1];
        if (action === "continue") app.continueJourney();
        else if (action === "new") {
            if (app.journeyInProgress()) {
                this.view = "confirmJourney";
                this.confirmIndex = 0;
            } else app.startJourney();
        } else if (action === "memory") app.go("memory", { from: "title" });
        else if (action === "controls") {
            this.controlsPanel = createControlsPanel(app);
            this.view = "controls";
        }
        else {
            this.view = "confirmForget";
            this.confirmIndex = 0;
        }
    }

    drawBackground(ctx) {
        this.renderer.drawBackground(ctx, this.time * 6);
    }

    drawWorldBack(ctx) {
        this.renderer.drawBack(ctx, this.camera.position.x, { sealed: false });
    }

    drawConfirm(ctx, title, body, yes) {
        drawPanel(ctx, 90, 100, 300, 92);
        drawText(ctx, title, 240, 110, { align: "center", color: COLORS.gold });
        wrapText(body, 270).forEach((line, i) => drawText(ctx, line, 240, 126 + i * 11, { align: "center", color: COLORS.text }));
        drawMenu(ctx, ["No", yes], this.confirmIndex, 200, 160);
    }

    drawOverlay(ctx) {
        const app = this.app;
        drawText(ctx, "ADAPT", 240, 34, { align: "center", scale: 5, color: COLORS.text });
        drawText(ctx, "Every fall teaches them.", 240, 72, { align: "center", color: COLORS.cyan });

        if (this.view === "controls") {
            this.controlsPanel.draw(ctx, 82);
            return;
        }
        if (this.view === "confirmForget") {
            return this.drawConfirm(ctx, "Forget everything?", "Every reflection will lose all memory of you, and your progress will be wiped.", "Yes, forget me");
        }
        if (this.view === "confirmJourney") {
            return this.drawConfirm(ctx, "Start a new journey?", "Your progress resets, but the reflections keep everything they learned about you.", "Yes, begin again");
        }

        drawMenu(ctx, this.items().map((i) => i[0]), this.selected, 40, 112, { gap: 15 });
        const j = app.memory.journey;
        if (app.journeyInProgress()) {
            drawText(ctx, `${AREAS[j.area].name}   Falls ${j.falls}`, 40, 196, { color: COLORS.dim });
        }
        if (BOSS_IDS.some((id) => !app.policies[id])) {
            drawText(ctx, "A trained model is missing: that boss will learn from scratch.", 240, 258, { align: "center", color: COLORS.red });
        } else {
            const hint = app.lastDevice === "pad" ? `D-pad to choose, ${app.hint("confirm")} to confirm` : "W/S to choose, Enter to confirm";
            drawText(ctx, hint, 240, 258, { align: "center", color: COLORS.dim });
        }
    }
}
