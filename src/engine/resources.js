// 隊伍資源的增減：法術環、生命骰、每次休息可用的能力次數。
// 事件、委託、主動行動都透過這裡改動資源，並把變化記在報告的 changes.resources。
import { attrsOf, slotMaxFor, slotsLeft } from './character';
import { abilityDef } from './data';
export function recordResource(report, change) {
    if (report)
        (report.changes.resources ??= []).push(change);
}
/** 花掉一個至少 minCircle 環的法術環（用最低的）；沒有時回傳 null */
export function spendSlot(c, minCircle = 1) {
    const left = slotsLeft(c);
    for (let i = Math.max(0, minCircle - 1); i < left.length; i++) {
        if ((left[i] ?? 0) > 0) {
            c.slotsUsed[i] = (c.slotsUsed[i] ?? 0) + 1;
            return i + 1;
        }
    }
    return null;
}
/** 回復一個不超過 maxCircle 環、已用掉的法術環（回復最高的）；沒有時回傳 null */
export function restoreSlot(c, maxCircle = 9) {
    const max = slotMaxFor(c.class, c.level, attrsOf(c));
    for (let i = Math.min(maxCircle, max.length) - 1; i >= 0; i--) {
        if ((c.slotsUsed[i] ?? 0) > 0) {
            c.slotsUsed[i] -= 1;
            return i + 1;
        }
    }
    return null;
}
/** 法術環增減：delta < 0 花掉、> 0 回復 */
export function changeSlots(c, delta, circle, report) {
    let done = 0;
    for (let n = 0; n < Math.abs(delta); n++) {
        const got = delta < 0 ? spendSlot(c, circle ?? 1) : restoreSlot(c, circle ?? 9);
        if (got === null)
            break;
        done++;
        recordResource(report, { actor: c.id, kind: 'slot', delta: delta < 0 ? -1 : 1, detail: `${got} 環` });
    }
    return done;
}
/** 生命骰增減：delta < 0 花掉、> 0 回復 */
export function changeHitDice(c, delta, report) {
    const used = c.hitDiceUsed ?? 0;
    const next = Math.max(0, Math.min(c.level, used - delta));
    c.hitDiceUsed = next;
    const done = used - next;
    if (done)
        recordResource(report, { actor: c.id, kind: 'hit_dice', delta: done });
    return done;
}
/**
 * 主動行動時使用能力（例如用魅惑術幫談判）：法術花一個該環以上的法術環，每次休息限用的技能花一次次數，
 * 戲法與一般技能不花資源。加值：戲法 +1、技能 +2（限次技能 +3）、法術 +2 + 環數（最多 +6）。
 */
export function useAbilityOutOfCombat(c, abilityId, report) {
    if (!c.abilities.includes(abilityId))
        throw new Error(`${c.name}不會這項能力`);
    if (c.hp <= 0)
        throw new Error(`${c.name}倒下了`);
    const a = abilityDef(abilityId);
    if (a.type === 'spell') {
        const circle = spendSlot(c, a.circle ?? 1);
        if (circle === null)
            throw new Error(`${c.name}沒有 ${a.circle} 環以上的法術環了`);
        const change = { actor: c.id, kind: 'slot', delta: -1, detail: `${circle} 環（${a.name}）` };
        recordResource(report, change);
        return { ability: a, bonus: Math.min(6, 2 + (a.circle ?? 1)), cost: `${circle} 環法術環`, change };
    }
    if (a.type === 'skill' && a.uses?.per_rest !== undefined) {
        const used = c.usesPerRest[a.id] ?? 0;
        if (used >= a.uses.per_rest)
            throw new Error(`${a.name}要休息後才能再用`);
        c.usesPerRest[a.id] = used + 1;
        const change = { actor: c.id, kind: 'ability_use', delta: -1, detail: a.name };
        recordResource(report, change);
        return { ability: a, bonus: 3, cost: '一次使用次數', change };
    }
    return { ability: a, bonus: a.type === 'cantrip' ? 1 : 2, cost: '' };
}
