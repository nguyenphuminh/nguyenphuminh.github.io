import { Entity, RigidBody, BoxCollider, Vector2 } from "kippy";
import { LAYER, MASK } from "../../core/layers.js";
import { mergeRockRects } from "./rects.js";

const BUCKET = 256;

// Static rock colliders. Only boxes near moving things are handed to Kippy's physics,
// so the broad phase never has to look at the whole cave.
export function createWalls(level) {
    const c = level.cell;
    const rects = mergeRockRects(level);
    const entities = rects.map((r) => {
        const e = new Entity({
            position: new Vector2((r.x + r.w / 2) * c, (r.y + r.h / 2) * c),
            body: new RigidBody({ mass: Infinity }),
            collider: new BoxCollider({ width: r.w * c, height: r.h * c, layer: LAYER.WALL, mask: MASK.WALL })
        });
        e.kind = "wall";
        return e;
    });

    const bw = Math.ceil(level.width / BUCKET);
    const bh = Math.ceil(level.height / BUCKET);
    const buckets = Array.from({ length: bw * bh }, () => []);
    rects.forEach((r, i) => {
        for (let by = Math.floor((r.y * c) / BUCKET); by <= Math.floor(((r.y + r.h) * c) / BUCKET) && by < bh; by++) {
            for (let bx = Math.floor((r.x * c) / BUCKET); bx <= Math.floor(((r.x + r.w) * c) / BUCKET) && bx < bw; bx++) {
                buckets[by * bw + bx].push(i);
            }
        }
    });

    const stamp = new Uint32Array(rects.length);
    let tick = 0;

    // Wall entities whose boxes come within `margin` of any of the given positions
    function near(points, margin, out) {
        tick++;
        for (const p of points) {
            const x0 = p.x - margin;
            const x1 = p.x + margin;
            const y0 = p.y - margin;
            const y1 = p.y + margin;
            for (let by = Math.max(0, Math.floor(y0 / BUCKET)); by <= Math.min(bh - 1, Math.floor(y1 / BUCKET)); by++) {
                for (let bx = Math.max(0, Math.floor(x0 / BUCKET)); bx <= Math.min(bw - 1, Math.floor(x1 / BUCKET)); bx++) {
                    for (const i of buckets[by * bw + bx]) {
                        if (stamp[i] === tick) continue;
                        const r = rects[i];
                        if (r.x * c > x1 || (r.x + r.w) * c < x0 || r.y * c > y1 || (r.y + r.h) * c < y0) continue;
                        stamp[i] = tick;
                        out.push(entities[i]);
                    }
                }
            }
        }
        return out;
    }

    return { near };
}
