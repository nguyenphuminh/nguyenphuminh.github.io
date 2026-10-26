import { hash2, seeded } from "../../shared/math.js";
import { makeCanvas } from "../../shared/pixel.js";
import { disc, ring } from "../art/procedural.js";

// Stage hazards: miasma pools (marsh) and ice sheets (peak). Placement is a pure
// function of the world region, like the ground props, so it never needs storing.
const REGION = 224;

const saltOf = stage => [...stage.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 9973;

function regionHazard(stage, rx, ry) {
    const h = stage.hazard, salt = saltOf(stage);
    if (hash2(rx, ry, salt) >= h.density) return null;
    const x = (rx + 0.15 + hash2(rx, ry, salt + 1) * 0.7) * REGION;
    const y = (ry + 0.15 + hash2(rx, ry, salt + 2) * 0.7) * REGION;
    if (Math.hypot(x, y) < 150) return null; // the starting clearing stays safe
    return { x, y, r: Math.round(h.minR + hash2(rx, ry, salt + 3) * (h.maxR - h.minR)), kind: h.kind };
}

export function hazardsIn(stage, x0, y0, x1, y1) {
    if (!stage.hazard) return [];
    const out = [], pad = stage.hazard.maxR;
    for (let ry = Math.floor((y0 - pad) / REGION); ry <= Math.floor((y1 + pad) / REGION); ry++) {
        for (let rx = Math.floor((x0 - pad) / REGION); rx <= Math.floor((x1 + pad) / REGION); rx++) {
            const hz = regionHazard(stage, rx, ry);
            if (hz) out.push(hz);
        }
    }
    return out;
}

const hazardAt = (stage, x, y) => hazardsIn(stage, x, y, x, y).find(h => (h.x - x) ** 2 + (h.y - y) ** 2 < h.r * h.r) ?? null;

const textures = new Map();
function texture(kind, r) {
    const key = `${kind}${r}`;
    let t = textures.get(key);
    if (t) return t;
    const m = r + 1;
    t = makeCanvas(m * 2 + 1, m * 2 + 1);
    const ctx = t.getContext("2d"), R = seeded(r * 7 + 3);
    if (kind === "miasma") {
        disc(ctx, m, m, r, "rgba(70, 120, 60, 0.42)");
        disc(ctx, m, m, r - 5, "rgba(105, 160, 70, 0.30)");
        ring(ctx, m, m, r, 1, "rgba(160, 220, 100, 0.55)", 3);
        for (let i = 0; i < r / 3; i++) {
            const a = R() * Math.PI * 2, d = R() * (r - 4);
            ctx.fillStyle = i % 2 ? "rgba(190, 240, 120, 0.7)" : "rgba(40, 70, 40, 0.6)";
            ctx.fillRect(Math.round(m + Math.cos(a) * d), Math.round(m + Math.sin(a) * d), 1, 1);
        }
    } else {
        disc(ctx, m, m, r, "rgba(225, 242, 255, 0.55)");
        disc(ctx, m, m, r - 4, "rgba(200, 230, 250, 0.45)");
        ring(ctx, m, m, r, 1, "rgba(255, 255, 255, 0.85)");
        ctx.fillStyle = "rgba(127, 191, 230, 0.8)";
        for (let c = 0; c < 4; c++) {
            let x = m, y = m;
            const a = R() * Math.PI * 2;
            for (let s = 0; s < r * 0.8; s++) {
                x += Math.cos(a + (R() - 0.5) * 1.2);
                y += Math.sin(a + (R() - 0.5) * 1.2);
                ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
        }
    }
    textures.set(key, t);
    return t;
}

// Bakes hazards into a ground canvas whose top-left corner is world (wx, wy).
export function paintHazards(ctx, stage, wx, wy, w, h) {
    for (const hz of hazardsIn(stage, wx, wy, wx + w, wy + h)) {
        ctx.drawImage(texture(hz.kind, hz.r), Math.round(hz.x - wx - hz.r - 1), Math.round(hz.y - wy - hz.r - 1));
    }
}

// Applies the hazard under the player. Returns whether they're standing on ice.
export function updateHazards(scene, dt) {
    const stage = scene.stage, p = scene.player;
    if (!stage.hazard) return false;
    const hz = hazardAt(stage, p.position.x, p.position.y + 3);
    scene.fx.poison = hz?.kind === "miasma";
    if (hz?.kind === "miasma") {
        scene.miasmaTimer += dt;
        if (scene.miasmaTimer >= stage.hazard.every) {
            scene.miasmaTimer -= stage.hazard.every;
            scene.drainPlayer(stage.hazard.damage * stage.difficulty.damage);
        }
    } else {
        scene.miasmaTimer = 0;
    }
    return hz?.kind === "ice";
}

// Rising bubbles over miasma, glints over ice (world space, camera applied).
export function drawHazardFx(ctx, scene, x0, y0, x1, y1) {
    const t = scene.time;
    for (const hz of hazardsIn(scene.stage, x0, y0, x1, y1)) {
        for (let i = 0; i < 4; i++) {
            const phase = (t * (hz.kind === "miasma" ? 0.6 : 0.25) + i / 4 + hash2(hz.x | 0, i, 5)) % 1;
            const a = hash2(hz.x | 0, hz.y | 0, i) * Math.PI * 2, d = hash2(i, hz.x | 0, 9) * hz.r * 0.8;
            const x = Math.round(hz.x + Math.cos(a) * d), y = Math.round(hz.y + Math.sin(a) * d - (hz.kind === "miasma" ? phase * 10 : 0));
            ctx.globalAlpha = 1 - phase;
            ctx.fillStyle = hz.kind === "miasma" ? "#c8ff8a" : "#ffffff";
            ctx.fillRect(x, y, 1, hz.kind === "miasma" ? 1 : 2);
        }
    }
    ctx.globalAlpha = 1;
}
