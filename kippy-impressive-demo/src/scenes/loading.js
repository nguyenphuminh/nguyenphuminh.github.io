import { Scene } from "kippy";

// Shown while every sound is synthesized: just a thin progress line
export class LoadingScene extends Scene {
    progress = 0;

    render() {
        const ctx = this.game.ctx;
        const { width: W, height: H } = this.game.canvas;
        const u = H / 900;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#02050a";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(120, 230, 255, 0.15)";
        ctx.fillRect(W / 2 - 120 * u, H / 2, 240 * u, 2 * u);
        ctx.fillStyle = "rgba(160, 245, 255, 0.9)";
        ctx.fillRect(W / 2 - 120 * u, H / 2, 240 * u * this.progress, 2 * u);
    }
}
