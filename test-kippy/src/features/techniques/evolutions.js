import { TECH_BY_ID } from "./techniques.js";

// Evolutions: a max-level technique plus its paired treasure (any level)
// transforms when the next Spirit Chest is opened. Each evolved form reuses its
// base technique's behaviour with new stats and a variant twist.
function evolution(fromId, treasure, def, variant) {
    const from = TECH_BY_ID[fromId];
    return {
        ...def,
        noun: from.noun,
        maxLevel: 1,
        levels: [],
        evolvesFrom: from,
        treasure,
        create: (scene, p, inst) => from.create(scene, p, inst, variant),
    };
}

const EVOLUTIONS = [
    evolution("flyingSword", "tigerPill", {
        id: "swordArray", name: "Ten-Thousand Sword Array",
        desc: "An endless stream of golden swords.",
        base: { damage: 30, cooldown: 0.45, amount: 4, pierce: 4, speed: 300, area: 1.2 },
    }, { spriteId: "goldSword", gap: 0.04 }),
    evolution("thunderTalisman", "incense", {
        id: "nineHeavensThunder", name: "Nine Heavens Thunder",
        desc: "Tribulation lightning that chains to a second foe.",
        base: { damage: 75, cooldown: 1.6, amount: 6, area: 1.8 },
    }, { bolts: ["tribBoltA", "tribBoltB", "tribBoltC"], lift: 85, chain: true }),
    evolution("lotusAura", "jadeDew", {
        id: "lotusSanctuary", name: "Pure Lotus Sanctuary",
        desc: "A golden lotus burns foes and heals you for each one.",
        base: { damage: 20, cooldown: 0.3, area: 1.9 },
    }, { gold: true, heal: 0.4 }),
    evolution("mountainPalm", "silkRobe", {
        id: "vajraPalm", name: "Vajra Buddha Palm",
        desc: "Colossal palms on both sides that stun what they strike.",
        base: { damage: 72, cooldown: 1, amount: 4, area: 1.7 },
    }, { reach: 80, kb: 220, stun: 0.4 }),
    evolution("swordFormation", "riverMap", {
        id: "swordDomain", name: "Sword Domain of Mountains and Rivers",
        desc: "Golden swords orbit you forever.",
        base: { damage: 32, cooldown: 1, duration: Infinity, amount: 6, area: 1.8, speed: 4.6 },
    }, { spriteId: "goldSword" }),
    evolution("jadeDisc", "cloudBoots", {
        id: "jadeWheel", name: "Wind-Riding Jade Wheel",
        desc: "Wheels that fly out, then circle back around you.",
        base: { damage: 27, cooldown: 1.3, amount: 5, area: 1.6, speed: 270 },
    }, { homing: true }),
    evolution("phoenixFire", "ginseng", {
        id: "vermilionBird", name: "Vermilion Bird Rebirth",
        desc: "Each blast is reborn as four smaller fireballs.",
        base: { damage: 45, cooldown: 1.7, amount: 5, area: 1.7, speed: 150 },
    }, { split: 4 }),
    evolution("frostNeedles", "mirror", {
        id: "frostBloom", name: "Thousand Frost Lotus",
        desc: "A full ring of needles that briefly freezes foes.",
        base: { damage: 20, cooldown: 0.7, amount: 16, area: 1.2, pierce: 3, speed: 300 },
    }, { ring: true, freeze: 0.5 }),
    evolution("heavenlySeal", "riverMap", {
        id: "imperialSeal", name: "Mountain-Toppling Imperial Seal",
        desc: "Gigantic seals that stun long and scorch the ground.",
        base: { damage: 130, cooldown: 2.2, amount: 4, area: 1.8, duration: 2 },
    }, { stun: 1.2, size: 1.4, holy: 0.5 }),
    evolution("azureDragon", "qiBead", {
        id: "dragonPearl", name: "Azure Dragon Chasing the Pearl",
        desc: "Dragons that hunt foes down, chasing a spirit pearl.",
        base: { damage: 110, cooldown: 3.2, amount: 3, area: 1.5, speed: 260 },
    }, { homing: true }),
];

const EVOLUTION_OF = Object.fromEntries(EVOLUTIONS.map(e => [e.evolvesFrom.id, e]));

export const evolutionOf = def => EVOLUTION_OF[def.id];
export const evolutionsUsing = treasureId => EVOLUTIONS.filter(e => e.treasure === treasureId);

export function canEvolve(p, inst) {
    const into = EVOLUTION_OF[inst.def.id];
    return Boolean(into && inst.level >= inst.def.maxLevel && p.treasures.some(t => t.def.id === into.treasure));
}

export function evolveTechnique(scene, p, inst) {
    const into = EVOLUTION_OF[inst.def.id];
    inst.behavior.dispose?.();
    inst.def = into;
    inst.level = 1;
    inst.timer = 0.2;
    inst.behavior = into.create(scene, p, inst);
    return into;
}
