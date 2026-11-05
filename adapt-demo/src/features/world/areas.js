// The journey's areas (BRD 2.2.1): layout, boss, mob posts, inscriptions, decoration and cutscenes per area.
// Every arena interior is exactly as wide as the training arena (432 px), so bosses see the same distances.
import { FLOOR_Y } from "../combat/index.js";

export const VIEW_WIDTH = 480;
export const VIEW_HEIGHT = 270;
const ARENA_INNER = 432;
const WALL = 24;

function area(def) {
    const arenaLeft = def.veilX + 58;
    return {
        floorY: FLOOR_Y,
        approach: { minX: def.minX ?? 12, maxX: def.veilX - 12 },
        arenaLeft,
        arena: { minX: arenaLeft + WALL, maxX: arenaLeft + WALL + ARENA_INNER },
        arenaEntryX: arenaLeft + 60,
        bossX: arenaLeft + 330,
        interactRange: 26,
        ...def,
    };
}

export const AREAS = {
    outerWard: area({
        id: "outerWard",
        name: "The Outer Ward",
        bossId: "squire",
        next: "hallOfPanes",
        minX: 24,
        gateX: 58,
        roadShardX: 118,
        shrineX: 200,
        veilX: 1520,
        backdrop: "yardBackdrop",
        mobs: [
            { id: "shardling", x: 430 }, { id: "shardling", x: 462 },
            { id: "sentinel", x: 720 },
            { id: "shardling", x: 930 }, { id: "shardling", x: 960 }, { id: "sentinel", x: 1010 },
            { id: "sentinel", x: 1300 },
        ],
        inscriptions: [
            { x: 330, id: "ow-roll" },
            { x: 610, id: "ow-parry" },
            { x: 1170, id: "ow-heal" },
        ],
        decor: [
            { key: "statue", x: 150 }, { key: "candles", x: 176 }, { key: "candles", x: 226 },
            { key: "brokenPillar", x: 380 }, { key: "rubble", x: 520 }, { key: "banner", x: 660 },
            { key: "chains", x: 800, hang: 60 }, { key: "statue", x: 860 }, { key: "rubble", x: 1080 },
            { key: "brokenPillar", x: 1240 }, { key: "banner", x: 1400 }, { key: "candles", x: 1478 },
        ],
        arenaProps: [{ key: "trainingPost", dx: 370 }],
        cutscenes: { enter: "arrival", intro: "squireIntro", defeat: "squireBreaks" },
        music: "outer",
    }),
    hallOfPanes: area({
        id: "hallOfPanes",
        name: "The Hall of Panes",
        bossId: "mirrorwright",
        next: "silveredHeart",
        minX: 24,
        shrineX: 360,
        veilX: 1660,
        bg: { sky: "hallSky", far: "hallFar", mid: "hallMid" },
        floor: "hallFloor",
        floorSegments: [{ toX: 384, tile: "bridgeFloor" }], // the area begins on an interior bridge
        backdrop: "arenaBackdrop",
        openBackdrop: "arenaBackdropOpen", // after the Mirrorwright falls, the far wall opens onto a stair
        mirrorPanes: [430, 500, 860, 1240, 1520],
        mobs: [
            { id: "shardling", x: 600 }, { id: "shardling", x: 632 },
            { id: "archer", x: 820 }, { id: "sentinel", x: 960 },
            { id: "archer", x: 1150 }, { id: "shardling", x: 1260 }, { id: "shardling", x: 1290 },
            { id: "sentinel", x: 1460 },
        ],
        inscriptions: [
            { x: 560, id: "hp-forge" },
            { x: 1050, id: "hp-first" },
            { x: 1380, id: "hp-doubt" },
        ],
        decor: [
            { key: "candelabra", x: 330 }, { key: "candelabra", x: 392 }, { key: "brokenMirror", x: 700 },
            { key: "chains", x: 760, hang: 50 }, { key: "candelabra", x: 1000 }, { key: "brokenMirror", x: 1100 },
            { key: "chains", x: 1330, hang: 40 }, { key: "candelabra", x: 1600 },
        ],
        arenaDecor: [
            { key: "chains", dx: 150, hang: 30 }, { key: "chains", dx: 330, hang: 46 },
            { key: "candles", dx: 44 }, { key: "candles", dx: 436 },
        ],
        arenaProps: [{ key: "glassAnvil", dx: 362, name: "anvil" }],
        cutscenes: { enter: "hallEntry", intro: "mirrorwrightIntro", defeat: "smithRests" },
        music: "hall",
    }),
    silveredHeart: area({
        id: "silveredHeart",
        name: "The Silvered Heart",
        bossId: "reflection",
        next: null, // the last area: defeating the Reflection leads to the ending
        minX: 24,
        shrineX: 170,
        veilX: 1320,
        bg: { sky: "heartSky", far: "heartFar", mid: "heartMid" },
        floor: "heartFloor",
        backdrop: null,
        reflectiveFloor: true,
        mobs: [
            { id: "archer", x: 470 }, { id: "echo", x: 640 }, { id: "echo", x: 690 },
            { id: "shardling", x: 830 }, { id: "shardling", x: 860 }, { id: "archer", x: 1000 },
            { id: "echo", x: 1150 },
        ],
        inscriptions: [
            { x: 380, id: "sh-knights" },
            { x: 920, id: "sh-keeps" },
            { x: 1230, id: "sh-last" },
        ],
        decor: [{ key: "brokenMirror", x: 560 }, { key: "brokenMirror", x: 1060 }],
        arenaDecor: [],
        arenaProps: [{ key: "greatMirror", dx: 330, name: "greatMirror", depth: -2 }],
        cutscenes: { enter: "heartEntry", intro: "reflectionIntro", ending: "ending" },
        music: "heart",
    }),
};

export const AREA_ORDER = ["outerWard", "hallOfPanes", "silveredHeart"];

export const nearX = (area, x, targetX) => Math.abs(x - targetX) < area.interactRange;
export const nearVeil = (area, x) => x > area.veilX - area.interactRange - 6 && x < area.arenaLeft;

/** Camera x (left edge) in the approach: follows the knight and never shows the arena. */
export function approachCameraX(area, playerX) {
    const max = area.veilX + 24 - VIEW_WIDTH;
    return Math.max(0, Math.min(max, Math.round(playerX - VIEW_WIDTH * 0.4)));
}

export const arenaCameraX = (area) => area.arenaLeft;
