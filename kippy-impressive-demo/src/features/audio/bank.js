import { Sound } from "kippy";
import * as synth from "./synth.js";

// The nine choir voices, one per beacon in the order they are woken: together a D minor (add9) chord
export const CHOIR_NOTES = [146.83, 220, 174.61, 261.63, 329.63, 196, 293.66, 440, 73.42];

const DEFS = [
    ["ping", synth.ping, { volume: 0.75 }],
    ["hum", synth.hum, { volume: 0.25, loop: true, maxInstances: 1 }],
    ["dash", synth.dash, { volume: 0.55 }],
    ["bump", synth.bump, { volume: 0.5 }],
    ["hurt", synth.hurt, { volume: 0.9 }],
    ["relight", synth.relight, { volume: 0.85 }],
    ["bell", synth.bell, { volume: 0.55, maxInstances: 12 }],
    ["pluck", synth.pluck, { volume: 0.55 }],
    ["rumble", synth.rumble, { volume: 0.6, loop: true }],
    ["screech", synth.screech, { volume: 0.6 }],
    ["huff", synth.huff, { volume: 0.45 }],
    ["heartbeat", synth.heartbeat, { volume: 0.7 }],
    ["riftOpen", synth.riftOpen, { volume: 0.8 }],
    ["tick", synth.tick, { volume: 0.3 }],
    ["drone", synth.drone, { volume: 0.7, loop: true, bus: "music", maxInstances: 1 }],
    ["tension", synth.tension, { volume: 0.4, loop: true, bus: "music", maxInstances: 1 }],
    ...CHOIR_NOTES.map((f, i) => [`voice${i}`, () => synth.voice(f, 500 + i), { volume: 0.32, loop: true, bus: "music", maxInstances: 1 }])
];

function toBuffer(channels) {
    const buffer = new AudioBuffer({ length: channels[0].length, numberOfChannels: channels.length, sampleRate: synth.SR });
    channels.forEach((data, ch) => buffer.copyToChannel(data, ch));
    return buffer;
}

// Synthesizes every sound, yielding between them so the loading screen keeps animating
export async function buildSounds(onProgress) {
    const sounds = {};
    for (let i = 0; i < DEFS.length; i++) {
        const [name, make, options] = DEFS[i];
        sounds[name] = new Sound({ src: toBuffer(make()), bus: "sfx", ...options });
        onProgress((i + 1) / DEFS.length);
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return sounds;
}
