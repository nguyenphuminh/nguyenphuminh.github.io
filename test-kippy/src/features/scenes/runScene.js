import { Scene } from "../../shared/kippy.js";
import { view } from "../../shared/view.js";
import { pick } from "../../shared/math.js";
import { sfx } from "../../shared/audio.js";
import { createGround, updateGround } from "../world/ground.js";
import { createFxState, updateFx, fadeOverlays, shakeOffset, drawWorldFx, drawScreenFx, drawBanners, banner, flash, shake, spawnFx, damageNumber } from "../effects/effects.js";
import { createPlayer, updatePlayer, computeStats } from "../player/player.js";
import { addTechnique, updateTechniques, TECH_BY_ID } from "../techniques/techniques.js";
import { canEvolve, evolveTechnique } from "../techniques/evolutions.js";
import { updateProjectiles } from "../techniques/projectile.js";
import { updateEnemies, updateEnemyShots, damageEnemy } from "../enemies/enemy.js";
import { enemiesInRadius } from "../enemies/query.js";
import { createSpawner, updateSpawner } from "../enemies/spawner.js";
import { updatePickups } from "../progression/pickups.js";
import { rollChoices, applyChoice, chestChoice, choiceInfo } from "../progression/levelup.js";
import { REALMS, realmIndex, qiToNext } from "../progression/realms.js";
import { drawHud } from "../hud/hud.js";
import { drawLevelUp, drawPause, drawResults, menuInput } from "../hud/menus.js";
import { recordRun } from "../stages/progress.js";
import { updateHazards, drawHazardFx } from "../stages/hazards.js";
import { createWeather, drawWeather } from "../stages/weather.js";
import { handleGlobalKeys } from "./controls.js";

// While a menu is open the world must stand still, so Kippy's physics step is
// swapped for this no-op (the game loop calls scene.physics.update every tick).
const FROZEN_PHYSICS = { update() {} };

const byDepth = (a, b) => (a.z ?? 3) - (b.z ?? 3) || a.position.y - b.position.y;

export class RunScene extends Scene {
    constructor(character, stage, onExit) {
        super();
        this.character = character;
        this.stage = stage;
        this.onExit = onExit;
    }

    init() {
        this.state = "play";
        this.time = 0;
        this.kills = 0;
        this.enemies = [];
        this.projectiles = [];
        this.enemyShots = [];
        this.pickups = [];
        this.timers = [];
        this.dirty = false;
        this.boss = null;
        this.finalPhase = false;
        this.miasmaTimer = 0;
        this.pendingLevels = 0;
        this.pendingBreakthrough = false;
        this.menu = null;
        this.fx = createFxState();
        this.livePhysics = this.physics;

        this.ground = createGround(this, this.stage);
        this.weather = createWeather(this.stage.weather);
        this.player = createPlayer(this, this.character);
        addTechnique(this, this.player, TECH_BY_ID[this.character.start]);
        this.spawner = createSpawner();
        banner(this, this.stage.name, `${this.character.name} ${this.stage.intro}`, "#f0c24b", 3.2);

        // Losing focus opens the pause screen instead of letting the horde win.
        this.onBlur = () => {
            if (this.state === "play") this.openPause();
        };
        window.addEventListener("blur", this.onBlur);
    }

    exit() {
        window.removeEventListener("blur", this.onBlur);
    }

    // Entities are flagged and swept once per tick: Kippy's removeEntity filters
    // the whole array per call, which is costly when dozens die at once.
    remove(entity) {
        if (entity && !entity.dead) {
            entity.dead = true;
            this.dirty = true;
        }
    }

    later(delay, fn) {
        this.timers.push({ t: delay, fn });
    }

    hpMul() {
        const d = this.stage.difficulty;
        return d.hpBase * (1 + (this.time / 60) * 0.16 * d.hpGrowth);
    }

    sweep() {
        if (!this.dirty) return;
        this.dirty = false;
        const alive = e => !e.dead;
        this.entities = this.entities.filter(alive);
        this.enemies = this.enemies.filter(alive);
        this.projectiles = this.projectiles.filter(alive);
        this.enemyShots = this.enemyShots.filter(alive);
        this.pickups = this.pickups.filter(alive);
    }

    freeze(on) {
        this.physics = on ? FROZEN_PHYSICS : this.livePhysics;
    }

    animationUpdate(dt) {
        if (this.state === "play") super.animationUpdate(dt);
    }

    update(dt) {
        const input = this.game.input;
        handleGlobalKeys(input);
        this.sweep();
        if (this.state === "play") this.updatePlay(dt, input);
        else if (this.state === "levelup") this.updateLevelUp(dt, input);
        else if (this.state === "paused") this.updatePause(input);
        else this.updateResults(dt, input);
        if (this.state === "levelup" || this.state === "paused") fadeOverlays(this.fx, dt);
    }

    updatePlay(dt, input) {
        // Touch players have no Esc key: tapping the timer pauses too.
        const tappedTimer = input.isPointerPressed(0) && Math.abs(input.pointer.x - view.w / 2) < 34 && input.pointer.y < 32;
        if (input.isKeyPressed("Escape") || input.isKeyPressed("KeyP") || tappedTimer) {
            this.openPause();
            return;
        }
        this.time += dt;
        const [mx, my] = this.autopilot ? this.autopilot(this) : readMove(input, this);
        const onIce = updateHazards(this, dt);
        updatePlayer(this.player, dt, mx, my, onIce);
        updateTechniques(this.player, dt);
        updateSpawner(this, dt);
        updateEnemies(this, dt);
        updateProjectiles(this, dt);
        updateEnemyShots(this, dt);
        updatePickups(this, dt);
        this.updateTimers(dt);
        updateFx(this, dt);
        if (this.state === "play" && this.pendingLevels > 0) this.openLevelUp();
    }

    updateTimers(dt) {
        if (!this.timers.length) return;
        const due = [];
        this.timers = this.timers.filter(t => ((t.t -= dt) <= 0 ? (due.push(t), false) : true));
        for (const t of due) t.fn();
    }

    gainQi(value) {
        const p = this.player;
        p.qi += value * p.stats.growth;
        while (p.qi >= p.qiNext) {
            p.qi -= p.qiNext;
            p.level++;
            p.qiNext = qiToNext(p.level);
            this.pendingLevels++;
            if (realmIndex(p.level) > p.realm) this.pendingBreakthrough = true;
        }
    }

    openLevelUp() {
        this.pendingLevels--;
        this.openMenu(rollChoices(this.player), "Enlightenment", "Choose the path of your cultivation");
        sfx.levelUp();
    }

    openChest() {
        // A ready evolution always takes priority over a plain upgrade.
        const ready = this.player.techniques.filter(t => canEvolve(this.player, t));
        if (ready.length) {
            const into = evolveTechnique(this, this.player, pick(ready));
            banner(this, "Evolution!", into.name, "#f0c24b", 3.2);
            flash(this, 0.7, "#fff6a8");
            shake(this, 4, 0.4);
            sfx.breakthrough();
            return;
        }
        const choice = chestChoice(this.player);
        applyChoice(this, choice);
        const info = choiceInfo(choice);
        banner(this, "Spirit Chest", info.tag ? `${info.name} ${info.tag}` : info.name, "#f0c24b", 2.4);
        flash(this, 0.4, "#f0c24b");
        sfx.levelUp();
    }

    openMenu(choices, title, subtitle) {
        this.menu = { choices, title, subtitle, selected: 0, wait: 0.3, rects: [] };
        this.state = "levelup";
        this.freeze(true);
    }

    updateLevelUp(dt, input) {
        this.menu.wait -= dt;
        if (this.autopilot) {
            if (this.menu.wait <= 0) this.choose(this.autopick ? this.autopick(this.menu.choices) : Math.floor(Math.random() * this.menu.choices.length));
            return;
        }
        const i = menuInput(input, this.menu);
        if (i >= 0) this.choose(i);
    }

    choose(i) {
        applyChoice(this, this.menu.choices[i]);
        sfx.select();
        this.menu = null;
        if (this.pendingLevels > 0) {
            this.openLevelUp();
            return;
        }
        this.state = "play";
        this.freeze(false);
        if (this.pendingBreakthrough) this.breakthrough();
    }

    breakthrough() {
        this.pendingBreakthrough = false;
        const p = this.player, { x, y } = p.position;
        p.realm = realmIndex(p.level);
        computeStats(p);
        p.hp = p.stats.maxHp;
        p.glowTimer = 3;
        spawnFx(this, "breakthrough", x, y, { z: 6 });
        for (const e of enemiesInRadius(this, x, y, 130)) damageEnemy(this, e, 60 + 40 * p.realm, { kb: 300, fromX: x, fromY: y, stun: 0.5 });
        const realm = REALMS[p.realm];
        banner(this, "Breakthrough!", `You have reached ${realm.name}`, realm.color, 3);
        flash(this, 0.6, "#fff6a8");
        shake(this, 4, 0.5);
        sfx.breakthrough();
    }

    hurtPlayer(amount) {
        const p = this.player;
        if (this.state !== "play" || p.hurtCd > 0 || this.god) return;
        const dmg = Math.max(1, Math.round(amount - p.stats.armor));
        p.hp -= dmg;
        p.hurtCd = 0.5;
        p.flash = 0.15;
        this.fx.hurt = 0.3;
        damageNumber(this, p.position.x, p.position.y - 14, dmg, "#ff6b6b");
        shake(this, 2, 0.15);
        sfx.hurt();
        if (p.hp <= 0) this.finish(false);
    }

    // Hazard damage (miasma) drains HP directly: no armor and no invulnerability
    // frames, so standing in poison can't be used to shrug off the horde.
    drainPlayer(amount) {
        const p = this.player;
        if (this.state !== "play" || this.god) return;
        p.hp -= amount;
        damageNumber(this, p.position.x, p.position.y - 14, amount, "#9be36b");
        if (p.hp <= 0) this.finish(false);
    }

    win() {
        if (this.state === "play") this.finish(true);
    }

    finish(won) {
        this.player.hp = Math.max(0, this.player.hp);
        this.state = won ? "won" : "dead";
        this.resultTime = 0;
        this.freeze(true);
        this.saveRecord(won);
        if (won) {
            flash(this, 1, "#fff6a8");
            sfx.victory();
        } else {
            sfx.gameOver();
        }
    }

    saveRecord(won) {
        const p = this.player;
        const result = recordRun(this.stage.id, this.character.id, { time: this.time, kills: this.kills, level: p.level, realm: p.realm, won });
        this.newRecord = result.newRecord;
        this.unlockedStage = result.unlocked;
    }

    openPause() {
        this.state = "paused";
        this.freeze(true);
    }

    updatePause(input) {
        if (input.isKeyPressed("Escape") || input.isKeyPressed("KeyP") || input.isPointerPressed(0)) {
            this.state = "play";
            this.freeze(false);
        } else if (input.isKeyPressed("KeyQ")) {
            this.finish(false);
        }
    }

    updateResults(dt, input) {
        this.resultTime += dt;
        updateFx(this, dt);
        if (this.resultTime > 1.2 && (input.isKeyPressed("Enter") || input.isKeyPressed("Space") || input.isPointerPressed(0))) {
            this.onExit();
        }
    }

    render() {
        this.sweep();
        const ctx = this.game.ctx, cam = this.camera, p = this.player;
        const [sx, sy] = shakeOffset(this.fx);
        // Kippy's camera position is the top-left corner of the view.
        cam.position.x = Math.round(p.position.x - view.w / 2) + sx;
        cam.position.y = Math.round(p.position.y - view.h / 2) + sy;
        updateGround(this.ground, cam);
        this.entities.sort(byDepth);
        ctx.imageSmoothingEnabled = false;
        super.render();

        ctx.save();
        ctx.translate(-cam.position.x, -cam.position.y);
        if (this.stage.hazard) drawHazardFx(ctx, this, cam.position.x, cam.position.y, cam.position.x + view.w, cam.position.y + view.h);
        drawWorldFx(ctx, this);
        ctx.restore();
        drawWeather(ctx, this.weather, cam.position, this.state === "play" ? 1 / 60 : 0);
        if (this.finalPhase) {
            ctx.fillStyle = this.stage.finalTint;
            ctx.fillRect(0, 0, view.w, view.h);
        }
        drawScreenFx(ctx, this);
        drawHud(ctx, this);
        drawBanners(ctx, this);
        if (this.state === "levelup") drawLevelUp(ctx, this);
        else if (this.state === "paused") drawPause(ctx, this);
        else if (this.state === "dead" || this.state === "won") drawResults(ctx, this);
    }
}

// WASD/arrows, or hold the mouse/finger where you want to walk.
function readMove(input, scene) {
    let x = 0, y = 0;
    if (input.isKeyDown("KeyA") || input.isKeyDown("ArrowLeft")) x -= 1;
    if (input.isKeyDown("KeyD") || input.isKeyDown("ArrowRight")) x += 1;
    if (input.isKeyDown("KeyW") || input.isKeyDown("ArrowUp")) y -= 1;
    if (input.isKeyDown("KeyS") || input.isKeyDown("ArrowDown")) y += 1;
    if (!x && !y && input.isPointerDown(0)) {
        const dx = input.pointer.x - (scene.player.position.x - scene.camera.position.x);
        const dy = input.pointer.y - (scene.player.position.y - scene.camera.position.y);
        if (Math.hypot(dx, dy) > 6) return [dx, dy];
    }
    return [x, y];
}
