import { Sprite, SpriteSheet, Animation, Animator } from "../../shared/kippy.js";
import { paint, recolor, mirrored, silhouette, strip, fadeFrames, framed, makeCanvas } from "../../shared/pixel.js";
import { PALETTE as P } from "../../shared/palette.js";
import * as CH from "./characters.art.js";
import * as EN from "./enemies.art.js";
import * as IT from "./items.art.js";
import * as PR from "./procedural.js";

// Every texture in the game is built here once at boot, from code-drawn pixel art.

export const SPRITES = {};
export const ICONS = {};
const ACTOR_FRAMES = {};
const FX_FRAMES = {};
const actorCache = new Map();
const spriteCache = new Map();
const fxCache = new Map();
const ringCache = new Map();

const paintAll = grids => grids.map(g => paint(g));

export function buildAtlas() {
    ACTOR_FRAMES.linFeng = { frames: paintAll(CH.LIN_FENG), fps: 6 };
    ACTOR_FRAMES.meiLing = { frames: paintAll(CH.MEI_LING), fps: 6 };
    ACTOR_FRAMES.shiHu = { frames: paintAll(CH.SHI_HU), fps: 6 };
    ACTOR_FRAMES.fox = { frames: paintAll(EN.FOX), fps: 8 };
    ACTOR_FRAMES.jiangshi = { frames: paintAll(EN.JIANGSHI), fps: 3.5 };
    ACTOR_FRAMES.wisp = { frames: paintAll(EN.WISP), fps: 5 };
    ACTOR_FRAMES.thunderSprite = { frames: EN.WISP.map(g => paint(recolor(g, { c: "v", C: "g" }))), fps: 8 };
    ACTOR_FRAMES.crow = { frames: paintAll(EN.CROW), fps: 8 };
    ACTOR_FRAMES.snake = { frames: paintAll(EN.SNAKE), fps: 4 };
    ACTOR_FRAMES.golem = { frames: paintAll(EN.GOLEM), fps: 3 };
    ACTOR_FRAMES.cultist = { frames: paintAll(EN.CULTIST), fps: 2.5 };
    ACTOR_FRAMES.corpseKing = { frames: EN.JIANGSHI.map(g => paint(recolor(g, { B: "P", r: "g", z: "y", g: "r" }))), fps: 3 };
    ACTOR_FRAMES.nineTails = { frames: EN.FOX.map(g => paint(recolor(g, { o: "w", O: "W", w: "m", e: "g" }))), fps: 9 };
    ACTOR_FRAMES.tribulation = { frames: [PR.stormCloud(false), PR.stormCloud(true)], fps: 3 };

    // Bamboo Ghost Marsh.
    ACTOR_FRAMES.drownedGhost = { frames: paintAll(EN.DROWNED_GHOST), fps: 4 };
    ACTOR_FRAMES.waterMonkey = { frames: paintAll(EN.WATER_MONKEY), fps: 9 };
    ACTOR_FRAMES.toad = { frames: paintAll(EN.TOAD), fps: 3 };
    ACTOR_FRAMES.boneSoldier = { frames: paintAll(EN.BONE_SOLDIER), fps: 4 };
    ACTOR_FRAMES.lanternGhost = { frames: paintAll(EN.LANTERN_GHOST), fps: 5 };
    ACTOR_FRAMES.toadKing = { frames: EN.TOAD.map(g => paint(recolor(g, { j: "o", J: "O", g: "v" }))), fps: 3 };
    ACTOR_FRAMES.drownedBride = { frames: EN.DROWNED_GHOST.map(g => paint(recolor(g, { w: "r", W: "R" }))), fps: 4 };
    ACTOR_FRAMES.whiteBoneDemon = { frames: paintAll(EN.WHITE_BONE_DEMON), fps: 3 };
    // Frozen Sword Peak.
    ACTOR_FRAMES.snowWolf = { frames: EN.FOX.map(g => paint(recolor(g, { o: "y", O: "Y", e: "c" }))), fps: 9 };
    ACTOR_FRAMES.iceSpirit = { frames: EN.WISP.map(g => paint(recolor(g, { c: "w", C: "c" }))), fps: 5 };
    ACTOR_FRAMES.snowHawk = { frames: EN.CROW.map(g => paint(recolor(g, { Y: "W", P: "y", e: "b" }))), fps: 8 };
    ACTOR_FRAMES.frostYeti = { frames: paintAll(EN.FROST_YETI), fps: 3 };
    ACTOR_FRAMES.rogueCultivator = { frames: paintAll(CH.ROGUE), fps: 6 };
    ACTOR_FRAMES.snowApeKing = { frames: EN.FROST_YETI.map(g => paint(recolor(g, { w: "c", W: "C", C: "B" }))), fps: 3 };
    ACTOR_FRAMES.swordSaint = { frames: CH.ROGUE.map(g => paint(recolor(g, { Y: "w", R: "k" }))), fps: 7 };
    const frostHead = paint(recolor(IT.DRAGON_HEAD, { b: "c", B: "C", c: "w", g: "b" }));
    ACTOR_FRAMES.frostDragon = { frames: [frostHead, paint(recolor(IT.DRAGON_HEAD, { b: "c", B: "C", c: "w", g: "b", e: "v" }))], fps: 4 };

    Object.assign(SPRITES, {
        sword: paint(IT.SWORD),
        goldSword: paint(recolor(IT.SWORD, { c: "g", w: "v", g: "r", n: "R" })),
        pearl: PR.orb(3, "#ffffff", P.C, P.v),
        talisman: paint(IT.TALISMAN),
        needle: paint(IT.NEEDLE),
        jadeDisc: paint(IT.JADE_DISC),
        seal: paint(IT.SEAL),
        palmR: paint(IT.PALM),
        dragonHead: paint(IT.DRAGON_HEAD),
        dragonBody: paint(IT.DRAGON_BODY),
        qiS: paint(IT.QI_S),
        qiM: paint(IT.QI_M),
        qiL: paint(IT.QI_L),
        peach: paint(IT.PEACH),
        chest: paint(IT.CHEST),
        vortex: paint(recolor(IT.TALISMAN, { g: "c", r: "B" })),
        bloodOrb: PR.orb(2, P.r, P.R, P.m),
        foxFire: PR.orb(3, P.m, P.p, "#ffffff"),
        bolts: [1, 2, 3].map(seed => PR.bolt(120, seed)),
        tribulationBolts: [7, 8, 9].map(seed => PR.bolt(170, seed, "#ffffff", P.v)),
        shadow: PR.shadow(26, 8),
        lineWarn: PR.solid(4, 8, "rgba(255, 70, 70, 0.35)"),
        rock: paint(IT.ROCK),
        reeds: paint(IT.REEDS),
        lilyPad: paint(IT.LILY_PAD),
        stump: paint(IT.STUMP),
        pine: paint(IT.PINE),
        snowRock: paint(IT.SNOW_ROCK),
        iceCrystal: paint(IT.ICE_CRYSTAL),
        swordInSnow: paint(IT.SWORD_IN_SNOW),
        boneSpear: paint(IT.BONE_SPEAR),
        swordWave: paint(IT.SWORD_WAVE),
        iceShard: paint(recolor(IT.NEEDLE, { c: "C", w: "w" })),
        ghostFire: PR.orb(3, P.c, P.C, "#ffffff"),
        snowball: PR.orb(3, "#ffffff", P.W, "#ffffff"),
        frostBody: paint(recolor(IT.DRAGON_BODY, { b: "c", B: "C", c: "w" })),
        tuft: paint(IT.TUFT),
        flower: paint(IT.FLOWER),
        lantern: paint(IT.LANTERN),
        stele: paint(IT.STELE),
        bamboo: [11, 12, 13].map(PR.bamboo),
    });
    SPRITES.palmL = mirrored(SPRITES.palmR);
    SPRITES.dragonHeadL = mirrored(SPRITES.dragonHead);
    SPRITES.fireball = [paint(IT.FIREBALL), paint(recolor(IT.FIREBALL, { o: "r", g: "o", w: "g" }))];

    FX_FRAMES.puff = { frames: PR.puffFrames(), fps: 18 };
    FX_FRAMES.iceBurst = { frames: fadeFrames(paint(IT.ICE_CRYSTAL), 6), fps: 14 };
    FX_FRAMES.explosion = { frames: PR.explosionFrames(14), fps: 16 };
    FX_FRAMES.shock = { frames: PR.ringFrames(22, P.v), fps: 20 };
    FX_FRAMES.goldRing = { frames: PR.ringFrames(30, P.g), fps: 16 };
    FX_FRAMES.breakthrough = { frames: PR.ringFrames(120, "#fff6a8", 8), fps: 14 };
    FX_FRAMES.palmR = { frames: fadeFrames(SPRITES.palmR, 5), fps: 18 };
    FX_FRAMES.palmL = { frames: fadeFrames(SPRITES.palmL, 5), fps: 18 };
    FX_FRAMES.streakR = { frames: fadeFrames(PR.streak(48, 18), 5), fps: 18 };
    FX_FRAMES.streakL = { frames: fadeFrames(mirrored(PR.streak(48, 18)), 5), fps: 18 };
    FX_FRAMES.boltA = { frames: fadeFrames(SPRITES.bolts[0], 4), fps: 22 };
    FX_FRAMES.boltB = { frames: fadeFrames(SPRITES.bolts[1], 4), fps: 22 };
    FX_FRAMES.boltC = { frames: fadeFrames(SPRITES.bolts[2], 4), fps: 22 };
    FX_FRAMES.tribBoltA = { frames: fadeFrames(SPRITES.tribulationBolts[0], 5), fps: 16 };
    FX_FRAMES.tribBoltB = { frames: fadeFrames(SPRITES.tribulationBolts[1], 5), fps: 16 };
    FX_FRAMES.tribBoltC = { frames: fadeFrames(SPRITES.tribulationBolts[2], 5), fps: 16 };

    const icon = src => framed(src, 16);
    Object.assign(ICONS, {
        flyingSword: icon(paint(IT.SWORD_ICON)),
        thunderTalisman: icon(SPRITES.talisman),
        lotusAura: icon(paint(IT.LOTUS_ICON)),
        mountainPalm: icon(SPRITES.palmR),
        swordFormation: swordFormationIcon(),
        jadeDisc: icon(SPRITES.jadeDisc),
        phoenixFire: icon(SPRITES.fireball[0]),
        frostNeedles: frostIcon(),
        heavenlySeal: icon(SPRITES.seal),
        azureDragon: icon(SPRITES.dragonHead),
        tigerPill: icon(PR.orb(5, P.r, P.R, "#ffffff")),
        silkRobe: icon(paint(IT.ROBE)),
        ginseng: icon(paint(IT.GINSENG)),
        jadeDew: icon(paint(IT.DEW)),
        incense: icon(paint(IT.INCENSE)),
        riverMap: icon(paint(IT.MAP)),
        cloudBoots: icon(paint(IT.BOOTS)),
        mirror: mirrorIcon(),
        qiBead: icon(PR.orb(5, P.p, P.P, P.v)),
        peach: icon(SPRITES.peach),
        insight: icon(SPRITES.qiL),
    });
}

// Icon for any technique or treasure definition; evolved forms get a golden halo.
export function iconOf(def) {
    if (!def.evolvesFrom) return ICONS[def.id];
    if (!ICONS[def.id]) {
        const c = makeCanvas(16, 16), ctx = c.getContext("2d");
        PR.disc(ctx, 8, 8, 7, "rgba(240, 194, 75, 0.45)");
        PR.ring(ctx, 8, 8, 7, 1, P.g);
        ctx.drawImage(ICONS[def.evolvesFrom.id], 0, 0);
        ctx.fillStyle = "#ffffff";
        for (const [x, y] of [[1, 1], [14, 2], [13, 14]]) {
            ctx.fillRect(x, y - 1, 1, 3);
            ctx.fillRect(x - 1, y, 3, 1);
        }
        ICONS[def.id] = c;
    }
    return ICONS[def.id];
}

function swordFormationIcon() {
    const c = makeCanvas(16, 16), ctx = c.getContext("2d");
    PR.ring(ctx, 8, 8, 7, 1, P.C, 2);
    ctx.drawImage(paint(IT.SWORD_ICON), 2, 2);
    return c;
}

function frostIcon() {
    const c = makeCanvas(16, 16), ctx = c.getContext("2d");
    for (const [x, y] of [[1, 2], [5, 7], [2, 12]]) ctx.drawImage(SPRITES.needle, x, y);
    return c;
}

function mirrorIcon() {
    const c = framed(PR.orb(6, P.g, P.G, "#ffffff"), 16), ctx = c.getContext("2d");
    PR.disc(ctx, 8, 8, 3, P.c);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(6, 6, 2, 2);
    return c;
}

// Kippy animations for an actor at a render scale: walk right/left plus white
// hit-flash variants, all packed into one sprite sheet.
export function actor(id, scale = 1) {
    const key = `${id}@${scale}`;
    let a = actorCache.get(key);
    if (a) return a;
    const { frames, fps } = ACTOR_FRAMES[id];
    const n = frames.length, fw = frames[0].width, fh = frames[0].height;
    const all = [
        ...frames,
        ...frames.map(mirrored),
        ...frames.map(f => silhouette(f, "#ffffff")),
        ...frames.map(f => silhouette(mirrored(f), "#ffffff")),
    ];
    const spriteSheet = new SpriteSheet({
        texture: strip(all), frameWidth: fw, frameHeight: fh,
        width: Math.round(fw * scale), height: Math.round(fh * scale),
    });
    const anim = k => new Animation({ spriteSheet, frames: Array.from({ length: n }, (_, i) => k * n + i), fps, loop: true });
    a = { animations: { R: anim(0), L: anim(1), hitR: anim(2), hitL: anim(3) }, w: spriteSheet.width, h: spriteSheet.height };
    actorCache.set(key, a);
    return a;
}

// First frame of an actor, for static previews (stage select cards).
export const actorFrame = id => ACTOR_FRAMES[id].frames[0];

// Shared Kippy Sprite for a SPRITES texture at a render scale.
export function sprite(id, scale = 1) {
    const key = `${id}@${scale.toFixed(2)}`;
    let s = spriteCache.get(key);
    if (!s) {
        const texture = SPRITES[id];
        s = new Sprite({ texture, width: Math.round(texture.width * scale), height: Math.round(texture.height * scale) });
        spriteCache.set(key, s);
    }
    return s;
}

export function makeAnimator(a) {
    const animator = new Animator({ animations: a.animations, default: "R" });
    // Desynchronize crowds so they don't step in lockstep.
    animator.frameIndex = Math.floor(Math.random() * a.animations.R.frames.length);
    animator.elapsed = Math.random() / a.animations.R.fps;
    return animator;
}

// One-shot effect animation, optionally scaled to a render size.
export function fxAnimator(id, scale = 1) {
    const key = `${id}@${scale.toFixed(2)}`;
    let anim = fxCache.get(key);
    if (!anim) {
        const { frames, fps } = FX_FRAMES[id];
        const fw = frames[0].width, fh = frames[0].height;
        const spriteSheet = new SpriteSheet({
            texture: strip(frames), frameWidth: fw, frameHeight: fh,
            width: Math.round(fw * scale), height: Math.round(fh * scale),
        });
        anim = new Animation({ spriteSheet, frames: frames.map((_, i) => i), fps, loop: false });
        fxCache.set(key, anim);
    }
    return new Animator({ animations: { play: anim }, default: "play" });
}

// Looping animation over a SPRITES frame list (fireballs and similar).
export function loopAnimator(spriteId, fps) {
    const key = `loop:${spriteId}`;
    let loop = fxCache.get(key);
    if (!loop) {
        const frames = SPRITES[spriteId];
        const spriteSheet = new SpriteSheet({ texture: strip(frames), frameWidth: frames[0].width, frameHeight: frames[0].height });
        loop = new Animation({ spriteSheet, frames: frames.map((_, i) => i), fps, loop: true });
        fxCache.set(key, loop);
    }
    return new Animator({ animations: { loop }, default: "loop" });
}

export function warnRingTexture(r, rgb) {
    const key = `${r}|${rgb}`;
    let t = ringCache.get(key);
    if (!t) {
        t = PR.warnRing(r, rgb);
        ringCache.set(key, t);
    }
    return t;
}

export function lotusTexture(r, gold = false) {
    const key = `lotus${r}${gold ? "g" : ""}`;
    let t = ringCache.get(key);
    if (!t) {
        t = PR.lotusRing(r, gold);
        ringCache.set(key, t);
    }
    return t;
}
