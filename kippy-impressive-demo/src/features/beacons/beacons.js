import { Entity, Sprite, CircleCollider, Vector2 } from "kippy";
import { LAYER, MASK } from "../../core/layers.js";
import { TAU, damp } from "../../core/math.js";
import { glowSprite } from "../../core/paint.js";
import { lineOfSight, visibilityPolygon } from "../level/field.js";
import { POEMS, HINTS } from "../story/text.js";
import { makeCoral } from "./art.js";

const SING_RANGE = 230;
const LIT_RADIUS = 430;
const MIN_STRENGTH = 0.25;
const heartGlow = (res) => 120 + 300 * res;

// The Choir: beacons woken by song, safe light around them, the rift down, and the Heart
export function createBeacons(world) {
    const level = world.level;
    const all = level.beacons.map((p, k) => make(p, { heart: false, songs: 3, seed: level.seed + k * 101 }));
    const regular = all.slice();
    const heart = level.depth.heart ? make(level.goal, { heart: true, songs: 5, seed: level.seed + 999 }) : null;
    if (heart) {
        heart.sealed = true;
        all.push(heart);
    }
    const rift = heart ? null : makeRift(level.goal);
    let sealedHintT = -99;

    function make(p, { heart: isHeart, songs, seed }) {
        const art = makeCoral(seed, isHeart);
        const entity = new Entity({
            position: new Vector2(p.x, p.y),
            sprite: new Sprite({ texture: art.dead, width: art.size, height: art.size }),
            collider: new CircleCollider({ radius: SING_RANGE, isTrigger: true, layer: LAYER.ZONE, mask: MASK.PLAYER_ONLY })
        });
        entity.kind = "beacon";
        const B = { x: p.x, y: p.y, entity, art, heart: isHeart, songs, resonance: 0, lit: false, sealed: false, discovered: false, poly: null, litR: 0, glowPoly: null };
        entity.onTriggerEnter = (other) => {
            if (other.kind !== "player") return;
            B.discovered = true;
            world.events.emit("beacon-near", B);
        };
        world.sonar.track({ x: p.x, y: p.y, radius: 40, onEcho: () => (B.discovered = true) });
        return B;
    }

    function makeRift(p) {
        const entity = new Entity({
            position: new Vector2(p.x, p.y),
            collider: new CircleCollider({ radius: 34, isTrigger: true, layer: LAYER.ZONE, mask: MASK.PLAYER_ONLY })
        });
        entity.kind = "rift";
        const R = { x: p.x, y: p.y, entity, open: false };
        entity.onTriggerEnter = entity.onTriggerStay = (other) => {
            if (other.kind === "player" && R.open && !world.player.state.dead) world.events.emit("rift-entered");
        };
        return R;
    }

    world.events.on("song", (song) => {
        if (song.source !== "player") return;
        for (const B of all) {
            if (B.lit || Math.hypot(song.x - B.x, song.y - B.y) > SING_RANGE) continue;
            if (!lineOfSight(level, song.x, song.y, B.x, B.y)) continue;
            B.discovered = true;
            if (B.sealed) {
                if (world.time - sealedHintT > 6) {
                    sealedHintT = world.time;
                    world.captions.hint(HINTS.sealed, 5);
                }
                world.sfx.play("huff", { volume: 0.6, pitch: 0.6 });
                continue;
            }
            if (song.strength < MIN_STRENGTH) continue;
            B.resonance = Math.min(1, B.resonance + song.strength / B.songs);
            world.sfx.play("bell", { pitch: 0.5 + B.resonance * 0.5, volume: 0.6 });
            world.particles.burst(B.x, B.y, 24, { speed: 110, color: "rgba(255, 200, 130, 0.9)", life: 1.1, size: 6, lift: 20 });
            if (B.heart) {
                world.noise.emit(B.x, B.y, 1e6, "beacon");
                if (B.resonance >= 0.4) {
                    world.listeners.blockZone(B.x, B.y, heartGlow(B.resonance));
                    B.glowPoly = visibilityPolygon(level, B.x, B.y, heartGlow(B.resonance), 200, 12);
                }
            }
            if (B.resonance >= 0.999) wake(B);
        }
    });

    function wake(B) {
        B.lit = true;
        B.resonance = 1;
        B.entity.sprite = new Sprite({ texture: B.art.lit, width: B.art.size, height: B.art.size });
        B.entity.glow = { color: "rgba(255, 190, 110, 0.9)", bloom: 24, intensity: 2 };
        B.poly = visibilityPolygon(level, B.x, B.y, LIT_RADIUS, 256, 14);

        const index = world.run.voices.length;
        world.run.voices.push(index);
        world.music.addVoice(index);
        world.captions.poem(POEMS[index] ?? "");
        world.sfx.play("relight");
        world.sonar.cast(B.x, B.y, 1, { source: "beacon", kind: 1, reach: 1200 });
        world.noise.emit(B.x, B.y, 1400, "beacon");
        world.listeners.blockZone(B.x, B.y, LIT_RADIUS + 20);
        world.shake(0.6);
        world.flash(B.x, B.y, 700, 1.4);
        world.particles.burst(B.x, B.y, 80, { speed: 320, color: "rgba(255, 210, 140, 0.95)", life: 1.6, size: 8, drag: 1.6 });
        world.events.emit("beacon-lit", B);

        if (B.heart) {
            world.events.emit("heart-lit", B);
        } else if (regular.every((b) => b.lit)) {
            if (rift) {
                rift.open = true;
                world.sfx.play("riftOpen");
                world.captions.hint(HINTS.rift, 6);
                world.flash(rift.x, rift.y, 400, 2);
            } else if (heart) {
                heart.sealed = false;
                heart.discovered = true;
                world.sfx.play("riftOpen", { pitch: 0.7 });
                world.captions.hint(HINTS.heart, 7);
            }
        }
    }

    function zoneAt(x, y) {
        for (const B of all) {
            const d = Math.hypot(x - B.x, y - B.y);
            if (B.lit && d < LIT_RADIUS * 0.92) return { x: B.x, y: B.y, r: LIT_RADIUS };
            if (B.heart && !B.lit && B.resonance >= 0.4 && d < heartGlow(B.resonance)) return { x: B.x, y: B.y, r: heartGlow(B.resonance) };
        }
        return null;
    }

    const safeAt = (x, y) => all.some((B) => B.lit && Math.hypot(x - B.x, y - B.y) < LIT_RADIUS * 0.9);

    function update(dt) {
        for (const B of all) {
            if (B.lit) {
                B.litR = damp(B.litR, LIT_RADIUS, 1.2, dt);
                if (Math.random() < dt * 6) {
                    const a = Math.random() * TAU;
                    const r = Math.random() * 160;
                    world.particles.spawn(B.x + Math.cos(a) * r, B.y + Math.sin(a) * r, 0, -10, 3, 5, "rgba(255, 210, 150, 0.6)", 0.5, 8);
                }
            }
        }
        if (rift?.open && Math.random() < dt * 25) {
            const a = Math.random() * TAU;
            world.particles.spawn(rift.x + Math.cos(a) * 60, rift.y + Math.sin(a) * 60, -Math.cos(a) * 50, -Math.sin(a) * 50, 1.2, 5, "rgba(170, 225, 255, 0.8)", 0.2);
        }
    }

    function renderOver(ctx) {
        const t = world.time;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const B of all) {
            const ring = B.heart ? 120 : 76;
            const hidden = B.discovered || B.lit ? 0 : world.mapView ?? 0;
            if (!B.lit && hidden < 1) {
                const pulse = 0.5 + 0.5 * Math.sin(t * (B.sealed ? 1.2 : 2.2) + B.x);
                const color = B.sealed ? "rgba(170, 70, 160, 1)" : "rgba(255, 140, 120, 1)";
                const s = (B.heart ? 46 : 26) + pulse * 10;
                ctx.globalAlpha = (0.25 + 0.3 * pulse) * (1 - hidden);
                ctx.drawImage(glowSprite(color), B.x - s, B.y - s, s * 2, s * 2);
                ctx.globalAlpha = 1;

                // Resonance: one arc segment per full song needed
                if (B.discovered && !B.sealed) {
                    const gap = 0.12;
                    const seg = TAU / B.songs;
                    for (let k = 0; k < B.songs; k++) {
                        const fill = Math.max(0, Math.min(1, B.resonance * B.songs - k));
                        const a0 = -Math.PI / 2 + k * seg + gap / 2;
                        ctx.lineWidth = 3;
                        ctx.strokeStyle = "rgba(255, 200, 140, 0.18)";
                        ctx.beginPath();
                        ctx.arc(B.x, B.y, ring, a0, a0 + seg - gap);
                        ctx.stroke();
                        if (fill > 0) {
                            ctx.strokeStyle = "rgba(255, 215, 150, 0.9)";
                            ctx.beginPath();
                            ctx.arc(B.x, B.y, ring, a0, a0 + (seg - gap) * fill);
                            ctx.stroke();
                        }
                    }
                }
            } else if (B.lit) {
                ctx.globalAlpha = 0.25 + 0.08 * Math.sin(t * 1.5 + B.y);
                const s = ring * 1.4;
                ctx.drawImage(glowSprite("rgba(255, 200, 130, 1)"), B.x - s, B.y - s, s * 2, s * 2);
                ctx.globalAlpha = 1;
            }
        }

        if (rift) {
            if (rift.open) {
                const grad = ctx.createLinearGradient(rift.x, rift.y - 520, rift.x, rift.y);
                grad.addColorStop(0, "rgba(150, 210, 255, 0)");
                grad.addColorStop(1, `rgba(170, 225, 255, ${0.28 + 0.06 * Math.sin(t * 3)})`);
                ctx.fillStyle = grad;
                ctx.fillRect(rift.x - 26, rift.y - 520, 52, 520);
                ctx.drawImage(glowSprite("rgba(190, 235, 255, 1)"), rift.x - 70, rift.y - 70, 140, 140);
            } else {
                ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 0.8);
                ctx.drawImage(glowSprite("rgba(90, 120, 200, 1)"), rift.x - 30, rift.y - 30, 60, 60);
                ctx.globalAlpha = 1;
            }
        }
        ctx.restore();
    }

    function lights(out) {
        for (const B of all) {
            if (B.lit) out.push({ x: B.x, y: B.y, r: B.litR, i: 1, poly: B.poly, color: "rgba(255, 185, 120, 0.2)" });
            else if (B.glowPoly) out.push({ x: B.x, y: B.y, r: heartGlow(B.resonance), i: 0.85, poly: B.glowPoly, color: "rgba(255, 150, 170, 0.18)" });
            else out.push({ x: B.x, y: B.y, r: B.heart ? 110 : 75, i: 0.35, color: B.sealed ? "rgba(170, 70, 160, 0.12)" : "rgba(255, 140, 120, 0.1)" });
        }
        if (rift?.open) out.push({ x: rift.x, y: rift.y, r: 260, i: 0.9, color: "rgba(170, 220, 255, 0.2)" });
    }

    // Things the HUD may point at
    function targets() {
        const out = all.filter((B) => B.discovered && !B.lit && !B.sealed).map((B) => ({ x: B.x, y: B.y, kind: B.heart ? "heart" : "beacon" }));
        if (rift?.open) out.push({ x: rift.x, y: rift.y, kind: "rift" });
        return out;
    }

    return {
        all,
        heart,
        rift,
        entities: [...all.map((B) => B.entity), ...(rift ? [rift.entity] : [])],
        update,
        renderOver,
        lights,
        zoneAt,
        safeAt,
        targets
    };
}
