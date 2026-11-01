import { makeCanvas, noiseCanvas } from "../../core/paint.js";
import { createRng } from "../../core/rng.js";
import { cellRock, cellEdges } from "./contour.js";

const SIZE = 512;
const MAX_CACHED = 28;

// Rock art, painted lazily in 512-unit chunks from the same field the sonar echoes off
export function createWallArt(level, rock) {
    const cells = SIZE / level.cell;
    const cache = new Map();
    const noise = noiseCanvas(256, level.seed ^ 0x5eed, 5);

    function paint(cx, cy) {
        const canvas = makeCanvas(SIZE, SIZE);
        const g = canvas.getContext("2d");
        const c = level.cell;
        const fill = new Path2D();
        const rim = new Path2D();
        const rng = createRng((cx * 7349) ^ (cy * 9151) ^ level.seed);
        const dots = [];

        g.translate(-cx * SIZE, -cy * SIZE);

        for (let j = cy * cells - 1; j <= (cy + 1) * cells; j++) {
            for (let i = cx * cells - 1; i <= (cx + 1) * cells; i++) {
                if (i < 0 || j < 0 || i >= level.cols || j >= level.rows) {
                    fill.rect(i * c, j * c, c, c);
                    continue;
                }
                const poly = cellRock(level, i, j);
                if (poly.length) {
                    fill.moveTo((i + poly[0]) * c, (j + poly[1]) * c);
                    for (let k = 2; k < poly.length; k += 2) fill.lineTo((i + poly[k]) * c, (j + poly[k + 1]) * c);
                    fill.closePath();
                }
                for (const [x0, y0, x1, y1] of cellEdges(level, i, j)) {
                    rim.moveTo((i + x0) * c, (j + y0) * c);
                    rim.lineTo((i + x1) * c, (j + y1) * c);
                    if (rng.chance(0.16)) dots.push((i + (x0 + x1) / 2) * c, (j + (y0 + y1) / 2) * c);
                }
            }
        }

        g.fillStyle = rock.base;
        g.fill(fill);

        // Stone grain, plus a lit band just inside every wall face
        g.save();
        g.clip(fill);
        g.globalAlpha = 0.6;
        g.fillStyle = g.createPattern(noise, "repeat");
        g.fillRect(cx * SIZE, cy * SIZE, SIZE, SIZE);
        g.globalAlpha = 1;
        g.strokeStyle = "rgba(120, 170, 190, 0.07)";
        g.lineWidth = 22;
        g.stroke(rim);
        g.strokeStyle = "rgba(150, 200, 215, 0.12)";
        g.lineWidth = 8;
        g.stroke(rim);
        g.restore();

        g.strokeStyle = rock.rim;
        g.lineWidth = 1.6;
        g.stroke(rim);

        // Barnacles and polyps clinging to the faces
        for (let k = 0; k < dots.length; k += 2) {
            g.fillStyle = rock.accent[rng.int(0, rock.accent.length - 1)];
            g.globalAlpha = rng.range(0.35, 0.8);
            g.beginPath();
            g.arc(dots[k] + rng.range(-2, 2), dots[k + 1] + rng.range(-2, 2), rng.range(1, 2.6), 0, Math.PI * 2);
            g.fill();
        }

        return canvas;
    }

    // Draws visible chunks; paints at most `budget` missing chunks this frame
    function render(ctx, view, budget = 2) {
        for (let cy = Math.floor(view.y0 / SIZE); cy <= Math.floor(view.y1 / SIZE); cy++) {
            for (let cx = Math.floor(view.x0 / SIZE); cx <= Math.floor(view.x1 / SIZE); cx++) {
                const key = `${cx},${cy}`;
                let chunk = cache.get(key);
                if (chunk) {
                    cache.delete(key);
                } else {
                    if (budget-- <= 0) continue;
                    chunk = paint(cx, cy);
                }
                cache.set(key, chunk);
                if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value);
                ctx.drawImage(chunk, cx * SIZE, cy * SIZE);
            }
        }
    }

    // Whole depth at reduced scale, for the final zoomed-out view (painted once)
    let whole = null;
    function overview(scale = 0.25) {
        if (whole) return whole;
        const c = level.cell;
        const canvas = makeCanvas(level.width * scale, level.height * scale);
        const g = canvas.getContext("2d");
        const fill = new Path2D();
        const rim = new Path2D();
        g.scale(scale, scale);
        for (let j = 0; j < level.rows; j++) {
            for (let i = 0; i < level.cols; i++) {
                const poly = cellRock(level, i, j);
                if (poly.length) {
                    fill.moveTo((i + poly[0]) * c, (j + poly[1]) * c);
                    for (let k = 2; k < poly.length; k += 2) fill.lineTo((i + poly[k]) * c, (j + poly[k + 1]) * c);
                    fill.closePath();
                }
                for (const [x0, y0, x1, y1] of cellEdges(level, i, j)) {
                    rim.moveTo((i + x0) * c, (j + y0) * c);
                    rim.lineTo((i + x1) * c, (j + y1) * c);
                }
            }
        }
        g.fillStyle = rock.base;
        g.fill(fill);
        g.strokeStyle = rock.rim;
        g.lineWidth = 3;
        g.stroke(rim);
        whole = canvas;
        return whole;
    }

    return { render, overview };
}
