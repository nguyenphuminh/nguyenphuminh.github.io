import { Entity, Sprite, RigidBody, CircleCollider, Vector2 } from "../../shared/kippy.js";
import { LAYER } from "../../shared/layers.js";
import { rand, pick, TAU } from "../../shared/math.js";
import { sfx } from "../../shared/audio.js";
import { sprite, loopAnimator, lotusTexture, warnRingTexture } from "../art/atlas.js";
import { spawnFx, shake } from "../effects/effects.js";
import { damageEnemy } from "../enemies/enemy.js";
import { nearestEnemy, enemiesInRadius, enemiesInRect, randomEnemiesInView } from "../enemies/query.js";
import { projectile } from "./projectile.js";

// Cultivation techniques (the "weapons"). Each has base stats, per-level deltas,
// and a create() that returns the per-run behaviour. create() also takes variant
// options, which is how evolutions (evolutions.js) reuse and twist a technique.

function techStats(inst, p) {
    const s = { ...inst.def.base };
    for (let i = 0; i < inst.level - 1; i++) {
        for (const [k, v] of Object.entries(inst.def.levels[i])) s[k] = (s[k] ?? 0) + v;
    }
    const ps = p.stats;
    return {
        ...s,
        damage: s.damage * ps.might,
        cooldown: Math.max(0.1, s.cooldown * ps.cooldown),
        amount: (s.amount ?? 1) + ps.amount,
        area: (s.area ?? 1) * ps.area,
    };
}

// A unit vector from the player toward a target, or along the player's aim.
function aimAt(p, target) {
    let dx = p.aim.x, dy = p.aim.y;
    if (target) {
        dx = target.position.x - p.position.x;
        dy = target.position.y - p.position.y;
    }
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
}

// Fires `amount` shots in a staggered volley each cooldown.
function volley(inst, p, gap, fire) {
    let queue = 0, wait = 0, index = 0;
    return dt => {
        inst.timer -= dt;
        if (inst.timer <= 0) {
            const s = techStats(inst, p);
            inst.timer = s.cooldown;
            queue = s.amount;
            index = 0;
        }
        wait -= dt;
        if (queue > 0 && wait <= 0) {
            queue--;
            wait = gap;
            fire(techStats(inst, p), index++);
        }
    };
}

const flyingSword = {
    id: "flyingSword", name: "Flying Sword", noun: "sword", maxLevel: 8,
    desc: "A spirit sword flies at the nearest enemy.",
    base: { damage: 10, cooldown: 1.1, amount: 1, pierce: 1, speed: 230, area: 1 },
    levels: [{ amount: 1 }, { damage: 5 }, { amount: 1, cooldown: -0.15 }, { pierce: 1 }, { amount: 1 }, { damage: 8 }, { amount: 1, pierce: 1 }],
    create(scene, p, inst, { spriteId = "sword", gap = 0.07 } = {}) {
        // Swords in one volley pick different targets while there are enough of them.
        const targeted = new Set();
        return {
            update: volley(inst, p, gap, (s, i) => {
                if (i === 0) targeted.clear();
                const target = nearestEnemy(scene, p.position, 300, targeted) ?? nearestEnemy(scene, p.position, 300);
                if (target) targeted.add(target);
                const [dx, dy] = aimAt(p, target);
                projectile(scene, {
                    sprite: sprite(spriteId, s.area), x: p.position.x, y: p.position.y, vx: dx * s.speed, vy: dy * s.speed,
                    radius: 4 * s.area, damage: s.damage, pierce: s.pierce, life: 1.5, rotation: Math.atan2(dy, dx),
                });
            }),
        };
    },
};

const thunderTalisman = {
    id: "thunderTalisman", name: "Thunder Talisman", noun: "strike", maxLevel: 8,
    desc: "Calls lightning down on random enemies.",
    base: { damage: 18, cooldown: 2.4, amount: 2, area: 1 },
    levels: [{ amount: 1 }, { damage: 10 }, { area: 0.25 }, { amount: 1 }, { damage: 12, cooldown: -0.3 }, { amount: 1 }, { damage: 15, area: 0.25 }],
    create(scene, p, inst, { bolts = ["boltA", "boltB", "boltC"], lift = 58, chain = false } = {}) {
        const strike = (x, y, s, damage) => {
            spawnFx(scene, pick(bolts), x, y - lift, { z: 6 });
            spawnFx(scene, "shock", x, y, { scale: 0.8 * s.area, z: 1 });
            for (const e of enemiesInRadius(scene, x, y, 16 * s.area)) damageEnemy(scene, e, damage, { kb: 25, fromX: x, fromY: y });
        };
        return {
            update(dt) {
                inst.timer -= dt;
                if (inst.timer > 0) return;
                const s = techStats(inst, p);
                const targets = randomEnemiesInView(scene, s.amount, true);
                inst.timer = targets.length ? s.cooldown : 0.3;
                for (const t of targets) {
                    const { x, y } = t.position;
                    strike(x, y, s, s.damage);
                    // Chained lightning leaps to the closest other foe at half power.
                    const next = chain && nearestEnemy(scene, t.position, 80, new Set([t]));
                    if (next) strike(next.position.x, next.position.y, s, s.damage / 2);
                }
                if (targets.length) sfx.thunder();
            },
        };
    },
};

const lotusAura = {
    id: "lotusAura", name: "Lotus Flame Aura", noun: "petal", maxLevel: 8,
    desc: "A ring of lotus fire burns enemies near you.",
    base: { damage: 4, cooldown: 0.45, area: 1 },
    levels: [{ area: 0.2 }, { damage: 2 }, { cooldown: -0.05 }, { area: 0.2 }, { damage: 3 }, { area: 0.2 }, { damage: 4, cooldown: -0.05 }],
    create(scene, p, inst, { gold = false, heal = 0 } = {}) {
        const ring = new Entity({ position: p.position.copy() });
        ring.z = 1;
        scene.addEntity(ring);
        let radius = 0;
        return {
            dispose: () => scene.remove(ring),
            update(dt) {
                const s = techStats(inst, p);
                const r = Math.round(30 * s.area);
                if (r !== radius) {
                    radius = r;
                    ring.sprite = new Sprite({ texture: lotusTexture(r, gold) });
                }
                ring.position.x = p.position.x;
                ring.position.y = p.position.y + 3;
                ring.rotation += dt * 0.8;
                inst.timer -= dt;
                if (inst.timer > 0) return;
                inst.timer = s.cooldown;
                const burned = enemiesInRadius(scene, p.position.x, p.position.y, r);
                for (const e of burned) damageEnemy(scene, e, s.damage, { kb: 45, fromX: p.position.x, fromY: p.position.y });
                // Each burned foe feeds a little vitality back, up to 3 HP per pulse.
                if (heal) p.hp = Math.min(p.stats.maxHp, p.hp + Math.min(3, burned.length * heal));
            },
        };
    },
};

const mountainPalm = {
    id: "mountainPalm", name: "Mountain-Splitting Palm", noun: "palm", maxLevel: 8,
    desc: "A golden palm strikes the side where foes are closest.",
    base: { damage: 16, cooldown: 1.35, amount: 1, area: 1 },
    levels: [{ amount: 1 }, { damage: 8 }, { area: 0.2 }, { damage: 8 }, { cooldown: -0.2 }, { damage: 10, area: 0.2 }, { damage: 12 }],
    create(scene, p, inst, { reach = 66, kb = 140, stun = 0 } = {}) {
        const ROWS = [0, 0, -1, 1, -2, 2, -3, 3];
        return {
            update: volley(inst, p, 0.12, (s, i) => {
                const w = reach * s.area, h = 24 * s.area;
                // Strikes toward the nearest foe's side, alternating sides with more palms.
                const near = nearestEnemy(scene, p.position, 160);
                const side = near ? Math.sign(near.position.x - p.position.x) || p.facing : p.facing;
                const dir = i % 2 === 0 ? side : -side;
                const cx = p.position.x + dir * (w / 2 + 2), cy = p.position.y + ROWS[Math.min(i, 7)] * h * 0.9;
                for (const e of enemiesInRect(scene, cx, cy, w, h)) {
                    damageEnemy(scene, e, s.damage, { kb, stun, fromX: p.position.x, fromY: cy });
                }
                const look = dir > 0 ? "R" : "L";
                spawnFx(scene, `streak${look}`, cx, cy, { scale: w / 48, z: 5 });
                spawnFx(scene, `palm${look}`, cx + dir * (w / 2 - 10 * s.area), cy, { scale: 1.3 * s.area, z: 5 });
                sfx.swing();
            }),
        };
    },
};

const swordFormation = {
    id: "swordFormation", name: "Sword Formation", noun: "sword", maxLevel: 8,
    desc: "Spirit swords orbit you, cutting all they touch.",
    base: { damage: 9, cooldown: 3, duration: 3, amount: 2, area: 1, speed: 3.4 },
    levels: [{ amount: 1 }, { area: 0.25 }, { duration: 0.5, damage: 4 }, { amount: 1 }, { area: 0.25, speed: 0.6 }, { duration: 0.5, damage: 5 }, { amount: 1 }],
    create(scene, p, inst, { spriteId = "sword" } = {}) {
        let swords = [], active = 0, angle = 0, clock = 0;
        const lastHit = new Map();
        const hit = other => {
            if (!other.isEnemy || other.dead || clock - (lastHit.get(other) ?? -9) < 0.45) return;
            // The evolved domain never clears, so forget slain foes now and then.
            if (lastHit.size > 300) for (const e of lastHit.keys()) if (e.dead) lastHit.delete(e);
            lastHit.set(other, clock);
            damageEnemy(scene, other, techStats(inst, p).damage, { kb: 70, fromX: p.position.x, fromY: p.position.y });
        };
        const clear = () => {
            for (const e of swords) scene.remove(e);
            swords = [];
            lastHit.clear();
        };
        return {
            dispose: clear,
            update(dt) {
                clock += dt;
                const s = techStats(inst, p);
                // An endless formation re-forms when its sword count changes.
                if (active > 0 && s.duration === Infinity && swords.length !== s.amount) {
                    clear();
                    active = 0;
                    inst.timer = 0;
                }
                if (active > 0) {
                    active -= dt;
                    angle += dt * s.speed;
                    const r = 40 * s.area;
                    swords.forEach((e, i) => {
                        const a = angle + (i * TAU) / swords.length;
                        e.position.x = p.position.x + Math.cos(a) * r;
                        e.position.y = p.position.y + Math.sin(a) * r;
                        e.rotation = a + Math.PI / 2;
                    });
                    if (active <= 0) {
                        clear();
                        inst.timer = s.cooldown;
                    }
                } else if ((inst.timer -= dt) <= 0) {
                    for (let i = 0; i < s.amount; i++) {
                        const e = new Entity({
                            sprite: sprite(spriteId, 1.2 * s.area),
                            position: p.position.copy(),
                            collider: new CircleCollider({ radius: 6 * s.area, isTrigger: true, layer: LAYER.PROJ, mask: LAYER.ENEMY }),
                        });
                        e.z = 4;
                        e.onTriggerEnter = e.onTriggerStay = hit;
                        scene.addEntity(e);
                        swords.push(e);
                    }
                    active = s.duration;
                }
            },
        };
    },
};

const jadeDisc = {
    id: "jadeDisc", name: "Returning Jade Disc", noun: "disc", maxLevel: 8,
    desc: "A jade bi disc flies out and returns, piercing everything.",
    base: { damage: 12, cooldown: 1.8, amount: 1, area: 1, speed: 200 },
    levels: [{ damage: 6 }, { amount: 1 }, { area: 0.25 }, { cooldown: -0.3 }, { amount: 1 }, { damage: 8, speed: 40 }, { amount: 1 }],
    create(scene, p, inst, { homing = false } = {}) {
        return {
            update: volley(inst, p, 0.12, s => {
                const [dx, dy] = aimAt(p, nearestEnemy(scene, p.position, 260));
                const a = Math.atan2(dy, dx) + rand(-0.3, 0.3);
                const ux = Math.cos(a), uy = Math.sin(a);
                const e = projectile(scene, {
                    sprite: sprite("jadeDisc", s.area), x: p.position.x, y: p.position.y, vx: ux * s.speed, vy: uy * s.speed,
                    radius: 5 * s.area, damage: s.damage, pierce: Infinity, life: homing ? 3.4 : 2.2, spin: 14, kb: 40,
                });
                // Kippy integrates the force, so the disc slows, turns and comes back.
                let returning = false, rehit = 0;
                e.tick = dt => {
                    if (returning && homing) {
                        // Evolved wheels are pulled back toward you and keep circling.
                        const hx = p.position.x - e.position.x, hy = p.position.y - e.position.y, hd = Math.hypot(hx, hy) || 1;
                        e.body.force.x = (hx / hd) * s.speed * 3;
                        e.body.force.y = (hy / hd) * s.speed * 3;
                        if ((rehit -= dt) <= 0) {
                            rehit = 0.5;
                            e.hits.clear();
                        }
                    } else {
                        e.body.force.x = -ux * s.speed * 1.6;
                        e.body.force.y = -uy * s.speed * 1.6;
                    }
                    if (!returning && e.body.velocity.x * ux + e.body.velocity.y * uy < 0) {
                        returning = true;
                        e.hits.clear();
                    }
                };
            }),
        };
    },
};

const phoenixFire = {
    id: "phoenixFire", name: "Phoenix Fireball", noun: "fireball", maxLevel: 8,
    desc: "Hurls fireballs that explode on impact.",
    base: { damage: 20, cooldown: 2.2, amount: 1, area: 1, speed: 130 },
    levels: [{ amount: 1 }, { damage: 10 }, { area: 0.25 }, { amount: 1 }, { damage: 10, cooldown: -0.3 }, { area: 0.25 }, { amount: 2 }],
    create(scene, p, inst, { split = 0 } = {}) {
        const explode = (x, y, s, rebirth) => {
            spawnFx(scene, "explosion", x, y, { scale: 1.6 * s.area });
            for (const e of enemiesInRadius(scene, x, y, 22 * s.area)) damageEnemy(scene, e, s.damage, { kb: 90, fromX: x, fromY: y });
            shake(scene, 1, 0.1);
            sfx.explode();
            // Rebirth: the blast scatters into smaller fireballs that burst again.
            if (!rebirth) return;
            const small = { ...s, damage: s.damage / 2, area: s.area * 0.6 };
            for (let i = 0; i < split; i++) {
                const a = (i / split) * TAU + rand(0.5);
                const f = projectile(scene, {
                    animator: loopAnimator("fireball", 12), x, y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170,
                    radius: 4, damage: 0, pierce: 1, life: 0.45,
                    onHit: () => explode(f.position.x, f.position.y, small, false),
                });
                f.onExpire = () => explode(f.position.x, f.position.y, small, false);
            }
        };
        return {
            update: volley(inst, p, 0.15, (s, i) => {
                const targets = randomEnemiesInView(scene, 1, i === 0);
                let [dx, dy] = aimAt(p, targets[0]);
                if (!targets.length) [dx, dy] = [Math.cos(rand(TAU)), Math.sin(rand(TAU))];
                const a = Math.atan2(dy, dx) + rand(-0.15, 0.15);
                const e = projectile(scene, {
                    animator: loopAnimator("fireball", 10), x: p.position.x, y: p.position.y,
                    vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, radius: 5, damage: 0, pierce: 1, life: 2.6,
                    onHit: () => explode(e.position.x, e.position.y, s, split > 0),
                });
                e.onExpire = () => explode(e.position.x, e.position.y, s, split > 0);
            }),
        };
    },
};

const frostNeedles = {
    id: "frostNeedles", name: "Frost Lotus Needles", noun: "needle", maxLevel: 8,
    desc: "Fans icy needles where you move. They slow what they pierce.",
    base: { damage: 7, cooldown: 0.9, amount: 2, area: 1, pierce: 1, speed: 320 },
    levels: [{ amount: 1 }, { damage: 4 }, { amount: 1 }, { pierce: 1 }, { amount: 1, cooldown: -0.15 }, { damage: 5 }, { amount: 2 }],
    create(scene, p, inst, { ring = false, freeze = 0 } = {}) {
        return {
            update(dt) {
                inst.timer -= dt;
                if (inst.timer > 0) return;
                const s = techStats(inst, p);
                inst.timer = s.cooldown;
                const base = ring ? rand(TAU) : Math.atan2(p.aim.y, p.aim.x);
                for (let i = 0; i < s.amount; i++) {
                    // A fan where you move, or (evolved) a full blooming circle.
                    const a = ring ? base + (i / s.amount) * TAU : base + (i - (s.amount - 1) / 2) * 0.12;
                    projectile(scene, {
                        sprite: sprite("needle", s.area), x: p.position.x, y: p.position.y, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed,
                        radius: 3 * s.area, damage: s.damage, pierce: s.pierce, life: 1, rotation: a,
                        onHit: e => damageEnemy(scene, e, s.damage, { slow: 1.5, stun: freeze, kb: 15, fromX: p.position.x, fromY: p.position.y }),
                    });
                }
            },
        };
    },
};

const heavenlySeal = {
    id: "heavenlySeal", name: "Heavenly Seal", noun: "seal", maxLevel: 8,
    desc: "A great seal crashes down, stunning foes and leaving holy ground.",
    base: { damage: 30, cooldown: 3, amount: 1, area: 1, duration: 1.5 },
    levels: [{ area: 0.2 }, { amount: 1 }, { damage: 15 }, { duration: 0.5, area: 0.2 }, { amount: 1 }, { damage: 20 }, { amount: 1, cooldown: -0.5 }],
    create(scene, p, inst, { stun = 0.8, size = 1.6, holy = 0.3 } = {}) {
        const FALL = 0.4, HEIGHT = 90;
        const drop = (x, y, s) => {
            const r = Math.round(26 * s.area);
            const shadow = new Entity({ sprite: sprite("shadow", s.area), position: new Vector2(x, y) });
            shadow.z = 1;
            // The falling seal is visual only: a body with no collider.
            const seal = new Entity({
                sprite: sprite("seal", size * s.area),
                position: new Vector2(x, y - HEIGHT),
                body: new RigidBody({ velocity: new Vector2(0, HEIGHT / FALL), sleepThreshold: 0 }),
            });
            seal.z = 6;
            scene.addEntity(shadow);
            scene.addEntity(seal);
            scene.later(FALL, () => {
                scene.remove(seal);
                scene.remove(shadow);
                spawnFx(scene, "goldRing", x, y, { scale: r / 30, z: 1 });
                for (const e of enemiesInRadius(scene, x, y, r)) damageEnemy(scene, e, s.damage, { stun, kb: 60, fromX: x, fromY: y });
                shake(scene, 2, 0.15);
                sfx.explode();
                holyGround(x, y, r, s);
            });
        };
        const holyGround = (x, y, r, s) => {
            const zone = new Entity({ sprite: new Sprite({ texture: warnRingTexture(r, "240, 194, 75") }), position: new Vector2(x, y) });
            zone.z = 1;
            scene.addEntity(zone);
            let left = s.duration;
            const tick = () => {
                for (const e of enemiesInRadius(scene, x, y, r)) damageEnemy(scene, e, s.damage * holy);
                left -= 0.5;
                if (left > 0) scene.later(0.5, tick);
                else scene.remove(zone);
            };
            scene.later(0.5, tick);
        };
        return {
            update: volley(inst, p, 0.2, (s, i) => {
                const [t] = randomEnemiesInView(scene, 1, i === 0);
                const x = t ? t.position.x : p.position.x + rand(-80, 80);
                const y = t ? t.position.y : p.position.y + rand(-60, 60);
                drop(x, y, s);
            }),
        };
    },
};

const azureDragon = {
    id: "azureDragon", name: "Azure Dragon Wave", noun: "dragon", maxLevel: 8,
    desc: "Summons an azure dragon that tears through the horde.",
    base: { damage: 25, cooldown: 6, amount: 1, area: 1, speed: 240 },
    levels: [{ damage: 10 }, { cooldown: -0.8 }, { area: 0.25 }, { amount: 1 }, { damage: 15 }, { cooldown: -0.8 }, { damage: 20, amount: 1 }],
    create(scene, p, inst, { homing = false } = {}) {
        const SEGMENTS = 7, SPACING = 4, LIFE = homing ? 3.6 : 2.4;
        return {
            update: volley(inst, p, 0.45, s => {
                let [ux, uy] = aimAt(p, nearestEnemy(scene, p.position, 300));
                const sx = p.position.x - ux * 150, sy = p.position.y - uy * 150;
                const head = projectile(scene, {
                    sprite: sprite(ux < 0 ? "dragonHeadL" : "dragonHead", s.area), x: sx, y: sy, vx: ux * s.speed, vy: uy * s.speed,
                    radius: 7 * s.area, damage: s.damage, pierce: Infinity, life: LIFE, kb: 80, z: 5,
                });
                // The evolved dragon chases a pearl that hunts the nearest foe.
                const pearl = homing && new Entity({ sprite: sprite("pearl", s.area), position: new Vector2(sx, sy) });
                if (pearl) {
                    pearl.z = 5;
                    scene.addEntity(pearl);
                    head.onExpire = () => scene.remove(pearl);
                }
                const body = [];
                for (let i = 0; i < SEGMENTS; i++) {
                    const seg = projectile(scene, {
                        sprite: sprite("dragonBody", s.area * (1 - i * 0.07)), x: sx, y: sy, radius: 6 * s.area, damage: s.damage,
                        pierce: Infinity, life: LIFE, kb: 60, hits: head.hits, z: 5,
                    });
                    body.push(seg);
                }
                const trail = [];
                let t = 0;
                head.tick = dt => {
                    t += dt;
                    const prey = pearl && nearestEnemy(scene, head.position, 220, head.hits);
                    if (prey) {
                        const want = Math.atan2(prey.position.y - head.position.y, prey.position.x - head.position.x);
                        let turn = want - Math.atan2(uy, ux);
                        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
                        const a = Math.atan2(uy, ux) + Math.max(-3 * dt, Math.min(3 * dt, turn));
                        [ux, uy] = [Math.cos(a), Math.sin(a)];
                    }
                    const wave = Math.cos(t * 7) * 70;
                    head.body.velocity.x = ux * s.speed - uy * wave;
                    head.body.velocity.y = uy * s.speed + ux * wave;
                    const left = head.body.velocity.x < 0;
                    head.sprite = sprite(left ? "dragonHeadL" : "dragonHead", s.area);
                    head.rotation = Math.atan2(head.body.velocity.y, head.body.velocity.x) + (left ? Math.PI : 0);
                    if (pearl) {
                        pearl.position.x = head.position.x + ux * 14 * s.area;
                        pearl.position.y = head.position.y + uy * 14 * s.area;
                    }
                    trail.push([head.position.x, head.position.y]);
                    body.forEach((seg, i) => {
                        const pt = trail[Math.max(0, trail.length - 1 - (i + 1) * SPACING)];
                        seg.position.x = pt[0];
                        seg.position.y = pt[1];
                    });
                    if (trail.length > 64) trail.shift();
                };
            }),
        };
    },
};

export const TECHNIQUES = [flyingSword, thunderTalisman, lotusAura, mountainPalm, swordFormation, jadeDisc, phoenixFire, frostNeedles, heavenlySeal, azureDragon];
export const TECH_BY_ID = Object.fromEntries(TECHNIQUES.map(t => [t.id, t]));

export function addTechnique(scene, p, def) {
    const inst = { def, level: 1, timer: 0.4 };
    inst.behavior = def.create(scene, p, inst);
    p.techniques.push(inst);
    return inst;
}

export function updateTechniques(p, dt) {
    for (const t of p.techniques) t.behavior.update(dt);
}

const UPGRADE_TEXT = {
    damage: v => `+${v} damage`,
    amount: (v, noun) => `+${v} ${noun}${v > 1 ? "s" : ""}`,
    cooldown: v => `recharges ${-v}s faster`,
    area: v => `+${Math.round(v * 100)}% area`,
    pierce: v => `pierces ${v} more`,
    duration: v => `lasts ${v}s longer`,
    speed: () => "moves faster",
};

export function upgradeText(def, nextLevel) {
    const parts = Object.entries(def.levels[nextLevel - 2]).map(([k, v]) => UPGRADE_TEXT[k](v, def.noun));
    const text = parts.join(", ");
    return `${text[0].toUpperCase()}${text.slice(1)}.`;
}
