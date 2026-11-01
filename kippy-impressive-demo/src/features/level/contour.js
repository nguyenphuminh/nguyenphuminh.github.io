import { ISO } from "./field.js";

// Marching squares over the rock field, one cell at a time.
// Corners in clockwise order: top-left, top-right, bottom-right, bottom-left.
const CX = [0, 1, 1, 0];
const CY = [0, 0, 1, 1];

function corners(level, i, j) {
    const W = level.cols + 1;
    const k = j * W + i;
    const f = level.field;
    return [f[k], f[k + 1], f[k + W + 1], f[k + W]];
}

// Polygon (cell-local 0..1 coords, flat pairs) of the rock part of cell (i, j); empty if none
export function cellRock(level, i, j) {
    const v = corners(level, i, j);
    const out = [];
    for (let n = 0; n < 4; n++) {
        const m = (n + 1) % 4;
        const a = v[n] >= ISO;
        if (a) out.push(CX[n], CY[n]);
        if (a !== v[m] >= ISO) {
            const t = (ISO - v[n]) / (v[m] - v[n]);
            out.push(CX[n] + (CX[m] - CX[n]) * t, CY[n] + (CY[m] - CY[n]) * t);
        }
    }
    return out;
}

// Wall surface segments inside cell (i, j), as [x0, y0, x1, y1] in cell-local coords
export function cellEdges(level, i, j) {
    const v = corners(level, i, j);
    const cross = [];
    for (let n = 0; n < 4; n++) {
        const m = (n + 1) % 4;
        if (v[n] >= ISO !== v[m] >= ISO) {
            const t = (ISO - v[n]) / (v[m] - v[n]);
            cross.push({ edge: n, x: CX[n] + (CX[m] - CX[n]) * t, y: CY[n] + (CY[m] - CY[n]) * t });
        }
    }

    if (cross.length === 2) return [[cross[0].x, cross[0].y, cross[1].x, cross[1].y]];
    if (cross.length !== 4) return [];

    // Saddle: pair crossings around the corners that the cell center separates
    const centerRock = (v[0] + v[1] + v[2] + v[3]) / 4 >= ISO;
    const diagonalA = v[0] >= ISO; // top-left & bottom-right are rock
    const pairTopRight = centerRock === diagonalA;
    const [top, right, bottom, left] = cross;
    return pairTopRight
        ? [[top.x, top.y, right.x, right.y], [bottom.x, bottom.y, left.x, left.y]]
        : [[left.x, left.y, top.x, top.y], [right.x, right.y, bottom.x, bottom.y]];
}

// Points sampled along every wall surface of the level (world coords)
export function surfacePoints(level, spacing = 8) {
    const pts = [];
    const c = level.cell;
    for (let j = 0; j < level.rows; j++) {
        for (let i = 0; i < level.cols; i++) {
            for (const [x0, y0, x1, y1] of cellEdges(level, i, j)) {
                const len = Math.hypot(x1 - x0, y1 - y0) * c;
                const n = Math.max(1, Math.round(len / spacing));
                for (let s = 0; s < n; s++) {
                    const t = (s + 0.5) / n;
                    pts.push((i + x0 + (x1 - x0) * t) * c, (j + y0 + (y1 - y0) * t) * c);
                }
            }
        }
    }
    return pts;
}
