import { Entity, RigidBody, CircleCollider, SpriteSheet, Animation, Animator, Vector2 } from "kippy";
import { LAYER, MASK } from "../../core/layers.js";
import { TAU } from "../../core/math.js";
import { makeCanvas } from "../../core/paint.js";

const FW = 48;
const FH = 60;
const FRAMES = 8;

// Pulsing bell with drifting tentacles
function jellySheet() {
    const sheet = makeCanvas(FW * FRAMES, FH);
    const g = sheet.getContext("2d");
    for (let f = 0; f < FRAMES; f++) {
        const ph = (f / FRAMES) * TAU;
        const squash = Math.sin(ph);
        const w = 15 + squash * 2.5;
        const h = 12 - squash * 2;
        g.save();
        g.translate(f * FW + FW / 2, 20);

        g.strokeStyle = "rgba(220, 150, 255, 0.45)";
        g.lineWidth = 1.2;
        for (let k = 0; k < 5; k++) {
            const x0 = (k - 2) * 5;
            g.beginPath();
            g.moveTo(x0, 2);
            for (let s = 1; s <= 6; s++) g.lineTo(x0 + Math.sin(ph + s * 0.9 + k) * 2.5, 2 + s * 5.5);
            g.stroke();
        }

        const bell = g.createRadialGradient(0, -2, 1, 0, 0, w);
        bell.addColorStop(0, "rgba(255, 210, 255, 0.95)");
        bell.addColorStop(0.5, "rgba(200, 120, 255, 0.55)");
        bell.addColorStop(1, "rgba(140, 80, 220, 0.15)");
        g.fillStyle = bell;
        g.beginPath();
        g.ellipse(0, 0, w, h, 0, Math.PI, TAU);
        g.quadraticCurveTo(0, 5, -w, 0);
        g.fill();

        g.fillStyle = "rgba(255, 240, 255, 0.9)";
        g.beginPath();
        g.arc(0, -3, 2.2 + squash * 0.5, 0, TAU);
        g.fill();
        g.restore();
    }
    return sheet;
}

// Harmless glowing jellies: drifting lights the player can nudge around
export function createJellies(world) {
    const spriteSheet = new SpriteSheet({ texture: jellySheet(), frameWidth: FW, frameHeight: FH });
    const list = world.level.jellies.map((p, k) => {
        const animator = new Animator({
            animations: { pulse: new Animation({ spriteSheet, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 6 + (k % 3), loop: true }) },
            default: "pulse"
        });
        animator.frameIndex = k % FRAMES;
        const entity = new Entity({
            position: new Vector2(p.x, p.y),
            animator,
            body: new RigidBody({ mass: 0.4, restitution: 0.8, sleepThreshold: 0 }),
            collider: new CircleCollider({ radius: 12, layer: LAYER.JELLY, mask: MASK.JELLY })
        });
        entity.kind = "jelly";
        return { entity, phase: Math.random() * TAU };
    });

    function update(dt) {
        for (const J of list) {
            const b = J.entity.body;
            const t = world.time * 0.35 + J.phase;
            b.force.x += (Math.cos(t) * 14 - b.velocity.x) * 0.6 * b.mass;
            b.force.y += (Math.sin(t * 1.3) * 10 - b.velocity.y) * 0.6 * b.mass;
            J.entity.rotation = b.velocity.x * 0.004;
        }
    }

    function lights(out) {
        for (const J of list) {
            const { x, y } = J.entity.position;
            const pulse = 0.85 + 0.15 * Math.sin(world.time * 3 + J.phase);
            out.push({ x, y, r: 115 * pulse, i: 0.65, color: "rgba(190, 110, 255, 0.2)" });
        }
    }

    return { entities: list.map((J) => J.entity), positions: () => list.map((J) => J.entity.position), update, lights };
}
