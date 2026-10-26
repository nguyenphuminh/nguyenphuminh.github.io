import { rand, TAU, weighted } from "../../shared/math.js";
import { view, viewRadius } from "../../shared/view.js";
import { banner } from "../effects/effects.js";
import { spawnEnemy, ringPoint } from "./enemy.js";
import { spawnBoss } from "./bosses.js";

// Spawns the current stage's horde: a wave per minute ([spawns per second, max
// alive, weighted types]) plus scripted events (flocks, encirclements, bosses).
export function createSpawner() {
    return { acc: 0, eventIndex: 0, eliteTimer: 120 };
}

export function updateSpawner(scene, dt) {
    const sp = scene.spawner, t = scene.time, stage = scene.stage;
    while (sp.eventIndex < stage.events.length && stage.events[sp.eventIndex].t <= t) runEvent(scene, stage.events[sp.eventIndex++]);
    if (scene.finalPhase) return;

    const [rate, max, types] = stage.waves[Math.min(stage.waves.length - 1, Math.floor(t / 60))];
    sp.acc += dt * rate * stage.difficulty.rate;
    while (sp.acc >= 1) {
        sp.acc -= 1;
        if (scene.enemies.length < max) spawnEnemy(scene, weighted(types), ...ringPoint(scene));
    }

    sp.eliteTimer -= dt;
    if (sp.eliteTimer <= 0) {
        sp.eliteTimer = 40;
        spawnEnemy(scene, weighted(types), ...ringPoint(scene), { elite: true });
    }
}

// Lets debug tools jump ahead without replaying skipped events.
export function skipEventsBefore(scene, t) {
    const sp = scene.spawner, events = scene.stage.events;
    while (sp.eventIndex < events.length && events[sp.eventIndex].t < t) sp.eventIndex++;
}

function runEvent(scene, ev) {
    const p = scene.player.position;
    if (ev.kind === "flock") {
        // A flock (or ghost procession) sweeps across the screen in formation.
        const a = rand(TAU), dirx = -Math.cos(a), diry = -Math.sin(a);
        const r = viewRadius() + 30;
        const cx = p.x + Math.cos(a) * r, cy = p.y + Math.sin(a) * r;
        for (let i = 0; i < ev.count; i++) {
            const side = (i % 6) - 2.5, row = Math.floor(i / 6);
            const e = spawnEnemy(scene, ev.type, cx - diry * side * 14 - dirx * row * 14, cy + dirx * side * 14 - diry * row * 14);
            e.flock = true;
            e.dirx = dirx;
            e.diry = diry;
            e.speed = Math.max(e.speed, 95);
        }
    } else if (ev.kind === "ring") {
        // Encirclement: the horde closes in from every side at once.
        const r = Math.min(view.w, view.h) / 2 + 40;
        for (let i = 0; i < ev.count; i++) {
            const a = (i / ev.count) * TAU;
            spawnEnemy(scene, ev.type, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
        }
    } else if (ev.kind === "boss") {
        spawnBoss(scene, ev.id);
    } else if (ev.kind === "warn") {
        banner(scene, ev.text, ev.sub, "#fff6a8", 3.5);
    } else if (ev.kind === "final") {
        scene.finalPhase = true;
        spawnBoss(scene, ev.id);
    }
}
