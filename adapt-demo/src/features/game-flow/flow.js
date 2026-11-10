// Game flow: shared services (art, audio, brains, memory, journey) and scene switching.
import { buildArt, createAudio } from "../presentation/index.js";
import { BOSS_IDS, ENEMIES } from "../combat/index.js";
import {
    createBrain, createHabitProfile, forgetMemory, freshBossRecord, freshJourney, loadMemory, loadPolicy, saveMemory,
} from "../brain/index.js";
import { AREAS } from "../world/index.js";
import { LoadingScene } from "./scenes/loading.js";
import { TitleScene } from "./scenes/title.js";
import { WorldScene } from "./scenes/world.js";
import { MemoryScene } from "./scenes/memory.js";
import { CreditsScene } from "./scenes/credits.js";
import { actionKeyLabel, loadControls, saveControls } from "./controls.js";
import { createGamepad, padLabel } from "./gamepad.js";

const SCENES = { loading: LoadingScene, title: TitleScene, world: WorldScene, memory: MemoryScene, credits: CreditsScene };
const modelUrl = (bossId) => `./models/${bossId}.json`;

function safeStorage() {
    try {
        const s = window.localStorage;
        s.getItem("adapt.probe");
        return s;
    } catch {
        return null; // storage blocked: memory lasts for this session only
    }
}

async function fetchPolicy(bossId) {
    try {
        const res = await fetch(modelUrl(bossId), { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return loadPolicy(await res.json(), ENEMIES[bossId]);
    } catch (err) {
        console.warn(`Model for ${bossId} unavailable, falling back to online learning only:`, err);
        return null;
    }
}

const seed = () => (Date.now() % 2147483647) || 1;

export function createGameFlow(game) {
    const app = {
        game,
        art: null,
        audio: null,
        memory: null,
        habits: null,
        policies: {},
        brains: {},
        storage: safeStorage(),
        controls: null, // the player's chosen keys (BRD 2.2.2.8)
        pad: createGamepad(), // the controller (BRD 2.2.2.9)
        lastDevice: "keyboard", // hints name the buttons of the device used last

        /** The name of the key or button for an action, on the device used last. */
        hint(action) {
            if (app.lastDevice === "pad") return padLabel(app.pad.style, action);
            const fixed = { confirm: "Enter", back: "Esc", pause: "Esc" };
            return fixed[action] ?? actionKeyLabel(app.controls, action);
        },
        musicStarted: false,

        setControls(keys) {
            app.controls = keys;
            saveControls(app.storage, keys);
        },

        go(name, params) {
            game.setScene(new SCENES[name](app, params));
        },

        record(bossId) {
            app.memory.bosses[bossId] ??= freshBossRecord();
            return app.memory.bosses[bossId];
        },

        rebuildBrains() {
            app.habits = createHabitProfile(app.memory.habits);
            for (const id of BOSS_IDS) {
                app.brains[id] = createBrain({
                    bossDef: ENEMIES[id], habits: app.habits, policy: app.policies[id] ?? null,
                    online: app.memory.bosses[id]?.online ?? null, seed: seed(),
                });
            }
        },

        saveMemory() {
            app.memory.habits = app.habits.snapshot();
            for (const [id, brain] of Object.entries(app.brains)) {
                if (app.memory.bosses[id] || brain.snapshot().gN.some((n) => n > 0)) app.record(id).online = brain.snapshot();
            }
            saveMemory(app.storage, app.memory);
        },

        forget() {
            app.memory = forgetMemory(app.storage);
            app.rebuildBrains();
        },

        get journey() {
            return app.memory.journey;
        },

        journeyInProgress: () => app.memory.journey.started && !app.memory.journey.completed,

        /** A new journey resets progress but keeps everything the bosses learned (BRD 2.2.13). */
        startJourney() {
            app.memory.journey = { ...freshJourney(), started: true };
            app.saveMemory();
            app.go("world", { area: "outerWard", arrival: true });
        },

        continueJourney() {
            const j = app.memory.journey;
            if (j.awaitingEnding) app.go("world", { area: j.area, ending: true });
            else app.go("world", { area: j.area });
        },

        /** The boss the player will face next (shown on the title screen). */
        nextBossId() {
            return app.journeyInProgress() ? AREAS[app.memory.journey.area].bossId : AREAS.outerWard.bossId;
        },

        /** Music starts after the player's first key press (browsers block sound before it), then never stops. */
        startMusic() {
            if (app.musicStarted) return;
            app.musicStarted = true;
            app.audio.music.play("title");
        },

        /** Crossfades to a track (BRD 2.2.8). Scenes that call this are only reached after a key press. */
        playMusic(name, fade = 2) {
            app.musicStarted = true;
            app.audio.music.play(name, { fade });
        },

        loadingSteps() {
            return [
                ["Forging pixels", async () => { app.art = await buildArt(); }],
                ["Tuning strings", async () => { app.audio = await createAudio(game.audio); }],
                ["Waking the reflections", async () => {
                    const loaded = await Promise.all(BOSS_IDS.map(fetchPolicy));
                    BOSS_IDS.forEach((id, i) => { app.policies[id] = loaded[i]; });
                }],
                ["Recalling you", async () => {
                    app.controls = loadControls(app.storage);
                    app.memory = loadMemory(app.storage);
                    app.rebuildBrains();
                }],
            ];
        },
    };

    return {
        app,
        start() {
            game.start();
            app.go("loading");
        },
    };
}
