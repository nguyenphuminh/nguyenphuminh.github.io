import { createRng } from "./rng.js";

export function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
}

// Soft round glow sprite in one color, cached
const glows = new Map();
export function glowSprite(color) {
    let s = glows.get(color);
    if (!s) {
        s = makeCanvas(64, 64);
        const g = s.getContext("2d");
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, color);
        grad.addColorStop(0.25, color.replace(/[\d.]+\)$/, "0.45)"));
        grad.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        glows.set(color, s);
    }
    return s;
}

// Tileable grayscale value noise, a few octaves, drawn into a canvas
export function noiseCanvas(size, seed, octaves = 4, dark = [6, 12, 18], light = [40, 58, 70]) {
    const rng = createRng(seed);
    const c = makeCanvas(size, size);
    const g = c.getContext("2d");
    const img = g.createImageData(size, size);
    const acc = new Float32Array(size * size);
    let amp = 1;
    let total = 0;

    for (let o = 0; o < octaves; o++) {
        const n = 4 << o;
        const grid = Array.from({ length: n * n }, () => rng.next());
        const at = (x, y) => grid[(y % n) * n + (x % n)];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const gx = (x / size) * n;
                const gy = (y / size) * n;
                const ix = Math.floor(gx);
                const iy = Math.floor(gy);
                const fx = (gx - ix) * (gx - ix) * (3 - 2 * (gx - ix));
                const fy = (gy - iy) * (gy - iy) * (3 - 2 * (gy - iy));
                const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * fx;
                const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * fx;
                acc[y * size + x] += (top + (bottom - top) * fy) * amp;
            }
        }
        total += amp;
        amp *= 0.5;
    }

    for (let i = 0; i < acc.length; i++) {
        const v = acc[i] / total;
        img.data[i * 4] = dark[0] + (light[0] - dark[0]) * v;
        img.data[i * 4 + 1] = dark[1] + (light[1] - dark[1]) * v;
        img.data[i * 4 + 2] = dark[2] + (light[2] - dark[2]) * v;
        img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}

export const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
