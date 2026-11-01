import { makeCanvas } from "../../core/paint.js";
import { cameraCenter } from "../../core/view.js";

// Water gradient behind everything, drifting marine snow, light shafts, and the
// screen-space finish: vignette, film grain, hurt/danger tint and fades.
export function createBackdrop(water, { shafts = false } = {}) {
    const flakes = Array.from({ length: 170 }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: 0.25 + Math.random() * 0.75,
        phase: Math.random() * 6.28
    }));
    const grain = makeCanvas(128, 128);
    {
        const g = grain.getContext("2d");
        const img = g.createImageData(128, 128);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.random() * 255;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
    }
    let vignette = null;
    let grainPattern = null;

    function renderBack(ctx, canvas) {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, water[0]);
        grad.addColorStop(1, water[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Snow lives in screen space with parallax against the camera
    function renderSnow(ctx, camera, canvas, time, alpha = 1) {
        const z = camera.zoom;
        const c = cameraCenter(camera, canvas);
        const W = canvas.width;
        const H = canvas.height;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "lighter";
        for (const f of flakes) {
            const depth = f.z * Math.min(1, z);
            const sx = (((f.x * W - c.x * depth * z * 0.6 + Math.sin(time * 0.3 + f.phase) * 12) % W) + W) % W;
            const sy = (((f.y * H - c.y * depth * z * 0.6 + time * 9 * f.z * z) % H) + H) % H;
            const s = (0.7 + 1.6 * f.z) * Math.max(0.6, z);
            ctx.fillStyle = `rgba(170, 220, 235, ${((0.04 + 0.16 * f.z) * alpha).toFixed(3)})`;
            ctx.fillRect(sx, sy, s, s);
        }
        ctx.restore();
    }

    // Faint sunlight leaking down into the first depth (world space, top of the level)
    function renderShafts(ctx, time, width, alpha = 1) {
        if (!shafts || alpha <= 0.01) return;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 6; k++) {
            const x = ((k + 0.5) / 6) * width + Math.sin(time * 0.15 + k * 1.7) * 60;
            const w = 70 + 50 * Math.sin(k * 2.3);
            const a = (0.035 + 0.02 * Math.sin(time * 0.4 + k)) * alpha;
            const grad = ctx.createLinearGradient(x, 0, x + 260, 1300);
            grad.addColorStop(0, `rgba(150, 220, 230, ${a})`);
            grad.addColorStop(1, "rgba(150, 220, 230, 0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x - w, -50);
            ctx.lineTo(x + w, -50);
            ctx.lineTo(x + w + 300, 1300);
            ctx.lineTo(x - w + 200, 1300);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    function renderPost(ctx, canvas, { hurt = 0, danger = 0, fade = 0, time = 0 } = {}) {
        const W = canvas.width;
        const H = canvas.height;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (!vignette || vignette.width !== W || vignette.height !== H) {
            vignette = makeCanvas(W, H);
            const g = vignette.getContext("2d");
            const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55);
            grad.addColorStop(0, "rgba(0, 0, 0, 0)");
            grad.addColorStop(1, "rgba(0, 0, 0, 0.75)");
            g.fillStyle = grad;
            g.fillRect(0, 0, W, H);
        }
        ctx.drawImage(vignette, 0, 0);

        const red = Math.max(hurt, danger * (0.5 + 0.5 * Math.sin(time * 6)) * 0.35);
        if (red > 0.01) {
            const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.hypot(W, H) * 0.55);
            grad.addColorStop(0, "rgba(120, 0, 20, 0)");
            grad.addColorStop(1, `rgba(170, 10, 40, ${red * 0.6})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
        }

        if (!grainPattern) grainPattern = ctx.createPattern(grain, "repeat");
        ctx.globalAlpha = 0.05;
        ctx.globalCompositeOperation = "overlay";
        ctx.translate(Math.random() * 128, Math.random() * 128);
        ctx.fillStyle = grainPattern;
        ctx.fillRect(-128, -128, W + 128, H + 128);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";

        if (fade > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, fade)})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
    }

    return { renderBack, renderSnow, renderShafts, renderPost };
}
