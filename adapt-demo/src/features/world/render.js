// Draws the world: parallax backgrounds, floors, arena walls and decoration.
import { VIEW_WIDTH } from "./areas.js";

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

/** Draws one area. Decoration: area.decor (world x) and area.arenaDecor (x relative to the arena's left edge). */
export function createWorldRenderer(art, area) {
    const props = art.props ?? {};
    const tiles = art.tiles ?? {};
    const bg = art.backgrounds ?? {};
    const WORLD = area;
    const placed = [
        ...(area.decor ?? []),
        ...(area.arenaDecor ?? []).map((d) => ({ ...d, x: area.arenaLeft + d.dx, back: true })),
    ].filter((d) => props[d.key]);
    let backdrop = area.backdrop ? bg[area.backdrop] ?? null : null;
    const layers = { sky: bg[area.bg?.sky] ?? bg.sky, far: bg[area.bg?.far] ?? bg.far, mid: bg[area.bg?.mid] ?? bg.mid };
    const floorTile = tiles[area.floor] ?? tiles.floor;
    const segments = (area.floorSegments ?? []).map((seg) => ({ toX: seg.toX, img: tiles[seg.tile] ?? floorTile }));
    const tileAt = (x) => {
        for (const seg of segments) if (x < seg.toX) return seg.img;
        return x >= WORLD.arenaLeft && tiles.arenaFloor && !area.floor ? tiles.arenaFloor : floorTile;
    };

    function drawFloor(ctx, cameraX) {
        const floor = floorTile;
        if (!floor) {
            ctx.fillStyle = "#1a1726";
            ctx.fillRect(cameraX, WORLD.floorY, VIEW_WIDTH, 60);
            return;
        }
        const w = floor.width;
        const start = Math.floor(cameraX / w) * w;
        for (let x = start; x < cameraX + VIEW_WIDTH + w; x += w) {
            ctx.drawImage(tileAt(x), x, WORLD.floorY);
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
            if (layers.sky) ctx.drawImage(layers.sky, 0, 0);
            drawTiled(ctx, layers.far, cameraX * 0.2);
            drawTiled(ctx, layers.mid, cameraX * 0.5);
        },

        /** Swaps the arena backdrop (e.g. the Hall's far wall opening after the Mirrorwright falls). */
        setBackdrop(key) {
            backdrop = bg[key] ?? backdrop;
        },

        /** World-space layers behind the actors. */
        drawBack(ctx, cameraX, { sealed }) {
            if (backdrop && cameraX + VIEW_WIDTH > WORLD.arenaLeft) ctx.drawImage(backdrop, WORLD.arenaLeft, 0);
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
