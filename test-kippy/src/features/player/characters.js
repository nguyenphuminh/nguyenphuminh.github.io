// The three playable cultivators. Each starts with a signature technique.
export const CHARACTERS = [
    {
        id: "linFeng",
        name: "Lin Feng",
        title: "Azure Sword Disciple",
        art: "linFeng",
        start: "flyingSword",
        perk: "+10% damage",
        aura: "#7fd4ff",
        stats: { maxHp: 100, speed: 72, might: 1.1 },
    },
    {
        id: "meiLing",
        name: "Mei Ling",
        title: "Thunder Talisman Daoist",
        art: "meiLing",
        start: "thunderTalisman",
        perk: "Techniques recharge 10% faster",
        aura: "#d9a0ff",
        stats: { maxHp: 90, speed: 74, cooldown: 0.9 },
    },
    {
        id: "shiHu",
        name: "Shi Hu",
        title: "Golden Body Monk",
        art: "shiHu",
        start: "mountainPalm",
        perk: "+30 max HP, +1 armor, slow regeneration",
        aura: "#ffd86b",
        stats: { maxHp: 130, speed: 66, armor: 1, regen: 0.2 },
    },
];
