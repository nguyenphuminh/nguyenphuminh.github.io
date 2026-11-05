// Loading screen (BRD 2.2.0): prepares art, audio, the trained model and saved memory before anything else.
import { drawText } from "../../presentation/index.js";
import { PixelScene } from "./base.js";
import { COLORS } from "../ui.js";

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export class LoadingScene extends PixelScene {
    init() {
        this.progress = 0;
        this.status = "Preparing";
        this.error = null;
        this.run();
    }

    async run() {
        const steps = this.app.loadingSteps();
        try {
            for (let i = 0; i < steps.length; i++) {
                this.status = steps[i][0];
                await nextFrame();
                await steps[i][1]();
                this.progress = (i + 1) / steps.length;
            }
            await nextFrame();
            this.app.go("title");
        } catch (err) {
            console.error(err);
            this.error = String(err?.message ?? err);
        }
    }

    drawOverlay(ctx) {
        const w = 200;
        const x = 240 - w / 2;
        drawText(ctx, "ADAPT", 240, 100, { align: "center", scale: 3, color: COLORS.text });
        ctx.fillStyle = "#1b1828";
        ctx.fillRect(x, 140, w, 6);
        ctx.fillStyle = COLORS.cyan;
        ctx.fillRect(x, 140, Math.round(w * this.progress), 6);
        if (this.error) {
            drawText(ctx, "Something broke while loading:", 240, 160, { align: "center", color: COLORS.red });
            drawText(ctx, this.error.slice(0, 70), 240, 174, { align: "center", color: COLORS.dim });
        } else {
            drawText(ctx, `${this.status}...`, 240, 156, { align: "center", color: COLORS.dim });
        }
    }
}
