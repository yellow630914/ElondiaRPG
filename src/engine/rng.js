// 可重現的亂數（mulberry32）。狀態存進 GameState，讀檔後的擲骰結果與存檔前一致。
export class Rng {
    state;
    constructor(state) {
        this.state = state;
    }
    next() {
        let t = (this.state = (this.state + 0x6d2b79f5) | 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** 含兩端的整數 */
    int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
    }
    pick(items) {
        if (items.length === 0)
            throw new Error('pick from empty list');
        return items[this.int(0, items.length - 1)];
    }
    chance(p) {
        return this.next() < p;
    }
}
const DICE_RE = /^(\d*)d(\d+)([+-]\d+)?$/;
/** 擲骰，例如 "1d20+5"、"2d6"、"d8"。critical 時骰子數量加倍。 */
export function roll(rng, dice, critical = false) {
    const m = DICE_RE.exec(dice.replace(/\s+/g, ''));
    if (!m)
        throw new Error(`bad dice: ${dice}`);
    const count = (Number(m[1]) || 1) * (critical ? 2 : 1);
    const sides = Number(m[2]);
    const mod = Number(m[3] ?? 0);
    const rolls = Array.from({ length: count }, () => rng.int(1, sides));
    return { dice, rolls, total: rolls.reduce((a, b) => a + b, 0) + mod };
}
export function withBonus(dice, bonus) {
    if (bonus === 0)
        return dice;
    return `${dice}${bonus > 0 ? '+' : ''}${bonus}`;
}
