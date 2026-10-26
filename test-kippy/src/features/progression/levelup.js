import { TECHNIQUES, addTechnique, upgradeText } from "../techniques/techniques.js";
import { TREASURES } from "../treasures/treasures.js";
import { evolutionOf, evolutionsUsing } from "../techniques/evolutions.js";
import { computeStats } from "../player/player.js";

const MAX_SLOTS = 6;

const HEAL = { kind: "heal", name: "Healing Pill", icon: "peach", desc: "Restore 30% of your max HP." };
const INSIGHT = { kind: "insight", name: "Dao Insight", icon: "insight", desc: "+2% damage for the rest of the run." };

// An evolved technique still counts as owning its base form.
const owns = (list, def) => list.some(t => t.def === def || t.def.evolvesFrom === def);

function pool(p) {
    const out = [];
    for (const t of p.techniques) if (t.level < t.def.maxLevel) out.push({ kind: "tech", def: t.def, owned: t, level: t.level + 1, weight: 1.3 });
    if (p.techniques.length < MAX_SLOTS) {
        for (const def of TECHNIQUES) if (!owns(p.techniques, def)) out.push({ kind: "tech", def, level: 1, weight: 1 });
    }
    for (const t of p.treasures) if (t.level < t.def.maxLevel) out.push({ kind: "treasure", def: t.def, owned: t, level: t.level + 1, weight: 1.1 });
    if (p.treasures.length < MAX_SLOTS) {
        for (const def of TREASURES) if (!owns(p.treasures, def)) out.push({ kind: "treasure", def, level: 1, weight: 0.9 });
    }
    return out;
}

// Weighted draw without replacement; owned items come up a little more often.
export function rollChoices(p, count = 3) {
    const options = pool(p), out = [];
    while (out.length < count && options.length) {
        let r = Math.random() * options.reduce((sum, c) => sum + c.weight, 0), i = 0;
        while ((r -= options[i].weight) > 0 && i < options.length - 1) i++;
        out.push(options.splice(i, 1)[0]);
    }
    return out.length ? out : [HEAL, INSIGHT];
}

// Spirit chest: one free upgrade to something already owned.
export function chestChoice(p) {
    const owned = pool(p).filter(c => c.owned);
    return owned.length ? owned[Math.floor(Math.random() * owned.length)] : HEAL;
}

// `hints` are the icon ids of evolution partners (treasure for a technique, and vice versa).
export function choiceInfo(c) {
    if (!c.def) return { name: c.name, icon: c.icon, tag: "", desc: c.desc, hints: [] };
    const hints = c.kind === "tech" ? [evolutionOf(c.def)?.treasure].filter(Boolean) : evolutionsUsing(c.def.id).map(e => e.evolvesFrom.id);
    if (c.level === 1) return { name: c.def.name, icon: c.def.id, tag: "New!", desc: c.def.desc, hints };
    const desc = c.kind === "tech" ? upgradeText(c.def, c.level) : c.def.desc;
    return { name: c.def.name, icon: c.def.id, tag: `Lv ${c.level}`, desc, hints };
}

export function applyChoice(scene, c) {
    const p = scene.player;
    if (c.kind === "heal") {
        p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.3);
    } else if (c.kind === "insight") {
        p.bonusMight += 0.02;
        computeStats(p);
    } else if (c.kind === "tech") {
        if (c.owned) c.owned.level++;
        else addTechnique(scene, p, c.def);
    } else {
        if (c.owned) c.owned.level++;
        else p.treasures.push({ def: c.def, level: 1 });
        computeStats(p);
    }
}
