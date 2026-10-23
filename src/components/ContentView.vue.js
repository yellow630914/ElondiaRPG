import { computed, ref } from 'vue';
import WorldBar from './WorldBar.vue';
import { abilities, className, contractDef, describeStatus, enemies, itemDef, itemRules, landmarks, landmarkTypes, locationById, npcs as namedNpcs, perkDef, perkRules, shopRules, slaveryRules, statuses, stories } from '@/engine/data';
import { newShop, newShopId, shopAsCustom } from '@/engine/shopMods';
import { builtinLandmark, newLandmark, newLandmarkId } from '@/engine/landmarkMods';
import { newMark, newTattooTemplate } from '@/engine/tattooMods';
import { oathText, placeName, tattooRules } from '@/engine/tattoos';
import { perkPower } from '@/engine/perks';
import { gearRules } from '@/engine/gear';
import { ABILITY_TYPES, abilityClasses, builtinAbility, builtinBase, builtinEnemy, builtinMaterial, builtinNpc, builtinPerk, ENEMY_KINDS, enemyPlaceIndex, enemyPlaceOptions, ITEM_SOURCE_NAME, itemSourceIndex, newAbility, newBase, newEnemy, newItem, newMaterial, newModId, newNpc, newPerk, builtinStatus, newStatus, builtinMark, builtinTattoo, } from '@/engine/mods';
import { formatMoney } from '@/engine/money';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import { dateStamp, download } from './download';
import AbilityEditor from './content/AbilityEditor.vue';
import EnemyEditor from './content/EnemyEditor.vue';
import GearEditor from './content/GearEditor.vue';
import ItemEditor from './content/ItemEditor.vue';
import NpcEditor from './content/NpcEditor.vue';
import PerkEditor from './content/PerkEditor.vue';
import StatusEditor from './content/StatusEditor.vue';
import StoryEditor from './content/StoryEditor.vue';
import TattooEditor from './content/TattooEditor.vue';
import ShopEditor from './content/ShopEditor.vue';
import LandmarkEditor from './content/LandmarkEditor.vue';
import MarkEditor from './content/MarkEditor.vue';
import MarkRulesEditor from './content/MarkRulesEditor.vue';
import { builtinStory, copyStory, newStory, START_KINDS } from '@/engine/storyMods';
const SUBS = [
    { id: 'enemies', label: '👹 怪物' },
    { id: 'items', label: '🎒 物品' },
    { id: 'bases', label: '🗡️ 裝備底材' },
    { id: 'materials', label: '💎 材料' },
    { id: 'abilities', label: '✨ 技能' },
    { id: 'statuses', label: '🌀 狀態' },
    { id: 'perks', label: '🌟 特質' },
    { id: 'tattoos', label: '🖋️ 刺青' },
    { id: 'landmarks', label: '🏛️ 地標' },
    { id: 'shops', label: '🏪 商店' },
    { id: 'npcs', label: '🧑 固定 NPC' },
    { id: 'stories', label: '⭐ 特殊任務' },
];
const content = useContent();
const game = useGame();
const sub = ref('enemies');
const search = ref('');
const filter = ref('all');
const category = ref('');
// 怪物：種類、出現地點、等級；物品：取得方式
const enemyKind = ref('');
const enemyPlace = ref('');
const enemyLevel = ref('');
const itemSource = ref('');
const LEVEL_BANDS = { '1-2': [1, 2], '3-4': [3, 4], '5-6': [5, 6], '7-8': [7, 8], '9-10': [9, 10], '11+': [11, 99] };
const placeOptions = enemyPlaceOptions();
const places = computed(() => {
    void content.version;
    return enemyPlaceIndex();
});
const sources = computed(() => {
    void content.version;
    return itemSourceIndex();
});
function resetFilters() {
    category.value = '';
    enemyKind.value = '';
    enemyPlace.value = '';
    enemyLevel.value = '';
    itemSource.value = '';
    abilityType.value = '';
    abilityClass.value = '';
    statusKind.value = '';
    tattooKind.value = '';
}
const selected = ref({ enemies: '', items: '', bases: '', materials: '', abilities: '', statuses: '', perks: '', tattoos: '', landmarks: '', shops: '', npcs: '', stories: '' });
// 刺青：普通刺青、誓約印記、奴隸印記（列表的 key：t:<圖樣>、m:<印記>、rules 是印記設定）
const tattooKind = ref('');
// 狀態：增益、減益
const statusKind = ref('');
/** 清單上的效果簡述：第一項效果，太長就截斷（完整的在編輯畫面） */
function shortStatus(s) {
    const parts = describeStatus(s).split('；');
    const first = parts[0];
    return first.length > 12 ? `${first.slice(0, 11)}…` : parts.length > 1 ? `${first}…` : first;
}
// 技能：種類、職業
const abilityType = ref('');
const abilityClass = ref('');
const KINDS = { metal: '金屬', leather: '皮革', cloth: '布料', wood: '木材', jewel: '寶石' };
const st = (has, custom) => (has ? (custom ? 'custom' : 'edited') : '');
const rows = computed(() => {
    void content.version;
    const m = content.mods;
    const q = search.value.trim();
    let list = [];
    if (sub.value === 'enemies') {
        const band = LEVEL_BANDS[enemyLevel.value];
        list = Object.values(enemies)
            .filter((e) => !enemyKind.value || (e.kind ?? '') === enemyKind.value)
            .filter((e) => !band || (e.level >= band[0] && e.level <= band[1]))
            .filter((e) => !enemyPlace.value || (enemyPlace.value === 'none' ? !places.value.get(e.id)?.size : !!places.value.get(e.id)?.has(enemyPlace.value)))
            .sort((a, b) => (m.enemies[a.id]?.custom ? -1 : 0) - (m.enemies[b.id]?.custom ? -1 : 0) || a.level - b.level)
            .map((e) => ({ key: e.id, name: e.name, note: `${e.level} 級・${ENEMY_KINDS[e.kind ?? ''] ?? ''}`, status: st(!!m.enemies[e.id], !builtinEnemy(e.id)) }));
    }
    else if (sub.value === 'items') {
        list = itemRules.items
            .filter((i) => !category.value || i.category === category.value)
            .filter((i) => !itemSource.value || !!sources.value.get(i.name)?.has(itemSource.value))
            .map((i) => ({ key: i.name, name: i.name, note: `${itemRules.categories[i.category]}・${formatMoney(i.price_cc)}`, status: st(!!m.items[i.name], !!m.items[i.name]?.custom) }))
            .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0));
    }
    else if (sub.value === 'abilities') {
        list = Object.values(abilities)
            .filter((a) => !abilityType.value || a.type === abilityType.value)
            .filter((a) => !abilityClass.value || a.classes.includes(abilityClass.value))
            .map((a) => ({
            key: a.id, name: a.name,
            note: `${ABILITY_TYPES[a.type]}${a.type === 'skill' ? ` ${a.unlock ?? 1} 級` : a.type === 'spell' ? ` ${a.circle ?? 1} 環` : ''}`,
            status: st(!!m.abilities[a.id], !builtinAbility(a.id)),
            sort: a.type === 'skill' ? a.unlock ?? 1 : a.type === 'spell' ? 20 + (a.circle ?? 1) : 0,
        }))
            .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort);
    }
    else if (sub.value === 'statuses') {
        list = Object.entries(statuses)
            .filter(([, s]) => !statusKind.value || s.kind === statusKind.value)
            .map(([id, s]) => ({ key: id, name: `${s.kind === 'buff' ? '🟢' : '🔴'} ${s.name}`, note: shortStatus(s), status: st(!!m.statuses?.[id], !builtinStatus(id)), sort: s.kind === 'buff' ? 0 : 1 }))
            .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort);
    }
    else if (sub.value === 'perks') {
        list = perkRules.perks
            .map((p) => ({ key: p.id, name: p.name, note: p.race ? '種族' : `強度 ${perkPower(p)}${p.train ? '・可受訓' : ''}`, status: st(!!m.perks[p.id], !builtinPerk(p.id)), sort: p.race ? 1 : 0 }))
            .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort);
    }
    else if (sub.value === 'tattoos') {
        const k = tattooKind.value;
        const tats = Object.entries(tattooRules.templates)
            .filter(([, t]) => !k || t.kind === k)
            .map(([id, t]) => ({ key: `t:${id}`, name: `${t.kind === 'oath' ? '📜' : '🖋️'} ${t.name}`, note: t.kind === 'oath' ? oathText(t.attrs ?? {}) : (t.places ?? []).map(placeName).slice(0, 3).join('、'), status: st(!!m.tattoos?.[id], !builtinTattoo(id)), sort: t.kind === 'oath' ? 1 : 0 }));
        const marks = !k || k === 'slave'
            ? Object.keys(slaveryRules.contracts).map((id) => ({ key: `m:${id}`, name: `⛓️ ${contractDef(id).name}`, note: placeName(contractDef(id).place), status: st(!!m.marks?.[id], !builtinMark(id)), sort: 2 }))
            : [];
        const rules = !k || k === 'slave' ? [{ key: 'rules', name: '⚙️ 印記設定', note: '用途、輕重順序、權重', status: st(!!m.markRules?.rules, false), sort: 3 }] : [];
        list = [...tats, ...marks, ...rules].sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort);
    }
    else if (sub.value === 'landmarks') {
        list = Object.values(landmarks)
            .map((l) => ({ key: l.id, name: `${l.emoji} ${l.name}`, note: `${locationById(l.location).name}・${l.types.map((t) => landmarkTypes[t]?.name).join('、')}`, status: st(!!m.landmarks?.[l.id], !builtinLandmark(l.id)) }))
            .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0));
    }
    else if (sub.value === 'shops') {
        list = Object.entries(shopRules.types)
            .map(([id, d]) => ({ key: id, name: `${d.emoji} ${d.name}`, note: d.custom ? `${m.shops?.[id]?.places?.length ?? 0} 處・${d.keeper.title}` : d.keeper.title, status: st(!!m.shops?.[id], !!d.custom) }))
            .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0));
    }
    else if (sub.value === 'stories') {
        list = stories
            .map((d) => ({ key: d.id, name: d.title, note: `${START_KINDS[d.start.kind]}・${d.nodes.length} 個任務點`, status: st(!!m.stories[d.id], !builtinStory(d.id)) }))
            .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0));
    }
    else if (sub.value === 'npcs') {
        list = namedNpcs
            .map((n) => ({ key: n.id, name: n.name, note: `${locationById(n.location).name}・${n.class ? className(n.class) : n.occupation ?? '普通人'} Lv.${n.level}`, status: st(!!m.npcs[n.id], !builtinNpc(n.id)) }))
            .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0));
    }
    else if (sub.value === 'bases') {
        list = Object.entries(gearRules.bases).map(([id, b]) => ({ key: id, name: b.name, note: `${KINDS[b.kind]}・${formatMoney(b.price)}`, status: st(!!m.bases[id], !builtinBase(id)) }));
    }
    else {
        list = Object.entries(gearRules.materials).map(([id, x]) => ({ key: id, name: x.name, note: `${KINDS[x.kind]}・${x.tier} 級`, status: st(!!m.materials[id], !builtinMaterial(id)) }));
    }
    return list
        .filter((r) => !q || r.name.includes(q) || r.key.includes(q))
        .filter((r) => filter.value === 'all' || r.status === filter.value);
});
const counts = computed(() => {
    const m = content.mods;
    const n = (o) => {
        const v = Object.values(o);
        return `自建 ${v.filter((x) => x.custom).length}・修改 ${v.filter((x) => !x.custom).length}`;
    };
    return { enemies: n(m.enemies), items: n(m.items), bases: n(m.bases), materials: n(m.materials), abilities: n(m.abilities), statuses: n(m.statuses ?? {}), perks: n(m.perks), tattoos: n({ ...(m.tattoos ?? {}), ...(m.marks ?? {}) }), landmarks: n(m.landmarks ?? {}), shops: n(m.shops ?? {}), npcs: n(m.npcs), stories: n(m.stories) };
});
const current = computed(() => {
    void content.version;
    const key = selected.value[sub.value];
    if (!key)
        return '';
    const exists = sub.value === 'enemies' ? !!enemies[key] : sub.value === 'items' ? !!itemDef(key) : sub.value === 'bases' ? !!gearRules.bases[key]
        : sub.value === 'npcs' ? namedNpcs.some((n) => n.id === key) : sub.value === 'stories' ? stories.some((d) => d.id === key)
            : sub.value === 'abilities' ? !!abilities[key] : sub.value === 'statuses' ? !!statuses[key] : sub.value === 'perks' ? !!perkDef(key)
                : sub.value === 'shops' ? !!shopRules.types[key]
                    : sub.value === 'landmarks' ? !!landmarks[key]
                        : sub.value === 'tattoos' ? key === 'rules' || (key.startsWith('t:') ? !!tattooRules.templates[key.slice(2)] : !!slaveryRules.contracts[key.slice(2)])
                            : !!gearRules.materials[key];
    return exists ? key : '';
});
function select(key) {
    selected.value[sub.value] = key;
}
function create() {
    try {
        if (sub.value === 'enemies') {
            const id = newModId('enemy');
            content.saveEnemy(id, newEnemy(id));
            select(id);
        }
        else if (sub.value === 'items') {
            let name = '新的物品';
            for (let i = 2; itemDef(name) || game.state?.customItems?.[name]; i++)
                name = `新的物品${i}`;
            content.saveItem(name, newItem(name));
            select(name);
        }
        else if (sub.value === 'npcs') {
            const id = newModId('npc');
            content.saveNpc(id, newNpc(id));
            select(id);
        }
        else if (sub.value === 'abilities') {
            const id = newModId('ability');
            content.saveAbility(id, newAbility(id));
            select(id);
        }
        else if (sub.value === 'statuses') {
            const id = newModId('status');
            content.saveStatus(id, newStatus(statusKind.value === 'debuff' ? 'debuff' : 'buff'));
            select(id);
        }
        else if (sub.value === 'perks') {
            const id = newModId('perk');
            content.savePerk(id, newPerk(id));
            select(id);
        }
        else if (sub.value === 'tattoos') {
            if (tattooKind.value === 'slave') {
                const id = newModId('mark');
                content.saveMark(id, newMark());
                select(`m:${id}`);
            }
            else {
                const id = newModId('tattoo');
                content.saveTattoo(id, newTattooTemplate(tattooKind.value === 'oath' ? 'oath' : 'plain'));
                select(`t:${id}`);
            }
        }
        else if (sub.value === 'landmarks') {
            const id = newLandmarkId();
            content.saveLandmark(id, newLandmark(id, game.state && locationById(game.state.location).type !== 'dungeon' ? game.state.location : undefined));
            select(id);
        }
        else if (sub.value === 'shops') {
            const id = newShopId();
            content.saveShop(id, newShop());
            select(id);
        }
        else if (sub.value === 'stories') {
            const id = newModId('story');
            content.saveStory(id, newStory(id));
            select(id);
        }
        else if (sub.value === 'bases') {
            const id = newModId('base');
            content.saveBase(id, newBase(), true);
            select(id);
        }
        else {
            const id = newModId('mat');
            content.saveMaterial(id, newMaterial(), true);
            select(id);
        }
        filter.value = 'all';
        search.value = '';
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
/** 以目前選的項目為範本複製一份自建項目 */
function duplicate() {
    const key = current.value;
    if (!key)
        return;
    try {
        if (sub.value === 'enemies') {
            const id = newModId('enemy');
            const src = JSON.parse(JSON.stringify(content.mods.enemies[key] ?? enemies[key]));
            delete src.spawns;
            delete src.exclude;
            content.saveEnemy(id, { ...src, name: `${src.name}（複製）`, custom: true });
            select(id);
        }
        else if (sub.value === 'items') {
            let name = `${key}（複製）`.slice(0, 20);
            for (let i = 2; itemDef(name) || game.state?.customItems?.[name]; i++)
                name = `${key.slice(0, 15)}（複製${i}）`;
            content.saveItem(name, { ...JSON.parse(JSON.stringify(itemDef(key))), custom: true });
            select(name);
        }
        else if (sub.value === 'landmarks') {
            // 複製：同一個聚落另一格空地
            const id = newLandmarkId();
            const src = landmarks[key];
            content.saveLandmark(id, { ...JSON.parse(JSON.stringify(src)), ...newLandmark(id, src.location), name: `${src.name}2`.slice(0, 12), emoji: src.emoji, desc: src.desc, types: [...src.types], ...(src.scene ? { scene: src.scene } : {}) });
            select(id);
        }
        else if (sub.value === 'shops') {
            // 複製內建的店不會帶走專屬功能與位置
            const id = newShopId();
            content.saveShop(id, shopAsCustom(key));
            select(id);
        }
        else if (sub.value === 'stories') {
            const id = newModId('story');
            // 開頭旗標換成新任務自己的（和原本的重複算錯誤）
            content.saveStory(id, copyStory(content.mods.stories[key] ?? stories.find((d) => d.id === key), id));
            select(id);
        }
        else if (sub.value === 'perks') {
            // 複製種族特質會變成一般的特質
            const id = newModId('perk');
            const src = JSON.parse(JSON.stringify(content.mods.perks[key] ?? perkDef(key)));
            delete src.race;
            content.savePerk(id, { ...src, name: `${src.name}2`.slice(0, 12), custom: true });
            select(id);
        }
        else if (sub.value === 'tattoos') {
            if (key === 'rules')
                return;
            const raw = key.slice(2);
            if (key.startsWith('t:')) {
                const id = newModId('tattoo');
                const src = JSON.parse(JSON.stringify(content.mods.tattoos?.[raw] ?? tattooRules.templates[raw]));
                content.saveTattoo(id, { ...src, name: `${src.name}2`.slice(0, 12), custom: true });
                select(`t:${id}`);
            }
            else {
                const id = newModId('mark');
                const src = JSON.parse(JSON.stringify(content.mods.marks?.[raw] ?? slaveryRules.contracts[raw]));
                content.saveMark(id, { ...src, name: `${src.name}2`.slice(0, 12), custom: true });
                select(`m:${id}`);
            }
        }
        else if (sub.value === 'statuses') {
            const id = newModId('status');
            const src = JSON.parse(JSON.stringify(content.mods.statuses[key] ?? statuses[key]));
            content.saveStatus(id, { ...src, name: `${src.name}2`.slice(0, 10), custom: true });
            select(id);
        }
        else if (sub.value === 'abilities') {
            const id = newModId('ability');
            const src = JSON.parse(JSON.stringify(content.mods.abilities[key] ?? abilities[key]));
            content.saveAbility(id, { ...src, name: `${src.name}2`.slice(0, 16), custom: true });
            select(id);
        }
        else if (sub.value === 'npcs') {
            const id = newModId('npc');
            const src = JSON.parse(JSON.stringify(content.mods.npcs[key] ?? namedNpcs.find((n) => n.id === key)));
            content.saveNpc(id, { ...src, name: `${src.name}2`.slice(0, 12), custom: true });
            select(id);
        }
        else if (sub.value === 'bases') {
            const id = newModId('base');
            const src = JSON.parse(JSON.stringify(content.mods.bases[key] ?? gearRules.bases[key]));
            content.saveBase(id, { ...src, name: `${src.name}2` }, true);
            select(id);
        }
        else {
            const id = newModId('mat');
            const src = JSON.parse(JSON.stringify(content.mods.materials[key] ?? gearRules.materials[key]));
            content.saveMaterial(id, { ...src, name: `${src.name}2` }, true);
            select(id);
        }
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
const NEW_LABEL = { enemies: '＋ 新增怪物', items: '＋ 新增物品', bases: '＋ 新增底材', materials: '＋ 新增材料', abilities: '＋ 新增技能', statuses: '＋ 新增狀態', perks: '＋ 新增特質', tattoos: '＋ 新增刺青', landmarks: '＋ 新增地標', shops: '＋ 新增商店', npcs: '＋ 新增角色', stories: '＋ 新增任務' };
// ---- 匯出、匯入、重設 ----
const fileInput = ref(null);
function exportAll() {
    download(`elondia-content-${dateStamp()}.json`, content.exportMods());
}
async function onImport(e) {
    const input = e.target;
    const f = input.files?.[0];
    input.value = '';
    if (!f)
        return;
    if (!confirm('匯入會取代目前所有的自訂內容，確定嗎？'))
        return;
    try {
        content.importMods(await f.text());
        game.flash('已匯入自訂內容');
    }
    catch (err) {
        game.error = `匯入失敗：${err instanceof Error ? err.message : String(err)}`;
    }
}
function resetAll() {
    if (confirm('刪除所有自建的內容，並把修改過的內建項目全部恢復預設？'))
        content.resetAll();
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(sub, {});
// @ts-ignore
__VLS_withDotValue(counts, {});
// @ts-ignore
__VLS_withDotValue(content, {});
// @ts-ignore
__VLS_withDotValue(NEW_LABEL, {});
// @ts-ignore
__VLS_withDotValue(current, {});
// @ts-ignore
__VLS_withDotValue(itemRules, {});
// @ts-ignore
__VLS_withDotValue(rows, {});
// @ts-ignore
__VLS_withDotValue(fileInput, {});
void {};
/** @type {__VLS_StyleScopedClasses['subs']} */ ;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
/** @type {__VLS_StyleScopedClasses['rows']} */ ;
/** @type {__VLS_StyleScopedClasses['rows']} */ ;
/** @type {__VLS_StyleScopedClasses['rows']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['rows']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "content-view" },
});
/** @type {__VLS_StyleScopedClasses['content-view']} */ ;
const __VLS_0 = WorldBar;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
// @ts-ignore
}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "subs row" },
});
/** @type {__VLS_StyleScopedClasses['subs']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(SUBS, {})));
for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                sub.value = t.id;
                resetFilters();
                // @ts-ignore
                [SUBS, sub,];
            } },
        key: (t.id),
        ...{ class: ({ active: sub.value === t.id }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    (t.label);
    // @ts-ignore
    [sub,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(counts.value[sub.value]);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted note" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['note']} */ ;
if (content.value.problems.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    (content.value.problems.join('；'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "layout" },
});
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel list-panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['list-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (create) },
    ...{ class: "small primary" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
(NEW_LABEL.value[sub.value]);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (duplicate) },
    ...{ class: "small" },
    disabled: (!current.value),
    title: "以選取的項目為範本，建立一個自建項目",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "搜尋名稱",
    ...{ class: "grow" },
});
(__VLS_unwrap(search, {}));
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(filter, {})),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "all",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "custom",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "edited",
});
if (sub.value === 'items') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(category, {})),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_6 = __VLS_tryAsConstant((itemRules.value.categories));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [sub, sub, sub, counts, content, content, NEW_LABEL, current, search, filter, category, itemRules,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(itemSource, {})),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(ITEM_SOURCE_NAME, {})));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [itemSource, ITEM_SOURCE_NAME,];
    }
}
if (sub.value === 'enemies') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(enemyKind, {})),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(ENEMY_KINDS, {})));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [sub, enemyKind, ENEMY_KINDS,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(enemyLevel, {})),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_9 = __VLS_tryAsConstant((__VLS_unwrap(LEVEL_BANDS, {})));
    for (const [_, k] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (k);
        // @ts-ignore
        [enemyLevel, LEVEL_BANDS,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(enemyPlace, {})),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_10 = __VLS_tryAsConstant((__VLS_unwrap(placeOptions, {})));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p.key),
            value: (p.key),
        });
        (p.label);
        // @ts-ignore
        [enemyPlace, placeOptions,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "none",
    });
}
if (sub.value === 'statuses') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(statusKind, {})),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "buff",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "debuff",
    });
}
if (sub.value === 'tattoos') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(tattooKind, {})),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "plain",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "oath",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "slave",
    });
}
if (sub.value === 'abilities') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(abilityType, {})),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_11 = __VLS_tryAsConstant((__VLS_unwrap(ABILITY_TYPES, {})));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [sub, sub, sub, statusKind, tattooKind, abilityType, ABILITY_TYPES,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(abilityClass, {})),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_12 = __VLS_tryAsConstant((__VLS_unwrap(abilityClasses, {})()));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (c),
            value: (c),
        });
        (c === 'monster' ? '怪物' : __VLS_unwrap(className, {})(c));
        // @ts-ignore
        [abilityClass, abilityClasses, className,];
    }
}
if (sub.value === 'enemies' || sub.value === 'items' || sub.value === 'abilities' || sub.value === 'statuses') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted count" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['count']} */ ;
    (rows.value.length);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain rows" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['rows']} */ ;
const __VLS_13 = __VLS_tryAsConstant((rows.value));
for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (select(r.key));
                // @ts-ignore
                [sub, sub, sub, sub, rows, rows,];
            } },
        key: (r.key),
        ...{ class: ({ active: current.value === r.key }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "name" },
    });
    /** @type {__VLS_StyleScopedClasses['name']} */ ;
    (r.name);
    if (r.status === 'custom') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    }
    else if (r.status === 'edited') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted note-r" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['note-r']} */ ;
    (r.note);
    // @ts-ignore
    [current,];
}
if (!rows.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        ...{ class: "muted small" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
if (!current.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
else if (sub.value === 'enemies') {
    const __VLS_14 = EnemyEditor;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`e-${current.value}`),
    }));
    const __VLS_16 = __VLS_15({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`e-${current.value}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    let __VLS_19;
    const __VLS_20 = {
        /** @type {typeof __VLS_19.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!(sub.value === 'enemies'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current, current, rows,];
        },
    };
    void __VLS_20;
    var __VLS_17;
    var __VLS_18;
}
else if (sub.value === 'items') {
    const __VLS_21 = ItemEditor;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        // @ts-ignore
        ...{ 'onRenamed': {} }, ...{ 'onDeleted': {} }, key: (`i-${current.value}`), name: (current.value),
    }));
    const __VLS_23 = __VLS_22({
        ...{ 'onRenamed': {} },
        ...{ 'onDeleted': {} },
        key: (`i-${current.value}`),
        name: (current.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    let __VLS_26;
    const __VLS_27 = {
        /** @type {typeof __VLS_26.renamed} */
        onRenamed: (select),
    };
    void __VLS_27;
    const __VLS_28 = {
        /** @type {typeof __VLS_26.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!(sub.value === 'items'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_28;
    var __VLS_24;
    var __VLS_25;
}
else if (sub.value === 'abilities') {
    const __VLS_29 = AbilityEditor;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`a-${current.value}`),
    }));
    const __VLS_31 = __VLS_30({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`a-${current.value}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    let __VLS_34;
    const __VLS_35 = {
        /** @type {typeof __VLS_34.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!(sub.value === 'abilities'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_35;
    var __VLS_32;
    var __VLS_33;
}
else if (sub.value === 'statuses') {
    const __VLS_36 = StatusEditor;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`s-${current.value}`),
    }));
    const __VLS_38 = __VLS_37({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`s-${current.value}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    let __VLS_41;
    const __VLS_42 = {
        /** @type {typeof __VLS_41.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!!(sub.value === 'abilities'))
                throw 0;
            if (!(sub.value === 'statuses'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_42;
    var __VLS_39;
    var __VLS_40;
}
else if (sub.value === 'perks') {
    const __VLS_43 = PerkEditor;
    // @ts-ignore
    const __VLS_44 = __VLS_asFunctionalComponent1(__VLS_43, new __VLS_43({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`p-${current.value}`),
    }));
    const __VLS_45 = __VLS_44({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`p-${current.value}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_44));
    let __VLS_48;
    const __VLS_49 = {
        /** @type {typeof __VLS_48.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!!(sub.value === 'abilities'))
                throw 0;
            if (!!(sub.value === 'statuses'))
                throw 0;
            if (!(sub.value === 'perks'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_49;
    var __VLS_46;
    var __VLS_47;
}
else if (sub.value === 'shops') {
    const __VLS_50 = ShopEditor;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`shop-${current.value}`),
    }));
    const __VLS_52 = __VLS_51({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`shop-${current.value}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    let __VLS_55;
    const __VLS_56 = {
        /** @type {typeof __VLS_55.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!!(sub.value === 'abilities'))
                throw 0;
            if (!!(sub.value === 'statuses'))
                throw 0;
            if (!!(sub.value === 'perks'))
                throw 0;
            if (!(sub.value === 'shops'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_56;
    var __VLS_53;
    var __VLS_54;
}
else if (sub.value === 'landmarks') {
    const __VLS_57 = LandmarkEditor;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`lm-${current.value}`),
    }));
    const __VLS_59 = __VLS_58({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`lm-${current.value}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    let __VLS_62;
    const __VLS_63 = {
        /** @type {typeof __VLS_62.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!!(sub.value === 'abilities'))
                throw 0;
            if (!!(sub.value === 'statuses'))
                throw 0;
            if (!!(sub.value === 'perks'))
                throw 0;
            if (!!(sub.value === 'shops'))
                throw 0;
            if (!(sub.value === 'landmarks'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_63;
    var __VLS_60;
    var __VLS_61;
}
else if (sub.value === 'tattoos') {
    if (current.value === 'rules') {
        const __VLS_64 = MarkRulesEditor;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent1(__VLS_64, new __VLS_64({
            // @ts-ignore
            key: "rules",
        }));
        const __VLS_66 = __VLS_65({
            key: "rules",
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    }
    else if (current.value.startsWith('t:')) {
        const __VLS_69 = TattooEditor;
        // @ts-ignore
        const __VLS_70 = __VLS_asFunctionalComponent1(__VLS_69, new __VLS_69({
            // @ts-ignore
            ...{ 'onDeleted': {} }, id: (current.value.slice(2)), key: (current.value),
        }));
        const __VLS_71 = __VLS_70({
            ...{ 'onDeleted': {} },
            id: (current.value.slice(2)),
            key: (current.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_70));
        let __VLS_74;
        const __VLS_75 = {
            /** @type {typeof __VLS_74.deleted} */
            onDeleted: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(!current.value))
                    throw 0;
                if (!!(sub.value === 'enemies'))
                    throw 0;
                if (!!(sub.value === 'items'))
                    throw 0;
                if (!!(sub.value === 'abilities'))
                    throw 0;
                if (!!(sub.value === 'statuses'))
                    throw 0;
                if (!!(sub.value === 'perks'))
                    throw 0;
                if (!!(sub.value === 'shops'))
                    throw 0;
                if (!!(sub.value === 'landmarks'))
                    throw 0;
                if (!(sub.value === 'tattoos'))
                    throw 0;
                if (!!(current.value === 'rules'))
                    throw 0;
                if (!(current.value.startsWith('t:')))
                    throw 0;
                return (select(''));
                // @ts-ignore
                [sub, current, current, current, current,];
            },
        };
        void __VLS_75;
        var __VLS_72;
        var __VLS_73;
    }
    else {
        const __VLS_76 = MarkEditor;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent1(__VLS_76, new __VLS_76({
            // @ts-ignore
            ...{ 'onDeleted': {} }, id: (current.value.slice(2)), key: (current.value),
        }));
        const __VLS_78 = __VLS_77({
            ...{ 'onDeleted': {} },
            id: (current.value.slice(2)),
            key: (current.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        let __VLS_81;
        const __VLS_82 = {
            /** @type {typeof __VLS_81.deleted} */
            onDeleted: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(!current.value))
                    throw 0;
                if (!!(sub.value === 'enemies'))
                    throw 0;
                if (!!(sub.value === 'items'))
                    throw 0;
                if (!!(sub.value === 'abilities'))
                    throw 0;
                if (!!(sub.value === 'statuses'))
                    throw 0;
                if (!!(sub.value === 'perks'))
                    throw 0;
                if (!!(sub.value === 'shops'))
                    throw 0;
                if (!!(sub.value === 'landmarks'))
                    throw 0;
                if (!(sub.value === 'tattoos'))
                    throw 0;
                if (!!(current.value === 'rules'))
                    throw 0;
                if (!!(current.value.startsWith('t:')))
                    throw 0;
                return (select(''));
                // @ts-ignore
                [current, current,];
            },
        };
        void __VLS_82;
        var __VLS_79;
        var __VLS_80;
    }
}
else if (sub.value === 'npcs') {
    const __VLS_83 = NpcEditor;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent1(__VLS_83, new __VLS_83({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`n-${current.value}`),
    }));
    const __VLS_85 = __VLS_84({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`n-${current.value}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    let __VLS_88;
    const __VLS_89 = {
        /** @type {typeof __VLS_88.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!!(sub.value === 'abilities'))
                throw 0;
            if (!!(sub.value === 'statuses'))
                throw 0;
            if (!!(sub.value === 'perks'))
                throw 0;
            if (!!(sub.value === 'shops'))
                throw 0;
            if (!!(sub.value === 'landmarks'))
                throw 0;
            if (!!(sub.value === 'tattoos'))
                throw 0;
            if (!(sub.value === 'npcs'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_89;
    var __VLS_86;
    var __VLS_87;
}
else if (sub.value === 'stories') {
    const __VLS_90 = StoryEditor;
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
        // @ts-ignore
        ...{ 'onDeleted': {} }, ...{ 'onOpen': {} }, id: (current.value), key: (`s-${current.value}`),
    }));
    const __VLS_92 = __VLS_91({
        ...{ 'onDeleted': {} },
        ...{ 'onOpen': {} },
        id: (current.value),
        key: (`s-${current.value}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_91));
    let __VLS_95;
    const __VLS_96 = {
        /** @type {typeof __VLS_95.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!!(sub.value === 'abilities'))
                throw 0;
            if (!!(sub.value === 'statuses'))
                throw 0;
            if (!!(sub.value === 'perks'))
                throw 0;
            if (!!(sub.value === 'shops'))
                throw 0;
            if (!!(sub.value === 'landmarks'))
                throw 0;
            if (!!(sub.value === 'tattoos'))
                throw 0;
            if (!!(sub.value === 'npcs'))
                throw 0;
            if (!(sub.value === 'stories'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_96;
    const __VLS_97 = {
        /** @type {typeof __VLS_95.open} */
        onOpen: (select),
    };
    void __VLS_97;
    var __VLS_93;
    var __VLS_94;
}
else if (sub.value === 'bases') {
    const __VLS_98 = GearEditor;
    // @ts-ignore
    const __VLS_99 = __VLS_asFunctionalComponent1(__VLS_98, new __VLS_98({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`b-${current.value}`), kind: "base",
    }));
    const __VLS_100 = __VLS_99({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`b-${current.value}`),
        kind: "base",
    }, ...__VLS_functionalComponentArgsRest(__VLS_99));
    let __VLS_103;
    const __VLS_104 = {
        /** @type {typeof __VLS_103.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!!(sub.value === 'abilities'))
                throw 0;
            if (!!(sub.value === 'statuses'))
                throw 0;
            if (!!(sub.value === 'perks'))
                throw 0;
            if (!!(sub.value === 'shops'))
                throw 0;
            if (!!(sub.value === 'landmarks'))
                throw 0;
            if (!!(sub.value === 'tattoos'))
                throw 0;
            if (!!(sub.value === 'npcs'))
                throw 0;
            if (!!(sub.value === 'stories'))
                throw 0;
            if (!(sub.value === 'bases'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [sub, current, current,];
        },
    };
    void __VLS_104;
    var __VLS_101;
    var __VLS_102;
}
else {
    const __VLS_105 = GearEditor;
    // @ts-ignore
    const __VLS_106 = __VLS_asFunctionalComponent1(__VLS_105, new __VLS_105({
        // @ts-ignore
        ...{ 'onDeleted': {} }, id: (current.value), key: (`m-${current.value}`), kind: "material",
    }));
    const __VLS_107 = __VLS_106({
        ...{ 'onDeleted': {} },
        id: (current.value),
        key: (`m-${current.value}`),
        kind: "material",
    }, ...__VLS_functionalComponentArgsRest(__VLS_106));
    let __VLS_110;
    const __VLS_111 = {
        /** @type {typeof __VLS_110.deleted} */
        onDeleted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(!current.value))
                throw 0;
            if (!!(sub.value === 'enemies'))
                throw 0;
            if (!!(sub.value === 'items'))
                throw 0;
            if (!!(sub.value === 'abilities'))
                throw 0;
            if (!!(sub.value === 'statuses'))
                throw 0;
            if (!!(sub.value === 'perks'))
                throw 0;
            if (!!(sub.value === 'shops'))
                throw 0;
            if (!!(sub.value === 'landmarks'))
                throw 0;
            if (!!(sub.value === 'tattoos'))
                throw 0;
            if (!!(sub.value === 'npcs'))
                throw 0;
            if (!!(sub.value === 'stories'))
                throw 0;
            if (!!(sub.value === 'bases'))
                throw 0;
            return (select(''));
            // @ts-ignore
            [current, current,];
        },
    };
    void __VLS_111;
    var __VLS_108;
    var __VLS_109;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row footer small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['footer']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (exportAll) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (fileInput.value?.click());
            // @ts-ignore
            [fileInput,];
        } },
    ...{ class: "small" },
    title: "會取代目前所有的自訂內容",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (onImport) },
    ref: "fileInput",
    type: "file",
    accept: ".json,application/json",
    hidden: true,
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (resetAll) },
    ...{ class: "small danger" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
