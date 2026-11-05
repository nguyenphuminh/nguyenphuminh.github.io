// What the boss is rewarded for (BRD 2.2.5): damage dealt and wins, minus damage taken.
// Shared by offline training and online learning so both chase the same goal.
export const REWARD = { perDamage: 1 / 100, parried: 0.15, perSecond: 0.02, win: 1, loss: 1 };

export function stepReward(events, dt) {
    let r = -REWARD.perSecond * dt; // gentle push to engage instead of stalling
    for (const e of events) {
        if (e.type === "playerHit") r += e.damage * REWARD.perDamage;
        else if (e.type === "bossHit") r -= e.damage * REWARD.perDamage;
        else if (e.type === "parry") r -= REWARD.parried;
    }
    return r;
}

export function terminalReward(outcome) {
    if (outcome === "playerDead") return REWARD.win;
    if (outcome === "bossDead") return -REWARD.loss;
    return 0;
}
