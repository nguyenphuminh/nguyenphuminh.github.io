import { view } from "../../shared/view.js";

// Spatial questions techniques ask about the horde.

export function nearestEnemy(scene, pos, maxDist = Infinity, exclude = null) {
    let best = null, bestD = maxDist * maxDist;
    for (const e of scene.enemies) {
        if (e.dead || exclude?.has(e)) continue;
        const dx = e.position.x - pos.x, dy = e.position.y - pos.y, d = dx * dx + dy * dy;
        if (d < bestD) {
            bestD = d;
            best = e;
        }
    }
    return best;
}

export function enemiesInRadius(scene, x, y, r) {
    const out = [];
    for (const e of scene.enemies) {
        if (e.dead) continue;
        const rr = r + e.collider.radius, dx = e.position.x - x, dy = e.position.y - y;
        if (dx * dx + dy * dy <= rr * rr) out.push(e);
    }
    return out;
}

export function enemiesInRect(scene, cx, cy, w, h) {
    return scene.enemies.filter(e => {
        if (e.dead) return false;
        const r = e.collider.radius;
        return Math.abs(e.position.x - cx) <= w / 2 + r && Math.abs(e.position.y - cy) <= h / 2 + r;
    });
}

// Up to `count` distinct enemies currently on screen, in random order.
// With bossFirst, an on-screen boss is always one of them.
export function randomEnemiesInView(scene, count, bossFirst = false) {
    const p = scene.player.position, hw = view.w / 2, hh = view.h / 2;
    const pool = scene.enemies.filter(e => !e.dead && Math.abs(e.position.x - p.x) < hw && Math.abs(e.position.y - p.y) < hh);
    const out = [];
    const boss = bossFirst ? pool.findIndex(e => e.boss) : -1;
    if (boss >= 0) out.push(pool.splice(boss, 1)[0]);
    while (out.length < count && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
}
