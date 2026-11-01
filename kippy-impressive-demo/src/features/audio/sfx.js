import { clamp } from "../../core/math.js";

const HEARING = 1300;

// One-shot sound effects, quieter the farther they are from the player
export function createSfx(sounds, listenerPos) {
    function play(name, { x, y, volume = 1, pitch = 1, range = HEARING } = {}) {
        let v = volume;
        if (x !== undefined) {
            const p = listenerPos();
            const d = Math.hypot(x - p.x, y - p.y);
            v *= clamp(1 - d / range, 0, 1) ** 1.5;
            if (v < 0.01) return null;
        }
        return sounds[name].play({ volume: v, pitch });
    }

    // Volume for a looping sound at a world position
    function falloff(x, y, range = 750) {
        const p = listenerPos();
        return clamp(1 - Math.hypot(x - p.x, y - p.y) / range, 0, 1) ** 2;
    }

    return { play, falloff, sounds };
}
