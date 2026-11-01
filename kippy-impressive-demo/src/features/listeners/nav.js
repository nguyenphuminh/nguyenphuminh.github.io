// Grid pathfinding for the Listeners: breadth-first search over cells with enough
// clearance for their bodies, never cutting corners, never entering lit zones.
const DIRS = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
];

export function createNav(level, need = 2) {
    const { cols, rows, clearance } = level;
    const size = cols * rows;
    const prev = new Int32Array(size);
    const seen = new Uint32Array(size);
    const queue = new Int32Array(size);
    const blocked = new Uint8Array(size);
    let stamp = 0;

    const walkable = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && clearance[y * cols + x] >= need && !blocked[y * cols + x];

    function nearestWalkable(x, y, maxR = 10) {
        if (walkable(x, y)) return { x, y };
        for (let r = 1; r <= maxR; r++) {
            let best = null;
            let bestD = Infinity;
            for (let oy = -r; oy <= r; oy++) {
                for (let ox = -r; ox <= r; ox++) {
                    if (Math.max(Math.abs(ox), Math.abs(oy)) !== r || !walkable(x + ox, y + oy)) continue;
                    const d = ox * ox + oy * oy;
                    if (d < bestD) {
                        bestD = d;
                        best = { x: x + ox, y: y + oy };
                    }
                }
            }
            if (best) return best;
        }
        return null;
    }

    // Returns cell coordinates from start to goal (inclusive), or null when unreachable
    function findPath(sx, sy, tx, ty) {
        const start = nearestWalkable(sx, sy, 4);
        const goal = nearestWalkable(tx, ty);
        if (!start || !goal) return null;

        stamp++;
        const s = start.y * cols + start.x;
        const g = goal.y * cols + goal.x;
        let head = 0;
        let tail = 0;
        queue[tail++] = s;
        seen[s] = stamp;
        prev[s] = -1;

        while (head < tail) {
            const i = queue[head++];
            if (i === g) break;
            const x = i % cols;
            const y = (i - x) / cols;
            for (const [dx, dy] of DIRS) {
                const nx = x + dx;
                const ny = y + dy;
                if (!walkable(nx, ny)) continue;
                if (dx && dy && (!walkable(x + dx, y) || !walkable(x, y + dy))) continue;
                const n = ny * cols + nx;
                if (seen[n] === stamp) continue;
                seen[n] = stamp;
                prev[n] = i;
                queue[tail++] = n;
            }
        }

        if (seen[g] !== stamp) return null;

        const path = [];
        for (let i = g; i !== -1; i = prev[i]) {
            const x = i % cols;
            path.push({ x, y: (i - x) / cols });
        }
        return path.reverse();
    }

    // Lit beacon zones become no-go cells
    function blockDisc(cx, cy, r) {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
            for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
                if (x >= 0 && y >= 0 && x < cols && y < rows && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) blocked[y * cols + x] = 1;
            }
        }
    }

    return { walkable, nearestWalkable, findPath, blockDisc };
}
