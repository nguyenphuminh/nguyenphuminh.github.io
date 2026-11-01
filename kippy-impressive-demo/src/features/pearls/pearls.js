import { Entity, Sprite, RigidBody, CircleCollider, Vector2 } from "kippy";
import { LAYER, MASK } from "../../core/layers.js";
import { TAU } from "../../core/math.js";
import { makeCanvas, glowSprite } from "../../core/paint.js";
import { isRock } from "../level/field.js";

export const CARRY = 3;
const THROW = 560;
const RINGS = 3;
const PENTATONIC = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];

function pearlTexture() {
    const c = makeCanvas(24, 24);
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(9, 9, 1, 12, 12, 11);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.45, "#e6ddff");
    grad.addColorStop(0.8, "#9fd8e6");
    grad.addColorStop(1, "rgba(120, 180, 200, 0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(12, 12, 11, 0, TAU);
    g.fill();
    return c;
}

// Echo pearls: picked up from nooks, thrown, bounce off rock, then ring three times
// (a loud lure and a small sonar song), after which they can be picked up again.
export function createPearls(world) {
    const texture = pearlTexture();
    const list = [];
    for (const p of world.level.pearls) list.push(rest(newEntity(p.x, p.y)));

    function newEntity(x, y) {
        const e = new Entity({
            position: new Vector2(x, y),
            sprite: new Sprite({ texture, width: 13, height: 13 }),
            glow: { color: "rgba(210, 230, 255, 0.8)", bloom: 8, intensity: 1 }
        });
        e.kind = "pearl";
        return e;
    }

    function rest(entity, P = { entity }) {
        entity.body = undefined;
        entity.collider = new CircleCollider({ radius: 14, isTrigger: true, layer: LAYER.PICKUP, mask: MASK.PLAYER_ONLY });
        entity.onCollisionEnter = undefined;
        entity.onTriggerEnter = entity.onTriggerStay = (other) => {
            if (other.kind === "player" && P.state === "rest") collect(P);
        };
        P.state = "rest";
        P.sparkT = -99;
        if (!P.echo) {
            P.echo = { x: 0, y: 0, radius: 9, onEcho: (delay) => (P.sparkT = world.time + delay) };
        }
        P.echo.x = entity.position.x;
        P.echo.y = entity.position.y;
        world.sonar.track(P.echo);
        world.dirty = true;
        return P;
    }

    function collect(P) {
        const s = world.player.state;
        if (s.pearls >= CARRY) return;
        s.pearls++;
        P.state = "gone";
        list.splice(list.indexOf(P), 1);
        world.sonar.untrack(P.echo);
        world.dirty = true;
        const { x, y } = P.entity.position;
        world.sfx.play("pluck", { pitch: PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] });
        world.particles.burst(x, y, 16, { speed: 90, color: "rgba(220, 230, 255, 0.9)", life: 0.7, size: 5 });
        world.events.emit("pearl-collected");
    }

    function throwPearl(x, y, dx, dy, vel) {
        const sx = isRock(world.level, x + dx * 12, y + dy * 12) ? x : x + dx * 12;
        const sy = sx === x ? y : y + dy * 12;
        const entity = newEntity(sx, sy);
        entity.body = new RigidBody({ mass: 0.3, restitution: 0.65, sleepThreshold: 0, velocity: new Vector2(dx * THROW + vel.x * 0.4, dy * THROW + vel.y * 0.4) });
        entity.collider = new CircleCollider({ radius: 5, layer: LAYER.PEARL, mask: MASK.PEARL });
        const P = { entity, state: "fly", t: 0, rings: 0, next: 0 };
        entity.onCollisionEnter = (other) => {
            if (other.kind !== "wall" || P.state !== "fly") return;
            const v = Math.hypot(entity.body.velocity.x, entity.body.velocity.y);
            if (v < 80) return;
            world.sfx.play("tick", { x: entity.position.x, y: entity.position.y, pitch: 1.5 + Math.random() });
            world.noise.emit(entity.position.x, entity.position.y, 150, "pearl");
        };
        list.push(P);
        world.dirty = true;
        world.sfx.play("dash", { volume: 0.4, pitch: 1.8 });
        return true;
    }

    function ring(P) {
        const { x, y } = P.entity.position;
        world.sfx.play("bell", { x, y, volume: 0.9, pitch: 1.2 + P.rings * 0.12, range: 1800 });
        world.noise.emit(x, y, 900, "pearl");
        world.sonar.cast(x, y, 0.38, { source: "pearl" });
        world.flash(x, y, 140, 0.6);
        world.particles.burst(x, y, 20, { speed: 140, color: "rgba(210, 230, 255, 0.9)", life: 0.8, size: 5 });
    }

    function update(dt) {
        for (const P of list.slice()) {
            const body = P.entity.body;
            if (P.state === "fly") {
                P.t += dt;
                body.force.x -= body.velocity.x * 0.8 * body.mass;
                body.force.y -= body.velocity.y * 0.8 * body.mass;
                if (Math.hypot(body.velocity.x, body.velocity.y) < 40 || P.t > 1.6) {
                    P.state = "ring";
                    P.t = 0;
                    P.next = 0.15;
                }
            } else if (P.state === "ring") {
                P.t += dt;
                body.force.x -= body.velocity.x * 4 * body.mass;
                body.force.y -= body.velocity.y * 4 * body.mass;
                if (P.t >= P.next) {
                    ring(P);
                    P.rings++;
                    P.next += 1;
                    if (P.rings >= RINGS) rest(P.entity, P);
                }
            }
        }
    }

    function renderOver(ctx) {
        const pp = world.player.entity.position;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const P of list) {
            const { x, y } = P.entity.position;
            let a = 0;
            if (P.state === "ring") a = 0.6 + 0.4 * Math.sin(P.t * 14);
            else if (P.state === "fly") a = 0.7;
            else {
                const near = Math.max(0, 1 - Math.hypot(x - pp.x, y - pp.y) / 380);
                const spark = world.time >= P.sparkT && world.time - P.sparkT < 2.5 ? 1 - (world.time - P.sparkT) / 2.5 : 0;
                a = Math.max(near * (0.35 + 0.25 * Math.sin(world.time * 3 + x)), spark);
            }
            if (a <= 0.01) continue;
            const s = P.state === "ring" ? 26 : 14;
            ctx.globalAlpha = a;
            ctx.drawImage(glowSprite("rgba(225, 235, 255, 1)"), x - s, y - s, s * 2, s * 2);
        }
        ctx.restore();
    }

    function lights(out) {
        for (const P of list) {
            const { x, y } = P.entity.position;
            if (P.state === "ring") out.push({ x, y, r: 100, i: 0.7, color: "rgba(200, 225, 255, 0.2)" });
            else if (P.state === "fly") out.push({ x, y, r: 45, i: 0.4 });
        }
    }

    return {
        get entities() {
            return list.map((P) => P.entity);
        },
        get flying() {
            return list.filter((P) => P.state !== "rest").map((P) => P.entity.position);
        },
        throwPearl,
        update,
        renderOver,
        lights
    };
}
