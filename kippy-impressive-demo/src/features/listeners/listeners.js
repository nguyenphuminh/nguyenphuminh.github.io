import { Entity, RigidBody, CircleCollider, Vector2 } from "kippy";
import { LAYER, MASK } from "../../core/layers.js";
import { TAU, angleLerp, clamp } from "../../core/math.js";
import { glowSprite } from "../../core/paint.js";
import { lineOfSight } from "../level/field.js";
import { createNav } from "./nav.js";
import { makeListenerAnimator, LURE } from "./art.js";

const RADIUS = 15;
const SPEED = { wander: 60, investigate: 125, sniff: 40, hunt: 205, retreat: 140, flee: 170, sleep: 18 };
const SEGMENTS = 11;
const SPACING = 7;
const GHOST_LIFE = 1.8;
const CALM = ["retreat", "flee", "sleep"];

// Blind hunters. They hear (never see), path around rock, and fear woken beacons.
export function createListeners(world) {
    const level = world.level;
    const cell = level.cell;
    const nav = createNav(level, 2);
    const speedMul = level.depth.listenerSpeed;
    const list = level.listeners.map(spawn);

    function spawn(p) {
        const animator = makeListenerAnimator();
        const entity = new Entity({
            position: new Vector2(p.x, p.y),
            animator,
            body: new RigidBody({ mass: 3, restitution: 0.3, sleepThreshold: 0 }),
            collider: new CircleCollider({ radius: RADIUS, layer: LAYER.LISTENER, mask: MASK.LISTENER })
        });
        entity.kind = "listener";
        entity.rotation = Math.random() * TAU;

        const L = {
            entity,
            state: "wander",
            stateT: 0,
            path: null,
            pathI: 0,
            done: true,
            target: null,
            repathT: 0,
            idleT: Math.random() * 2,
            heardT: -99,
            goal: null,
            screechCd: 0,
            trail: [],
            ghosts: [],
            pending: [],
            lurePhase: Math.random() * 3.6,
            flee: null,
            rumble: world.sfx.sounds.rumble.play({ loop: true, volume: 0 })
        };
        for (let k = 0; k < 60; k++) L.trail.push({ x: p.x - Math.cos(entity.rotation) * k * 3, y: p.y - Math.sin(entity.rotation) * k * 3 });

        animator.onEnd = (name) => {
            if (name === "bite") animator.play(L.state === "hunt" ? "hunt" : "swim");
        };
        entity.onCollisionEnter = entity.onCollisionStay = (other) => {
            if (other.kind === "player") bite(L);
        };

        L.echo = {
            get x() {
                return entity.position.x;
            },
            get y() {
                return entity.position.y;
            },
            radius: RADIUS + 6,
            onEcho: (delay) => L.pending.push(world.time + delay)
        };
        world.sonar.track(L.echo);
        return L;
    }

    const cellOf = (x, y) => ({ x: Math.floor(x / cell), y: Math.floor(y / cell) });
    const center = (c) => ({ x: (c.x + 0.5) * cell, y: (c.y + 0.5) * cell });

    function setState(L, state) {
        L.state = state;
        L.stateT = 0;
        L.path = null;
        L.done = true;
        L.repathT = 0;
        if (L.entity.animator.currentAnimationName !== "bite") L.entity.animator.play(state === "hunt" ? "hunt" : "swim");
    }

    function pathTo(L, x, y) {
        const pos = L.entity.position;
        const s = cellOf(pos.x, pos.y);
        let g = cellOf(x, y);
        // A goal inside a lit zone (or a crevice) becomes the nearest reachable spot on the way there
        if (!nav.walkable(g.x, g.y)) {
            for (let k = 1; k <= 60; k++) {
                const t = k / 60;
                const c = { x: Math.round(g.x + (s.x - g.x) * t), y: Math.round(g.y + (s.y - g.y) * t) };
                if (nav.walkable(c.x, c.y)) {
                    g = c;
                    break;
                }
            }
        }
        L.path = nav.findPath(s.x, s.y, g.x, g.y);
        L.pathI = 0;
        L.done = !L.path;
    }

    function startHunt(L, x, y) {
        if (L.state !== "hunt") {
            setState(L, "hunt");
            if (L.screechCd <= 0) {
                world.sfx.play("screech", { x: L.entity.position.x, y: L.entity.position.y, range: 1600 });
                L.screechCd = 4;
            }
            world.stats.heard++;
            world.events.emit("listener-alert", { hunt: true });
        }
        L.goal = { x, y };
        L.heardT = world.time;
    }

    function investigate(L, x, y, source) {
        if (L.state !== "investigate") {
            setState(L, "investigate");
            world.sfx.play("huff", { x: L.entity.position.x, y: L.entity.position.y, range: 900 });
            if (source === "player") world.events.emit("listener-alert", { hunt: false });
        }
        L.target = { x, y };
        L.path = null;
    }

    world.events.on("noise", (n) => {
        for (const L of list) {
            if (CALM.includes(L.state)) continue;
            const pos = L.entity.position;
            if (!world.noise.heard(n, pos.x, pos.y)) continue;
            const d = Math.hypot(n.x - pos.x, n.y - pos.y);
            if (n.source === "player") {
                if (L.state === "hunt" || d < 340 || d < n.radius * 0.5) startHunt(L, n.x, n.y);
                else investigate(L, n.x, n.y, n.source);
            } else if (n.source === "pearl") {
                const pp = world.player.entity.position;
                if (L.state !== "hunt" || Math.hypot(pp.x - pos.x, pp.y - pos.y) > 140) investigate(L, n.x, n.y, n.source);
            } else if (L.state !== "hunt") {
                investigate(L, n.x, n.y, n.source);
            }
        }
    });

    function bite(L) {
        if (CALM.includes(L.state) || world.peaceful) return;
        const pos = L.entity.position;
        if (world.player.hurt(pos.x, pos.y)) {
            L.entity.animator.play("bite", true);
            setState(L, "retreat");
            const pp = world.player.entity.position;
            const d = Math.hypot(pos.x - pp.x, pos.y - pp.y) || 1;
            pathTo(L, pos.x + ((pos.x - pp.x) / d) * 260, pos.y + ((pos.y - pp.y) / d) * 260);
        }
    }

    function follow(L, speed) {
        const pos = L.entity.position;
        const body = L.entity.body;
        let dx = 0;
        let dy = 0;
        let slow = 1;

        if (L.path && !L.done) {
            while (L.pathI < L.path.length - 1) {
                const w = center(L.path[L.pathI]);
                if (Math.hypot(w.x - pos.x, w.y - pos.y) > 20) break;
                L.pathI++;
            }
            let k = L.pathI;
            for (let j = Math.min(L.path.length - 1, L.pathI + 6); j > L.pathI; j--) {
                const w = center(L.path[j]);
                if (lineOfSight(level, pos.x, pos.y, w.x, w.y)) {
                    k = j;
                    break;
                }
            }
            const w = center(L.path[k]);
            const d = Math.hypot(w.x - pos.x, w.y - pos.y);
            if (k === L.path.length - 1) {
                slow = clamp(d / 60, 0.25, 1);
                if (d < 18) L.done = true;
            }
            if (d > 0.01) {
                dx = (w.x - pos.x) / d;
                dy = (w.y - pos.y) / d;
            }
        }
        steer(body, dx * speed * slow, dy * speed * slow, 3);
    }

    const steer = (body, vx, vy, gain) => {
        body.force.x += (vx - body.velocity.x) * gain * body.mass;
        body.force.y += (vy - body.velocity.y) * gain * body.mass;
    };

    function wanderTarget(L) {
        const c = cellOf(L.entity.position.x, L.entity.position.y);
        for (let k = 0; k < 14; k++) {
            const x = c.x + Math.round((Math.random() - 0.5) * 60);
            const y = c.y + Math.round((Math.random() - 0.5) * 60);
            if (nav.walkable(x, y)) return center({ x, y });
        }
        return null;
    }

    function updateOne(L, dt) {
        const pos = L.entity.position;
        const body = L.entity.body;
        const player = world.player;
        const pp = player.entity.position;
        const dp = Math.hypot(pp.x - pos.x, pp.y - pos.y);
        const mul = speedMul;
        L.stateT += dt;
        L.screechCd -= dt;

        const zone = L.state === "sleep" ? null : world.beacons.zoneAt(pos.x, pos.y);
        if (zone && L.state !== "flee") {
            setState(L, "flee");
            L.flee = zone;
        }

        if (!CALM.includes(L.state) && dp < 75 && !player.state.dead && !world.peaceful) startHunt(L, pp.x, pp.y);

        switch (L.state) {
            case "wander":
                if (L.done) {
                    steer(body, 0, 0, 1.5);
                    L.idleT -= dt;
                    if (L.idleT <= 0) {
                        const t = wanderTarget(L);
                        if (t) pathTo(L, t.x, t.y);
                        L.idleT = 1 + Math.random() * 2;
                    }
                } else {
                    follow(L, SPEED.wander * mul);
                }
                break;
            case "investigate":
                if (!L.path) pathTo(L, L.target.x, L.target.y);
                if (!L.path) setState(L, "wander");
                else if (L.done) setState(L, "sniff");
                else follow(L, SPEED.investigate * mul);
                break;
            case "sniff": {
                const a = L.entity.rotation + 0.45; // slow wide loops around the spot
                steer(body, Math.cos(a) * SPEED.sniff, Math.sin(a) * SPEED.sniff, 2);
                if (L.stateT > 2.5) setState(L, "wander");
                break;
            }
            case "hunt": {
                L.repathT -= dt;
                if (L.repathT <= 0) {
                    pathTo(L, L.goal.x, L.goal.y);
                    L.repathT = 0.3;
                }
                const silent = world.time - L.heardT;
                if (silent > 7) setState(L, "wander");
                else if (L.done && silent > 2) setState(L, "sniff");
                else follow(L, SPEED.hunt * mul);
                break;
            }
            case "retreat":
                follow(L, SPEED.retreat * mul);
                if (L.stateT > 3.2) setState(L, "wander");
                break;
            case "flee": {
                const z = L.flee;
                const d = Math.hypot(pos.x - z.x, pos.y - z.y) || 1;
                steer(body, ((pos.x - z.x) / d) * SPEED.flee, ((pos.y - z.y) / d) * SPEED.flee, 3);
                if (d > z.r + 40) setState(L, "wander");
                break;
            }
            case "sleep":
                steer(body, Math.cos(world.time * 0.3 + L.lurePhase) * SPEED.sleep, Math.sin(world.time * 0.4 + L.lurePhase) * SPEED.sleep, 1);
                break;
        }

        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed > 10) L.entity.rotation = angleLerp(L.entity.rotation, Math.atan2(body.velocity.y, body.velocity.x), 1 - Math.exp(-6 * dt));

        // Body follows the head's path
        const back = { x: pos.x - Math.cos(L.entity.rotation) * 22, y: pos.y - Math.sin(L.entity.rotation) * 22 };
        if (Math.hypot(back.x - L.trail[0].x, back.y - L.trail[0].y) > 3) {
            L.trail.unshift(back);
            if (L.trail.length > 60) L.trail.pop();
        }

        // Ghosts appear where the wave found it, and stay there
        L.pending.sort((a, b) => a - b);
        while (L.pending.length && L.pending[0] <= world.time) {
            L.pending.shift();
            L.ghosts.push({ t: world.time, x: pos.x, y: pos.y, rot: L.entity.rotation, segs: segments(L) });
        }
        while (L.ghosts.length && world.time - L.ghosts[0].t > GHOST_LIFE) L.ghosts.shift();

        const loud = world.sfx.falloff(pos.x, pos.y, 800) * (L.state === "hunt" ? 1 : 0.55) * (L.state === "sleep" ? 0.2 : 1);
        if (L.rumble) {
            L.rumble.volume = world.sfx.sounds.rumble.volume * loud;
            L.rumble.pitch = L.state === "hunt" ? 1.3 : 0.9;
        }
    }

    // Segment centers along the trail, head to tail
    function segments(L) {
        const out = [];
        let need = 0;
        let acc = 0;
        for (let i = 0; i < L.trail.length - 1 && out.length < SEGMENTS * 2; i++) {
            const a = L.trail[i];
            const b = L.trail[i + 1];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            while (need <= acc + len && out.length < SEGMENTS * 2) {
                const t = len ? (need - acc) / len : 0;
                out.push(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
                need += SPACING;
            }
            acc += len;
        }
        return out;
    }

    const segRadius = (k) => 11 * (1 - k / SEGMENTS) ** 0.7 + 2;

    function lureOf(L) {
        const r = L.entity.rotation;
        const p = L.entity.position;
        let glow;
        if (L.state === "sleep") glow = 0.6;
        else if (L.state === "hunt") glow = 0.8 + 0.2 * Math.sin(world.time * 12);
        else glow = (world.time + L.lurePhase) % 3.6 < 0.35 ? 0.9 : 0.06;
        return {
            x: p.x + LURE.x * Math.cos(r) - LURE.y * Math.sin(r),
            y: p.y + LURE.x * Math.sin(r) + LURE.y * Math.cos(r),
            glow
        };
    }

    function update(dt) {
        for (const L of list) updateOne(L, dt);
    }

    function renderUnder(ctx) {
        ctx.lineCap = "round";
        for (const L of list) {
            const segs = segments(L);
            // One tapered stroke from tail to head, then glowing spots along the flank
            for (let k = segs.length / 2 - 2; k >= 0; k--) {
                ctx.lineWidth = segRadius(k) * 2;
                ctx.strokeStyle = k % 2 ? "#2e0a13" : "#380c17";
                ctx.beginPath();
                ctx.moveTo(segs[k * 2 + 2], segs[k * 2 + 3]);
                ctx.lineTo(segs[k * 2], segs[k * 2 + 1]);
                ctx.stroke();
            }
            ctx.fillStyle = "rgba(255, 90, 110, 0.35)";
            for (let k = 2; k < segs.length / 2; k += 2) {
                ctx.beginPath();
                ctx.arc(segs[k * 2], segs[k * 2 + 1], 1.4, 0, TAU);
                ctx.fill();
            }
        }
        ctx.lineCap = "butt";
    }

    function renderOver(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const L of list) {
            for (const g of L.ghosts) {
                const a = (1 - (world.time - g.t) / GHOST_LIFE) ** 2;
                ctx.strokeStyle = `rgba(255, 60, 90, ${0.8 * a})`;
                ctx.fillStyle = `rgba(160, 20, 50, ${0.25 * a})`;
                ctx.lineWidth = 1.4;
                for (let k = 0; k < g.segs.length / 2; k++) {
                    ctx.beginPath();
                    ctx.arc(g.segs[k * 2], g.segs[k * 2 + 1], segRadius(k), 0, TAU);
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.globalAlpha = a;
                const hx = g.x + Math.cos(g.rot) * 6;
                const hy = g.y + Math.sin(g.rot) * 6;
                ctx.drawImage(glowSprite("rgba(255, 70, 100, 0.9)"), hx - 26, hy - 26, 52, 52);
                const ex = g.x + Math.cos(g.rot) * 2 - Math.sin(g.rot) * -8;
                const ey = g.y + Math.sin(g.rot) * 2 + Math.cos(g.rot) * -8;
                ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
                ctx.beginPath();
                ctx.arc(ex, ey, 2.4, 0, TAU);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            const lure = lureOf(L);
            lure.glow *= 1 - (world.mapView ?? 0);
            if (lure.glow > 0.02) {
                const s = 6 + lure.glow * 10;
                ctx.globalAlpha = lure.glow;
                ctx.drawImage(glowSprite(L.state === "sleep" ? "rgba(255, 210, 140, 1)" : "rgba(255, 50, 80, 1)"), lure.x - s, lure.y - s, s * 2, s * 2);
                ctx.globalAlpha = 1;
            }
        }
        ctx.restore();
    }

    function lights(out) {
        for (const L of list) {
            const lure = lureOf(L);
            if (lure.glow > 0.2) out.push({ x: lure.x, y: lure.y, r: 55, i: 0.5 * lure.glow, color: L.state === "sleep" ? "rgba(255, 200, 130, 0.25)" : "rgba(255, 50, 80, 0.22)" });
        }
    }

    function sleepAll() {
        for (const L of list) setState(L, "sleep");
    }

    function destroy() {
        for (const L of list) {
            L.rumble?.stop();
            L.rumble = null;
            world.sonar.untrack(L.echo);
        }
    }

    return {
        list,
        entities: list.map((L) => L.entity),
        update,
        renderUnder,
        renderOver,
        lights,
        sleepAll,
        destroy,
        blockZone: (x, y, r) => nav.blockDisc(x / cell, y / cell, r / cell),
        anyHunting: () => list.some((L) => L.state === "hunt")
    };
}
