// Composed, synthesized music (BRD 2.2.8). Every track is a short score (chords, melody, bass, arpeggios,
// percussion) rendered once, lazily, with an OfflineAudioContext into a seamless loop of whole bars. Boss themes
// also render a phase-2 layer of the same length that plays in sync and is faded in for the second phase.

// ---------------------------------------------------------------- notes and chords

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiFreq = (n) => 440 * 2 ** ((n - 69) / 12);

/** "C#5" / "Bb3" → MIDI number. */
function nm(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) throw new Error(`bad note ${name}`);
    return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

const QUALITY = {
    "": [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
    add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], "7b9": [0, 4, 7, 10, 13], sus4: [0, 5, 7], dim: [0, 3, 6],
};

/** "Dm" → { root: 2 (pitch class), tones: [0,3,7] }. */
function chord(symbol) {
    const m = /^([A-G])([#b]?)(.*)$/.exec(symbol);
    const pc = (NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
    const tones = QUALITY[m[3]];
    if (!tones) throw new Error(`bad chord ${symbol}`);
    return { pc, tones };
}

/** The chord's notes stacked from the root in the given octave (C4 = 60 is octave 4). */
const voicing = (symbol, octave) => {
    const c = chord(symbol);
    return c.tones.map((iv) => 12 * (octave + 1) + c.pc + iv);
};

// ---------------------------------------------------------------- composer: collects note events

function composer(bpm, bars, beatsPerBar = 4) {
    const beat = 60 / bpm;
    const events = [];
    const add = (inst, beatPos, beats, note, vel = 0.8, pan = 0, extra = {}) => {
        events.push({ inst, t: beatPos * beat, dur: beats * beat, note, vel, pan, ...extra });
    };
    const c = {
        bpm, bars, beat, beatsPerBar,
        length: bars * beatsPerBar * beat,
        events,
        add,
        /** Melody: [["A4", 1], [null, 1], ...] starting at bar `startBar` (0-based). */
        melody(inst, startBar, notes, { vel = 0.8, pan = 0, transpose = 0, legato = 1 } = {}) {
            let pos = startBar * beatsPerBar;
            for (const [name, beats, v] of notes) {
                if (name) add(inst, pos, beats * legato, nm(name) + transpose, v ?? vel, pan);
                pos += beats;
            }
        },
        /** Sustained chords: one symbol per bar (or per `span` bars). */
        pad(inst, symbols, { octave = 4, span = 1, vel = 0.5, pan = 0, startBar = 0, top = false } = {}) {
            symbols.forEach((sym, i) => {
                const notes = voicing(sym, octave);
                if (top) notes.push(notes[0] + 12);
                notes.forEach((n, k) => add(inst, (startBar + i * span) * beatsPerBar, span * beatsPerBar, n, vel, pan + (k - 1) * 0.15));
            });
        },
        /** Arpeggio over one chord per bar: `pattern` lists chord-tone indices (index >= tones wraps up an octave). */
        arp(inst, symbols, pattern, { octave = 4, step = 0.5, vel = 0.5, pan = 0, startBar = 0, accent = 0 } = {}) {
            symbols.forEach((sym, i) => {
                const base = voicing(sym, octave).slice(0, 3);
                const steps = Math.round(beatsPerBar / step);
                for (let s = 0; s < steps; s++) {
                    const idx = pattern[s % pattern.length];
                    if (idx === null) continue;
                    const note = base[idx % base.length] + 12 * Math.floor(idx / base.length);
                    const v = vel * (s % (steps / 2) === 0 ? 1 + accent : 1);
                    add(inst, (startBar + i) * beatsPerBar + s * step, step * 0.95, note, v, pan + (s % 2 ? 0.25 : -0.25));
                }
            });
        },
        /** Bass line, one chord per bar; pattern chars per step: R root, 5 fifth, O octave, 3 third, . rest. */
        bass(inst, symbols, pattern, { octave = 2, step = 0.5, vel = 0.8, startBar = 0, hold = 0.9 } = {}) {
            symbols.forEach((sym, i) => {
                const c0 = chord(sym);
                const root = 12 * (octave + 1) + c0.pc;
                const steps = Math.round(beatsPerBar / step);
                for (let s = 0; s < steps; s++) {
                    const ch = pattern[s % pattern.length];
                    if (ch === ".") continue;
                    const note = ch === "5" ? root + 7 : ch === "O" ? root + 12 : ch === "3" ? root + c0.tones[1] : root;
                    add(inst, (startBar + i) * beatsPerBar + s * step, step * hold, note, vel * (ch === "R" && s === 0 ? 1.1 : 1));
                }
            });
        },
        /** Drum grid for one bar (16 steps per bar): x = hit, X = accent, o = soft. Repeated over the given bars. */
        drums(inst, grid, { bars: which = null, vel = 0.8, note = 0, pan = 0 } = {}) {
            const steps = grid.length;
            const stepBeats = beatsPerBar / steps;
            for (let b = 0; b < bars; b++) {
                if (which && !which(b)) continue;
                for (let s = 0; s < steps; s++) {
                    const ch = grid[s];
                    if (ch === ".") continue;
                    const v = vel * (ch === "X" ? 1.25 : ch === "o" ? 0.5 : 1);
                    add(inst, b * beatsPerBar + s * stepBeats, stepBeats, note, v, pan);
                }
            }
        },
    };
    return c;
}

// ---------------------------------------------------------------- instruments (OfflineAudioContext voices)

function envelope(g, t, dur, { a = 0.01, r = 0.2, peak = 1, decay = null }) {
    const p = g.gain;
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (decay) {
        p.setTargetAtTime(0, t + a, decay);
    } else {
        p.setValueAtTime(peak, Math.max(t + a, t + dur));
        p.linearRampToValueAtTime(0, t + dur + r);
    }
}

function makeInstruments(oc, dry, send, noise) {
    const out = (node, pan, wet = 1) => {
        const pn = oc.createStereoPanner();
        pn.pan.value = Math.max(-1, Math.min(1, pan));
        node.connect(pn);
        pn.connect(dry);
        if (wet > 0) {
            const w = oc.createGain();
            w.gain.value = wet;
            pn.connect(w).connect(send);
        }
    };
    const osc = (type, freq, t, stop, detune = 0) => {
        const o = oc.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        o.start(t);
        o.stop(stop);
        return o;
    };
    const lowpass = (freq, q = 0.7) => {
        const f = oc.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = freq;
        f.Q.value = q;
        return f;
    };
    const noiseSrc = (t, stop) => {
        const s = oc.createBufferSource();
        s.buffer = noise;
        s.loop = true;
        s.start(t, Math.random() * 1.5);
        s.stop(stop);
        return s;
    };
    const vibrato = (target, t, stop, rate = 5.2, cents = 6, delay = 0.25) => {
        const lfo = osc("sine", rate, t, stop);
        const depth = oc.createGain();
        depth.gain.setValueAtTime(0, t);
        depth.gain.linearRampToValueAtTime(cents, t + delay + 0.3);
        lfo.connect(depth);
        for (const o of target) depth.connect(o.detune);
    };

    // Melodic voices -------------------------------------------------
    const strings = ({ t, dur, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + dur + 1;
        const lp = lowpass(1500 + 400 * vel, 0.6);
        const g = oc.createGain();
        const os = [-9, 0, 8].map((d) => osc("sawtooth", f, t, stop, d));
        os.forEach((o) => o.connect(lp));
        vibrato(os, t, stop, 4.6, 5, 0.4);
        lp.connect(g);
        envelope(g, t, dur, { a: 0.45, r: 0.8, peak: 0.055 * vel });
        out(g, pan, 0.9);
    };
    const choir = ({ t, dur, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + dur + 1.3;
        const g = oc.createGain();
        const os = [-6, 6].map((d) => osc("sawtooth", f, t, stop, d));
        vibrato(os, t, stop, 5, 7, 0.5);
        for (const [fc, q, lvl] of [[700, 6, 1], [1150, 7, 0.55], [2700, 9, 0.25]]) {
            const bp = oc.createBiquadFilter();
            bp.type = "bandpass";
            bp.frequency.value = fc;
            bp.Q.value = q;
            const lg = oc.createGain();
            lg.gain.value = lvl;
            os.forEach((o) => o.connect(bp));
            bp.connect(lg).connect(g);
        }
        envelope(g, t, dur, { a: 0.7, r: 1.1, peak: 0.16 * vel });
        out(g, pan, 1);
    };
    const organ = ({ t, dur, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + dur + 0.6;
        const lp = lowpass(1900, 0.5);
        const g = oc.createGain();
        osc("square", f, t, stop).connect(lp);
        const o2 = osc("triangle", f * 2, t, stop);
        const g2 = oc.createGain();
        g2.gain.value = 0.5;
        o2.connect(g2).connect(lp);
        lp.connect(g);
        envelope(g, t, dur, { a: 0.08, r: 0.5, peak: 0.04 * vel });
        out(g, pan, 1);
    };
    const flute = ({ t, dur, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + dur + 0.5;
        const g = oc.createGain();
        const lp = lowpass(3000, 0.5);
        const o1 = osc("sine", f, t, stop);
        const o2 = osc("triangle", f, t, stop, 3);
        const g2 = oc.createGain();
        g2.gain.value = 0.35;
        o1.connect(lp);
        o2.connect(g2).connect(lp);
        vibrato([o1, o2], t, stop, 5.4, 9, 0.22);
        lp.connect(g);
        envelope(g, t, dur, { a: 0.07, r: 0.3, peak: 0.16 * vel });
        out(g, pan, 0.7);
    };
    const brass = ({ t, dur, note, vel, pan }, low = false) => {
        const f = midiFreq(note);
        const stop = t + dur + 0.4;
        const lp = lowpass(300, 1.2);
        const peakCut = low ? 1200 : 2300;
        lp.frequency.setValueAtTime(low ? 220 : 320, t);
        lp.frequency.linearRampToValueAtTime(peakCut, t + 0.09);
        lp.frequency.setTargetAtTime(peakCut * 0.62, t + 0.1, 0.25);
        const g = oc.createGain();
        const os = [-6, 6].map((d) => osc("sawtooth", f, t, stop, d));
        os.forEach((o) => o.connect(lp));
        vibrato(os, t, stop, 5, 5, 0.35);
        lp.connect(g);
        envelope(g, t, dur, { a: 0.04, r: 0.22, peak: (low ? 0.11 : 0.085) * vel });
        out(g, pan, 0.6);
    };
    const leadSaw = ({ t, dur, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + dur + 0.4;
        const lp = lowpass(2600, 0.8);
        const g = oc.createGain();
        const os = [-7, 0, 7].map((d) => osc("sawtooth", f, t, stop, d));
        os.forEach((o) => o.connect(lp));
        vibrato(os, t, stop, 5.6, 8, 0.25);
        lp.connect(g);
        envelope(g, t, dur, { a: 0.03, r: 0.25, peak: 0.05 * vel });
        out(g, pan, 0.7);
    };
    const harp = ({ t, dur, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + 2.6;
        const lp = lowpass(3200, 0.5);
        const g = oc.createGain();
        osc("triangle", f, t, stop).connect(lp);
        const o2 = osc("sine", f * 2, t, stop);
        const g2 = oc.createGain();
        g2.gain.value = 0.25;
        o2.connect(g2).connect(lp);
        lp.connect(g);
        envelope(g, t, dur, { a: 0.004, peak: 0.13 * vel, decay: 0.55 });
        out(g, pan, 0.8);
    };
    const piano = ({ t, dur, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + 3;
        const g = oc.createGain();
        const lp = lowpass(2600, 0.5);
        for (const [mul, lvl, type] of [[1, 1, "triangle"], [2, 0.32, "sine"], [3, 0.12, "sine"]]) {
            const o = osc(type, f * mul, t, stop, mul === 1 ? 0 : 2);
            const lg = oc.createGain();
            lg.gain.value = lvl;
            o.connect(lg).connect(lp);
        }
        lp.connect(g);
        envelope(g, t, dur, { a: 0.003, peak: 0.12 * vel, decay: 0.7 });
        out(g, pan, 0.6);
    };
    const bell = ({ t, dur, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + 3.5;
        const g = oc.createGain();
        for (const [mul, lvl] of [[1, 1], [2.76, 0.32], [5.4, 0.12], [8.93, 0.05]]) {
            const o = osc("sine", f * mul, t, stop);
            const lg = oc.createGain();
            lg.gain.value = lvl;
            o.connect(lg).connect(g);
        }
        envelope(g, t, dur, { a: 0.003, peak: 0.08 * vel, decay: 0.8 });
        out(g, pan, 1);
    };
    const musicBox = ({ t, note, vel, pan }) => {
        const f = midiFreq(note);
        const stop = t + 1.8;
        const g = oc.createGain();
        for (const [mul, lvl] of [[1, 1], [4, 0.18], [6.2, 0.05]]) {
            const o = osc("sine", f * mul, t, stop);
            const lg = oc.createGain();
            lg.gain.value = lvl;
            o.connect(lg).connect(g);
        }
        envelope(g, t, 0, { a: 0.002, peak: 0.07 * vel, decay: 0.35 });
        out(g, pan, 1);
    };
    const bass = ({ t, dur, note, vel }) => {
        const f = midiFreq(note);
        const stop = t + dur + 0.3;
        const lp = lowpass(800, 0.7);
        const g = oc.createGain();
        osc("triangle", f, t, stop).connect(lp);
        const o2 = osc("sine", f, t, stop);
        o2.connect(lp);
        lp.connect(g);
        envelope(g, t, dur, { a: 0.012, r: 0.12, peak: 0.24 * vel });
        out(g, 0, 0.15);
    };
    const sawBass = ({ t, dur, note, vel }) => {
        const f = midiFreq(note);
        const stop = t + dur + 0.25;
        const lp = lowpass(200, 2);
        lp.frequency.setValueAtTime(900, t);
        lp.frequency.setTargetAtTime(260, t + 0.01, 0.08);
        const g = oc.createGain();
        osc("sawtooth", f, t, stop).connect(lp);
        const sub = osc("sine", f, t, stop);
        const sg = oc.createGain();
        sg.gain.value = 0.8;
        sub.connect(sg).connect(lp);
        lp.connect(g);
        envelope(g, t, dur, { a: 0.006, r: 0.08, peak: 0.2 * vel });
        out(g, 0, 0.1);
    };

    // Percussion ------------------------------------------------------
    const pitchHit = (t, f0, f1, len, peak, pan = 0, wet = 0.3, type = "sine") => {
        const o = osc(type, f0, t, t + len + 0.05);
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.6);
        const g = oc.createGain();
        envelope(g, t, 0, { a: 0.002, peak, decay: len / 4 });
        o.connect(g);
        out(g, pan, wet);
    };
    const noiseHit = (t, type, freq, q, len, peak, pan = 0, wet = 0.3) => {
        const s = noiseSrc(t, t + len + 0.05);
        const f = oc.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        const g = oc.createGain();
        envelope(g, t, 0, { a: 0.001, peak, decay: len / 4 });
        s.connect(f).connect(g);
        out(g, pan, wet);
    };
    const kick = ({ t, vel }) => pitchHit(t, 130, 42, 0.4, 0.9 * vel, 0, 0.05);
    const snare = ({ t, vel, pan }) => {
        noiseHit(t, "highpass", 1500, 0.7, 0.22, 0.5 * vel, pan, 0.4);
        pitchHit(t, 210, 160, 0.14, 0.35 * vel, pan, 0.2, "triangle");
    };
    const hat = ({ t, vel, pan }) => noiseHit(t, "highpass", 7500, 0.8, 0.06, 0.18 * vel, pan + 0.2, 0.1);
    const tom = ({ t, vel, note, pan }) => pitchHit(t, note || 150, (note || 150) * 0.6, 0.38, 0.6 * vel, pan, 0.4);
    const taiko = ({ t, vel, pan }) => {
        pitchHit(t, 82, 46, 0.7, 0.95 * vel, pan, 0.5);
        noiseHit(t, "lowpass", 380, 0.8, 0.3, 0.45 * vel, pan, 0.4);
    };
    const timpani = ({ t, vel, note }) => {
        const f = note ? midiFreq(note) : 73;
        pitchHit(t, f * 1.03, f, 1.6, 0.6 * vel, 0, 0.6);
        noiseHit(t, "lowpass", 300, 0.7, 0.4, 0.2 * vel, 0, 0.5);
    };
    const anvil = ({ t, vel, pan }) => {
        const g = oc.createGain();
        for (const [fq, lvl] of [[940, 1], [1415, 0.75], [2130, 0.5], [3320, 0.32], [4230, 0.2]]) {
            const o = osc("sine", fq, t, t + 1.2);
            const lg = oc.createGain();
            lg.gain.value = lvl;
            o.connect(lg).connect(g);
        }
        envelope(g, t, 0, { a: 0.001, peak: 0.08 * vel, decay: 0.12 });
        out(g, pan, 0.7);
        noiseHit(t, "highpass", 4000, 0.7, 0.03, 0.2 * vel, pan, 0.3);
    };
    const frameDrum = ({ t, vel, pan }) => {
        pitchHit(t, 170, 115, 0.3, 0.45 * vel, pan, 0.4);
        noiseHit(t, "bandpass", 900, 1.2, 0.18, 0.25 * vel, pan, 0.4);
    };
    const swell = ({ t, dur, vel }) => {
        const s = noiseSrc(t, t + dur + 0.2);
        const f = oc.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = 3000;
        const g = oc.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12 * vel, t + dur);
        g.gain.linearRampToValueAtTime(0, t + dur + 0.15);
        s.connect(f).connect(g);
        out(g, 0, 0.8);
    };

    return {
        strings, choir, organ, flute, brass, lowBrass: (e) => brass(e, true), leadSaw, harp, piano, bell, musicBox,
        bass, sawBass, kick, snare, hat, tom, taiko, timpani, anvil, frameDrum, swell,
    };
}

// ---------------------------------------------------------------- the scores

// The main theme: rises through the D minor triad and sighs back down (A D F E D C A).
const MOTIF = [["A4", 1], ["D5", 1], ["F5", 1.5], ["E5", 0.5], ["D5", 2], ["C5", 1], ["A4", 1]];

const SCORES = {
    // Title: haunting main theme over choir, harp and low strings. D minor, 72 BPM.
    title: { bpm: 72, bars: 16, reverb: 4.2, wet: 0.5, compose(c) {
        const ch = ["Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "A", "A", "Dm", "Dm", "F", "F", "Gm", "Gm", "A", "A"];
        c.pad("choir", ch, { octave: 3, vel: 0.75 });
        c.pad("strings", ch, { octave: 4, vel: 0.45 });
        c.arp("harp", ch, [0, 1, 2, 3, 2, 1, 2, 4], { octave: 3, vel: 0.6 });
        c.bass("bass", ch, "R.......5.......", { octave: 2, step: 0.25, hold: 7, vel: 0.7 });
        c.melody("flute", 0, [
            ...MOTIF, ["Bb4", 1], ["D5", 1], ["F5", 1], ["G5", 1], ["F5", 3], [null, 1],
            ["G5", 1], ["F5", 1], ["D5", 1.5], ["Bb4", 0.5], ["D5", 2], ["C5", 1], ["Bb4", 1],
            ["A4", 1.5], ["C#5", 0.5], ["E5", 2], ["A4", 3], [null, 1],
            ["A4", 1], ["D5", 1], ["F5", 1.5], ["E5", 0.5], ["D5", 1], ["F5", 1], ["A5", 2],
            ["A5", 1.5], ["G5", 0.5], ["F5", 1], ["C5", 1], ["F5", 3], ["E5", 1],
            ["D5", 1], ["Bb4", 1], ["G4", 1], ["Bb4", 1], ["D5", 2], ["G5", 2],
            ["E5", 1.5], ["D5", 0.5], ["C#5", 2], ["A4", 4],
        ], { vel: 0.95 });
        c.drums("timpani", "x...............", { bars: (b) => b % 2 === 0, vel: 0.5, note: 38 });
        c.drums("timpani", "x.x.x.x.xxxxxxxx", { bars: (b) => b === 15, vel: 0.35, note: 45 });
    } },

    // Outer Ward: moonlit courtyard; harp ostinato, flute, cello, soft frame drum. D minor, 84 BPM.
    outer: { bpm: 84, bars: 16, reverb: 3.2, wet: 0.4, compose(c) {
        const ch = ["Dm", "Dm", "C", "C", "Bb", "Bb", "A", "A", "Dm", "Dm", "C", "C", "Gm", "Gm", "A", "A"];
        c.arp("harp", ch, [0, 2, 4, 2, 3, 2, 4, 5], { octave: 3, vel: 0.7 });
        c.pad("strings", ch, { octave: 4, vel: 0.35 });
        c.bass("bass", ch, "R...R...5...R...", { octave: 2, step: 0.25, hold: 3.5, vel: 0.65 });
        c.melody("flute", 0, [
            [null, 4], [null, 2], ["A4", 1], ["D5", 1],
            ["E5", 2], ["G5", 1], ["E5", 1], ["C5", 3], [null, 1],
            ["D5", 1], ["F5", 1], ["Bb5", 1.5], ["A5", 0.5], ["F5", 3], [null, 1],
            ["E5", 1.5], ["C#5", 0.5], ["A4", 2], [null, 2], ["A4", 1], ["D5", 1],
            ["F5", 2], ["E5", 1], ["D5", 1], ["A4", 3], [null, 1],
            ["G4", 1], ["C5", 1], ["E5", 1.5], ["D5", 0.5], ["C5", 3], [null, 1],
            ["D5", 1], ["G5", 1], ["Bb5", 1.5], ["A5", 0.5], ["G5", 2], ["D5", 2],
            ["C#5", 1.5], ["E5", 0.5], ["A5", 2], ["G5", 1], ["F5", 1], ["E5", 2],
        ], { vel: 0.85 });
        c.drums("frameDrum", "x.....o.x.......", { vel: 0.45 });
    } },

    // Hall of Panes: cathedral organ, glass bells and harp under a long reverb. A minor / Phrygian dominant, 66 BPM.
    hall: { bpm: 66, bars: 12, reverb: 5.5, wet: 0.65, compose(c) {
        const ch = ["Am", "Am", "Am", "F", "F", "F", "Dm", "Dm", "Dm", "E", "E", "E"];
        c.pad("organ", ch, { octave: 3, vel: 0.8, top: true });
        c.bass("organ", ch, "R...............", { octave: 2, step: 0.25, hold: 15.5, vel: 0.9 });
        c.arp("harp", ch, [0, 1, 2, 4, 5, 4, 2, 1], { octave: 4, vel: 0.4 });
        c.melody("bell", 0, [
            ["E5", 2], ["A5", 2], ["C6", 3], ["B5", 1], ["A5", 4],
            ["F5", 2], ["A5", 2], ["C6", 2], ["A5", 1], ["G5", 1], ["F5", 4],
            ["D5", 2], ["F5", 2], ["A5", 3], ["G5", 1], ["F5", 2], ["E5", 1], ["D5", 1],
            ["E5", 2], ["G#5", 2], ["B5", 2], ["A5", 1], ["G#5", 1], ["E5", 4],
        ], { vel: 1 });
        c.melody("choir", 6, [["D4", 12], ["E4", 12]], { vel: 0.5 });
    } },

    // Silvered Heart: music box and celesta, the motif turned upside down, sub pulse, eerie choir. C minor, 60 BPM.
    heart: { bpm: 60, bars: 12, reverb: 5, wet: 0.7, compose(c) {
        const ch = ["Cmadd9", "Cmadd9", "Abmaj7", "Abmaj7", "Fm", "Fm", "Db", "Db", "Cm", "Cm", "G7b9", "G7b9"];
        c.arp("musicBox", ch, [0, 2, 4, 2, 5, 2, 4, 2], { octave: 5, vel: 0.8 });
        c.pad("choir", ch, { octave: 3, vel: 0.55 });
        c.bass("bass", ch, "R.......R.......", { octave: 1, step: 0.25, hold: 2, vel: 0.8 });
        c.melody("bell", 0, [
            ["G5", 1], ["Eb5", 1], ["C5", 1.5], ["D5", 0.5], ["Eb5", 4],
            ["C6", 1], ["Ab5", 1], ["Eb5", 1.5], ["G5", 0.5], ["Ab5", 4],
            ["F5", 1], ["Ab5", 1], ["C6", 1.5], ["Bb5", 0.5], ["Ab5", 2], ["G5", 2],
            ["F5", 1], ["Ab5", 1], ["Db6", 2], ["C6", 2], ["Bb5", 2],
            ["G5", 1], ["Eb5", 1], ["C5", 1.5], ["D5", 0.5], ["Eb5", 2], ["D5", 2],
            ["B4", 1], ["D5", 1], ["F5", 1], ["Ab5", 1], ["G5", 4],
        ], { vel: 1 });
        c.drums("swell", "x...............", { bars: (b) => b === 11, vel: 0.9 });
    } },

    // The Pale Squire: a martial, slightly tragic march; snare, brass, staccato strings. E minor, 120 BPM.
    squire: { bpm: 120, bars: 16, reverb: 2.2, wet: 0.3, compose(c) {
        const ch = ["Em", "Em", "C", "C", "D", "D", "B", "B", "Em", "Em", "C", "C", "Am", "Am", "B", "B"];
        c.bass("sawBass", ch, "R.RR5.R.", { octave: 2, vel: 0.8 });
        c.arp("strings", ch, [0, null, 1, null, 2, null, 1, null], { octave: 4, vel: 0.5 });
        c.drums("kick", "x.......x.......", { vel: 0.8 });
        c.drums("snare", "....x.x.....x.xx", { vel: 0.6 });
        c.drums("hat", "x.x.x.x.x.x.x.x.", { vel: 0.5 });
        c.drums("tom", "........x.x.xxxx", { bars: (b) => b % 8 === 7, vel: 0.6, note: 140 });
        c.melody("brass", 0, [
            ["E4", 1], ["G4", 1], ["B4", 1.5], ["A4", 0.5], ["G4", 1], ["F#4", 1], ["E4", 2],
            ["E4", 1], ["G4", 1], ["C5", 1.5], ["B4", 0.5], ["A4", 2], ["G4", 2],
            ["F#4", 1], ["A4", 1], ["D5", 1.5], ["C5", 0.5], ["B4", 1], ["A4", 1], ["F#4", 2],
            ["F#4", 1], ["A4", 1], ["B4", 1], ["D#5", 1], ["F#5", 3], [null, 1],
            ["E5", 1.5], ["D5", 0.5], ["B4", 1], ["G4", 1], ["B4", 2], ["E4", 2],
            ["C5", 1.5], ["B4", 0.5], ["G4", 1], ["E4", 1], ["G4", 4],
            ["A4", 1], ["C5", 1], ["E5", 1.5], ["D5", 0.5], ["C5", 2], ["A4", 2],
            ["B4", 1], ["D#5", 1], ["F#5", 1], ["A5", 1], ["B4", 3], [null, 1],
        ], { vel: 0.9 });
    }, layer(c) {
        const ch = ["Em", "Em", "C", "C", "D", "D", "B", "B", "Em", "Em", "C", "C", "Am", "Am", "B", "B"];
        c.drums("hat", "xxxxxxxxxxxxxxxx", { vel: 0.4 });
        c.drums("snare", "..o...o...o.o.o.", { vel: 0.5 });
        c.drums("timpani", "x.......x.......", { vel: 0.5, note: 40 });
        c.arp("leadSaw", ch, [2, 1, 0, 1, 2, 3, 4, 3], { octave: 5, vel: 0.55 });
    } },

    // The Mirrorwright: the smith's forge; taiko, anvil strikes, low horns and choir. C minor, 116 BPM.
    mirrorwright: { bpm: 116, bars: 16, reverb: 3, wet: 0.35, compose(c) {
        const ch = ["Cm", "Cm", "Ab", "Ab", "Bb", "Bb", "G", "G", "Cm", "Cm", "Fm", "Fm", "Ab", "Bb", "G", "G"];
        c.bass("sawBass", ch, "R.RR5.R.", { octave: 1, vel: 0.9 });
        c.pad("choir", ch, { octave: 3, vel: 0.7 });
        c.drums("taiko", "x.....x.x.......", { vel: 0.85 });
        c.drums("kick", "x.......x.......", { vel: 0.7 });
        c.drums("anvil", "....x.......x...", { vel: 0.9, pan: 0.3 });
        c.drums("tom", "x...x...x.x.xxxx", { bars: (b) => b % 8 === 7, vel: 0.6, note: 110 });
        c.melody("lowBrass", 0, [
            ["C4", 1], ["Eb4", 1], ["G4", 2], ["F4", 1], ["Eb4", 1], ["D4", 2],
            ["C4", 1], ["Eb4", 1], ["Ab4", 2], ["G4", 1], ["F4", 1], ["Eb4", 2],
            ["D4", 1], ["F4", 1], ["Bb4", 2], ["Ab4", 1], ["G4", 1], ["F4", 2],
            ["G4", 1], ["B4", 1], ["D5", 2], ["D5", 2], ["B4", 2],
            ["C5", 1.5], ["Bb4", 0.5], ["G4", 1], ["Eb4", 1], ["G4", 4],
            ["F4", 1], ["Ab4", 1], ["C5", 1.5], ["Bb4", 0.5], ["Ab4", 2], ["F4", 2],
            ["Eb4", 1], ["Ab4", 1], ["C5", 2], ["D5", 1], ["C5", 1], ["Bb4", 2],
            ["B4", 1], ["D5", 1], ["F5", 2], ["D5", 1], ["B4", 1], ["G4", 2],
        ], { vel: 0.95 });
    }, layer(c) {
        const ch = ["Cm", "Cm", "Ab", "Ab", "Bb", "Bb", "G", "G", "Cm", "Cm", "Fm", "Fm", "Ab", "Bb", "G", "G"];
        c.drums("tom", "x.x.x.x.x.x.x.x.", { vel: 0.4, note: 95 });
        c.drums("anvil", "..x...x...x...x.", { vel: 0.6, pan: -0.3 });
        c.drums("hat", "x.xxx.xxx.xxx.xx", { vel: 0.45 });
        c.arp("strings", ch, [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1], { octave: 5, step: 0.25, vel: 0.55 });
        c.pad("choir", ch, { octave: 4, vel: 0.45 });
    } },

    // The Reflection: the main theme turned against you; driving drums, glass arpeggios, phrygian turns. D minor, 144 BPM.
    reflection: { bpm: 144, bars: 24, reverb: 2.6, wet: 0.3, compose(c) {
        const ch = ["Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "A", "A", "Dm", "Dm", "Eb", "Eb", "Gm", "Gm", "A", "A", "Dm", "Dm", "Bb", "Bb", "Eb", "Eb", "A", "A"];
        c.bass("sawBass", ch, "RRORRRORR5RRORRO", { octave: 1, step: 0.25, vel: 0.75 });
        c.arp("harp", ch, [0, 1, 2, 3, 4, 3, 2, 1], { octave: 4, step: 0.25, vel: 0.45, pan: 0.2 });
        c.pad("strings", ch, { octave: 3, vel: 0.5 });
        c.drums("kick", "x..x..x.x..x..x.", { vel: 0.85 });
        c.drums("snare", "....x.......x...", { vel: 0.7 });
        c.drums("hat", "x.x.x.x.x.x.x.x.", { vel: 0.4 });
        c.drums("tom", "....x.x.x.xxxxxx", { bars: (b) => b % 8 === 7, vel: 0.55, note: 130 });
        c.melody("lowBrass", 0, [
            ["A3", 1], ["D4", 1], ["F4", 1.5], ["E4", 0.5], ["D4", 2], ["C4", 1], ["A3", 1],
            ["Bb3", 1], ["D4", 1], ["F4", 1], ["G4", 1], ["F4", 3], [null, 1],
            ["G4", 1], ["F4", 1], ["D4", 1.5], ["Bb3", 0.5], ["D4", 2], ["C4", 1], ["Bb3", 1],
            ["A3", 1.5], ["C#4", 0.5], ["E4", 2], ["A3", 3], [null, 1],
        ], { vel: 1 });
        c.melody("leadSaw", 8, [
            ...MOTIF,
            ["Bb4", 1], ["Eb5", 1], ["G5", 1.5], ["F5", 0.5], ["Eb5", 3], [null, 1],
            ["G5", 1], ["F5", 1], ["D5", 1.5], ["Bb4", 0.5], ["D5", 2], ["C5", 1], ["Bb4", 1],
            ["A4", 1.5], ["C#5", 0.5], ["E5", 2], ["A4", 4],
            ["D5", 1], ["F5", 1], ["A5", 2], ["G5", 1], ["F5", 1], ["E5", 2],
            ["F5", 1], ["D5", 1], ["Bb4", 2], ["C5", 1], ["D5", 1], ["F5", 2],
            ["G5", 1.5], ["F5", 0.5], ["Eb5", 1], ["D5", 1], ["Eb5", 4],
            ["E5", 1], ["C#5", 1], ["A4", 2], ["A4", 2], ["C#5", 1], ["E5", 1],
        ], { vel: 0.9 });
    }, layer(c) {
        const ch = ["Dm", "Dm", "Bb", "Bb", "Gm", "Gm", "A", "A", "Dm", "Dm", "Eb", "Eb", "Gm", "Gm", "A", "A", "Dm", "Dm", "Bb", "Bb", "Eb", "Eb", "A", "A"];
        c.drums("hat", "xxxxxxxxxxxxxxxx", { vel: 0.45 });
        c.drums("snare", "..o..o.o..o..oo.", { vel: 0.45 });
        c.drums("taiko", "x.......x.......", { vel: 0.7 });
        c.pad("choir", ch, { octave: 4, vel: 0.55 });
        c.melody("strings", 0, [
            ["A5", 1], ["D6", 1], ["F6", 1.5], ["E6", 0.5], ["D6", 2], ["C6", 1], ["A5", 1],
            ["Bb5", 1], ["D6", 1], ["F6", 1], ["G6", 1], ["F6", 4],
            ["G6", 1], ["F6", 1], ["D6", 1.5], ["Bb5", 0.5], ["D6", 2], ["C6", 1], ["Bb5", 1],
            ["A5", 1.5], ["C#6", 0.5], ["E6", 2], ["A5", 4],
        ], { vel: 0.7 });
    } },

    // Ending: dawn; the main theme in F major on flute over piano and warm strings. 70 BPM.
    ending: { bpm: 70, bars: 16, reverb: 3.6, wet: 0.45, compose(c) {
        const ch = ["F", "F", "C", "C", "Dm", "Dm", "Bb", "Bb", "F", "F", "C", "C", "Bb", "Bb", "C", "C"];
        c.pad("strings", ch, { octave: 4, vel: 0.55 });
        c.arp("piano", ch, [0, 2, 4, 2, 3, 2, 4, 2], { octave: 3, vel: 0.65 });
        c.bass("bass", ch, "R.......5.......", { octave: 2, step: 0.25, hold: 7, vel: 0.6 });
        c.melody("flute", 0, [
            ["C5", 1], ["F5", 1], ["A5", 1.5], ["G5", 0.5], ["F5", 2], ["E5", 1], ["C5", 1],
            ["E5", 1], ["G5", 1], ["C6", 1.5], ["Bb5", 0.5], ["A5", 2], ["G5", 2],
            ["F5", 1], ["A5", 1], ["D6", 1.5], ["C6", 0.5], ["A5", 2], ["F5", 2],
            ["D5", 1], ["F5", 1], ["Bb5", 1.5], ["A5", 0.5], ["G5", 2], ["F5", 1], ["D5", 1],
            ["C5", 1], ["F5", 1], ["A5", 1.5], ["G5", 0.5], ["F5", 2], ["A5", 2],
            ["G5", 1.5], ["F5", 0.5], ["E5", 1], ["G5", 1], ["C6", 3], [null, 1],
            ["D6", 1.5], ["C6", 0.5], ["Bb5", 1], ["F5", 1], ["G5", 2], ["D5", 2],
            ["E5", 1], ["G5", 1], ["Bb5", 1], ["G5", 1], ["E5", 2], ["C5", 2],
        ], { vel: 0.9 });
        c.melody("bell", 8, [["C6", 4], ["E6", 4], ["D6", 4], ["C6", 4], ["D6", 4], ["C6", 4], ["Bb5", 4], ["G5", 4]], { vel: 0.35 });
    } },
};

export const MUSIC_TRACKS = Object.keys(SCORES);
export const BOSS_TRACKS = Object.keys(SCORES).filter((k) => SCORES[k].layer);

// ---------------------------------------------------------------- rendering

const TAIL = 4; // seconds rendered past the loop end, folded back onto the start so the loop is seamless
const TARGET_RMS = 0.12;

function reverbIR(oc, seconds) {
    let seed = 99;
    const r = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const len = Math.floor(seconds * oc.sampleRate);
    const ir = oc.createBuffer(2, len, oc.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    return ir;
}

function makeNoise(oc) {
    let seed = 7;
    const len = oc.sampleRate * 2;
    const buf = oc.createBuffer(1, len, oc.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        d[i] = seed / 2147483648 - 1;
    }
    return buf;
}

const CHUNK_BARS = 2;
const RELEASE = 2.6; // longest note tail (harp, piano, bells) rendered past a chunk's end
const OAC = () => globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;

/**
 * Renders the notes of one time window into dry and reverb-send stereo signals. Each window only builds the
 * voices that sound in it, which keeps the offline graph small (rendering the whole loop as one graph makes the
 * browser process every node for the full length).
 */
async function renderChunk(sampleRate, events, from, length) {
    const Ctx = OAC();
    const oc = new Ctx(4, Math.ceil((length + RELEASE) * sampleRate), sampleRate);
    oc.destination.channelCount = 4;
    oc.destination.channelInterpretation = "discrete";
    const merger = oc.createChannelMerger(4);
    merger.connect(oc.destination);
    const dry = oc.createGain();
    const send = oc.createGain();
    const dsplit = oc.createChannelSplitter(2);
    const ssplit = oc.createChannelSplitter(2);
    dry.connect(dsplit);
    send.connect(ssplit);
    dsplit.connect(merger, 0, 0);
    dsplit.connect(merger, 1, 1);
    ssplit.connect(merger, 0, 2);
    ssplit.connect(merger, 1, 3);
    const inst = makeInstruments(oc, dry, send, makeNoise(oc));
    for (const ev of events) inst[ev.inst]({ ...ev, t: ev.t - from });
    return oc.startRendering();
}

/** Renders a score part (compose or layer) to a seamless, loudness-normalised stereo loop. */
async function renderPart(sampleRate, score, part, targetRms) {
    const c = composer(score.bpm, score.bars);
    part(c);
    const n = Math.round(c.length * sampleRate);
    const total = n + Math.ceil((RELEASE + score.reverb) * sampleRate);
    const chunk = CHUNK_BARS * c.beatsPerBar * c.beat;
    const chunks = [];
    for (let from = 0; from < c.length - 1e-6; from += chunk) {
        const events = c.events.filter((e) => e.t >= from - 1e-6 && e.t < from + chunk - 1e-6);
        if (events.length) chunks.push({ from, buffer: await renderChunk(sampleRate, events, from, chunk) });
        await new Promise((res) => setTimeout(res, 0));
    }

    // Mixdown in the browser: every chunk at its offset; dry channels straight out, send channels through
    // one shared reverb.
    const Ctx = OAC();
    const oc = new Ctx(2, total, sampleRate);
    const bus = oc.createGain();
    bus.channelCount = 4;
    bus.channelCountMode = "explicit";
    bus.channelInterpretation = "discrete";
    const split = oc.createChannelSplitter(4);
    const dryOut = oc.createChannelMerger(2);
    const sendOut = oc.createChannelMerger(2);
    bus.connect(split);
    split.connect(dryOut, 0, 0);
    split.connect(dryOut, 1, 1);
    split.connect(sendOut, 2, 0);
    split.connect(sendOut, 3, 1);
    dryOut.connect(oc.destination);
    const verb = oc.createConvolver();
    verb.buffer = reverbIR(oc, score.reverb);
    const wet = oc.createGain();
    wet.gain.value = score.wet;
    sendOut.connect(verb).connect(wet).connect(oc.destination);
    for (const ch of chunks) {
        const src = oc.createBufferSource();
        src.buffer = ch.buffer;
        src.channelCount = 4;
        src.connect(bus);
        src.start(ch.from);
    }
    const mixed = await oc.startRendering();

    // Fold the tail past the loop end back onto its start (seamless loop), then normalise loudness. The loops
    // yield between passes so a track finishing in the background never stalls a frame for long.
    const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
    const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate });
    const channels = [0, 1].map((ch) => {
        const src = mixed.getChannelData(ch);
        const d = out.getChannelData(ch);
        d.set(src.subarray(0, n));
        for (let i = n; i < total; i++) d[i - n] += src[i];
        return d;
    });
    await yieldFrame();
    let sumSq = 0;
    let peak = 0;
    for (const d of channels) {
        for (let i = 0; i < n; i++) {
            const v = d[i];
            sumSq += v * v;
            const a = v < 0 ? -v : v;
            if (a > peak) peak = a;
        }
        await yieldFrame();
    }
    const rms = Math.sqrt(sumSq / (2 * n));
    const gain = rms > 0 ? targetRms / rms : 1;
    // Keep peaks below full scale with a gentle soft clip instead of lowering the whole track.
    for (const d of channels) {
        for (let i = 0; i < n; i++) {
            const v = d[i] * gain;
            d[i] = v > 0.8 ? 0.8 + 0.18 * Math.tanh((v - 0.8) / 0.18) : v < -0.8 ? -0.8 - 0.18 * Math.tanh((-v - 0.8) / 0.18) : v;
        }
        await yieldFrame();
    }
    // Quality numbers for the dev audio test: the quietest second, and the jump across the loop seam compared with
    // the typical sample-to-sample change.
    const sec = sampleRate;
    let quietest = Infinity;
    for (let s0 = 0; s0 + sec <= n; s0 += sec) {
        let acc = 0;
        for (let i = s0; i < s0 + sec; i += 8) acc += channels[0][i] * channels[0][i];
        quietest = Math.min(quietest, Math.sqrt(acc / (sec / 8)));
    }
    let deltas = 0;
    for (let i = 1; i < n; i += 16) deltas += Math.abs(channels[0][i] - channels[0][i - 1]);
    const typicalDelta = deltas / (n / 16);
    const seamJump = Math.abs(channels[0][0] - channels[0][n - 1]);
    return { buffer: out, rms: rms * gain, peak: Math.min(peak * gain, 0.98), seconds: c.length, quietest, seamJump, typicalDelta };
}

/** Renders a track (and its phase-2 layer for boss themes). */
export async function renderTrack(sampleRate, name) {
    const score = SCORES[name];
    const base = await renderPart(sampleRate, score, score.compose, TARGET_RMS);
    const layer = score.layer ? await renderPart(sampleRate, score, score.layer, TARGET_RMS * 0.7) : null;
    return { name, bpm: score.bpm, bars: score.bars, base, layer };
}
