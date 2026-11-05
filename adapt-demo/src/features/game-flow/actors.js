// Kippy entities that show the simulation: the player, the boss and hazards.
// Animation frames for actions are picked from the simulation's stage progress so poses match hit timing.
import { Animation, Animator, Entity, SpriteSheet } from "kippy";
import { BOSS, PLAYER } from "../combat/index.js";

function buildAnimator(sheet, anims, fallback) {
    const animations = {};
    for (const [name, a] of Object.entries(anims)) {
        animations[name] = new Animation({ spriteSheet: sheet, frames: a.frames, fps: a.fps || 8, loop: Boolean(a.loop) });
    }
    return new Animator({ animations, default: animations[fallback] ? fallback : Object.keys(animations)[0] });
}

/** A Kippy entity drawn from a character sheet, anchored at its feet, with mirroring and flash overlays. */
export class SpriteActor extends Entity {
    constructor(art, fallback = "idle") {
        const sheet = new SpriteSheet({ texture: art.sheet, frameWidth: art.frameWidth, frameHeight: art.frameHeight });
        super({ animator: buildAnimator(sheet, art.anims, fallback) });
        this.art = art;
        this.sheet = sheet;
        this.flipX = false;
        this.alpha = 1;
        this.flash = 0; // white overlay 0..1
        this.flashRed = 0; // red overlay 0..1
        this.glowColor = null;
        this.glowBlur = 0;
        this.visible = true;
        this.depth = 0;
    }

    has(name) {
        return Boolean(this.art.anims[name]);
    }

    /** Plays an anim with its own fps (loops or one-shots). */
    play(name) {
        if (!this.has(name)) return;
        const anim = this.animator;
        if (anim.currentAnimationName !== name || anim.manual) {
            anim.play(name, true);
            anim.manual = false;
        }
    }

    /** Shows a specific frame of an anim (index into its frames). */
    frame(name, index) {
        if (!this.has(name)) return;
        const anim = this.animator;
        if (anim.currentAnimationName !== name) anim.play(name, true);
        anim.manual = true;
        anim.stopped = true;
        anim.frameIndex = Math.max(0, Math.min(this.art.anims[name].frames.length - 1, index));
    }

    /** Shows an anim at progress t (0..1) across all its frames. */
    progress(name, t) {
        if (!this.has(name)) return;
        const n = this.art.anims[name].frames.length;
        this.frame(name, Math.floor(Math.max(0, Math.min(0.999, t)) * n));
    }

    /** Shows a phased anim (windup/active/recovery) given the segment durations and the time in the move. */
    phased(name, durations, t) {
        const a = this.art.anims[name];
        if (!a) return;
        if (!a.phases) return this.progress(name, t / (durations.windup + durations.active + durations.recovery));
        const { windup: w, active: ac, recovery: r } = a.phases;
        let index;
        if (t < durations.windup) index = Math.floor((t / durations.windup) * w);
        else if (t < durations.windup + durations.active) index = w + Math.floor(((t - durations.windup) / durations.active) * ac);
        else index = w + ac + Math.floor(((t - durations.windup - durations.active) / durations.recovery) * r);
        this.frame(name, Math.min(index, w + ac + r - 1));
    }

    /** Shows one segment of a phased anim at progress t, or a single marker frame of it. */
    segment(name, seg, t) {
        const a = this.art.anims[name];
        if (!a) return;
        if (!a.phases) return this.progress(name, t);
        const { windup: w, active: ac, recovery: r } = a.phases;
        const ranges = { windup: [0, w], active: [w, ac], recovery: [w + ac, r] };
        if (seg === "windupEnd") return this.frame(name, w - 1);
        if (seg === "activeEnd") return this.frame(name, w + ac - 1);
        if (seg === "recoveryStart") return this.frame(name, w + ac);
        const [start, count] = ranges[seg] ?? [0, a.frames.length];
        this.frame(name, start + Math.min(count - 1, Math.floor(Math.max(0, t) * count)));
    }

    render(ctx) {
        if (!this.visible) return;
        const f = this.getFrame();
        if (!f) return;
        const ax = this.art.anchorX;
        const ay = this.art.anchorY;
        ctx.save();
        ctx.translate(Math.round(this.position.x), Math.round(this.position.y));
        if (this.flipX) ctx.scale(-1, 1);
        ctx.globalAlpha = this.alpha;
        if (this.glowBlur > 0 && this.glowColor) {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = this.glowBlur;
        }
        ctx.drawImage(f.texture, f.sx, f.sy, f.sw, f.sh, -ax, -ay, f.dw, f.dh);
        ctx.shadowBlur = 0;
        if (this.flash > 0 && this.art.flash) {
            ctx.globalAlpha = this.alpha * Math.min(1, this.flash);
            ctx.drawImage(this.art.flash, f.sx, f.sy, f.sw, f.sh, -ax, -ay, f.dw, f.dh);
        }
        if (this.flashRed > 0 && this.art.flashRed) {
            ctx.globalAlpha = this.alpha * Math.min(1, this.flashRed);
            ctx.drawImage(this.art.flashRed, f.sx, f.sy, f.sw, f.sh, -ax, -ay, f.dw, f.dh);
        }
        ctx.restore();
    }
}

const PARRY_SEGMENTS = {
    windup: PLAYER.parry.window[0],
    active: PLAYER.parry.window[1] - PLAYER.parry.window[0],
    recovery: PLAYER.parry.duration - PLAYER.parry.window[1],
};

export function syncPlayer(actor, p, time) {
    actor.position.x = p.x;
    actor.position.y = p.y;
    actor.flipX = p.facing < 0;
    const t = p.stateTime;
    switch (p.state) {
        case "run": actor.play("run"); break;
        case "jump": actor.play("jump"); break;
        case "fall": actor.play("fall"); break;
        case "rest": actor.play("rest"); break;
        case "grabbed": actor.play("grabbed"); break;
        case "roll": actor.progress("roll", t / PLAYER.roll.duration); break;
        case "light": actor.phased(`light${p.combo}`, PLAYER.light[p.combo - 1], t); break;
        case "heavy": actor.phased("heavy", PLAYER.heavy, t); break;
        case "parry": actor.phased("parry", PARRY_SEGMENTS, t); break;
        case "heal": actor.progress("heal", t / PLAYER.heal.duration); break;
        case "hurt": actor.progress("hurt", t / PLAYER.hurt.stun); break;
        case "dead": actor.progress("death", t / 1.2); break;
        default: actor.play("idle");
    }
    const blinking = p.invuln > 0 && p.state !== "hurt" && p.state !== "dead";
    actor.alpha = blinking && Math.floor(time * 20) % 2 === 0 ? 0.45 : 1;
}

const BOSS_TIMED = { rise: BOSS.riseTime, recoil: BOSS.recoilTime, transition: BOSS.transitionTime, dead: 2.2 };

export function syncBoss(actor, b) {
    actor.position.x = b.x;
    actor.position.y = b.y;
    actor.flipX = b.facing < 0;
    switch (b.state) {
        case "dormant": actor.play("dormant"); return;
        case "rise": actor.progress("rise", b.stateTime / BOSS_TIMED.rise); return;
        case "recoil": actor.progress("recoil", b.stateTime / BOSS_TIMED.recoil); return;
        case "staggered": actor.play("staggered"); return;
        case "transition": actor.progress("transition", b.stateTime / BOSS_TIMED.transition); return;
        case "grabHold": actor.play("grabHold"); return;
        case "dead": actor.progress("death", b.stateTime / BOSS_TIMED.dead); return;
        case "action": {
            const a = b.action;
            const stage = a.def.stages[a.stageIndex];
            const [name, seg] = stage.anim;
            const t = a.stageDur > 0 ? a.stageTime / a.stageDur : 1;
            if (seg) actor.segment(name, seg, t);
            else if (actor.art.anims[name]?.loop) actor.play(name);
            else actor.progress(name, t);
            return;
        }
        default: actor.play("idle");
    }
}

/** A simple entity for props and hazards: a static sprite or a sheet animation, anchored at its center-bottom. */
export class PropActor extends Entity {
    constructor(prop) {
        if (prop.sheet) {
            const sheet = new SpriteSheet({ texture: prop.sheet, frameWidth: prop.frameWidth, frameHeight: prop.frameHeight });
            super({ animator: buildAnimator(sheet, { main: { frames: prop.frames, fps: prop.fps, loop: prop.loop !== false } }, "main") });
            this.w = prop.frameWidth;
            this.h = prop.frameHeight;
        } else {
            super();
            this.sprite = { texture: prop.sprite, width: prop.sprite.width, height: prop.sprite.height };
            this.w = prop.sprite.width;
            this.h = prop.sprite.height;
        }
        this.flipX = false;
        this.alpha = 1;
        this.anchor = "bottom"; // bottom | center
        this.glowColor = null;
        this.glowBlur = 0;
        this.depth = -1;
    }

    render(ctx) {
        const f = this.getFrame();
        if (!f || this.alpha <= 0) return;
        ctx.save();
        ctx.translate(Math.round(this.position.x), Math.round(this.position.y));
        if (this.flipX) ctx.scale(-1, 1);
        ctx.globalAlpha = this.alpha;
        if (this.glowBlur > 0 && this.glowColor) {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = this.glowBlur;
        }
        const top = this.anchor === "bottom" ? -f.dh : -f.dh / 2;
        ctx.drawImage(f.texture, f.sx, f.sy, f.sw, f.sh, Math.round(-f.dw / 2), Math.round(top), f.dw, f.dh);
        ctx.restore();
    }
}
