// Queries against the smooth rock field. The 0.5 iso-line is the wall surface used
// for rendering, sonar echoes, lantern shadows and hearing through rock.
export const ISO = 0.5;

export function sampleField(level, x, y) {
    const gx = x / level.cell;
    const gy = y / level.cell;
    const i = Math.floor(gx);
    const j = Math.floor(gy);
    if (i < 0 || j < 0 || i >= level.cols || j >= level.rows) return 1;

    const W = level.cols + 1;
    const k = j * W + i;
    const f = level.field;
    const fx = gx - i;
    const fy = gy - j;
    const top = f[k] + (f[k + 1] - f[k]) * fx;
    const bottom = f[k + W] + (f[k + W + 1] - f[k + W]) * fx;
    return top + (bottom - top) * fy;
}

export const isRock = (level, x, y) => sampleField(level, x, y) >= ISO;

// Distance along a unit ray to the first rock surface, or -1 if none within maxDist
export function raycast(level, ox, oy, dx, dy, maxDist, step = 6) {
    let prev = 0;

    for (let d = step; ; d += step) {
        const dd = Math.min(d, maxDist);
        if (sampleField(level, ox + dx * dd, oy + dy * dd) >= ISO) {
            let lo = prev;
            let hi = dd;
            for (let k = 0; k < 5; k++) {
                const m = (lo + hi) / 2;
                if (sampleField(level, ox + dx * m, oy + dy * m) >= ISO) hi = m;
                else lo = m;
            }
            return hi;
        }
        prev = dd;
        if (dd >= maxDist) return -1;
    }
}

export function lineOfSight(level, ax, ay, bx, by) {
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1) return true;
    return raycast(level, ax, ay, (bx - ax) / len, (by - ay) / len, len, 8) < 0;
}

// Visibility polygon (flat x,y pairs) of a light, pushed slightly into rock so wall faces get lit
export function visibilityPolygon(level, x, y, radius, rays, push = 10) {
    const poly = new Float32Array(rays * 2);
    for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const hit = raycast(level, x, y, dx, dy, radius, 7);
        const d = hit < 0 ? radius : Math.min(radius, hit + push);
        poly[i * 2] = x + dx * d;
        poly[i * 2 + 1] = y + dy * d;
    }
    return poly;
}
