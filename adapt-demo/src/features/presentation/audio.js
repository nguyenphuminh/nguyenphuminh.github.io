// Synthesized audio: every sound effect is computed sample by sample; the composed music (music.js) renders
// lazily with an OfflineAudioContext. Wrapped in Kippy Sounds on the "sfx"/"music" buses.
import { Sound } from "kippy";
import { BOSS_TRACKS, MUSIC_TRACKS, renderTrack } from "./music.js";

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
        // Stage 1: mobs, the Pale Squire, story
        shardlingLeap: [() => d.mix(d.whoosh(0.18, 1200, 3600, 0.5, 0.5), d.ping(0.16, [3200, 4800], 0.25, 0.3)), 0.4],
        glassBreak: [() => d.shatter(0.35, 0.55, 31), 0.45],
        spearThrust: [() => d.mix(d.whoosh(0.2, 600, 2800, 0.7, 0.4), d.tone(0.12, 400, 1200, "sine", 0.15)), 0.5],
        shieldBash: [() => d.mix(d.thud(0.25, 110, 50, 0.9), d.burst(0.1, 1500, 0.6), d.ping(0.3, [900, 1340], 0.35, 0.3)), 0.6],
        shieldBlock: [() => d.mix(d.ping(0.5, [1600, 2380, 3550], 0.8, 0.3, 0.003), d.burst(0.04, 5000, 0.6)), 0.55],
        guardBreak: [() => d.echo(d.mix(d.shatter(0.6, 0.6, 41), d.thud(0.4, 120, 40, 0.8)), 2, 0.12, 0.35), 0.7],
        bossRoll: [() => d.mix(d.whoosh(0.3, 200, 700, 0.7, 0.9), d.thud(0.12, 100, 60, 0.3)), 0.5],
        tablet: [() => d.mix(d.rumble(0.7, 260, 0.6), d.burst(0.5, 700, 0.25, 0.5), d.delay(d.ping(0.9, [587.33, 880], 0.18, 0.4), 0.35)), 0.45],
        dialogueTick: [() => d.tone(0.025, 1500, 1400, "sine", 0.2), 0.08],
        mirrorWhisper: [() => d.echo(d.mix(d.whoosh(1.5, 500, 900, 0.5, 0.25), d.delay(d.whoosh(1.3, 1400, 2400, 0.35, 0.2), 0.12), d.tone(1.5, 110, 104, "sine", 0.12), d.cascade(1.2, 0.07, 12)), 2, 0.2, 0.35), 0.5],
        gate: [() => d.echo(d.mix(d.thud(1.0, 70, 28, 0.9), d.rumble(1.2, 200, 0.7), d.burst(0.2, 600, 0.3)), 3, 0.25, 0.4), 0.7],
        // Stages 2–3: the Mirror Archer, the Reflection, the ending
        archerThrow: [() => d.mix(d.whoosh(0.18, 1400, 4200, 0.55, 0.4), d.tone(0.16, 2400, 1100, "sine", 0.2)), 0.45],
        deflected: [() => d.mix(d.ping(0.6, [1900, 2850, 4300], 0.9, 0.3, 0.005), d.burst(0.03, 7000, 0.8), d.delay(d.whoosh(0.22, 2500, 600, 0.45, 0.5), 0.02)), 0.7],
        riposte: [() => d.mix(d.whoosh(0.14, 1200, 5000, 0.85, 0.4), d.tone(0.1, 900, 2600, "sine", 0.18), d.delay(d.ping(0.25, [3100, 4650], 0.3, 0.3), 0.08)), 0.6],
        drink: [() => d.mix(d.tone(0.12, 320, 260, "sine", 0.5, 900), d.delay(d.tone(0.12, 300, 240, "sine", 0.45, 900), 0.22), d.delay(d.tone(0.14, 290, 220, "sine", 0.4, 900), 0.44), d.delay(d.ping(0.7, [1174.66, 1760], 0.25, 0.35), 0.7)), 0.5],
        vanish: [() => d.mix(d.shatter(0.45, 0.6, 51), d.whoosh(0.35, 3200, 700, 0.45, 0.5)), 0.6],
        appear: [() => d.mix(d.whoosh(0.4, 600, 3600, 0.5, 0.4), d.delay(d.ping(0.5, [2093, 3136], 0.45, 0.3), 0.28)), 0.6],
        volley: [() => d.mix(d.tone(0.2, 2800, 900, "sine", 0.3), d.delay(d.tone(0.2, 2600, 800, "sine", 0.3), 0.12), d.delay(d.tone(0.2, 3000, 1000, "sine", 0.3), 0.24), d.whoosh(0.45, 1500, 4000, 0.35, 0.4)), 0.55],
        mirrorCrack: [() => d.echo(d.mix(d.shatter(1.4, 0.8, 61), d.thud(1.2, 70, 25, 0.9), d.rumble(1.8, 300, 0.6), d.delay(d.cascade(1.4, 0.4, 13), 0.3)), 3, 0.22, 0.4), 1],
        dawn: [() => d.echo(d.mix(d.arp([587.33, 739.99, 880, 1174.66, 1479.98], 0.32, 1.9, 0.45), d.tone(3, 293.66, 293.66, "sine", 0.18, 1200), d.tone(3, 440, 440, "sine", 0.12, 1200)), 3, 0.24, 0.4), 0.55],
        heartbeat: [() => d.mix(d.thud(0.3, 75, 32, 1), d.delay(d.thud(0.26, 70, 30, 0.7), 0.28), d.delay(d.rumble(0.3, 120, 0.25), 0.02)), 0.75],
    };
}

// ---------------------------------------------------------------- public API

const silentMusic = {
    play() {}, setPhase() {}, stop() {}, current: null,
    start() {}, setTrack() {}, setIntensity() {}, fadeOut() {},
};
const silent = {
    play() { return null; },
    music: silentMusic,
    ready: Promise.resolve(),
    musicStats: {},
};

// The track most likely to be needed after each one; rendered in the background ahead of time.
const NEXT = { title: "outer", outer: "squire", squire: "hall", hall: "mirrorwright", mirrorwright: "heart", heart: "reflection", reflection: "ending" };
const MUSIC_VOLUME = 0.7;

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

    // ---- music: tracks render one at a time, lazily; play() before a track is ready plays it when ready ----
    const loaded = {}; // name -> { base: Sound, layer: Sound | null }
    const pending = {}; // name -> Promise
    const musicStats = {}; // name -> { renderMs, seconds, bpm, rms, peak, layerRms }
    let queue = Promise.resolve();
    let current = null; // the track asked for (playing, or waiting to render)
    let phase = 1;
    let live = null; // { name, base: SoundInstance, layer: SoundInstance | null }

    function ensure(name) {
        if (loaded[name]) return Promise.resolve(loaded[name]);
        pending[name] ??= (queue = queue.then(async () => {
            const t0 = performance.now();
            const r = await renderTrack(SR, name);
            loaded[name] = {
                base: new Sound({ src: r.base.buffer, bus: "music", volume: MUSIC_VOLUME, loop: true, maxInstances: 2 }),
                layer: r.layer ? new Sound({ src: r.layer.buffer, bus: "music", volume: MUSIC_VOLUME, loop: true, maxInstances: 2 }) : null,
            };
            musicStats[name] = {
                renderMs: Math.round(performance.now() - t0), seconds: +r.base.seconds.toFixed(1), bpm: r.bpm, bars: r.bars,
                rms: +r.base.rms.toFixed(3), peak: +r.base.peak.toFixed(3), layerRms: r.layer ? +r.layer.rms.toFixed(3) : null,
                quietestSecondRms: +r.base.quietest.toFixed(3), seamJump: +r.base.seamJump.toFixed(4), typicalDelta: +r.base.typicalDelta.toFixed(4),
            };
            return loaded[name];
        }).catch((e) => {
            console.warn(`Music track "${name}" unavailable`, e);
            delete pending[name];
            return null;
        }));
        return pending[name];
    }

    function prefetch(name) {
        const next = NEXT[name];
        if (next && !loaded[next] && !pending[next]) ensure(next);
    }

    function fadeOutLive(fade) {
        if (!live) return;
        live.base.fadeOut(fade);
        live.layer?.fadeOut(fade);
        live = null;
    }

    function startLive(name, fade) {
        const track = loaded[name];
        if (!track || current !== name) return;
        fadeOutLive(fade);
        const base = track.base.play({ fadeIn: fade });
        const layer = track.layer ? track.layer.play({ volume: 0 }) : null; // in sync with the base, silent until phase 2
        live = { name, base, layer };
        if (phase === 2 && layer) layer.fadeTo(MUSIC_VOLUME, fade);
    }

    const music = {
        /** Crossfades to `name`; idempotent while it is already playing; plays when ready if still rendering. */
        play(name, { fade = 2 } = {}) {
            if (!MUSIC_TRACKS.includes(name)) return;
            if (current === name && (live?.name === name || pending[name])) return;
            current = name;
            phase = 1;
            ensure(name).then(() => {
                startLive(name, fade);
                prefetch(name);
            });
        },
        /** 1 or 2: the second-phase intensification of the current boss track (no-op otherwise). */
        setPhase(n) {
            const next = n >= 2 ? 2 : 1;
            if (!BOSS_TRACKS.includes(current) || next === phase) return;
            phase = next;
            live?.layer?.fadeTo(next === 2 ? MUSIC_VOLUME : 0, 2);
        },
        /** Fades everything out; a later play() works normally. */
        stop({ fade = 1.5 } = {}) {
            current = null;
            phase = 1;
            fadeOutLive(fade);
        },
        get current() {
            return current;
        },
        // Compatibility shims for older callers.
        start() {
            music.play(current ?? "title");
        },
        setTrack(name) {
            music.play(name);
        },
        setIntensity(level) {
            if (BOSS_TRACKS.includes(current)) music.setPhase(level >= 1 ? 2 : 1);
        },
        fadeOut(seconds = 1.5) {
            music.stop({ fade: seconds });
        },
    };
    const ready = ensure("title").then(() => undefined);

    return {
        ready,
        musicStats,
        play(name, { volume = 1, pitch = 1 } = {}) {
            return sounds[name]?.play({ volume, pitch }) ?? null;
        },
        music,
    };
}
