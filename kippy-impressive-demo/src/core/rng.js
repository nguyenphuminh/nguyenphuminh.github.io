// Seeded PRNG (mulberry32) so a depth + seed always rebuilds the same cave
export function createRng(seed) {
    let s = seed >>> 0;

    const next = () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    return {
        next,
        range: (a, b) => a + (b - a) * next(),
        int: (a, b) => Math.floor(a + (b - a + 1) * next()),
        pick: (list) => list[Math.floor(next() * list.length)],
        chance: (p) => next() < p
    };
}

export function randomSeed() {
    return (Math.random() * 0xFFFFFFFF) >>> 0;
}
