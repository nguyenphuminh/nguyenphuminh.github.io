import { createRng } from "../../core/rng.js";

// Offline DSP: every sound in the game is computed here into raw sample arrays.
export const SR = 44100;
const TAU = Math.PI * 2;

const make = (seconds, channels = 1) => Array.from({ length: channels }, () => new Float32Array(Math.round(seconds * SR)));

// Snap a frequency so it completes a whole number of cycles in `seconds` (click-free loops)
const loopFreq = (f, seconds) => Math.round(f * seconds) / seconds;

class Biquad {
    constructor(type, freq, q = 0.707) {
        this.type = type;
        this.x1 = this.x2 = this.y1 = this.y2 = 0;
        this.set(freq, q);
    }

    set(freq, q = this.q) {
        this.q = q;
        const w = (TAU * Math.min(freq, SR * 0.45)) / SR;
        const cos = Math.cos(w);
        const alpha = Math.sin(w) / (2 * q);
        let b0;
        let b1;
        let b2;
        if (this.type === "lowpass") {
            b0 = (1 - cos) / 2;
            b1 = 1 - cos;
            b2 = (1 - cos) / 2;
        } else if (this.type === "highpass") {
            b0 = (1 + cos) / 2;
            b1 = -(1 + cos);
            b2 = (1 + cos) / 2;
        } else {
            b0 = alpha;
            b1 = 0;
            b2 = -alpha;
        }
        const a0 = 1 + alpha;
        this.b0 = b0 / a0;
        this.b1 = b1 / a0;
        this.b2 = b2 / a0;
        this.a1 = (-2 * cos) / a0;
        this.a2 = (1 - alpha) / a0;
    }

    run(x) {
        const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
        this.x2 = this.x1;
        this.x1 = x;
        this.y2 = this.y1;
        this.y1 = y;
        return y;
    }
}

// Freeverb-style reverb (8 damped combs + 4 allpasses), stereo-spread per channel
function reverb(channels, { mix = 0.3, room = 0.84, damp = 0.3 } = {}) {
    const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
    const passes = [556, 441, 341, 225];

    return channels.map((input, ch) => {
        const spread = ch * 23;
        const cb = combs.map((n) => ({ buf: new Float32Array(n + spread), i: 0, store: 0 }));
        const ap = passes.map((n) => ({ buf: new Float32Array(n + spread), i: 0 }));
        const out = new Float32Array(input.length);

        for (let n = 0; n < input.length; n++) {
            const x = input[n] * 0.015;
            let sum = 0;
            for (const c of cb) {
                const y = c.buf[c.i];
                c.store = y * (1 - damp) + c.store * damp;
                c.buf[c.i] = x + c.store * room;
                if (++c.i >= c.buf.length) c.i = 0;
                sum += y;
            }
            for (const a of ap) {
                const b = a.buf[a.i];
                a.buf[a.i] = sum + b * 0.5;
                sum = b - sum;
                if (++a.i >= a.buf.length) a.i = 0;
            }
            out[n] = input[n] * (1 - mix) + sum * 3 * mix;
        }
        return out;
    });
}

function normalize(channels, peak = 0.8) {
    let max = 0;
    for (const d of channels) for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
    if (max > 0) for (const d of channels) for (let i = 0; i < d.length; i++) d[i] *= peak / max;
    return channels;
}

// Short fades at both ends so one-shots never click
function edges(channels, fadeIn = 0.002, fadeOut = 0.05) {
    for (const d of channels) {
        const a = Math.round(fadeIn * SR);
        const b = Math.round(fadeOut * SR);
        for (let i = 0; i < a; i++) d[i] *= i / a;
        for (let i = 0; i < b; i++) d[d.length - 1 - i] *= i / b;
    }
    return channels;
}

// Crossfade the tail (beyond loopLen) into the head so non-periodic noise loops seamlessly
function loopify(channels, loopLen) {
    return channels.map((d) => {
        const fade = d.length - loopLen;
        const out = d.slice(0, loopLen);
        for (let i = 0; i < fade; i++) {
            const t = i / fade;
            out[i] = d[i] * Math.sqrt(t) + d[loopLen + i] * Math.sqrt(1 - t);
        }
        return out;
    });
}

function brownNoise(rng, length) {
    const out = new Float32Array(length);
    let v = 0;
    for (let i = 0; i < length; i++) {
        v = (v + (rng.next() * 2 - 1) * 0.02) * 0.998;
        out[i] = v;
    }
    return out;
}

const mono = (d) => [d];
const stereo = (d) => [d, d.slice()];

// The sonar "song": a falling sine chirp, discrete echoes, then a long cave reverb
export function ping() {
    const [d] = make(3.4);
    const rng = createRng(11);
    const bp = new Biquad("bandpass", 3200, 2);
    let phase = 0;
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const f = 740 + 260 * Math.exp(-t / 0.05);
        phase += (TAU * f) / SR;
        const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.32);
        const click = t < 0.012 ? bp.run(rng.next() * 2 - 1) * (1 - t / 0.012) * 0.6 : 0;
        d[i] = (Math.sin(phase) + 0.3 * Math.sin(phase * 2) + 0.12 * Math.sin(phase * 3.01)) * env + click;
    }
    // Feedback delay with darkening repeats
    const delay = Math.round(0.26 * SR);
    const lp = new Biquad("lowpass", 2200);
    for (let i = delay; i < d.length; i++) d[i] += lp.run(d[i - delay]) * 0.42;
    return edges(normalize(reverb(stereo(d), { mix: 0.38, room: 0.88, damp: 0.35 }), 0.85));
}

export function hum() {
    const L = 1;
    const [d] = make(L);
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        d[i] = Math.sin(TAU * 220 * t) * 0.6 + Math.sin(TAU * 330 * t) * 0.25 + Math.sin(TAU * 221 * t) * 0.3;
    }
    return normalize(mono(d), 0.5);
}

export function dash() {
    const [d] = make(0.55);
    const rng = createRng(21);
    const bp = new Biquad("bandpass", 2400, 1.2);
    let phase = 0;
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        if (i % 64 === 0) bp.set(2400 * Math.exp(-t * 4) + 300, 1.2);
        const env = Math.min(1, t / 0.02) * Math.exp(-t / 0.14);
        phase += (TAU * (90 * Math.exp(-t * 6) + 45)) / SR;
        d[i] = bp.run(rng.next() * 2 - 1) * env * 1.4 + Math.sin(phase) * Math.exp(-t / 0.08) * 0.6;
    }
    return edges(normalize(mono(d), 0.8));
}

export function bump() {
    const [d] = make(0.35);
    const rng = createRng(31);
    const lp = new Biquad("lowpass", 700);
    let phase = 0;
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        phase += (TAU * (110 * Math.exp(-t * 9) + 55)) / SR;
        d[i] = Math.sin(phase) * Math.exp(-t / 0.07) + lp.run(rng.next() * 2 - 1) * Math.exp(-t / 0.03) * 0.7;
    }
    return edges(normalize(mono(d), 0.8));
}

export function hurt() {
    const [d] = make(1.1);
    const rng = createRng(41);
    const lp = new Biquad("lowpass", 1200);
    let p1 = 0;
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        p1 += (TAU * (70 * Math.exp(-t * 3) + 38)) / SR;
        const thump = Math.tanh(Math.sin(p1) * 3) * Math.exp(-t / 0.35);
        const trem = 0.6 + 0.4 * Math.sin(TAU * 11 * t);
        const dissonance = (Math.sin(TAU * 311 * t) + Math.sin(TAU * 440 * t) * 0.8) * Math.exp(-t / 0.45) * trem * 0.35;
        const crunch = lp.run(rng.next() * 2 - 1) * Math.exp(-t / 0.06) * 0.8;
        d[i] = thump + dissonance + crunch;
    }
    return edges(normalize(reverb(stereo(d), { mix: 0.2, room: 0.7 }), 0.85));
}

function harmonicTone(f, t, n = 6) {
    let s = 0;
    for (let k = 1; k <= n; k++) s += Math.sin(TAU * f * k * t + k) / (k * k * 0.7 + 0.3);
    return s;
}

// A beacon waking: a swelling chord with shimmering bells on top
export function relight() {
    const [d] = make(5.5);
    const rng = createRng(51);
    const chord = [293.66, 349.23, 440, 587.33, 659.25];
    const bells = Array.from({ length: 14 }, () => ({ t0: rng.range(1.2, 3.8), f: rng.pick([1174.66, 1318.5, 1760, 1396.9, 2349.3]) }));
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const swell = Math.min(1, t / 1.6) ** 2 * Math.exp(-Math.max(0, t - 1.8) / 1.3);
        let s = 0;
        for (const f of chord) s += harmonicTone(f * (1 + 0.002 * Math.sin(TAU * 4.5 * t)), t, 5);
        s *= swell * 0.22;
        for (const b of bells) {
            if (t > b.t0) s += Math.sin(TAU * b.f * (t - b.t0)) * Math.exp(-(t - b.t0) / 0.6) * 0.18;
        }
        d[i] = s;
    }
    return edges(normalize(reverb(stereo(d), { mix: 0.45, room: 0.9, damp: 0.25 }), 0.85), 0.01, 0.3);
}

// Inharmonic bell for echo pearls and beacon resonance
export function bell() {
    const [d] = make(3);
    const partials = [[1, 1, 1.6], [2, 0.5, 1], [2.76, 0.35, 0.7], [4.07, 0.2, 0.5], [5.4, 0.12, 0.35]];
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        let s = 0;
        for (const [r, a, decay] of partials) s += Math.sin(TAU * 660 * r * t) * a * Math.exp(-t / decay);
        d[i] = s * Math.min(1, t / 0.002);
    }
    return edges(normalize(reverb(stereo(d), { mix: 0.3, room: 0.86 }), 0.8));
}

// Karplus-Strong pluck
export function pluck() {
    const [d] = make(1.2);
    const rng = createRng(61);
    const n = Math.round(SR / 880);
    const buf = Float32Array.from({ length: n }, () => rng.next() * 2 - 1);
    for (let i = 0; i < d.length; i++) {
        const j = i % n;
        const next = (buf[j] + buf[(j + 1) % n]) * 0.5 * 0.996;
        d[i] = buf[j];
        buf[j] = next;
    }
    return edges(normalize(reverb(stereo(d), { mix: 0.3, room: 0.8 }), 0.7));
}

// Listener growl loop: brown noise rumble with a slow throb and a sub tone
export function rumble() {
    const L = 4;
    const rng = createRng(71);
    const len = Math.round((L + 0.5) * SR);
    const noise = brownNoise(rng, len);
    const lp = new Biquad("lowpass", 120, 0.9);
    for (let i = 0; i < len; i++) noise[i] = lp.run(noise[i]) * 18;
    const [d] = loopify([noise], Math.round(L * SR));
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const am = 0.6 + 0.4 * Math.sin(TAU * 1.5 * t);
        d[i] = (d[i] + Math.sin(TAU * 45 * t) * 0.35) * am;
    }
    return normalize(mono(d), 0.8);
}

// Hunting screech: FM sweep plus breathy noise
export function screech() {
    const [d] = make(1.4);
    const rng = createRng(81);
    const bp = new Biquad("bandpass", 2000, 1.5);
    let pc = 0;
    let pm = 0;
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const fc = 380 + 520 * Math.exp(-t / 0.35);
        pc += (TAU * fc) / SR;
        pm += (TAU * fc * 1.41) / SR;
        const index = 1 + 3 * Math.exp(-t / 0.4);
        const env = Math.min(1, t / 0.04) * Math.exp(-t / 0.45);
        d[i] = Math.tanh((Math.sin(pc + index * Math.sin(pm)) + bp.run(rng.next() * 2 - 1) * 0.8) * 1.8) * env;
    }
    return edges(normalize(reverb(stereo(d), { mix: 0.3, room: 0.85 }), 0.8));
}

export function huff() {
    const [d] = make(0.8);
    const rng = createRng(91);
    const lp = new Biquad("lowpass", 320);
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const env = Math.sin(Math.PI * Math.min(1, t / 0.7)) ** 2;
        d[i] = (lp.run(rng.next() * 2 - 1) * 2 + Math.sin(TAU * 80 * t) * 0.4) * env;
    }
    return edges(normalize(mono(d), 0.7));
}

export function heartbeat() {
    const [d] = make(0.9);
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        const beat = (t0, a) => (t > t0 ? Math.sin(TAU * 52 * (t - t0)) * Math.exp(-(t - t0) / 0.09) * a : 0);
        d[i] = beat(0, 1) + beat(0.27, 0.7);
    }
    return edges(normalize(mono(d), 0.9));
}

export function riftOpen() {
    const [d] = make(4);
    const rng = createRng(101);
    const lp = new Biquad("lowpass", 200, 1.2);
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        if (i % 64 === 0) lp.set(200 + 2800 * (t / 4) ** 2, 1.2);
        const boom = Math.sin(TAU * 40 * t) * Math.exp(-t / 1.4);
        const rise = lp.run(rng.next() * 2 - 1) * Math.min(1, t / 2.5) * Math.exp(-Math.max(0, t - 3) / 0.4) * 0.8;
        d[i] = boom + rise;
    }
    return edges(normalize(reverb(stereo(d), { mix: 0.35, room: 0.9 }), 0.85), 0.01, 0.4);
}

export function tick() {
    const [d] = make(0.15);
    for (let i = 0; i < d.length; i++) {
        const t = i / SR;
        d[i] = Math.sin(TAU * 1200 * t) * Math.exp(-t / 0.03);
    }
    return edges(normalize(mono(d), 0.5));
}

// Deep ambient bed: periodic sub tones + crossfaded brown noise + a distant whale-like moan
export function drone() {
    const L = 16;
    const n = Math.round(L * SR);
    const rng = createRng(111);
    const out = [];

    for (let ch = 0; ch < 2; ch++) {
        const len = Math.round((L + 1.5) * SR);
        const noise = brownNoise(rng, len);
        const lp = new Biquad("lowpass", 200, 0.8);
        for (let i = 0; i < len; i++) {
            if (i % 128 === 0) lp.set(150 + 120 * (0.5 + 0.5 * Math.sin((TAU * 3 * i) / n + ch)), 0.8);
            noise[i] = lp.run(noise[i]) * 14;
        }
        const [bed] = loopify([noise], n);

        const f1 = loopFreq(36.71, L);
        const f2 = loopFreq(55, L);
        const f3 = loopFreq(73.42, L);
        let moan = 0;
        for (let i = 0; i < n; i++) {
            const t = i / SR;
            const swell = 0.6 + 0.4 * Math.sin((TAU * t) / L);
            let s = Math.sin(TAU * f1 * t + ch * 0.3) * 0.5 * swell + Math.sin(TAU * f2 * t) * 0.22 + Math.sin(TAU * f3 * t + ch) * 0.1 * (0.5 + 0.5 * Math.sin((TAU * 2 * t) / L));
            if (t > 3 && t < 10) {
                const u = (t - 3) / 7;
                const f = (120 + 50 * Math.sin(Math.PI * u) - 20 * u) * (1 + 0.01 * Math.sin(TAU * 5 * t));
                moan += (TAU * f) / SR;
                s += Math.sin(moan) * Math.sin(Math.PI * u) ** 2 * 0.07;
            }
            bed[i] = bed[i] * 0.6 + s;
        }
        out.push(bed);
    }
    return normalize(out, 0.6);
}

// One choir voice: a formant ("aah") wavetable with chorus detune and vibrato, looping in 8 s
export function voice(f0, seed) {
    const L = 8;
    const N = 4096;
    const rng = createRng(seed);
    const table = new Float32Array(N);
    const formants = [[730, 110, 1], [1090, 130, 0.5], [2440, 200, 0.25]];
    const kmax = Math.min(60, Math.floor(5200 / f0));

    for (let k = 1; k <= kmax; k++) {
        const f = k * f0;
        let gain = 0.12;
        for (const [fc, bw, g] of formants) gain += g * Math.exp(-0.5 * ((f - fc) / bw) ** 2);
        const amp = gain / Math.sqrt(k);
        const ph = rng.range(0, TAU);
        for (let n = 0; n < N; n++) table[n] += amp * Math.sin((TAU * k * n) / N + ph);
    }

    const len = Math.round(L * SR);
    const detunes = [[-7, 0, 5], [-4, 1, 8]];
    const out = detunes.map((cents) => {
        const d = new Float32Array(len);
        for (const c of cents) {
            const f = loopFreq(f0 * 2 ** (c / 1200), L);
            const vibPh = rng.range(0, TAU);
            let phase = rng.next();
            for (let i = 0; i < len; i++) {
                const t = i / SR;
                phase += (f * (1 + 0.003 * Math.sin(TAU * 5 * t + vibPh))) / SR;
                const x = (phase - Math.floor(phase)) * N;
                const j = Math.floor(x);
                const frac = x - j;
                d[i] += table[j] + (table[(j + 1) % N] - table[j]) * frac;
            }
        }
        const ampPh = rng.range(0, TAU);
        for (let i = 0; i < len; i++) d[i] *= 0.8 + 0.2 * Math.sin((TAU * 2 * i) / len + ampPh);
        return d;
    });
    return normalize(out, 0.5);
}

// High dissonant shimmer that rises while something hunts the player
export function tension() {
    const L = 4;
    const n = Math.round(L * SR);
    const rng = createRng(121);
    const out = [];
    for (let ch = 0; ch < 2; ch++) {
        const len = Math.round((L + 0.5) * SR);
        const hp = new Biquad("highpass", 3000);
        const hiss = new Float32Array(len);
        for (let i = 0; i < len; i++) hiss[i] = hp.run(rng.next() * 2 - 1) * 0.08;
        const [d] = loopify([hiss], n);
        const a = loopFreq(1174.66 * (ch ? 1.002 : 1), L);
        const b = loopFreq(1244.51 * (ch ? 0.998 : 1), L);
        for (let i = 0; i < n; i++) {
            const t = i / SR;
            const trem = 0.5 + 0.5 * Math.sin(TAU * 6 * t + ch);
            const pulse = Math.exp(-((t * 2) % 1) * 6);
            d[i] += (Math.sin(TAU * a * t) + Math.sin(TAU * b * t)) * 0.18 * trem + Math.sin(TAU * 55 * t) * pulse * 0.3;
        }
        out.push(d);
    }
    return normalize(out, 0.5);
}
