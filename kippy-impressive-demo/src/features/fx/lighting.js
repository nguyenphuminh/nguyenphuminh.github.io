import { makeCanvas } from "../../core/paint.js";
import { applyCamera } from "../../core/view.js";
import { TAU } from "../../core/math.js";

const SCALE = 0.5; // the darkness buffer is half resolution; upscaling softens shadow edges

// Darkness with holes cut by lights, then a tinted additive glow for colored lights.
// Lights: { x, y, r, i (0..1 strength), color?, poly? (shadow polygon, flat x,y pairs) }
export function createLighting() {
    const buffer = makeCanvas(2, 2);
    const g = buffer.getContext("2d");

    function shape(ctx, light) {
        ctx.beginPath();
        if (light.poly) {
            const p = light.poly;
            ctx.moveTo(p[0], p[1]);
            for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
            ctx.closePath();
        } else {
            ctx.arc(light.x, light.y, light.r, 0, TAU);
        }
    }

    function render(ctx, camera, canvas, lights, darkness) {
        const w = Math.ceil(canvas.width * SCALE);
        const h = Math.ceil(canvas.height * SCALE);
        if (buffer.width !== w || buffer.height !== h) {
            buffer.width = w;
            buffer.height = h;
        }

        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = "source-over";
        g.clearRect(0, 0, w, h);
        g.fillStyle = `rgba(1, 3, 8, ${darkness})`;
        g.fillRect(0, 0, w, h);

        g.globalCompositeOperation = "destination-out";
        applyCamera(g, camera, canvas, SCALE);
        for (const light of lights) {
            const grad = g.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r);
            grad.addColorStop(0, `rgba(0, 0, 0, ${light.i})`);
            grad.addColorStop(0.55, `rgba(0, 0, 0, ${light.i * 0.6})`);
            grad.addColorStop(1, "rgba(0, 0, 0, 0)");
            g.fillStyle = grad;
            shape(g, light);
            g.fill();
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        ctx.save();
        applyCamera(ctx, camera, canvas);
        ctx.globalCompositeOperation = "lighter";
        for (const light of lights) {
            if (!light.color) continue;
            const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r);
            grad.addColorStop(0, light.color);
            grad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = grad;
            shape(ctx, light);
            ctx.fill();
        }
        ctx.restore();
    }

    return { render };
}
