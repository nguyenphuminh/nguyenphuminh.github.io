import { SANS } from "../story/captions.js";
import { keycap, keycapWidth } from "../ui/keycap.js";

const URGENT = ["glide", "dash"]; // danger prompts jump the line
const KEY = 22; // keycap height in world units

// Teaches each control in the cave, the moment it matters, until the player has done it
export function createPrompts(world) {
    const taught = (world.run.taught ??= {});
    const controls = world.controls;
    const queue = [];
    const later = [];
    let current = null;
    let shown = 0;
    let leaving = null;
    let leaveT = 0;

    const track = { move: 0, map: 0, glide: 0, sangFull: false, tapped: false, dashed: false, thrown: false, beacon: null };
    const player = () => world.player;

    const defs = {
        move: { keys: ["up", "left", "down", "right"], word: () => "swim", done: () => track.move > 0.8 },
        sing: { keys: ["sing"], word: () => (track.tapped ? "hold longer" : "hold, then let go"), bar: () => player().state.charge * (player().state.charging ? 1 : 0), done: () => track.sangFull },
        map: { keys: ["map"], word: () => "hold to remember", done: () => track.map > 0.6 },
        beacon: { keys: ["sing"], word: () => "sing to it", bar: () => player().state.charge * (player().state.charging ? 1 : 0), anchor: () => track.beacon && { x: track.beacon.x, y: track.beacon.y - 120 }, done: () => !track.beacon || track.beacon.resonance > 0 },
        glide: { keys: ["glide"], word: () => "glide quietly", done: () => track.glide > 0.8 },
        dash: { keys: ["dash"], word: () => "dash", done: () => track.dashed },
        throw: { keys: ["throw"], word: () => "throw the pearl", done: () => track.thrown }
    };

    function want(id, delay = 0) {
        if (taught[id] || current === id || queue.includes(id) || later.some((l) => l.id === id)) return;
        if (delay > 0) {
            later.push({ id, at: world.time + delay });
            return;
        }
        if (URGENT.includes(id)) {
            // The interrupted prompt comes back right after this one
            if (current) queue.unshift(current);
            current = id;
            shown = 0;
        } else {
            queue.push(id);
        }
    }

    world.events.on("player-sang", ({ strength }) => {
        if (strength >= 0.95) track.sangFull = true;
        else track.tapped = true;
    });
    world.events.on("player-dashed", () => (track.dashed = true));
    world.events.on("pearl-thrown", () => (track.thrown = true));
    world.events.on("pearl-collected", () => want("throw"));
    world.events.on("listener-alert", ({ hunt }) => {
        want("glide");
        if (hunt && taught.glide) want("dash");
    });
    world.events.on("beacon-near", (B) => {
        if (B.lit || B.sealed) return;
        track.beacon = B;
        want("beacon");
    });

    function finish(id) {
        taught[id] = true;
        leaving = id;
        leaveT = 0;
        current = null;
        if (id === "move") want("sing", 0.8);
        if (id === "sing") want("map", 2.5);
        if (id === "glide" && world.listeners.anyHunting()) want("dash");
    }

    function update(dt) {
        const input = world.input;
        const s = player().state;
        if (!s.dead && !world.locked) {
            if (["up", "down", "left", "right"].some((a) => controls.down(input, a))) track.move += dt;
            track.map = controls.down(input, "map") ? track.map + dt : 0;
            track.glide = controls.down(input, "glide") ? track.glide + dt : 0;
        }

        for (const l of later.filter((l) => l.at <= world.time)) {
            later.splice(later.indexOf(l), 1);
            want(l.id);
        }
        if (!current && queue.length) {
            current = queue.shift();
            shown = 0;
        }
        if (current) {
            shown += dt;
            if (defs[current].done()) finish(current);
        }
        if (leaving) {
            leaveT += dt;
            if (leaveT > 0.6) leaving = null;
        }
    }

    function draw(ctx, id, alpha) {
        const def = defs[id];
        const p = player().entity.position;
        const at = def.anchor?.() ?? { x: p.x, y: p.y - 66 };
        const labels = def.keys.map((k) => controls.label(k));
        ctx.save();
        ctx.globalAlpha = alpha;

        if (id === "move") {
            // Laid out like the keys under your fingers: one on top, three below
            const w = Math.max(...labels.map((l) => keycapWidth(ctx, l, KEY)));
            const gap = 4;
            const rowY = at.y;
            keycap(ctx, at.x - w / 2, rowY - KEY - gap, labels[0], { h: KEY });
            labels.slice(1).forEach((l, i) => keycap(ctx, at.x - w * 1.5 - gap + i * (w + gap), rowY, l, { h: KEY }));
            word(ctx, def.word(), at.x, rowY + KEY);
        } else {
            const w = keycapWidth(ctx, labels[0], KEY);
            keycap(ctx, at.x - w / 2, at.y, labels[0], { h: KEY, fill: def.bar?.() ?? -1 });
            word(ctx, def.word(), at.x, at.y + KEY);
        }
        ctx.restore();
    }

    function word(ctx, text, x, y) {
        ctx.font = `13px ${SANS}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(215, 236, 244, 0.85)";
        ctx.fillText(text, x, y);
    }

    function renderOver(ctx) {
        const hide = player().state.dead || world.locked ? 0 : 1 - (world.mapView ?? 0);
        if (hide <= 0.01) return;
        if (leaving) draw(ctx, leaving, hide * (1 - leaveT / 0.6));
        if (current) draw(ctx, current, hide * Math.min(1, shown / 0.4));
    }

    return { want, update, renderOver };
}
