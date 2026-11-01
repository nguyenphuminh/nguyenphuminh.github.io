// Rock cells that something could ever touch: within 2 cells of open water
export function touchableRock(level) {
    const { cols, rows, solid, clearance } = level;
    const out = new Uint8Array(solid.length);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            if (!solid[i]) continue;
            let nearOpen = false;
            for (let oy = -2; oy <= 2 && !nearOpen; oy++) {
                for (let ox = -2; ox <= 2; ox++) {
                    const nx = x + ox;
                    const ny = y + oy;
                    if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && clearance[ny * cols + nx] > 0) {
                        nearOpen = true;
                        break;
                    }
                }
            }
            if (nearOpen) out[i] = 1;
        }
    }
    return out;
}

// Greedy merge of touchable rock into axis-aligned boxes (cell units), capped in size so
// Kippy's spatial grid keeps small cells
export function mergeRockRects(level, maxSize = 8) {
    const { cols, rows } = level;
    const mask = touchableRock(level);
    const used = new Uint8Array(mask.length);
    const rects = [];

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            if (!mask[i] || used[i]) continue;

            let w = 1;
            while (w < maxSize && x + w < cols && mask[i + w] && !used[i + w]) w++;

            let h = 1;
            grow: while (h < maxSize && y + h < rows) {
                for (let k = 0; k < w; k++) {
                    const n = (y + h) * cols + x + k;
                    if (!mask[n] || used[n]) break grow;
                }
                h++;
            }

            for (let oy = 0; oy < h; oy++) {
                for (let ox = 0; ox < w; ox++) used[(y + oy) * cols + x + ox] = 1;
            }
            rects.push({ x, y, w, h });
        }
    }

    return rects;
}
