import { Scene } from "kippy";
import { DEPTHS } from "../config/depths.js";
import { createEvents } from "../core/events.js";
import { makeCanvas } from "../core/paint.js";
import { randomSeed } from "../core/rng.js";
import { loadRun } from "../core/save.js";
import { applyCamera, centerCamera, viewBounds, worldToScreen } from "../core/view.js";
import { generateLevel } from "../features/level/generate.js";
import { createSonar, WAVE_SPEED } from "../features/sonar/sonar.js";
import { createBackdrop } from "../features/fx/backdrop.js";
import { SERIF, SANS } from "../features/story/captions.js";
import { TITLE } from "../features/story/text.js";
import { createMenu } from "../features/ui/menu.js";
import { createControlsPage } from "../features/ui/controlsPage.js";
import { DepthScene } from "./depth.js";

const DEMO = { ...DEPTHS[0], cols: 150, rows: 95, beacons: 2, extraChambers: 6, listeners: 0, pearls: 0, jellies: 0, currents: 0 };
const BINS = 10;
const RESIDUE = 0.16;

const newRun = () => ({ depth: 0, seed: randomSeed(), voices: [], taught: {}, stats: { time: 0, songs: 0, heard: 0, lightsLost: 0, pearlsThrown: 0 } });

// The title's outline as points (centered, in title pixels), sampled once
let titlePoints = null;
function sampleTitle() {
    if (titlePoints) return titlePoints;
    const size = 132;
    const c = makeCanvas(1400, 220);
    const g = c.getContext("2d", { willReadFrequently: true });
    g.font = `${size}px ${SERIF}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText(TITLE, c.width / 2, c.height / 2);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    const solid = (x, y) => data[(y * c.width + x) * 4 + 3] > 127;
    const taken = new Set();
    const pts = [];
    for (let y = 2; y < c.height - 2; y++) {
        for (let x = 2; x < c.width - 2; x++) {
            if (!solid(x, y) || (solid(x - 2, y) && solid(x + 2, y) && solid(x, y - 2) && solid(x, y + 2))) continue;
            const key = `${Math.floor(x / 3)},${Math.floor(y / 3)}`;
            if (taken.has(key)) continue;
            taken.add(key);
            pts.push(x - c.width / 2, y - c.height / 2);
        }
    }
    titlePoints = new Float32Array(pts);
    return titlePoints;
}

// A real cave sung into view by an invisible singer; the title answers the same waves
export class TitleScene extends Scene {
    constructor(services) {
        super();
        this.services = services;
    }

    init() {
        this.level = generateLevel(DEMO, randomSeed());
        this.world = { level: this.level, time: 0, events: createEvents() };
        this.sonar = createSonar(this.world);
        this.backdrop = createBackdrop(DEPTHS[0].water);
        this.points = sampleTitle();
        this.lit = new Float32Array(this.points.length / 2).fill(-1e9);
        this.waves = [];
        this.pingT = 0.4;
        this.leaving = null;
        this.leaveT = 0;
        this.view = "menu";
        this.awake = this.game.audio.unlocked;
        if (this.awake) this.services.music.start();

        const saved = loadRun();
        const items = saved
            ? [
                  { id: "continue", label: "Continue", detail: () => `Depth ${DEPTHS[saved.depth].numeral}, ${DEPTHS[saved.depth].name}` },
                  { id: "new", label: "New descent" }
              ]
            : [{ id: "new", label: "Descend" }];
        this.saved = saved;
        this.menu = createMenu([...items, { id: "controls", label: "Controls" }]);
        this.controlsPage = createControlsPage(this.services.controls);
    }

    update(dt) {
        const input = this.game.input;
        const world = this.world;
        world.time += dt;

        if (!this.awake && (input.keysPressed.size || input.pointersPressed.size)) {
            this.awake = true;
            this.services.music.start();
        }

        this.pingT -= dt;
        if (this.pingT <= 0) {
            this.pingT = 2.6;
            const c = this.level.chambers[Math.floor(Math.random() * this.level.chambers.length)];
            const x = c.x * this.level.cell;
            const y = c.y * this.level.cell;
            this.sonar.cast(x, y, 0.9, { source: "title" });
            const s = worldToScreen(this.camera, this.game.canvas, x, y);
            this.waves.push({ x: s.x, y: s.y, t0: world.time, speed: WAVE_SPEED * this.camera.zoom });
            if (this.awake) this.services.sounds.ping.play({ volume: 0.22, pitch: 0.75 + Math.random() * 0.2 });
        }
        this.sonar.update(dt);

        if (this.leaving) {
            this.leaveT += dt;
            if (this.leaveT > 1.4) this.game.setScene(this.leaving());
            return;
        }

        if (this.view === "controls") {
            if (this.controlsPage.update(input) === "back") this.view = "menu";
            return;
        }
        const pick = this.menu.update(input, this.services.controls);
        if (pick === "continue") {
            const run = this.saved;
            this.leaving = () => new DepthScene(this.services, run);
        } else if (pick === "new") {
            this.leaving = () => new DepthScene(this.services, newRun(), { intro: true });
        } else if (pick === "controls") {
            this.controlsPage.open();
            this.view = "controls";
        }
        if (this.leaving) this.services.sounds.relight.play({ volume: 0.6 });
    }

    // Title letters light up when a wave passes over them, then fade like any echo
    renderTitle(ctx, cx, cy, scale, alpha) {
        const now = this.world.time;
        const pts = this.points;
        const n = this.lit.length;
        for (const w of this.waves) {
            for (let i = 0; i < n; i++) {
                const hit = w.t0 + Math.hypot(cx + pts[i * 2] * scale - w.x, cy + pts[i * 2 + 1] * scale - w.y) / w.speed;
                if (hit <= now && hit > this.lit[i]) this.lit[i] = hit;
            }
        }
        const diag = Math.hypot(this.game.canvas.width, this.game.canvas.height);
        this.waves = this.waves.filter((w) => (now - w.t0) * w.speed < diag * 2);

        const bins = Array.from({ length: BINS }, () => []);
        for (let i = 0; i < n; i++) {
            const age = now - this.lit[i];
            if (age > 1e6) continue;
            const a = RESIDUE + (1 - RESIDUE) * Math.exp(-age / 1.6);
            bins[Math.min(BINS - 1, Math.floor(a * BINS))].push(i);
        }
        const s = Math.max(1.5, 2.4 * scale);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        bins.forEach((list, b) => {
            ctx.fillStyle = `rgba(150, 240, 255, ${(((b + 0.5) / BINS) * alpha).toFixed(3)})`;
            for (const i of list) ctx.fillRect(cx + pts[i * 2] * scale - s / 2, cy + pts[i * 2 + 1] * scale - s / 2, s, s);
        });
        ctx.restore();
    }

    render() {
        const ctx = this.game.ctx;
        const canvas = this.game.canvas;
        const cam = this.camera;
        const t = this.world.time;
        const W = canvas.width;
        const H = canvas.height;
        const u = H / 900;

        cam.zoom = Math.max(W / this.level.width, H / this.level.height) * 1.05;
        cam.rotation = 0;
        centerCamera(cam, canvas, this.level.width / 2 + Math.sin(t * 0.07) * 60, this.level.height / 2 + Math.cos(t * 0.05) * 40);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        this.backdrop.renderBack(ctx, canvas);
        ctx.fillStyle = "rgba(1, 3, 8, 0.85)";
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        applyCamera(ctx, cam, canvas);
        this.sonar.renderOver(ctx, viewBounds(cam, canvas, 20), { zoom: cam.zoom });
        ctx.restore();
        this.backdrop.renderSnow(ctx, cam, canvas, t);

        if (this.view === "controls") {
            this.controlsPage.render(ctx, canvas);
        } else {
            this.renderTitle(ctx, W / 2, H * 0.34, Math.min(u, W / 1500), 1);
            this.menu.render(ctx, canvas, { y: H * 0.56, size: 26, alpha: Math.min(1, t / 1.5) });
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#b6cad3";
            ctx.font = `${Math.round(13 * u)}px ${SANS}`;
            ctx.fillText("Made with Kippy", W / 2, H - 36 * u);
            ctx.restore();
        }

        this.backdrop.renderPost(ctx, canvas, { fade: Math.max(1 - t / 1.5, this.leaving ? this.leaveT / 1.2 : 0), time: t });
    }
}
