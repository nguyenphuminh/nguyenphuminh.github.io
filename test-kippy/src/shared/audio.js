// Sound effects synthesized with WebAudio, so the game ships no audio files.
// The context is created on the first key/pointer press (browser autoplay rules).
let ac = null;
let master = null;
let muted = false;
const lastPlayed = {};
const VOLUME = 0.35;

export function unlockAudio() {
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = muted ? 0 : VOLUME;
        master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
}

export function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : VOLUME;
}

export const isMuted = () => muted;

function ready(name, gapMs) {
    if (!ac || muted) return false;
    const now = performance.now();
    if (lastPlayed[name] && now - lastPlayed[name] < gapMs) return false;
    lastPlayed[name] = now;
    return true;
}

function tone({ freq, to = freq, dur = 0.1, type = "square", vol = 0.2, delay = 0 }) {
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

let noiseBuffer = null;
function noise({ dur = 0.2, vol = 0.3, freq = 1200, type = "lowpass", delay = 0 }) {
    if (!noiseBuffer) {
        noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
}

// Qi pickups climb a pentatonic scale while collected in quick succession.
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
let pickupStep = 0;
let lastPickup = 0;

export const sfx = {
    hit() { if (ready("hit", 45)) tone({ freq: 300, to: 140, dur: 0.05, vol: 0.04 }); },
    kill() { if (ready("kill", 40)) noise({ dur: 0.07, vol: 0.07, freq: 2200 }); },
    pickup() {
        if (!ready("pickup", 28)) return;
        const now = performance.now();
        pickupStep = now - lastPickup < 400 ? Math.min(pickupStep + 1, PENTATONIC.length - 1) : 0;
        lastPickup = now;
        tone({ freq: 660 * 2 ** (PENTATONIC[pickupStep] / 12), dur: 0.07, type: "sine", vol: 0.07 });
    },
    levelUp() {
        if (!ready("levelUp", 200)) return;
        [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.14, delay: i * 0.07 }));
    },
    select() { if (ready("select", 60)) tone({ freq: 880, to: 1320, dur: 0.08, type: "triangle", vol: 0.1 }); },
    move() { if (ready("move", 40)) tone({ freq: 520, dur: 0.04, type: "square", vol: 0.04 }); },
    hurt() { if (ready("hurt", 120)) tone({ freq: 180, to: 60, dur: 0.18, type: "sawtooth", vol: 0.12 }); },
    thunder() {
        if (!ready("thunder", 80)) return;
        noise({ dur: 0.4, vol: 0.22, freq: 900 });
        tone({ freq: 110, to: 40, dur: 0.3, type: "sawtooth", vol: 0.06 });
    },
    explode() { if (ready("explode", 70)) noise({ dur: 0.3, vol: 0.18, freq: 600 }); },
    swing() { if (ready("swing", 60)) noise({ dur: 0.12, vol: 0.08, freq: 3000, type: "bandpass" }); },
    heal() { if (ready("heal", 100)) [784, 988, 1175].forEach((f, i) => tone({ freq: f, dur: 0.12, type: "sine", vol: 0.1, delay: i * 0.05 })); },
    boss() {
        if (!ready("boss", 500)) return;
        [110, 104, 98].forEach((f, i) => tone({ freq: f, dur: 0.5, type: "sawtooth", vol: 0.12, delay: i * 0.35 }));
    },
    breakthrough() {
        if (!ready("breakthrough", 500)) return;
        noise({ dur: 0.8, vol: 0.18, freq: 500 });
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, dur: 0.3, type: "triangle", vol: 0.12, delay: i * 0.08 }));
    },
    gameOver() {
        if (!ready("gameOver", 1000)) return;
        [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.4, type: "triangle", vol: 0.14, delay: i * 0.22 }));
    },
    victory() {
        if (!ready("victory", 1000)) return;
        [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone({ freq: f, dur: 0.3, type: "triangle", vol: 0.13, delay: i * 0.12 }));
    },
};
