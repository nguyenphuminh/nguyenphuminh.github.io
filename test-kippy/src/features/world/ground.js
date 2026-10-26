import { Entity, Sprite, Vector2 } from "../../shared/kippy.js";
import { makeCanvas } from "../../shared/pixel.js";
import { hash2 } from "../../shared/math.js";
import { view } from "../../shared/view.js";
import { PALETTE as P } from "../../shared/palette.js";
import { groundTile } from "../art/procedural.js";
import { SPRITES } from "../art/atlas.js";
import { paintHazards } from "../stages/hazards.js";

// The endless ground of a stage. One Kippy entity holds a canvas slightly larger
// than the view; it is repainted from deterministic tile hashes whenever the
// camera crosses a tile boundary, so the world looks the same every time.
const T = 32;
const tileSets = new Map();

const EXTRAS = {
    blades: () => (ctx, R) => {
        ctx.fillStyle = "#447055";
        for (let i = 0; i < 6; i++) ctx.fillRect(Math.floor(R() * 31), Math.floor(R() * 29), 1, 3);
    },
    pebbles: () => (ctx, R) => {
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i % 2 ? P.Y : "#5d6070";
            ctx.fillRect(Math.floor(R() * 30), Math.floor(R() * 30), 2, 1);
        }
    },
    petals: () => (ctx, R) => {
        for (let i = 0; i < 5; i++) {
            ctx.fillStyle = i % 2 ? P.m : P.w;
            ctx.fillRect(Math.floor(R() * 31), Math.floor(R() * 31), 1, 1);
        }
    },
    ripples: color => (ctx, R) => {
        ctx.fillStyle = color;
        for (let i = 0; i < 3; i++) ctx.fillRect(Math.floor(R() * 26), Math.floor(R() * 31), 3 + Math.floor(R() * 4), 1);
    },
    sparkle: () => (ctx, R) => {
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 5; i++) ctx.fillRect(Math.floor(R() * 31), Math.floor(R() * 31), 1, 1);
    },
    drift: color => (ctx, R) => {
        ctx.fillStyle = color;
        const y = Math.floor(R() * 28);
        for (let x = 0; x < 12; x++) ctx.fillRect(Math.floor(R() * 4) + x * 2, y + Math.round(Math.sin(x / 2) * 1.5), 2, 1);
    },
};

function tilesFor(stage) {
    let set = tileSets.get(stage.id);
    if (!set) {
        let seed = 1;
        set = stage.ground.regions.map(({ colors, extras }) =>
            extras.map(name => groundTile(seed++, ...colors, name && EXTRAS[name](colors[2]))));
        tileSets.set(stage.id, set);
    }
    return set;
}

const propSprite = (id, x, y) => (id === "bamboo" ? SPRITES.bamboo[Math.floor(hash2(x, y, 7) * 3)] : SPRITES[id]);

export function createGround(scene, stage) {
    const ground = new Entity({ position: new Vector2(0, 0) });
    ground.z = 0;
    ground.stage = stage;
    ground.originX = NaN;
    ground.originY = NaN;
    scene.addEntity(ground);
    return ground;
}

export function updateGround(ground, camera) {
    const cols = Math.ceil(view.w / T) + 3, rows = Math.ceil(view.h / T) + 3;
    if (!ground.canvas || ground.canvas.width !== cols * T || ground.canvas.height !== rows * T) {
        ground.canvas = makeCanvas(cols * T, rows * T);
        ground.sprite = new Sprite({ texture: ground.canvas });
        ground.originX = NaN;
    }
    const ox = Math.floor(camera.position.x / T) - 1, oy = Math.floor(camera.position.y / T) - 1;
    if (ox !== ground.originX || oy !== ground.originY) {
        ground.originX = ox;
        ground.originY = oy;
        paintArea(ground.canvas.getContext("2d"), ground.stage, ox, oy, cols, rows);
    }
    ground.position.x = ox * T + ground.canvas.width / 2;
    ground.position.y = oy * T + ground.canvas.height / 2;
}

// Paints `cols` x `rows` tiles of the world, starting at tile (ox, oy), onto ctx.
function paintArea(ctx, stage, ox, oy, cols, rows) {
    const tiles = tilesFor(stage);
    for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
            const wx = ox + tx, wy = oy + ty;
            const region = hash2(wx >> 3, wy >> 3, 9) < 0.35 ? 1 : 0;
            ctx.drawImage(tiles[region][Math.floor(hash2(wx, wy, 1) * 3)], tx * T, ty * T);
        }
    }
    if (stage.hazard) paintHazards(ctx, stage, ox * T, oy * T, cols * T, rows * T);
    // Props may overhang their tile, so neighbours just outside the canvas are included.
    for (let ty = -1; ty <= rows; ty++) {
        for (let tx = -1; tx <= cols; tx++) {
            const wx = ox + tx, wy = oy + ty;
            if (Math.abs(wx) + Math.abs(wy) < 3) continue; // keep the starting clearing open
            const roll = hash2(wx, wy, 2);
            const prop = stage.ground.props.find(([limit]) => roll < limit);
            if (!prop) continue;
            const img = propSprite(prop[1], wx, wy);
            const px = tx * T + Math.floor(hash2(wx, wy, 3) * (T - img.width));
            const py = ty * T + Math.floor(hash2(wx, wy, 4) * (T - img.height / 2));
            ctx.drawImage(img, px, py);
        }
    }
}

// A small framed slice of a stage's ground, for the stage select cards.
export function stagePreview(stage, w, h) {
    const c = makeCanvas(w, h);
    paintArea(c.getContext("2d"), stage, 6, 4, Math.ceil(w / T) + 1, Math.ceil(h / T) + 1);
    return c;
}
