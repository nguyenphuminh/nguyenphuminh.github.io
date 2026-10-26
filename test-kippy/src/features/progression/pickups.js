import { Entity, Vector2 } from "../../shared/kippy.js";
import { rand } from "../../shared/math.js";
import { sfx } from "../../shared/audio.js";
import { sprite } from "../art/atlas.js";
import { damageNumber, burst } from "../effects/effects.js";

// Spirit qi (experience), immortal peaches, vortex talismans and spirit chests.
const MAX_ORBS = 300;

const qiSprite = value => sprite(value >= 20 ? "qiL" : value >= 5 ? "qiM" : "qiS");

// Orbs left behind never despawn. Once the field is full, the orb farthest from
// the player is absorbed into the new drop, so kills always drop qi where they
// happen and no qi is lost.
export function spawnQi(scene, x, y, value) {
    const p = scene.player.position;
    let live = 0, farthest = null, farthestD = -1;
    for (const o of scene.pickups) {
        if (o.dead) continue;
        live++;
        if (o.kind !== "qi" || o.attract) continue;
        const d = (o.position.x - p.x) ** 2 + (o.position.y - p.y) ** 2;
        if (d > farthestD) {
            farthestD = d;
            farthest = o;
        }
    }
    if (live >= MAX_ORBS && farthest) {
        value += farthest.value;
        scene.remove(farthest);
    }
    add(scene, "qi", x, y, { value, sprite: qiSprite(value) });
}

export function spawnItem(scene, kind, x, y) {
    add(scene, kind, x, y, { sprite: sprite(kind) });
}

function add(scene, kind, x, y, { value = 0, sprite: spr }) {
    const e = new Entity({ sprite: spr, position: new Vector2(x + rand(-2, 2), y + rand(-2, 2)) });
    Object.assign(e, { z: 2, kind, value, attract: false, speed: 0 });
    scene.addEntity(e);
    scene.pickups.push(e);
}

function attractAllQi(scene) {
    for (const o of scene.pickups) if (o.kind === "qi") o.attract = true;
}

export function updatePickups(scene, dt) {
    const p = scene.player, px = p.position.x, py = p.position.y;
    const magnet2 = p.stats.magnet ** 2;
    for (const o of scene.pickups) {
        if (o.dead) continue;
        const dx = px - o.position.x, dy = py - o.position.y, d2 = dx * dx + dy * dy;
        if (o.kind !== "qi") {
            if (d2 < 14 * 14) collect(scene, o);
            continue;
        }
        if (!o.attract && d2 < magnet2) o.attract = true;
        if (!o.attract) continue;
        o.speed = Math.min(o.speed + 520 * dt, 480);
        const d = Math.sqrt(d2) || 1;
        if (d < 8) {
            collect(scene, o);
            continue;
        }
        o.position.x += (dx / d) * o.speed * dt;
        o.position.y += (dy / d) * o.speed * dt;
    }
}

function collect(scene, o) {
    scene.remove(o);
    const p = scene.player;
    if (o.kind === "qi") {
        scene.gainQi(o.value);
        sfx.pickup();
    } else if (o.kind === "peach") {
        const heal = Math.min(30, p.stats.maxHp - p.hp);
        p.hp += heal;
        damageNumber(scene, p.position.x, p.position.y - 14, Math.max(1, heal), "#5cc48f");
        burst(scene, p.position.x, p.position.y, "#f59ac0", 10);
        sfx.heal();
    } else if (o.kind === "vortex") {
        attractAllQi(scene);
        burst(scene, p.position.x, p.position.y, "#c4ecff", 14, 120);
        sfx.select();
    } else if (o.kind === "chest") {
        scene.openChest();
    }
}
