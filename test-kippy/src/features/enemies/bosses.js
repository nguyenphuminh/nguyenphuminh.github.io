import { Entity, RigidBody, CircleCollider, Sprite, Vector2 } from "../../shared/kippy.js";
import { LAYER } from "../../shared/layers.js";
import { rand, pick, TAU } from "../../shared/math.js";
import { sfx } from "../../shared/audio.js";
import { actor, makeAnimator, sprite, SPRITES, warnRingTexture } from "../art/atlas.js";
import { spawnFx, shake, flash, banner, burst } from "../effects/effects.js";
import { spawnQi, spawnItem } from "../progression/pickups.js";
import { BOSSES } from "./enemyTypes.js";
import { enlist, ringPoint, spawnEnemy, spawnEnemyShot } from "./enemy.js";

export function spawnBoss(scene, id) {
    const def = BOSSES[id];
    const p = scene.player.position;
    // The storm hangs in the sky and the dragon flies: neither has a body to shove.
    const floating = def.behavior === "storm" || def.behavior === "frost";
    const [x, y] = def.behavior === "storm" ? [p.x, p.y - 220] : ringPoint(scene, 10);
    const e = new Entity({
        animator: makeAnimator(actor(def.art, def.scale)),
        position: new Vector2(x, y),
        body: floating ? undefined : new RigidBody({ mass: def.mass, sleepThreshold: 0 }),
        collider: new CircleCollider({
            radius: def.radius,
            layer: LAYER.ENEMY,
            mask: def.behavior === "storm" ? LAYER.PROJ : floating || def.ghost ? LAYER.PLAYER | LAYER.PROJ : LAYER.ENEMY | LAYER.PLAYER | LAYER.PROJ,
        }),
        glow: def.glow,
    });
    // Bosses grow with the cultivator they hunt.
    const hp = def.hp * (0.7 + 0.03 * scene.player.level);
    enlist(scene, e, {
        boss: true, def, hp, damage: def.damage * scene.stage.difficulty.damage, speed: def.speed,
        mode: "walk", timer: 3, cycle: 0, summonTimer: 8,
    });
    if (floating) e.z = 6;
    if (def.final) clearTheField(scene, def.color);
    if (def.behavior === "frost") growDragonBody(scene, e);
    scene.boss = e;
    banner(scene, def.name, def.subtitle, def.color, 3.2);
    shake(scene, 3, 0.6);
    sfx.boss();
    return e;
}

const BEHAVIORS = { leap: leaper, dash: dasher, blink: blinker, storm, bone: boneDemon, frost: frostDragon };

export function updateBoss(scene, e, dt) {
    const p = scene.player.position;
    const dx = p.x - e.position.x, dy = p.y - e.position.y, d = Math.hypot(dx, dy) || 1;
    BEHAVIORS[e.def.behavior](scene, e, dt, dx / d, dy / d, d);
    if (e.body && e.mode !== "leap" && e.mode !== "dash") {
        if (Math.abs(e.body.velocity.x) > 1) e.facing = e.body.velocity.x > 0 ? 1 : -1;
    }
    e.animator.play(`${e.flash > 0 ? "hit" : ""}${e.facing > 0 ? "R" : "L"}`);
}

function setVelocity(e, vx, vy) {
    e.body.velocity.x = vx;
    e.body.velocity.y = vy;
}

function summonTick(scene, e, dt, summon) {
    if (!summon) return;
    e.summonTimer -= dt;
    if (e.summonTimer > 0) return;
    e.summonTimer = summon.every;
    for (let i = 0; i < summon.count; i++) {
        spawnEnemy(scene, summon.type, e.position.x + rand(-24, 24), e.position.y + rand(-24, 24));
    }
}

// Boss projectiles: a full ring, or a fan aimed at the player.
function shoot(scene, e, atk) {
    const damage = atk.damage * scene.stage.difficulty.damage, { x, y } = e.position;
    if (atk.kind === "ring") {
        const off = rand(TAU);
        for (let i = 0; i < atk.count; i++) {
            const a = off + (i / atk.count) * TAU;
            spawnEnemyShot(scene, x, y, Math.cos(a) * atk.speed, Math.sin(a) * atk.speed, damage, atk.sprite, atk.aligned);
        }
        return;
    }
    const p = scene.player.position, base = Math.atan2(p.y - y, p.x - x);
    for (let i = 0; i < atk.count; i++) {
        const a = base + (atk.count > 1 ? (i / (atk.count - 1) - 0.5) * atk.spread * 2 : 0);
        spawnEnemyShot(scene, x, y, Math.cos(a) * atk.speed, Math.sin(a) * atk.speed, damage, atk.sprite, atk.aligned);
    }
}

// Lumbers after you, then leaps onto a marked spot and calls up its kin.
function leaper(scene, e, dt, ux, uy) {
    const cfg = e.def.leap;
    e.timer -= dt;
    if (e.mode === "walk") {
        setVelocity(e, ux * e.speed, uy * e.speed);
        if (e.timer <= 0) {
            e.mode = "aim";
            e.timer = 0.9;
            e.target = scene.player.position.copy();
            telegraph(scene, e.target.x, e.target.y, 34, 1.35);
            setVelocity(e, 0, 0);
        }
    } else if (e.mode === "aim") {
        setVelocity(e, 0, 0);
        if (e.timer <= 0) {
            e.mode = "leap";
            e.timer = 0.45;
            e.leap = new Vector2((e.target.x - e.position.x) / 0.45, (e.target.y - e.position.y) / 0.45);
            e.facing = e.leap.x > 0 ? 1 : -1;
        }
    } else if (e.mode === "leap") {
        setVelocity(e, e.leap.x, e.leap.y);
        if (e.timer <= 0) {
            e.mode = "walk";
            e.timer = 4.2;
            setVelocity(e, 0, 0);
            const { x, y } = e.position;
            spawnFx(scene, "goldRing", x, y, { scale: 1.2, z: 1 });
            burst(scene, x, y, "#a9c7a0", 20, 120);
            shake(scene, 5, 0.35);
            sfx.explode();
            if (scene.player.position.distance(e.position) < 40) scene.hurtPlayer(e.damage * 1.4);
            for (let i = 0; i < cfg.count; i++) {
                const a = (i / cfg.count) * TAU;
                spawnEnemy(scene, cfg.summon, x + Math.cos(a) * 30, y + Math.sin(a) * 30);
            }
        }
    }
}

// Circles you, then dashes along a marked line; fires every other cycle (or every cycle).
function dasher(scene, e, dt, ux, uy) {
    const cfg = e.def.dash;
    e.timer -= dt;
    summonTick(scene, e, dt, cfg.summon);
    if (e.mode === "walk") {
        e.orbit = (e.orbit ?? rand(TAU)) + dt * 0.9;
        const p = scene.player.position;
        const tx = p.x + Math.cos(e.orbit) * cfg.orbit - e.position.x, ty = p.y + Math.sin(e.orbit) * cfg.orbit - e.position.y;
        const td = Math.hypot(tx, ty) || 1;
        setVelocity(e, (tx / td) * e.speed * 1.4, (ty / td) * e.speed * 1.4);
        if (e.timer <= 0) {
            e.mode = "aim";
            e.timer = 0.65;
            e.dash = new Vector2(ux, uy);
            e.warn = lineWarn(scene, e.position, e.dash, 300);
            setVelocity(e, 0, 0);
        }
    } else if (e.mode === "aim") {
        setVelocity(e, 0, 0);
        if (e.timer <= 0) {
            scene.remove(e.warn);
            e.mode = "dash";
            e.timer = 0.75;
            e.facing = e.dash.x > 0 ? 1 : -1;
            sfx.swing();
        }
    } else if (e.mode === "dash") {
        setVelocity(e, e.dash.x * cfg.speed, e.dash.y * cfg.speed);
        burst(scene, e.position.x, e.position.y, e.def.color, 2, 30);
        if (e.timer <= 0) {
            e.mode = "walk";
            e.timer = 3.2;
            if (cfg.everyCycle || ++e.cycle % 2 === 0) shoot(scene, e, cfg.attack);
        }
    }
}

// Drowned Bride: drifts after you, vanishes, and reappears on a marked spot in a burst of ghost fire.
function blinker(scene, e, dt, ux, uy) {
    const cfg = e.def.blink;
    e.timer -= dt;
    summonTick(scene, e, dt, cfg.summon);
    if (e.mode === "walk") {
        setVelocity(e, ux * e.speed, uy * e.speed);
        if (e.timer <= 0) {
            const a = rand(TAU), p = scene.player.position;
            e.mode = "aim";
            e.timer = 0.8;
            e.target = new Vector2(p.x + Math.cos(a) * 75, p.y + Math.sin(a) * 75);
            telegraph(scene, e.target.x, e.target.y, 16, 0.8, "255, 138, 138");
            setVelocity(e, 0, 0);
        }
    } else if (e.mode === "aim") {
        setVelocity(e, 0, 0);
        if (e.timer <= 0) {
            spawnFx(scene, "puff", e.position.x, e.position.y, { scale: 2.5 });
            e.position.x = e.target.x;
            e.position.y = e.target.y;
            spawnFx(scene, "puff", e.position.x, e.position.y, { scale: 2.5 });
            shoot(scene, e, { kind: "ring", ...cfg.ring });
            sfx.swing();
            e.mode = "walk";
            e.timer = cfg.every;
        }
    }
}

// White Bone Demon: keeps her distance hurling bone spears and raising soldiers;
// below half health she blinks around and leaves illusions of herself behind.
function boneDemon(scene, e, dt, ux, uy, d) {
    const enraged = e.hp < e.maxHp / 2;
    const toward = d > 115 ? 1 : d < 80 ? -0.7 : 0;
    setVelocity(e, (ux * toward - uy * 0.45) * e.speed, (uy * toward + ux * 0.45) * e.speed);
    e.timer -= dt;
    if (e.timer <= 0) {
        e.timer = enraged ? 2 : 2.8;
        shoot(scene, e, { kind: "volley", sprite: "boneSpear", count: enraged ? 8 : 5, spread: 0.7, speed: 125, damage: 12, aligned: true });
    }
    e.summonTimer -= dt;
    if (e.summonTimer <= 0) {
        e.summonTimer = 8;
        const p = scene.player.position;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU, x = p.x + Math.cos(a) * 70, y = p.y + Math.sin(a) * 70;
            spawnFx(scene, "puff", x, y, { scale: 1.5 });
            spawnEnemy(scene, "boneSoldier", x, y);
        }
    }
    if (!enraged) return;
    e.blinkTimer = (e.blinkTimer ?? 1.5) - dt;
    if (e.blinkTimer > 0) return;
    e.blinkTimer = 9;
    const p = scene.player.position, a = rand(TAU), tx = p.x + Math.cos(a) * 90, ty = p.y + Math.sin(a) * 90;
    telegraph(scene, tx, ty, 18, 0.7, "201, 182, 255");
    scene.later(0.7, () => {
        if (e.dead) return;
        spawnFx(scene, "puff", e.position.x, e.position.y, { scale: 3 });
        e.position.x = tx;
        e.position.y = ty;
        for (let i = 0; i < 2; i++) {
            const b = rand(TAU);
            spawnFx(scene, "puff", tx + Math.cos(b) * 60, ty + Math.sin(b) * 60, { scale: 3 });
            spawnEnemy(scene, "boneDecoy", tx + Math.cos(b) * 60, ty + Math.sin(b) * 60);
        }
        sfx.swing();
    });
}

// Frost Dragon: coils around you. Its body hurts to touch; it breathes fans of
// ice shards and calls ice spikes up from marked ground.
function growDragonBody(scene, e) {
    e.trail = [];
    e.angle = Math.atan2(e.position.y - scene.player.position.y, e.position.x - scene.player.position.x);
    e.segments = Array.from({ length: 10 }, (_, i) => {
        const size = 1 - i * 0.05;
        const seg = new Entity({
            sprite: sprite("frostBody", 2.2 * size),
            position: e.position.copy(),
            collider: new CircleCollider({ radius: 8 * size, isTrigger: true, layer: LAYER.EPROJ, mask: LAYER.PLAYER }),
        });
        Object.assign(seg, { z: 5, isEnemyShot: true, persistent: true, damage: e.damage * 0.8 });
        scene.addEntity(seg);
        return seg;
    });
    e.onDeath = () => e.segments.forEach(s => scene.remove(s));
    e.spikeTimer = 5;
}

function frostDragon(scene, e, dt) {
    const p = scene.player.position, enraged = e.hp < e.maxHp / 2;
    e.angle += dt * (enraged ? 1.5 : 1.1);
    const r = 120 + Math.sin(scene.time * 0.7) * 30;
    const vx = (p.x + Math.cos(e.angle) * r - e.position.x) * 2.2, vy = (p.y + Math.sin(e.angle) * r * 0.75 - e.position.y) * 2.2;
    e.position.x += vx * dt;
    e.position.y += vy * dt;
    if (Math.abs(vx) > 1) e.facing = vx > 0 ? 1 : -1;
    e.rotation = Math.atan2(vy, vx) + (e.facing < 0 ? Math.PI : 0);
    e.trail.push([e.position.x, e.position.y]);
    if (e.trail.length > 80) e.trail.shift();
    e.segments.forEach((seg, i) => {
        const pt = e.trail[Math.max(0, e.trail.length - 1 - (i + 1) * 5)];
        seg.position.x = pt[0];
        seg.position.y = pt[1];
    });
    e.timer -= dt;
    if (e.timer <= 0) {
        e.timer = enraged ? 2.6 : 3.6;
        shoot(scene, e, { kind: "volley", sprite: "iceShard", count: enraged ? 11 : 7, spread: 0.9, speed: 115, damage: 14, aligned: true });
    }
    e.spikeTimer -= dt;
    if (e.spikeTimer <= 0) {
        e.spikeTimer = enraged ? 5 : 7;
        strikeAt(scene, p.x, p.y, 20, 1.1, 20, "ice");
        for (let i = 1; i < (enraged ? 8 : 5); i++) {
            const a = rand(TAU), d = rand(25, 100);
            strikeAt(scene, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 20, 1.1 + rand(0, 0.4), 20, "ice");
        }
    }
    summonTick(scene, e, dt, { type: "snowWolf", count: 3, every: 6 });
}

// Heavenly Tribulation: hangs over you and calls down marked lightning, faster as it weakens.
function storm(scene, e, dt) {
    const p = scene.player.position;
    const follow = Math.min(1, dt * 1.6);
    e.position.x += (p.x - e.position.x) * follow;
    e.position.y += (p.y - 56 - e.position.y) * follow;
    const frac = e.hp / e.maxHp;
    e.timer -= dt;
    if (e.timer <= 0) {
        e.timer = frac > 0.5 ? 2.3 : frac > 0.25 ? 1.7 : 1.25;
        const strikes = frac > 0.5 ? 4 : frac > 0.25 ? 6 : 8;
        const v = scene.player.body.velocity;
        strikeAt(scene, p.x + v.x * 0.5, p.y + v.y * 0.5, 20, 1.0, 22);
        for (let i = 1; i < strikes; i++) {
            const a = rand(TAU), r = rand(25, 110);
            strikeAt(scene, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 20, 1.0 + rand(0, 0.4), 22);
        }
    }
    e.summonTimer -= dt;
    if (e.summonTimer <= 0) {
        e.summonTimer = frac > 0.5 ? 1.6 : 1.1;
        for (let i = 0; i < 2; i++) {
            const [x, y] = ringPoint(scene, 10);
            spawnEnemy(scene, "thunderSprite", x, y);
        }
    }
    if (Math.random() < dt * 0.25) flash(scene, 0.35, "#fff6a8");
}

// A final boss arrives on an empty field: every lesser demon is swept away.
function clearTheField(scene, color) {
    for (const e of scene.enemies) {
        if (e.boss || e.dead) continue;
        spawnFx(scene, "puff", e.position.x, e.position.y);
        scene.remove(e);
    }
    flash(scene, 0.9, color);
    shake(scene, 6, 0.8);
    sfx.thunder();
}

function telegraph(scene, x, y, r, time, rgb) {
    const w = new Entity({ sprite: new Sprite({ texture: warnRingTexture(r, rgb) }), position: new Vector2(x, y) });
    w.z = 1;
    w.warnRadius = r;
    scene.addEntity(w);
    scene.later(time, () => scene.remove(w));
    return w;
}

function lineWarn(scene, from, dir, length) {
    const w = new Entity({
        sprite: new Sprite({ texture: SPRITES.lineWarn, width: length, height: 8 }),
        position: new Vector2(from.x + dir.x * length / 2, from.y + dir.y * length / 2),
        rotation: Math.atan2(dir.y, dir.x),
    });
    w.z = 1;
    scene.addEntity(w);
    return w;
}

// A marked strike: lightning from above, or ice spikes from below.
function strikeAt(scene, x, y, r, delay, damage, style = "thunder") {
    const ice = style === "ice";
    telegraph(scene, x, y, r, delay, ice ? "196, 236, 255" : "255, 246, 168");
    scene.later(delay, () => {
        if (ice) spawnFx(scene, "iceBurst", x, y - 6, { scale: 2, z: 7 });
        else spawnFx(scene, pick(["tribBoltA", "tribBoltB", "tribBoltC"]), x, y - 85, { z: 7 });
        spawnFx(scene, "shock", x, y, { z: 1 });
        burst(scene, x, y, ice ? "#c4ecff" : "#fff6a8", 8, 90);
        if (ice) sfx.explode();
        else sfx.thunder();
        if (scene.player.position.distance(new Vector2(x, y)) < r + 5) scene.hurtPlayer(damage * scene.stage.difficulty.damage);
    });
}

export function onBossKilled(scene, e) {
    e.onDeath?.();
    // Another boss may still be up (e.g. a mini-boss outliving the 15:00 mark).
    if (scene.boss === e) scene.boss = scene.enemies.find(o => o.boss && !o.dead) ?? null;
    const { x, y } = e.position;
    shake(scene, 6, 0.8);
    flash(scene, 0.7, e.def.color);
    sfx.explode();
    if (e.def.final) {
        scene.later(1.2, () => scene.win());
        return;
    }
    spawnItem(scene, "chest", x, y);
    for (let i = 0; i < 6; i++) spawnQi(scene, x + rand(-24, 24), y + rand(-24, 24), e.def.qi / 6);
    banner(scene, `${e.def.name} vanquished`, "A spirit chest awaits", e.def.color, 2.6);
}
