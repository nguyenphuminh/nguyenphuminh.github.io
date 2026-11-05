// Cutscene scripts (BRD 2.2.12.2). The host is the world scene: it lends its actors, camera, audio and effects.
// Each script's end() sets the final state, so skipping a cutscene leaves the world exactly as watching it would.
const CYAN = "#6fe7ff";
const IVORY = "#efe6cf";

export const CUTSCENES = {
    // 1. Arrival: the knight reaches the Keep, picks up a shard and is greeted by the Mirror.
    arrival: {
        steps: (h) => [
            { do: "run", fn: (host) => {
                host.actors.knight.position.x = host.area.minX - 30;
                host.actors.knight.flipX = false;
                host.camera.position.x = 0;
                host.setFade(1);
            } },
            { do: "fade", to: 0, t: 1.5 },
            { do: "sfx", name: "gate", volume: 0.7 },
            { do: "walk", who: "knight", to: h.area.roadShardX - 12, speed: 42 },
            { do: "wait", t: 0.4 },
            { do: "anim", who: "knight", name: "kneel", t: 1.0 },
            { do: "run", fn: (host) => host.hideProp("roadShard") },
            { do: "anim", who: "knight", name: "holdShard" },
            { do: "wait", t: 0.6 },
            { do: "together", steps: [{ do: "vision", t: 4.2 }, { do: "sfx", name: "mirrorWhisper" }] },
            { do: "say", who: "The Mirror", portrait: "mirror", color: CYAN, text: "Every fall teaches us. Come and be learned." },
            { do: "anim", who: "knight", name: "idle" },
            { do: "walk", who: "knight", to: h.area.shrineX - 22, speed: 55 },
        ],
        end: (h) => {
            h.actors.knight.position.x = h.area.shrineX - 22;
            h.actors.knight.flipX = false;
            h.hideProp("roadShard");
            h.setFade(0);
        },
    },

    // 2. The Pale Squire: practising at his post, he notices the knight and copies their stance, badly.
    squireIntro: {
        steps: (h) => [
            { do: "run", fn: (host) => {
                host.actors.boss.flipX = false;
                host.actors.boss.play("dormant");
                host.actors.knight.position.x = host.area.arenaEntryX;
                host.actors.knight.flipX = false;
            } },
            { do: "fade", to: 0, t: 1.0 },
            { do: "walk", who: "knight", to: h.area.arenaEntryX + 70, speed: 45 },
            { do: "wait", t: 1.0 },
            { do: "face", who: "boss", dir: -1 },
            { do: "anim", who: "boss", name: "rise", t: 0.8 },
            { do: "anim", who: "boss", name: "mimicStance" },
            { do: "wait", t: 0.6 },
            { do: "say", who: "The Pale Squire", portrait: "squire", color: IVORY, text: "Is that how you stand? Show me again." },
            { do: "anim", who: "boss", name: "idle" },
        ],
        end: (h) => {
            h.actors.knight.position.x = h.area.arenaEntryX + 70;
            h.actors.knight.flipX = false;
            h.actors.boss.flipX = true;
            h.setFade(0);
        },
    },

    // 3. The Squire Breaks: he kneels, speaks, and shatters; his shards drift toward the inner Keep.
    squireBreaks: {
        steps: () => [
            { do: "wait", t: 0.6 },
            { do: "anim", who: "boss", name: "kneel" },
            { do: "wait", t: 0.8 },
            { do: "say", who: "The Pale Squire", portrait: "squire", color: IVORY, text: "I almost... had you." },
            { do: "together", steps: [{ do: "flash", t: 0.35 }, { do: "sfx", name: "glassBreak" }, { do: "shake", power: 3, t: 0.3 }] },
            { do: "anim", who: "boss", name: "death", t: 1.2 },
            { do: "run", fn: (host) => host.burstShards(host.actors.boss.position.x, host.actors.boss.position.y - 24) },
            { do: "wait", t: 1.4 },
        ],
        end: (h) => {
            h.actors.boss.visible = false;
        },
    },

    // 4. The Hall of Panes: crossing the bridge, the knight's reflections in the panes turn a moment late.
    hallEntry: {
        steps: (h) => [
            { do: "run", fn: (host) => {
                host.actors.knight.position.x = host.area.minX + 4;
                host.actors.knight.flipX = false;
                host.camera.position.x = 0;
                host.setFade(1);
            } },
            { do: "fade", to: 0, t: 1.2 },
            { do: "walk", who: "knight", to: h.area.shrineX + 40, speed: 42 },
            { do: "run", fn: (host) => host.setEchoLag(0.45) },
            { do: "together", steps: [
                { do: "walk", who: "knight", to: h.area.shrineX + 130, speed: 36 },
                { do: "camera", x: h.area.shrineX - 90, t: 2.4 }, // keep the knight and the mirror panes in view
            ] },
            { do: "wait", t: 0.7 },
            { do: "face", who: "knight", dir: -1 },
            { do: "wait", t: 1.0 },
            { do: "face", who: "knight", dir: 1 },
            { do: "say", who: "The Mirror", portrait: "mirror", color: CYAN, text: "The Squire showed us how you stand." },
            { do: "run", fn: (host) => host.setEchoLag(0) },
        ],
        end: (h) => {
            h.actors.knight.position.x = h.area.shrineX + 130;
            h.actors.knight.flipX = false;
            h.setEchoLag(0);
            h.setFade(0);
        },
    },

    // 5. The Mirrorwright: working at a glass anvil, it sets down its hammer and lifts its blade.
    mirrorwrightIntro: {
        steps: (h) => [
            { do: "run", fn: (host) => {
                host.actors.boss.flipX = false;
                host.actors.boss.play("forge");
                host.actors.knight.position.x = host.area.arenaEntryX;
                host.actors.knight.flipX = false;
            } },
            { do: "fade", to: 0, t: 1.0 },
            { do: "together", steps: [
                { do: "walk", who: "knight", to: h.area.arenaEntryX + 80, speed: 40 },
                { do: "sfx", name: "shieldBlock", volume: 0.5 },
            ] },
            { do: "sfx", name: "shieldBlock", volume: 0.5 },
            { do: "wait", t: 0.9 },
            { do: "sfx", name: "shieldBlock", volume: 0.5 },
            { do: "wait", t: 0.6 },
            { do: "anim", who: "boss", name: "liftBlade", t: 1.0 },
            { do: "face", who: "boss", dir: -1 },
            { do: "say", who: "The Mirrorwright", portrait: "mirrorwright", color: CYAN, text: "I forged it to keep the best of us. It kept everything." },
            { do: "anim", who: "boss", name: "idle" },
        ],
        end: (h) => {
            h.actors.knight.position.x = h.area.arenaEntryX + 80;
            h.actors.knight.flipX = false;
            h.actors.boss.flipX = true;
            h.setFade(0);
        },
    },

    // 6. The Smith Rests: the Mirrorwright falls; the far wall cracks open onto a stair.
    smithRests: {
        steps: () => [
            { do: "wait", t: 0.5 },
            { do: "anim", who: "boss", name: "fallen" },
            { do: "wait", t: 0.8 },
            { do: "say", who: "The Mirrorwright", portrait: "mirrorwright", color: CYAN, text: "Then let it learn this. It can lose." },
            { do: "anim", who: "boss", name: "death", t: 1.6 },
            { do: "run", fn: (host) => host.burstShards(host.actors.boss.position.x, host.actors.boss.position.y - 40) },
            { do: "wait", t: 0.6 },
            { do: "together", steps: [{ do: "sfx", name: "mirrorCrack" }, { do: "shake", power: 4, t: 1.2 }] },
            { do: "wait", t: 0.6 },
            { do: "run", fn: (host) => host.openArenaWall() },
            { do: "flash", t: 0.5 },
            { do: "wait", t: 1.6 },
        ],
        end: (h) => {
            h.actors.boss.visible = false;
            h.openArenaWall();
        },
    },

    // 7. The Silvered Heart: the Great Mirror fills the chamber; fallen knights stand frozen inside it.
    heartEntry: {
        steps: (h) => [
            { do: "run", fn: (host) => {
                host.actors.knight.position.x = host.area.minX + 4;
                host.actors.knight.flipX = false;
                host.camera.position.x = 0;
                host.setFade(1);
            } },
            { do: "fade", to: 0, t: 1.2 },
            { do: "walk", who: "knight", to: h.area.shrineX - 30, speed: 40 },
            { do: "wait", t: 0.5 },
            { do: "camera", x: h.area.arenaLeft, t: 3.2 },
            { do: "wait", t: 0.8 },
            { do: "say", who: "The Mirror", portrait: "mirror", color: CYAN, text: "We are nearly you." },
            { do: "camera", x: 0, t: 2.4 },
        ],
        end: (h) => {
            h.actors.knight.position.x = h.area.shrineX - 30;
            h.actors.knight.flipX = false;
            h.camera.position.x = 0;
            h.setFade(0);
        },
    },

    // 8. The Reflection: the reflection stops moving with the knight, then steps out of the Great Mirror.
    reflectionIntro: {
        steps: (h) => [
            { do: "run", fn: (host) => {
                host.actors.boss.visible = false;
                host.actors.boss.flipX = true;
                host.actors.knight.position.x = host.area.arenaEntryX;
                host.actors.knight.flipX = false;
            } },
            { do: "fade", to: 0, t: 1.0 },
            { do: "walk", who: "knight", to: h.area.arenaEntryX + 140, speed: 36 },
            { do: "together", steps: [{ do: "sfx", name: "heartbeat" }, { do: "wait", t: 1.0 }] },
            { do: "sfx", name: "heartbeat" },
            { do: "run", fn: (host) => {
                host.actors.boss.visible = true;
                host.actors.boss.position.x = host.area.bossX;
            } },
            { do: "anim", who: "boss", name: "rise", t: 1.0 },
            { do: "anim", who: "boss", name: "idle" },
            { do: "say", who: "The Reflection", portrait: "reflection", color: CYAN, text: h.fallsLine() },
            { do: "walk", who: "knight", to: h.area.arenaEntryX + 70, speed: 50 },
            { do: "face", who: "knight", dir: 1 },
        ],
        end: (h) => {
            h.actors.boss.visible = true;
            h.actors.boss.position.x = h.area.bossX;
            h.actors.boss.flipX = true;
            h.actors.knight.position.x = h.area.arenaEntryX + 70;
            h.actors.knight.flipX = false;
            h.setFade(0);
        },
    },

    // 9. Ending: the knight strikes the Great Mirror; every reflection shatters; dawn; the puddle.
    ending: {
        steps: (h) => [
            { do: "run", fn: (host) => {
                host.actors.boss.visible = false;
                host.actors.knight.position.x = host.area.arenaEntryX + 120;
                host.actors.knight.flipX = false;
                host.setFade(1);
            } },
            { do: "fade", to: 0, t: 1.2 },
            { do: "walk", who: "knight", to: h.area.arenaLeft + 290, speed: 32 },
            { do: "wait", t: 0.8 },
            { do: "anim", who: "knight", name: "heavy", t: 0.9 },
            { do: "together", steps: [{ do: "sfx", name: "mirrorCrack" }, { do: "shake", power: 6, t: 1.6 }, { do: "flash", t: 0.4 }] },
            { do: "run", fn: (host) => host.crackGreatMirror() },
            { do: "wait", t: 1.4 },
            { do: "run", fn: (host) => host.burstShards(host.area.arenaLeft + 330, 140) },
            { do: "together", steps: [{ do: "sfx", name: "bossDeath" }, { do: "flash", t: 1.6 }] },
            { do: "fade", to: 1, t: 1.0 },
            { do: "run", fn: (host) => host.showDawn(true) },
            { do: "sfx", name: "dawn" },
            { do: "fade", to: 0, t: 1.6 },
            { do: "wait", t: 2.2 },
            { do: "caption", text: "The Mirror forgets. You remember.", t: 4.5 },
            { do: "fade", to: 1, t: 1.6 },
        ],
        end: (h) => {
            h.crackGreatMirror();
            h.showDawn(true);
            h.setFade(1);
        },
    },
};

/** Short lines bosses say during fights, shown under their health bar (BRD 2.2.12.3). */
export const BOSS_LINES = {
    mirrorwright: { phase2: "Look closer." },
    reflection: { phase2: "I stop copying you now. I predict you." },
};

/** The Reflection's line names the real number of falls in the Keep (BRD 2.2.12.2). */
export const reflectionLine = (falls) => (falls > 0 ? `I am all ${falls} times you fell.` : "I am every time you fell.");
