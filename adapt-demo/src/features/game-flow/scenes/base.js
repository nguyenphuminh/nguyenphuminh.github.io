// Base scene: layered rendering on top of Kippy's Scene/Camera, plus screen shake and fades.
import { Scene } from "kippy";
import { VIEW_HEIGHT, VIEW_WIDTH } from "../../world/index.js";

export class PixelScene extends Scene {
    constructor(app) {
        super();
        this.app = app;
        this.time = 0;
        this.shakeTime = 0;
        this.shakePower = 0;
        this.fade = 0; // 0 = clear, 1 = black
        this.fadeTarget = 0;
        this.fadeSpeed = 2;
    }

    get input() {
        return this.game.input;
    }

    shake(power, duration = 0.25) {
        if (power >= this.shakePower || this.shakeTime <= 0) {
            this.shakePower = power;
            this.shakeTime = duration;
        }
    }

    fadeTo(target, speed = 2) {
        this.fadeTarget = target;
        this.fadeSpeed = speed;
    }

    update(dt) {
        this.time += dt;
        this.shakeTime = Math.max(0, this.shakeTime - dt);
        if (this.fade !== this.fadeTarget) {
            const step = this.fadeSpeed * dt;
            this.fade = this.fade < this.fadeTarget ? Math.min(this.fadeTarget, this.fade + step) : Math.max(this.fadeTarget, this.fade - step);
        }
        this.tick(dt);
    }

    // Scene hooks.
    tick() {}
    drawBackground() {}
    drawWorldBack() {}
    drawWorldFront() {}
    drawOverlay() {}

    render() {
        const ctx = this.game.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#07060c";
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

        const cam = this.camera.position;
        const baseX = cam.x;
        const baseY = cam.y;
        if (this.shakeTime > 0) {
            const k = this.shakePower * (this.shakeTime > 0.1 ? 1 : this.shakeTime / 0.1);
            cam.x = Math.round(baseX + (Math.random() * 2 - 1) * k);
            cam.y = Math.round(baseY + (Math.random() * 2 - 1) * k);
        }

        this.drawBackground(ctx);
        ctx.save();
        this.camera.apply();
        this.drawWorldBack(ctx);
        const ordered = this.entities.slice().sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
        for (const entity of ordered) entity.render(ctx);
        this.drawWorldFront(ctx);
        ctx.restore();
        cam.x = baseX;
        cam.y = baseY;

        this.drawOverlay(ctx);
        if (this.fade > 0) {
            ctx.globalAlpha = this.fade;
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
            ctx.globalAlpha = 1;
        }
    }
}
