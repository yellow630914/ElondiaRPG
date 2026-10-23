// 走格子系統。
//
// 每個地點由區塊組成，區塊由格子組成：
// - 城市與城鎮的區塊是固定地圖（data/world/maps.json），可在區塊間通行，城門可出城或啟程旅行。
// - 城鎮近郊（荒野）與冒險區域（周邊 → 淺層 → 中層 → 深層）是隨機生成的格子，存在 GameState.areas，
//   有戰爭迷霧；離開後重新進入會重新生成（近郊每天換一次）。
// 走進格子會觸發內容：遭遇（戰鬥）、陷阱（檢定）、資源（採集）等；設施與樓梯等需要在格子上選擇動作。
import { checkBonus, checkModifiers, modifierNote } from './perks';
import { safeText } from './content';
import mapsJson from '@data/world/maps.json';
import { attrOf, mod, proficiency, snapshot } from './character';
import { startCombat } from './combat';
import { attrName, dungeonEncounters, enemies, geography, itemDef, locationById, regionById, shopRules, wildEncounters, landmarkDef, landmarks, dungeonDepth, } from './data';
import { forgeItemFor, gearRules, MATERIAL_KINDS, randomGear, registerGear } from './gear';
import { questTargets } from './materialQuests';
import { ensureStoryMarkers } from './story';
import { applyPendingMove, leaveSide, roadMove } from './road';
import { ensureIntelPoints, finishIntel } from './intel';
import { formatMoney } from './money';
import { spawnVisitors } from './population';
import { gateCheck, zoneEntryBlock } from './security';
import { assertMasterAllows } from './slavery';
import { assertMayLeaveHouse, atMasterHome, touchMasterHome } from './masterHome';
import { roll, withBonus } from './rng';
import { attemptRetreat, reachLayer, startExpedition } from './expedition';
import { homeById, overlayLots } from './homes';
import { burnStep, inDarkness, layerLighting, lightingRules, sightIn } from './light';
import { bestTool } from './tools';
import { addHours, commitReport, newReportId, player, withRng } from './state';
export const ZONES = ['town', 'noble', 'palace', 'temple', 'brothel', 'outskirts', 'dungeon'];
const maps = mapsJson;
export const CELL_NAME = {
    floor: '道路', wall: '牆', water: '水道',
    inn: '旅店', guild: '冒險者公會', tavern: '酒館', shop: '雜貨店', temple: '神殿', gate: '城門', link: '通道', brothel: '娼館',
    smithy: '鐵匠鋪', tailor: '裁縫店', jeweler: '珠寶店', magic: '魔法物品店', informant: '情報商', tattoo: '刺青店', carver: '刻印師',
    encounter: '遭遇', elite: '強敵', boss: '層主', trap: '陷阱', resource: '資源', safe: '安全房', chest: '寶箱',
    stairs_down: '往下一層', stairs_up: '往上一層', exit: '出口', quest: '委託地點',
    road: '路', waypoint: '途經', arrive: '目的地', event: '事件', merchant: '流浪商人',
    lot: '待售的房子', yard: '院子', manor: '民宅',
};
/** 地圖與場所標題用的圖示：每一種設施都要有 */
export const CELL_ICON = {
    inn: '🛏️', guild: '🏛️', tavern: '🍺', shop: '🛒', temple: '⛪', gate: '🚪', link: '➡️', brothel: '🏮',
    smithy: '⚒️', tailor: '🧵', jeweler: '💍', magic: '🔮', informant: '🕵️', tattoo: '🖋️', carver: '🔏',
    encounter: '⚔️', elite: '💀', boss: '👑', resource: '🌿', safe: '🔥', chest: '🎁',
    stairs_down: '⬇️', stairs_up: '⬆️', exit: '🚪', quest: '❗', water: '〰️',
    waypoint: '🏘️', arrive: '🏁', event: '❔', merchant: '🧳',
    lot: '🪧', manor: '🏚️',
};
// 地標的圖示（內容編輯器改了會重設）
for (const l of Object.values(landmarks))
    CELL_ICON[l.id] = l.emoji;
/** 格子的名稱（關閉成人向時，娼館顯示為按摩店） */
export function cellName(kind) {
    return safeText(CELL_NAME[kind] ?? shopRules.types[kind]?.name ?? landmarkDef(kind)?.name ?? '');
}
// ---- 世界設定擺的商店 ----
// 內容編輯器可以移動內建商店的位置、擺自建的商店：套用內容時算好每個區塊要改的格子，建立聚落區塊時疊上去
/** 區塊 key → 格子的 index → 改成的種類 */
let cellOverrides = {};
export function setCellOverrides(map) {
    cellOverrides = map;
    blockKinds.clear();
}
/** 地標改了位置或增減時：清掉各區塊設施的快取 */
export function invalidateBlocks() {
    blockKinds.clear();
}
/** 各聚落區塊有哪些設施（settlementBlocks 用；換位置時清掉） */
const blockKinds = new Map();
// 民宅：不是主人的家時不能進入（是主人的家時疊成通往屋內的通道）
const WALKABLE_BLOCKERS = ['wall', 'water', 'manor'];
export const DUNGEON_LAYERS = maps.generation.dungeon.layers;
// ---- 區域 ----
export function blocksFor(loc) {
    const custom = maps.maps[loc.id];
    if (custom)
        return custom.blocks;
    const template = maps.templates[maps.template_by_type[loc.type] ?? 'town'] ?? maps.templates.town;
    return template.blocks;
}
export function settlementKey(locationId, blockId) {
    return `${locationId}/${blockId}`;
}
function palaceName(loc) {
    return (loc.faction && maps.palace_names[loc.faction]) || '王城';
}
/** 一個地點有哪些地區（依地圖的區塊與設施） */
export function zonesOf(loc) {
    const zones = new Set(['town', 'outskirts']);
    for (const b of blocksFor(loc)) {
        if (b.zone)
            zones.add(b.zone);
        if (b.grid.some((row) => row.includes('C')))
            zones.add('temple');
        if (b.grid.some((row) => row.includes('B')))
            zones.add('brothel');
    }
    return [...zones];
}
/** 聚落的各區塊：區域 key、地區、有哪些設施 */
export function settlementBlocks(loc) {
    if (loc.type === 'dungeon')
        return [];
    return blocksFor(loc).map((b) => ({
        key: settlementKey(loc.id, b.id),
        zone: b.zone ?? 'town',
        // 包含世界設定移動或擺上的商店
        kinds: kindsOfBlock(loc, b),
    }));
}
function kindsOfBlock(loc, b) {
    const key = settlementKey(loc.id, b.id);
    let kinds = blockKinds.get(key);
    if (!kinds)
        blockKinds.set(key, (kinds = new Set(buildBlock(loc, b).cells.map((c) => c.kind))));
    return kinds;
}
/** 主角現在所在的地區：站在神殿格上是神殿，其餘依區域 */
export function currentZone(state) {
    const area = currentArea(state);
    if (area.kind === 'dungeon')
        return 'dungeon';
    if (area.kind === 'wild' || area.kind === 'road' || area.kind === 'side')
        return 'outskirts';
    if (currentCell(state).kind === 'temple')
        return 'temple';
    if (currentCell(state).kind === 'brothel')
        return 'brothel';
    return area.zone ?? 'town';
}
export function outskirtsKey(locationId) {
    return `${locationId}/outskirts`;
}
export function layerKey(locationId, layer) {
    return `${locationId}/L${layer}`;
}
/** 固定地圖的區塊（每次由資料建立，不存檔）；overlay 為 false 時不疊世界設定擺的商店 */
function buildBlock(loc, block, overlay = true) {
    const width = block.grid[0].length;
    const height = block.grid.length;
    const cells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const ch = block.grid[y][x] ?? '#';
            if (/[1-9]/.test(ch)) {
                const target = block.links?.[ch];
                const targetBlock = blocksFor(loc).find((b) => b.id === target);
                const pos = targetBlock ? findChar(targetBlock, ch) : null;
                cells.push(pos && target ? { kind: 'link', link: { area: settlementKey(loc.id, target), ...pos } } : { kind: 'wall' });
            }
            else {
                cells.push({ kind: maps.legend[ch]?.kind ?? 'wall' });
            }
        }
    }
    const key = settlementKey(loc.id, block.id);
    const over = overlay ? cellOverrides[key] : undefined;
    for (const [i, kind] of Object.entries(over ?? {}))
        if (cells[Number(i)])
            cells[Number(i)] = { kind };
    // 城鎮的特色地標：擺在道路上（被別的東西佔住時不顯示）
    for (const l of Object.values(landmarks)) {
        if (l.at.area !== key || l.at.x >= width || l.at.y >= height)
            continue;
        const i = l.at.y * width + l.at.x;
        if (cells[i]?.kind === 'floor')
            cells[i] = { kind: l.id };
    }
    return {
        key: settlementKey(loc.id, block.id),
        location: loc.id,
        name: block.name.split('{town}').join(loc.name).split('{palace}').join(palaceName(loc)),
        kind: 'settlement',
        ...(block.zone && block.zone !== 'town' ? { zone: block.zone } : {}),
        width, height, cells,
    };
}
function findChar(block, ch) {
    for (let y = 0; y < block.grid.length; y++) {
        const x = block.grid[y].indexOf(ch);
        if (x >= 0)
            return { x, y };
    }
    return null;
}
/** 取得區域：固定地圖即時建立，隨機區域從存檔讀取。 */
export function getArea(state, key) {
    const stored = state.areas?.[key];
    if (stored)
        return stored;
    // 玩家的房子：存在房子的資料裡
    if (key.startsWith('home/')) {
        const area = homeById(state, key.split('/')[1])?.areas[key];
        if (!area)
            throw new Error(`unknown area: ${key}`);
        return area;
    }
    const [locationId, blockId] = key.split('/');
    const loc = locationById(locationId);
    const block = blocksFor(loc).find((b) => b.id === blockId);
    if (!block)
        throw new Error(`unknown area: ${key}`);
    // 待售的空地與買下的房子（依存檔，疊在固定地圖上）
    return overlayLots(state, buildBlock(loc, block));
}
export function cellAt(area, x, y) {
    if (x < 0 || y < 0 || x >= area.width || y >= area.height)
        return undefined;
    return area.cells[y * area.width + x];
}
export function findKind(area, kind) {
    const i = area.cells.findIndex((c) => c.kind === kind);
    return i < 0 ? null : { x: i % area.width, y: Math.floor(i / area.width) };
}
export function currentArea(state) {
    return getArea(state, position(state).area);
}
export function position(state) {
    if (!state.position)
        enterLocation(state);
    return state.position;
}
export function currentCell(state) {
    const p = position(state);
    return cellAt(currentArea(state), p.x, p.y) ?? { kind: 'floor' };
}
export function isRevealed(area, x, y) {
    // 聚落與旅途整張看得到（旅途的事件出發時就擲好了）
    return area.kind === 'settlement' || area.kind === 'home' || area.kind === 'road' || (area.revealed?.includes(y * area.width + x) ?? false);
}
export function reveal(area, x, y, radius = 1) {
    if (area.kind === 'settlement' || area.kind === 'home')
        return;
    const set = new Set(area.revealed ?? []);
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (cellAt(area, x + dx, y + dy))
                set.add((y + dy) * area.width + (x + dx));
        }
    }
    area.revealed = [...set];
}
export function storeArea(state, area) {
    state.areas ??= {};
    state.areas[area.key] = area;
}
/** 聚落的固定區塊（不需要存檔；不是聚落區塊時為 undefined） */
export function settlementArea(key, overlay = true) {
    const [locationId, blockId] = key.split('/');
    const loc = geography.locations.find((l) => l.id === locationId);
    if (!loc || loc.type === 'dungeon')
        return undefined;
    const block = blocksFor(loc).find((b) => b.id === blockId);
    return block ? buildBlock(loc, block, overlay) : undefined;
}
/** 聚落所有區塊的 key */
export function blockKeys(locationId) {
    return blocksFor(locationById(locationId)).map((b) => settlementKey(locationId, b.id));
}
/** 站到聚落裡第一個指定種類的設施上（測試與事件用） */
export function standOn(state, kind) {
    const keys = locationById(state.location).type === 'dungeon' ? [currentArea(state).key] : blockKeys(state.location);
    for (const key of keys) {
        const area = getArea(state, key);
        const i = area.cells.findIndex((c) => c.kind === kind);
        if (i >= 0) {
            placeAt(state, area, i % area.width, Math.floor(i / area.width));
            return true;
        }
    }
    return false;
}
export function placeAt(state, area, x, y) {
    state.position = { area: area.key, x, y };
    reveal(area, x, y, sight(state, area));
}
/** 寶箱有沒有上鎖（依這一層的 chest_lock） */
function chestLock(rng, spec) {
    return spec.chest_lock && rng.chance(spec.chest_lock[0]) ? { lock: spec.chest_lock[1] } : {};
}
/** 看得到幾格：地下城與臨時地圖帶著照明類的工具看得更遠 */
export function sight(state, area) {
    return sightIn(state, area);
}
/** 抵達地點（旅行後或開新遊戲）：城鎮站在城門，冒險區域站在周邊的入口。 */
export function enterLocation(state) {
    const loc = locationById(state.location);
    // 隨機區域在離開後作廢，下次進入重新生成
    state.areas = {};
    if (loc.type === 'dungeon') {
        // 進入地下城：開始一趟新的探索
        startExpedition(state, loc.id);
        const area = withRng(state, (rng) => generateLayer(state, loc, 0, rng));
        storeArea(state, area);
        const entry = findKind(area, 'exit');
        spawnVisitors(state, area, entry);
        placeAt(state, area, entry.x, entry.y);
        return;
    }
    delete state.expedition;
    const blocks = blocksFor(loc);
    const gateBlock = blocks.find((b) => b.grid.some((row) => row.includes('E'))) ?? blocks[0];
    const area = buildBlock(loc, gateBlock);
    const gate = findKind(area, 'gate') ?? { x: 1, y: 1 };
    placeAt(state, area, gate.x, gate.y);
}
// ---- 隨機生成 ----
function randomCells(rng, area, count, exclude) {
    const free = area.cells
        .map((c, i) => ({ c, i }))
        .filter(({ c, i }) => c.kind === 'floor' && !exclude.has(i))
        .map(({ i }) => i);
    const picked = [];
    while (picked.length < count && free.length > 0)
        picked.push(free.splice(rng.int(0, free.length - 1), 1)[0]);
    return picked;
}
function between(rng, [lo, hi]) {
    return rng.int(lo, hi);
}
/** 城鎮近郊：開闊的荒野，散落遭遇與資源，下方中央是回城的城門。 */
export function generateOutskirts(state, loc, rng) {
    const g = maps.generation.wild;
    const [width, height] = g.size;
    const cells = Array.from({ length: width * height }, () => ({ kind: rng.chance(g.obstacles) ? 'wall' : 'floor' }));
    const area = {
        key: outskirtsKey(loc.id), location: loc.id, name: `${loc.name}近郊`, kind: 'wild',
        width, height, cells, revealed: [], day: state.time.day,
    };
    const gateIndex = (height - 1) * width + Math.floor(width / 2);
    cells[gateIndex] = { kind: 'exit' };
    // 從城門往上開一條路到地圖中央，避免城門被隨機障礙物圍住、整張圖只剩幾格能走
    for (let y = height - 2; y >= Math.floor(height / 2); y--)
        cells[y * width + Math.floor(width / 2)] = { kind: 'floor' };
    ensureConnected(area, gateIndex);
    const used = new Set([gateIndex, gateIndex - width]);
    const table = wildEncounters(loc.region);
    for (const i of randomCells(rng, area, between(rng, g.encounters), used)) {
        cells[i] = { kind: 'encounter', group: rng.pick(table) };
        used.add(i);
    }
    for (const i of randomCells(rng, area, between(rng, g.resources), used)) {
        cells[i] = { kind: 'resource', item: rng.pick(g.resource_items) };
        used.add(i);
    }
    ensureQuestMarkers(state, area, rng);
    ensureQuestTargets(state, area, rng, table);
    ensureStoryMarkers(state, area, rng);
    ensureIntelPoints(state, area, rng);
    return area;
}
/**
 * 帶著材料或掉落委託進入這一區時，確保有足量的採集點與戰鬥點：
 * 已有的（還沒採、還沒打的）先算進去，不夠時把空地改成採集點或遭遇（遭遇用遭遇表裡有這隻怪物的一組）。
 */
export function ensureQuestTargets(state, area, rng, table) {
    const layer = area.kind === 'dungeon' ? DUNGEON_LAYERS[area.layer ?? 0]?.id : undefined;
    if (area.kind === 'settlement' || area.kind === 'home')
        return;
    const exit = area.cells.findIndex((c) => c.kind === 'exit' || c.kind === 'stairs_up');
    const keep = new Set([exit, exit - area.width]);
    for (const t of questTargets(state, area.location, layer)) {
        const has = area.cells.filter((c) => !c.done && (t.item
            ? c.kind === 'resource' && c.item === t.item
            : (c.kind === 'encounter' || c.kind === 'elite') && c.group?.some(([id]) => id === t.monster))).length;
        const group = table.find((g) => g.some(([id]) => id === t.monster)) ?? [[t.monster, 1]];
        for (const i of randomCells(rng, area, Math.max(0, t.cells - has), keep)) {
            area.cells[i] = t.item ? { kind: 'resource', item: t.item } : { kind: 'encounter', group };
        }
    }
}
/** 在近郊標出已接取的近郊委託地點（接委託時近郊已經生成過也會補上）。 */
function ensureQuestMarkers(state, area, rng) {
    const marked = new Set(area.cells.map((c) => c.questId).filter(Boolean));
    for (const q of state.quests) {
        if (q.giver !== area.location || q.area !== 'outskirts' || q.status !== 'accepted' || marked.has(q.id))
            continue;
        const [i] = randomCells(rng, area, 1, new Set([area.cells.findIndex((c) => c.kind === 'exit')]));
        if (i === undefined)
            return;
        area.cells[i] = { kind: 'quest', questId: q.id };
    }
}
/** 已完成（或不再進行中）的委託，把近郊的委託地點標記拿掉。 */
export function clearQuestMarkers(state) {
    const active = new Set(state.quests.filter((q) => q.status === 'accepted').map((q) => q.id));
    for (const area of Object.values(state.areas ?? {})) {
        area.cells.forEach((c, i) => {
            // 特殊任務的任務點由 story.ts 管理
            if (c.kind === 'quest' && !c.storyNode && (!c.questId || !active.has(c.questId)))
                area.cells[i] = { kind: 'floor' };
        });
    }
}
/** 城內委託要站在指定設施上，近郊委託要站在委託地點上。 */
export function questRunnableHere(state, quest) {
    if (quest.giver !== state.location)
        return false;
    const area = currentArea(state);
    const cell = currentCell(state);
    if (quest.area === 'town')
        return area.kind === 'settlement' && cell.kind === (quest.spot ?? 'guild');
    if (quest.area === 'outskirts')
        return area.kind === 'wild' && cell.kind === 'quest' && cell.questId === quest.id;
    return false;
}
/** 冒險區域的一層：從入口隨機挖出通道，最遠處放下行階梯（深層放層主），入口旁是安全房。 */
export function generateLayer(state, loc, layer, rng) {
    const g = maps.generation.dungeon;
    const spec = g.layers[layer];
    const [width, height] = g.size;
    const cells = Array.from({ length: width * height }, () => ({ kind: 'wall' }));
    const area = {
        key: layerKey(loc.id, layer), location: loc.id, name: `${loc.name}・${spec.name}`, kind: 'dungeon', layer,
        width, height, cells, revealed: [], lighting: layerLighting(loc.id, layer),
    };
    // 隨機漫步挖出通道
    let x = Math.floor(width / 2);
    let y = height - 1;
    const start = y * width + x;
    cells[start] = { kind: 'floor' };
    for (let step = 0; step < g.carve_steps; step++) {
        const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, -1], [0, -1], [0, 1]]);
        const nx = Math.max(0, Math.min(width - 1, x + dx));
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        x = nx;
        y = ny;
        cells[y * width + x] = { kind: 'floor' };
    }
    cells[start] = { kind: layer === 0 ? 'exit' : 'stairs_up' };
    const used = new Set([start]);
    // 入口旁的安全房
    const nearStart = [start - width, start - 1, start + 1].find((i) => cells[i]?.kind === 'floor');
    if (nearStart !== undefined) {
        cells[nearStart] = { kind: 'safe' };
        used.add(nearStart);
    }
    // 最遠的格子放階梯或層主
    const far = farthest(area, start);
    // 最深的一層（有底層時是底層，否則是深層）：最終層主；其他層：層主守著往下的階梯（沒有層主資料時直接是階梯）
    const enc = dungeonEncounters[loc.id];
    const last = layer >= dungeonDepth(loc.id) - 1;
    const bossGroup = enc?.bosses?.[spec.id] ?? (spec.id === 'deep' ? enc?.boss : undefined);
    cells[far] = last
        ? { kind: 'boss', group: bossGroup ?? [] }
        : spec.guard && bossGroup?.length
            ? { kind: 'boss', group: bossGroup, then: 'stairs_down' }
            : { kind: 'stairs_down' };
    used.add(far);
    const table = dungeonEncounters[loc.id]?.[spec.id] ?? wildEncounters(loc.region);
    for (const i of randomCells(rng, area, between(rng, spec.encounters), used)) {
        cells[i] = { kind: 'encounter', group: rng.pick(table) };
        used.add(i);
    }
    for (const i of randomCells(rng, area, spec.elites ?? 0, used)) {
        // 強敵：本層最強的一組，再多一隻
        const strongest = [...table].sort((a, b) => b.reduce((s, [, n]) => s + n, 0) - a.reduce((s, [, n]) => s + n, 0))[0] ?? [];
        const group = strongest.map(([id, n], idx) => [id, idx === 0 ? n + 1 : n]);
        cells[i] = { kind: 'elite', group };
        used.add(i);
    }
    for (const i of randomCells(rng, area, between(rng, spec.traps), used)) {
        cells[i] = { kind: 'trap' };
        used.add(i);
    }
    for (const i of randomCells(rng, area, between(rng, spec.resources), used)) {
        cells[i] = { kind: 'resource', item: rng.pick(g.resource_items) };
        used.add(i);
    }
    // 寶箱：內容依這一層怪物的最高等級
    const level = Math.max(1, ...table.flat().map(([id]) => enemies[id]?.level ?? 1));
    for (const i of randomCells(rng, area, spec.chests ? between(rng, spec.chests) : 0, used)) {
        cells[i] = { kind: 'chest', level, ...chestLock(rng, spec) };
        used.add(i);
    }
    ensureQuestTargets(state, area, rng, table);
    ensureStoryMarkers(state, area, rng);
    ensureIntelPoints(state, area, rng);
    return area;
}
/**
 * 生成臨時地圖：固定地圖照著畫；洞窟、遺跡從出口隨機挖出通道，放遭遇（用 table，強一點）、陷阱、資源與寶箱。
 * location 是這張地圖算在哪個地點（地名、地區、店家）。
 */
export function generateSide(state, key, template, def, location, table, rng) {
    if (def.grid) {
        const width = def.grid[0].length;
        const cells = def.grid.join('').split('').map((ch) => ({ kind: def.legend?.[ch] ?? 'floor' }));
        return { key, location, name: def.name, kind: 'side', template, width, height: def.grid.length, cells, revealed: [], lighting: def.lighting ?? 'lit' };
    }
    const [width, height] = def.size ?? [7, 7];
    const layer = Math.max(0, DUNGEON_LAYERS.findIndex((l) => l.id === (def.chest_layer ?? 'outskirts')));
    const cells = Array.from({ length: width * height }, () => ({ kind: 'wall' }));
    const area = { key, location, name: def.name, kind: 'side', template, layer, width, height, cells, revealed: [], lighting: def.lighting ?? 'dark' };
    let x = Math.floor(width / 2);
    let y = height - 1;
    const start = y * width + x;
    cells[start] = { kind: 'floor' };
    for (let step = 0; step < (def.carve_steps ?? 25); step++) {
        const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, -1], [0, -1], [0, 1]]);
        x = Math.max(0, Math.min(width - 1, x + dx));
        y = Math.max(0, Math.min(height - 1, y + dy));
        cells[y * width + x] = { kind: 'floor' };
    }
    cells[start] = { kind: 'exit' };
    const used = new Set([start]);
    const strongest = [...table].sort((a, b) => b.reduce((s, [, n]) => s + n, 0) - a.reduce((s, [, n]) => s + n, 0))[0] ?? [];
    for (const i of randomCells(rng, area, between(rng, def.encounters ?? [1, 2]), used)) {
        cells[i] = { kind: 'encounter', group: rng.pick(table) };
        used.add(i);
    }
    for (const i of randomCells(rng, area, def.elites ?? 0, used)) {
        cells[i] = { kind: 'elite', group: strongest.map(([id, n], idx) => [id, idx === 0 ? n + 1 : n]) };
        used.add(i);
    }
    for (const i of randomCells(rng, area, between(rng, def.traps ?? [0, 0]), used)) {
        cells[i] = { kind: 'trap' };
        used.add(i);
    }
    for (const i of randomCells(rng, area, between(rng, def.resources ?? [0, 0]), used)) {
        cells[i] = { kind: 'resource', item: rng.pick(maps.generation.dungeon.resource_items) };
        used.add(i);
    }
    const level = Math.max(1, ...table.flat().map(([id]) => enemies[id]?.level ?? 1)) + 1;
    for (const i of randomCells(rng, area, between(rng, def.chests ?? [1, 1]), used)) {
        cells[i] = { kind: 'chest', level, ...chestLock(rng, DUNGEON_LAYERS[layer]) };
        used.add(i);
    }
    return area;
}
function neighborsOf(area, i) {
    const x = i % area.width;
    const y = Math.floor(i / area.width);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => [x + dx, y + dy])
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < area.width && ny < area.height)
        .map(([nx, ny]) => ny * area.width + nx);
}
function walkable(c) {
    return !!c && !WALKABLE_BLOCKERS.includes(c.kind);
}
/** 從起點出發無法到達的空地改成障礙物，確保整張圖連通。 */
function ensureConnected(area, from) {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
        for (const n of neighborsOf(area, queue.shift())) {
            if (!seen.has(n) && walkable(area.cells[n])) {
                seen.add(n);
                queue.push(n);
            }
        }
    }
    area.cells.forEach((c, i) => {
        if (walkable(c) && !seen.has(i))
            area.cells[i] = { kind: 'wall' };
    });
}
function farthest(area, from) {
    const dist = new Map([[from, 0]]);
    const queue = [from];
    let best = from;
    while (queue.length) {
        const cur = queue.shift();
        for (const n of neighborsOf(area, cur)) {
            if (!dist.has(n) && walkable(area.cells[n])) {
                dist.set(n, dist.get(cur) + 1);
                if (dist.get(n) > dist.get(best))
                    best = n;
                queue.push(n);
            }
        }
    }
    return best;
}
function stepMinutes(area) {
    const s = maps.generation.step_minutes;
    return area.kind === 'settlement' || area.kind === 'home' ? s.settlement : area.kind === 'wild' ? s.wild : s.dungeon;
}
/** 往上下左右移動一格，觸發走進格子的內容。 */
export function move(state, dx, dy) {
    if (state.combat)
        throw new Error('戰鬥進行中');
    assertNoStandoff(state);
    if (Math.abs(dx) + Math.abs(dy) !== 1)
        throw new Error('一次只能移動一格');
    const p = position(state);
    const area = currentArea(state);
    // 旅途：單行道，一格一天
    if (area.kind === 'road')
        return roadMove(state, dx, dy);
    const nx = p.x + dx;
    const ny = p.y + dy;
    const cell = cellAt(area, nx, ny);
    if (!walkable(cell))
        throw new Error('那裡過不去');
    // 貴族區與王城有衛兵把守
    if (cell.kind === 'link') {
        const blocked = zoneEntryBlock(state, getArea(state, cell.link.area).zone);
        if (blocked)
            throw new Error(blocked);
        // 主人的家：走出大門前要主人同意
        if (cell.dir === 'out' && atMasterHome(state, area))
            assertMayLeaveHouse(state);
    }
    state.time = addHours(state.time, stepMinutes(area) / 60);
    state.position = { area: area.key, x: nx, y: ny, prev: { x: p.x, y: p.y } };
    // 黑暗的地方：每走一格燒掉一點光源
    burnStep(state, area);
    reveal(area, nx, ny, sight(state, area));
    return enterCell(state, area, nx, ny, cell);
}
/**
 * 不算錯誤的「走不了」：撞牆、旅途往回走或走到底、眼前有事要先處理。回傳給玩家的簡短提示（null 表示可以走）；
 * 地圖輕輕晃一下並顯示提示，不跳出錯誤訊息
 */
export function blockedMove(state, dx, dy) {
    if (Math.abs(dx) + Math.abs(dy) !== 1)
        return null;
    // 眼前有要先處理的事（面板已經顯示了）
    try {
        assertNoStandoff(state);
    }
    catch (e) {
        return e.message;
    }
    const area = currentArea(state);
    const p = position(state);
    if (area.kind === 'road') {
        if (dx !== 1 || dy !== 0)
            return '旅途只能往前走';
        if (state.roadEvent)
            return '先決定怎麼應付眼前的事';
        if (!area.cells[p.x + 1])
            return '已經走到底了';
        return null;
    }
    return walkable(cellAt(area, p.x + dx, p.y + dy)) ? null : '那邊走不過去';
}
/** 移動到指定格子（只能是相鄰格）。 */
export function moveTo(state, x, y) {
    const p = position(state);
    return move(state, x - p.x, y - p.y);
}
/**
 * 遭遇格上的怪物整組都被刪掉時的替代：這個地方現在的遭遇表。
 * 層主換成這一層現在的層主，強敵換成最強的一組再多一隻，一般遭遇隨機挑一組。找不到時回傳空的。
 */
export function substituteGroup(state, area, kind, region) {
    const loc = locationById(area.location);
    const valid = (g) => !!g?.length && g.every(([id]) => !!enemies[id]);
    const layer = area.kind === 'dungeon' ? DUNGEON_LAYERS[area.layer ?? 0]?.id : undefined;
    if (kind === 'boss' && layer && layer !== 'outskirts') {
        const boss = dungeonEncounters[loc.id]?.bosses?.[layer] ?? dungeonEncounters[loc.id]?.boss;
        if (valid(boss))
            return boss;
    }
    const table = ((layer ? dungeonEncounters[loc.id]?.[layer] : undefined) ?? wildEncounters(region ?? loc.region)).filter(valid);
    if (!table.length)
        return [];
    if (kind === 'encounter')
        return withRng(state, (rng) => rng.pick(table));
    const strongest = [...table].sort((a, b) => b.reduce((s, [, n]) => s + n, 0) - a.reduce((s, [, n]) => s + n, 0))[0];
    return strongest.map(([id, n], i) => [id, i === 0 ? n + 1 : n]);
}
function enterCell(state, area, x, y, cell) {
    const loc = locationById(area.location);
    switch (cell.kind) {
        case 'link': {
            const target = getArea(state, cell.link.area);
            placeAt(state, target, cell.link.x, cell.link.y);
            // 走進或走出主人的家：離家期限重新算
            touchMasterHome(state, area, target);
            return {};
        }
        case 'encounter':
        case 'elite':
        case 'boss': {
            if (cell.done || !cell.group?.length)
                return {};
            // 玩家刪掉的自建怪物：拿掉不存在的；整組都沒了就換成這裡現在的遭遇（層主、強敵照原本的強度）
            let group = cell.group.filter(([id]) => !!enemies[id]);
            if (!group.length)
                group = substituteGroup(state, area, cell.kind);
            if (!group.length) {
                cell.done = true;
                if (cell.intel)
                    finishIntel(state, cell.intel);
                return {};
            }
            cell.group = group;
            const scene = area.name;
            return { combat: startCombat(state, group, { scene, cell: { area: area.key, x, y }, dark: inDarkness(state, area) }) };
        }
        case 'trap': {
            if (cell.done)
                return {};
            cell.done = true;
            return { report: springTrap(state, area, loc) };
        }
        case 'resource': {
            if (cell.done || !cell.item)
                return {};
            cell.done = true;
            return { report: gather(state, area, cell.item) };
        }
        case 'chest': {
            if (cell.done)
                return {};
            // 上鎖的寶箱：站在上面選開鎖的方式（靈巧、力量或智力）
            if (cell.lock)
                return {};
            cell.done = true;
            // 情報的藏寶處：結束這則情報
            if (cell.intel)
                finishIntel(state, cell.intel);
            return { report: openChest(state, area, cell.level ?? 1) };
        }
        default:
            return {};
    }
}
function eventReport(state, area, minutes) {
    const pc = player(state);
    const loc = locationById(area.location);
    const start = { ...state.time };
    return {
        schema_version: '0.1',
        report_id: newReportId(state),
        kind: 'event',
        time: { start, end: addHours(start, minutes / 60) },
        location: { at: area.location, region: loc.region, scene: area.name },
        party: state.party.map((m) => snapshot(m, undefined, pc)),
        outcome: { result: 'neutral' },
        changes: {},
        narration: { pov: 'second_person', length: 'short' },
        lore_keys: [loc.name, regionById(loc.region).name],
    };
}
function springTrap(state, area, loc) {
    const spec = DUNGEON_LAYERS[area.layer ?? 0];
    const report = eventReport(state, area, 5);
    // 隊伍中靈巧最高的人負責察覺陷阱；陷阱類的工具（探路長竿）有加值
    const scout = [...state.party].filter((m) => m.hp > 0).sort((a, b) => attrOf(b, 'dex') - attrOf(a, 'dex'))[0] ?? player(state);
    const before = state.party.map((m) => ({ ...m }));
    const tool = bestTool(state, 'trap');
    const dice = withBonus('1d20', mod(attrOf(scout, 'dex')) + proficiency(scout.level) + (tool?.bonus ?? 0) + checkBonus(scout, { context: 'trap', attr: 'dex' }));
    const r = withRng(state, (rng) => roll(rng, dice));
    // 黑暗又沒有光：更難察覺
    const dark = inDarkness(state, area);
    const dc = spec.trap_dc + (dark ? lightingRules.dark.trap_dc : 0);
    const success = r.total >= dc;
    const effects = [];
    if (!success) {
        const dmg = withRng(state, (rng) => roll(rng, spec.trap_damage).total);
        scout.hp = Math.max(1, scout.hp - dmg);
        effects.push({ type: 'damage', target: scout.id, amount: dmg });
    }
    report.kind = 'event';
    report.timeline = [{
            seq: 1, actor: scout.id, action: `靈巧檢定・察覺陷阱${tool ? `（${tool.name} +${tool.bonus}）` : ''}${dark ? '（一片漆黑）' : ''}`,
            roll: { dice, value: r.total, dc }, result: success ? 'success' : 'fail', effects,
        }];
    report.party = state.party.map((m, i) => snapshot(m, before[i], player(state)));
    report.outcome = {
        result: success ? 'success' : 'failure',
        summary: success ? `${scout.name}及時察覺${area.name}的陷阱。` : `${scout.name}觸發了${area.name}的陷阱。`,
        tags: ['陷阱', ...(dark ? ['黑暗'] : [])],
    };
    report.lore_keys.push(loc.name);
    return commitReport(state, report);
}
function gather(state, area, item) {
    const report = eventReport(state, area, 10);
    report.kind = 'action';
    if (item === '古錢') {
        const money = withRng(state, (rng) => rng.int(10, 60));
        report.changes.money_cc = money;
        report.outcome = { result: 'success', summary: `在${area.name}找到一些古錢。` };
    }
    else {
        report.changes.items_gained = [{ name: item, qty: 1, owner: 'pc' }];
        report.outcome = { result: 'success', summary: `在${area.name}採集到${item}。` };
    }
    return commitReport(state, report);
}
export const LOCK_METHODS = {
    dex: { name: '開鎖', success: '撬開了鎖', fail: '對著鎖頭搗鼓了一陣，還是打不開' },
    str: { name: '硬撬', success: '把鎖硬生生扳斷了', fail: '使盡了力氣，寶箱還是紋風不動' },
    int: { name: '研究機關', success: '看穿了鎖的機關，輕輕一按就開了', fail: '研究了半天，還是看不出機關的門道' },
};
/** 這種方式由誰來做：隊伍中這項屬性最高、還站得起來的人 */
export function lockPicker(state, method) {
    return [...state.party].filter((m) => m.hp > 0).sort((a, b) => attrOf(b, method) - attrOf(a, method))[0] ?? player(state);
}
/**
 * 上鎖的寶箱：用選的方式檢定（DC 是寶箱的鎖）。
 * 成功就打開；失敗時寶箱還在，可以再試或換一種方式（每次 10 分鐘）。
 */
function pickLockAt(state, area, cell, method) {
    const loc = locationById(area.location);
    const report = eventReport(state, area, 10);
    const how = LOCK_METHODS[method];
    const picker = lockPicker(state, method);
    const tool = method === 'dex' ? bestTool(state, 'lockpick') : undefined;
    const dc = cell.lock;
    const extra = checkModifiers(picker, { context: 'lock', attr: method });
    const dice = withBonus('1d20', mod(attrOf(picker, method)) + proficiency(picker.level) + (tool?.bonus ?? 0) + extra.reduce((s, x) => s + x.value, 0));
    const r = withRng(state, (rng) => roll(rng, dice));
    const natural = r.rolls[0] ?? 10;
    const success = natural === 20 || (natural !== 1 && r.total >= dc);
    const entry = {
        seq: 1, actor: picker.id, action: `${attrName(method)}檢定・${how.name}${tool ? `（${tool.name} +${tool.bonus}）` : ''}${modifierNote(extra)}`,
        roll: { dice, value: r.total, dc }, result: success ? 'success' : 'fail',
    };
    if (!success) {
        report.timeline = [entry];
        report.outcome = {
            result: 'failure',
            summary: `${picker.name}${how.fail}。可以再試一次，或換一種方式。`,
            tags: ['寶箱', '上鎖'],
        };
        report.lore_keys.push(loc.name);
        return commitReport(state, report);
    }
    delete cell.lock;
    cell.done = true;
    if (cell.intel)
        finishIntel(state, cell.intel);
    state.time = addHours(state.time, 10 / 60);
    const opened = openChest(state, area, cell.level ?? 1);
    opened.timeline = [entry, ...(opened.timeline ?? [])];
    opened.outcome.summary = `${picker.name}${how.success}。${opened.outcome.summary ?? ''}`;
    opened.outcome.tags = [...(opened.outcome.tags ?? []), '上鎖'];
    return opened;
}
/** 站在上鎖的寶箱上：選一種方式試著打開 */
export function pickLock(state, method = 'dex') {
    if (state.combat)
        throw new Error('戰鬥中不能這麼做');
    assertNoStandoff(state);
    if (!LOCK_METHODS[method])
        throw new Error('沒有這種開法');
    const area = currentArea(state);
    const cell = currentCell(state);
    if (cell.kind !== 'chest' || cell.done || !cell.lock)
        throw new Error('這裡沒有上鎖的寶箱');
    return pickLockAt(state, area, cell, method);
}
/** 打開寶箱：錢、消耗品、裝備與打造材料（gear.json 的 chests） */
function openChest(state, area, level) {
    const report = eventReport(state, area, 5);
    report.kind = 'event';
    const layer = DUNGEON_LAYERS[area.layer ?? 0].id;
    const t = gearRules.chests[layer] ?? gearRules.chests.outskirts;
    const items = [];
    const add = (name) => {
        const x = items.find((i) => i.name === name);
        if (x)
            x.qty++;
        else
            items.push({ name, qty: 1, owner: 'pc' });
    };
    const money = withRng(state, (rng) => {
        for (const [name, p] of t.items)
            if (itemDef(name) && rng.chance(p))
                add(name);
        if (rng.chance(t.gear))
            add(registerGear(state, randomGear(rng, level)));
        if (t.gear_extra && rng.chance(t.gear_extra))
            add(registerGear(state, randomGear(rng, level)));
        for (const [tier, p] of t.forge) {
            if (!rng.chance(p))
                continue;
            const name = forgeItemFor(rng.pick(MATERIAL_KINDS), tier);
            if (name)
                add(name);
        }
        return rng.int(t.money[0], t.money[1]) * level;
    });
    report.changes.money_cc = money;
    if (items.length)
        report.changes.items_gained = items;
    report.outcome = {
        result: 'success',
        summary: `在${area.name}打開一個寶箱：${[formatMoney(money), ...items.map((i) => (i.qty > 1 ? `${i.name}×${i.qty}` : i.name))].join('、')}。`,
        tags: ['寶箱'],
    };
    return commitReport(state, report);
}
// ---- 格子上的動作 ----
/** 和敵對的人對峙時，不能離開 */
export function assertNoStandoff(state) {
    if (state.standoff)
        throw new Error('先處理眼前的對峙');
    if (state.pendingMark)
        throw new Error('先完成契約印記的刻印');
    if (state.pendingMasterEvent)
        throw new Error('先回應主人的要求');
    if (state.pendingDefeat)
        throw new Error('先應付眼前的處境');
}
/** 城門盤查：沒過時回傳盤查的紀錄（沒有擲骰時直接說明原因） */
function passGate(state) {
    const g = gateCheck(state);
    if (g.ok)
        return undefined;
    if (g.report)
        return g.report;
    throw new Error(g.reason);
}
/** 從城門前往近郊（每天重新生成一次）。被衛兵攔下時回傳盤查的紀錄，不會出城。 */
export function goOutskirts(state) {
    if (currentCell(state).kind !== 'gate')
        throw new Error('要在城門才能出城');
    assertNoStandoff(state);
    assertMasterAllows(state);
    const blocked = passGate(state);
    if (blocked)
        return blocked;
    placeOutside(state);
    return undefined;
}
/** 直接站到近郊的出口（不經過城門盤查，例如被擋在城外） */
export function placeOutside(state) {
    const loc = locationById(state.location);
    let area = state.areas?.[outskirtsKey(loc.id)];
    if (!area || area.day !== state.time.day) {
        area = withRng(state, (rng) => generateOutskirts(state, loc, rng));
        storeArea(state, area);
        spawnVisitors(state, area, findKind(area, 'exit'));
    }
    else {
        const existing = area;
        withRng(state, (rng) => {
            ensureQuestMarkers(state, existing, rng);
            ensureQuestTargets(state, existing, rng, wildEncounters(loc.region));
            ensureStoryMarkers(state, existing, rng);
            ensureIntelPoints(state, existing, rng);
        });
    }
    const exit = findKind(area, 'exit');
    placeAt(state, area, exit.x, exit.y);
}
/** 從近郊的出口回到城門。被衛兵攔下時回傳盤查的紀錄，不會進城。 */
export function returnToTown(state) {
    if (currentArea(state).kind !== 'wild' || currentCell(state).kind !== 'exit')
        throw new Error('要在近郊的出口才能回城');
    assertNoStandoff(state);
    const blocked = passGate(state);
    if (blocked)
        return blocked;
    enterTownGate(state);
    return undefined;
}
function enterTownGate(state) {
    const loc = locationById(state.location);
    const blocks = blocksFor(loc);
    const gateBlock = blocks.find((b) => b.grid.some((row) => row.includes('E'))) ?? blocks[0];
    const area = buildBlock(loc, gateBlock);
    const gate = findKind(area, 'gate');
    placeAt(state, area, gate.x, gate.y);
}
/** 走下行階梯：生成下一層並站在它的上行階梯。 */
export function descend(state) {
    assertNoStandoff(state);
    const area = currentArea(state);
    if (currentCell(state).kind !== 'stairs_down' || area.layer === undefined)
        throw new Error('這裡沒有往下的階梯');
    const loc = locationById(area.location);
    const next = area.layer + 1;
    let target = state.areas?.[layerKey(loc.id, next)];
    if (!target) {
        target = withRng(state, (rng) => generateLayer(state, loc, next, rng));
        storeArea(state, target);
        spawnVisitors(state, target, findKind(target, 'stairs_up'));
    }
    const up = findKind(target, 'stairs_up');
    placeAt(state, target, up.x, up.y);
    reachLayer(state, next);
}
/** 走上行階梯回到上一層的下行階梯。 */
export function ascend(state) {
    assertNoStandoff(state);
    const area = currentArea(state);
    if (currentCell(state).kind !== 'stairs_up' || !area.layer)
        throw new Error('這裡沒有往上的階梯');
    const prev = getArea(state, layerKey(area.location, area.layer - 1));
    const down = findKind(prev, 'stairs_down');
    placeAt(state, prev, down.x, down.y);
}
/** 戰鬥結束後：獲勝清除格子；撤退退回上一格；戰敗被送回城鎮或地下城入口外。 */
export function afterCombat(state, report) {
    clearQuestMarkers(state);
    const result = report.outcome.result;
    const p = state.position;
    // 緊急撤退被追上：打贏就撤出地下城
    const retreating = state.retreating;
    delete state.retreating;
    if (retreating && result === 'victory' && p) {
        applyPendingMove(state);
        placeAtEntrance(state);
        return;
    }
    if (!p)
        return;
    const area = state.areas?.[p.area];
    if (result === 'victory' && area) {
        const key = Object.keys(report.changes.flags ?? {}).find((k) => k.startsWith('cleared:'));
        if (key) {
            const [, areaKey, coords] = key.split(':');
            const [cx, cy] = coords.split(',').map(Number);
            const target = state.areas?.[areaKey];
            const cell = target && cellAt(target, cx, cy);
            if (cell)
                cell.done = true;
            // 守著階梯的層主倒下：格子變成往下的階梯
            if (cell?.then) {
                cell.kind = cell.then;
                delete cell.then;
                delete cell.done;
            }
            delete state.flags[key];
        }
    }
    else if (result === 'fled' && p.prev) {
        state.position = { area: p.area, x: p.prev.x, y: p.prev.y };
    }
    else if (result === 'defeat' && !state.pendingDefeat) {
        // 成人向的戰敗事件等玩家回應之後才離開（defeat.ts）
        afterDefeat(state);
    }
    // 特殊任務的戰鬥結果要求的移動（進入臨時地圖、改道）
    applyPendingMove(state);
}
/** 戰敗之後：地下城回到入口（重新生成），近郊回到城門，城裡留在原地 */
export function afterDefeat(state) {
    const p = state.position;
    if (!p)
        return;
    const area = state.areas?.[p.area];
    const loc = locationById(state.location);
    if (area?.kind === 'side') {
        // 臨時地圖裡倒下：被帶回原本的地方（旅途或地圖上）
        leaveSide(state);
    }
    else if (area?.kind === 'road') {
        // 旅途上倒下：留在原地，醒來繼續趕路
    }
    else if (loc.type === 'dungeon') {
        // 被救出地下城：這趟探索結束（撿到的東西在戰報裡已經依規則失去），重新進入
        enterLocation(state);
    }
    else if (area?.kind === 'wild') {
        enterTownGate(state);
    }
}
/** 回到地下城周邊的入口（撤退成功） */
function placeAtEntrance(state) {
    const area = getArea(state, layerKey(state.location, 0));
    const exit = findKind(area, 'exit');
    placeAt(state, area, exit.x, exit.y);
}
/**
 * 緊急撤退：在地下城任何地方撤回周邊的入口。站在安全房不用檢定；
 * 否則檢定，失敗被追上打一場（打贏就撤出，見 afterCombat）
 */
export function retreat(state) {
    if (state.combat)
        throw new Error('戰鬥進行中');
    assertNoStandoff(state);
    const area = currentArea(state);
    if (area.kind !== 'dungeon')
        throw new Error('只有在地下城裡才能撤退');
    if ((area.layer ?? 0) === 0 && currentCell(state).kind === 'exit')
        throw new Error('已經在入口了');
    const r = attemptRetreat(state, area, currentCell(state).kind === 'safe');
    if (r.escaped) {
        placeAtEntrance(state);
        return { report: r.report };
    }
    if (!r.pursuit) {
        // 這一層沒有遭遇表：甩掉了
        placeAtEntrance(state);
        return { report: r.report };
    }
    state.retreating = true;
    return { report: r.report, combat: startCombat(state, r.pursuit.group, { scene: r.pursuit.scene, surprise: 'enemy', dark: inDarkness(state, area) }) };
}
/** 可以啟程旅行的位置：城門或冒險區域周邊的出口。 */
export function canTravelHere(state) {
    const area = currentArea(state);
    const cell = currentCell(state);
    return (area.kind === 'settlement' && cell.kind === 'gate') || (area.kind === 'dungeon' && cell.kind === 'exit');
}
