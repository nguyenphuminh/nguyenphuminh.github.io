import { Entity, BoxCollider, Vector2 } from "kippy";
import { LAYER, MASK } from "../../core/layers.js";
import { inBounds } from "../../core/view.js";

const PUSH = 420; // acceleration given to anything inside a current

// Currents along some tunnels: chains of Kippy trigger boxes that push every body inside
export function createCurrents(world) {
    const pieces = world.level.currents.flatMap((c) => c.pieces);
    const entities = pieces.map((p) => {
        const e = new Entity({
            position: new Vector2(p.x, p.y),
            collider: new BoxCollider({ width: p.size, height: p.size, isTrigger: true, layer: LAYER.ZONE, mask: MASK.CURRENT })
        });
        e.kind = "current";
        e.onTriggerStay = (other) => {
            const body = other.body;
            // Pieces overlap; only the first one touching a body pushes it this step
            if (!body || !isFinite(body.mass) || body.currentStep === world.step) return;
            body.currentStep = world.step;
            body.force.x += p.dx * PUSH * body.mass;
            body.force.y += p.dy * PUSH * body.mass;
        };
        return e;
    });

    // Streaks drifting with the flow, visible even in the dark
    function update(dt, view) {
        for (const p of pieces) {
            if (!inBounds(view, p.x, p.y, p.size) || Math.random() > dt * 5) continue;
            const ox = (Math.random() - 0.5) * p.size * 0.7;
            const oy = (Math.random() - 0.5) * p.size * 0.7;
            world.particles.spawn(p.x + ox, p.y + oy, p.dx * 160, p.dy * 160, 1.2, 3.5, "rgba(120, 220, 210, 0.35)", 0.3);
        }
    }

    return { entities, update };
}
