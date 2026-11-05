// Enemy hazards: ground shockwaves, thrown shards and Shard Rain. Parameters come from the owner's definition.
export function spawnHazard(sim, owner, spawn) {
    const H = owner.def.hazards;
    const kind = typeof spawn === "string" ? spawn : spawn.kind;
    const floor = sim.bounds.floorY;
    const moveId = owner.action.id;
    const base = { ownerUid: owner.uid, isBoss: owner.isBoss, moveId, t: 0, hitDone: false };

    if (kind === "shockwaves") {
        for (const dir of [-1, 1]) {
            sim.hazards.push({ ...base, id: sim.nextId++, kind: "shockwave", x: owner.x + dir * H.shockwave.offset, y: floor, dir });
        }
        sim.events.push({ type: "shockwave", uid: owner.uid, x: owner.x });
    } else if (kind === "shard") {
        const lift = spawn.lift ?? H.shard.lift;
        const parryable = spawn.parryable ?? true;
        sim.hazards.push({ ...base, id: sim.nextId++, kind: "shard", x: owner.x + owner.facing * H.shard.offset, y: floor - lift, dir: owner.facing, parryable });
        sim.events.push({ type: "shardThrow", uid: owner.uid });
    } else if (kind === "rain") {
        const { minX, maxX } = sim.bounds;
        const spots = [sim.player.x];
        const span = (maxX - minX - 40) / (H.rain.count - 1);
        for (let i = 0; spots.length < H.rain.count && i < H.rain.count * 2; i++) {
            const x = minX + 20 + (i % H.rain.count) * span + sim.rng.range(-span * 0.3, span * 0.3);
            if (spots.every((s) => Math.abs(s - x) > 30)) spots.push(x);
        }
        spots.forEach((x, i) => {
            sim.hazards.push({ ...base, id: sim.nextId++, kind: "rain", x, y: floor, impactAt: H.rain.warn + i * H.rain.stagger, impacted: false });
        });
        sim.events.push({ type: "shardRain", uid: owner.uid });
    }
}

export function updateHazards(sim, dt) {
    const floor = sim.bounds.floorY;
    const list = sim.hazards;

    for (let i = list.length - 1; i >= 0; i--) {
        const h = list[i];
        const owner = sim.enemyByUid(h.ownerUid);
        const H = owner.def.hazards;
        h.t += dt;
        let remove = false;

        if (h.kind === "shockwave") {
            const c = H.shockwave;
            h.x += h.dir * c.speed * dt;
            remove = h.t > c.life || h.x < sim.bounds.minX || h.x > sim.bounds.maxX;
            if (!remove && !h.hitDone) {
                const box = { left: h.x - c.halfWidth, right: h.x + c.halfWidth, top: floor - c.height, bottom: floor };
                if (sim.tryHitPlayer(box, { damage: c.damage, parryable: false }, h.moveId, h.x, owner)) h.hitDone = true;
            }
        } else if (h.kind === "shard") {
            const c = H.shard;
            h.x += h.dir * c.speed * dt;
            remove = h.t > c.life || h.x < sim.bounds.minX || h.x > sim.bounds.maxX;
            if (remove) sim.events.push({ type: "shardBreak", x: h.x, y: h.y });
            if (!remove) {
                const box = { left: h.x - c.halfWidth, right: h.x + c.halfWidth, top: h.y - c.height / 2, bottom: h.y + c.height / 2 };
                const result = sim.tryHitPlayer(box, { damage: c.damage, parryable: h.parryable !== false }, h.moveId, h.x, owner);
                if (result === "parried") {
                    // A parried shard is deflected and staggers its thrower a little.
                    sim.events.push({ type: "shardBreak", x: h.x, y: h.y });
                    if (owner.def.stagger) sim.addStagger(owner, owner.def.stagger.deflect);
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
                if (sim.tryHitPlayer(box, { damage: c.damage, parryable: false }, h.moveId, h.x, owner)) h.hitDone = true;
            }
            remove = h.t >= h.impactAt + c.active;
        }

        if (remove) list.splice(i, 1);
    }
}
