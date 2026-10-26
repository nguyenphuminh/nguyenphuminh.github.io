import { recolor } from "../../shared/pixel.js";

// Playable cultivators, 16 px wide, facing right. Frames A/B make a two-step walk
// (B is lifted one pixel so the stride reads as a bounce).
const BLANK = "................";

const FACE = [
    "...khhhhhhhk....",
    "..khhhhhhhhhk...",
    "..khhssssssshk..",
    "..khsskssksshk..",
    "..khssssssssk...",
    "...kSsssmsSk....",
];

const ROBE = [
    "....kkwwwwkk....",
    "...kbwwwbwwbk...",
    "..kswwwwbwwwsk..",
    "...kwwwwbwwwk...",
    "...kbbbbbbbbk...",
];

const LEGS_A = [
    "....kWWk.kWWk...",
    "....kkk...kkk...",
];

const LEGS_B = [
    ".....kWWkWWk....",
    ".....kkkkkkk....",
];

function walk(head, face, robe) {
    return [
        [BLANK, ...head, ...face, ...robe, ...LEGS_A],
        [...head, ...face, ...robe, ...LEGS_B, BLANK],
    ];
}

// Lin Feng: white and azure sword-sect robes, topknot with a gold pin.
export const LIN_FENG = walk(
    [
        "......kkk.......",
        ".....khhhk......",
        "....kkkgkkk.....",
    ],
    FACE,
    ROBE,
);

// Mei Ling: violet Daoist robes with gold trim, twin buns tied in red.
export const MEI_LING = walk(
    [
        "...kkk...kkk....",
        "..khrhk.khrhk...",
        "...kkhhhhhkk....",
    ],
    FACE,
    recolor(ROBE, { w: "p", b: "g", W: "P" }),
);

// Shi Hu: shaved-head body refiner in saffron robes and prayer beads.
export const SHI_HU = walk(
    [
        BLANK,
        BLANK,
        ".....kkkkkk.....",
    ],
    [
        "...ksssssssk....",
        "..ksssssSsssk...",
        "..kssssssssssk..",
        "..kssskssksssk..",
        "..kSssssssssk...",
        "...kSsssmsSk....",
    ],
    [
        "....kkNoNokk....",
        ...recolor(ROBE.slice(1), { w: "o", b: "O" }),
    ],
).map(frame => recolor(frame, { W: "N" }));

// Rogue sword cultivator (Frozen Sword Peak enemy): the same build in dark robes,
// with a red headband and burning eyes.
export const ROGUE = walk(
    [
        "......kkk.......",
        ".....khhhk......",
        "....kkkrkkk.....",
    ],
    FACE.map(row => row.replace("..khsskssksshk..", "..khssessesshk..")),
    recolor(ROBE, { w: "Y", b: "R", W: "k" }),
);
