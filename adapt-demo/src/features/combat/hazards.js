// Boss hazards: Shatter Slam shockwaves, the Mirror Shard projectile and Shard Rain.
import { HAZARDS as H } from "./moves.js";
import { BOSS as B } from "./constants.js";

export function spawnHazard(sim, kind) {
    const b = sim.boss;
    const floor = sim.bounds.floorY;
    const moveId = b.action.id;

    if (kind === "shockwaves") {
        for (const dir of [-1, 1]) {
            sim.hazards.push({ id: sim.nextId++, kind: "shockwave", moveId, x: b.x + dir * H.shockwave.offset, y: floor, dir, t: 0, hitDone: false });
        }
        sim.events.push({ type: "shockwave", x: b.x });
    } else if (kind === "shard") {
        sim.hazards.push({ id: sim.nextId++, kind: "shard", moveId, x: b.x + b.facing * H.shard.offset, y: floor - H.shard.lift, dir: b.facing, t: 0, hitDone: false });
        sim.events.push({ type: "shardThrow" });
    } else if (kind === "rain") {
        const { minX, maxX } = sim.bounds;
        const spots = [sim.player.x];
        const span = (maxX - minX - 40) / (H.rain.count - 1);
        for (let i = 0; spots.length < H.rain.count && i < H.rain.count * 2; i++) {
            const x = minX + 20 + (i % H.rain.count) * span + sim.rng.range(-span * 0.3, span * 0.3);
            if (spots.every((s) => Math.abs(s - x) > 30)) spots.push(x);
        }
        spots.forEach((x, i) => {
            sim.hazards.push({ id: sim.nextId++, kind: "rain", moveId, x, y: floor, t: 0, impactAt: H.rain.warn + i * H.rain.stagger, impacted: false, hitDone: false });
        });
        sim.events.push({ type: "shardRain" });
    }
}

export function updateHazards(sim, dt) {
    const floor = sim.bounds.floorY;
    const list = sim.hazards;

    for (let i = list.length - 1; i >= 0; i--) {
        const h = list[i];
        h.t += dt;
        let remove = false;

        if (h.kind === "shockwave") {
            const c = H.shockwave;
            h.x += h.dir * c.speed * dt;
            remove = h.t > c.life || h.x < sim.bounds.minX || h.x > sim.bounds.maxX;
            if (!remove && !h.hitDone) {
                const box = { left: h.x - c.halfWidth, right: h.x + c.halfWidth, top: floor - c.height, bottom: floor };
                if (sim.tryHitPlayer(box, { damage: c.damage, parryable: false }, h.moveId, h.x)) h.hitDone = true;
            }
        } else if (h.kind === "shard") {
            const c = H.shard;
            h.x += h.dir * c.speed * dt;
            remove = h.t > c.life || h.x < sim.bounds.minX || h.x > sim.bounds.maxX;
            if (remove) sim.events.push({ type: "shardBreak", x: h.x, y: h.y });
            if (!remove) {
                const box = { left: h.x - c.halfWidth, right: h.x + c.halfWidth, top: h.y - c.height / 2, bottom: h.y + c.height / 2 };
                const result = sim.tryHitPlayer(box, { damage: c.damage, parryable: true }, h.moveId, h.x);
                if (result === "parried") {
                    // A parried shard is deflected and staggers the boss a little.
                    sim.events.push({ type: "shardBreak", x: h.x, y: h.y });
                    sim.addStagger(B.deflectStagger);
                    remove = true;
                } else if (result === "hit") {
                    sim.events.push({ type: "shardBreak", x: h.x, y: h.y });
                    remove = true;
                }
            }
        } else if (h.kind === "rain") {
            const c = H.rain;
            if (!h.impacted && h.t >= h.impactAt) {
                h.impacted = true;
                sim.events.push({ type: "rainImpact", x: h.x });
            }
            if (h.impacted && !h.hitDone && h.t < h.impactAt + c.active) {
                const box = { left: h.x - c.radius, right: h.x + c.radius, top: floor - 40, bottom: floor };
                if (sim.tryHitPlayer(box, { damage: c.damage, parryable: false }, h.moveId, h.x)) h.hitDone = true;
            }
            remove = h.t >= h.impactAt + c.active;
        }

        if (remove) list.splice(i, 1);
    }
}
