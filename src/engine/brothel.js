// 娼館（關閉成人向時顯示為按摩店，見 content.ts）：消費、老鴇。
// 被迫工作是主人的突發事件（slavery.json master_events 裡 cell 為 brothel 的事件），
// 無主的奴隸找老鴇當主人走「投靠新主人」（seek_master），成功後老鴇改刻娼妓契約。
import { adultScene, safeText } from './content';
import { locationById, workRules } from './data';
import { applyEffects } from './effects';
import { currentArea, currentCell } from './grid';
import { formatMoney } from './money';
import { npcRecord } from './npcs';
import { addAffinity, addCondition, isBound, pcOf } from './party';
import { madamId, presentHere } from './population';
import { ensureRelationship } from './social';
export function atBrothel(state) {
    return currentCell(state).kind === 'brothel';
}
/** 這座城的老鴇（有娼館的話） */
export function madamHere(state) {
    return npcRecord(state, madamId(state.location));
}
/** 帶娼妓標籤的人是老鴇或娼妓 */
export function isMadam(rec) {
    return !!rec.tags?.includes('prostitute') && !!rec.tags?.includes('merchant');
}
/** 消費的價格：依對象的種族（世界書的價格參考） */
export function patronPrice(state, target) {
    const r = workRules.brothel.patron;
    const rec = target ? npcRecord(state, target) : undefined;
    return Math.round(r.price_cc * (rec ? r.race_mult[rec.race] ?? 1 : 1));
}
function patronTarget(state, target) {
    if (!target)
        return undefined;
    const rec = npcRecord(state, target);
    if (!rec || !presentHere(state, rec.id))
        throw new Error('對方不在這裡');
    if (!rec.tags?.includes('prostitute'))
        throw new Error(safeText(`${rec.name}不是這裡的娼妓`));
    return rec;
}
export function setupPatron(state, target) {
    if (!atBrothel(state))
        throw new Error(safeText('要在娼館裡才能消費'));
    if (isBound(state))
        throw new Error(safeText('有主人的奴隸不能在娼館消費'));
    const rec = patronTarget(state, target);
    if (rec)
        ensureRelationship(state, rec);
    const r = workRules.brothel.patron;
    const price = patronPrice(state, target);
    if (state.money_cc < price)
        throw new Error(`錢不夠（要 ${formatMoney(price)}）`);
    return {
        ...adultScene(`在娼館與${rec?.name ?? '娼妓'}共度`),
        dc: r.dc, situational: [], hours: r.hours,
        targetName: rec?.name ?? safeText('娼館'),
        scene: safeText(`${locationById(state.location).name}的娼館`),
        outcomes: {
            critical: `賓主盡歡，只收 ${formatMoney(Math.round(price * (1 - r.discount)))}，身心放鬆（下次長休前檢定 +1）`,
            success: `付 ${formatMoney(price)}，身心放鬆（下次長休前檢定 +1）`,
            partial: `付 ${formatMoney(price)}，普通的一晚`,
            fail: `被多收了錢（${formatMoney(Math.round(price * (1 + r.overcharge)))}）`,
            fumble: `付 ${formatMoney(price)}，出門才發現錢袋被摸走了一些`,
        },
    };
}
export function applyPatron(state, report, target, degree) {
    const r = workRules.brothel.patron;
    const rec = target ? npcRecord(state, target) : undefined;
    const price = patronPrice(state, target);
    const cost = Math.min(state.money_cc, Math.round(price * (degree === 'critical' ? 1 - r.discount : degree === 'fail' ? 1 + r.overcharge : 1)));
    applyEffects(state, report, [{ type: 'money', amount: -cost }]);
    const lines = [`付了 ${formatMoney(cost)}。`];
    if (degree === 'critical' || degree === 'success') {
        addCondition(pcOf(state), 'relaxed', report);
        lines.push('身心都放鬆了下來。');
    }
    if (degree === 'fumble') {
        const lost = Math.min(state.money_cc - cost, Math.floor((state.money_cc - cost) * r.pickpocket_ratio));
        if (lost > 0) {
            applyEffects(state, report, [{ type: 'money', amount: -lost }]);
            lines.push(`出門才發現錢袋少了 ${formatMoney(lost)}。`);
        }
    }
    if (rec)
        addAffinity(state, report, rec.id, r.affinity[degree], '在娼館的一晚');
    return safeText(lines.join(''));
}
/** 這個區域的娼館就在身邊（同一格或相鄰）：被主人帶著經過時可能被迫工作 */
export function nearBrothel(state) {
    const area = currentArea(state);
    const pos = state.position;
    if (!pos || area.kind !== 'settlement')
        return false;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const x = pos.x + dx;
            const y = pos.y + dy;
            if (x < 0 || y < 0 || x >= area.width || y >= area.height)
                continue;
            if (area.cells[y * area.width + x]?.kind === 'brothel')
                return true;
        }
    }
    return false;
}
