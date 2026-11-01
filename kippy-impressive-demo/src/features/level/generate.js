import { createRng } from "../../core/rng.js";
import { TAU, clamp } from "../../core/math.js";

export const CELL = 16;
const MARGIN = 5;

// Builds one depth of the trench: chambers joined by wobbly tunnels (plus a few loops),
// side nooks, pillars, smoothed walls, and the positions of everything that lives there.
export function generateLevel(depth, seed) {
    const rng = createRng(seed);
    const { cols, rows } = depth;
    const solid = new Uint8Array(cols * rows).fill(1);
    const at = (x, y) => y * cols + x;
    const inside = (x, y) => x >= MARGIN && y >= MARGIN && x < cols - MARGIN && y < rows - MARGIN;

    const disc = (cx, cy, r, value = 0) => {
        const r2 = r * r;
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
            for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
                if (inside(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r2) solid[at(x, y)] = value;
            }
        }
    };

    // Chambers and their roles
    const count = 1 + depth.beacons + 1 + depth.extraChambers;
    const chambers = placeChambers(rng, cols, rows, count);
    const spawn = argBest(chambers, (c) => -(c.x + c.y * 1.2));
    const goal = argBest(chambers, (c) => (c === spawn ? -1 : Math.hypot(c.x - spawn.x, c.y - spawn.y)));
    spawn.role = "spawn";
    goal.role = "goal";

    const chosen = [spawn, goal];
    for (let i = 0; i < depth.beacons; i++) {
        const next = argBest(chambers, (c) => (c.role ? -1 : Math.min(...chosen.map((o) => Math.hypot(c.x - o.x, c.y - o.y)))));
        next.role = "beacon";
        chosen.push(next);
    }
    for (const c of chambers) {
        if (!c.role) c.role = "extra";
        c.r = {
            spawn: 8,
            goal: depth.heart ? 14 : 12,
            beacon: rng.range(10, 12),
            extra: rng.range(6.5, 10)
        }[c.role];
    }

    // Tunnels: minimum spanning tree + a few short loops so there are escape routes
    const edges = spanningEdges(chambers);
    const extra = [];
    const avg = edges.reduce((s, e) => s + e.len, 0) / edges.length;
    for (let i = 0; i < chambers.length; i++) {
        for (let j = i + 1; j < chambers.length; j++) {
            if (edges.some((e) => (e.a === i && e.b === j) || (e.a === j && e.b === i))) continue;
            const len = Math.hypot(chambers[i].x - chambers[j].x, chambers[i].y - chambers[j].y);
            if (len < avg * 1.5) extra.push({ a: i, b: j, len });
        }
    }
    extra.sort((p, q) => p.len - q.len);
    edges.push(...extra.slice(0, depth.loops));

    const paths = edges.map((e) => tunnelPath(rng, chambers[e.a], chambers[e.b], cols, rows));

    for (const c of chambers) carveBlob(rng, c, disc);
    for (const path of paths) {
        for (const p of path) disc(p.x, p.y, p.r);
    }

    // Side nooks, where echo pearls hide
    const nooks = [];
    for (let i = 0; i < depth.pearls + 3; i++) {
        const path = rng.pick(paths);
        const k = Math.floor(rng.range(0.25, 0.75) * (path.length - 2)) + 1;
        const p = path[k];
        const q = path[k + 1];
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const side = rng.chance(0.5) ? 1 : -1;
        const nx = (-(q.y - p.y) / len) * side;
        const ny = ((q.x - p.x) / len) * side;
        const reach = p.r + rng.range(2.5, 4);
        const nook = {
            x: clamp(p.x + nx * reach, MARGIN + 3, cols - MARGIN - 3),
            y: clamp(p.y + ny * reach, MARGIN + 3, rows - MARGIN - 3),
            from: p
        };
        nooks.push(nook);
        carveLine(p, nook, 1.4, disc);
        disc(nook.x, nook.y, rng.range(1.8, 2.6));
    }

    // Pillars inside large chambers: cover, and sonar shadows
    for (const c of chambers) {
        const n = c.role === "goal" && depth.heart ? 3 : c.role === "beacon" ? rng.int(1, 2) : c.r > 7.5 && c.role === "extra" ? rng.int(0, 1) : 0;
        const a0 = rng.range(0, TAU);
        for (let i = 0; i < n; i++) {
            const a = a0 + (i / n) * TAU + rng.range(-0.3, 0.3);
            const d = c.r * rng.range(0.62, 0.74);
            disc(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, rng.range(1.3, 2), 1);
        }
    }

    for (let i = 0; i < 2; i++) smooth(solid, cols, rows);

    // Smoothing can pinch passages shut, so re-open every tunnel core and chamber heart
    for (const path of paths) {
        for (let i = 0; i < path.length; i += 2) disc(path[i].x, path[i].y, 2.3);
    }
    for (const c of chambers) disc(c.x, c.y, c.r * 0.35);
    for (const n of nooks) {
        carveLine(n.from, n, 1.5, disc);
        disc(n.x, n.y, 1.5);
    }

    // Anything the player can't reach becomes rock
    const reached = flood(solid, cols, rows, at(Math.round(spawn.x), Math.round(spawn.y)));
    for (let i = 0; i < solid.length; i++) {
        if (!solid[i] && !reached[i]) solid[i] = 1;
    }

    const clearance = distanceToRock(solid, cols, rows);
    const field = cornerField(rng, solid, cols, rows);
    const level = { depth, seed, cols, rows, cell: CELL, width: cols * CELL, height: rows * CELL, solid, clearance, field, chambers };

    const near = (c, need) => openNear(level, Math.round(c.x), Math.round(c.y), need);
    const toWorld = (cell) => ({ x: (cell.x + 0.5) * CELL, y: (cell.y + 0.5) * CELL });

    level.spawn = toWorld(near(spawn, 3));
    level.goal = toWorld(near(goal, 4));
    level.beacons = chosen.slice(2).map((c) => toWorld(near(c, 4)));
    level.listeners = placeListeners(rng, level, chambers, paths, spawn, depth.listeners).map(toWorld);
    level.pearls = placePearls(rng, level, nooks, spawn, depth.pearls).map(toWorld);
    level.jellies = scatter(rng, level, depth.jellies, 5, 18).map(toWorld);
    level.currents = placeCurrents(rng, level, paths, edges, chambers, depth.currents);

    return level;
}

function placeChambers(rng, cols, rows, count) {
    const pad = MARGIN + 10;
    let minDist = Math.sqrt(((cols - pad * 2) * (rows - pad * 2)) / count) * 0.85;

    for (let attempt = 0; attempt < 60; attempt++) {
        const pts = [];
        for (let tries = 0; tries < 4000 && pts.length < count; tries++) {
            const x = rng.range(pad, cols - pad);
            const y = rng.range(pad, rows - pad);
            if (pts.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist)) pts.push({ x, y });
        }
        if (pts.length === count) return pts;
        minDist *= 0.93;
    }

    throw new Error("Could not place chambers");
}

function argBest(list, score) {
    let best = list[0];
    let bestScore = -Infinity;
    for (const item of list) {
        const s = score(item);
        if (s > bestScore) {
            bestScore = s;
            best = item;
        }
    }
    return best;
}

// Prim's algorithm on the complete graph of chambers
function spanningEdges(chambers) {
    const inTree = [0];
    const edges = [];

    while (inTree.length < chambers.length) {
        let best = null;
        for (const i of inTree) {
            for (let j = 0; j < chambers.length; j++) {
                if (inTree.includes(j)) continue;
                const len = Math.hypot(chambers[i].x - chambers[j].x, chambers[i].y - chambers[j].y);
                if (!best || len < best.len) best = { a: i, b: j, len };
            }
        }
        edges.push(best);
        inTree.push(best.b);
    }

    return edges;
}

function tunnelPath(rng, a, b, cols, rows) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const a1 = len * rng.range(0.06, 0.15) * (rng.chance(0.5) ? 1 : -1);
    const f1 = rng.range(0.5, 1.3);
    const p1 = rng.range(0, TAU);
    const a2 = len * rng.range(0.02, 0.05);
    const f2 = rng.range(2, 3.5);
    const p2 = rng.range(0, TAU);
    const baseR = rng.range(2.7, 3.7);
    const f3 = rng.range(1, 3);
    const p3 = rng.range(0, TAU);
    const steps = Math.ceil(len * 2);
    const pts = [];

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const env = Math.sin(Math.PI * t);
        const off = env * (a1 * Math.sin(TAU * t * f1 + p1) + a2 * Math.sin(TAU * t * f2 + p2));
        pts.push({
            x: clamp(a.x + dx * t + nx * off, MARGIN + 3, cols - MARGIN - 3),
            y: clamp(a.y + dy * t + ny * off, MARGIN + 3, rows - MARGIN - 3),
            r: baseR + 0.7 * Math.sin(TAU * t * f3 + p3)
        });
    }

    return pts;
}

function carveBlob(rng, c, disc) {
    const k1 = rng.int(2, 4);
    const k2 = rng.int(5, 7);
    const p1 = rng.range(0, TAU);
    const p2 = rng.range(0, TAU);
    const reach = c.r * 1.35;

    for (let y = Math.floor(c.y - reach); y <= Math.ceil(c.y + reach); y++) {
        for (let x = Math.floor(c.x - reach); x <= Math.ceil(c.x + reach); x++) {
            const a = Math.atan2(y - c.y, x - c.x);
            const rr = c.r * (1 + 0.2 * Math.sin(a * k1 + p1) + 0.1 * Math.sin(a * k2 + p2));
            if (Math.hypot(x - c.x, y - c.y) <= rr) disc(x, y, 0.5);
        }
    }
}

function carveLine(a, b, r, disc) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        disc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r);
    }
}

// Cellular automaton pass that rounds off jagged rock
function smooth(solid, cols, rows) {
    const next = solid.slice();
    for (let y = MARGIN; y < rows - MARGIN; y++) {
        for (let x = MARGIN; x < cols - MARGIN; x++) {
            let n = 0;
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    if ((ox || oy) && solid[(y + oy) * cols + x + ox]) n++;
                }
            }
            if (n >= 5) next[y * cols + x] = 1;
            else if (n <= 2) next[y * cols + x] = 0;
        }
    }
    solid.set(next);
}

export function flood(solid, cols, rows, start) {
    const seen = new Uint8Array(solid.length);
    if (solid[start]) return seen;
    const queue = new Int32Array(solid.length);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;

    while (head < tail) {
        const i = queue[head++];
        const x = i % cols;
        const y = (i - x) / cols;
        const next = [x > 0 ? i - 1 : -1, x < cols - 1 ? i + 1 : -1, y > 0 ? i - cols : -1, y < rows - 1 ? i + cols : -1];
        for (const n of next) {
            if (n >= 0 && !seen[n] && !solid[n]) {
                seen[n] = 1;
                queue[tail++] = n;
            }
        }
    }

    return seen;
}

// Chebyshev distance (in cells) from every cell to the nearest rock
function distanceToRock(solid, cols, rows) {
    const out = new Uint8Array(solid.length).fill(255);
    const queue = new Int32Array(solid.length);
    let head = 0;
    let tail = 0;

    for (let i = 0; i < solid.length; i++) {
        if (solid[i]) {
            out[i] = 0;
            queue[tail++] = i;
        }
    }

    while (head < tail) {
        const i = queue[head++];
        const x = i % cols;
        const y = (i - x) / cols;
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                const nx = x + ox;
                const ny = y + oy;
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                const n = ny * cols + nx;
                if (out[n] > out[i] + 1) {
                    out[n] = Math.min(254, out[i] + 1);
                    queue[tail++] = n;
                }
            }
        }
    }

    return out;
}

// Scalar rock density at cell corners; the 0.5 iso-line is the visible/echoing wall surface.
// Boundary corners get a little jitter so walls look organic instead of gridded.
function cornerField(rng, solid, cols, rows) {
    const W = cols + 1;
    const field = new Float32Array(W * (rows + 1));
    const cell = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? 1 : solid[y * cols + x]);

    for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
            let v = (cell(i - 1, j - 1) + cell(i, j - 1) + cell(i - 1, j) + cell(i, j)) / 4;
            if (v > 0 && v < 1) v = clamp(v + rng.range(-0.25, 0.25), 0.02, 0.98);
            field[j * W + i] = v;
        }
    }

    return field;
}

// Nearest cell (spiral search) with at least `need` cells of clearance
export function openNear(level, cx, cy, need, maxR = 14) {
    let best = null;
    let bestD = Infinity;
    for (let y = cy - maxR; y <= cy + maxR; y++) {
        for (let x = cx - maxR; x <= cx + maxR; x++) {
            if (x < 0 || y < 0 || x >= level.cols || y >= level.rows) continue;
            if (level.clearance[y * level.cols + x] < need) continue;
            const d = (x - cx) ** 2 + (y - cy) ** 2;
            if (d < bestD) {
                bestD = d;
                best = { x, y };
            }
        }
    }
    return best ?? (need > 1 ? openNear(level, cx, cy, need - 1, maxR + 6) : { x: cx, y: cy });
}

function farthestPick(candidates, anchors, count) {
    const out = [];
    const pool = candidates.slice();
    while (out.length < count && pool.length) {
        let bestI = 0;
        let bestD = -1;
        pool.forEach((c, i) => {
            const d = Math.min(...[...anchors, ...out].map((o) => Math.hypot(c.x - o.x, c.y - o.y)));
            if (d > bestD) {
                bestD = d;
                bestI = i;
            }
        });
        out.push(pool.splice(bestI, 1)[0]);
    }
    return out;
}

function placeListeners(rng, level, chambers, paths, spawn, count) {
    const minDist = Math.max(40, Math.hypot(level.cols, level.rows) * 0.3);
    const candidates = [];

    for (const c of chambers) {
        if (c.role === "spawn") continue;
        const a = rng.range(0, TAU);
        candidates.push(openNear(level, Math.round(c.x + Math.cos(a) * c.r * 0.5), Math.round(c.y + Math.sin(a) * c.r * 0.5), 3));
    }
    for (const path of paths) {
        const p = path[Math.floor(path.length / 2)];
        candidates.push(openNear(level, Math.round(p.x), Math.round(p.y), 3));
    }

    const far = candidates.filter((c) => Math.hypot(c.x - spawn.x, c.y - spawn.y) >= minDist && level.clearance[c.y * level.cols + c.x] >= 2);
    return farthestPick(far, [spawn], count);
}

function placePearls(rng, level, nooks, spawn, count) {
    const usable = nooks
        .map((n) => ({ x: Math.round(n.x), y: Math.round(n.y) }))
        .filter((n) => !level.solid[n.y * level.cols + n.x] && Math.hypot(n.x - spawn.x, n.y - spawn.y) > 12);
    const picked = farthestPick(usable, [spawn], count);

    // Top up with snug open spots if smoothing swallowed some nooks
    let guard = 0;
    while (picked.length < count && guard++ < 5000) {
        const x = rng.int(0, level.cols - 1);
        const y = rng.int(0, level.rows - 1);
        const c = level.clearance[y * level.cols + x];
        if (c === 2 && Math.hypot(x - spawn.x, y - spawn.y) > 12) picked.push({ x, y });
    }
    return picked;
}

function scatter(rng, level, count, need, spacing) {
    const out = [];
    for (let tries = 0; tries < 6000 && out.length < count; tries++) {
        const x = rng.int(0, level.cols - 1);
        const y = rng.int(0, level.rows - 1);
        const required = tries > 4000 ? need - 1 : need;
        if (level.clearance[y * level.cols + x] < required) continue;
        if (out.some((o) => Math.hypot(o.x - x, o.y - y) < spacing)) continue;
        out.push({ x, y });
    }
    return out;
}

function placeCurrents(rng, level, paths, edges, chambers, count) {
    const candidates = paths
        .map((path, i) => ({ path, len: edges[i].len }))
        .filter((c) => c.len >= 28)
        .sort((a, b) => b.len - a.len);
    const currents = [];

    for (const { path } of candidates.slice(0, count)) {
        const sign = rng.chance(0.5) ? 1 : -1;
        const pieces = [];
        const step = 6; // path points are half a cell apart
        for (let i = Math.floor(path.length * 0.18); i < path.length * 0.82; i += step) {
            const p = path[i];
            const q = path[Math.min(path.length - 1, i + 2)];
            const o = path[Math.max(0, i - 2)];
            const len = Math.hypot(q.x - o.x, q.y - o.y) || 1;
            const cx = Math.round(p.x);
            const cy = Math.round(p.y);
            if (level.solid[cy * level.cols + cx]) continue;
            pieces.push({
                x: p.x * CELL,
                y: p.y * CELL,
                size: (p.r * 2 + 2) * CELL,
                dx: ((q.x - o.x) / len) * sign,
                dy: ((q.y - o.y) / len) * sign
            });
        }
        if (pieces.length) currents.push({ pieces });
    }

    return currents;
}
