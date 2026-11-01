import { lineOfSight } from "../level/field.js";
import { damp, TAU } from "../../core/math.js";

// Inside this fraction of a noise's reach it is heard even through rock
export const MUFFLED = 0.6;

// Every sound in the world that a Listener could hear goes through here
export function createNoise(world) {
    const pulses = [];
    let steady = 0;
    let steadyShown = 0;

    function emit(x, y, radius, source, { ring = false } = {}) {
        world.events.emit("noise", { x, y, radius, source });
        if (ring) pulses.push({ x, y, radius, t: world.time });
    }

    // Continuous noise of the player's swimming, drawn as a steady faint ring
    function setSteady(radius) {
        steady = radius;
    }

    function heard(n, x, y) {
        const d = Math.hypot(x - n.x, y - n.y);
        if (d > n.radius) return false;
        return d <= n.radius * MUFFLED || lineOfSight(world.level, n.x, n.y, x, y);
    }

    function update(dt) {
        steadyShown = damp(steadyShown, steady, 10, dt);
        while (pulses.length && world.time - pulses[0].t > 0.9) pulses.shift();
    }

    function renderOver(ctx) {
        const p = world.player.entity.position;
        ctx.lineWidth = 1.5;
        if (steadyShown > 4) {
            ctx.strokeStyle = "rgba(220, 240, 255, 0.13)";
            ctx.setLineDash([3, 9]);
            ctx.beginPath();
            ctx.arc(p.x, p.y, steadyShown, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        for (const n of pulses) {
            const age = (world.time - n.t) / 0.9;
            const r = n.radius * Math.min(1, age / 0.35);
            ctx.strokeStyle = `rgba(230, 245, 255, ${0.28 * (1 - age)})`;
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, TAU);
            ctx.stroke();
        }
    }

    return { emit, setSteady, heard, update, renderOver };
}
