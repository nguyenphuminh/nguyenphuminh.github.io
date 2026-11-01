import { damp } from "../../core/math.js";

// Score that outlives scenes: the ambient bed, one voice per woken beacon, and a tension layer
export function createMusic(sounds) {
    let drone = null;
    let tension = null;
    let level = 0;
    const voices = new Map();

    function start() {
        if (!drone) drone = sounds.drone.play({ loop: true, fadeIn: 5 });
    }

    function addVoice(index, fadeIn = 4) {
        if (voices.has(index)) return;
        voices.set(index, sounds[`voice${index}`].play({ loop: true, fadeIn }));
    }

    // Keep exactly these voices (used when entering or replaying a depth)
    function setVoices(list) {
        for (const index of list) addVoice(index, 3);
        for (const [index, instance] of voices) {
            if (!list.includes(index)) {
                instance.fadeOut(2.5);
                voices.delete(index);
            }
        }
    }

    function update(dt, target) {
        level = damp(level, target, target > level ? 1.5 : 0.6, dt);
        if (level > 0.01 && !tension) tension = sounds.tension.play({ loop: true, volume: 0 });
        if (tension) {
            tension.volume = sounds.tension.volume * level;
            if (level <= 0.01 && target === 0) {
                tension.stop();
                tension = null;
            }
        }
    }

    function stopTension() {
        tension?.stop();
        tension = null;
        level = 0;
    }

    return { start, addVoice, setVoices, update, stopTension };
}
