// 衛兵警戒、通緝、罰金與聲望（見 docs/NPC_SYSTEM.md 第 9 節，規則在 data/rules/security.json）。
import { checkModifiers } from './perks';
import securityJson from '@data/rules/security.json';
import { attrOf, mod, proficiency, snapshot } from './character';
import { economy, geography, locationById, regionById } from './data';
import { formatMoney } from './money';
import { pcOf } from './party';
import { roll, withBonus } from './rng';
import { addHours, commitReport, newReportId, withRng } from './state';
export const securityRules = securityJson;
export function factionName(id) {
    return geography.factions.find((f) => f.id === id)?.name ?? id;
}
export function reputationOf(state, faction) {
    return faction ? state.reputation[faction] ?? 0 : 0;
}
/** 依地點所屬勢力的聲望：買入、賣出價與罰金的倍率 */
export function reputationBand(state, locId = state.location) {
    const rep = reputationOf(state, locationById(locId).faction);
    return securityRules.reputation_bands.find((b) => rep >= b.min) ?? securityRules.reputation_bands.at(-1);
}
// ---- 警戒與通緝 ----
/** 地點目前的警戒（最後一次犯案後每 decay_days 天降 1） */
export function alertLevel(state, locId = state.location) {
    const a = state.alerts?.[locId];
    if (!a)
        return 0;
    return Math.max(0, a.level - Math.floor((state.time.day - a.day) / securityRules.alert.decay_days));
}
export function isWanted(state, faction) {
    return !!faction && !!state.wanted?.[faction];
}
/** 提高地點的警戒（只有聚落有衛兵）；達到上限時被該勢力通緝。回傳說明文字。 */
export function raiseAlert(state, locId, n) {
    const loc = locationById(locId);
    if (loc.type === 'dungeon' || n <= 0)
        return '';
    const level = Math.min(securityRules.alert.max, alertLevel(state, locId) + n);
    (state.alerts ??= {})[locId] = { level, day: state.time.day };
    delete state.gatePass?.[locId];
    if (level >= securityRules.alert.max && loc.faction && !isWanted(state, loc.faction)) {
        ;
        (state.wanted ??= {})[loc.faction] = { day: state.time.day };
        return `${loc.name}的衛兵警戒升到 ${level}，你被${factionName(loc.faction)}通緝了。`;
    }
    return `${loc.name}的衛兵警戒升到 ${level}。`;
}
function living() {
    return economy.commoner_living_cc_per_day;
}
/** 警戒罰金：一般人生活 alert_days 天 × 警戒等級 × 聲望倍率 */
export function alertFine(state, locId = state.location) {
    return Math.round(living() * securityRules.fines.alert_days * alertLevel(state, locId) * reputationBand(state, locId).fine);
}
/** 通緝罰金：一般人生活 wanted_days 天 × 聲望倍率 */
export function wantedFine(state, faction) {
    const rep = reputationOf(state, faction);
    const band = securityRules.reputation_bands.find((b) => rep >= b.min) ?? securityRules.reputation_bands.at(-1);
    return Math.round(living() * securityRules.fines.wanted_days * band.fine);
}
/** 這座城的城門現在要繳的罰金（通緝優先）；不用繳時為 0 */
export function fineDue(state, locId = state.location) {
    const faction = locationById(locId).faction;
    if (isWanted(state, faction))
        return { amount: wantedFine(state, faction), wanted: true };
    return { amount: alertFine(state, locId), wanted: false };
}
function securityReport(state, summary, result) {
    const loc = locationById(state.location);
    const pc = pcOf(state);
    const start = { ...state.time };
    return {
        schema_version: '0.1',
        report_id: newReportId(state),
        kind: 'social',
        time: { start, end: addHours(start, 0.25) },
        location: { at: state.location, region: loc.region, scene: `${loc.name}的城門` },
        party: state.party.map((m) => snapshot(m, undefined, pc)),
        outcome: { result, summary, tags: ['城門'] },
        changes: {},
        narration: { pov: 'second_person', length: 'short' },
        lore_keys: [loc.name, regionById(loc.region).name],
    };
}
/** 在城門繳罰金：通緝時解除通緝，否則清空警戒 */
export function payFine(state) {
    const loc = locationById(state.location);
    const due = fineDue(state);
    if (!due.amount)
        throw new Error('沒有要繳的罰金');
    if (state.money_cc < due.amount)
        throw new Error(`罰金 ${formatMoney(due.amount)}，錢不夠`);
    const report = securityReport(state, due.wanted
        ? `在${loc.name}的城門繳了 ${formatMoney(due.amount)} 的罰金（賄賂），${factionName(loc.faction)}解除了對你的通緝。`
        : `在${loc.name}的城門繳了 ${formatMoney(due.amount)} 的罰金，衛兵不再盯著你。`, 'success');
    report.changes.money_cc = -due.amount;
    if (due.wanted)
        delete state.wanted[loc.faction];
    delete state.alerts?.[loc.id];
    delete state.gateBlock?.[loc.id];
    return commitReport(state, report);
}
/** 抵達時被擋在城外（付不出罰金） */
export function turnedAway(state, reason) {
    return commitReport(state, securityReport(state, `抵達${locationById(state.location).name}，但衛兵不讓你進城：${reason}你只好先待在城外。`, 'failure'));
}
/** 抵達聚落時的盤查：沒過時，付得起就自動繳罰金，付不起就被擋在城外（回傳 false） */
export function arrivalCheck(state) {
    if (locationById(state.location).type === 'dungeon')
        return true;
    const g = gateCheck(state);
    if (g.ok)
        return true;
    const due = fineDue(state);
    if (due.amount && state.money_cc >= due.amount) {
        payFine(state);
        return true;
    }
    turnedAway(state, g.reason ?? '');
    return false;
}
/**
 * 出入城門的盤查：通緝時不能通過（要繳罰金）；警戒 1 以上要檢定，當天通過就不再查，失敗當天就過不去。
 */
export function gateCheck(state, locId = state.location) {
    const loc = locationById(locId);
    if (loc.type === 'dungeon')
        return { ok: true };
    const day = state.time.day;
    if (isWanted(state, loc.faction)) {
        return { ok: false, reason: `你被${factionName(loc.faction)}通緝，衛兵不讓你通過；繳交罰金 ${formatMoney(wantedFine(state, loc.faction))} 可以解除通緝。` };
    }
    const level = alertLevel(state, locId);
    if (level === 0 || state.gatePass?.[locId] === day)
        return { ok: true };
    if (state.gateBlock?.[locId] === day) {
        return { ok: false, reason: `衛兵記得你，今天不會放你過去；繳交罰金 ${formatMoney(alertFine(state, locId))} 就能通過。` };
    }
    const pc = pcOf(state);
    const attr = mod(attrOf(pc, 'dex')) >= mod(attrOf(pc, 'cha')) ? 'dex' : 'cha';
    const extra = checkModifiers(pc, { context: 'gate', attr });
    const dice = withBonus('1d20', mod(attrOf(pc, attr)) + proficiency(pc.level) + extra.reduce((s, x) => s + x.value, 0));
    const dc = securityRules.alert.gate_dc_base + securityRules.alert.gate_dc_per_level * level;
    const r = withRng(state, (rng) => roll(rng, dice));
    const ok = r.total >= dc;
    if (ok)
        (state.gatePass ??= {})[locId] = day;
    else
        (state.gateBlock ??= {})[locId] = day;
    const report = securityReport(state, ok ? `${loc.name}的衛兵盤查了一番，你${attr === 'dex' ? '低調地混了過去' : '三言兩語應付了過去'}。` : `${loc.name}的衛兵認出了你，把你攔了下來。`, ok ? 'success' : 'failure');
    report.timeline = [{
            seq: 1, time: report.time.start, actor: 'pc', action: `${attr === 'dex' ? '靈巧' : '魅力'}檢定・城門盤查（警戒 ${level}）`,
            roll: { dice, value: r.total, dc }, result: ok ? 'success' : 'fail',
        }];
    commitReport(state, report);
    return ok
        ? { ok: true, report }
        : { ok: false, report, reason: `衛兵不讓你通過；繳交罰金 ${formatMoney(alertFine(state, locId))} 就能通過。` };
}
/** 貴族區與王城：通緝中不能進入；王城需要聲望 */
export function zoneEntryBlock(state, zone) {
    if (zone !== 'noble' && zone !== 'palace')
        return null;
    const loc = locationById(state.location);
    if (isWanted(state, loc.faction))
        return `你被${factionName(loc.faction)}通緝，衛兵不讓你進入${zone === 'palace' ? '王城' : '貴族區'}。`;
    if (zone === 'palace' && reputationOf(state, loc.faction) < securityRules.palace_reputation && !state.flags[`palace_permit:${loc.id}`]) {
        return `王城的衛兵擋住了你：需要${loc.faction ? factionName(loc.faction) : '這裡'}的聲望達到 ${securityRules.palace_reputation}，或是得到許可。`;
    }
    return null;
}
/** 犯案被目擊：地點警戒與勢力聲望下降（同一個勢力只扣一次） */
export function consequences(state, report, places) {
    const notes = [];
    const factions = new Set();
    for (const p of places) {
        const loc = locationById(p.location);
        const note = raiseAlert(state, p.location, p.alert);
        if (note)
            notes.push(note);
        if (loc.faction && p.reputation && !factions.has(loc.faction)) {
            factions.add(loc.faction);
            (report.changes.reputation ??= []).push({ faction: loc.faction, delta: p.reputation });
        }
    }
    return notes;
}
