// Tiny pixel rasterizer: shapes are filled per pixel center with no antialiasing,
// shaded with a 3-tone ramp, optionally separated from what is behind them, then outlined.

// Packs a "#rrggbb" color into the little-endian ABGR layout of ImageData's Uint32 view.
export function rgba(hex, a = 255) {
    const n = parseInt(hex.slice(1), 16);
    return ((a << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}

export function ramp(hi, mid, lo) {
    return { hi: rgba(hi), mid: rgba(mid), lo: rgba(lo) };
}

export function makeCanvas(w, h) {
    if (typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
    }
    return new OffscreenCanvas(w, h);
}

// Deterministic hash noise in [0, 1).
export function hash2(x, y, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export class Px {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.data = new Uint32Array(w * h);
    }

    get(x, y) {
        return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.data[y * this.w + x];
    }

    set(x, y, c) {
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c;
    }

    clear() {
        this.data.fill(0);
    }
}

// ---------- Shapes: { x0, y0, x1, y1, test(x, y) } with pixel-center coordinates ----------

export function capsule(ax, ay, bx, by, ra, rb = ra) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-6;
    const r = Math.max(ra, rb);
    return {
        x0: Math.floor(Math.min(ax, bx) - r - 1), y0: Math.floor(Math.min(ay, by) - r - 1),
        x1: Math.ceil(Math.max(ax, bx) + r + 1), y1: Math.ceil(Math.max(ay, by) + r + 1),
        test(x, y) {
            let t = ((x - ax) * dx + (y - ay) * dy) / len2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const px = ax + dx * t - x, py = ay + dy * t - y;
            const rr = ra + (rb - ra) * t;
            return px * px + py * py <= rr * rr;
        },
    };
}

export function poly(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
    }
    return {
        x0: Math.floor(x0 - 1), y0: Math.floor(y0 - 1), x1: Math.ceil(x1 + 1), y1: Math.ceil(y1 + 1),
        test(x, y) {
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const [xi, yi] = pts[i], [xj, yj] = pts[j];
                if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
            }
            return inside;
        },
    };
}

export function ellipse(cx, cy, rx, ry, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const r = Math.max(rx, ry);
    return {
        x0: Math.floor(cx - r - 1), y0: Math.floor(cy - r - 1), x1: Math.ceil(cx + r + 1), y1: Math.ceil(cy + r + 1),
        test(x, y) {
            const dx = x - cx, dy = y - cy;
            const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
            return u * u + v * v <= 1;
        },
    };
}

export function rect(x, y, w, h) {
    return {
        x0: Math.floor(x) - 1, y0: Math.floor(y) - 1, x1: Math.ceil(x + w) + 1, y1: Math.ceil(y + h) + 1,
        test: (px, py) => px >= x && px < x + w && py >= y && py < y + h,
    };
}

// ---------- Painting ----------

// Fills a shape with a 3-tone ramp: top edge highlighted, bottom/back edges shaded.
// sep: draws a 1px dark line on whatever already exists just outside the shape (part separation).
export function paint(px, shape, r, { sep = 0, flat = false, shade = "full" } = {}) {
    const x0 = Math.max(shape.x0, -1), y0 = Math.max(shape.y0, -1);
    const x1 = Math.min(shape.x1, px.w), y1 = Math.min(shape.y1, px.h);
    const mw = x1 - x0 + 3, mh = y1 - y0 + 3;
    if (mw <= 2 || mh <= 2) return;
    const mask = new Uint8Array(mw * mh);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            if (shape.test(x + 0.5, y + 0.5)) mask[(y - y0 + 1) * mw + (x - x0 + 1)] = 1;
        }
    }
    const m = (x, y) => mask[(y - y0 + 1) * mw + (x - x0 + 1)];
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            if (!m(x, y)) continue;
            let c = r.mid;
            if (!flat) {
                // Light comes from above and slightly in front (+x): top edges lit, bottom/back edges shaded.
                if (!m(x, y - 1)) c = r.hi;
                else if (!m(x, y + 1) || (shade === "full" && !m(x - 1, y))) c = r.lo;
            }
            px.set(x, y, c);
        }
    }
    if (sep) {
        for (let y = y0 - 1; y <= y1 + 1; y++) {
            for (let x = x0 - 1; x <= x1 + 1; x++) {
                if (m(x, y) || !px.get(x, y)) continue;
                if (m(x + 1, y) || m(x - 1, y) || m(x, y + 1) || m(x, y - 1)) px.set(x, y, sep);
            }
        }
    }
}

// Flat single-color fill, no shading.
export function fill(px, shape, color) {
    for (let y = Math.max(shape.y0, 0); y <= Math.min(shape.y1, px.h - 1); y++) {
        for (let x = Math.max(shape.x0, 0); x <= Math.min(shape.x1, px.w - 1); x++) {
            if (shape.test(x + 0.5, y + 0.5)) px.set(x, y, color);
        }
    }
}

// 1px Bresenham line.
export function line(px, x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        px.set(x0, y0, color);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

// Adds a 1px outline around every opaque region (4-neighbourhood).
export function outline(px, color) {
    const { w, h, data } = px;
    const src = data.slice();
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (src[i]) continue;
            if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) {
                data[i] = color;
            }
        }
    }
}

// Writes an array of Px frames into a sheet canvas (grid, `cols` wide).
export function framesToSheet(frames, fw, fh, cols, transform) {
    const rows = Math.ceil(frames.length / cols);
    const canvas = makeCanvas(fw * cols, fh * rows);
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(canvas.width, canvas.height);
    const out = new Uint32Array(img.data.buffer);
    frames.forEach((f, n) => {
        const ox = (n % cols) * fw, oy = Math.floor(n / cols) * fh;
        for (let y = 0; y < fh; y++) {
            for (let x = 0; x < fw; x++) {
                const c = f.data[y * fw + x];
                if (c) out[(oy + y) * canvas.width + ox + x] = transform ? transform(c) : c;
            }
        }
    });
    ctx.putImageData(img, 0, 0);
    return canvas;
}

// Converts a single Px into a canvas.
export function pxToCanvas(p) {
    return framesToSheet([p], p.w, p.h, 1);
}

// Linear interpolation of two pose objects (numbers only; other values taken from b when t >= .5).
export function lerpPose(a, b, t) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const va = a[k], vb = b[k];
        if (typeof va === "number" && typeof vb === "number") out[k] = va + (vb - va) * t;
        else out[k] = t < 0.5 ? (va ?? vb) : (vb ?? va);
    }
    return out;
}
