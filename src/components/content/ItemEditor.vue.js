import { computed, ref, watch } from 'vue';
import { ATTR_IDS, attrName, companionRules, damageTypeName, damageTypes, enemies, geography, itemDef, itemRules, statuses, stories, } from '@/engine/data';
import { gearPrice, gearRules, gearSummary, rarityName, RARITY_ORDER } from '@/engine/gear';
import { actionRules, DUNGEON_LAYER_NAME, npcTags, perkRules, slaveryRules, tagDef } from '@/engine/data';
import { intelSummary, useSummary } from '@/engine/inventory';
import { CHEST_LAYERS, itemSources, sanitizeGearSpecLoose } from '@/engine/mods';
import { formatMoney } from '@/engine/money';
import { TOOL_KINDS, toolSummary } from '@/engine/tools';
import { choosablePerks, CRAFT_IDS, craftRules, homeRules } from '@/engine/data';
import { PLACE_NAME } from '@/engine/homes';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import AffinityRows from './AffinityRows.vue';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
function current() {
    const base = content.mods.items[props.name] ?? itemDef(props.name);
    const item = clone(base);
    const src = itemSources(props.name);
    item.chests ??= src.chests;
    item.gather ??= src.gather;
    item.use ??= {};
    // 打開時就補上預設的情報內容，才不會一打開就顯示「未儲存」
    if (item.category === 'info')
        item.intel ??= { kind: 'point' };
    return { item, drops: src.drops };
}
const init = current();
const draft = ref(init.item);
const drops = ref(init.drops);
const newName = ref(props.name);
const snapshotText = () => JSON.stringify([draft.value, drops.value, newName.value]);
const saved = ref(snapshotText());
function reset() {
    const c = current();
    draft.value = c.item;
    drops.value = c.drops;
    newName.value = props.name;
    saved.value = snapshotText();
}
watch(() => props.name, reset);
const dirty = computed(() => snapshotText() !== saved.value);
const custom = computed(() => !!content.mods.items[props.name]?.custom);
const edited = computed(() => !custom.value && !!content.mods.items[props.name]);
// ---- 選項 ----
const CATS = itemRules.categories;
const damageIds = damageTypes.types.map((t) => t.id);
const statusList = Object.entries(statuses).map(([id, s]) => ({ id, ...s }));
const debuffs = statusList.filter((s) => s.kind === 'debuff');
const buffs = statusList.filter((s) => s.kind === 'buff');
const enemyList = computed(() => {
    void content.version;
    return Object.values(enemies).sort((a, b) => a.level - b.level);
});
const LAYER = DUNGEON_LAYER_NAME;
const SHOPS = { general: '雜貨店', temple: '神殿', tavern: '酒館', smith: '鐵匠鋪', tailor: '裁縫店', jeweler: '珠寶店', magic: '魔法物品店', info: '情報商' };
const LOCS = { village: '任何聚落', town: '城鎮以上', city: '城市以上', capital: '王都' };
const bases = computed(() => {
    void content.version;
    return Object.entries(gearRules.bases);
});
const materials = computed(() => {
    void content.version;
    const kind = draft.value.gear ? gearRules.bases[draft.value.gear.base]?.kind : undefined;
    return Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind);
});
// ---- 欄位 ----
const use = computed(() => (draft.value.use ??= {}));
// 吃喝可以給的狀態：到下次長休就解除的那些（用餐、喝酒、磨利……）
const conditionList = Object.entries(companionRules.conditions)
    .filter(([id, c]) => !id.startsWith('$') && c.clears === 'long_rest')
    .map(([id, c]) => ({ id, name: `${c.name}：${c.desc}` }));
function setTool(kind) {
    if (!kind)
        delete draft.value.tool;
    else
        draft.value.tool = {
            kind: kind,
            ...(itemRules.tools[kind].bonus !== undefined ? { bonus: draft.value.tool?.bonus ?? itemRules.tools[kind].bonus } : {}),
            ...(kind === 'craft' ? { craft: draft.value.tool?.craft ?? 'smithing', tier: draft.value.tool?.tier ?? 1 } : {}),
        };
}
const toolText = computed(() => toolSummary(draft.value.tool));
// 家具
const furn = computed(() => (draft.value.furniture ??= { places: ['indoor'] }));
function setFurnFunction(v) {
    if (v === 'bed' || v === 'workbench' || v === 'garden')
        furn.value.function = v;
    else
        delete furn.value.function;
    if (v === 'workbench')
        furn.value.craft ??= 'smithing';
    else
        delete furn.value.craft;
}
function toggleFurnPlace(p) {
    const list = furn.value.places;
    furn.value.places = list.includes(p) ? (list.length > 1 ? list.filter((x) => x !== p) : list) : [...list, p];
}
// 配方（怎麼做出這件物品）與種子（種在苗圃長出什麼）
const itemNames = computed(() => {
    void content.version;
    return itemRules.items.map((i) => i.name).filter((n) => n !== props.name);
});
function toggleRecipe(on) {
    if (on)
        draft.value.recipe = { craft: 'alchemy', level: 1, inputs: [{ name: '', qty: 1 }], hours: 2 };
    else
        delete draft.value.recipe;
}
function toggleSeed(on) {
    if (on)
        draft.value.seed = { yields: [''], qty: [1, 2], days: 3, place: 'yard' };
    else
        delete draft.value.seed;
}
// ---- 情報 ----
const intel = computed(() => (draft.value.intel ??= { kind: 'point' }));
const intelText = computed(() => intelSummary(draft.value.intel));
const intelIsDungeon = computed(() => geography.locations.find((l) => l.id === intel.value.location)?.type === 'dungeon');
function setIntelKind(kind) {
    draft.value.intel = kind === 'story' ? { kind, story: stories[0]?.id } : { kind };
}
function setIntelLocation(id) {
    intel.value.location = id || undefined;
    if (!intelIsDungeon.value)
        delete intel.value.layer;
}
function toggle(list, v, on) {
    const set = new Set(list ?? []);
    if (on)
        set.add(v);
    else
        set.delete(v);
    return [...set];
}
function setTag(tag, on) {
    draft.value.tags = toggle(draft.value.tags, tag, on);
}
function setChest(layer, pct) {
    draft.value.chests = { ...(draft.value.chests ?? {}), [layer]: Math.max(0, Math.min(100, pct)) / 100 };
}
function setGather(g, on) {
    draft.value.gather = toggle(draft.value.gather, g, on);
}
function setForge(m, on) {
    const list = toggle(draft.value.forge?.materials, m, on);
    draft.value.forge = list.length ? { materials: list } : undefined;
}
function ensureGear() {
    if (!draft.value.gear)
        draft.value.gear = { base: 'longsword', material: 'iron' };
}
watch(() => draft.value.category, (c) => {
    if (c === 'equipment')
        ensureGear();
});
function setBase(id) {
    const kind = gearRules.bases[id].kind;
    const mat = gearRules.materials[draft.value.gear?.material ?? '']?.kind === kind ? draft.value.gear.material
        : Object.entries(gearRules.materials).find(([, m]) => m.kind === kind)[0];
    draft.value.gear = { ...draft.value.gear, base: id, material: mat };
}
const enchantMods = computed({
    get: () => draft.value.gear?.enchants?.mods ?? {},
    set: (v) => {
        if (draft.value.gear)
            draft.value.gear.enchants = { ...(draft.value.gear.enchants ?? {}), mods: v };
    },
});
function setEnchantMod(k, v) {
    enchantMods.value = { ...enchantMods.value, [k]: v || undefined };
}
const MOD_NAME = { hit: '命中', damage: '傷害', evade: '迴避', dr: '減傷', save: '豁免', crit: '幸運一擊', ap_regen: '行動點回復' };
// ---- 獨特物品的檢定加值（一種，可以疊加；不能打造、購買，只能從特殊事件或寶箱得到） ----
const uniqueContexts = Object.entries(perkRules.contexts);
const uniqueKinds = Object.entries(actionRules.kinds).map(([k, v]) => [k, v.name]);
const uniqueTags = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name]);
function setUnique(on) {
    if (!draft.value.gear)
        return;
    if (on)
        draft.value.gear.unique = { check: { contexts: ['lock'] }, bonus: 1 };
    else
        delete draft.value.gear.unique;
}
function toggleUniqueFilter(key, value, on) {
    const u = draft.value.gear?.unique;
    if (!u)
        return;
    const set = new Set(u.check[key] ?? []);
    if (on)
        set.add(value);
    else
        set.delete(value);
    if (set.size)
        u.check[key] = [...set];
    else
        delete u.check[key];
}
// ---- 屬性的加減（只有內容資料裡的裝備；不在商店上架）與主人強制裝備 ----
const attrMax = gearRules.attrs.max_change;
function setGearAttr(a, v) {
    const g = draft.value.gear;
    if (!g)
        return;
    const attrs = { ...(g.attrs ?? {}) };
    if (v)
        attrs[a] = Math.max(-attrMax, Math.min(attrMax, Math.round(v)));
    else
        delete attrs[a];
    if (Object.keys(attrs).length)
        g.attrs = attrs;
    else
        delete g.attrs;
}
const masterTags = Object.keys(slaveryRules.master_tags.tags);
function setMasterForce(on) {
    if (on)
        draft.value.master_force = {};
    else
        delete draft.value.master_force;
}
function toggleMasterTag(t, on) {
    const f = draft.value.master_force;
    if (!f)
        return;
    const set = new Set(f.tags ?? []);
    if (on)
        set.add(t);
    else
        set.delete(t);
    if (set.size)
        f.tags = [...set];
    else
        delete f.tags;
}
const gearText = computed(() => {
    const g = sanitizeGearSpecLoose(draft.value.gear);
    return g ? gearSummary(g) : '底材與材料的類型要一致';
});
function priceFromGear() {
    const g = sanitizeGearSpecLoose(draft.value.gear);
    if (g)
        draft.value.price_cc = gearPrice(g);
}
const useText = computed(() => {
    try {
        return useSummary(draft.value.use);
    }
    catch {
        return '';
    }
});
function addDrop() {
    drops.value.push({ enemy: enemyList.value[0].id, chance: 0.3, qty: 1 });
}
// ---- 動作 ----
function save() {
    try {
        const target = content.saveItem(props.name, draft.value, custom.value ? newName.value : undefined);
        content.setItemDrops(target, drops.value);
        game.flash(`已儲存「${target}」`);
        if (target !== props.name)
            emit('renamed', target);
        else
            reset();
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function restore() {
    if (!confirm(`把「${props.name}」恢復成內建的樣子？（怪物掉落的設定改在怪物上，不會一起恢復）`))
        return;
    content.restoreItem(props.name);
    reset();
}
// 還有地方用到時不能刪（見 docs/CONTENT_DEPENDENCIES.md）
const usage = computed(() => {
    void content.version;
    void game.state?.time.minute;
    return content.usageOf('item', props.name);
});
function remove() {
    if (!confirm(`刪除「${props.name}」？怪物不再掉落；其他存檔裡已有的會變成無法使用的雜物。`))
        return;
    try {
        content.deleteItem(props.name);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
        return;
    }
    content.setItemDrops(props.name, []);
    emit('deleted');
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(custom, {});
// @ts-ignore
__VLS_withDotValue(edited, {});
// @ts-ignore
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
// @ts-ignore
__VLS_withDotValue(draft, {});
// @ts-ignore
__VLS_withDotValue(LAYER, {});
// @ts-ignore
__VLS_withDotValue(drops, {});
// @ts-ignore
__VLS_withDotValue(useText, {});
// @ts-ignore
__VLS_withDotValue(use, {});
// @ts-ignore
__VLS_withDotValue(toolText, {});
// @ts-ignore
__VLS_withDotValue(itemRules, {});
// @ts-ignore
__VLS_withDotValue(craftRules, {});
// @ts-ignore
__VLS_withDotValue(furn, {});
// @ts-ignore
__VLS_withDotValue(PLACE_NAME, {});
// @ts-ignore
__VLS_withDotValue(homeRules, {});
// @ts-ignore
__VLS_withDotValue(intel, {});
// @ts-ignore
__VLS_withDotValue(geography, {});
// @ts-ignore
__VLS_withDotValue(intelIsDungeon, {});
// @ts-ignore
__VLS_withDotValue(enchantMods, {});
// @ts-ignore
__VLS_withDotValue(gearRules, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "editor" },
});
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
(__VLS_ctx.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag" },
});
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
(custom.value ? '自建' : edited.value ? '內建・已修改' : '內建');
if (dirty.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag warn" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (save) },
    ...{ class: "small primary" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (reset) },
    ...{ class: "small" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (!custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (restore) },
        ...{ class: "small" },
        disabled: (!edited.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (remove) },
        ...{ class: "small danger" },
        disabled: (usage.value.length > 0),
        title: (usage.value.length ? '還有地方用到，不能刪除' : ''),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
const __VLS_0 = UsageNote;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    usage: (usage.value), deletable: (custom.value),
}));
const __VLS_2 = __VLS_1({
    usage: (usage.value),
    deletable: (custom.value),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
if (custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "20",
    });
    (__VLS_unwrap(newName, {}));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.name),
        disabled: true,
        title: "內建物品不能改名（存檔與掉落表用名稱對應）",
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.category),
});
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(CATS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [name, name, custom, custom, custom, custom, edited, edited, dirty, dirty, dirty, usage, usage, usage, newName, draft, CATS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
(__VLS_unwrap(formatMoney, {})(draft.value.price_cc));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
});
(draft.value.price_cc);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.desc),
    rows: "2",
    maxlength: "200",
});
if (draft.value.category === 'material') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(SHOPS, {})));
for (const [n, t] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (t),
        ...{ class: "check small" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (setTag(String(t), $event.target.checked));
                // @ts-ignore
                [draft, draft, draft, draft, formatMoney, SHOPS,];
            } },
        type: "checkbox",
        checked: (draft.value.tags.includes(String(t))),
    });
    (n);
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (draft.value.min_location = $event.target.value);
            // @ts-ignore
            [draft,];
        } },
    value: (draft.value.min_location ?? 'village'),
});
const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(LOCS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [draft, LOCS,];
}
if (draft.value.category === 'equipment') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(CHEST_LAYERS, {})));
for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (l),
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (LAYER.value[l]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (setChest(l, Number($event.target.value)));
                // @ts-ignore
                [draft, CHEST_LAYERS, LAYER,];
            } },
        ...{ class: "num" },
        type: "number",
        min: "0",
        max: "100",
        value: (Math.round((draft.value.chests?.[l] ?? 0) * 100)),
    });
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setGather('wild', $event.target.checked));
            // @ts-ignore
            [];
        } },
    type: "checkbox",
    checked: (draft.value.gather?.includes('wild')),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setGather('dungeon', $event.target.checked));
            // @ts-ignore
            [draft,];
        } },
    type: "checkbox",
    checked: (draft.value.gather?.includes('dungeon')),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.event);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_9 = __VLS_tryAsConstant((drops.value));
for (const [d, i] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (d.enemy),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    const __VLS_10 = __VLS_tryAsConstant((__VLS_unwrap(enemyList, {})));
    for (const [e] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (e.id),
            value: (e.id),
        });
        (e.name);
        (e.level);
        // @ts-ignore
        [draft, draft, drops, enemyList,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (d.chance = Number($event.target.value) / 100);
                // @ts-ignore
                [];
            } },
        ...{ class: "num" },
        type: "number",
        min: "1",
        max: "100",
        value: (Math.round(d.chance * 100)),
    });
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "num" },
        type: "number",
        min: "1",
    });
    (d.qty);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (drops.value.splice(i, 1));
                // @ts-ignore
                [drops,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addDrop) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    (useText.value || '無');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll'))
                    throw 0;
                return (use.value.condition = $event.target.value || undefined);
                // @ts-ignore
                [draft, draft, draft, useText, use,];
            } },
        value: (use.value.condition ?? ''),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_11 = __VLS_tryAsConstant((__VLS_unwrap(conditionList, {})));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (c.id),
            value: (c.id),
        });
        (c.name);
        // @ts-ignore
        [use, conditionList,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "2d4+2",
    });
    (use.value.heal);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "9",
    });
    (use.value.slot);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (use.value.temp_hp);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "10",
    });
    (use.value.ap);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll'))
                    throw 0;
                return (use.value.revive = Number($event.target.value) / 100 || undefined);
                // @ts-ignore
                [use, use, use, use, use,];
            } },
        type: "number",
        min: "0",
        max: "100",
        value: (Math.round((use.value.revive ?? 0) * 100)),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll'))
                    throw 0;
                return (use.value.status = $event.target.value ? { id: $event.target.value, turns: use.value.status?.turns ?? 3 } : undefined);
                // @ts-ignore
                [use, use, use,];
            } },
        value: (use.value.status?.id ?? ''),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_12 = __VLS_tryAsConstant((__VLS_unwrap(buffs, {})));
    for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (s.id),
            value: (s.id),
        });
        (s.name);
        // @ts-ignore
        [use, buffs,];
    }
    if (use.value.status) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "20",
        });
        (use.value.status.turns);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_13 = __VLS_tryAsConstant((__VLS_unwrap(debuffs, {})));
    for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (s.id),
            ...{ class: "check small" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll'))
                        throw 0;
                    return (use.value.cleanse = toggle(use.value.cleanse, s.id, $event.target.checked));
                    // @ts-ignore
                    [use, use, use, use, debuffs,];
                } },
            type: "checkbox",
            checked: (use.value.cleanse?.includes(s.id)),
        });
        (s.name);
        // @ts-ignore
        [use,];
    }
    if (draft.value.category === 'consumable') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (use.value.perks?.length ?? 0);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        const __VLS_14 = __VLS_tryAsConstant((__VLS_unwrap(choosablePerks, {})().filter((x) => !x.flaw)));
        for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (p.id),
                ...{ class: "check" },
                title: (p.desc),
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll'))
                            throw 0;
                        if (!(draft.value.category === 'consumable'))
                            throw 0;
                        return (use.value.perks = toggle(use.value.perks, p.id, $event.target.checked));
                        // @ts-ignore
                        [draft, use, use, use, choosablePerks,];
                    } },
                type: "checkbox",
                checked: (use.value.perks?.includes(p.id)),
                disabled: (!use.value.perks?.includes(p.id) && (use.value.perks?.length ?? 0) >= 6),
            });
            (p.name);
            // @ts-ignore
            [use, use, use,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll'))
                    throw 0;
                return (use.value.damage = $event.target.value ? { dice: $event.target.value, type: use.value.damage?.type ?? 'fire' } : undefined);
                // @ts-ignore
                [use, use,];
            } },
        value: (use.value.damage?.dice ?? ''),
        placeholder: "2d6",
    });
    if (use.value.damage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (use.value.damage.type),
        });
        const __VLS_15 = __VLS_tryAsConstant((__VLS_unwrap(damageIds, {})));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (t),
                value: (t),
            });
            (__VLS_unwrap(damageTypeName, {})(t));
            // @ts-ignore
            [use, use, use, damageIds, damageTypeName,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll'))
                    throw 0;
                return (use.value.apply = $event.target.value ? { status: $event.target.value, turns: use.value.apply?.turns ?? 2, save: use.value.apply?.save, dc: use.value.apply?.dc } : undefined);
                // @ts-ignore
                [use, use, use, use,];
            } },
        value: (use.value.apply?.status ?? ''),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_16 = __VLS_tryAsConstant((__VLS_unwrap(debuffs, {})));
    for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_16))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (s.id),
            value: (s.id),
        });
        (s.name);
        // @ts-ignore
        [use, debuffs,];
    }
    if (use.value.apply) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "20",
        });
        (use.value.apply.turns);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (use.value.apply.save),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (undefined),
        });
        const __VLS_17 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
        for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (a),
                value: (a),
            });
            (__VLS_unwrap(attrName, {})(a));
            // @ts-ignore
            [use, use, use, ATTR_IDS, attrName,];
        }
        if (use.value.apply.save) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                min: "5",
                max: "30",
            });
            (use.value.apply.dc);
        }
    }
    if (use.value.damage || use.value.apply) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'consumable' || draft.value.category === 'food' || draft.value.category === 'scroll'))
                        throw 0;
                    if (!(use.value.damage || use.value.apply))
                        throw 0;
                    return (use.value.save = $event.target.value ? { attr: $event.target.value, dc: use.value.save?.dc ?? 13 } : undefined);
                    // @ts-ignore
                    [use, use, use, use, use, use,];
                } },
            value: (use.value.save?.attr ?? ''),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        const __VLS_18 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
        for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (a),
                value: (a),
            });
            (__VLS_unwrap(attrName, {})(a));
            // @ts-ignore
            [use, ATTR_IDS, attrName,];
        }
    }
    if (use.value.save) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "5",
            max: "30",
        });
        (use.value.save.dc);
    }
    if (use.value.damage || use.value.apply) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (use.value.area),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "one",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "all",
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check small" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (use.value.escape);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check small" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (use.value.combat_only);
}
if (draft.value.category === 'gear') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    (toolText.value || '無：交給 AI 判斷');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'gear'))
                    throw 0;
                return (setTool($event.target.value));
                // @ts-ignore
                [draft, use, use, use, use, use, use, use, toolText,];
            } },
        value: (draft.value.tool?.kind ?? ''),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_19 = __VLS_tryAsConstant((__VLS_unwrap(TOOL_KINDS, {})));
    for (const [k] of __VLS_vFor(__VLS_nonNull(__VLS_19))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (itemRules.value.tools[k].name);
        // @ts-ignore
        [draft, TOOL_KINDS, itemRules,];
    }
    if (draft.value.tool && itemRules.value.tools[draft.value.tool.kind].bonus !== undefined) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: (itemRules.value.tools[draft.value.tool.kind].max ?? 10),
        });
        (draft.value.tool.bonus);
    }
    if (draft.value.tool?.kind === 'craft') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (draft.value.tool.craft),
        });
        const __VLS_20 = __VLS_tryAsConstant((__VLS_unwrap(CRAFT_IDS, {})));
        for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_20))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (c),
                value: (c),
            });
            (craftRules.value.skills[c].name);
            // @ts-ignore
            [draft, draft, draft, draft, draft, draft, itemRules, itemRules, CRAFT_IDS, craftRules,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (draft.value.tool.tier),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (1),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (2),
        });
    }
    if (draft.value.tool?.kind === 'light') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "空白：燒自己（火把）或不會燒（照明石）",
        });
        (draft.value.tool.fuel);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "999",
    });
    (draft.value.burns);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (draft.value.category === 'furniture') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'furniture'))
                    throw 0;
                return (setFurnFunction($event.target.value));
                // @ts-ignore
                [draft, draft, draft, draft, draft,];
            } },
        value: (furn.value.function ?? ''),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "bed",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "workbench",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "garden",
    });
    if (furn.value.function === 'workbench') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (furn.value.craft),
        });
        const __VLS_21 = __VLS_tryAsConstant((__VLS_unwrap(CRAFT_IDS, {})));
        for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_21))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (c),
                value: (c),
            });
            (craftRules.value.skills[c].name);
            // @ts-ignore
            [CRAFT_IDS, craftRules, furn, furn, furn,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "10",
    });
    (furn.value.comfort);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "4",
        placeholder: "🪑",
    });
    (furn.value.icon);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    const __VLS_22 = __VLS_tryAsConstant(['indoor', 'yard', 'basement']);
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_22))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (p),
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'furniture'))
                        throw 0;
                    return (toggleFurnPlace(p));
                    // @ts-ignore
                    [furn, furn,];
                } },
            type: "checkbox",
            checked: (furn.value.places.includes(p)),
        });
        (PLACE_NAME.value[p]);
        // @ts-ignore
        [furn, PLACE_NAME,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (homeRules.value.comfort_rested);
}
if (draft.value.category !== 'equipment') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category !== 'equipment'))
                    throw 0;
                return (toggleRecipe($event.target.checked));
                // @ts-ignore
                [draft, homeRules,];
            } },
        type: "checkbox",
        checked: (!!draft.value.recipe),
    });
    if (draft.value.recipe) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (draft.value.recipe.craft),
        });
        const __VLS_23 = __VLS_tryAsConstant((__VLS_unwrap(CRAFT_IDS, {})));
        for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_23))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (c),
                value: (c),
            });
            (craftRules.value.skills[c].name);
            // @ts-ignore
            [draft, draft, draft, CRAFT_IDS, craftRules,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: (craftRules.value.max_level),
        });
        (draft.value.recipe.level);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "20",
            placeholder: "1",
        });
        (draft.value.recipe.qty);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        (__VLS_unwrap(formatMoney, {})(draft.value.recipe.cost_cc ?? 0));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "0",
            placeholder: "0",
        });
        (draft.value.recipe.cost_cc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "48",
        });
        (draft.value.recipe.hours);
        const __VLS_24 = __VLS_tryAsConstant((draft.value.recipe.inputs));
        for (const [x, i] of __VLS_vFor(__VLS_nonNull(__VLS_24))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (i),
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                list: "recipe-items",
                placeholder: "材料名稱",
            });
            (x.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                min: "1",
                max: "99",
                ...{ class: "qty" },
            });
            (x.qty);
            /** @type {__VLS_StyleScopedClasses['qty']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(draft.value.category !== 'equipment'))
                            throw 0;
                        if (!(draft.value.recipe))
                            throw 0;
                        return (draft.value.recipe.inputs.splice(i, 1));
                        // @ts-ignore
                        [draft, draft, draft, draft, draft, draft, draft, formatMoney, craftRules,];
                    } },
                ...{ class: "small" },
                disabled: (draft.value.recipe.inputs.length <= 1),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            // @ts-ignore
            [draft,];
        }
        if (draft.value.recipe.inputs.length < 6) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(draft.value.category !== 'equipment'))
                            throw 0;
                        if (!(draft.value.recipe))
                            throw 0;
                        if (!(draft.value.recipe.inputs.length < 6))
                            throw 0;
                        return (draft.value.recipe.inputs.push({ name: '', qty: 1 }));
                        // @ts-ignore
                        [draft, draft,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (craftRules.value.skills[draft.value.recipe.craft].name);
        (craftRules.value.recipe.dc[(draft.value.recipe.level || 1) - 1]);
        (craftRules.value.tool_tier_names[craftRules.value.tool_tier[(draft.value.recipe.level || 1) - 1] - 1]);
    }
}
if (draft.value.category === 'material') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'material'))
                    throw 0;
                return (toggleSeed($event.target.checked));
                // @ts-ignore
                [draft, draft, draft, draft, craftRules, craftRules, craftRules, craftRules,];
            } },
        type: "checkbox",
        checked: (!!draft.value.seed),
    });
    if (draft.value.seed) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (draft.value.seed.place),
        });
        const __VLS_25 = __VLS_tryAsConstant(['yard', 'basement', 'indoor']);
        for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_25))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (p),
                value: (p),
            });
            (PLACE_NAME.value[p]);
            // @ts-ignore
            [draft, draft, draft, PLACE_NAME,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "30",
        });
        (draft.value.seed.days);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "20",
        });
        (draft.value.seed.qty[0]);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "20",
        });
        (draft.value.seed.qty[1]);
        const __VLS_26 = __VLS_tryAsConstant((draft.value.seed.yields));
        for (const [_, i] of __VLS_vFor(__VLS_nonNull(__VLS_26))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (i),
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                list: "recipe-items",
                placeholder: "長出的物品",
            });
            (draft.value.seed.yields[i]);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(draft.value.category === 'material'))
                            throw 0;
                        if (!(draft.value.seed))
                            throw 0;
                        return (draft.value.seed.yields.splice(i, 1));
                        // @ts-ignore
                        [draft, draft, draft, draft, draft, draft,];
                    } },
                ...{ class: "small" },
                disabled: (draft.value.seed.yields.length <= 1),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            // @ts-ignore
            [draft,];
        }
        if (draft.value.seed.yields.length < 5) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(draft.value.category === 'material'))
                            throw 0;
                        if (!(draft.value.seed))
                            throw 0;
                        if (!(draft.value.seed.yields.length < 5))
                            throw 0;
                        return (draft.value.seed.yields.push(''));
                        // @ts-ignore
                        [draft, draft,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "recipe-items",
});
const __VLS_27 = __VLS_tryAsConstant((__VLS_unwrap(itemNames, {})));
for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_27))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (n),
        value: (n),
    });
    // @ts-ignore
    [itemNames,];
}
if (draft.value.category === 'info') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    (__VLS_unwrap(intelText, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'info'))
                    throw 0;
                return (setIntelKind($event.target.value));
                // @ts-ignore
                [draft, intelText,];
            } },
        value: (intel.value.kind),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "point",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "story",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "lead",
    });
    if (intel.value.kind === 'point') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'info'))
                        throw 0;
                    if (!(intel.value.kind === 'point'))
                        throw 0;
                    return (intel.value.event = ($event.target.value || undefined));
                    // @ts-ignore
                    [intel, intel, intel,];
                } },
            value: (intel.value.event ?? ''),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "combat",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "chest",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "merchant",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'info'))
                        throw 0;
                    if (!(intel.value.kind === 'point'))
                        throw 0;
                    return (setIntelLocation($event.target.value));
                    // @ts-ignore
                    [intel,];
                } },
            value: (intel.value.location ?? ''),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        const __VLS_28 = __VLS_tryAsConstant((geography.value.locations));
        for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_28))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (l.id),
                value: (l.id),
            });
            (l.name);
            (l.type === 'dungeon' ? '（地下城）' : '');
            // @ts-ignore
            [intel, geography,];
        }
        if (intelIsDungeon.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(draft.value.category === 'info'))
                            throw 0;
                        if (!(intel.value.kind === 'point'))
                            throw 0;
                        if (!(intelIsDungeon.value))
                            throw 0;
                        return (intel.value.layer = ($event.target.value || undefined));
                        // @ts-ignore
                        [intel, intelIsDungeon,];
                    } },
                value: (intel.value.layer ?? ''),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            const __VLS_29 = __VLS_tryAsConstant((__VLS_unwrap(CHEST_LAYERS, {})));
            for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_29))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (l),
                    value: (l),
                });
                (LAYER.value[l]);
                // @ts-ignore
                [CHEST_LAYERS, LAYER, intel,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "30",
            placeholder: "5",
        });
        (intel.value.days);
    }
    else if (intel.value.kind === 'story') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (intel.value.story),
        });
        const __VLS_30 = __VLS_tryAsConstant((__VLS_unwrap(stories, {})));
        for (const [st] of __VLS_vFor(__VLS_nonNull(__VLS_30))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (st.id),
                value: (st.id),
            });
            (st.title);
            // @ts-ignore
            [intel, intel, intel, stories,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (draft.value.category === 'equipment') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    if (draft.value.gear) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'equipment'))
                        throw 0;
                    if (!(draft.value.gear))
                        throw 0;
                    return (setBase($event.target.value));
                    // @ts-ignore
                    [draft, draft,];
                } },
            value: (draft.value.gear.base),
        });
        const __VLS_31 = __VLS_tryAsConstant((__VLS_unwrap(bases, {})));
        for (const [[id, b]] of __VLS_vFor(__VLS_nonNull(__VLS_31))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (id),
                value: (id),
            });
            (b.name);
            // @ts-ignore
            [draft, bases,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (draft.value.gear.material),
        });
        const __VLS_32 = __VLS_tryAsConstant((__VLS_unwrap(materials, {})));
        for (const [[id, m]] of __VLS_vFor(__VLS_nonNull(__VLS_32))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (id),
                value: (id),
            });
            (m.name);
            (__VLS_unwrap(rarityName, {})(m.rarity));
            // @ts-ignore
            [draft, materials, rarityName,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'equipment'))
                        throw 0;
                    if (!(draft.value.gear))
                        throw 0;
                    return (draft.value.gear.rarity = $event.target.value || undefined);
                    // @ts-ignore
                    [draft,];
                } },
            value: (draft.value.gear.rarity ?? ''),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        const __VLS_33 = __VLS_tryAsConstant((__VLS_unwrap(RARITY_ORDER, {})));
        for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_33))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (r),
                value: (r),
            });
            (__VLS_unwrap(rarityName, {})(r));
            // @ts-ignore
            [draft, rarityName, RARITY_ORDER,];
        }
    }
    if (draft.value.gear) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        const __VLS_34 = __VLS_tryAsConstant((__VLS_unwrap(MOD_NAME, {})));
        for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_34))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (k),
            });
            (n);
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(draft.value.category === 'equipment'))
                            throw 0;
                        if (!(draft.value.gear))
                            throw 0;
                        return (setEnchantMod(String(k), Number($event.target.value)));
                        // @ts-ignore
                        [draft, MOD_NAME,];
                    } },
                type: "number",
                value: (enchantMods.value[k] ?? ''),
            });
            // @ts-ignore
            [enchantMods, enchantMods,];
        }
    }
    if (draft.value.gear) {
        const __VLS_35 = AffinityRows;
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
            // @ts-ignore
            ...{ 'onUpdate:modelValue': {} }, modelValue: (draft.value.gear.enchants?.resist), label: "附魔・抗性",
        }));
        const __VLS_37 = __VLS_36({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (draft.value.gear.enchants?.resist),
            label: "附魔・抗性",
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
        let __VLS_40;
        const __VLS_41 = {
            /** @type {typeof __VLS_40.'update:modelValue'} */
            'onUpdate:modelValue': // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'equipment'))
                    throw 0;
                if (!(draft.value.gear))
                    throw 0;
                return (draft.value.gear.enchants = { ...(draft.value.gear.enchants ?? {}), resist: $event });
                // @ts-ignore
                [draft, draft, draft, draft,];
            },
        };
        void __VLS_41;
        var __VLS_38;
        var __VLS_39;
        const __VLS_42 = AffinityRows;
        // @ts-ignore
        const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
            // @ts-ignore
            ...{ 'onUpdate:modelValue': {} }, modelValue: (draft.value.gear.enchants?.offense), label: "附魔・攻擊加成",
        }));
        const __VLS_44 = __VLS_43({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (draft.value.gear.enchants?.offense),
            label: "附魔・攻擊加成",
        }, ...__VLS_functionalComponentArgsRest(__VLS_43));
        let __VLS_47;
        const __VLS_48 = {
            /** @type {typeof __VLS_47.'update:modelValue'} */
            'onUpdate:modelValue': // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.category === 'equipment'))
                    throw 0;
                if (!(draft.value.gear))
                    throw 0;
                return (draft.value.gear.enchants = { ...(draft.value.gear.enchants ?? {}), offense: $event });
                // @ts-ignore
                [draft, draft, draft,];
            },
        };
        void __VLS_48;
        var __VLS_45;
        var __VLS_46;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "summary small" },
    });
    /** @type {__VLS_StyleScopedClasses['summary']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(gearText, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (priceFromGear) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    if (draft.value.gear) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "check small" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'equipment'))
                        throw 0;
                    if (!(draft.value.gear))
                        throw 0;
                    return (setUnique($event.target.checked));
                    // @ts-ignore
                    [draft, gearText,];
                } },
            type: "checkbox",
            checked: (!!draft.value.gear.unique),
        });
        if (draft.value.gear.unique) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "unique small" },
            });
            /** @type {__VLS_StyleScopedClasses['unique']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                min: "1",
                max: "3",
                ...{ class: "num" },
            });
            (draft.value.gear.unique.bonus);
            /** @type {__VLS_StyleScopedClasses['num']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
            (draft.value.gear.unique.check.attrs?.length ?? 0);
            const __VLS_49 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
            for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_49))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    key: (a),
                    ...{ class: "check" },
                });
                /** @type {__VLS_StyleScopedClasses['check']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onChange: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(draft.value.category === 'equipment'))
                                throw 0;
                            if (!(draft.value.gear))
                                throw 0;
                            if (!(draft.value.gear.unique))
                                throw 0;
                            return (toggleUniqueFilter('attrs', a, $event.target.checked));
                            // @ts-ignore
                            [draft, draft, draft, draft, ATTR_IDS,];
                        } },
                    type: "checkbox",
                    checked: (draft.value.gear.unique.check.attrs?.includes(a)),
                });
                (__VLS_unwrap(attrName, {})(a));
                // @ts-ignore
                [draft, attrName,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
            (draft.value.gear.unique.check.contexts?.length ?? 0);
            const __VLS_50 = __VLS_tryAsConstant((__VLS_unwrap(uniqueContexts, {})));
            for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_50))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    key: (k),
                    ...{ class: "check" },
                });
                /** @type {__VLS_StyleScopedClasses['check']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onChange: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(draft.value.category === 'equipment'))
                                throw 0;
                            if (!(draft.value.gear))
                                throw 0;
                            if (!(draft.value.gear.unique))
                                throw 0;
                            return (toggleUniqueFilter('contexts', k, $event.target.checked));
                            // @ts-ignore
                            [draft, uniqueContexts,];
                        } },
                    type: "checkbox",
                    checked: (draft.value.gear.unique.check.contexts?.includes(k)),
                });
                (n);
                // @ts-ignore
                [draft,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
            (draft.value.gear.unique.check.kinds?.length ?? 0);
            const __VLS_51 = __VLS_tryAsConstant((__VLS_unwrap(uniqueKinds, {})));
            for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_51))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    key: (k),
                    ...{ class: "check" },
                });
                /** @type {__VLS_StyleScopedClasses['check']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onChange: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(draft.value.category === 'equipment'))
                                throw 0;
                            if (!(draft.value.gear))
                                throw 0;
                            if (!(draft.value.gear.unique))
                                throw 0;
                            return (toggleUniqueFilter('kinds', k, $event.target.checked));
                            // @ts-ignore
                            [draft, uniqueKinds,];
                        } },
                    type: "checkbox",
                    checked: (draft.value.gear.unique.check.kinds?.includes(k)),
                });
                (n);
                // @ts-ignore
                [draft,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
            (draft.value.gear.unique.check.vs_tags?.length ?? 0);
            const __VLS_52 = __VLS_tryAsConstant((__VLS_unwrap(uniqueTags, {})));
            for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_52))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    key: (k),
                    ...{ class: "check" },
                });
                /** @type {__VLS_StyleScopedClasses['check']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onChange: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(draft.value.category === 'equipment'))
                                throw 0;
                            if (!(draft.value.gear))
                                throw 0;
                            if (!(draft.value.gear.unique))
                                throw 0;
                            return (toggleUniqueFilter('vs_tags', k, $event.target.checked));
                            // @ts-ignore
                            [draft, uniqueTags,];
                        } },
                    type: "checkbox",
                    checked: (draft.value.gear.unique.check.vs_tags?.includes(k)),
                });
                (n);
                // @ts-ignore
                [draft,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row small" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_unwrap(attrMax, {}));
        (gearRules.value.attrs.cap);
        const __VLS_53 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
        for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_53))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (a),
            });
            (__VLS_unwrap(attrName, {})(a));
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onInput: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(draft.value.category === 'equipment'))
                            throw 0;
                        if (!(draft.value.gear))
                            throw 0;
                        return (setGearAttr(a, Number($event.target.value)));
                        // @ts-ignore
                        [ATTR_IDS, attrName, attrMax, gearRules,];
                    } },
                type: "number",
                ...{ class: "num" },
                min: (-__VLS_unwrap(attrMax, {})),
                max: (__VLS_unwrap(attrMax, {})),
                value: (draft.value.gear.attrs?.[a] ?? 0),
            });
            /** @type {__VLS_StyleScopedClasses['num']} */ ;
            // @ts-ignore
            [draft, attrMax, attrMax,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "check small" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'equipment'))
                        throw 0;
                    if (!(draft.value.gear))
                        throw 0;
                    return (setMasterForce($event.target.checked));
                    // @ts-ignore
                    [];
                } },
            type: "checkbox",
            checked: (!!draft.value.master_force),
        });
        if (draft.value.master_force) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row small" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            const __VLS_54 = __VLS_tryAsConstant((__VLS_unwrap(masterTags, {})));
            for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_54))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    key: (t),
                    ...{ class: "check" },
                });
                /** @type {__VLS_StyleScopedClasses['check']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onChange: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(draft.value.category === 'equipment'))
                                throw 0;
                            if (!(draft.value.gear))
                                throw 0;
                            if (!(draft.value.master_force))
                                throw 0;
                            return (toggleMasterTag(t, $event.target.checked));
                            // @ts-ignore
                            [draft, draft, masterTags,];
                        } },
                    type: "checkbox",
                    checked: (draft.value.master_force.tags?.includes(t)),
                });
                (__VLS_unwrap(tagDef, {})(t)?.name ?? t);
                // @ts-ignore
                [draft, tagDef,];
            }
        }
        if (draft.value.gear.attrs || draft.value.master_force) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
    }
}
if (draft.value.category === 'material') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    const __VLS_55 = __VLS_tryAsConstant((gearRules.value.materials));
    for (const [m, id] of __VLS_vFor(__VLS_nonNull(__VLS_55))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (id),
            ...{ class: "check small" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.category === 'material'))
                        throw 0;
                    return (setForge(String(id), $event.target.checked));
                    // @ts-ignore
                    [draft, draft, draft, gearRules,];
                } },
            type: "checkbox",
            checked: (draft.value.forge?.materials.includes(String(id))),
        });
        (m.name);
        (m.tier);
        // @ts-ignore
        [draft,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
