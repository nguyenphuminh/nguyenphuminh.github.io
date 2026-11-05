export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (value, target, delta) =>
    value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
