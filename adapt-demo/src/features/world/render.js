// Draws the world: parallax backgrounds, floors, arena walls and decoration.
import { VIEW_WIDTH, WORLD } from "./layout.js";

// Decoration placement (world x). Hanging pieces are drawn from the top; the rest stand on the floor.
const DECOR = [
    { key: "statue", x: 70 },
    { key: "candles", x: 128 },
    { key: "candles", x: 174 },
    { key: "brokenPillar", x: 262 },
    { key: "banner", x: 338 },
    { key: "rubble", x: 430 },
    { key: "chains", x: 520, hang: 70 },
    { key: "statue", x: 610 },
    { key: "rubble", x: 700 },
    { key: "brokenPillar", x: 780 },
    { key: "chains", x: 850, hang: 50 },
    { key: "banner", x: 905 },
    { key: "candles", x: 984 },
    { key: "chains", x: WORLD.arenaLeft + 150, hang: 30, back: true },
    { key: "chains", x: WORLD.arenaLeft + 330, hang: 46, back: true },
    { key: "candles", x: WORLD.arenaLeft + 44 },
    { key: "candles", x: WORLD.arenaLeft + 436 },
];

function drawTiled(ctx, img, offsetX, y = 0) {
    if (!img) return;
    const w = img.width;
    let x = -(((offsetX % w) + w) % w);
    for (; x < VIEW_WIDTH; x += w) ctx.drawImage(img, Math.round(x), y);
}

function spriteOf(prop) {
    if (!prop) return null;
    if (prop.sprite) return { img: prop.sprite, sx: 0, sy: 0, w: prop.sprite.width, h: prop.sprite.height };
    const cols = Math.max(1, Math.floor(prop.sheet.width / prop.frameWidth));
    const f = prop.frames[0];
    return { img: prop.sheet, sx: (f % cols) * prop.frameWidth, sy: Math.floor(f / cols) * prop.frameHeight, w: prop.frameWidth, h: prop.frameHeight };
}

export function createWorldRenderer(art) {
    const props = art.props ?? {};
    const tiles = art.tiles ?? {};
    const bg = art.backgrounds ?? {};
    const placed = DECOR.filter((d) => props[d.key]);

    function drawFloor(ctx, cameraX) {
        const floor = tiles.floor;
        if (!floor) {
            ctx.fillStyle = "#1a1726";
            ctx.fillRect(cameraX, WORLD.floorY, VIEW_WIDTH, 60);
            return;
        }
        const w = floor.width;
        const start = Math.floor(cameraX / w) * w;
        for (let x = start; x < cameraX + VIEW_WIDTH + w; x += w) {
            const img = x >= WORLD.arenaLeft && tiles.arenaFloor ? tiles.arenaFloor : floor;
            ctx.drawImage(img, x, WORLD.floorY);
        }
    }

    function drawDecor(ctx, cameraX, back) {
        for (const d of placed) {
            if (Boolean(d.back) !== back) continue;
            const s = spriteOf(props[d.key]);
            if (!s || d.x + s.w < cameraX || d.x - s.w > cameraX + VIEW_WIDTH) continue;
            const top = d.hang !== undefined ? d.hang : WORLD.floorY - s.h;
            ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, Math.round(d.x - s.w / 2), top, s.w, s.h);
        }
    }

    function drawWall(ctx, prop, x) {
        const s = spriteOf(prop);
        if (!s) {
            ctx.fillStyle = "#211d30";
            ctx.fillRect(x - 12, 0, 24, WORLD.floorY);
            return;
        }
        ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, Math.round(x - s.w / 2), WORLD.floorY - s.h, s.w, s.h);
    }

    return {
        /** Screen-space parallax layers. */
        drawBackground(ctx, cameraX) {
            if (bg.sky) ctx.drawImage(bg.sky, 0, 0);
            drawTiled(ctx, bg.far, cameraX * 0.2);
            drawTiled(ctx, bg.mid, cameraX * 0.5);
        },

        /** World-space layers behind the actors. */
        drawBack(ctx, cameraX, { sealed }) {
            if (bg.arenaBackdrop && cameraX + VIEW_WIDTH > WORLD.arenaLeft) ctx.drawImage(bg.arenaBackdrop, WORLD.arenaLeft, 0);
            drawDecor(ctx, cameraX, true);
            drawFloor(ctx, cameraX);
            drawDecor(ctx, cameraX, false);
            if (cameraX + VIEW_WIDTH > WORLD.arenaLeft) {
                drawWall(ctx, sealed && props.gate ? props.gate : props.arenaWall, WORLD.arenaLeft + 12);
                drawWall(ctx, props.arenaWall, WORLD.arenaLeft + VIEW_WIDTH - 12);
            }
        },
    };
}
