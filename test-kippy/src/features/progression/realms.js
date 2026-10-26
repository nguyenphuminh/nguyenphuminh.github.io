// Cultivation realms. Levels map onto realms; entering a new realm is a breakthrough.
export const REALMS = [
    { name: "Qi Refining", from: 1, color: "#c8ff8a" },
    { name: "Foundation Establishment", from: 10, color: "#5cc48f" },
    { name: "Golden Core", from: 18, color: "#f0c24b" },
    { name: "Nascent Soul", from: 26, color: "#c4ecff" },
    { name: "Soul Transformation", from: 34, color: "#d9a0ff" },
    { name: "Void Refining", from: 42, color: "#5b9ee6" },
    { name: "Mahayana", from: 50, color: "#f59ac0" },
];

const STAGES = ["Early", "Middle", "Late", "Peak"];

export function realmIndex(level) {
    let i = 0;
    while (i + 1 < REALMS.length && level >= REALMS[i + 1].from) i++;
    return i;
}

export function realmLabel(level) {
    const i = realmIndex(level), realm = REALMS[i];
    if (i === 0) return `${realm.name} Layer ${level}`;
    const span = (REALMS[i + 1]?.from ?? realm.from + 8) - realm.from;
    return `${STAGES[Math.min(3, Math.floor(((level - realm.from) / span) * 4))]} ${realm.name}`;
}

export function qiToNext(level) {
    return Math.round(5 + 6 * (level - 1) + (level > 20 ? 4 * (level - 20) : 0));
}
