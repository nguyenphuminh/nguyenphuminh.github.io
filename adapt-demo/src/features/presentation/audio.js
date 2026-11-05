// Synthesized audio: every sound effect is computed sample by sample; the music loops are rendered
// in the background with an OfflineAudioContext. Wrapped in Kippy Sounds on the "sfx"/"music" buses.
import { Sound } from "kippy";

// ---------------------------------------------------------------- DSP helpers

function mulberry32(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function makeDsp(SR) {
    const rnd = mulberry32(1234);
    const N = (d) => new Float32Array(Math.max(1, Math.ceil(d * SR)));
    const noise = () => rnd() * 2 - 1;

    // Chamberlin state-variable bandpass with per-sample cutoff.
    function svf() {
        let low = 0, band = 0;
        return (x, fc, q = 0.5) => {
            const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
            low += f * band;
            const high = x - low - q * band;
            band += f * high;
            return { low, band, high };
        };
    }
    const mix = (...parts) => {
        const out = N(Math.max(...parts.map((p) => p.length)) / SR);
        for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
        return out;
    };
    const delay = (a, sec) => {
        const out = N(a.length / SR + sec), o = Math.floor(sec * SR);
        for (let i = 0; i < a.length; i++) out[i + o] = a[i];
        return out;
    };
    const scale = (a, g) => { for (let i = 0; i < a.length; i++) a[i] *= g; return a; };

    const whoosh = (dur, f0, f1, amp, q = 0.6) => {
        const out = N(dur), filt = svf();
        for (let i = 0; i < out.length; i++) {
            const t = i / out.length, fc = f0 + (f1 - f0) * Math.sin(t * Math.PI * 0.5);
            out[i] = filt(noise(), fc, q).band * amp * Math.sin(Math.PI * t) ** 2 * 1.6;
        }
        return out;
    };
    const thud = (dur, f0, f1, amp) => {
        const out = N(dur);
        let ph = 0;
        for (let i = 0; i < out.length; i++) {
            const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t * 28);
            ph += (2 * Math.PI * f) / SR;
            out[i] = Math.sin(ph) * Math.exp(-t / (dur * 0.32)) * amp * Math.min(1, t * 800);
        }
        return out;
    };
    const burst = (dur, fc, amp, q = 0.8) => {
        const out = N(dur), filt = svf();
        for (let i = 0; i < out.length; i++) out[i] = filt(noise(), fc, q).band * Math.exp(-(i / SR) / (dur * 0.3)) * amp * 1.5;
        return out;
    };
    const rumble = (dur, fc, amp) => {
        const out = N(dur), filt = svf();
        for (let i = 0; i < out.length; i++) {
            const t = i / SR;
            out[i] = filt(noise(), fc * (1 - 0.5 * t / dur), 0.9).low * amp * Math.min(1, t * 30) * Math.exp(-t / (dur * 0.45)) * 2.2;
        }
        return out;
    };
    const ping = (dur, freqs, amp, decay = 0.25, detune = 0) => {
        const out = N(dur);
        freqs.forEach((f, k) => {
            const d = dur * decay * (1 - k * 0.12);
            const fall = Math.exp(-1 / (d * SR));
            // Sine via rotation recurrence (cheap and exact enough for short sounds)
            const w1 = (2 * Math.PI * f) / SR, w2 = (2 * Math.PI * f * (1 + detune)) / SR;
            let s1 = 0, c1 = 1, s2 = 0, c2 = 1, e = amp / freqs.length;
            const cw1 = Math.cos(w1), sw1 = Math.sin(w1), cw2 = Math.cos(w2), sw2 = Math.sin(w2);
            for (let i = 0; i < out.length; i++) {
                const att = i < SR / 2000 ? i / (SR / 2000) : 1;
                out[i] += (s1 + (detune ? s2 : 0)) * e * att;
                e *= fall;
                const ns1 = s1 * cw1 + c1 * sw1; c1 = c1 * cw1 - s1 * sw1; s1 = ns1;
                if (detune) { const ns2 = s2 * cw2 + c2 * sw2; c2 = c2 * cw2 - s2 * sw2; s2 = ns2; }
            }
        });
        return out;
    };
    const tone = (dur, f0, f1, wave, amp, lp = 0) => {
        const out = N(dur), filt = svf();
        let ph = 0;
        for (let i = 0; i < out.length; i++) {
            const t = i / out.length;
            ph += (2 * Math.PI * (f0 + (f1 - f0) * t)) / SR;
            const p = (ph / (2 * Math.PI)) % 1;
            let v = wave === "square" ? (p < 0.5 ? 1 : -1) : wave === "saw" ? p * 2 - 1 : wave === "tri" ? 1 - 4 * Math.abs(p - 0.5) : Math.sin(ph);
            if (lp) v = filt(v, lp, 0.7).low;
            out[i] = v * amp * Math.min(1, i / (SR * 0.004)) * (1 - t) ** 1.5;
        }
        return out;
    };
    const growl = (dur, f, amp) => {
        const out = N(dur), filt = svf();
        for (let i = 0; i < out.length; i++) {
            const t = i / SR;
            const v = ((f * t) % 1) * 2 - 1 + (((f * 1.013 * t) % 1) * 2 - 1) + (((f * 0.5 * t) % 1) * 2 - 1) * 0.6;
            out[i] = filt(v, 380 + 200 * Math.sin(t * 9), 0.6).low * amp * Math.min(1, t * 8) * Math.exp(-t / (dur * 0.5)) * (0.8 + 0.2 * Math.sin(t * 40));
        }
        return out;
    };
    // Adds `part` into `out` at a time offset (in place; out is long enough by construction).
    const addAt = (out, part, sec, gain = 1) => {
        const o = Math.floor(sec * SR), n = Math.min(part.length, out.length - o);
        for (let i = 0; i < n; i++) out[o + i] += part[i] * gain;
        return out;
    };
    const shatter = (dur, amp, seed = 7) => {
        const r = mulberry32(seed);
        const out = N(dur * 1.45);
        addAt(out, burst(dur * 0.4, 5200, amp * 0.7, 0.4), 0);
        for (let k = 0; k < 26; k++) {
            const f = 1800 + r() * 5200;
            const len = 0.25 + r() * dur * 0.5, gain = amp * (0.35 + r() * 0.4), at = r() * dur * 0.45;
            addAt(out, ping(len, [f, f * 1.47], gain, 0.3), at);
        }
        return out;
    };
    const cascade = (dur, amp, seed = 3) => {
        const r = mulberry32(seed), notes = [1174.7, 1396.9, 1568, 1760, 2093, 2349.3, 2793.8];
        const out = N(dur + 0.7);
        for (let k = 0; k < 16; k++) {
            const f = notes[Math.floor(r() * notes.length)] * (r() < 0.3 ? 2 : 1);
            const gain = amp * (0.4 + r() * 0.5), at = (k / 16) * dur * 0.75 + r() * 0.05;
            addAt(out, ping(0.6, [f, f * 2.76], gain, 0.35), at);
        }
        return out;
    };
    const arp = (freqs, step, noteDur, amp) => {
        const out = N(step * freqs.length + noteDur);
        freqs.forEach((f, k) => addAt(out, ping(noteDur, [f, f * 2.01, f * 3.03], amp, 0.35), k * step));
        return out;
    };
    // Cheap echo tail for "big" sounds.
    const echo = (a, times = 4, gap = 0.11, fb = 0.45) => {
        const out = N(a.length / SR + gap * times);
        for (let k = 0; k <= times; k++) addAt(out, a, gap * k, fb ** k);
        return out;
    };
    const normalize = (a, peak = 0.85) => {
        let m = 0;
        for (const v of a) m = Math.max(m, Math.abs(v));
        return m > 0 ? scale(a, peak / m) : a;
    };

    return { N, mix, delay, whoosh, thud, burst, rumble, ping, tone, growl, shatter, cascade, arp, echo, normalize };
}

// ---------------------------------------------------------------- sound recipes

function recipes(d) {
    const D5 = 587.33, F5 = 698.46, A5 = 880, D6 = 1174.66;
    return {
        swingLight: [() => d.whoosh(0.16, 900, 3400, 0.6, 0.5), 0.5],
        swingHeavy: [() => d.whoosh(0.32, 350, 1900, 0.8, 0.6), 0.6],
        hitPlayer: [() => d.mix(d.thud(0.28, 120, 45, 1), d.burst(0.12, 2200, 0.6)), 0.8],
        hitBoss: [() => d.mix(d.ping(0.4, [2300, 3650, 5100], 0.8, 0.25), d.burst(0.06, 4200, 0.7), d.thud(0.16, 150, 60, 0.6)), 0.7],
        critical: [() => d.echo(d.mix(d.thud(0.55, 130, 32, 1), d.shatter(0.8, 0.7, 11), d.burst(0.3, 2800, 0.6)), 3), 0.9],
        parry: [() => d.mix(d.ping(0.75, [1250, 1870, 2730, 4110], 1, 0.35, 0.004), d.burst(0.03, 6500, 0.9)), 0.75],
        roll: [() => d.whoosh(0.24, 250, 800, 0.6, 0.9), 0.45],
        jump: [() => d.mix(d.whoosh(0.12, 500, 1400, 0.4), d.tone(0.1, 160, 300, "sine", 0.25)), 0.35],
        land: [() => d.mix(d.thud(0.14, 95, 50, 0.8), d.burst(0.05, 900, 0.3)), 0.45],
        step: [() => d.mix(d.thud(0.05, 150, 90, 0.5), d.burst(0.03, 1600, 0.2)), 0.18],
        heal: [() => d.echo(d.arp([D5, F5, A5, D6], 0.1, 0.8, 0.5), 2, 0.15, 0.3), 0.5],
        healCancel: [() => d.mix(d.tone(0.28, 620, 160, "square", 0.3, 1400), d.burst(0.08, 1100, 0.4)), 0.5],
        bossWindup: [() => d.mix(d.whoosh(0.42, 250, 1500, 0.5, 0.3), d.tone(0.42, 60, 110, "saw", 0.25, 500)), 0.55],
        bossWindupRed: [() => d.mix(d.whoosh(0.45, 400, 2400, 0.45, 0.3), d.tone(0.45, 466, 470, "square", 0.18, 2200), d.tone(0.45, 494, 497, "square", 0.18, 2200)), 0.6],
        bossSwing: [() => d.whoosh(0.32, 220, 1500, 0.9, 0.5), 0.7],
        slam: [() => d.mix(d.thud(0.9, 95, 26, 1), d.rumble(0.85, 320, 0.7), d.burst(0.08, 2400, 0.6)), 0.9],
        shockwave: [() => d.mix(d.rumble(0.6, 520, 0.7), d.whoosh(0.5, 300, 1200, 0.3)), 0.6],
        shardThrow: [() => d.mix(d.tone(0.26, 2600, 900, "sine", 0.3), d.whoosh(0.2, 1500, 4200, 0.4, 0.4)), 0.5],
        shardBreak: [() => d.shatter(0.45, 0.6, 5), 0.5],
        shardRain: [() => d.echo(d.cascade(1.3, 0.5), 2, 0.17, 0.35), 0.5],
        shardImpact: [() => d.mix(d.ping(0.25, [2900, 4300], 0.6, 0.25), d.thud(0.1, 170, 70, 0.5)), 0.45],
        leap: [() => d.mix(d.whoosh(0.36, 280, 1700, 0.7), d.tone(0.3, 80, 150, "sine", 0.35)), 0.6],
        grasp: [() => d.mix(d.thud(0.22, 100, 55, 0.7), d.burst(0.16, 800, 0.6), d.growl(0.55, 68, 0.5)), 0.7],
        stagger: [() => d.mix(d.ping(0.7, [520, 790, 1170], 0.8, 0.35, 0.006), d.tone(0.6, 300, 90, "saw", 0.3, 900)), 0.7],
        phase2: [() => d.echo(d.mix(d.shatter(1.3, 0.8, 17), d.growl(2.2, 52, 0.7), d.thud(1.2, 72, 24, 0.9)), 3, 0.16, 0.4), 1],
        bossDeath: [() => d.echo(d.mix(d.shatter(2.4, 0.7, 23), d.cascade(2.8, 0.45, 9), d.growl(1.6, 48, 0.45), d.thud(1.5, 60, 22, 0.8)), 4, 0.2, 0.42), 1],
        playerDeath: [() => d.echo(d.mix(d.thud(0.7, 85, 28, 0.9), d.tone(1.5, 220, 98, "tri", 0.35, 900)), 2, 0.22, 0.35), 0.8],
        shrineRest: [() => d.echo(d.mix(d.arp([293.66, 440, 587.33, 698.46], 0.14, 1.4, 0.4), d.cascade(1.4, 0.15, 4)), 3, 0.18, 0.4), 0.55],
        veil: [() => d.echo(d.mix(d.whoosh(1.1, 400, 2600, 0.45, 0.4), d.cascade(1.1, 0.2, 8)), 2, 0.2, 0.35), 0.55],
        uiMove: [() => d.tone(0.045, 880, 880, "square", 0.25, 3500), 0.25],
        uiSelect: [() => d.mix(d.tone(0.06, 660, 660, "square", 0.25, 3500), d.delay(d.tone(0.09, 990, 990, "square", 0.25, 3500), 0.06)), 0.3],
        uiBack: [() => d.mix(d.tone(0.06, 660, 660, "square", 0.25, 3500), d.delay(d.tone(0.09, 440, 440, "square", 0.25, 3500), 0.06)), 0.3],
    };
}

// ---------------------------------------------------------------- music (OfflineAudioContext)

const LOOP = 24; // seconds; all continuous oscillators use frequencies with whole cycles per loop
const q = (f) => Math.round(f * LOOP) / LOOP;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

async function renderLoop(sampleRate, build) {
    const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const TAIL = 4;
    const oc = new OAC(2, Math.ceil((LOOP + TAIL) * sampleRate), sampleRate);
    build(oc);
    const rendered = await oc.startRendering();
    // Fold the tail back onto the start so the loop is seamless.
    const n = Math.round(LOOP * sampleRate), tail = rendered.length - n;
    const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate });
    for (let c = 0; c < 2; c++) {
        const src = rendered.getChannelData(c), dst = out.getChannelData(c);
        dst.set(src.subarray(0, n));
        for (let i = 0; i < tail; i++) dst[i] += src[n + i];
    }
    return out;
}

function reverbIR(oc, seconds = 3.2) {
    const r = mulberry32(99), len = Math.floor(seconds * oc.sampleRate);
    const ir = oc.createBuffer(2, len, oc.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return ir;
}

function ambientBuild(oc) {
    const master = oc.createGain();
    master.gain.value = 0.8;
    master.connect(oc.destination);
    const verb = oc.createConvolver();
    verb.buffer = reverbIR(oc);
    const wet = oc.createGain();
    wet.gain.value = 0.55;
    verb.connect(wet).connect(master);

    // Drone: detuned saws through a slowly breathing lowpass
    const droneLP = oc.createBiquadFilter();
    droneLP.type = "lowpass"; droneLP.frequency.value = 320; droneLP.Q.value = 2;
    const lfo = oc.createOscillator(); lfo.frequency.value = q(1 / 8);
    const lfoAmt = oc.createGain(); lfoAmt.gain.value = 180;
    lfo.connect(lfoAmt).connect(droneLP.frequency);
    const droneGain = oc.createGain(); droneGain.gain.value = 0.09;
    droneLP.connect(droneGain);
    droneGain.connect(master); droneGain.connect(verb);
    for (const [f, pan] of [[midi(38), -0.4], [midi(38) * 1.004, 0.4], [midi(45), 0], [midi(26), 0]]) {
        const o = oc.createOscillator(); o.type = f < 50 ? "sine" : "sawtooth"; o.frequency.value = q(f);
        const p = oc.createStereoPanner(); p.pan.value = pan;
        o.connect(p).connect(droneLP);
        o.start(0);
    }
    lfo.start(0);

    // Pads: i - VI - iv - V in D minor, 6 s each
    const chords = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
    chords.forEach((ch, k) => {
        const t0 = k * 6;
        for (const n of ch) {
            const o = oc.createOscillator(); o.type = "triangle"; o.frequency.value = midi(n);
            const g = oc.createGain();
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(0.045, t0 + 2);
            g.gain.setValueAtTime(0.045, t0 + 5);
            g.gain.linearRampToValueAtTime(0, t0 + 7.5);
            o.connect(g); g.connect(verb); g.connect(master);
            o.start(t0); o.stop(t0 + 7.6);
        }
    });

    // Sparse glass bells on a D minor pentatonic
    const r = mulberry32(42), scaleNotes = [74, 77, 79, 81, 84, 86, 89];
    for (let t = 0.8; t < LOOP; t += 1.4 + r() * 1.8) {
        const f = midi(scaleNotes[Math.floor(r() * scaleNotes.length)]);
        for (const [mul, amp] of [[1, 0.05], [2.76, 0.015]]) {
            const o = oc.createOscillator(); o.frequency.value = f * mul;
            const g = oc.createGain();
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
            const p = oc.createStereoPanner(); p.pan.value = r() * 1.2 - 0.6;
            o.connect(g).connect(p); p.connect(verb); p.connect(master);
            o.start(t); o.stop(t + 2.6);
        }
    }
}

function intensityBuild(oc) {
    const master = oc.createGain(); master.gain.value = 0.9; master.connect(oc.destination);
    const verb = oc.createConvolver(); verb.buffer = reverbIR(oc, 1.6);
    const wet = oc.createGain(); wet.gain.value = 0.3; verb.connect(wet).connect(master);
    const beat = 60 / 100; // 100 BPM → 40 beats per loop

    for (let b = 0; b < 40; b++) {
        const t = b * beat;
        // Heartbeat drum: strong on 1 and 3, softer double on 4
        const strong = b % 4 === 0 || b % 4 === 2;
        for (const [off, amp] of strong ? [[0, 0.75]] : b % 4 === 3 ? [[0, 0.3], [beat / 2, 0.22]] : []) {
            const o = oc.createOscillator(); o.frequency.setValueAtTime(120, t + off); o.frequency.exponentialRampToValueAtTime(42, t + off + 0.22);
            const g = oc.createGain(); g.gain.setValueAtTime(amp, t + off); g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.4);
            o.connect(g); g.connect(master); g.connect(verb);
            o.start(t + off); o.stop(t + off + 0.42);
        }
        // Tense ostinato: D3 / Eb3 eighths through a lowpass
        for (let e = 0; e < 2; e++) {
            const te = t + e * beat / 2;
            const o = oc.createOscillator(); o.type = "sawtooth"; o.frequency.value = midi(((b * 2 + e) % 8) < 6 ? 50 : 51);
            const f = oc.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900 + (b % 8) * 90;
            const g = oc.createGain(); g.gain.setValueAtTime(0.0001, te); g.gain.linearRampToValueAtTime(0.05, te + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, te + beat / 2);
            o.connect(f).connect(g); g.connect(master); g.connect(verb);
            o.start(te); o.stop(te + beat / 2 + 0.02);
        }
        // Metallic tick on off-beats
        const tick = oc.createOscillator(); tick.type = "square"; tick.frequency.value = 6100;
        const tg = oc.createGain(); const tt = t + beat / 2;
        tg.gain.setValueAtTime(0.012, tt); tg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
        tick.connect(tg).connect(master);
        tick.start(tt); tick.stop(tt + 0.06);
    }
}

// ---------------------------------------------------------------- public API

const silent = {
    play() { return null; },
    music: { start() {}, setIntensity() {}, stop() {}, fadeOut() {} },
    ready: Promise.resolve(),
};

export function createAudio(kippyAudio) {
    let ctx;
    try {
        ctx = kippyAudio?.context;
        if (!ctx || typeof ctx.createBuffer !== "function") return silent;
    } catch {
        return silent;
    }
    const SR = ctx.sampleRate;
    const d = makeDsp(SR);
    const sounds = {};
    for (const [name, [make, volume]] of Object.entries(recipes(d))) {
        try {
            const data = d.normalize(make());
            const buffer = ctx.createBuffer(1, data.length, SR);
            buffer.copyToChannel(data, 0);
            sounds[name] = new Sound({ src: buffer, bus: "sfx", volume, maxInstances: 4 });
        } catch (e) {
            console.warn(`Could not synthesize sound "${name}"`, e);
        }
    }

    // Music renders in the background; start() before it is ready starts it when ready.
    let base = null, layer = null, wantPlaying = false, intensity = 0, baseInst = null, layerInst = null;
    const ready = (async () => {
        try {
            const [a, b] = await Promise.all([renderLoop(SR, ambientBuild), renderLoop(SR, intensityBuild)]);
            base = new Sound({ src: a, bus: "music", volume: 0.55, loop: true, maxInstances: 1 });
            layer = new Sound({ src: b, bus: "music", volume: 0.5, loop: true, maxInstances: 1 });
            if (wantPlaying) startNow(2);
        } catch (e) {
            console.warn("Music unavailable", e);
        }
    })();

    function startNow(fadeIn) {
        if (!base || baseInst) return;
        baseInst = base.play({ fadeIn });
        layerInst = layer.play({ volume: 0.0001 });
        if (intensity > 0) layerInst?.fadeTo(layer.volume * intensity, 2);
    }

    return {
        ready,
        play(name, { volume = 1, pitch = 1 } = {}) {
            return sounds[name]?.play({ volume, pitch }) ?? null;
        },
        music: {
            start() {
                wantPlaying = true;
                startNow(2.5);
            },
            setIntensity(level) {
                intensity = Math.max(0, Math.min(1, level));
                layerInst?.fadeTo(Math.max(0.0001, layer.volume * intensity), 2.5);
            },
            stop() {
                wantPlaying = false;
                baseInst?.stop(); layerInst?.stop();
                baseInst = layerInst = null;
            },
            fadeOut(seconds = 1.5) {
                wantPlaying = false;
                baseInst?.fadeOut(seconds); layerInst?.fadeOut(seconds);
                baseInst = layerInst = null;
            },
        },
    };
}
