import { SpriteSheet, Animation, Animator } from "kippy";
import { makeCanvas } from "../../core/paint.js";
import { TAU } from "../../core/math.js";

const F = 48;

// The Lantern: a bright core with orbiting flecks and a wagging tail (facing +x).
// Frames 0-7 swim, 8-11 are the bright "singing" flare.
export function makeLanternAnimator() {
    const frames = 12;
    const sheet = makeCanvas(F * frames, F);
    const g = sheet.getContext("2d");

    for (let f = 0; f < frames; f++) {
        const ph = ((f % 8) / 8) * TAU;
        const flare = f >= 8 ? 1 - Math.abs(f - 9.5) / 2.5 : 0;
        g.save();
        g.translate(f * F + F / 2, F / 2);

        const wag = Math.sin(ph) * 3;
        const tail = g.createLinearGradient(-23, 0, 2, 0);
        tail.addColorStop(0, "rgba(90, 220, 255, 0)");
        tail.addColorStop(1, "rgba(160, 245, 255, 0.6)");
        g.fillStyle = tail;
        g.beginPath();
        g.moveTo(2, -5);
        g.quadraticCurveTo(-10, -4 + wag, -23, wag * 1.7);
        g.quadraticCurveTo(-10, 4 + wag, 2, 5);
        g.closePath();
        g.fill();

        const halo = g.createRadialGradient(0, 0, 0, 0, 0, 17);
        halo.addColorStop(0, `rgba(210, 250, 255, ${0.45 + 0.45 * flare})`);
        halo.addColorStop(1, "rgba(120, 230, 255, 0)");
        g.fillStyle = halo;
        g.beginPath();
        g.arc(0, 0, 17, 0, TAU);
        g.fill();

        const r = 6 + 0.7 * Math.sin(ph * 2) + flare * 1.8;
        const core = g.createRadialGradient(-1.5, -1.5, 0, 0, 0, r);
        core.addColorStop(0, "#ffffff");
        core.addColorStop(0.6, "#c4f9ff");
        core.addColorStop(1, "#45d3ee");
        g.fillStyle = core;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fill();

        g.fillStyle = "rgba(255, 255, 255, 0.9)";
        for (let k = 0; k < 3; k++) {
            const a = ph + (k * TAU) / 3;
            g.beginPath();
            g.arc(Math.cos(a) * 3.3, Math.sin(a) * 3.3, 1, 0, TAU);
            g.fill();
        }
        g.restore();
    }

    const spriteSheet = new SpriteSheet({ texture: sheet, frameWidth: F, frameHeight: F, width: 40, height: 40 });
    return new Animator({
        animations: {
            swim: new Animation({ spriteSheet, frames: [0, 1, 2, 3, 4, 5, 6, 7], fps: 12, loop: true }),
            sing: new Animation({ spriteSheet, frames: [8, 9, 10, 11, 10, 9, 8], fps: 20 })
        },
        default: "swim"
    });
}
