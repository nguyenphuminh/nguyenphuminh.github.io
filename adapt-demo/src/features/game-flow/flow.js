// Game flow: shared services (art, audio, brain, memory) and scene switching.
import { buildArt, createAudio } from "../presentation/index.js";
import { createBrain, forgetMemory, loadMemory, loadPolicy, saveMemory } from "../brain/index.js";
import { LoadingScene } from "./scenes/loading.js";
import { TitleScene } from "./scenes/title.js";
import { WorldScene } from "./scenes/world.js";
import { MemoryScene } from "./scenes/memory.js";

const SCENES = { loading: LoadingScene, title: TitleScene, world: WorldScene, memory: MemoryScene };
const MODEL_URL = "./models/boss-policy.json";

function safeStorage() {
    try {
        const s = window.localStorage;
        s.getItem("adapt.probe");
        return s;
    } catch {
        return null; // storage blocked: memory lasts for this session only
    }
}

async function fetchPolicy() {
    try {
        const res = await fetch(MODEL_URL, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return loadPolicy(await res.json());
    } catch (err) {
        console.warn("Boss model unavailable, falling back to online learning only:", err);
        return null;
    }
}

export function createGameFlow(game) {
    const app = {
        game,
        art: null,
        audio: null,
        policy: null,
        memory: null,
        brain: null,
        storage: safeStorage(),
        musicStarted: false,

        go(name, params) {
            game.setScene(new SCENES[name](app, params));
        },

        newBrain(saved) {
            return createBrain({ policy: app.policy, memory: saved, seed: (Date.now() % 2147483647) || 1 });
        },

        saveMemory() {
            app.memory.brain = app.brain.snapshot();
            saveMemory(app.storage, app.memory);
        },

        forget() {
            app.memory = forgetMemory(app.storage);
            app.brain = app.newBrain(null);
        },

        startMusic() {
            if (app.musicStarted) return;
            app.musicStarted = true;
            app.audio.music.start();
        },

        loadingSteps() {
            return [
                ["Forging pixels", async () => { app.art = await buildArt(); }],
                ["Tuning strings", async () => { app.audio = await createAudio(game.audio); }],
                ["Waking the Mirrorwright", async () => { app.policy = await fetchPolicy(); }],
                ["Recalling you", async () => {
                    app.memory = loadMemory(app.storage);
                    app.brain = app.newBrain(app.memory.brain);
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
