import { Entity, RigidBody, CircleCollider, Sprite, Vector2 } from "../../shared/kippy.js";
import { LAYER } from "../../shared/layers.js";
import { rand, TAU } from "../../shared/math.js";
import { viewRadius } from "../../shared/view.js";
import { sfx } from "../../shared/audio.js";
import { actor, makeAnimator, SPRITES } from "../art/atlas.js";
import { spawnFx, damageNumber, burst } from "../effects/effects.js";
import { spawnQi, spawnItem } from "../progression/pickups.js";
import { ENEMIES } from "./enemyTypes.js";
import { updateBoss, onBossKilled } from "./bosses.js";

const ELITE_SCALE = 1.6;

// Enemies get the run's current HP scaling unless told otherwise.
export function spawnEnemy(scene, typeId, x, y, { elite = false, hpMul = scene.hpMul() } = {}) {
    const type = ENEMIES[typeId], damageMul = scene.stage.difficulty.damage;
    const scale = (type.scale ?? 1) * (elite ? ELITE_SCALE : 1);
    const e = new Entity({
        animator: makeAnimator(actor(type.art, scale)),
        position: new Vector2(x, y),
        body: new RigidBody({ mass: (type.mass ?? 1) * (elite ? 3 : 1), sleepThreshold: 0 }),
        collider: new CircleCollider({
            radius: type.radius * scale,
            layer: LAYER.ENEMY,
            // Ghosts drift through the crowd; everything else jostles for space.
            mask: type.ghost ? LAYER.PLAYER | LAYER.PROJ : LAYER.ENEMY | LAYER.PLAYER | LAYER.PROJ,
        }),
        glow: elite ? { color: "#d9a0ff", bloom: 8, intensity: 1 } : type.glow,
    });
    return enlist(scene, e, {
        type,
        hp: type.fixedHp ? type.hp : type.hp * hpMul * (elite ? 10 : 1),
        damage: type.damage * damageMul * (elite ? 1.5 : 1),
        speed: type.speed * (elite ? 0.9 : 1),
        elite,
    });
}

export function enlist(scene, e, fields) {
    Object.assign(e, {
        z: 3, isEnemy: true, flash: 0, slow: 0, stun: 0, kbx: 0, kby: 0,
        age: 0, phase: rand(TAU), facing: 1, shotTimer: rand(1, 2.5),
    }, fields);
    e.maxHp = e.hp;
    scene.addEntity(e);
    scene.enemies.push(e);
    return e;
}

// Spawn just outside the visible area, on a ring around the player.
export function ringPoint(scene, extra = 24, angle = rand(TAU)) {
    const r = viewRadius() + extra, p = scene.player.position;
    return [p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r];
}

export function updateEnemies(scene, dt) {
    const p = scene.player.position;
    const leash = viewRadius() + 160;
    for (const e of scene.enemies) {
        if (e.dead) continue;
        e.age += dt;
        e.flash = Math.max(0, e.flash - dt);
        e.slow = Math.max(0, e.slow - dt);
        if (e.boss) {
            updateBoss(scene, e, dt);
            continue;
        }
        if (e.type.lifetime && e.age > e.type.lifetime) {
            spawnFx(scene, "puff", e.position.x, e.position.y, { scale: 2 });
            scene.remove(e);
            continue;
        }
        let vx = 0, vy = 0;
        const dx = p.x - e.position.x, dy = p.y - e.position.y, d = Math.hypot(dx, dy) || 1;
        if (e.stun > 0) {
            e.stun -= dt;
        } else if (e.flock) {
            vx = e.dirx * e.speed;
            vy = e.diry * e.speed;
            if (e.age > 9) scene.remove(e);
        } else {
            let speed = e.speed * (e.slow > 0 ? 0.5 : 1);
            if (e.type.hop) speed *= 0.3 + 1.4 * Math.max(0, Math.sin(e.age * 6 + e.phase));
            let dirx = dx / d, diry = dy / d;
            if (e.type.ranged) shootAtPlayer(scene, e, d, dirx, diry, dt);
            if (e.type.ranged && d < e.type.ranged.range * 0.8) { dirx = -dirx * 0.6; diry = -diry * 0.6; }
            if (e.type.wobble) {
                const w = Math.sin(e.age * 3 + e.phase) * 0.7;
                [dirx, diry] = [dirx - diry * w, diry + dirx * w];
            }
            vx = dirx * speed;
            vy = diry * speed;
            if (d > leash) relocate(scene, e, dx, dy);
        }
        e.body.velocity.x = vx + e.kbx;
        e.body.velocity.y = vy + e.kby;
        e.kbx *= 0.82;
        e.kby *= 0.82;

        if (Math.abs(vx) > 1) e.facing = vx > 0 ? 1 : -1;
        e.animator.play(`${e.flash > 0 ? "hit" : ""}${e.facing > 0 ? "R" : "L"}`);
    }
}

// Enemies left far behind reappear ahead of the player, like in the classics.
function relocate(scene, e, dx, dy) {
    const [x, y] = ringPoint(scene, 20, Math.atan2(dy, dx) + rand(-0.6, 0.6));
    e.position.x = x;
    e.position.y = y;
}

function shootAtPlayer(scene, e, d, dirx, diry, dt) {
    const r = e.type.ranged;
    e.shotTimer -= dt;
    if (e.shotTimer > 0 || d > r.range * 1.5) return;
    e.shotTimer = r.cooldown;
    spawnEnemyShot(scene, e.position.x, e.position.y, dirx * r.speed, diry * r.speed, r.damage * scene.stage.difficulty.damage, r.sprite ?? "bloodOrb", r.aligned);
}

// `aligned` turns the sprite to face its flight direction (blades, spears).
export function spawnEnemyShot(scene, x, y, vx, vy, damage, spriteId, aligned = false) {
    const s = new Entity({
        sprite: new Sprite({ texture: SPRITES[spriteId] }),
        position: new Vector2(x, y),
        rotation: aligned ? Math.atan2(vy, vx) : 0,
        body: new RigidBody({ velocity: new Vector2(vx, vy), sleepThreshold: 0 }),
        collider: new CircleCollider({ radius: 3, isTrigger: true, layer: LAYER.EPROJ, mask: LAYER.PLAYER }),
    });
    Object.assign(s, { z: 4, isEnemyShot: true, damage, life: 6 });
    scene.addEntity(s);
    scene.enemyShots.push(s);
    return s;
}

export function updateEnemyShots(scene, dt) {
    for (const s of scene.enemyShots) {
        s.life -= dt;
        if (s.life <= 0) scene.remove(s);
    }
}

// Every source of damage goes through here.
export function damageEnemy(scene, e, amount, { kb = 0, fromX, fromY, slow = 0, stun = 0 } = {}) {
    if (e.dead || amount <= 0) return;
    e.hp -= amount;
    e.flash = 0.1;
    damageNumber(scene, e.position.x, e.position.y - e.collider.radius - 8, amount, e.boss ? "#f0c24b" : "#f3eee0");
    if (kb && fromX !== undefined) {
        const resist = e.boss ? 0.05 : e.elite ? 0.3 : 1;
        const dx = e.position.x - fromX, dy = e.position.y - fromY, d = Math.hypot(dx, dy) || 1;
        e.kbx += (dx / d) * kb * resist;
        e.kby += (dy / d) * kb * resist;
    }
    if (slow) e.slow = Math.max(e.slow, slow);
    if (stun && !e.boss) e.stun = Math.max(e.stun, stun);
    sfx.hit();
    if (e.hp <= 0) killEnemy(scene, e);
}

export function killEnemy(scene, e) {
    if (e.dead) return;
    scene.remove(e);
    scene.kills++;
    const { x, y } = e.position;
    spawnFx(scene, "puff", x, y, { scale: e.boss ? 3 : e.elite ? 1.6 : 1 });
    burst(scene, x, y, e.boss ? "#f0c24b" : "#c8ff8a", e.boss ? 30 : 5);
    sfx.kill();
    if (e.boss) {
        onBossKilled(scene, e);
        return;
    }
    // Illusions (no qi) leave nothing behind.
    if (!e.type.qi) return;
    if (e.elite) {
        if (Math.random() < 0.5) spawnItem(scene, "chest", x, y);
        else spawnQi(scene, x, y, 12);
    } else {
        spawnQi(scene, x, y, e.type.qi);
    }
    const roll = Math.random();
    if (roll < 0.006) spawnItem(scene, "peach", x, y);
    else if (roll < 0.0075) spawnItem(scene, "vortex", x, y);
}
