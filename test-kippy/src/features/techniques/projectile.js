import { Entity, RigidBody, CircleCollider, Vector2 } from "../../shared/kippy.js";
import { LAYER } from "../../shared/layers.js";
import { damageEnemy } from "../enemies/enemy.js";

// A player projectile: a Kippy trigger collider moved by its rigid body.
// Each enemy is hit at most once per projectile; `pierce` hits use it up.
export function projectile(scene, {
    sprite, animator, x, y, vx = 0, vy = 0, radius, damage, pierce = 1, life = 2,
    rotation = 0, spin = 0, kb = 30, onHit, hits = new Set(), z = 4,
}) {
    const e = new Entity({
        sprite,
        animator,
        position: new Vector2(x, y),
        rotation,
        body: new RigidBody({ velocity: new Vector2(vx, vy), rotationVelocity: spin, sleepThreshold: 0 }),
        collider: new CircleCollider({ radius, isTrigger: true, layer: LAYER.PROJ, mask: LAYER.ENEMY }),
    });
    Object.assign(e, { z, damage, pierce, life, hits, kb });
    e.onTriggerEnter = other => {
        if (e.dead || other.dead || !other.isEnemy || e.hits.has(other)) return;
        e.hits.add(other);
        if (onHit) onHit(other);
        else damageEnemy(scene, other, e.damage, { kb: e.kb, fromX: e.position.x, fromY: e.position.y });
        if (--e.pierce <= 0) scene.remove(e);
    };
    scene.addEntity(e);
    scene.projectiles.push(e);
    return e;
}

export function updateProjectiles(scene, dt) {
    for (const pr of scene.projectiles) {
        if (pr.dead) continue;
        pr.tick?.(dt);
        pr.life -= dt;
        if (pr.life <= 0) {
            pr.onExpire?.();
            scene.remove(pr);
        }
    }
}
