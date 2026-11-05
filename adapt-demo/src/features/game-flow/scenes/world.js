// Gameplay in one area of the journey (BRD 2.2.1, 2.2.6, 2.2.11, 2.2.12, 2.2.13):
// shrine, mobs, inscriptions, veil, boss fight, cutscenes, Fallen and victory.
import { DT, ENEMIES, NO_INTENT, createSim } from "../../combat/index.js";
import { attemptLesson } from "../../brain/index.js";
import { AREAS, approachCameraX, arenaCameraX, createWorldRenderer, nearVeil, nearX } from "../../world/index.js";
import { createFx, drawHud, drawInscription, drawMobBar, drawText } from "../../presentation/index.js";
import { BOSS_LINES, CUTSCENES, INSCRIPTIONS, createCutscene, reflectionLine } from "../../story/index.js";
import { PixelScene } from "./base.js";
import { PropActor, SpriteActor, syncEnemy, syncPlayer } from "../actors.js";
import { actionPressed, anyKeyPressed, menuInput, pressed, readIntent } from "../input.js";
import { actionKeyLabel } from "../controls.js";
import { createControlsPanel } from "../controls-panel.js";
import { COLORS, drawMenu, drawPanel, formatTime, wrapText } from "../ui.js";

const PAUSE_ITEMS = ["Resume", "Controls", "Quit to Title"];
const BOSS_ART = { squire: "squire", mirrorwright: "boss", reflection: "reflection" };
const ECHO_LAG_FRAMES = 90;
const IVORY = "#efe6cf";
const REST_BLOCK_RANGE = 220;

export class WorldScene extends PixelScene {
    constructor(app, params = {}) {
        super(app);
        this.area = AREAS[params.area];
        this.endingOnly = Boolean(params.ending); // play the ending in this area's arena, then the credits
    }

    init() {
        const app = this.app;
        const area = this.area;
        const art = app.art;
        this.bossId = area.bossId;
        this.bossDef = ENEMIES[area.bossId];
        this.brain = app.brains[area.bossId];
        this.renderer = createWorldRenderer(art, area);
        this.fx = createFx();
        this.sim = createSim({
            seed: (Date.now() % 2147483647) || 1,
            bounds: area.approach,
            playerX: area.shrineX + 6,
            boss: { id: area.bossId, x: area.bossX },
            mobs: area.mobs,
            controller: (view) => this.brain.decide(view),
        });
        this.sim.rest();

        this.player = new SpriteActor(art.player);
        this.player.depth = 3;
        this.bossArt = art[BOSS_ART[area.bossId]] ?? art.boss;
        this.boss = new SpriteActor(this.bossArt, "dormant");
        this.boss.depth = 2;
        this.props = {};
        this.addProp("shrine", "shrine", area.shrineX, { glowColor: COLORS.gold, glowBlur: 8 });
        this.addProp("veil", "veil", area.veilX, { glowColor: "#9fb7ff", glowBlur: 6 });
        if (area.gateX !== undefined) this.addProp("gate", "keepGate", area.gateX);
        const seen = app.memory.journey.seen;
        if (area.roadShardX !== undefined && !seen.includes("arrival")) this.addProp("roadShard", "roadShard", area.roadShardX, { glowColor: COLORS.cyan, glowBlur: 4 });
        area.inscriptions.forEach((ins, i) => this.addProp(`tablet${i}`, "tablet", ins.x, { glowColor: COLORS.cyan, glowBlur: 3 }));
        (area.mirrorPanes ?? []).forEach((x, i) => this.addProp(`pane${i}`, "mirrorPane", x, { depth: -2 }));
        (area.arenaProps ?? []).forEach((p, i) => this.addProp(p.name ?? `arena${i}`, p.key, area.arenaLeft + p.dx, { depth: p.depth ?? -1 }));
        if (area.openBackdrop && app.memory.journey.defeated.includes(area.bossId)) this.renderer.setBackdrop(area.openBackdrop);
        this.echoLag = 0;
        this.history = [];
        this.dawn = false;
        this.addEntity(this.player);
        this.addEntity(this.boss);
        this.mobActors = new Map();
        this.hazardActors = new Map();
        this.rebuildMobActors();
        this.setBossPhase(1);

        this.mode = "explore"; // explore | cutscene | veil | intro | fight | dying | fallen | victory | card
        this.modeTime = 0;
        this.hitstop = 0;
        this.slowAcc = 0;
        this.fightTime = 0;
        this.paused = false;
        this.pauseIndex = 0;
        this.pauseControls = false;
        this.reading = null;
        this.lesson = "";
        this.bossLine = null;
        this.stepTimer = 0;
        this.cutscene = null;
        this.camera.position.x = approachCameraX(area, this.sim.player.x);
        this.fade = 1;
        this.fadeTo(0, 1.2);

        const j = app.memory.journey;
        j.area = area.id;
        app.habits.startAttempt();
        app.saveMemory();
        app.playMusic(area.music);
        syncPlayer(this.player, this.sim.player, 0);
        syncEnemy(this.boss, this.sim.boss);
        if (this.endingOnly) {
            this.sim.setBounds(area.arena);
            this.camera.position.x = arenaCameraX(area);
            app.playMusic("ending", 3);
            this.playCutscene(area.cutscenes.ending, () => this.finishJourney());
            return;
        }
        const enter = area.cutscenes.enter;
        if (enter && !seen.includes(enter)) this.playCutscene(enter, () => this.afterEnter());
    }

    addProp(name, key, x, opts = {}) {
        const prop = this.app.art.props?.[key];
        if (!prop) return null;
        const actor = new PropActor(prop);
        actor.position.x = x;
        actor.position.y = this.area.floorY;
        Object.assign(actor, opts);
        this.addEntity(actor);
        this.props[name] = actor;
        return actor;
    }

    rebuildMobActors() {
        for (const actor of this.mobActors.values()) this.removeEntity(actor);
        this.mobActors.clear();
        for (const m of this.sim.mobs) {
            const art = this.app.art.mobs?.[m.def.id];
            if (!art) continue;
            const actor = new SpriteActor(art);
            actor.depth = 2;
            this.mobActors.set(m.uid, actor);
            this.addEntity(actor);
            syncEnemy(actor, m);
        }
    }

    actorFor(uid) {
        return uid === this.sim.boss.uid ? this.boss : this.mobActors.get(uid);
    }

    setBossPhase(phase) {
        this.boss.sheet.texture = phase === 2 && this.bossArt.sheetPhase2 ? this.bossArt.sheetPhase2 : this.bossArt.sheet;
        this.boss.glowColor = phase === 2 ? COLORS.magenta : this.bossId === "squire" ? IVORY : COLORS.cyan;
        this.boss.glowBlur = 5;
        this.bossPhaseShown = phase;
    }

    setMode(mode) {
        this.mode = mode;
        this.modeTime = 0;
    }

    // ----- cutscenes -----

    playCutscene(id, after) {
        const script = CUTSCENES[id];
        if (!script) {
            after();
            return;
        }
        const scene = this;
        const host = {
            actors: { knight: this.player, boss: this.boss },
            area: this.area,
            camera: this.camera,
            audio: this.app.audio,
            art: this.app.art,
            fadeTo: (to, speed) => this.fadeTo(to, speed),
            setFade(v) {
                scene.fade = v;
                scene.fadeTarget = v;
            },
            shake: (power, t) => this.shake(power, t),
            hideProp: (name) => {
                if (this.props[name]) this.props[name].visible = false;
            },
            burstShards: (x, y) => {
                for (let i = 0; i < 6; i++) this.fx.spawn("glass", x, y - i * 5, { color: this.bossId === "squire" ? IVORY : COLORS.cyan, count: 3, dir: i % 2 ? 1 : -1 });
            },
            setEchoLag: (seconds) => {
                this.echoLag = seconds;
            },
            openArenaWall: () => {
                if (this.area.openBackdrop) this.renderer.setBackdrop(this.area.openBackdrop);
            },
            crackGreatMirror: () => {
                const mirror = this.props.greatMirror;
                const cracked = this.app.art.props?.greatMirrorCracked;
                if (mirror && cracked && !mirror.cracked) {
                    this.removeEntity(mirror);
                    this.addProp("greatMirror", "greatMirrorCracked", mirror.position.x, { depth: -2 }).cracked = true;
                }
            },
            showDawn: (on) => {
                this.dawn = on;
            },
            fallsLine: () => reflectionLine(this.app.memory.stats.falls),
        };
        this.cutscene = { runner: createCutscene(script, host), after, id };
        this.setMode("cutscene");
    }

    endCutscene() {
        const { after, id } = this.cutscene;
        this.cutscene = null;
        const seen = this.app.memory.journey.seen;
        if (!seen.includes(id)) seen.push(id);
        this.app.saveMemory();
        after();
    }

    afterEnter() {
        const p = this.sim.player;
        p.x = this.player.position.x;
        p.facing = 1;
        p.state = "idle"; // the knight walked in; they are standing, not resting
        p.stateTime = 0;
        this.setMode("explore");
    }

    finishJourney() {
        const app = this.app;
        const j = app.memory.journey;
        j.completed = true;
        j.awaitingEnding = false;
        app.memory.stats.journeysCompleted += 1;
        app.saveMemory();
        app.go("credits");
    }

    // ----- update -----

    tick(dt) {
        const app = this.app;
        if (this.reading) return this.tickReading();
        if (this.paused) return this.tickPause();
        if (this.mode === "cutscene") {
            if (this.cutscene.runner.update(dt, this.input)) this.endCutscene();
            this.fx.update(dt);
            this.recordHistory();
            return;
        }
        const playing = this.mode === "explore" || this.mode === "intro" || this.mode === "fight";
        if (playing && pressed(this.input, "pause")) {
            this.paused = true;
            this.pauseIndex = 0;
            app.audio.play("uiSelect");
            return;
        }
        this.modeTime += dt;
        const intent = playing ? readIntent(this.input, app.controls) : NO_INTENT;

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

        this.updateMode();
        if (this.mode !== "cutscene") this.syncActors(dt);
        this.recordHistory();
        if (this.bossLine) this.bossLine.t += dt;
        this.fx.update(dt);
        this.updateCamera();
    }

    stepSim(intent) {
        const sim = this.sim;
        const app = this.app;
        const events = sim.step(intent);
        if (this.mode === "explore" || this.mode === "intro" || this.mode === "fight") {
            app.habits.observe(sim.view(), events, DT); // mobs and the boss both feed the shared habit profile
            app.memory.journey.time += DT;
        }
        if (this.mode === "intro" || this.mode === "fight") {
            this.brain.observe(events, DT);
            this.fightTime += DT;
        }
        this.react(events);
        this.footsteps();
    }

    inArena() {
        return this.sim.bounds.minX >= this.area.arenaLeft;
    }

    updateMode() {
        const app = this.app;
        const sim = this.sim;
        const p = sim.player;
        const area = this.area;
        this.prompt = null;

        if (this.mode === "explore") {
            if (p.state === "dead") {
                this.setMode("dying");
                return;
            }
            const tablet = area.inscriptions.find((ins) => nearX(area, p.x, ins.x));
            const key = actionKeyLabel(app.controls, "interact");
            if (nearX(area, p.x, area.shrineX) && p.state !== "rest") {
                this.prompt = sim.threatsNear(REST_BLOCK_RANGE).length ? "Enemies are near" : `[${key}] Rest at the shrine`;
            } else if (tablet) this.prompt = `[${key}] Read`;
            else if (nearVeil(area, p.x)) this.prompt = `[${key}] Pass through the veil`;
            if (actionPressed(this.input, app.controls, "interact") && p.grounded) {
                if (nearX(area, p.x, area.shrineX) && p.state !== "rest") {
                    if (!sim.threatsNear(REST_BLOCK_RANGE).length) this.rest();
                } else if (tablet) {
                    const ins = INSCRIPTIONS[tablet.id];
                    // Inscriptions name keys as {action}; show the player's chosen keys (BRD 2.2.2.8).
                    this.reading = ins ? { ...ins, text: ins.text.replace(/\{(\w+)\}/g, (_, id) => actionKeyLabel(app.controls, id)) } : null;
                    if (this.reading) app.audio.play("tablet");
                } else if (nearVeil(area, p.x)) {
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
        } else if (this.mode === "victory" && this.modeTime > 1.8) {
            const defeat = area.cutscenes.defeat;
            if (defeat) this.playCutscene(defeat, () => this.setMode("card"));
            else this.setMode("card");
        } else if (this.mode === "card") {
            if ((this.modeTime > 3.5 && anyKeyPressed(this.input)) || this.modeTime > 8) {
                if (this.fadeTarget !== 1) this.fadeTo(1, 2);
            }
            if (this.fadeTarget === 1 && this.fade >= 1) app.go("memory", { from: "victory", bossId: this.bossId });
        }
    }

    rest() {
        const app = this.app;
        const sim = this.sim;
        sim.rest();
        sim.respawnMobs();
        this.rebuildMobActors();
        app.habits.startAttempt();
        app.audio.play("shrineRest");
        for (let i = 0; i < 3; i++) this.fx.spawn("healMotes", sim.player.x, sim.player.y - 10);
        app.saveMemory();
    }

    enterArena() {
        const app = this.app;
        const sim = this.sim;
        const area = this.area;
        sim.player.x = area.arenaEntryX;
        sim.player.vx = 0;
        sim.player.facing = 1;
        sim.setBounds(area.arena);
        app.record(this.bossId).attempts += 1;
        const j = app.memory.journey;
        j.attempts[this.bossId] = (j.attempts[this.bossId] ?? 0) + 1;
        this.brain.startAttempt();
        app.saveMemory();
        this.fightTime = 0;
        this.camera.position.x = arenaCameraX(area);
        const intro = area.cutscenes.intro;
        if (intro && !j.seen.includes(intro)) {
            this.playCutscene(intro, () => {
                app.playMusic(this.bossId, 1); // the boss theme starts with the fight
                sim.player.x = this.player.position.x;
                sim.player.facing = 1;
                sim.boss.state = "ready"; // the cutscene already showed it rising
                sim.boss.stateTime = 0;
                this.setMode("fight");
            });
        } else {
            sim.wakeBoss();
            this.setMode("intro");
            this.fadeTo(0, 2.5);
            app.playMusic(this.bossId, 1.5);
        }
    }

    finishAttempt(outcome) {
        const app = this.app;
        const summary = this.brain.endAttempt();
        const r = app.record(this.bossId);
        if (outcome === "playerDead") r.deaths += 1;
        if (outcome === "bossDead") r.victories += 1;
        if (outcome === "quit") r.quits += 1;
        return summary;
    }

    loseFight() {
        const app = this.app;
        const inFight = this.inArena();
        const summary = inFight ? this.finishAttempt("playerDead") : { moveStats: {} };
        this.lesson = attemptLesson({ counters: app.habits.attemptCounters(), moveStats: summary.moveStats, bossDef: inFight ? this.bossDef : null });
        app.memory.journey.falls += 1;
        app.memory.stats.falls += 1;
        app.saveMemory();
        this.setMode("fallen");
        app.playMusic(this.area.music, 3);
    }

    winFight() {
        const app = this.app;
        this.finishAttempt("bossDead");
        const j = app.memory.journey;
        if (!j.defeated.includes(this.bossId)) j.defeated.push(this.bossId);
        if (this.area.next && AREAS[this.area.next]) j.area = this.area.next;
        else j.awaitingEnding = true; // the last boss: the ending plays after the memory screen (BRD 2.2.6)
        app.saveMemory();
        this.setMode("victory");
        app.playMusic(this.area.music, 3); // the fight is over: back to the area's theme
        this.shake(6, 0.6);
        if (this.area.cutscenes.defeat && this.boss.has("kneel")) this.boss.play("kneel");
    }

    respawn() {
        const sim = this.sim;
        const area = this.area;
        sim.resetAttempt({ playerX: area.shrineX + 6 });
        sim.setBounds(area.approach);
        sim.rest();
        this.rebuildMobActors();
        for (const actor of this.hazardActors.values()) this.removeEntity(actor);
        this.hazardActors.clear();
        this.setBossPhase(1);
        this.bossLine = null;
        this.camera.position.x = approachCameraX(area, sim.player.x);
        this.app.habits.startAttempt();
        this.setMode("explore");
        this.fadeTo(0, 1.2);
        this.app.playMusic(area.music);
    }

    tickReading() {
        const menu = menuInput(this.input);
        if (menu.back || menu.confirm || actionPressed(this.input, this.app.controls, "interact")) {
            this.reading = null;
            this.app.audio.play("uiBack");
        }
    }

    tickPause() {
        const app = this.app;
        const menu = menuInput(this.input);
        if (this.pauseControls) {
            if (this.controlsPanel.tick(this.input)) this.pauseControls = false;
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
        else if (this.pauseIndex === 1) {
            this.controlsPanel = createControlsPanel(app);
            this.pauseControls = true;
        }
        else {
            if (this.mode === "intro" || this.mode === "fight") this.finishAttempt("quit");
            app.saveMemory();
            app.go("title");
        }
    }

    recordHistory() {
        const snap = this.player.snapshot();
        if (!snap) return;
        this.history.push(snap);
        if (this.history.length > ECHO_LAG_FRAMES) this.history.shift();
    }

    // ----- feedback: effects, sound, shake -----

    react(events) {
        const audio = this.app.audio;
        const fx = this.fx;
        const sim = this.sim;
        const p = sim.player;
        const b = sim.boss;
        const accent = b.phase === 2 ? COLORS.magenta : COLORS.cyan;
        for (const e of events) {
            const actor = e.uid !== undefined ? this.actorFor(e.uid) : null;
            const source = e.uid !== undefined ? sim.enemyByUid(e.uid) : null;
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
                    fx.spawn("dust", e.x, this.area.floorY);
                    break;
                case "playerHit":
                    audio.play("hitPlayer");
                    fx.spawn("ink", e.x, e.y, { dir: Math.sign(p.x - (source?.x ?? p.x)) || 1 });
                    this.player.flash = 1;
                    this.hitstop = Math.max(this.hitstop, 4);
                    this.shake(3, 0.2);
                    break;
                case "playerDeath":
                    audio.play("playerDeath");
                    this.hitstop = 10;
                    this.shake(5, 0.4);
                    break;
                case "enemyHit":
                    audio.play(e.critical ? "critical" : "hitBoss", { pitch: e.kind === "heavy" ? 0.85 : e.isBoss ? 1 : 1.2 });
                    fx.spawn("glass", e.x, e.y, { color: e.isBoss ? accent : COLORS.cyan, dir: p.facing, count: e.critical ? 3 : 1 });
                    if (actor) actor.flash = 1;
                    this.hitstop = Math.max(this.hitstop, e.critical ? 9 : e.kind === "heavy" ? 5 : 2);
                    if (e.critical || e.kind === "heavy") this.shake(e.critical ? 6 : 3, 0.25);
                    break;
                case "enemyBlocked":
                    audio.play("shieldBlock");
                    fx.spawn("sparks", e.x, e.y, { dir: -p.facing });
                    if (actor?.has("block")) actor.flash = 0.6;
                    break;
                case "guardBreak":
                    audio.play("guardBreak");
                    fx.spawn("glass", e.x, e.y, { color: COLORS.cyan, count: 2 });
                    this.shake(2, 0.15);
                    break;
                case "enemyDeath":
                    if (e.isBoss) {
                        audio.play("bossDeath");
                        for (let i = 0; i < 4; i++) fx.spawn("glass", e.x, e.y - i * 8, { color: accent, count: 3 });
                    } else {
                        audio.play("glassBreak");
                        fx.spawn("glass", e.x, e.y, { color: COLORS.cyan, count: 2 });
                    }
                    break;
                case "parry":
                    audio.play("parry");
                    fx.spawn("sparks", e.x, e.y, { dir: p.facing });
                    this.hitstop = Math.max(this.hitstop, 7);
                    this.shake(3, 0.2);
                    break;
                case "enemyWindup":
                    if (!e.isBoss && source?.def.id === "shardling") audio.play("shardlingLeap", { volume: 0.6 });
                    else audio.play(e.telegraph === "unparryable" ? "bossWindupRed" : "bossWindup", { volume: e.isBoss ? 1 : 0.6 });
                    if (e.telegraph === "parryable" && actor) actor.flash = 0.55;
                    break;
                case "enemySwing":
                    if (e.isBoss) {
                        audio.play("bossSwing");
                        fx.spawn("slash", b.x + b.facing * 30, b.y - 30, { dir: b.facing, radius: this.bossId === "squire" ? 26 : 34, color: this.bossId === "squire" ? IVORY : accent });
                    } else if (source?.def.id === "sentinel") {
                        audio.play(e.id === "bash" ? "shieldBash" : "spearThrust");
                    }
                    break;
                case "shockwave":
                    audio.play("slam");
                    audio.play("shockwave", { volume: 0.8 });
                    fx.spawn("shockDust", e.x, this.area.floorY);
                    this.shake(5, 0.3);
                    break;
                case "shardThrow":
                    audio.play(e.uid === b.uid ? "shardThrow" : "archerThrow", { volume: e.uid === b.uid ? 1 : 0.7 });
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
                    fx.spawn("glass", e.x, this.area.floorY - 4, { color: accent });
                    this.shake(2, 0.12);
                    break;
                case "enemyLeap":
                    if (e.isBoss) audio.play("leap");
                    break;
                case "enemyLand":
                    if (e.isBoss) {
                        audio.play("land");
                        fx.spawn("shockDust", e.x, this.area.floorY);
                        this.shake(4, 0.25);
                    } else {
                        fx.spawn("dust", e.x, this.area.floorY);
                    }
                    break;
                case "enemyActionStart":
                    if (e.isBoss && (e.id === "mimicRoll" || e.id === "rollThrough" || e.id === "rollAway")) audio.play("bossRoll");
                    if (e.isBoss && e.id === "shatterStep") audio.play("vanish");
                    if (e.isBoss && e.id === "mirrorVolley") audio.play("volley");
                    break;
                case "deflected":
                    audio.play("deflected");
                    fx.spawn("sparks", e.x, e.y, { dir: -p.facing });
                    this.hitstop = Math.max(this.hitstop, 6);
                    this.shake(3, 0.2);
                    break;
                case "enemyDrink":
                    audio.play("drink");
                    break;
                case "enemyHeal":
                    for (let i = 0; i < 4; i++) fx.spawn("healMotes", b.x, b.y - 14, { color: COLORS.cyan });
                    break;
                case "enemyHealCancel":
                    audio.play("healCancel");
                    break;
                case "enemyAppear":
                    audio.play("appear");
                    fx.spawn("glass", e.x, e.y, { color: COLORS.cyan, count: 2 });
                    break;
                case "grabbed":
                    audio.play("grasp");
                    break;
                case "stagger":
                    audio.play("stagger");
                    this.shake(4, 0.3);
                    break;
                case "phase2Start": {
                    audio.play("phase2");
                    this.shake(6, 1.2);
                    this.app.audio.music.setPhase(2);
                    const line = BOSS_LINES[this.bossId]?.phase2;
                    if (line) this.bossLine = { text: line, t: 0 };
                    break;
                }
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
        const holdDefeatPose = this.mode === "victory" && this.area.cutscenes.defeat;
        if (!holdDefeatPose) syncEnemy(this.boss, b);
        for (const m of sim.mobs) {
            const actor = this.mobActors.get(m.uid);
            if (!actor) continue;
            syncEnemy(actor, m);
            this.applyTelegraph(actor, m, dt);
        }
        this.player.flash = Math.max(0, this.player.flash - dt * 6);
        this.boss.flash = Math.max(0, this.boss.flash - dt * 5);
        this.applyTelegraph(this.boss, b, dt);
        if (b.state === "transition" && b.stateTime > (b.def.phase2?.transitionTime ?? 0) / 2 && this.bossPhaseShown !== 2) this.setBossPhase(2);
        this.boss.glowBlur = b.state === "staggered" ? 2 : 5;
        this.syncHazards();
    }

    applyTelegraph(actor, e, dt) {
        const stage = e.action ? e.action.def.stages[e.action.stageIndex] : null;
        const warning = stage && (stage.part === "windup" || stage.part === "hold") && stage.telegraph === "unparryable";
        actor.flashRed = warning ? 0.35 + 0.25 * Math.sin(this.time * 30) : Math.max(0, actor.flashRed - dt * 4);
        if (actor !== this.boss) actor.flash = Math.max(0, actor.flash - dt * 6);
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
            actor.position.y = h.kind === "shard" ? h.y : this.area.floorY + (h.kind === "rain" ? 3 : 0);
            actor.flipX = (h.dir ?? 1) < 0;
            if (actor.falling) {
                const left = h.impactAt - h.t;
                actor.falling.alpha = left < 0.3 ? 1 : 0;
                actor.falling.position.x = h.x;
                actor.falling.position.y = this.area.floorY - Math.max(0, left / 0.3) * 220;
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
        const area = this.area;
        const target = this.inArena() ? arenaCameraX(area) : approachCameraX(area, this.sim.player.x);
        const cam = this.camera.position;
        cam.x += (target - cam.x) * 0.15;
        if (Math.abs(target - cam.x) < 0.5) cam.x = target;
        cam.y = 0;
        this.camera.zoom = 1;
    }

    // ----- drawing -----

    drawBackground(ctx) {
        this.renderer.drawBackground(ctx, this.camera.position.x);
    }

    drawWorldBack(ctx) {
        const sealed = this.inArena() && (this.mode === "intro" || this.mode === "fight" || this.mode === "dying" || this.mode === "cutscene");
        this.renderer.drawBack(ctx, this.camera.position.x, { sealed });
        this.drawPaneReflections(ctx);
        if (this.area.reflectiveFloor) {
            const floorY = this.area.floorY;
            for (const actor of [this.player, this.boss, ...this.mobActors.values()]) actor.renderFloorReflection(ctx, floorY, 0.22);
        }
    }

    // The Hall's mirror panes show the knight; during the Hall entry the reflection lags behind (BRD 2.2.12.2).
    drawPaneReflections(ctx) {
        const pane = this.app.art.props?.mirrorPane;
        if (!pane || !this.area.mirrorPanes || this.history.length === 0) return;
        const glass = pane.glass ?? { x: 4, y: 4, w: (pane.sprite?.width ?? pane.frameWidth) - 8, h: (pane.sprite?.height ?? pane.frameHeight) - 8 };
        const w = pane.sprite?.width ?? pane.frameWidth;
        const h = pane.sprite?.height ?? pane.frameHeight;
        const lagFrames = Math.min(this.history.length - 1, Math.round(this.echoLag * 60));
        const snap = this.history[this.history.length - 1 - lagFrames];
        for (const x of this.area.mirrorPanes) {
            if (Math.abs(snap.x - x) > 70) continue;
            const left = Math.round(x - w / 2) + glass.x;
            const top = this.area.floorY - h + glass.y;
            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, glass.w, glass.h);
            ctx.clip();
            ctx.globalAlpha = 0.6;
            // Kept near the pane's centre (moving only a little with the knight) so the knight never hides it.
            ctx.translate(Math.round(x + (snap.x - x) * 0.2), Math.round(snap.y - 8));
            if (!snap.flipX) ctx.scale(-1, 1); // a mirror faces the knight back
            ctx.drawImage(snap.texture, snap.sx, snap.sy, snap.sw, snap.sh, -snap.ax, -snap.ay, snap.dw, snap.dh);
            ctx.restore();
        }
    }

    // The ending's dawn: the Keep at sunrise and the knight over a puddle whose reflection moves with them.
    drawDawn(ctx) {
        const art = this.app.art;
        const bg = art.backgrounds?.dawnBackdrop;
        if (bg) ctx.drawImage(bg, 0, 0);
        else {
            ctx.fillStyle = "#e9b98a";
            ctx.fillRect(0, 0, 480, 270);
        }
        const puddle = art.props?.puddle;
        const floorY = 214;
        if (puddle?.sprite) ctx.drawImage(puddle.sprite, 240 - puddle.sprite.width / 2, floorY - 1);
        const snap = this.player.snapshot();
        if (!snap) return;
        const standing = { ...snap, x: 240, y: floorY };
        ctx.save();
        ctx.translate(240, floorY);
        if (snap.flipX) ctx.scale(-1, 1);
        ctx.drawImage(snap.texture, snap.sx, snap.sy, snap.sw, snap.sh, -snap.ax, -snap.ay, snap.dw, snap.dh);
        ctx.restore();
        this.player.renderFloorReflection(ctx, floorY, 0.45, standing); // the reflection moves exactly with the knight
    }

    drawWorldFront(ctx) {
        this.fx.draw(ctx);
        for (const m of this.sim.mobs) {
            if (m.state === "dead" || m.hp >= m.maxHp) continue;
            drawMobBar(ctx, m.x, m.y - m.def.height - 8, m.hp / m.maxHp);
        }
    }

    drawOverlay(ctx) {
        if (this.dawn) this.drawDawn(ctx);
        if (this.mode === "cutscene") {
            this.cutscene.runner.draw(ctx);
            return;
        }
        const sim = this.sim;
        const p = sim.player;
        const b = sim.boss;
        const showBoss = this.inArena() && (this.mode === "fight" || this.mode === "dying" || (this.mode === "intro" && this.modeTime > 1));
        drawHud(ctx, {
            player: { hp: p.hp, maxHp: p.maxHp, stamina: p.stamina, maxStamina: p.maxStamina, heals: p.heals, maxHeals: p.maxHeals, staminaEmpty: p.staminaEmpty },
            boss: showBoss ? { name: this.bossDef.name, hp: b.hp, maxHp: b.maxHp, phase: b.phase, stagger: b.stagger, maxStagger: b.maxStagger } : null,
            prompt: this.paused || this.reading ? null : this.prompt,
        });
        if (showBoss && this.bossLine && this.bossLine.t < 3.5) {
            ctx.globalAlpha = Math.min(1, this.bossLine.t / 0.3, (3.5 - this.bossLine.t) / 0.5);
            drawText(ctx, `"${this.bossLine.text}"`, 240, 236, { align: "center", color: COLORS.cyan });
            ctx.globalAlpha = 1;
        }

        if (this.mode === "intro") this.drawNameCard(ctx);
        if (this.mode === "fallen") this.drawFallen(ctx);
        if (this.mode === "card") this.drawVictory(ctx);
        if (this.reading) drawInscription(ctx, this.reading);
        if (this.paused) this.drawPause(ctx);
    }

    drawNameCard(ctx) {
        const t = this.modeTime;
        const alpha = Math.min(1, t / 0.6) * Math.min(1, Math.max(0, (3 - t) / 0.6));
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        drawText(ctx, this.bossDef.name.toUpperCase(), 240, 92, { align: "center", scale: 3, color: COLORS.text });
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
        const attempts = this.app.memory.journey.attempts[this.bossId] ?? 0;
        drawText(ctx, this.inArena() ? `Attempt ${attempts} against ${this.bossDef.name}` : this.area.name, 240, 132, { align: "center", color: COLORS.dim });
        ctx.globalAlpha = Math.min(1, Math.max(0, (t - 1.2) / 0.8));
        wrapText(this.lesson, 360).forEach((line, i) => drawText(ctx, line, 240, 152 + i * 12, { align: "center", color: COLORS.cyan }));
        ctx.globalAlpha = 1;
    }

    drawVictory(ctx) {
        const t = this.modeTime;
        ctx.globalAlpha = Math.min(0.6, t / 1.5);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 480, 270);
        ctx.globalAlpha = Math.min(1, t / 1);
        drawText(ctx, "REFLECTION BROKEN", 240, 90, { align: "center", scale: 3, color: COLORS.gold });
        const attempts = this.app.memory.journey.attempts[this.bossId] ?? 0;
        drawText(ctx, `${this.bossDef.name}     Attempts ${attempts}     Fight time ${formatTime(this.fightTime)}`, 240, 128, { align: "center", color: COLORS.text });
        if (this.modeTime > 3.5) drawText(ctx, "Press any key", 240, 160, { align: "center", color: COLORS.dim });
        ctx.globalAlpha = 1;
    }

    drawPause(ctx) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 480, 270);
        ctx.globalAlpha = 1;
        if (this.pauseControls) {
            this.controlsPanel.draw(ctx, 44);
            return;
        }
        drawPanel(ctx, 170, 90, 140, 80);
        drawText(ctx, "PAUSED", 240, 100, { align: "center", color: COLORS.gold });
        drawMenu(ctx, PAUSE_ITEMS, this.pauseIndex, 190, 120);
    }
}
