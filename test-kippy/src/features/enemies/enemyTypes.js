// The horde. hp/damage are base values; hp scales up as the run goes on.
export const ENEMIES = {
    fox: { name: "Fox Spirit", art: "fox", hp: 7, speed: 56, damage: 5, qi: 1, radius: 5 },
    jiangshi: { name: "Hopping Corpse", art: "jiangshi", hp: 16, speed: 36, damage: 7, qi: 1, radius: 6, hop: true },
    wisp: { name: "Ghost Fire", art: "wisp", hp: 11, speed: 44, damage: 7, qi: 1, radius: 5, ghost: true, wobble: true },
    crow: { name: "Demon Crow", art: "crow", hp: 6, speed: 105, damage: 5, qi: 1, radius: 5, ghost: true },
    snake: { name: "Serpent Demon", art: "snake", hp: 28, speed: 48, damage: 10, qi: 2, radius: 6 },
    golem: { name: "Terracotta Warrior", art: "golem", hp: 75, speed: 28, damage: 14, qi: 3, radius: 7, mass: 4 },
    cultist: {
        name: "Blood Demon Cultivator", art: "cultist", hp: 42, speed: 40, damage: 10, qi: 3, radius: 6,
        ranged: { range: 120, cooldown: 2.8, speed: 85, damage: 9 },
    },
    thunderSprite: { name: "Thunder Sprite", art: "thunderSprite", hp: 60, speed: 62, damage: 12, qi: 2, radius: 5, ghost: true, wobble: true },

    // Bamboo Ghost Marsh.
    drownedGhost: { name: "Drowned Ghost", art: "drownedGhost", hp: 12, speed: 46, damage: 7, qi: 1, radius: 5, ghost: true, wobble: true },
    waterMonkey: { name: "Water Monkey", art: "waterMonkey", hp: 8, speed: 62, damage: 6, qi: 1, radius: 5 },
    toad: { name: "Toad Demon", art: "toad", hp: 26, speed: 34, damage: 10, qi: 2, radius: 6, hop: true },
    boneSoldier: { name: "Bone Soldier", art: "boneSoldier", hp: 40, speed: 32, damage: 12, qi: 2, radius: 6, mass: 2 },
    lanternGhost: {
        name: "Lantern Ghost", art: "lanternGhost", hp: 36, speed: 36, damage: 9, qi: 3, radius: 6, ghost: true,
        ranged: { range: 130, cooldown: 2.6, speed: 80, damage: 10, sprite: "ghostFire" },
    },
    // Illusions cast by the White Bone Demon: one hit breaks them.
    boneDecoy: {
        name: "Bone Illusion", art: "whiteBoneDemon", scale: 2.6, hp: 1, fixedHp: true, speed: 52, damage: 10, qi: 0, radius: 12, ghost: true,
        lifetime: 12, glow: { color: "#c9b6ff", bloom: 12, intensity: 1 },
    },

    // Frozen Sword Peak.
    snowWolf: { name: "Snow Wolf", art: "snowWolf", hp: 9, speed: 56, damage: 5, qi: 1, radius: 5 },
    iceSpirit: { name: "Ice Spirit", art: "iceSpirit", hp: 14, speed: 44, damage: 8, qi: 1, radius: 5, ghost: true, wobble: true },
    snowHawk: { name: "Snow Hawk", art: "snowHawk", hp: 8, speed: 115, damage: 6, qi: 1, radius: 5, ghost: true },
    frostYeti: { name: "Frost Yeti", art: "frostYeti", hp: 70, speed: 30, damage: 12, qi: 3, radius: 8, mass: 4 },
    rogueCultivator: {
        name: "Rogue Sword Cultivator", art: "rogueCultivator", hp: 50, speed: 42, damage: 11, qi: 3, radius: 6,
        ranged: { range: 140, cooldown: 2.4, speed: 120, damage: 11, sprite: "swordWave", aligned: true },
    },
};

export const BOSSES = {
    corpseKing: {
        id: "corpseKing", name: "Corpse King", subtitle: "Lord of the Hopping Dead", art: "corpseKing", scale: 2.5,
        hp: 1200, speed: 30, damage: 18, radius: 15, mass: 60, qi: 60, behavior: "leap", color: "#d9a0ff",
        leap: { summon: "jiangshi", count: 4 },
    },
    nineTails: {
        id: "nineTails", name: "Nine-Tailed Fox", subtitle: "Thousand-Year Demon Empress", art: "nineTails", scale: 2.6,
        hp: 2800, speed: 60, damage: 18, radius: 13, mass: 60, qi: 100, behavior: "dash", color: "#f59ac0",
        glow: { color: "#f59ac0", bloom: 10, intensity: 1 },
        dash: { orbit: 95, speed: 400, attack: { kind: "ring", sprite: "foxFire", count: 14, speed: 75, damage: 12 }, summon: { type: "fox", count: 4, every: 9 } },
    },
    tribulation: {
        id: "tribulation", name: "Heavenly Tribulation", subtitle: "Heaven Itself Judges Your Dao", art: "tribulation", scale: 2,
        hp: 12000, damage: 0, radius: 30, behavior: "storm", color: "#fff6a8", final: true,
        glow: { color: "#fff6a8", bloom: 12, intensity: 1 },
    },

    // Bamboo Ghost Marsh.
    toadKing: {
        id: "toadKing", name: "Toad King", subtitle: "Bloated Tyrant of the Reeds", art: "toadKing", scale: 2.6,
        hp: 1500, speed: 34, damage: 20, radius: 15, mass: 60, qi: 60, behavior: "leap", color: "#f0c24b",
        leap: { summon: "toad", count: 4 },
    },
    drownedBride: {
        id: "drownedBride", name: "Drowned Bride", subtitle: "She Still Waits for Her Groom", art: "drownedBride", scale: 2.4,
        hp: 3400, speed: 36, damage: 18, radius: 12, mass: 60, qi: 100, behavior: "blink", color: "#ff8a8a", ghost: true,
        glow: { color: "#ff6b6b", bloom: 10, intensity: 1 },
        blink: { every: 4.5, ring: { sprite: "ghostFire", count: 12, speed: 70, damage: 12 }, summon: { type: "drownedGhost", count: 4, every: 9 } },
    },
    whiteBoneDemon: {
        id: "whiteBoneDemon", name: "White Bone Demon", subtitle: "A Thousand Faces, None of Them Hers", art: "whiteBoneDemon", scale: 2.6,
        hp: 15000, speed: 45, damage: 22, radius: 14, mass: 80, behavior: "bone", color: "#e8e4ff", final: true,
        glow: { color: "#c9b6ff", bloom: 12, intensity: 1 },
    },

    // Frozen Sword Peak.
    snowApeKing: {
        id: "snowApeKing", name: "Snow Ape King", subtitle: "He Who Hurls the Avalanche", art: "snowApeKing", scale: 2.4,
        hp: 1500, speed: 40, damage: 16, radius: 16, mass: 80, qi: 60, behavior: "dash", color: "#c4ecff",
        dash: { orbit: 110, speed: 300, attack: { kind: "volley", sprite: "snowball", count: 3, spread: 0.35, speed: 110, damage: 12 }, summon: { type: "snowWolf", count: 3, every: 12 } },
    },
    swordSaint: {
        id: "swordSaint", name: "Rogue Sword Saint", subtitle: "Cast Out for Killing His Masters", art: "swordSaint", scale: 2.2,
        hp: 4200, speed: 70, damage: 20, radius: 10, mass: 60, qi: 100, behavior: "dash", color: "#ffffff",
        glow: { color: "#c4ecff", bloom: 8, intensity: 1 },
        dash: { orbit: 130, speed: 440, attack: { kind: "volley", sprite: "swordWave", count: 5, spread: 0.5, speed: 150, damage: 12, aligned: true }, summon: { type: "rogueCultivator", count: 2, every: 12 } },
    },
    frostDragon: {
        id: "frostDragon", name: "Frost Dragon", subtitle: "Winter Coiled Around the Peak", art: "frostDragon", scale: 2.5,
        hp: 17000, damage: 20, radius: 16, behavior: "frost", color: "#c4ecff", final: true,
        glow: { color: "#c4ecff", bloom: 12, intensity: 1 },
    },
};
