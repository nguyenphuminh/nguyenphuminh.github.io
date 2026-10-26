import { makeCanvas } from "./pixel.js";

// 5x7 uppercase bitmap font. Text is drawn from a cached glyph atlas so it stays
// pixel-crisp and needs no font files.
const GLYPHS = {
    "A": ".###.|#...#|#...#|#####|#...#|#...#|#...#",
    "B": "####.|#...#|#...#|####.|#...#|#...#|####.",
    "C": ".###.|#...#|#....|#....|#....|#...#|.###.",
    "D": "####.|#...#|#...#|#...#|#...#|#...#|####.",
    "E": "#####|#....|#....|####.|#....|#....|#####",
    "F": "#####|#....|#....|####.|#....|#....|#....",
    "G": ".###.|#...#|#....|#.###|#...#|#...#|.####",
    "H": "#...#|#...#|#...#|#####|#...#|#...#|#...#",
    "I": "###|.#.|.#.|.#.|.#.|.#.|###",
    "J": "..###|...#.|...#.|...#.|#..#.|#..#.|.##..",
    "K": "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
    "L": "#....|#....|#....|#....|#....|#....|#####",
    "M": "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
    "N": "#...#|#...#|##..#|#.#.#|#..##|#...#|#...#",
    "O": ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
    "P": "####.|#...#|#...#|####.|#....|#....|#....",
    "Q": ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
    "R": "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    "S": ".####|#....|#....|.###.|....#|....#|####.",
    "T": "#####|..#..|..#..|..#..|..#..|..#..|..#..",
    "U": "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
    "V": "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
    "W": "#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.",
    "X": "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    "Y": "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
    "Z": "#####|....#|...#.|..#..|.#...|#....|#####",
    "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
    "1": ".#.|##.|.#.|.#.|.#.|.#.|###",
    "2": ".###.|#...#|....#|...#.|..#..|.#...|#####",
    "3": "####.|....#|....#|.###.|....#|....#|####.",
    "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
    "5": "#####|#....|####.|....#|....#|#...#|.###.",
    "6": ".###.|#....|#....|####.|#...#|#...#|.###.",
    "7": "#####|....#|...#.|..#..|.#...|.#...|.#...",
    "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    "9": ".###.|#...#|#...#|.####|....#|....#|.###.",
    " ": "..|..|..|..|..|..|..",
    ".": ".|.|.|.|.|.|#",
    ",": "..|..|..|..|..|.#|#.",
    ":": ".|.|#|.|.|#|.",
    ";": "..|..|.#|..|..|.#|#.",
    "!": "#|#|#|#|#|.|#",
    "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
    "-": "....|....|....|####|....|....|....",
    "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
    "%": "##..#|##..#|...#.|..#..|.#...|#..##|#..##",
    "/": "....#|...#.|...#.|..#..|.#...|.#...|#....",
    "(": ".#|#.|#.|#.|#.|#.|.#",
    ")": "#.|.#|.#|.#|.#|.#|#.",
    "[": "##|#.|#.|#.|#.|#.|##",
    "]": "##|.#|.#|.#|.#|.#|##",
    "'": "#|#|.|.|.|.|.",
    "\"": "#.#|#.#|...|...|...|...|...",
    ">": "#...|.#..|..#.|...#|..#.|.#..|#...",
    "<": "...#|..#.|.#..|#...|.#..|..#.|...#",
    "=": "....|....|####|....|####|....|....",
    "*": ".....|#.#.#|.###.|#####|.###.|#.#.#|.....",
    "&": ".##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#",
};

const H = 7;
const glyphs = new Map();
const tints = new Map();
let atlas = null;

function buildAtlas() {
    const list = [];
    let x = 0;
    for (const [ch, src] of Object.entries(GLYPHS)) {
        const rows = src.split("|");
        list.push({ ch, rows, x, w: rows[0].length });
        x += rows[0].length + 1;
    }
    atlas = makeCanvas(x, H);
    const ctx = atlas.getContext("2d");
    ctx.fillStyle = "#fff";
    for (const g of list) {
        g.rows.forEach((row, y) => {
            for (let i = 0; i < row.length; i++) if (row[i] === "#") ctx.fillRect(g.x + i, y, 1, 1);
        });
        glyphs.set(g.ch, { x: g.x, w: g.w });
    }
}

function tinted(color) {
    let t = tints.get(color);
    if (!t) {
        t = makeCanvas(atlas.width, H);
        const ctx = t.getContext("2d");
        ctx.drawImage(atlas, 0, 0);
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, t.width, H);
        tints.set(color, t);
    }
    return t;
}

function textWidth(str, scale = 1) {
    if (!atlas) buildAtlas();
    let w = 0;
    for (const ch of String(str).toUpperCase()) w += (glyphs.get(ch)?.w ?? 3) + 1;
    return Math.max(0, w - 1) * scale;
}

export function drawText(ctx, str, x, y, { color = "#f3eee0", scale = 1, align = "left", shadow = "#120e1a" } = {}) {
    if (!atlas) buildAtlas();
    str = String(str).toUpperCase();
    const w = textWidth(str, scale);
    const left = Math.round(align === "center" ? x - w / 2 : align === "right" ? x - w : x);
    y = Math.round(y);
    if (shadow) run(ctx, str, left + scale, y + scale, tinted(shadow), scale);
    run(ctx, str, left, y, tinted(color), scale);
    return w;
}

function run(ctx, str, x, y, tex, scale) {
    for (const ch of str) {
        const g = glyphs.get(ch);
        if (!g) {
            x += 4 * scale;
            continue;
        }
        ctx.drawImage(tex, g.x, 0, g.w, H, x, y, g.w * scale, H * scale);
        x += (g.w + 1) * scale;
    }
}

function wrapText(str, maxWidth, scale = 1) {
    const lines = [];
    let line = "";
    for (const word of String(str).split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (textWidth(next, scale) > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

// Wraps text to `maxWidth` and draws it line by line; returns the y below the last line.
export function drawWrapped(ctx, text, x, y, maxWidth, { lineHeight = 10, maxLines = Infinity, ...style } = {}) {
    for (const line of wrapText(text, maxWidth, style.scale ?? 1).slice(0, maxLines)) {
        drawText(ctx, line, x, y, style);
        y += lineHeight;
    }
    return y;
}

export const wrappedLines = (text, maxWidth) => wrapText(text, maxWidth).length;
