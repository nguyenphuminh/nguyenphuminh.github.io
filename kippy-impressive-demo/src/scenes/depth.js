import { Scene } from "kippy";
import { DEPTHS } from "../config/depths.js";
import { createEvents } from "../core/events.js";
import { damp, lerp, smoothstep } from "../core/math.js";
import { saveRun, clearRun } from "../core/save.js";
import { baseZoom, centerCamera, applyCamera, viewBounds } from "../core/view.js";
import { generateLevel } from "../features/level/generate.js";
import { createWalls } from "../features/level/walls.js";
import { createWallArt } from "../features/level/wallArt.js";
import { surfacePoints } from "../features/level/contour.js";
import { createSonar } from "../features/sonar/sonar.js";
import { createNoise } from "../features/noise/noise.js";
import { createPlayer } from "../features/player/player.js";
import { createListeners } from "../features/listeners/listeners.js";
import { createBeacons } from "../features/beacons/beacons.js";
import { createPearls } from "../features/pearls/pearls.js";
import { createJellies } from "../features/fauna/jellies.js";
import { createCurrents } from "../features/fauna/currents.js";
import { createParticles } from "../features/fx/particles.js";
import { createLighting } from "../features/fx/lighting.js";
import { createBackdrop } from "../features/fx/backdrop.js";
import { createSfx } from "../features/audio/sfx.js";
import { createCaptions } from "../features/story/captions.js";
import { INTRO, POEMS, ENDING, DEATH } from "../features/story/text.js";
import { createHud } from "../features/ui/hud.js";
import { createMenu, confirmed } from "../features/ui/menu.js";
import { createControlsPage } from "../features/ui/controlsPage.js";
import { createPrompts } from "../features/controls/prompts.js";
import { TitleScene } from "./title.js";

const FROZEN = { update() {} }; // stands in for Kippy's physics while paused
const ease = (t) => t * t * (3 - 2 * t);

export const levelSeed = (run) => (run.seed + run.depth * 7919) >>> 0;

// One depth of the trench: builds the world from every feature and runs it on Kippy
export class DepthScene extends Scene {
    constructor(services, run, { intro = false } = {}) {
        super();
        this.services = services;
        this.run = run;
        this.intro = intro;
    }

    init() {
        const game = this.game;
        const depth = DEPTHS[this.run.depth];
        const level = generateLevel(depth, levelSeed(this.run));
        this.entry = { voices: [...this.run.voices], stats: { ...this.run.stats } };
        saveRun(this.run);

        const world = {
            game,
            canvas: game.canvas,
            input: game.input,
            camera: this.camera,
            level,
            run: this.run,
            stats: this.run.stats,
            time: 0,
            step: 0,
            events: createEvents(),
            dirty: true,
            locked: false,
            peaceful: false,
            music: this.services.music,
            controls: this.services.controls,
            captions: createCaptions(),
            shake: (a) => (this.trauma = Math.min(1, this.trauma + a)),
            kick: (a) => (this.zoomKick += a),
            flash: (x, y, r, dur) => this.flashes.push({ x, y, r, dur, t: 0 }),
            hurtFlash: () => (this.hurt = 1)
        };
        this.world = world;
        world.sfx = createSfx(this.services.sounds, () => world.player.entity.position);
        world.particles = createParticles();
        world.noise = createNoise(world);
        world.sonar = createSonar(world);
        world.player = createPlayer(world);
        world.beacons = createBeacons(world);
        world.listeners = createListeners(world);
        world.pearls = createPearls(world);
        world.jellies = createJellies(world);
        world.currents = createCurrents(world);
        world.hud = createHud(world);
        world.prompts = createPrompts(world);

        this.walls = createWalls(level);
        this.wallArt = createWallArt(level, depth.rock);
        this.lighting = createLighting();
        this.backdrop = createBackdrop(depth.water, { shafts: depth.shafts });
        this.realPhysics = this.physics;

        this.trauma = 0;
        this.zoomKick = 0;
        this.hurt = 0;
        this.flashes = [];
        this.mapT = 0;
        this.paused = false;
        this.phase = "play";
        this.phaseT = 0;
        this.fade = 1;
        this.firstFrame = true;
        this.camX = level.spawn.x;
        this.camY = level.spawn.y;
        this.darkness = depth.darkness;

        this.pauseMenu = createMenu([
            { id: "resume", label: "Resume" },
            { id: "controls", label: "Controls" },
            { id: "sound", label: () => `Sound: ${this.game.audio.muted ? "off" : "on"}` },
            { id: "restart", label: "Restart depth" },
            { id: "quit", label: "Quit to title" }
        ]);
        this.controlsPage = createControlsPage(this.services.controls);
        this.deathMenu = createMenu([{ id: "retry", label: "Try again" }]);
        this.statsMenu = createMenu([{ id: "surface", label: "Back to the surface" }]);

        this.services.music.setVoices(this.run.voices);
        this.services.music.start();
        world.captions.card(depth.numeral, depth.name);
        if (this.intro) INTRO.forEach((line) => world.captions.poem(line, 4.6));
        world.prompts.want("move", 1.5);

        world.events.on("player-died", () => this.setPhase("dead"));
        world.events.on("rift-entered", () => this.phase === "play" && this.setPhase("descend"));
        world.events.on("heart-lit", () => this.setPhase("ending"));
        this.rebuild();
    }

    setPhase(phase) {
        this.phase = phase;
        this.phaseT = 0;
        const world = this.world;
        if (phase === "descend") {
            world.locked = true;
        } else if (phase === "ending") {
            world.peaceful = true;
            world.listeners.sleepAll();
            this.services.music.stopTension();
            const heart = world.beacons.heart;
            world.sonar.revealAll(surfacePoints(world.level, 7), heart.x, heart.y, 650, 1);
            this.overview = this.wallArt.overview();
            world.captions.clear();
            world.captions.poem(POEMS[this.run.voices.length - 1], 6);
            ENDING.forEach((line) => world.captions.poem(line, 6));
            clearRun();
        }
    }

    // Kippy only simulates what is in the entity list: rock near moving things, plus all actors
    rebuild() {
        const w = this.world;
        const movers = [w.player.entity.position, ...w.listeners.entities.map((e) => e.position), ...w.pearls.flying, ...w.jellies.positions()];
        const walls = this.walls.near(movers, 160, []);
        this.entities = [...w.beacons.entities, ...w.currents.entities, ...w.pearls.entities, ...walls, ...w.jellies.entities, ...w.listeners.entities, w.player.entity];
        w.dirty = false;
    }

    setPaused(paused) {
        this.paused = paused;
        this.pauseView = "menu";
        this.pauseMenu.reset();
        this.physics = paused ? FROZEN : this.realPhysics;
        this.game.audio.bus("sfx").muted = paused;
    }

    animationUpdate(dt) {
        if (!this.paused) super.animationUpdate(dt);
    }

    update(dt) {
        const input = this.game.input;
        const world = this.world;

        if (this.paused) {
            this.updatePause(input);
            return;
        }
        if (this.phase === "play" && input.isKeyPressed("Escape")) {
            this.setPaused(true);
            return;
        }

        world.time += dt;
        world.step++;
        this.phaseT += dt;
        if (this.phase === "play") this.run.stats.time += dt;

        if (world.dirty || world.step % 6 === 0) this.rebuild();
        const view = viewBounds(this.camera, this.game.canvas, 200);
        world.player.update(dt);
        world.listeners.update(dt);
        world.pearls.update(dt);
        world.jellies.update(dt);
        world.currents.update(dt, view);
        world.beacons.update(dt);
        world.sonar.update(dt);
        world.noise.update(dt);
        world.particles.update(dt);
        world.captions.update(dt);
        world.prompts.update(dt);
        this.services.music.update(dt, world.listeners.anyHunting() && !world.peaceful ? 1 : 0);

        this.hurt = damp(this.hurt, 0, 3, dt);
        for (const f of this.flashes) f.t += dt;
        this.flashes = this.flashes.filter((f) => f.t < f.dur);
        this.updatePhase(dt, input);
        this.updateCamera(dt, input);
    }

    updatePause(input) {
        if (this.pauseView === "controls") {
            if (this.controlsPage.update(input) === "back") this.pauseView = "menu";
            return;
        }
        if (input.isKeyPressed("Escape")) {
            this.setPaused(false);
            return;
        }
        const pick = this.pauseMenu.update(input, this.services.controls);
        if (pick === "resume") this.setPaused(false);
        else if (pick === "controls") {
            this.controlsPage.open();
            this.pauseView = "controls";
        } else if (pick === "sound") this.game.audio.muted = !this.game.audio.muted;
        else if (pick === "restart") this.restart();
        else if (pick === "quit") this.leave(() => new TitleScene(this.services));
    }

    updatePhase(dt, input) {
        const world = this.world;
        const controls = this.services.controls;
        if (this.phase === "play") {
            this.fade = damp(this.fade, 0, 1.6, dt);
        } else if (this.phase === "dead") {
            if (this.phaseT > 2.6 && this.deathMenu.update(input, controls) === "retry") this.restart();
        } else if (this.phase === "descend") {
            const p = world.player.entity;
            const rift = world.beacons.rift;
            p.body.velocity.x = (rift.x - p.position.x) * 3;
            p.body.velocity.y = (rift.y - p.position.y) * 3;
            this.fade = Math.min(1, this.phaseT / 1.8);
            if (this.phaseT > 2.2) {
                this.run.depth++;
                this.leave(() => new DepthScene(this.services, this.run));
            }
        } else if (this.phase === "ending") {
            this.darkness = lerp(world.level.depth.darkness, 0.6, smoothstep(2, 10, this.phaseT));
            // Stats once every story line has been read (a key or click skips ahead)
            const skip = confirmed(input) || input.isPointerPressed(0);
            if (this.statsAt === undefined) {
                if ((this.phaseT > 8 && !world.captions.busy) || (this.phaseT > 4 && skip)) this.statsAt = this.phaseT + (skip ? 0 : 1);
            } else if (this.phaseT > this.statsAt + 1.5 && this.statsMenu.update(input, controls) === "surface") {
                this.leave(() => new TitleScene(this.services));
            }
        }
    }

    updateCamera(dt, input) {
        const canvas = this.game.canvas;
        const cam = this.camera;
        const level = this.world.level;
        const t = this.world.time;
        const p = this.world.player.entity;

        const wantMap = (this.phase === "play" && this.services.controls.down(input, "map")) || (this.phase === "ending" && this.phaseT > 2.5);
        this.mapT = damp(this.mapT, wantMap ? 1 : 0, this.phase === "ending" ? 0.8 : 6, dt);
        this.zoomKick = damp(this.zoomKick, 0, 4, dt);

        this.camX = damp(this.camX, p.position.x + p.body.velocity.x * 0.35, 4, dt);
        this.camY = damp(this.camY, p.position.y + p.body.velocity.y * 0.35, 4, dt);
        const m = ease(Math.min(1, this.mapT));
        const fit = Math.min(canvas.width / level.width, canvas.height / level.height) * 0.92;

        this.trauma = Math.max(0, this.trauma - dt * 1.4);
        const shake = this.trauma ** 2;
        const ox = (Math.sin(t * 37.1) * 0.6 + Math.sin(t * 23.3 + 1) * 0.4) * 16 * shake;
        const oy = (Math.sin(t * 31.7 + 2) * 0.6 + Math.sin(t * 19.9) * 0.4) * 16 * shake;

        cam.zoom = lerp(baseZoom(canvas) * (1 + this.zoomKick), fit, m);
        cam.rotation = (Math.sin(t * 21.3) * 0.025 * shake) * (1 - m);
        centerCamera(cam, canvas, lerp(this.camX, level.width / 2, m) + ox, lerp(this.camY, level.height / 2, m) + oy);
    }

    restart() {
        this.run.voices = [...this.entry.voices];
        this.run.stats = { ...this.entry.stats };
        this.leave(() => new DepthScene(this.services, this.run));
    }

    leave(next) {
        this.setPaused(false);
        this.world.listeners.destroy();
        this.world.player.state.hum?.stop();
        this.services.music.stopTension();
        this.game.setScene(next());
    }

    render() {
        const ctx = this.game.ctx;
        const canvas = this.game.canvas;
        const world = this.world;
        const cam = this.camera;
        const map = ease(Math.min(1, this.mapT));
        const view = viewBounds(cam, canvas, 32);
        // The memory map shows only what was heard: everything else fades out with it
        world.mapView = this.phase === "ending" ? 0 : map;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        this.backdrop.renderBack(ctx, canvas);

        // World, under the darkness
        ctx.save();
        applyCamera(ctx, cam, canvas);
        if (this.overview && map > 0.5) ctx.drawImage(this.overview, 0, 0, world.level.width, world.level.height);
        else if (map < 0.35) this.wallArt.render(ctx, view, this.firstFrame ? 40 : 2);
        world.listeners.renderUnder(ctx);
        for (const e of this.entities) e.render(ctx);
        ctx.restore();
        this.firstFrame = false;

        // Darkness, cut by every light
        const lights = [];
        world.player.lights(lights);
        world.beacons.lights(lights);
        world.jellies.lights(lights);
        world.pearls.lights(lights);
        world.listeners.lights(lights);
        for (const f of this.flashes) {
            const k = 1 - f.t / f.dur;
            lights.push({ x: f.x, y: f.y, r: f.r * (0.6 + 0.4 * k), i: 0.9 * k * k, color: `rgba(170, 235, 255, ${0.25 * k})` });
        }
        const vb = viewBounds(cam, canvas, 0);
        const shown = world.mapView > 0.5 ? [] : lights.filter((l) => l.x + l.r > vb.x0 && l.x - l.r < vb.x1 && l.y + l.r > vb.y0 && l.y - l.r < vb.y1);
        this.lighting.render(ctx, cam, canvas, shown, lerp(this.darkness, 1, world.mapView));

        // What the Lantern perceives: echoes, ghosts, glows
        ctx.save();
        applyCamera(ctx, cam, canvas);
        this.backdrop.renderShafts(ctx, world.time, world.level.width, 1 - map);
        world.sonar.renderOver(ctx, view, { boost: map * 0.45, zoom: cam.zoom });
        world.beacons.renderOver(ctx);
        world.pearls.renderOver(ctx);
        world.listeners.renderOver(ctx);
        world.particles.renderOver(ctx);
        if (map < 0.5) {
            world.noise.renderOver(ctx);
            world.player.renderOver(ctx);
        }
        world.prompts.renderOver(ctx);
        ctx.restore();
        this.backdrop.renderSnow(ctx, cam, canvas, world.time, 1 - map * 0.7);

        this.backdrop.renderPost(ctx, canvas, { hurt: this.hurt, danger: world.listeners.anyHunting() && !world.peaceful ? 1 : 0, fade: this.fade, time: world.time });
        world.hud.render(ctx, canvas, { map: this.phase === "ending" ? 0 : map });
        world.captions.render(ctx, canvas);

        const H = canvas.height;
        const u = H / 900;
        if (this.phase === "dead") {
            world.hud.panel(ctx, canvas, DEATH, smoothstep(1, 2.4, this.phaseT));
            if (this.phaseT > 2.6) this.deathMenu.render(ctx, canvas, { y: H * 0.45, alpha: smoothstep(2.6, 3.2, this.phaseT) });
        }
        if (this.statsAt !== undefined && this.phaseT > this.statsAt) {
            world.hud.renderStats(ctx, canvas, this.run.stats, smoothstep(this.statsAt, this.statsAt + 1.5, this.phaseT));
            if (this.phaseT > this.statsAt + 1.5) this.statsMenu.render(ctx, canvas, { y: H * 0.36 + 230 * u, size: 24 });
        }
        if (this.paused && this.pauseView === "controls") this.controlsPage.render(ctx, canvas);
        else if (this.paused) {
            world.hud.panel(ctx, canvas, "Paused", 1, 0.26);
            this.pauseMenu.render(ctx, canvas, { y: H * 0.4, size: 24, spacing: 2 });
        }
    }
}
