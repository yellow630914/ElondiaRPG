// 讀入 data/ 底下的 JSON，並提供型別。
import geographyJson from '@data/world/geography.json';
import npcsJson from '@data/world/npcs.json';
import progressionJson from '@data/rules/progression.json';
import economyJson from '@data/rules/economy.json';
import attributesJson from '@data/rules/attributes.json';
import classesJson from '@data/rules/classes.json';
import combatJson from '@data/rules/combat.json';
import damageTypesJson from '@data/rules/damage_types.json';
import statusesJson from '@data/rules/statuses.json';
import abilitiesJson from '@data/rules/abilities.json';
import equipmentJson from '@data/rules/equipment.json';
import enemiesJson from '@data/rules/enemies.json';
import monsterTraitsJson from '@data/rules/monster_traits.json';
import townQuestsJson from '@data/rules/town_quests.json';
import companionsJson from '@data/rules/companions.json';
import slaveryJson from '@data/rules/slavery.json';
import actionsJson from '@data/rules/actions.json';
import npcPoolJson from '@data/world/npc_pool.json';
import npcTagsJson from '@data/rules/npc_tags.json';
import populationJson from '@data/rules/npc_population.json';
import itemsJson from '@data/rules/items.json';
import shopsJson from '@data/rules/shops.json';
import negotiationsJson from '@data/rules/negotiations.json';
import workJson from '@data/rules/work.json';
import storiesJson from '@data/rules/stories.json';
import craftsJson from '@data/rules/crafts.json';
import homesJson from '@data/rules/homes.json';
import perksJson from '@data/rules/perks.json';
import landmarksJson from '@data/world/landmarks.json';
import { adultContent, safeText } from './content';
export const geography = geographyJson;
/** 內建的特殊任務；內容頁籤的修改套用在這份清單上 */
export const stories = storiesJson.stories;
export const npcs = npcsJson.npcs;
export const LANDMARK_ID = /^lm_[a-z0-9_]+$/;
export function isLandmarkId(id) {
    return LANDMARK_ID.test(id);
}
const landmarksData = landmarksJson;
export const landmarkTypes = landmarksData.types;
/** 目前的地標（內容編輯器會改、加、刪） */
export const landmarks = Object.fromEntries(landmarksData.landmarks.map((l) => [l.id, l]));
export function landmarkDef(id) {
    return isLandmarkId(id) ? landmarks[id] : undefined;
}
/** 某個聚落的地標 */
export function landmarksIn(location) {
    return Object.values(landmarks).filter((l) => l.location === location);
}
export const progression = progressionJson;
export const economy = economyJson;
export const ATTR_IDS = ['str', 'dex', 'int', 'fai', 'cha'];
export const attributeRules = attributesJson;
export const classes = classesJson.classes;
/** 普通人入隊時的職業 */
export const NONCOMBAT_CLASS = 'noncombatant';
/** 可以選、可以隨機抽到的職業（不含「無法戰鬥」） */
export const combatClasses = Object.fromEntries(Object.entries(classes).filter(([, c]) => !c.noncombat));
export function classDef(id) {
    const c = classes[id];
    if (!c)
        throw new Error(`unknown class: ${id}`);
    return c;
}
// ---- 戰鬥規則 ----
export const combatRules = combatJson;
export const damageTypes = damageTypesJson;
const damageTypeIndex = new Map(damageTypes.types.map((t) => [t.id, t]));
export function damageType(id) {
    const t = damageTypeIndex.get(id);
    if (!t)
        throw new Error(`unknown damage type: ${id}`);
    return t;
}
export function damageTypeName(id) {
    return damageTypeIndex.get(id)?.name ?? damageTypes.groups[id] ?? id;
}
export const statuses = statusesJson.statuses;
export function statusDef(id) {
    const s = statuses[id];
    if (!s)
        throw new Error(`unknown status: ${id}`);
    return s;
}
const STATUS_MOD_NAME = { hit: '命中', evade: '迴避', save: '豁免', damage: '武器傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊閾值 -', threat: '仇恨' };
const ROLL_NAME = { attack: '攻擊', evade: '迴避', save: '豁免' };
const CONTROL_NAME = { stun: '暈眩（跳過回合、無法迴避）', silence: '無法施法與戲法', no_cast: '無法施法', taunt: '只能攻擊施放者', confuse: '隨機攻擊任何人' };
const SPECIAL_NAME = { undying: '致命傷保留 1 HP', halve_next: '下一次受到的傷害減半', reduce_next: '下一次物理傷害減去一個數值' };
/** 狀態的效果寫成一段說明（內容編輯器的預覽、戰鬥畫面的提示） */
export function describeStatus(s) {
    const parts = [];
    for (const [k, v] of Object.entries(s.mods ?? {})) {
        if (!v)
            continue;
        if (k === 'threat')
            parts.push(`仇恨 ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
        else if (k === 'crit')
            parts.push(`幸運一擊閾值 ${v > 0 ? '-' : '+'}${Math.abs(v)}`);
        else
            parts.push(`${STATUS_MOD_NAME[k] ?? k} ${v > 0 ? '+' : ''}${v}`);
    }
    const rolls = (r) => (r ?? []).map((x) => ROLL_NAME[x]).join('、');
    if (s.luck && s.luck_on?.length)
        parts.push(`${rolls(s.luck_on)}${s.luck.startsWith('-') ? ` ${s.luck}` : ` +${s.luck}`}`);
    if (s.advantage?.length)
        parts.push(`${rolls(s.advantage)}優勢`);
    if (s.disadvantage?.length)
        parts.push(`${rolls(s.disadvantage)}劣勢`);
    if (s.attacked_advantage)
        parts.push('被攻擊時對方優勢');
    if (s.attacked_disadvantage)
        parts.push('被攻擊時對方劣勢');
    for (const [k, v] of Object.entries(s.resist ?? {}))
        if (v)
            parts.push(`受到的${damageTypeName(k)}傷害 ×${Math.round((1 + v) * 100) / 100}`);
    for (const [k, v] of Object.entries(s.offense ?? {}))
        if (v)
            parts.push(`造成的${damageTypeName(k)}傷害 ×${Math.round((1 + v) * 100) / 100}`);
    if (s.dot)
        parts.push(`每回合 ${s.dot.dice} ${damageTypeName(s.dot.type)}傷害`);
    if (s.hot)
        parts.push(`每回合回復 ${s.hot} HP`);
    if (s.pulse)
        parts.push(`每回合對隨機敵人 ${s.pulse.dice}${s.pulse.mod ? ' + 屬性調整值' : ''} ${damageTypeName(s.pulse.type)}傷害`);
    if (s.on_hit?.status)
        parts.push(`武器命中時使目標${statuses[s.on_hit.status]?.name ?? s.on_hit.status} ${s.on_hit.turns ?? 1} 回合`);
    else if (s.on_hit?.dice)
        parts.push(`武器命中時附加 ${s.on_hit.dice} ${damageTypeName(s.on_hit.type ?? '')}傷害`);
    if (s.control)
        parts.push(CONTROL_NAME[s.control]);
    if (s.special)
        parts.push(SPECIAL_NAME[s.special]);
    if (s.charges)
        parts.push(`生效 ${s.charges} 次後消失`);
    return parts.join('；') || '沒有效果';
}
const abilityList = abilitiesJson.abilities;
/** 所有能力（玩家自訂的內容會改這份：見 mods.ts） */
export const abilities = Object.fromEntries(abilityList.map((a) => [a.id, a]));
export function abilityDef(id) {
    const a = abilities[id];
    if (!a)
        throw new Error(`unknown ability: ${id}`);
    return a;
}
export function classAbilities(classId) {
    return Object.values(abilities).filter((a) => a.classes.includes(classId));
}
export const equipment = equipmentJson;
export function weaponDef(id) {
    return equipment.weapons[id] ?? equipment.weapons.unarmed;
}
export function armorDef(id) {
    return equipment.armors[id] ?? equipment.armors.none;
}
/** 地下城的各層，由淺到深（底層只有寫了 abyss 的地下城才有） */
export const DUNGEON_LAYER_IDS = ['outskirts', 'shallow', 'middle', 'deep', 'abyss'];
export const BOSS_LAYER_IDS = ['shallow', 'middle', 'deep', 'abyss'];
export const DUNGEON_LAYER_NAME = { outskirts: '周邊', shallow: '淺層', middle: '中層', deep: '深層', abyss: '底層' };
/** 這座地下城有幾層（有底層時 5 層） */
export function dungeonDepth(id) {
    return dungeonEncounters[id]?.abyss?.length ? 5 : 4;
}
/** 這隻怪物是不是某座地下城某一層的層主（含內容編輯放上去的層主） */
export function isLayerBoss(id) {
    return Object.values(dungeonEncounters).some((e) => e.boss?.[0]?.[0] === id || Object.values(e.bosses ?? {}).some((g) => g?.[0]?.[0] === id));
}
const enemiesData = enemiesJson;
export const enemies = Object.fromEntries(enemiesData.enemies.map((e) => [e.id, e]));
export const dungeonEncounters = enemiesData.encounters;
/** 城郊遭遇表（玩家自訂內容會直接修改） */
export const wildEncounterTables = enemiesData.wild_encounters;
export function wildEncounters(region) {
    const table = enemiesData.wild_encounters[region] ?? enemiesData.wild_encounters.default;
    return Array.isArray(table) ? table : [];
}
export const monsterTraits = monsterTraitsJson;
const townQuestsData = townQuestsJson;
export const materialQuestRules = townQuestsData.material_quests;
export const townQuestsPerTown = townQuestsData.per_town;
export const townQuestsRefreshDays = townQuestsData.refresh_days;
export const townQuestTemplates = Object.fromEntries(townQuestsData.templates.map((t) => [t.id, t]));
export const companionRules = companionsJson;
export function conditionName(id) {
    return companionRules.conditions[id]?.name ?? statuses[id]?.name ?? id;
}
export const slaveryRules = slaveryJson;
export function contractDef(id) {
    // 沒有這個模板（例如自訂內容刪掉了）：用預設的
    const c = slaveryRules.contracts[id] ?? slaveryRules.contracts[slaveryRules.roles.default];
    if (!c)
        throw new Error(`unknown contract: ${id}`);
    // 關閉成人向時，娼妓契約顯示為技師契約
    return adultContent() ? c : { ...c, name: safeText(c.name), mark: safeText(c.mark), side_effects: c.side_effects.map(safeText) };
}
export const actionRules = actionsJson;
export const npcPool = npcPoolJson;
/** 標籤的 DC 修正：所有標籤相加 */
export function tagDcMod(rec, key) {
    return (rec.tags ?? []).reduce((sum, t) => sum + (npcTags.tags[t]?.dc_mods?.[key] ?? 0), 0);
}
/** 兩個標籤互斥嗎（任何一方寫了就算） */
export function tagsExclusive(a, b) {
    return !!npcTags.tags[a]?.exclusive?.includes(b) || !!npcTags.tags[b]?.exclusive?.includes(a);
}
export const npcTags = npcTagsJson;
export const population = populationJson;
export function tagDef(id) {
    const t = npcTags.tags[id];
    // 關閉成人向時，娼妓顯示為技師
    return !t || adultContent() ? t : { ...t, name: safeText(t.name), ai_hint: safeText(t.ai_hint) };
}
export const workRules = workJson;
/** 地標的打工（work.json 的 jobs 以格子的種類為 key，地標的格子種類就是它的 id） */
export function landmarkJob(l) {
    return l.work ? { name: `${l.name}的雜務`, attr: l.work.attr, dc: l.work.dc, rate_cc: l.work.rate_cc, desc: l.work.desc } : undefined;
}
for (const l of Object.values(landmarks)) {
    const job = landmarkJob(l);
    if (job)
        workRules.jobs[l.id] = job;
}
export const itemRules = itemsJson;
const itemIndex = new Map(itemRules.items.map((i) => [i.name, i]));
/** 物品清單改變後（玩家自訂內容）重建索引 */
export function reindexItems() {
    itemIndex.clear();
    for (const i of itemRules.items)
        itemIndex.set(i.name, i);
}
export function itemDef(name) {
    return itemIndex.get(name) ?? saveItemIndex.get(name);
}
// 這個存檔自創的物品（自創配方，見 invention.ts）：不在物品目錄裡，讀檔、開新遊戲時換成那個存檔的
const saveItemIndex = new Map();
export function setSaveItems(items) {
    saveItemIndex.clear();
    for (const i of items)
        saveItemIndex.set(i.name, i);
}
export function saveItems() {
    return [...saveItemIndex.values()];
}
export const CUSTOM_SHOP_ID = /^shop_[a-z0-9]+$/;
export function isCustomShopId(id) {
    return CUSTOM_SHOP_ID.test(id);
}
/** 可以指定固定 NPC 擔任店主的內建店種（流浪商人不是固定的店）；自建的商店也可以 */
export const KEEPER_SHOPS = ['general', 'temple', 'tavern', 'smithy', 'tailor', 'jeweler', 'magic', 'informant'];
/** 商店的設定（自建的商店被刪掉時丟出錯誤） */
export function shopDef(type) {
    const d = shopRules.types[type];
    if (!d)
        throw new Error(`沒有這家店：${type}`);
    return d;
}
export function isKeeperShop(id) {
    return KEEPER_SHOPS.includes(id) || isCustomShopId(id);
}
export const shopRules = shopsJson;
export const negotiationRules = negotiationsJson;
// ---- 性別、種族與職業的顯示 ----
export const GENDER_IDS = Object.keys(npcPool.genders).filter((k) => !k.startsWith('$'));
/** 性別：NPC 用 id；主角是自由輸入的文字，能對應到已知性別時沿用其顏色 */
export function genderDef(g) {
    if (!g)
        return undefined;
    const byId = npcPool.genders[g];
    if (byId && !g.startsWith('$'))
        return { ...byId, id: g };
    const text = g.trim().toLowerCase();
    const alias = {
        男: 'male', 男性: 'male', male: 'male', m: 'male', 女: 'female', 女性: 'female', female: 'female', f: 'female',
        偽娘: 'femboy', 伪娘: 'femboy', ts: 'ts', 扶她: 'futa', 未知: 'unknown', 不明: 'unknown',
    };
    const id = alias[text];
    return id ? { ...npcPool.genders[id], id } : undefined;
}
export function genderName(g) {
    return genderDef(g)?.name ?? g ?? '';
}
export function raceEmoji(id) {
    return attributeRules.races[id]?.emoji ?? '';
}
export function classEmoji(id) {
    return classes[id]?.emoji ?? '';
}
// ---- 查詢 ----
const locationIndex = new Map(geography.locations.map((l) => [l.id, l]));
const regionIndex = new Map(geography.regions.map((r) => [r.id, r]));
export function locationById(id) {
    const loc = locationIndex.get(id);
    if (!loc)
        throw new Error(`unknown location: ${id}`);
    return loc;
}
export function regionById(id) {
    const region = regionIndex.get(id);
    if (!region)
        throw new Error(`unknown region: ${id}`);
    return region;
}
export function className(id) {
    return classes[id]?.name ?? id;
}
export function raceName(id) {
    return attributeRules.races[id]?.name ?? id;
}
export function attrName(id) {
    return attributeRules.attributes.find((a) => a.id === id)?.name ?? id;
}
/** 有公會、旅店、酒館的聚落 */
export function isSettlement(loc) {
    return loc.type !== 'dungeon';
}
export const craftRules = craftsJson;
export const CRAFT_IDS = Object.keys(craftRules.skills);
export const homeRules = homesJson;
export const perkRules = perksJson;
/** 清單裡的特質 */
export function perkDef(id) {
    return perkRules.perks.find((p) => p.id === id);
}
/** 可以取得的特質（建角、升級、事件、訓練、書籍、NPC 的特質清單）：種族特質除外 */
export function choosablePerks() {
    return perkRules.perks.filter((p) => !p.race);
}
/** 可以取得的特質 id（種族特質與不存在的回傳 false） */
export function isChoosablePerk(id) {
    const p = perkDef(id);
    return !!p && !p.race;
}
