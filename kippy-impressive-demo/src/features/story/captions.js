import { smoothstep } from "../../core/math.js";

export const SERIF = "Georgia, 'Palatino Linotype', 'Book Antiqua', Palatino, 'Times New Roman', serif";
export const SANS = "'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif";

export const fadeIn = (t, dur, edge = 0.9) => smoothstep(0, edge, t) * (1 - smoothstep(dur - edge, dur, t));

function wrap(ctx, text, max) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (ctx.measureText(next).width > max && line) {
            lines.push(line);
            line = w;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    return lines;
}

// Story lines (bottom, one after another), gameplay hints (top), and depth title cards (center)
export function createCaptions() {
    const queue = [];
    let poem = null;
    let hint = null;
    let card = null;

    return {
        poem(text, dur = 6) {
            queue.push({ text, dur, t: 0 });
        },
        hint(text, dur = 7) {
            hint = { text, dur, t: 0 };
        },
        card(numeral, name, dur = 4.5) {
            card = { numeral, name, dur, t: 0 };
        },
        // Drop the current line and everything queued behind it
        clear() {
            queue.length = 0;
            poem = null;
        },
        get busy() {
            return Boolean(poem || queue.length);
        },
        update(dt) {
            if (!poem && queue.length) poem = queue.shift();
            for (const c of [poem, hint, card]) if (c) c.t += dt;
            if (poem && poem.t > poem.dur) poem = null;
            if (hint && hint.t > hint.dur) hint = null;
            if (card && card.t > card.dur) card = null;
        },
        render(ctx, canvas) {
            const u = canvas.height / 900;
            const W = canvas.width;
            const H = canvas.height;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            if (poem) {
                ctx.globalAlpha = fadeIn(poem.t, poem.dur, 1.1);
                ctx.font = `italic ${Math.round(25 * u)}px ${SERIF}`;
                ctx.fillStyle = "rgba(240, 232, 216, 0.95)";
                const lines = wrap(ctx, poem.text, Math.min(W * 0.7, 900 * u));
                lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.8 + (i - (lines.length - 1) / 2) * 34 * u));
            }

            if (hint) {
                ctx.globalAlpha = fadeIn(hint.t, hint.dur, 0.6) * 0.9;
                ctx.font = `${Math.round(17 * u)}px ${SANS}`;
                ctx.fillStyle = "rgba(210, 232, 240, 0.9)";
                ctx.fillText(hint.text, W / 2, H * 0.1);
            }

            if (card) {
                const a = fadeIn(card.t, card.dur, 1.2);
                ctx.globalAlpha = a;
                ctx.fillStyle = "rgba(190, 214, 224, 0.85)";
                ctx.font = `${Math.round(18 * u)}px ${SANS}`;
                ctx.fillText(`Depth ${card.numeral}`, W / 2, H * 0.4);
                ctx.fillStyle = "rgba(238, 246, 249, 0.95)";
                ctx.font = `${Math.round(46 * u)}px ${SERIF}`;
                ctx.fillText(card.name, W / 2, H * 0.4 + 50 * u);
            }
            ctx.restore();
        }
    };
}
