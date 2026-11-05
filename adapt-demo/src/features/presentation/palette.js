// Shared color palette (BRD 4: dark world, cyan/magenta boss accents, gold player/shrine, red = unparryable).
import { ramp, rgba } from "./pixel.js";

export const HEX = {
    ink: "#0d0b16",
    outline: "#120f1c",
    sep: "#1c1830",
    night0: "#0b0d1e",
    night1: "#151a33",
    night2: "#222a4a",
    night3: "#323d63",
    stone0: "#1e2032",
    stone1: "#2f3248",
    stone2: "#474b66",
    stone3: "#6a6f8c",
    stone4: "#9196b0",
    violet0: "#1d1430",
    violet1: "#2e1f48",
    violet2: "#463066",
    moon: "#e9e4f2",
    gold0: "#7a4f1c",
    gold1: "#b07a2c",
    gold2: "#e0b050",
    gold3: "#ffe08a",
    gold4: "#fff6d0",
    cyan0: "#1b6a7a",
    cyan1: "#2fb8cc",
    cyan2: "#5ff0ff",
    cyan3: "#c8fbff",
    mag0: "#7a1b62",
    mag1: "#c42fa0",
    mag2: "#ff4fd8",
    mag3: "#ffc8f2",
    red0: "#5a0f16",
    red1: "#a01c26",
    red2: "#e8323c",
    red3: "#ff8a8a",
    blood: "#c0283a",
    green1: "#4f8a3c",
    green2: "#8fd06a",
    white: "#ffffff",
    text: "#e8e6f0",
    textDim: "#9a96b0",
};

export const C = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, rgba(v)]));

// Character ramps.
export const R = {
    // Player knight
    steel: ramp("#f0f4ff", "#a9b3cc", "#666f8c"),
    steelDark: ramp("#a2abc6", "#6d7592", "#434a64"),
    cloth: ramp("#5a78c8", "#34509a", "#22346a"),
    clothDark: ramp("#34446e", "#253254", "#171f38"),
    cape: ramp("#4a66b0", "#2c4280", "#1a2852"),
    gold: ramp("#ffe08a", "#e0b050", "#9a6a28"),
    blade: ramp("#ffffff", "#d8e2f0", "#8f9bb4"),
    leather: ramp("#6a4a3a", "#4a3328", "#2e1f18"),
    // Boss
    obsidian: ramp("#6a7294", "#3d4360", "#23263a"),
    obsidianDark: ramp("#4a5070", "#2c3048", "#191b2a"),
    tabard: ramp("#4e3672", "#34234f", "#1f1533"),
    tabardDark: ramp("#3a2856", "#251a3a", "#150e22"),
    glass: ramp("#ecfdff", "#9fdcef", "#4f88a8"),
    accent: ramp("#c8fbff", "#5ff0ff", "#2fb8cc"),
    // World
    stone: ramp("#6a6f8c", "#474b66", "#2f3248"),
    stoneDark: ramp("#474b66", "#2f3248", "#1e2032"),
    flame: ramp("#fff6d0", "#ffe08a", "#e0b050"),
};

// Accent colors used only for the boss's glowing parts; recolored to magenta for phase 2.
export const ACCENT_TO_PHASE2 = new Map([
    [rgba("#c8fbff"), rgba("#ffc8f2")],
    [rgba("#5ff0ff"), rgba("#ff4fd8")],
    [rgba("#2fb8cc"), rgba("#c42fa0")],
    [rgba("#1b6a7a"), rgba("#7a1b62")],
    [rgba("#9fdcef"), rgba("#e7a2dc")],
    [rgba("#4f88a8"), rgba("#8a4f9a")],
    [rgba("#ecfdff"), rgba("#ffeefa")],
]);
