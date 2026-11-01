import { SpriteSheet, Animation, Animator } from "kippy";
import { makeCanvas } from "../../core/paint.js";
import { TAU } from "../../core/math.js";

const W = 72;
const H = 56;

// Listener head facing +x: blind milky eyes, a lure stalk, jaws opening across frames
export function makeListenerAnimator() {
    const jaws = [0, 0.06, 0.2, 0.28, 0.45, 0.58];
    const sheet = makeCanvas(W * jaws.length, H);
    const g = sheet.getContext("2d");

    jaws.forEach((open, f) => {
        g.save();
        g.translate(f * W + 26, H / 2);

        const skin = g.createLinearGradient(-20, -14, 20, 14);
        skin.addColorStop(0, "#5a1426");
        skin.addColorStop(1, "#22060e");

        // Lower jaw
        g.save();
        g.rotate(open);
        g.fillStyle = skin;
        g.beginPath();
        g.moveTo(-14, 2);
        g.quadraticCurveTo(10, 12, 32, 4);
        g.lineTo(30, 1);
        g.quadraticCurveTo(8, 5, -14, 0);
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(235, 230, 220, 0.9)";
        for (let k = 0; k < 6; k++) {
            const x = 2 + k * 4.6;
            g.beginPath();
            g.moveTo(x, 3.2);
            g.lineTo(x + 1.4, -2.5 - (k % 2) * 1.5);
            g.lineTo(x + 2.8, 3);
            g.fill();
        }
        g.restore();

        // Skull and upper jaw
        g.save();
        g.rotate(-open * 0.35);
        g.fillStyle = skin;
        g.beginPath();
        g.moveTo(-16, -10);
        g.quadraticCurveTo(6, -18, 32, -4);
        g.lineTo(32, 0);
        g.quadraticCurveTo(8, -1, -16, 4);
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(235, 230, 220, 0.9)";
        for (let k = 0; k < 6; k++) {
            const x = 4 + k * 4.4;
            g.beginPath();
            g.moveTo(x, -1);
            g.lineTo(x + 1.3, 4 + (k % 2) * 1.6);
            g.lineTo(x + 2.6, -1);
            g.fill();
        }
        // Ridges
        g.strokeStyle = "rgba(140, 40, 60, 0.6)";
        g.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
            g.beginPath();
            g.moveTo(-10 + k * 6, -11 + k);
            g.lineTo(-7 + k * 6, -6 + k);
            g.stroke();
        }
        // Blind eyes
        for (const [ex, ey, er] of [[6, -8, 3.2], [12, -9, 2.4]]) {
            const eye = g.createRadialGradient(ex - 0.8, ey - 0.8, 0, ex, ey, er);
            eye.addColorStop(0, "#f4fbff");
            eye.addColorStop(1, "#8fa6b4");
            g.fillStyle = eye;
            g.beginPath();
            g.arc(ex, ey, er, 0, TAU);
            g.fill();
        }
        // Lure stalk (the light itself is drawn live above the darkness)
        g.strokeStyle = "#3a0c18";
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(0, -13);
        g.quadraticCurveTo(14, -30, 30, -20);
        g.stroke();
        g.restore();

        g.restore();
    });

    const spriteSheet = new SpriteSheet({ texture: sheet, frameWidth: W, frameHeight: H });
    return new Animator({
        animations: {
            swim: new Animation({ spriteSheet, frames: [0, 1], fps: 2, loop: true }),
            hunt: new Animation({ spriteSheet, frames: [2, 3], fps: 6, loop: true }),
            bite: new Animation({ spriteSheet, frames: [4, 5, 5, 4, 2], fps: 12 })
        },
        default: "swim"
    });
}

// Where the lure tip sits relative to the head (frame space, facing +x)
export const LURE = { x: 30 - 10, y: -20 };
