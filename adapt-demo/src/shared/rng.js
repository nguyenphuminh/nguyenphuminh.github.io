// Seeded pseudo-random generator (mulberry32). Same sequence in Node and in browsers.
export function createRng(seed = 1) {
    let s = seed >>> 0;

    function next() {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    return {
        next,
        range: (min, max) => min + (max - min) * next(),
        int: (min, maxExclusive) => min + Math.floor(next() * (maxExclusive - min)),
        chance: (p) => next() < p,
        pick: (list) => list[Math.floor(next() * list.length)],
        normal(mean = 0, std = 1) {
            const u = Math.max(next(), 1e-12);
            return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
        },
        get state() {
            return s;
        },
        set state(value) {
            s = value >>> 0;
        },
    };
}
