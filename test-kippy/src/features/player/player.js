import { Entity, RigidBody, CircleCollider, Vector2 } from "../../shared/kippy.js";
import { LAYER } from "../../shared/layers.js";
import { actor, makeAnimator } from "../art/atlas.js";
import { qiToNext } from "../progression/realms.js";

export function createPlayer(scene, character) {
    const p = new Entity({
        animator: makeAnimator(actor(character.art)),
        position: new Vector2(0, 0),
        body: new RigidBody({ mass: 20, sleepThreshold: 0 }),
        collider: new CircleCollider({ radius: 5, offset: new Vector2(0, 3), layer: LAYER.PLAYER, mask: LAYER.ENEMY | LAYER.EPROJ }),
    });
    Object.assign(p, {
        z: 3,
        isPlayer: true,
        character,
        level: 1,
        qi: 0,
        qiNext: qiToNext(1),
        realm: 0,
        bonusMight: 0,
        techniques: [],
        treasures: [],
        facing: 1,
        aim: new Vector2(1, 0),
        moving: false,
        hurtCd: 0,
        flash: 0,
        glowTimer: 0,
        stats: null,
        hp: 0,
    });
    computeStats(p);
    p.hp = p.stats.maxHp;

    // Kippy collision callbacks: enemies hurt on contact, enemy shots on overlap.
    p.onCollisionEnter = p.onCollisionStay = other => {
        if (other.isEnemy && !other.dead && other.damage > 0) scene.hurtPlayer(other.damage);
    };
    // Persistent shots (the Frost Dragon's body) keep hurting while you stay in them.
    p.onTriggerEnter = p.onTriggerStay = other => {
        if (other.isEnemyShot && !other.dead) {
            scene.hurtPlayer(other.damage);
            if (!other.persistent) scene.remove(other);
        }
    };
    scene.addEntity(p);
    return p;
}

// Base stats -> treasures -> realm bonuses. Called whenever any of them change.
export function computeStats(p) {
    const base = p.character.stats;
    const s = {
        maxHp: base.maxHp, regen: base.regen ?? 0, armor: base.armor ?? 0, speed: base.speed,
        might: base.might ?? 1, cooldown: base.cooldown ?? 1, area: 1, amount: 0, magnet: 34, growth: 1,
        maxHpMul: 1, speedMul: 1, magnetMul: 1,
    };
    for (const t of p.treasures) t.def.apply(s, t.level);
    s.might += 0.06 * p.realm + p.bonusMight;
    s.maxHp += 10 * p.realm;
    s.speedMul += 0.03 * p.realm;
    s.maxHp = Math.round(s.maxHp * s.maxHpMul);
    s.speed *= s.speedMul;
    s.magnet *= s.magnetMul;

    const gained = p.stats ? s.maxHp - p.stats.maxHp : 0;
    p.stats = s;
    if (gained > 0) p.hp += gained;
    p.hp = Math.min(p.hp, s.maxHp);
}

// On ice the cultivator keeps momentum: velocity eases toward the input instead of snapping.
export function updatePlayer(p, dt, moveX, moveY, onIce = false) {
    const len = Math.hypot(moveX, moveY);
    p.moving = len > 0;
    if (p.moving) {
        moveX /= len;
        moveY /= len;
        p.aim.x = moveX;
        p.aim.y = moveY;
        if (Math.abs(moveX) > 0.2) p.facing = moveX > 0 ? 1 : -1;
    }
    const vx = moveX * p.stats.speed * (onIce ? 1.25 : 1), vy = moveY * p.stats.speed * (onIce ? 1.25 : 1);
    const grip = onIce ? 1 - Math.exp(-dt * 2.2) : 1;
    p.body.velocity.x += (vx - p.body.velocity.x) * grip;
    p.body.velocity.y += (vy - p.body.velocity.y) * grip;

    p.hurtCd = Math.max(0, p.hurtCd - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.regen * dt);

    p.glowTimer = Math.max(0, p.glowTimer - dt);
    p.glow = p.glowTimer > 0 ? { color: p.character.aura, bloom: 10, intensity: 2 } : undefined;

    p.animator.play(`${p.flash > 0 ? "hit" : ""}${p.facing > 0 ? "R" : "L"}`);
    if (p.moving) {
        p.animator.stopped = false;
    } else {
        p.animator.stopped = true;
        p.animator.frameIndex = 0;
    }
}
