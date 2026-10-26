import { CHARACTERS } from "../player/characters.js";
import { STAGE_BY_ID } from "../stages/stages.js";
import { RunScene } from "../scenes/runScene.js";
import { skipEventsBefore } from "../enemies/spawner.js";
import { killEnemy } from "../enemies/enemy.js";
import { TECH_BY_ID, addTechnique } from "../techniques/techniques.js";
import { TREASURE_BY_ID } from "../treasures/treasures.js";
import { computeStats } from "../player/player.js";
import { evolutionOf } from "../techniques/evolutions.js";
import { hazardsIn } from "../stages/hazards.js";

// Developer console helpers (only loaded with ?debug). `simulate` steps the
// scene exactly the way Kippy's Game.loop does, just without waiting for time.
const STEP = 1 / 60;

export function installDebug(game, startRun) {
    const run = () => (game.scene instanceof RunScene ? game.scene : null);

    const summary = () => {
        const s = run();
        if (!s) return { scene: game.scene?.constructor.name };
        const p = s.player;
        return {
            stage: s.stage.id, state: s.state, time: Math.round(s.time), kills: s.kills, level: p.level, realm: p.realm,
            hp: Math.round(p.hp), maxHp: p.stats.maxHp, enemies: s.enemies.length, entities: s.entities.length,
            pickups: s.pickups.length, techniques: p.techniques.map(t => `${t.def.id}:${t.level}`),
            treasures: p.treasures.map(t => `${t.def.id}:${t.level}`),
            boss: s.boss ? `${s.boss.def.id} ${Math.round(s.boss.hp)}/${Math.round(s.boss.maxHp)}` : null,
        };
    };

    window.__ia = {
        game,
        summary,
        start(id = "linFeng", stage = "wilds") {
            startRun(CHARACTERS.find(c => c.id === id), STAGE_BY_ID[stage]);
        },
        god(on = true) {
            run().god = on;
        },
        // draft: "random" (default) or "focus" (build around a few techniques and their evolution treasures).
        autopilot(on = true, draft = "random") {
            const s = run();
            s.autopilot = on ? steer : null;
            s.autopick = on && draft === "focus" ? choices => focusPick(s.player, choices) : null;
        },
        simulate(seconds) {
            const started = performance.now();
            for (let i = 0; i < seconds * 60; i++) {
                const s = game.scene;
                s.update(STEP);
                s.animationUpdate(STEP);
                s.physics.update(s.entities, STEP);
                game.input.update();
                if (s.state === "dead" || s.state === "won") break;
            }
            return { ...summary(), ms: Math.round(performance.now() - started) };
        },
        skipTo(t) {
            const s = run();
            s.time = t;
            skipEventsBefore(s, t);
        },
        // Grant a technique or treasure (by id) at a level, max by default.
        give(id, level) {
            const s = run(), p = s.player, tech = TECH_BY_ID[id], treasure = TREASURE_BY_ID[id];
            if (tech) {
                const inst = p.techniques.find(t => t.def === tech) ?? addTechnique(s, p, tech);
                inst.level = level ?? tech.maxLevel;
            } else if (treasure) {
                let t = p.treasures.find(tr => tr.def === treasure);
                if (!t) p.treasures.push((t = { def: treasure, level: 1 }));
                t.level = level ?? treasure.maxLevel;
                computeStats(p);
            }
            return summary();
        },
        killBoss() {
            const s = run();
            if (s.boss && !s.boss.dead) killEnemy(s, s.boss);
            return summary();
        },
        chest() {
            run().openChest();
            return summary();
        },
        levelUp(n = 1) {
            const s = run();
            for (let i = 0; i < n; i++) s.gainQi(s.player.qiNext - s.player.qi + 0.01);
        },
    };
}

function focusPick(p, choices) {
    const partners = new Set(p.techniques.map(t => evolutionOf(t.def)?.treasure).filter(Boolean));
    const score = c => {
        if (c.kind === "tech") return c.owned ? 10 + c.level : p.techniques.length < 4 ? 6 : 0;
        if (c.kind === "treasure") return partners.has(c.def.id) ? (c.owned ? 7 : 9) : c.owned ? 3 : 2;
        return 1;
    };
    let best = 0;
    choices.forEach((c, i) => { if (score(c) > score(choices[best])) best = i; });
    return best;
}

// Crude bot: avoids miasma, boss warning circles and shots, drifts around crowds
// instead of running straight away (like a player kiting), and goes for qi.
function steer(scene) {
    const p = scene.player.position;
    let fx = 0, fy = 0;
    const push = (x, y, range, weight) => {
        const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < range * range) {
            fx += (dx / d2) * weight;
            fy += (dy / d2) * weight;
        }
    };
    for (const e of scene.enemies) push(e.position.x, e.position.y, e.boss ? 110 : 55, e.boss ? 4 : 1);
    for (const s of scene.enemyShots) push(s.position.x, s.position.y, 50, 2);
    for (const h of scene.entities) if (h.warnRadius) push(h.position.x, h.position.y, h.warnRadius + 14, 14);
    // Walk around miasma like a player would; ice is only mildly avoided.
    for (const hz of hazardsIn(scene.stage, p.x - 120, p.y - 120, p.x + 120, p.y + 120)) push(hz.x, hz.y, hz.r + 18, hz.kind === "miasma" ? 10 : 2);
    // Rotate the escape direction ~35 degrees so the bot drifts around the horde.
    const c = Math.cos(0.6), s = Math.sin(0.6);
    [fx, fy] = [fx * c - fy * s, fx * s + fy * c];
    let best = null, bd = Infinity;
    for (const o of scene.pickups) {
        const d = Math.hypot(o.position.x - p.x, o.position.y - p.y);
        if (d < bd) { bd = d; best = o; }
    }
    if (best) {
        const pull = Math.hypot(fx, fy) < 0.03 ? 0.05 : 0.015;
        fx += ((best.position.x - p.x) / bd) * pull;
        fy += ((best.position.y - p.y) / bd) * pull;
    }
    return [fx, fy];
}
