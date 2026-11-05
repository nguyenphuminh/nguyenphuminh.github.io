// Gameplay: approach area, shrine, veil, boss fight, Fallen and victory (BRD 2.2.1, 2.2.6, 2.2.0.1).
import { BOSS, DT, NO_INTENT, createSim } from "../../combat/index.js";
import { attemptLesson } from "../../brain/index.js";
import { WORLD, approachCameraX, arenaCameraX, createWorldRenderer, nearShrine, nearVeil } from "../../world/index.js";
import { createFx, drawHud, drawText } from "../../presentation/index.js";
import { PixelScene } from "./base.js";
import { PropActor, SpriteActor, syncBoss, syncPlayer } from "../actors.js";
import { anyKeyPressed, menuInput, pressed, readIntent } from "../input.js";
import { COLORS, drawControls, drawMenu, drawPanel, formatTime, wrapText } from "../ui.js";

const PAUSE_ITEMS = ["Resume", "Controls", "Quit to Title"];

export class WorldScene extends PixelScene {
    init() {
        const app = this.app;
        const art = app.art;
        this.renderer = createWorldRenderer(art);
        this.fx = createFx();
        this.sim = createSim({
            seed: (Date.now() % 2147483647) || 1,
            bounds: WORLD.approach,
            playerX: WORLD.shrineX + 6,
            bossX: WORLD.bossX,
            controller: (view) => app.brain.decide(view),
        });
        this.sim.rest();

        this.player = new SpriteActor(art.player);
        this.player.depth = 3;
        this.boss = new SpriteActor(art.boss, "dormant");
        this.boss.depth = 2;
        this.shrine = this.addProp("shrine", WORLD.shrineX, WORLD.floorY, { glowColor: COLORS.gold, glowBlur: 8 });
        this.veil = this.addProp("veil", WORLD.veilX, WORLD.floorY, { glowColor: "#9fb7ff", glowBlur: 6 });
        this.addEntity(this.player);
        this.addEntity(this.boss);
        this.hazardActors = new Map();
        this.setBossPhase(1);

        this.mode = "explore"; // explore | veil | intro | fight | dying | fallen | victory
        this.modeTime = 0;
        this.hitstop = 0;
        this.slowAcc = 0;
        this.fightTime = 0;
        this.paused = false;
        this.pauseIndex = 0;
        this.pauseControls = false;
        this.lesson = "";
        this.stepTimer = 0;
        this.camera.position.x = approachCameraX(this.sim.player.x);
        this.fade = 1;
        this.fadeTo(0, 1.2);
        app.audio.music.setIntensity(0);
    }

    addProp(key, x, y, opts = {}) {
        const prop = this.app.art.props?.[key];
        if (!prop) return null;
        const actor = new PropActor(prop);
        actor.position.x = x;
        actor.position.y = y;
        Object.assign(actor, opts);
        this.addEntity(actor);
        return actor;
    }

    setBossPhase(phase) {
        const art = this.app.art.boss;
        this.boss.sheet.texture = phase === 2 && art.sheetPhase2 ? art.sheetPhase2 : art.sheet;
        this.boss.glowColor = phase === 2 ? COLORS.magenta : COLORS.cyan;
        this.boss.glowBlur = 5;
        this.bossPhaseShown = phase;
    }

    setMode(mode) {
        this.mode = mode;
        this.modeTime = 0;
    }

    // ----- update -----

    tick(dt) {
        const app = this.app;
        if (this.paused) return this.tickPause();
        const playing = this.mode === "explore" || this.mode === "intro" || this.mode === "fight";
        if (playing && pressed(this.input, "pause")) {
            this.paused = true;
            this.pauseIndex = 0;
            app.audio.play("uiSelect");
            return;
        }
        this.modeTime += dt;
        const intent = playing ? readIntent(this.input) : NO_INTENT;

        if (this.hitstop > 0) {
            this.hitstop -= 1;
        } else {
            const slow = this.mode === "victory" && this.modeTime < 1.6 ? 0.35 : 1;
            this.slowAcc += slow;
            while (this.slowAcc >= 1) {
                this.slowAcc -= 1;
                this.stepSim(intent);
            }
        }

        this.updateMode(dt);
        this.syncActors(dt);
        this.fx.update(dt);
        this.updateCamera();
    }

    stepSim(intent) {
        const sim = this.sim;
        const events = sim.step(intent);
        if (this.mode === "intro" || this.mode === "fight") {
            this.app.brain.observe(sim.view(), events, DT);
            this.fightTime += DT;
        }
        this.react(events);
        this.footsteps();
    }

    updateMode() {
        const app = this.app;
        const sim = this.sim;
        const p = sim.player;
        this.prompt = null;

        if (this.mode === "explore") {
            if (nearShrine(p.x) && p.state !== "rest") this.prompt = "[F] Rest at the shrine";
            else if (nearVeil(p.x)) this.prompt = "[F] Pass through the veil";
            if (pressed(this.input, "interact") && p.grounded) {
                if (nearShrine(p.x)) {
                    sim.rest();
                    app.audio.play("shrineRest");
                    for (let i = 0; i < 3; i++) this.fx.spawn("healMotes", p.x, p.y - 10);
                } else if (nearVeil(p.x)) {
                    app.audio.play("veil");
                    this.fadeTo(1, 4);
                    this.setMode("veil");
                }
            }
        } else if (this.mode === "veil" && this.fade >= 1) {
            this.enterArena();
        } else if (this.mode === "intro") {
            if (sim.boss.state !== "dormant" && sim.boss.state !== "rise") this.setMode("fight");
        } else if (this.mode === "fight") {
            if (sim.outcome === "playerDead") this.setMode("dying");
            else if (sim.outcome === "bossDead") this.winFight();
        } else if (this.mode === "dying" && this.modeTime > 1.6) {
            this.loseFight();
        } else if (this.mode === "fallen") {
            if (this.modeTime > 4.2 && this.fade < 1) this.fadeTo(1, 2);
            if (this.modeTime > 4.2 && this.fade >= 1) this.respawn();
        } else if (this.mode === "victory") {
            const canSkip = this.modeTime > 3.5;
            if ((canSkip && anyKeyPressed(this.input)) || this.modeTime > 8) {
                if (this.fade < 1) this.fadeTo(1, 2);
            }
            if (this.fadeTarget === 1 && this.fade >= 1) app.go("memory", { from: "victory" });
        }
    }

    enterArena() {
        const app = this.app;
        const sim = this.sim;
        sim.player.x = WORLD.arenaEntryX;
        sim.player.vx = 0;
        sim.player.facing = 1;
        sim.setBounds(WORLD.arena);
        sim.wakeBoss();
        app.memory.stats.attempts += 1;
        app.brain.startAttempt();
        app.saveMemory();
        this.fightTime = 0;
        this.camera.position.x = arenaCameraX();
        this.setMode("intro");
        this.fadeTo(0, 2.5);
        app.audio.music.setIntensity(0.5);
    }

    finishAttempt(outcome) {
        const app = this.app;
        const summary = app.brain.endAttempt(outcome);
        const s = app.memory.stats;
        if (outcome === "playerDead") s.deaths += 1;
        if (outcome === "bossDead") s.victories += 1;
        if (outcome === "quit") s.quits += 1;
        s.bestBossHpPct = Math.min(s.bestBossHpPct, Math.round((100 * this.sim.boss.hp) / BOSS.maxHp));
        app.saveMemory();
        return summary;
    }

    loseFight() {
        this.lesson = attemptLesson(this.finishAttempt("playerDead"));
        this.setMode("fallen");
        this.app.audio.music.setIntensity(0);
    }

    winFight() {
        this.finishAttempt("bossDead");
        this.setMode("victory");
        this.app.audio.music.fadeOut(2);
        this.shake(6, 0.6);
    }

    respawn() {
        const sim = this.sim;
        sim.resetAttempt({ playerX: WORLD.shrineX + 6, bossX: WORLD.bossX });
        sim.setBounds(WORLD.approach);
        sim.rest();
        for (const actor of this.hazardActors.values()) this.removeEntity(actor);
        this.hazardActors.clear();
        this.setBossPhase(1);
        this.camera.position.x = approachCameraX(sim.player.x);
        this.setMode("explore");
        this.fadeTo(0, 1.2);
        this.app.audio.music.setIntensity(0);
    }

    tickPause() {
        const app = this.app;
        const menu = menuInput(this.input);
        if (this.pauseControls) {
            if (menu.back || menu.confirm) this.pauseControls = false;
            return;
        }
        if (menu.up) this.pauseIndex = (this.pauseIndex + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length;
        if (menu.down) this.pauseIndex = (this.pauseIndex + 1) % PAUSE_ITEMS.length;
        if (menu.up || menu.down) app.audio.play("uiMove");
        if (menu.back) {
            this.paused = false;
            return;
        }
        if (!menu.confirm) return;
        app.audio.play("uiSelect");
        if (this.pauseIndex === 0) this.paused = false;
        else if (this.pauseIndex === 1) this.pauseControls = true;
        else {
            if (this.mode === "intro" || this.mode === "fight") this.finishAttempt("quit");
            app.go("title");
        }
    }

    // ----- feedback: effects, sound, shake -----

    react(events) {
        const audio = this.app.audio;
        const fx = this.fx;
        const p = this.sim.player;
        const b = this.sim.boss;
        const accent = b.phase === 2 ? COLORS.magenta : COLORS.cyan;
        for (const e of events) {
            switch (e.type) {
                case "playerAction":
                    if (e.action === "roll") {
                        audio.play("roll");
                        fx.spawn("dust", p.x, p.y);
                    } else if (e.action === "jump") audio.play("jump");
                    else if (e.action === "light") {
                        audio.play("swingLight", { pitch: 0.95 + p.combo * 0.05 });
                        fx.spawn("slash", p.x + p.facing * 16, p.y - 14, { dir: p.facing, radius: 18, color: "#f6e7c1" });
                    } else if (e.action === "heavy") {
                        audio.play("swingHeavy");
                        fx.spawn("slash", p.x + p.facing * 18, p.y - 16, { dir: p.facing, radius: 24, color: COLORS.gold });
                    } else if (e.action === "heal") audio.play("heal");
                    break;
                case "heal":
                    for (let i = 0; i < 4; i++) fx.spawn("healMotes", p.x, p.y - 12);
                    break;
                case "healCancel":
                    audio.play("healCancel");
                    break;
                case "land":
                    audio.play("land", { volume: 0.6 });
                    fx.spawn("dust", e.x, WORLD.floorY);
                    break;
                case "playerHit":
                    audio.play("hitPlayer");
                    fx.spawn("ink", e.x, e.y, { dir: Math.sign(p.x - b.x) || 1 });
                    this.player.flash = 1;
                    this.hitstop = Math.max(this.hitstop, 4);
                    this.shake(3, 0.2);
                    break;
                case "playerDeath":
                    audio.play("playerDeath");
                    this.hitstop = 10;
                    this.shake(5, 0.4);
                    break;
                case "bossHit":
                    audio.play(e.critical ? "critical" : "hitBoss", { pitch: e.kind === "heavy" ? 0.85 : 1 });
                    fx.spawn("glass", e.x, e.y, { color: accent, dir: p.facing, count: e.critical ? 3 : 1 });
                    this.boss.flash = 1;
                    this.hitstop = Math.max(this.hitstop, e.critical ? 9 : e.kind === "heavy" ? 5 : 2);
                    if (e.critical || e.kind === "heavy") this.shake(e.critical ? 6 : 3, 0.25);
                    break;
                case "parry":
                    audio.play("parry");
                    fx.spawn("sparks", e.x, e.y, { dir: p.facing });
                    this.hitstop = Math.max(this.hitstop, 7);
                    this.shake(3, 0.2);
                    break;
                case "dodge":
                    break;
                case "bossWindup":
                    audio.play(e.telegraph === "unparryable" ? "bossWindupRed" : "bossWindup");
                    if (e.telegraph === "parryable") this.boss.flash = 0.55;
                    break;
                case "bossSwing":
                    audio.play("bossSwing");
                    fx.spawn("slash", b.x + b.facing * 30, b.y - 30, { dir: b.facing, radius: 34, color: accent });
                    break;
                case "shockwave":
                    audio.play("slam");
                    audio.play("shockwave", { volume: 0.8 });
                    fx.spawn("shockDust", e.x, WORLD.floorY);
                    this.shake(5, 0.3);
                    break;
                case "shardThrow":
                    audio.play("shardThrow");
                    break;
                case "shardBreak":
                    audio.play("shardBreak", { volume: 0.7 });
                    fx.spawn("glass", e.x, e.y, { color: accent });
                    break;
                case "shardRain":
                    audio.play("shardRain");
                    break;
                case "rainImpact":
                    audio.play("shardImpact", { volume: 0.7 });
                    fx.spawn("glass", e.x, WORLD.floorY - 4, { color: accent });
                    this.shake(2, 0.12);
                    break;
                case "bossLeap":
                    audio.play("leap");
                    break;
                case "bossLand":
                    audio.play("land");
                    fx.spawn("shockDust", e.x, WORLD.floorY);
                    this.shake(4, 0.25);
                    break;
                case "grabbed":
                    audio.play("grasp");
                    break;
                case "stagger":
                    audio.play("stagger");
                    this.shake(4, 0.3);
                    break;
                case "phase2Start":
                    audio.play("phase2");
                    this.shake(6, 1.2);
                    this.app.audio.music.setIntensity(1);
                    break;
                case "bossDeath":
                    audio.play("bossDeath");
                    for (let i = 0; i < 4; i++) fx.spawn("glass", b.x, b.y - 30 - i * 8, { color: accent, count: 3 });
                    break;
                default:
            }
        }
    }

    footsteps() {
        const p = this.sim.player;
        if (p.state !== "run" || !p.grounded) return;
        this.stepTimer -= DT;
        if (this.stepTimer <= 0) {
            this.stepTimer = 0.32;
            this.app.audio.play("step", { volume: 0.35 });
        }
    }

    // ----- view sync -----

    syncActors(dt) {
        const sim = this.sim;
        const b = sim.boss;
        syncPlayer(this.player, sim.player, this.time);
        syncBoss(this.boss, b);
        this.player.flash = Math.max(0, this.player.flash - dt * 6);
        this.boss.flash = Math.max(0, this.boss.flash - dt * 5);

        const stage = b.action ? b.action.def.stages[b.action.stageIndex] : null;
        const warning = stage && (stage.part === "windup" || stage.part === "hold") && stage.telegraph === "unparryable";
        this.boss.flashRed = warning ? 0.35 + 0.25 * Math.sin(this.time * 30) : Math.max(0, this.boss.flashRed - dt * 4);
        if (b.state === "transition" && b.stateTime > BOSS.transitionTime / 2 && this.bossPhaseShown !== 2) this.setBossPhase(2);
        if (b.state === "staggered") this.boss.glowBlur = 2;
        else this.boss.glowBlur = 5;

        this.syncHazards();
    }

    syncHazards() {
        const props = this.app.art.props ?? {};
        const live = new Set();
        const accent = this.sim.boss.phase === 2 ? COLORS.magenta : COLORS.cyan;
        for (const h of this.sim.hazards) {
            live.add(h.id);
            let actor = this.hazardActors.get(h.id);
            if (!actor) {
                const key = h.kind === "rain" ? "rainMarker" : h.kind;
                if (!props[key]) continue;
                actor = new PropActor(props[key]);
                actor.depth = 4;
                actor.glowColor = accent;
                actor.glowBlur = h.kind === "rain" ? 0 : 6;
                if (h.kind === "shard") actor.anchor = "center";
                if (h.kind === "rain" && props.fallingShard) {
                    actor.falling = new PropActor(props.fallingShard);
                    actor.falling.depth = 4;
                    actor.falling.glowColor = accent;
                    actor.falling.glowBlur = 6;
                    actor.falling.alpha = 0;
                    this.addEntity(actor.falling);
                }
                this.hazardActors.set(h.id, actor);
                this.addEntity(actor);
            }
            actor.position.x = h.x;
            actor.position.y = h.kind === "shard" ? h.y : WORLD.floorY + (h.kind === "rain" ? 3 : 0);
            actor.flipX = (h.dir ?? 1) < 0;
            if (actor.falling) {
                const left = h.impactAt - h.t;
                actor.falling.alpha = left < 0.3 ? 1 : 0;
                actor.falling.position.x = h.x;
                actor.falling.position.y = WORLD.floorY - Math.max(0, left / 0.3) * 220;
            }
        }
        for (const [id, actor] of this.hazardActors) {
            if (live.has(id)) continue;
            if (actor.falling) this.removeEntity(actor.falling);
            this.removeEntity(actor);
            this.hazardActors.delete(id);
        }
    }

    updateCamera() {
        const target = this.sim.bounds.minX >= WORLD.arenaLeft ? arenaCameraX() : approachCameraX(this.sim.player.x);
        const cam = this.camera.position;
        cam.x += (target - cam.x) * 0.15;
        if (Math.abs(target - cam.x) < 0.5) cam.x = target;
        cam.y = 0;
    }

    // ----- drawing -----

    drawBackground(ctx) {
        this.renderer.drawBackground(ctx, this.camera.position.x);
    }

    drawWorldBack(ctx) {
        const sealed = this.mode === "intro" || this.mode === "fight" || this.mode === "dying";
        this.renderer.drawBack(ctx, this.camera.position.x, { sealed });
    }

    drawWorldFront(ctx) {
        this.fx.draw(ctx);
    }

    drawOverlay(ctx) {
        const sim = this.sim;
        const p = sim.player;
        const b = sim.boss;
        const showBoss = this.mode === "fight" || this.mode === "dying" || (this.mode === "intro" && this.modeTime > 1);
        drawHud(ctx, {
            player: { hp: p.hp, maxHp: p.maxHp, stamina: p.stamina, maxStamina: p.maxStamina, heals: p.heals, maxHeals: p.maxHeals, staminaEmpty: p.staminaEmpty },
            boss: showBoss ? { name: BOSS.name, hp: b.hp, maxHp: b.maxHp, phase: b.phase, stagger: b.stagger, maxStagger: b.maxStagger } : null,
            prompt: this.paused ? null : this.prompt,
        });

        if (this.mode === "intro") this.drawNameCard(ctx);
        if (this.mode === "fallen") this.drawFallen(ctx);
        if (this.mode === "victory") this.drawVictory(ctx);
        if (this.paused) this.drawPause(ctx);
    }

    drawNameCard(ctx) {
        const t = this.modeTime;
        const alpha = Math.min(1, t / 0.6) * Math.min(1, Math.max(0, (3 - t) / 0.6));
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        drawText(ctx, "THE MIRRORWRIGHT", 240, 92, { align: "center", scale: 3, color: COLORS.text });
        ctx.fillStyle = COLORS.cyan;
        ctx.fillRect(140, 118, 200, 1);
        drawText(ctx, "It remembers every attempt.", 240, 126, { align: "center", color: COLORS.cyan });
        ctx.globalAlpha = 1;
    }

    drawFallen(ctx) {
        const t = this.modeTime;
        ctx.globalAlpha = Math.min(0.75, t / 1.2);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 480, 270);
        ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.3) / 0.8));
        drawText(ctx, "FALLEN", 240, 92, { align: "center", scale: 4, color: COLORS.red });
        drawText(ctx, `Attempt ${this.app.memory.stats.attempts}`, 240, 132, { align: "center", color: COLORS.dim });
        ctx.globalAlpha = Math.min(1, Math.max(0, (t - 1.2) / 0.8));
        wrapText(this.lesson, 360).forEach((line, i) => drawText(ctx, line, 240, 152 + i * 12, { align: "center", color: COLORS.cyan }));
        ctx.globalAlpha = 1;
    }

    drawVictory(ctx) {
        const t = this.modeTime - 1.8;
        if (t <= 0) return;
        ctx.globalAlpha = Math.min(0.6, t / 1.5);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 480, 270);
        ctx.globalAlpha = Math.min(1, t / 1);
        drawText(ctx, "MIRROR BROKEN", 240, 90, { align: "center", scale: 3, color: COLORS.gold });
        const s = this.app.memory.stats;
        drawText(ctx, `Attempts ${s.attempts}     Fight time ${formatTime(this.fightTime)}`, 240, 128, { align: "center", color: COLORS.text });
        if (this.modeTime > 3.5) drawText(ctx, "Press any key", 240, 160, { align: "center", color: COLORS.dim });
        ctx.globalAlpha = 1;
    }

    drawPause(ctx) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 480, 270);
        ctx.globalAlpha = 1;
        if (this.pauseControls) {
            drawPanel(ctx, 100, 60, 280, 150);
            drawText(ctx, "CONTROLS", 240, 70, { align: "center", color: COLORS.gold });
            drawControls(ctx, 122, 88);
            return;
        }
        drawPanel(ctx, 170, 90, 140, 80);
        drawText(ctx, "PAUSED", 240, 100, { align: "center", color: COLORS.gold });
        drawMenu(ctx, PAUSE_ITEMS, this.pauseIndex, 190, 120);
    }
}
