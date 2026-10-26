// Passive treasures and pills. Each level stacks its effect.
export const TREASURES = [
    { id: "tigerPill", name: "Tiger Bone Pill", maxLevel: 5, desc: "+10% damage.", apply: (s, lv) => { s.might += 0.1 * lv; } },
    { id: "silkRobe", name: "Golden Silk Robe", maxLevel: 5, desc: "Take 1 less damage from every hit.", apply: (s, lv) => { s.armor += lv; } },
    { id: "ginseng", name: "Blood Ginseng", maxLevel: 5, desc: "+20% max HP.", apply: (s, lv) => { s.maxHpMul += 0.2 * lv; } },
    { id: "jadeDew", name: "Jade Dew", maxLevel: 5, desc: "Recover 0.3 HP per second.", apply: (s, lv) => { s.regen += 0.3 * lv; } },
    { id: "incense", name: "Clear Mind Incense", maxLevel: 5, desc: "Techniques recharge 8% faster.", apply: (s, lv) => { s.cooldown *= 1 - 0.08 * lv; } },
    { id: "riverMap", name: "Mountain River Map", maxLevel: 5, desc: "+10% technique area.", apply: (s, lv) => { s.area += 0.1 * lv; } },
    { id: "cloudBoots", name: "Cloud-Stepping Boots", maxLevel: 5, desc: "+10% movement speed.", apply: (s, lv) => { s.speedMul += 0.1 * lv; } },
    { id: "mirror", name: "Mirror of Myriad Forms", maxLevel: 2, desc: "Techniques create 1 more projectile.", apply: (s, lv) => { s.amount += lv; } },
    { id: "qiBead", name: "Qi-Drawing Bead", maxLevel: 5, desc: "+30% qi pickup range.", apply: (s, lv) => { s.magnetMul += 0.3 * lv; } },
];

export const TREASURE_BY_ID = Object.fromEntries(TREASURES.map(t => [t.id, t]));
