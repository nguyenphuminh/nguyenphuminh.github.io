import { makeCanvas } from "../../core/paint.js";
import { createRng } from "../../core/rng.js";
import { TAU } from "../../core/math.js";

const PALETTES = {
    dead: { stem: ["#26313b", "#3b4752"], tip: "#59656f", core: null },
    lit: { stem: ["#d9734f", "#ffd08a"], tip: "#fff4c8", core: null },
    sealed: { stem: ["#2a1830", "#4a2a50"], tip: "#7a3a6a", core: "#5a1f4a" },
    heart: { stem: ["#e0607a", "#ffd7a0"], tip: "#fff6dc", core: "#ffe9c0" }
};

// Branching coral, grown upward for beacons and radially for the Heart.
// Dead and lit versions share one seed so the shape is identical.
function grow(g, rng, size, radial, pal) {
    const branch = (x, y, angle, len, width, depth) => {
        const x2 = x + Math.cos(angle) * len;
        const y2 = y + Math.sin(angle) * len;
        const bend = rng.range(-0.35, 0.35) * len;
        const grad = g.createLinearGradient(x, y, x2, y2);
        grad.addColorStop(0, pal.stem[0]);
        grad.addColorStop(1, pal.stem[1]);
        g.strokeStyle = grad;
        g.lineWidth = width;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo((x + x2) / 2 - Math.sin(angle) * bend, (y + y2) / 2 + Math.cos(angle) * bend, x2, y2);
        g.stroke();
        if (depth <= 0 || len < 6) {
            g.fillStyle = pal.tip;
            g.beginPath();
            g.arc(x2, y2, width * 0.8 + 1.2, 0, TAU);
            g.fill();
            return;
        }
        const n = rng.int(2, 3);
        for (let k = 0; k < n; k++) branch(x2, y2, angle + rng.range(-0.65, 0.65), len * rng.range(0.62, 0.8), width * 0.7, depth - 1);
    };

    const c = size / 2;
    if (radial) {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU + rng.range(-0.2, 0.2);
            branch(c + Math.cos(a) * size * 0.08, c + Math.sin(a) * size * 0.08, a, size * 0.15, 8, 4);
        }
    } else {
        g.fillStyle = pal.stem[0];
        g.beginPath();
        g.ellipse(c, size * 0.86, size * 0.26, size * 0.08, 0, 0, TAU);
        g.fill();
        for (let k = 0; k < 5; k++) {
            branch(c + (k - 2) * size * 0.08, size * 0.84, -Math.PI / 2 + (k - 2) * 0.28 + rng.range(-0.15, 0.15), size * 0.2, 7, 4);
        }
    }

    if (pal.core) {
        const grad = g.createRadialGradient(c, c, 0, c, c, size * 0.14);
        grad.addColorStop(0, pal.core);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(c, c, size * 0.14, 0, TAU);
        g.fill();
    }
}

export function makeCoral(seed, heart) {
    const reach = heart ? 260 : 170;
    const size = Math.round(reach * 1.5); // room for branch tips that overshoot
    const paint = (pal) => {
        const canvas = makeCanvas(size, size);
        const g = canvas.getContext("2d");
        g.translate((size - reach) / 2, (size - reach) / 2);
        grow(g, createRng(seed), reach, heart, pal);
        return canvas;
    };
    return {
        size,
        dead: paint(heart ? PALETTES.sealed : PALETTES.dead),
        lit: paint(heart ? PALETTES.heart : PALETTES.lit)
    };
}
