// In-engine cutscene runner (BRD 2.2.12). A script is a list of steps played in order:
//   { do: "wait", t }                              pause
//   { do: "walk", who, to, speed? }                walk an actor to world x (plays its run/walk anim)
//   { do: "anim", who, name, t? }                  play an anim across t seconds, or set a looping anim
//   { do: "face", who, dir }                       face left (-1) or right (1)
//   { do: "place", who, x, visible? }              move an actor instantly
//   { do: "say", who, text, portrait?, color? }    dialogue box; the line types out; confirm to continue
//   { do: "camera", x, zoom?, t? }                 pan/zoom the camera (x = left edge of the view)
//   { do: "fade", to, t }                          fade to/from black
//   { do: "flash", color?, t }                     brief full-screen flash
//   { do: "shake", power, t }                      screen shake
//   { do: "sfx", name, volume? }                   play a sound
//   { do: "vision", t }                            the Arrival's shard close-up
//   { do: "caption", text, t }                     centred words over the scene
//   { do: "run", fn }                              custom change to the scene (fn(host))
//   { do: "together", steps }                      run steps at the same time
// Holding Escape for one second skips the whole cutscene. script.end(host) always runs last (finished or
// skipped), so the scene ends in the same state either way.
import { drawDialogue, drawShardVision, drawSkipRing, drawText } from "../presentation/index.js";

const TYPE_SPEED = 40; // characters per second
const SKIP_HOLD = 1;
const CONFIRM_KEYS = ["Enter", "Space", "KeyJ", "KeyF"];

export function createCutscene(script, host) {
    const steps = script.steps(host);
    let index = -1;
    let task = null;
    let done = false;
    let skipHeld = 0;
    const overlay = { dialogue: null, vision: null, caption: null, flash: null };

    function makeTask(step) {
        const actor = step.who ? host.actors[step.who] : null;
        let t = 0;
        switch (step.do) {
            case "wait":
                return { update: (dt) => (t += dt) >= step.t };
            case "walk": {
                const speed = step.speed ?? 60;
                const anim = actor.has("run") ? "run" : "walk";
                return {
                    update(dt) {
                        const dx = step.to - actor.position.x;
                        if (Math.abs(dx) <= speed * dt) {
                            actor.position.x = step.to;
                            actor.play(actor.has("idle") ? "idle" : anim);
                            return true;
                        }
                        actor.flipX = dx < 0;
                        actor.play(anim);
                        actor.position.x += Math.sign(dx) * speed * dt;
                        return false;
                    },
                };
            }
            case "anim":
                if (!step.t) {
                    actor.play(step.name);
                    return { update: () => true };
                }
                return {
                    update(dt) {
                        t += dt;
                        actor.progress(step.name, t / step.t);
                        return t >= step.t;
                    },
                };
            case "face":
                actor.flipX = step.dir < 0;
                return { update: () => true };
            case "place":
                actor.position.x = step.x;
                if (step.visible !== undefined) actor.visible = step.visible;
                return { update: () => true };
            case "say": {
                const line = { name: step.who, portrait: step.portrait ? host.art.portraits?.[step.portrait] ?? null : null, text: step.text, shown: 0, color: step.color };
                overlay.dialogue = line;
                let lastTick = 0;
                return {
                    update(dt, input) {
                        const confirm = input.confirm(); // each press is used by one line only
                        if (line.shown < line.text.length) {
                            line.shown = Math.min(line.text.length, line.shown + TYPE_SPEED * dt);
                            if (Math.floor(line.shown / 2) !== lastTick) {
                                lastTick = Math.floor(line.shown / 2);
                                host.audio.play("dialogueTick", { volume: 0.4 });
                            }
                            if (confirm) line.shown = line.text.length;
                            return false;
                        }
                        if (confirm) {
                            overlay.dialogue = null;
                            return true;
                        }
                        return false;
                    },
                };
            }
            case "camera": {
                const cam = host.camera;
                const from = { x: cam.position.x, zoom: cam.zoom };
                const to = { x: step.x ?? from.x, zoom: step.zoom ?? from.zoom };
                const dur = step.t ?? 0;
                return {
                    update(dt) {
                        t += dt;
                        const k = dur > 0 ? Math.min(1, t / dur) : 1;
                        const e = k * k * (3 - 2 * k);
                        cam.position.x = Math.round(from.x + (to.x - from.x) * e);
                        cam.zoom = from.zoom + (to.zoom - from.zoom) * e;
                        return k >= 1;
                    },
                };
            }
            case "fade":
                host.fadeTo(step.to, step.t > 0 ? 1 / step.t : 100);
                return { update: (dt) => (t += dt) >= (step.t ?? 0) };
            case "flash":
                overlay.flash = { color: step.color ?? "#ffffff", t: 0, dur: step.t };
                return { update: () => true };
            case "shake":
                host.shake(step.power, step.t);
                return { update: () => true };
            case "sfx":
                host.audio.play(step.name, { volume: step.volume ?? 1 });
                return { update: () => true };
            case "vision":
                overlay.vision = { t: 0 };
                return {
                    update(dt) {
                        overlay.vision.t += dt;
                        if (overlay.vision.t >= step.t) {
                            overlay.vision = null;
                            return true;
                        }
                        return false;
                    },
                };
            case "caption":
                overlay.caption = { text: step.text, t: 0, dur: step.t };
                return {
                    update(dt) {
                        overlay.caption.t += dt;
                        if (overlay.caption.t >= step.t) {
                            overlay.caption = null;
                            return true;
                        }
                        return false;
                    },
                };
            case "run":
                step.fn(host);
                return { update: () => true };
            case "together": {
                const tasks = step.steps.map(makeTask);
                const finished = tasks.map(() => false);
                return {
                    update(dt, input) {
                        tasks.forEach((task, i) => {
                            if (!finished[i]) finished[i] = task.update(dt, input);
                        });
                        return finished.every(Boolean);
                    },
                };
            }
            default:
                throw new Error(`Unknown cutscene step "${step.do}"`);
        }
    }

    function finish() {
        done = true;
        overlay.dialogue = overlay.vision = overlay.caption = overlay.flash = null;
        script.end(host);
    }

    return {
        get done() {
            return done;
        },
        get skipProgress() {
            return skipHeld / SKIP_HOLD;
        },
        /** The dialogue line on screen, if any: { text, shown }. */
        get line() {
            return overlay.dialogue ? { text: overlay.dialogue.text, shown: Math.floor(overlay.dialogue.shown) } : null;
        },

        update(dt, input) {
            if (done) return true;
            skipHeld = input.isKeyDown("Escape") ? skipHeld + dt : 0;
            if (skipHeld >= SKIP_HOLD) {
                finish();
                return true;
            }
            if (overlay.flash) overlay.flash.t += dt;
            let confirmAvailable = CONFIRM_KEYS.some((k) => input.isKeyPressed(k));
            const steering = {
                confirm() {
                    const pressed = confirmAvailable;
                    confirmAvailable = false;
                    return pressed;
                },
            };
            // Run every instant step in one frame; stop at the first step that takes time.
            for (let guard = 0; guard < 64; guard++) {
                if (!task) {
                    index += 1;
                    if (index >= steps.length) {
                        finish();
                        return true;
                    }
                    task = makeTask(steps[index]);
                }
                if (!task.update(dt, steering)) break;
                task = null;
                dt = 0;
            }
            return false;
        },

        draw(ctx) {
            if (overlay.vision) drawShardVision(ctx, overlay.vision.t);
            if (overlay.caption) {
                const c = overlay.caption;
                ctx.globalAlpha = Math.min(1, c.t / 0.6, (c.dur - c.t) / 0.6);
                drawText(ctx, c.text, 240, 120, { align: "center", scale: 2, color: "#e8e6f0" });
                ctx.globalAlpha = 1;
            }
            if (overlay.flash && overlay.flash.t < overlay.flash.dur) {
                ctx.globalAlpha = 1 - overlay.flash.t / overlay.flash.dur;
                ctx.fillStyle = overlay.flash.color;
                ctx.fillRect(0, 0, 480, 270);
                ctx.globalAlpha = 1;
            }
            if (overlay.dialogue) {
                // The actors stand on the floor near the bottom of the view, so dialogue sits at the top.
                ctx.save();
                ctx.translate(0, -186);
                drawDialogue(ctx, { ...overlay.dialogue, shown: Math.floor(overlay.dialogue.shown) });
                ctx.restore();
            }
            drawSkipRing(ctx, skipHeld / SKIP_HOLD);
        },
    };
}
