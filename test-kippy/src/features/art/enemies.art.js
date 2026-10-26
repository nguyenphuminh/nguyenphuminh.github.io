// Demons, spirits and the restless dead. All face right; the atlas mirrors them.
const shiftUp = (rows, n) => [...rows.slice(n), ...Array(n).fill(".".repeat(rows[0].length))];

const JIANGSHI_BASE = [
    ".....kkkkk......",
    "....kkrrrkk.....",
    "...kkkkkkkkk....",
    "....kzzgzzk.....",
    "....kzzgzzk.....",
    "....kzegezk.....",
    "....kzzzzzk.....",
    "....kBBBBBkkkk..",
    "...kBBgBBBBzzzk.",
    "...kBBgBBBkkkk..",
    "...kBBBBBBk.....",
    "...kBBgBBBk.....",
    "...kBBBBBBk.....",
    "...kBkkkkBk.....",
    "...kk....kk.....",
    "................",
    "................",
];
// Hopping corpse: frame B is mid-hop.
export const JIANGSHI = [JIANGSHI_BASE, shiftUp(JIANGSHI_BASE, 2)];

export const FOX = [
    [
        "...........k.k.",
        "kk........kokok",
        "kwk......kooook",
        "kwok.....kooeok",
        "kookkkkkkooowwk",
        ".kOoooooooowwk.",
        "..kooooooooowk.",
        "..kooooooooook.",
        "...kok...kok...",
        "...kk....kk....",
    ],
    [
        "...........k.k.",
        "kk........kokok",
        "kwk......kooook",
        "kwok.....kooeok",
        "kookkkkkkooowwk",
        ".kOoooooooowwk.",
        "..kooooooooowk.",
        "..kooooooooook.",
        "....kokkok.....",
        "....kk..kk.....",
    ],
];

const WISP_BODY = [
    ".kcCwCwCck",
    "kCCkCkCCck",
    "kCCCCCCCck",
    "kCCCCCCCck",
    ".kCCCCCck.",
    "..kkCCkk..",
    "....kk....",
];
export const WISP = [
    [
        "....kk....",
        "...kck....",
        "..kccck...",
        "..kcCck.k.",
        ".kcCCcckck",
        ...WISP_BODY,
    ],
    [
        "......kk..",
        ".....kck..",
        "....kccck.",
        ".k.kcCcck.",
        "kckcCCcck.",
        ...WISP_BODY,
    ],
];

export const CROW = [
    [
        "..kk........",
        "..kPk.......",
        "...kPk......",
        "...kPPk.kk..",
        "kk.kPPPkYek.",
        ".kYYYYYYYYgk",
        "..kYYYYYYkk.",
        "...kkYkYk...",
        "............",
    ],
    [
        "............",
        "............",
        "........kk..",
        "kk......kYek",
        ".kYYYYYYYYgk",
        "..kYPPPYYkk.",
        "...kPPPk....",
        "...kPPk.....",
        "....kk......",
    ],
];

export const SNAKE = [
    [
        "..........kkkk..",
        ".........kppppk.",
        ".........kpeppPk",
        "..........kppPPk",
        "...kkk....kppk..",
        "..kpppk..kppk...",
        ".kpPPppk.kppk...",
        "kppk.kppkppk....",
        "kpk...kpppk.....",
        ".k.....kkk......",
    ],
    [
        "..........kkkk..",
        ".........kppppk.",
        ".........kpeppPk",
        "..........kppPPk",
        "..........kppk..",
        ".kkk.....kppk...",
        "kpppk...kppk....",
        "kpPppk.kppk.....",
        ".kk.kppppk......",
        ".....kkkk.......",
    ],
];

const GOLEM_BASE = [
    ".....kkkkk......",
    "....knnnnnk.....",
    "...knNnnnNnk....",
    "...kNNNNNNNk....",
    "...knnknnknk....",
    "...knnnnnnnk....",
    "....kNnnnNk.....",
    "..kkkNNNNNkkk...",
    ".knnkNNnNNknnk..",
    ".knnkNnnnNknnk..",
    ".kNNkNNNNNkNNk..",
    "..kkkNnnnNkkk...",
    "....kNnnnNk.....",
    "....kNNNNNk.....",
    "....knnknnk.....",
    "....knnknnk.....",
    "....kkk.kkk.....",
];
// Terracotta warrior: stomps (frame B sinks a pixel).
export const GOLEM = [GOLEM_BASE, ["................", ...GOLEM_BASE.slice(0, 14), "....knnknnk.....", "....kkk.kkk....."]];

const CULTIST_BASE = [
    ".....kkkkk......",
    "....kRRRRRk.....",
    "...kRRRRRRRk....",
    "...kRRkkkkRk....",
    "...kRkekekRk....",
    "...kRkkkkkRk....",
    "...kRRRRRRRk....",
    "..kRRrRRRrRRk...",
    ".kRRRrRRRrRRRk..",
    ".kwkRrRRRrRkwk..",
    "..kkRrRRRrRkk...",
    "...kRRRRRRRk....",
    "...kRRRRRRRk....",
    "...kRkkkkkRk....",
    "...kk.....kk....",
    "................",
];
// Blood demon cultivator: floats, bobbing.
export const CULTIST = [CULTIST_BASE, shiftUp(CULTIST_BASE, 1)];

// ---- Bamboo Ghost Marsh ----

const DROWNED_TOP = [
    "....kkkk....",
    "...khhhhk...",
    "..khhhhhhk..",
    "..khhzzzhk..",
    "..khhzezhk..",
    "..khhzzzhk..",
    "..khhwwwhhk.",
    ".khhwwwwwhk.",
    ".khwwwwwwwk.",
    "kzhwwWwwwwk.",
    ".kwwwWwwwwk.",
];
// Drowned ghost: a pale, long-haired spirit risen from the water.
export const DROWNED_GHOST = [
    [...DROWNED_TOP, "..kwwWwwwk..", "...kwwWwk...", "....kkkk...."],
    [...DROWNED_TOP, "..kwwWwwwk..", "..kwwWwwk...", "...kkkk....."],
];

const MONKEY_TOP = [
    "...kkk......",
    "..kZZZk.....",
    ".kZzzzZk....",
    ".kZzezek....",
    ".kZzzzzk....",
    "..kZkkZk..k.",
    ".kZZZZZZk.Zk",
    "kZZzzzZZZkZk",
    "kZzzzzzZZZk.",
    ".kZZZZZZZk..",
];
// Water monkey: a quick, grasping marsh imp.
export const WATER_MONKEY = [
    [...MONKEY_TOP, ".kZk..kZk...", ".kk....kk..."],
    [...MONKEY_TOP, "..kZkkZk....", "..kk..kk...."],
];

const TOAD_BASE = [
    "........kk.kk.",
    ".......kjekjek",
    "....kkkjjjjjjk",
    "..kkjjJjjjjjjk",
    ".kjjJjjjjjJjrk",
    "kjJjjjjJjjgggk",
    "kjjjJjjjjggggk",
    "kJjjjjjjgggggk",
    ".kJJjjjjggggk.",
    "..kjjk..kjjk..",
    ".kkkk....kkkk.",
    "..............",
    "..............",
];
// Toad demon: a warty brute that hops at you.
export const TOAD = [TOAD_BASE, shiftUp(TOAD_BASE, 2)];

const BONE_BASE = [
    "....kkkkk.....",
    "...knnnnnk....",
    "...kwwwwwk....",
    "...kwkwkwk....",
    "...kwwwwwk....",
    "....kwkwk.....",
    ".....kwk...k..",
    "...kkwwwkk.yk.",
    "..kwkwwwkwkyk.",
    "..kw.kwk.kwyk.",
    "..kk.kwk..kyk.",
    ".....kwk...y..",
    "....kwkwk..y..",
    "....kw.wk..y..",
    "....kw.wk.....",
    "...kkk.kkk....",
    "..............",
];
// Bone soldier: a skeleton spearman in a rusted helm.
export const BONE_SOLDIER = [BONE_BASE, shiftUp(BONE_BASE, 1)];

const LANTERN_BODY = [
    "...kkkk...",
    "..kRRRRk..",
    ".krrrrrrk.",
    "krrkrrkrrk",
    "krrrrrrrrk",
    "krrrkkrrrk",
    "krrrrrrrrk",
    ".kRrrrrRk.",
    "..kkkkkk..",
    "....kk....",
    "....gg....",
];
// Lantern ghost: a haunted paper lantern that spits ghost fire.
export const LANTERN_GHOST = [
    ["....gg....", "...gvvg...", "....gg....", ...LANTERN_BODY],
    ["...g..g...", "....vg....", "....gg....", ...LANTERN_BODY],
];

const BONE_DEMON_BASE = [
    "...k.k.k......",
    "...kwkwk......",
    "..kwwwwwk.....",
    "..kwkwkwk.....",
    "..kwwewwk.....",
    "..kwkwkwk.....",
    "..kWwwwWk.....",
    "..kPkwkPk.....",
    ".kPPpkpPPk....",
    "kwkPpppPPkwk..",
    "kwkPpwppPPkwk.",
    ".k.kPpppPPk.k.",
    "...kPpwppPk...",
    "...kPpppPPk...",
    "..kPPpppPPPk..",
    "..kPpPpPpPPk..",
];
// White Bone Demon: the skeletal queen of the marsh.
export const WHITE_BONE_DEMON = [
    [...BONE_DEMON_BASE, ".kPk.kPk.kPk..", ".kk..kk...kk.."],
    [...BONE_DEMON_BASE, "..kPk.kPk.kPk.", "..kk..kk..kk.."],
];

// ---- Frozen Sword Peak ----

const YETI_BASE = [
    ".....kkkkk......",
    "....kwwwwwk.....",
    "...kwwwwwwwk....",
    "...kwCCCCCwk....",
    "...kwCkCkCwk....",
    "...kwCCCCCwk....",
    "..kwwwCrrCwwk...",
    ".kwwwwwwwwwwwk..",
    "kwwWwwwwwwwWwwk.",
    "kwWkwwwwwwwkWwk.",
    "kwWk.kwwwk.kWwk.",
    "kWk..kwwwk..kWk.",
    ".k...kwWwk...k..",
    ".....kwWwk......",
    "....kwwkwwk.....",
    "....kwk.kwk.....",
    "...kkwk.kwkk....",
    "...kkk...kkk....",
];
// Frost yeti: a hulking snow ape.
export const FROST_YETI = [YETI_BASE, shiftUp(YETI_BASE, 1)];
