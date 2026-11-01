import { Entity, RigidBody, CircleCollider, Vector2 } from "kippy";
import { LAYER, MASK } from "../../core/layers.js";
import { TAU, angleLerp, damp } from "../../core/math.js";
import { visibilityPolygon } from "../level/field.js";
import { songNoise } from "../sonar/sonar.js";
import { makeLanternAnimator } from "./art.js";

export const MAX_LIGHTS = 3;
const SWIM = 215;
const GLIDE = 85;
const SILENT = 100; // slower than this, swimming makes no sound
const DASH = 560;
const CHARGE_TIME = 1.25;

// The Lantern: swims, glides, dashes, sings, throws pearls, and carries its light (health)
export function createPlayer(world) {
    const animator = makeLanternAnimator();
    animator.onEnd = (name) => {
        if (name === "sing") animator.play("swim");
    };

    const entity = new Entity({
        position: new Vector2(world.level.spawn.x, world.level.spawn.y),
        animator,
        body: new RigidBody({ mass: 1, restitution: 0.2, sleepThreshold: 0 }),
        collider: new CircleCollider({ radius: 8, layer: LAYER.PLAYER, mask: MASK.PLAYER }),
        glow: { color: "rgba(120, 235, 255, 0.9)", bloom: 12, intensity: 2 }
    });
    entity.kind = "player";
    const pos = entity.position;
    const body = entity.body;

    const s = {
        lights: MAX_LIGHTS,
        pearls: 0,
        invuln: 0,
        charge: 0,
        charging: false,
        full: false,
        hum: null,
        pingCd: 0,
        dashCd: 0,
        dashT: 0,
        noiseT: 0,
        trailT: 0,
        regenT: 0,
        beatT: 0,
        aimT: -99,
        px: 0,
        py: 0,
        lantern: 245,
        dead: false
    };

    entity.onCollisionEnter = (other, info) => {
        if (other.kind !== "wall" || s.dead) return;
        const impact = body.velocity.x * info.normal.x + body.velocity.y * info.normal.y;
        if (impact < 150) return;
        world.noise.emit(pos.x, pos.y, 140 + (impact - 150) * 0.6, "player", { ring: true });
        world.sfx.play("bump", { volume: Math.min(1, impact / 400) });
        world.particles.burst(info.contact.x, info.contact.y, 8, { speed: 90, color: "rgba(160, 220, 235, 0.7)", life: 0.5, size: 4 });
        world.shake(0.12);
    };

    function axis() {
        const i = world.input;
        const c = world.controls;
        let x = 0;
        let y = 0;
        if (c.down(i, "left")) x -= 1;
        if (c.down(i, "right")) x += 1;
        if (c.down(i, "up")) y -= 1;
        if (c.down(i, "down")) y += 1;
        const len = Math.hypot(x, y);
        return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    }

    function stopCharge() {
        s.hum?.fadeOut(0.08);
        s.hum = null;
        s.charging = false;
        s.full = false;
    }

    function sing(strength) {
        world.sonar.cast(pos.x, pos.y, strength, { source: "player" });
        world.noise.emit(pos.x, pos.y, songNoise(strength), "player", { ring: true });
        world.sfx.play("ping", { volume: 0.35 + 0.65 * strength, pitch: 1.25 - 0.45 * strength });
        animator.play("sing", true);
        world.kick(0.015 + 0.04 * strength);
        world.shake(0.15 * strength);
        world.flash(pos.x, pos.y, 140 + 220 * strength, 0.5);
        world.stats.songs++;
        s.pingCd = 0.35;
        world.events.emit("player-sang", { strength });
    }

    function dash(dir) {
        const a = dir.x || dir.y ? Math.atan2(dir.y, dir.x) : entity.rotation;
        body.velocity.x = Math.cos(a) * DASH + body.velocity.x * 0.25;
        body.velocity.y = Math.sin(a) * DASH + body.velocity.y * 0.25;
        s.dashT = 0.3;
        s.dashCd = 1.2;
        world.noise.emit(pos.x, pos.y, 420, "player", { ring: true });
        world.sfx.play("dash");
        world.particles.burst(pos.x, pos.y, 18, { speed: 160, color: "rgba(140, 235, 255, 0.9)", life: 0.5, size: 5, angle: a + Math.PI, spread: 1.2 });
        world.events.emit("player-dashed");
    }

    function throwPearl() {
        let a = entity.rotation;
        if (world.time - s.aimT < 2.5) {
            const target = world.camera.screenToWorld(world.input.pointer);
            a = Math.atan2(target.y - pos.y, target.x - pos.x);
        }
        if (world.pearls.throwPearl(pos.x, pos.y, Math.cos(a), Math.sin(a), body.velocity)) {
            s.pearls--;
            world.stats.pearlsThrown++;
            world.events.emit("pearl-thrown");
        }
    }

    function hurt(fromX, fromY) {
        if (s.invuln > 0 || s.dead || world.peaceful) return false;
        s.lights = Math.max(0, s.lights - 1);
        s.invuln = 1.6;
        world.stats.lightsLost++;
        const dx = pos.x - fromX;
        const dy = pos.y - fromY;
        const len = Math.hypot(dx, dy) || 1;
        body.velocity.x = (dx / len) * 420;
        body.velocity.y = (dy / len) * 420;
        world.sfx.play("hurt");
        world.shake(0.9);
        world.hurtFlash();
        world.particles.burst(pos.x, pos.y, 26, { speed: 220, color: "rgba(255, 90, 110, 0.9)", life: 0.7, size: 6 });
        world.events.emit("player-hurt");
        if (s.lights === 0) {
            s.dead = true;
            stopCharge();
            world.noise.setSteady(0);
            world.events.emit("player-died");
        }
        return true;
    }

    function update(dt) {
        const input = world.input;
        s.invuln = Math.max(0, s.invuln - dt);
        s.pingCd -= dt;
        s.dashCd -= dt;
        s.dashT -= dt;
        if (input.pointer.x !== s.px || input.pointer.y !== s.py) {
            s.px = input.pointer.x;
            s.py = input.pointer.y;
            s.aimT = world.time;
        }
        s.lantern = damp(s.lantern, s.dead ? 0 : 110 + 45 * s.lights, s.dead ? 1.2 : 3, dt);

        if (s.dead || world.locked) {
            body.force.x -= body.velocity.x * 2 * body.mass;
            body.force.y -= body.velocity.y * 2 * body.mass;
            stopCharge();
            world.noise.setSteady(0);
            return;
        }

        const dir = axis();
        const gliding = world.controls.down(input, "glide");
        const max = (gliding ? GLIDE : SWIM) * (s.charging ? 0.55 : 1);
        const gain = s.dashT > 0 ? 1 : dir.x || dir.y ? 5.5 : 1.6;
        body.force.x += (dir.x * max - body.velocity.x) * gain * body.mass;
        body.force.y += (dir.y * max - body.velocity.y) * gain * body.mass;

        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed > 25) entity.rotation = angleLerp(entity.rotation, Math.atan2(body.velocity.y, body.velocity.x), 1 - Math.exp(-10 * dt));

        const loud = !gliding && speed > SILENT ? (speed - SILENT) * 1.9 : 0;
        world.noise.setSteady(loud);
        s.noiseT -= dt;
        if (loud > 0 && s.noiseT <= 0) {
            s.noiseT = 0.2;
            world.noise.emit(pos.x, pos.y, loud, "player");
        }

        s.trailT -= dt;
        if (speed > 50 && s.trailT <= 0) {
            s.trailT = 0.04;
            const a = entity.rotation + Math.PI;
            world.particles.spawn(pos.x + Math.cos(a) * 9, pos.y + Math.sin(a) * 9, Math.cos(a) * 20, Math.sin(a) * 20, 0.7, 4, "rgba(120, 230, 255, 0.8)", 2);
            if (Math.random() < 0.08) world.particles.spawn(pos.x, pos.y, (Math.random() - 0.5) * 20, 0, 2.2, 3, "rgba(200, 240, 255, 0.5)", 1, 25);
        }

        if (world.controls.pressed(input, "dash") && s.dashCd <= 0) dash(dir);

        const held = world.controls.down(input, "sing") || input.isPointerDown(0);
        if (held && s.pingCd <= 0) {
            if (!s.charging) {
                s.charging = true;
                s.charge = 0;
                s.hum = world.sfx.sounds.hum.play({ loop: true, fadeIn: 0.1 });
            }
            s.charge = Math.min(1, s.charge + dt / CHARGE_TIME);
            if (s.hum) s.hum.pitch = 0.8 + s.charge;
            if (s.charge >= 1 && !s.full) {
                s.full = true;
                world.particles.burst(pos.x, pos.y, 16, { speed: 70, color: "rgba(180, 250, 255, 0.9)", life: 0.6, size: 5 });
            }
        } else if (s.charging) {
            const strength = Math.max(0.15, s.charge);
            stopCharge();
            sing(strength);
        }

        if ((world.controls.pressed(input, "throw") || input.isPointerPressed(2)) && s.pearls > 0) throwPearl();

        if (s.lights < MAX_LIGHTS && world.beacons.safeAt(pos.x, pos.y)) {
            s.regenT += dt;
            if (s.regenT >= 2.5) {
                s.regenT = 0;
                s.lights++;
                world.sfx.play("pluck", { pitch: 1.5 });
                world.particles.burst(pos.x, pos.y, 20, { speed: 90, color: "rgba(255, 220, 150, 0.9)", life: 0.9, size: 6 });
            }
        } else {
            s.regenT = 0;
        }

        if (s.lights === 1) {
            s.beatT -= dt;
            if (s.beatT <= 0) {
                s.beatT = 1.15;
                world.sfx.play("heartbeat");
            }
        }
    }

    function lights(out) {
        if (s.lantern < 4) return;
        const flicker = 1 + Math.sin(world.time * 13) * 0.015 + Math.sin(world.time * 7.3) * 0.02;
        const r = s.lantern * flicker;
        out.push({ x: pos.x, y: pos.y, r, i: 0.95, poly: visibilityPolygon(world.level, pos.x, pos.y, r, 128), color: "rgba(110, 220, 255, 0.16)" });
    }

    function renderOver(ctx) {
        if (s.charging) {
            const r = 20 + s.charge * 8;
            ctx.strokeStyle = `rgba(150, 245, 255, ${0.35 + 0.55 * s.charge})`;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, -Math.PI / 2, -Math.PI / 2 + s.charge * TAU);
            ctx.stroke();
            if (s.full) {
                ctx.strokeStyle = `rgba(220, 255, 255, ${0.3 + 0.3 * Math.sin(world.time * 20)})`;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r + 5, 0, TAU);
                ctx.stroke();
            }
        }
        if (s.invuln > 0 && !s.dead) {
            ctx.strokeStyle = `rgba(255, 110, 130, ${0.5 * (s.invuln / 1.6)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 16, 0, TAU);
            ctx.stroke();
        }
    }

    return { entity, state: s, update, lights, renderOver, hurt };
}
