import { TAU } from "../../core/math.js";
import { worldToScreen } from "../../core/view.js";
import { SERIF, SANS } from "../story/captions.js";
import { MAX_LIGHTS } from "../player/player.js";
import { CARRY } from "../pearls/pearls.js";

const COLORS = { beacon: "255, 200, 140", heart: "255, 150, 180", rift: "170, 220, 255" };

function diamond(ctx, x, y, r, filled, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.7, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.7, y);
    ctx.closePath();
    if (filled) {
        ctx.fillStyle = `rgba(${color}, 0.95)`;
        ctx.shadowColor = `rgba(${color}, 0.9)`;
        ctx.shadowBlur = r;
        ctx.fill();
        ctx.shadowBlur = 0;
    } else {
        ctx.strokeStyle = `rgba(${color}, 0.45)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }
}

// Screen-space interface: status, pointers to known goals, map markers, pause/death/ending panels
export function createHud(world) {
    function status(ctx, canvas, u) {
        const depth = world.level.depth;
        const p = world.player.state;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(190, 214, 224, 0.7)";
        ctx.font = `${Math.round(13 * u)}px ${SANS}`;
        ctx.fillText(`Depth ${depth.numeral}`, 28 * u, 32 * u);
        ctx.font = `${Math.round(18 * u)}px ${SERIF}`;
        ctx.fillStyle = "rgba(230, 240, 245, 0.85)";
        ctx.fillText(depth.name, 28 * u, 54 * u);

        world.beacons.all.forEach((B, k) => {
            const x = 34 * u + k * 22 * u;
            if (B.heart) diamond(ctx, x + 4 * u, 82 * u, 10 * u, B.lit, B.sealed ? "170, 110, 170" : COLORS.heart);
            else diamond(ctx, x, 82 * u, 7 * u, B.lit, COLORS.beacon);
        });

        const H = canvas.height;
        for (let k = 0; k < MAX_LIGHTS; k++) diamond(ctx, 34 * u + k * 24 * u, H - 40 * u, 9 * u, k < p.lights, "130, 235, 255");
        for (let k = 0; k < CARRY; k++) {
            ctx.beginPath();
            ctx.arc(34 * u + (MAX_LIGHTS * 24 + 14 + k * 18) * u, H - 40 * u, 5 * u, 0, TAU);
            if (k < p.pearls) {
                ctx.fillStyle = "rgba(230, 230, 255, 0.95)";
                ctx.fill();
            } else {
                ctx.strokeStyle = "rgba(230, 230, 255, 0.35)";
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
        }
    }

    // Chevrons at the screen edge toward known goals that are off screen
    function pointers(ctx, canvas, u) {
        const W = canvas.width;
        const H = canvas.height;
        const m = 46 * u;
        for (const t of world.beacons.targets()) {
            const s = worldToScreen(world.camera, canvas, t.x, t.y);
            if (s.x > m && s.x < W - m && s.y > m && s.y < H - m) continue;
            const dx = s.x - W / 2;
            const dy = s.y - H / 2;
            const k = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
            const x = W / 2 + dx * k;
            const y = H / 2 + dy * k;
            const a = Math.atan2(dy, dx);
            const pulse = 0.6 + 0.4 * Math.sin(world.time * 3);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a);
            ctx.strokeStyle = `rgba(${COLORS[t.kind]}, ${0.5 + 0.4 * pulse})`;
            ctx.lineWidth = 2.2 * u;
            ctx.beginPath();
            ctx.moveTo(-6 * u, -9 * u);
            ctx.lineTo(4 * u, 0);
            ctx.lineTo(-6 * u, 9 * u);
            ctx.stroke();
            ctx.restore();
        }
    }

    function mapMarkers(ctx, canvas, u, alpha) {
        ctx.globalAlpha = alpha;
        const pp = world.player.entity.position;
        const s = worldToScreen(world.camera, canvas, pp.x, pp.y);
        const pulse = 0.5 + 0.5 * Math.sin(world.time * 5);
        ctx.fillStyle = "rgba(160, 245, 255, 1)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, (4 + pulse * 2) * u, 0, TAU);
        ctx.fill();
        for (const B of world.beacons.all) {
            if (!B.discovered && !B.lit) continue;
            const b = worldToScreen(world.camera, canvas, B.x, B.y);
            diamond(ctx, b.x, b.y, (B.heart ? 11 : 8) * u, B.lit, B.heart ? COLORS.heart : COLORS.beacon);
        }
        const r = world.beacons.rift;
        if (r?.open) {
            const b = worldToScreen(world.camera, canvas, r.x, r.y);
            diamond(ctx, b.x, b.y, 9 * u, true, COLORS.rift);
        }
        ctx.globalAlpha = 1;
    }

    // Dimmed backdrop with a heading; menus are drawn on top by the scene
    function panel(ctx, canvas, title, alpha = 1, y = 0.3) {
        const u = canvas.height / 900;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(2, 6, 12, 0.76)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(235, 245, 250, 0.95)";
        ctx.font = `${Math.round(40 * u)}px ${SERIF}`;
        ctx.fillText(title, canvas.width / 2, canvas.height * y);
        ctx.restore();
    }

    function render(ctx, canvas, { map = 0 } = {}) {
        const u = canvas.height / 900;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (map < 0.5) {
            status(ctx, canvas, u);
            if (!world.peaceful) pointers(ctx, canvas, u);
        }
        if (map > 0.05) mapMarkers(ctx, canvas, u, map);
        ctx.restore();
    }

    function renderStats(ctx, canvas, stats, alpha) {
        const u = canvas.height / 900;
        const W = canvas.width;
        const H = canvas.height;
        const minutes = Math.floor(stats.time / 60);
        const seconds = String(Math.floor(stats.time % 60)).padStart(2, "0");
        const rows = [
            ["Time in the trench", `${minutes}:${seconds}`],
            ["Songs sung", stats.songs],
            ["Times hunted", stats.heard],
            ["Lights lost", stats.lightsLost],
            ["Pearls thrown", stats.pearlsThrown]
        ];
        panel(ctx, canvas, "Abyssal Choir", alpha, 0.24);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.font = `${Math.round(17 * u)}px ${SANS}`;
        ctx.textBaseline = "middle";
        rows.forEach(([label, value], i) => {
            const y = H * 0.36 + i * 34 * u;
            ctx.textAlign = "left";
            ctx.fillStyle = "rgba(185, 208, 218, 0.75)";
            ctx.fillText(label, W / 2 - 170 * u, y);
            ctx.textAlign = "right";
            ctx.fillStyle = "rgba(235, 245, 250, 0.95)";
            ctx.fillText(String(value), W / 2 + 170 * u, y);
        });
        ctx.restore();
    }

    return { render, panel, renderStats };
}
