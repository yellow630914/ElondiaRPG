// 情報（冒險筆記）：情報商賣的兩種情報（見 docs/TRAVEL_EVENTS.md 第 5 節）。
// - 事件點：在某座城鎮的近郊或地下城的某一層放一個事件——盤踞的強敵（打倒有額外報酬）、藏起來的寶物、流浪商人。
//   進入那一區時放一格（有效期限內），完成或過期就拿掉。
// - 任務消息：開始一個特殊任務（stories.json 的 start.kind = informant）。
import { damageTypeName, dungeonEncounters, enemies, geography, locationById, stories, wildEncounters, DUNGEON_LAYER_IDS, DUNGEON_LAYER_NAME, } from './data';
import { DUNGEON_LAYERS } from './grid';
import { pcOf } from './party';
import { canStart } from './story';
import { shortestPath } from './world';
const LAYER_NAME = DUNGEON_LAYER_NAME;
const LAYERS = DUNGEON_LAYER_IDS;
export function addIntel(state, spec) {
    const list = (state.intel ??= []);
    const it = { ...spec, id: `intel-${state.time.day}-${list.length + 1}`, from: state.location, time: { ...state.time }, status: 'active' };
    list.push(it);
    return it;
}
/** 過期的事件點 */
export function expireIntel(state) {
    for (const it of state.intel ?? [])
        if (it.status === 'active' && it.until !== undefined && state.time.day > it.until)
            it.status = 'expired';
}
export function intelPlace(it) {
    if (!it.location)
        return '';
    const loc = locationById(it.location);
    return it.layer ? `${loc.name}・${LAYER_NAME[it.layer]}` : `${loc.name}近郊`;
}
// ---- 地圖上的事件點 ----
function layerOf(area) {
    return area.kind === 'dungeon' ? DUNGEON_LAYERS[area.layer ?? 0]?.id : undefined;
}
/** 這一區該有的事件點 */
function pointsFor(state, area) {
    expireIntel(state);
    const layer = layerOf(area);
    return (state.intel ?? []).filter((it) => it.kind === 'point' && it.status === 'active' && it.location === area.location &&
        ((area.kind === 'wild' && !it.layer) || (area.kind === 'dungeon' && it.layer === layer)));
}
/** 進入近郊或地下城的一層時放上事件點；已經結束或過期的拿掉 */
export function ensureIntelPoints(state, area, rng) {
    if (area.kind !== 'wild' && area.kind !== 'dungeon')
        return;
    const want = pointsFor(state, area);
    const ids = new Set(want.map((it) => it.id));
    area.cells.forEach((c, i) => {
        if (c.intel && !ids.has(c.intel))
            area.cells[i] = { kind: 'floor' };
    });
    const have = new Set(area.cells.map((c) => c.intel).filter(Boolean));
    const entry = area.cells.findIndex((c) => c.kind === 'exit' || c.kind === 'stairs_up');
    for (const it of want) {
        if (have.has(it.id))
            continue;
        const free = area.cells.map((c, i) => (c.kind === 'floor' && Math.abs(i - entry) > 1 ? i : -1)).filter((i) => i >= 0);
        if (!free.length)
            return;
        const i = free[rng.int(0, free.length - 1)];
        area.cells[i] = it.event === 'combat'
            ? { kind: 'elite', group: it.group ?? [], intel: it.id }
            : it.event === 'chest'
                ? { kind: 'chest', level: it.level ?? 1, intel: it.id }
                : { kind: 'merchant', intel: it.id };
    }
}
export function intelById(state, id) {
    return id ? state.intel?.find((it) => it.id === id) : undefined;
}
/** 事件點結束（打倒強敵、打開寶物） */
export function finishIntel(state, id) {
    const it = intelById(state, id);
    if (it && it.status === 'active')
        it.status = 'done';
}
/** 打倒情報裡的強敵：額外的報酬 */
export function intelBounty(it) {
    const level = it.level ?? 1;
    return [{ type: 'money', amount: 40 * level }, { type: 'xp', amount: 20 * level }];
}
/** 附近的地點：這座城鎮的近郊，加上 7 天內可以到的地下城 */
function nearbyDungeons(from) {
    return geography.locations
        .filter((l) => l.type === 'dungeon' && dungeonEncounters[l.id])
        .filter((l) => {
        const p = shortestPath(from, l.id);
        return p !== null && p.days[1] <= 7;
    })
        .map((l) => l.id);
}
function strongest(table) {
    return [...table].sort((a, b) => b.reduce((s, [, n]) => s + n, 0) - a.reduce((s, [, n]) => s + n, 0))[0] ?? [];
}
/** 附近可以放事件點的地方：這座城鎮的近郊，加上 7 天內可以到的地下城的每一層 */
export function nearbyPlaces(from) {
    const here = locationById(from);
    const places = [];
    if (here.type !== 'dungeon')
        places.push({ location: here.id, table: wildEncounters(here.region), tier: 0 });
    for (const d of [...new Set([...(here.type === 'dungeon' ? [here.id] : []), ...nearbyDungeons(from)])])
        places.push(...dungeonPlaces(d));
    return places;
}
/** 一個地點可以放事件點的地方：聚落是近郊，地下城是有遭遇表的每一層（layer 指定時只有那一層） */
export function placesAt(location, layer) {
    const loc = locationById(location);
    if (loc.type !== 'dungeon')
        return [{ location, table: wildEncounters(loc.region), tier: 0 }];
    return dungeonPlaces(location).filter((p) => !layer || p.layer === layer);
}
function dungeonPlaces(d) {
    const out = [];
    for (const [i, layer] of LAYERS.entries()) {
        const table = dungeonEncounters[d]?.[layer];
        if (table?.length)
            out.push({ location: d, layer, table, tier: i + 1 });
    }
    return out;
}
/** 一則事件點情報的內容（還沒記進筆記）：盤踞的強敵、藏寶處或流浪商人 */
export function makePoint(state, p, event, validDays) {
    const pc = pcOf(state);
    const level = Math.max(1, ...p.table.flat().map(([id]) => enemies[id]?.level ?? 1));
    const place = intelPlace(p);
    const until = state.time.day + (event === 'merchant' ? Math.max(1, validDays - 2) : validDays);
    let title = '';
    let text = '';
    let group;
    if (event === 'combat') {
        const base = strongest(p.table);
        group = base.map(([id, c], i) => [id, i === 0 ? c + 1 : c]);
        const boss = enemies[group[0]?.[0] ?? ''];
        const weak = Object.entries(boss?.resist ?? {}).filter(([, v]) => (v ?? 0) > 0).map(([k]) => k);
        title = `${place}的${boss?.name ?? '魔物'}巢穴`;
        text = `一群${boss?.name ?? '魔物'}在${place}盤踞，附近的人說牠們搶了不少值錢的東西。${weak.length ? `聽說牠們怕${weak.map((w) => damageTypeName(w)).join('、')}。` : ''}打倒牠們有額外的收穫。`;
    }
    else if (event === 'chest') {
        title = `${place}的藏寶處`;
        text = `有人把一批值錢的東西藏在${place}，還沒來得及取回。`;
    }
    else {
        title = `${place}的流浪商人`;
        text = `一位流浪商人這幾天會在${place}擺攤，賣的都是城裡少見的東西。`;
    }
    return {
        title, text, location: p.location, ...(p.layer ? { layer: p.layer } : {}), event,
        ...(group ? { group } : {}), level: Math.max(level, pc.level) + (event === 'chest' ? 2 : 0), until,
    };
}
/**
 * 今天的事件點情報（每家情報商每天幾則）：地點、事件、價格。
 * prices 依層數（近郊、周邊、淺層、中層、深層），mult 是地點的價格倍率。
 */
export function pointOffers(state, rng, n, prices, validDays, mult) {
    const places = nearbyPlaces(state.location);
    const out = [];
    for (let k = 0; k < n && places.length; k++) {
        const p = places.splice(rng.int(0, places.length - 1), 1)[0];
        const event = rng.pick(['combat', 'combat', 'chest', 'chest', 'merchant']);
        const price = Math.round((prices[p.tier] ?? prices.at(-1) ?? 100) * mult);
        const intel = makePoint(state, p, event, validDays);
        out.push({
            id: `info:point:${p.location}:${p.layer ?? 'wild'}:${event}`,
            title: intel.title, desc: `${intel.text}（第 ${intel.until} 天前有效）`, price,
            gets: [{ type: 'intel', intel }],
        });
    }
    return out;
}
/** 情報商賣的特殊任務消息 */
export function storyOffers(state, mult) {
    return stories
        .filter((def) => def.start.kind === 'informant' && (!def.start.location || def.start.location === state.location) && canStart(state, def))
        .filter((def) => !(state.intel ?? []).some((it) => it.kind === 'story' && it.story === def.id))
        .map((def) => ({
        id: `info:story:${def.id}`,
        title: `「${def.title}」的消息`,
        desc: def.start.text ?? def.summary,
        price: Math.round((def.start.price ?? 100) * mult),
        gets: [{ type: 'start_story', story: def.id }],
    }));
}
