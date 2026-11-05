// Combat tuning. Units: pixels and seconds. Y grows downward; entity y is the feet position.
export const DT = 1 / 60;
export const FLOOR_Y = 228;
export const GRAVITY = 950;
export const MAX_FALL_SPEED = 420;

export const PLAYER = {
    halfWidth: 6,
    height: 26,
    rollHeight: 14,
    walkSpeed: 92,
    groundAccel: 1400,
    airAccel: 700,
    jumpVelocity: 315,
    jumpCut: 0.5,
    maxHp: 100,
    maxStamina: 100,
    staminaRegen: 46,
    staminaRegenIdle: 62,
    staminaDelay: 0.55,
    maxHeals: 3,
    heal: { duration: 1.1, applyAt: 0.75, amount: 45, walkFactor: 0.3 },
    roll: { duration: 0.46, speed: 175, invulnFrom: 0.06, invulnTo: 0.32, actFrom: 0.38, stamina: 22 },
    light: [
        { windup: 0.11, active: 0.08, recovery: 0.24, damage: 11, stamina: 13, reach: 30, stagger: 9, lunge: 40 },
        { windup: 0.1, active: 0.08, recovery: 0.24, damage: 11, stamina: 13, reach: 30, stagger: 9, lunge: 40 },
        { windup: 0.14, active: 0.1, recovery: 0.34, damage: 15, stamina: 16, reach: 32, stagger: 14, lunge: 55 },
    ],
    chainFrom: 0.04, // seconds into recovery when a queued chain attack starts
    heavy: { windup: 0.38, active: 0.1, recovery: 0.42, damage: 28, stamina: 28, reach: 36, stagger: 30, lunge: 60 },
    parry: { window: [0.02, 0.19], duration: 0.42, stamina: 10 },
    hurt: { stun: 0.32, invuln: 0.6, knockback: 110 },
    deflected: { stun: 0.25, knockback: 60 }, // recoil when an enemy's parry stance turns the knight's attack aside
    bufferTime: 0.15,
};


// Minimum visible wind-up before any enemy damage (BRD 2.2.3.4, 2.2.11); a definition may demand more.
export const MIN_TELEGRAPH = 0.3;
