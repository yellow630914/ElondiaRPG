// 旅途（見 docs/TRAVEL_EVENTS.md）：出發時把路程畫成一條單行道的臨時地圖，一格一天，事件出發時就擲好放在格子上。
//
// - 一般的路格：走進去花一天（官道住旅店付錢，其他路段吃乾糧，沒有乾糧就挨餓）。
// - 事件：原本的旅途事件與自動判定（走到時揭曉）、普通的選擇事件、戰鬥、高階事件（可能進入臨時地圖：洞窟、遺跡、驛站）、
//   特殊事件（特殊任務的開頭，stories.json 的 start.kind = travel）、主人的事件（身為奴隸時）。
// - 途經的地點與目的地各有一格；走到目的地才產生整趟旅程的旅行報告（花費、乾糧、時間軸）。
// - 事件的結果可以帶進臨時地圖（side_map，出口回到原本的地方），或改去別的地點（travel_to）。
import { checkBonus } from './perks';
import { attrOf, mod, proficiency, snapshot } from './character';
import { startCombat } from './combat';
import { enemies, locationById, regionById, slaveryRules, stories, wildEncounters } from './data';
import { applyEffects } from './effects';
import { assertNoStandoff, currentArea, ensureQuestTargets, findKind, generateSide, placeAt, position, reveal, storeArea, substituteGroup, } from './grid';
import { isBound, pcOf } from './party';
import { spawnVisitors } from './population';
import { assertMasterAllows, maybeMasterEvent } from './slavery';
import { addHours, commitReport, newReportId, withRng } from './state';
import { canStart, ensureStoryMarkers, startStory } from './story';
import { flagKey } from './storyFlags';
import { gateCheck } from './security';
import { toolBonus } from './tools';
import { arrive, daysToHours, EVENT_CHANCE, EVENTS, MODE_NAME, legFare, ROAD_DAILY_CC, rollLegDays } from './travel';
import { shortestPath } from './world';
import { enterWaystation } from './trade';
import travelEventsJson from '@data/rules/travel_events.json';
export const travelEvents = travelEventsJson;
export function roadTemplate(id) {
    return travelEvents.templates.find((t) => t.id === id);
}
export const ROAD_KEY = 'road';
// ---- 出發 ----
/**
 * 出發：在城門（或地下城的出口）畫出這趟旅程的單行道，站在起點。
 * 被城門的衛兵攔下時回傳盤查的紀錄，不會出發。
 */
export function startJourney(state, destination, intent, opts = {}) {
    if (state.road)
        throw new Error('已經在旅途中了');
    const path = shortestPath(state.location, destination);
    if (!path || path.legs.length === 0)
        throw new Error(`無法前往 ${destination}`);
    assertNoStandoff(state);
    assertMasterAllows(state);
    if (currentArea(state).kind === 'settlement') {
        const g = gateCheck(state);
        if (!g.ok) {
            if (g.report)
                return g.report;
            throw new Error(g.reason);
        }
    }
    const from = state.location;
    const area = withRng(state, (rng) => buildRoad(state, from, destination, path.legs, rng));
    const seaFare = path.legs.reduce((sum, l) => sum + legFare(l), 0) * state.party.length;
    state.road = {
        from, to: destination, start: { ...state.time }, modes: path.legs.map((l) => l.mode), hours: 0,
        money: -seaFare,
        timeline: [{ seq: 1, time: { ...state.time }, actor: 'pc', action: `出發・前往${locationById(destination).name}`, result: 'none' }],
        hpBefore: Object.fromEntries(state.party.map((m) => [m.id, m.hp])),
        ...(intent ? { intent } : {}),
        ...(opts.adult ? { adult: true } : {}),
    };
    delete state.roadEvent;
    delete state.side;
    // 離開地下城：這趟探索撿到的東西算是帶出來了
    delete state.expedition;
    state.areas = {};
    storeArea(state, area);
    placeAt(state, area, 0, 0);
    return undefined;
}
function weighted(rng, weights) {
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    let r = rng.next() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of entries)
        if ((r -= w) < 0)
            return k;
    return entries.at(-1)?.[0];
}
function buildRoad(state, from, to, legs, rng) {
    const cells = [{ kind: 'road', town: from }];
    legs.forEach((leg, li) => {
        const days = rollLegDays(rng, leg.days);
        const n = Math.max(1, Math.ceil(days));
        const hours = Math.round(daysToHours(days) / n);
        for (let i = 0; i < n; i++)
            cells.push({ kind: 'road', road: { leg: li, hours } });
        cells.push({ kind: li === legs.length - 1 ? 'arrive' : 'waypoint', town: leg.to, road: { leg: li, hours: 0 } });
    });
    const dayCells = cells.map((c, i) => (c.kind === 'road' && c.road ? i : -1)).filter((i) => i >= 0);
    const region = locationById(to).region;
    for (const i of dayCells) {
        const cell = cells[i];
        const mode = legs[cell.road.leg].mode;
        if (!rng.chance(travelEvents.chance[mode] ?? EVENT_CHANCE[mode]))
            continue;
        const fits = (t) => !t.modes || t.modes.includes(mode);
        const checks = travelEvents.templates.filter((t) => t.tier === 'normal' && t.kind === 'check' && fits(t));
        const choices = travelEvents.templates.filter((t) => t.tier === 'normal' && t.kind === 'choice' && fits(t));
        const advanced = travelEvents.templates.filter((t) => t.tier === 'advanced' && fits(t));
        const w = travelEvents.weights;
        const kind = weighted(rng, {
            auto: w.auto, choice: choices.length ? w.choice : 0, advanced: advanced.length ? w.advanced : 0,
            combat: travelEvents.combat_modes.includes(mode) ? w.combat : 0,
        });
        const roll = rng.int(1, 20);
        if (kind === 'combat') {
            const table = wildEncounters(locationById(legs[cell.road.leg].to).region);
            cells[i] = { ...cell, kind: 'encounter', group: rng.pick(table) };
        }
        else if (kind === 'choice') {
            cells[i] = { ...cell, kind: 'event', event: { tier: 'normal', template: rng.pick(choices).id } };
        }
        else if (kind === 'advanced') {
            cells[i] = { ...cell, kind: 'event', event: { tier: 'advanced', template: rng.pick(advanced).id, roll } };
        }
        else if (checks.length && rng.chance(0.5)) {
            cells[i] = { ...cell, kind: 'event', event: { tier: 'normal', template: rng.pick(checks).id, roll } };
        }
        else {
            cells[i] = { ...cell, kind: 'event', event: { tier: 'auto', hazard: { mode, index: rng.int(0, EVENTS[mode].length - 1) }, roll } };
        }
    }
    // 特殊事件：特殊任務的開頭（一趟最多一個）
    for (const def of stories) {
        if (def.start.kind !== 'travel' || !canStart(state, def))
            continue;
        if (def.start.regions?.length && !def.start.regions.includes(region))
            continue;
        if (!rng.chance(def.start.chance ?? 0.2) || !dayCells.length)
            continue;
        const i = rng.pick(dayCells);
        cells[i] = { kind: 'event', road: cells[i].road, event: { tier: 'special', story: def.id } };
        break;
    }
    // 被主人帶著：主人的事件
    if (isBound(state) && dayCells.length && rng.chance(slaveryRules.master_events.travel_chance)) {
        const free = dayCells.filter((i) => cells[i].event?.tier !== 'special');
        if (free.length) {
            const i = rng.pick(free);
            cells[i] = { kind: 'event', road: cells[i].road, event: { tier: 'master' } };
        }
    }
    return {
        key: ROAD_KEY, location: from, name: `前往${locationById(to).name}的旅途`, kind: 'road',
        width: cells.length, height: 1, cells, revealed: [],
    };
}
// ---- 前進 ----
/** 往前走一格（旅途是單行道） */
export function roadMove(state, dx, dy) {
    const road = state.road;
    if (!road)
        throw new Error('不在旅途中');
    if (dx !== 1 || dy !== 0)
        throw new Error('旅途是單行道，只能往前走');
    if (state.roadEvent)
        throw new Error('先決定怎麼應付眼前的事');
    const area = currentArea(state);
    const p = position(state);
    const x = p.x + 1;
    const cell = area.cells[x];
    if (!cell)
        throw new Error('已經走到底了');
    spendDay(state, road, cell);
    state.position = { area: area.key, x, y: 0, prev: { x: p.x, y: 0 } };
    reveal(area, x, 0);
    if (cell.kind === 'waypoint' && !cell.done) {
        cell.done = true;
        road.timeline.push({ seq: road.timeline.length + 1, time: { ...state.time }, actor: 'pc', action: `途經${locationById(cell.town).name}`, result: 'success' });
        return {};
    }
    if (cell.kind === 'arrive')
        return { report: finishJourney(state) };
    if (cell.done)
        return {};
    if (cell.kind === 'encounter' && cell.group?.length) {
        // 整組怪物都被自訂內容刪掉：換成這段路現在的遭遇
        if (!cell.group.some(([id]) => !!enemies[id])) {
            const group = substituteGroup(state, area, 'encounter', locationById(road.to).region);
            if (!group.length) {
                cell.done = true;
                return {};
            }
            cell.group = group;
        }
        return { combat: startCombat(state, cell.group, { scene: `${area.name}・${MODE_NAME[road.modes[cell.road.leg]]}`, cell: { area: area.key, x, y: 0 } }) };
    }
    if (cell.event)
        return triggerEvent(state, road, area, x, cell);
    return {};
}
/** 走一天：時間與官道的食宿（每一格只算一次；野外與海路不用吃乾糧） */
function spendDay(state, road, cell) {
    const meta = cell.road;
    if (!meta || meta.hours <= 0 || meta.paid)
        return;
    meta.paid = true;
    state.time = addHours(state.time, meta.hours);
    road.hours += meta.hours;
    if (road.modes[meta.leg] === 'road')
        road.money -= ROAD_DAILY_CC * state.party.length;
}
/** 隊伍裡最擅長這個屬性的人的檢定修正 */
function bestBonus(state, attr) {
    const best = [...state.party].filter((m) => m.hp > 0).sort((a, b) => attrOf(b, attr) - attrOf(a, attr))[0] ?? pcOf(state);
    return { name: best.name, bonus: mod(attrOf(best, attr)) + proficiency(best.level) + checkBonus(best, { context: 'road', attr }) };
}
function roll(state, check, natural) {
    const best = bestBonus(state, check.attr);
    const name = best.name;
    // 旅途類的工具（地圖、指南針）讓旅途事件的檢定容易一點
    const bonus = best.bonus + toolBonus(state, 'travel');
    const total = natural + bonus;
    const ok = natural === 20 || (natural !== 1 && total >= check.dc);
    return { ok, entry: { time: { ...state.time }, actor: 'pc', action: `${name}的檢定`, roll: { dice: `1d20${bonus >= 0 ? '+' : ''}${bonus}`, value: total, dc: check.dc }, result: ok ? 'success' : 'fail' } };
}
/** 旅途上現在最靠近的地點：這一段路的起點 */
function nearest(state) {
    const road = state.road;
    const area = state.areas?.[ROAD_KEY];
    if (!road || !area)
        return currentArea(state).location;
    const x = state.side ? state.side.back.x : position(state).x;
    for (let i = Math.min(x, area.cells.length - 1); i >= 0; i--)
        if (area.cells[i].town)
            return area.cells[i].town;
    return road.from;
}
function eventReport(state, title, hours = 0.5) {
    const start = { ...state.time };
    const area = currentArea(state);
    const at = nearest(state);
    const loc = locationById(state.road?.to ?? area.location);
    const pc = pcOf(state);
    return {
        schema_version: '0.1',
        report_id: newReportId(state),
        kind: 'event',
        time: { start, end: addHours(start, hours) },
        location: { at, region: locationById(at).region, scene: `${state.road ? `前往${loc.name}的旅途` : area.name}・${title}` },
        party: state.party.map((m) => snapshot(m, undefined, pc)),
        outcome: { result: 'neutral', tags: ['旅途'] },
        changes: {},
        narration: { pov: 'second_person', length: 'short', tone: '旅途感' },
        lore_keys: [locationById(at).name, loc.name, regionById(loc.region).name],
    };
}
function triggerEvent(state, road, area, x, cell) {
    const ev = cell.event;
    if (ev.tier === 'master') {
        cell.done = true;
        maybeMasterEvent(state, 1, { adult: road.adult });
        return {};
    }
    if (ev.tier === 'special') {
        cell.done = true;
        const def = stories.find((s) => s.id === ev.story);
        if (!def || !canStart(state, def))
            return {};
        const report = startStory(state, def.id, { text: def.start.text ?? def.summary });
        report.outcome.tags = [...new Set([...(report.outcome.tags ?? []), '旅途'])];
        return { report };
    }
    if (ev.tier === 'auto' && ev.hazard) {
        cell.done = true;
        const e = EVENTS[ev.hazard.mode]?.[ev.hazard.index];
        if (!e)
            return {};
        if (e.dc === undefined) {
            road.timeline.push({ seq: road.timeline.length + 1, time: { ...state.time }, actor: 'pc', action: e.action, result: 'none', effects: [{ type: 'note', text: e.text }] });
            return {};
        }
        // 求生檢定：出發時擲好的骰子，失敗時全隊受傷
        const r = roll(state, { attr: 'str', dc: e.dc }, ev.roll ?? 10);
        const report = eventReport(state, e.action);
        const effects = [{ type: 'note', text: r.ok ? e.text : e.failText ?? e.text }];
        if (!r.ok && e.failDamage) {
            withRng(state, (rng) => {
                for (const m of state.party) {
                    const before = m.hp;
                    const dmg = rollDice(rng, e.failDamage);
                    m.hp = Math.max(1, m.hp - dmg);
                    effects.push({ type: 'damage', target: m.id, amount: before - m.hp });
                }
            });
        }
        report.timeline = [{ seq: 1, ...r.entry, action: `求生檢定・${e.action}`, effects }];
        report.party = state.party.map((m) => snapshot(m, undefined, pcOf(state)));
        report.outcome = { result: r.ok ? 'success' : 'failure', summary: `${e.action}：${r.ok ? e.text : e.failText ?? e.text}。`, tags: ['旅途'] };
        road.timeline.push({ seq: road.timeline.length + 1, ...r.entry, action: e.action });
        return { report: commitReport(state, report) };
    }
    const tpl = ev.template ? roadTemplate(ev.template) : undefined;
    if (!tpl) {
        cell.done = true;
        return {};
    }
    if (tpl.kind === 'check' && tpl.check) {
        const r = roll(state, tpl.check, ev.roll ?? 10);
        const report = eventReport(state, tpl.title);
        report.timeline = [{ seq: 1, ...r.entry, action: tpl.title }];
        const lines = [tpl.text];
        lines.push(...applyRoadOutcome(state, report, r.ok ? tpl.success : tpl.fail));
        report.outcome = { result: r.ok ? 'success' : 'failure', summary: lines.join(''), tags: ['旅途', tpl.tier === 'advanced' ? '高階事件' : '旅途事件'] };
        report.narration = { ...report.narration, focus: [tpl.text] };
        road.timeline.push({ seq: road.timeline.length + 1, ...r.entry, action: tpl.title });
        // 高階的檢定成功：接著出現選項（例如要不要進洞窟）
        if (tpl.tier === 'advanced' && r.ok && tpl.options?.length)
            state.roadEvent = { x, template: tpl.id };
        else
            cell.done = true;
        const committed = commitReport(state, report);
        applyPendingMove(state);
        return { report: committed };
    }
    state.roadEvent = { x, template: tpl.id };
    return {};
}
function rollDice(rng, dice) {
    const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(dice);
    if (!m)
        return 1;
    let total = Number(m[3] ?? 0);
    for (let i = 0; i < Number(m[1]); i++)
        total += rng.int(1, Number(m[2]));
    return Math.max(0, total);
}
/** 套用旅途事件的結果：文字、旗標、效果；進入臨時地圖或改道在報告提交之後（applyPendingMove） */
export function applyRoadOutcome(state, report, o) {
    if (!o)
        return [];
    const lines = [];
    if (o.text)
        lines.push(o.text);
    for (const f of o.set_flags ?? [])
        (report.changes.flags ??= {})[flagKey(f)] = true;
    for (const f of o.clear_flags ?? [])
        (report.changes.flags ??= {})[flagKey(f)] = false;
    const notes = o.effects?.length ? applyEffects(state, report, o.effects) : [];
    if (notes.length)
        lines.push(notes.join('，') + '。');
    queueMove(state, o);
    return lines;
}
/** 記下結果要求的移動，報告提交之後再執行 */
export function queueMove(state, o) {
    if (o.travel_to && locationExists(o.travel_to))
        state.pendingMove = { travel_to: o.travel_to };
    else if (o.side_map && travelEvents.side_maps[o.side_map])
        state.pendingMove = { side_map: o.side_map };
}
function locationExists(id) {
    try {
        locationById(id);
        return true;
    }
    catch {
        return false;
    }
}
/** 等待回應的旅途事件：選一個選項（有檢定的依規則擲骰） */
export function answerRoadEvent(state, index) {
    const ev = state.roadEvent;
    const tpl = ev && roadTemplate(ev.template);
    const o = tpl?.options?.[index];
    if (!ev || !tpl || !o)
        throw new Error('沒有這個選項');
    const report = eventReport(state, tpl.title);
    let ok = true;
    if (o.check) {
        const natural = withRng(state, (rng) => rng.int(1, 20));
        const r = roll(state, o.check, natural);
        ok = r.ok;
        report.timeline = [{ seq: 1, ...r.entry, action: `${tpl.title}：${o.label}` }];
    }
    const lines = [`${tpl.title}：${o.label}。`, ...applyRoadOutcome(state, report, ok ? o.success : o.fail)];
    report.outcome = { result: o.check ? (ok ? 'success' : 'failure') : 'neutral', summary: lines.join(''), tags: ['旅途', tpl.tier === 'advanced' ? '高階事件' : '旅途事件'] };
    report.narration = { ...report.narration, focus: [tpl.text, `主角的選擇：${o.label}`] };
    const cell = currentArea(state).cells[ev.x];
    if (cell)
        cell.done = true;
    delete state.roadEvent;
    state.road?.timeline.push({ seq: state.road.timeline.length + 1, time: { ...state.time }, actor: 'pc', action: `${tpl.title}：${o.label}`, result: o.check ? (ok ? 'success' : 'fail') : 'none' });
    const committed = commitReport(state, report);
    applyPendingMove(state);
    return committed;
}
// ---- 抵達 ----
/** 走到目的地（或改道到別的地點）：產生整趟旅程的旅行報告，然後抵達 */
export function finishJourney(state, to) {
    const road = state.road;
    if (!road)
        throw new Error('不在旅途中');
    const dest = to ?? road.to;
    const pc = pcOf(state);
    const party = state.party.map((m) => snapshot(m, { ...m, hp: road.hpBefore[m.id] ?? m.hp }, pc));
    const timeline = [...road.timeline, {
            seq: road.timeline.length + 1, time: { ...state.time }, actor: 'pc',
            action: dest === road.to ? `抵達${locationById(dest).name}` : `改道・抵達${locationById(dest).name}`, result: 'success',
        }];
    const destLoc = locationById(dest);
    const report = {
        schema_version: '0.1',
        report_id: newReportId(state),
        kind: 'travel',
        time: { start: road.start, end: { ...state.time } },
        location: { at: road.from, to: dest, region: destLoc.region },
        party,
        timeline,
        outcome: {
            result: 'arrived',
            summary: `從${locationById(road.from).name}${dest === road.to ? '' : `出發前往${locationById(road.to).name}，途中改道，`}抵達${destLoc.name}，耗時約 ${Math.round((road.hours / 24) * 10) / 10} 天。`,
            tags: [...new Set(road.modes.map((m) => MODE_NAME[m]))],
        },
        changes: { ...(road.money ? { money_cc: road.money } : {}) },
        narration: { pov: 'second_person', length: 'short', tone: '旅途感', ...(road.intent ? { player_intent: road.intent } : {}) },
        lore_keys: [locationById(road.from).name, destLoc.name, regionById(destLoc.region).name],
    };
    delete state.road;
    delete state.roadEvent;
    delete state.side;
    const committed = commitReport(state, report);
    arrive(state);
    return committed;
}
// ---- 臨時地圖 ----
/** 進入臨時地圖：站在出口，離開時回到現在的位置 */
export function enterSide(state, template) {
    const def = travelEvents.side_maps[template];
    if (!def)
        throw new Error('沒有這種地方');
    if (state.side)
        leaveSide(state);
    const back = { ...position(state) };
    const here = currentArea(state);
    const region = locationById(state.road?.to ?? here.location).region;
    const table = wildEncounters(region);
    const key = `side/${template}`;
    const area = withRng(state, (rng) => {
        const a = generateSide(state, key, template, def, here.location, table, rng);
        ensureQuestTargets(state, a, rng, table);
        ensureStoryMarkers(state, a, rng);
        return a;
    });
    storeArea(state, area);
    state.side = { area: key, back: { area: back.area, x: back.x, y: back.y } };
    const exit = findKind(area, 'exit') ?? { x: 0, y: 0 };
    if (def.visitors)
        spawnVisitors(state, area, exit);
    if (template === 'waystation')
        enterWaystation(state);
    placeAt(state, area, exit.x, exit.y);
    return area;
}
/** 離開臨時地圖，回到進去之前的位置（倒下時也一樣） */
export function leaveSide(state) {
    const side = state.side;
    if (!side)
        return;
    delete state.side;
    if (state.areas)
        delete state.areas[side.area];
    state.position = { ...side.back };
}
/** 執行事件結果要求的移動（報告提交之後） */
export function applyPendingMove(state) {
    const m = state.pendingMove;
    if (!m)
        return;
    delete state.pendingMove;
    if (m.travel_to) {
        if (state.road) {
            finishJourney(state, m.travel_to);
        }
        else {
            // 不在旅途：被帶到那裡
            if (state.side)
                leaveSide(state);
            state.location = m.travel_to;
            arrive(state);
        }
    }
    else if (m.side_map) {
        enterSide(state, m.side_map);
    }
}
export function roadProgress(state) {
    const road = state.road;
    if (!road)
        return undefined;
    const area = state.areas?.[ROAD_KEY];
    const total = area ? area.cells.reduce((s, c) => s + (c.road?.hours ?? 0), 0) : road.hours;
    return {
        day: Math.floor(road.hours / 24) + 1, days: Math.max(1, Math.round((total / 24) * 10) / 10), from: road.from, to: road.to,
        money: road.money,
        recent: road.timeline.slice(-3).map((t) => t.effects?.find((e) => e.type === 'note')?.text ? `${t.action}：${t.effects.find((e) => e.type === 'note').text}` : t.action),
    };
}
