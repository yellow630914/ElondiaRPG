import { computed, ref, watch } from 'vue';
import { ATTR_IDS, attrName, itemRules, locationById, npcs as namedNpcs, npcTags, perkRules, shopRules, workRules } from '@/engine/data';
import { settlementArea } from '@/engine/grid';
import { builtinPerk, TRAIN_CELLS } from '@/engine/mods';
import { formatMoney } from '@/engine/money';
import { builtinCells, buyCategories, canListItem, catalogOptions, CRAFT_KINDS, SHOP_LIMITS, shopUsage, } from '@/engine/shopMods';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import CellPicker from './CellPicker.vue';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const game = useGame();
const def = computed(() => {
    void content.version;
    return shopRules.types[props.id];
});
const custom = computed(() => !!def.value.custom);
const trainable = computed(() => custom.value || TRAIN_CELLS.includes(def.value.cell));
// 可以在這裡受訓的特質：目前或內建有受訓設定的（種族天賦除外）
const trainPerks = computed(() => {
    void content.version;
    return perkRules.perks.filter((p) => !p.race && (p.train ?? builtinPerk(p.id)?.train));
});
function current() {
    void content.version;
    const d = shopRules.types[props.id];
    const job = workRules.jobs[d.cell];
    const mod = content.mods.shops?.[props.id];
    const moved = mod?.moves ?? [];
    return {
        name: d.name, emoji: d.emoji, desc: d.desc, ai: d.ai, title: d.keeper.title, tags: [...(d.keeper.tags ?? [])],
        catalog: d.catalog_tag, craft: [...(d.craft ?? [])],
        fixed: (d.fixed ?? []).map((f) => ({ item: f.item, stock: f.stock, price: f.price_cc ?? '' })),
        buys: [...d.buys],
        work: job ? { attr: job.attr, dc: job.dc, rate_cc: job.rate_cc, desc: job.desc } : null,
        train: perkRules.perks.filter((p) => !p.race && p.train?.cells.includes(d.cell)).map((p) => p.id),
        moves: d.custom ? [] : builtinCells(props.id).map((from) => {
            const m = moved.find((x) => x.from.area === from.area && x.from.x === from.x && x.from.y === from.y);
            return { from, to: m ? { ...m.to } : null };
        }),
        places: d.custom ? (mod?.places ?? []).map((p) => ({ ...p })) : [],
    };
}
const draft = ref(current());
const saved = ref(JSON.stringify(draft.value));
function reset() {
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
    openMove.value = null;
    adding.value = null;
}
watch(() => props.id, reset);
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
const edited = computed(() => !custom.value && !!content.mods.shops?.[props.id]);
const usage = computed(() => {
    void content.version;
    return custom.value ? shopUsage(props.id) : [];
});
// 擔任這種店店主的固定 NPC（在固定 NPC 頁設定）
const keepers = computed(() => {
    void content.version;
    return namedNpcs.filter((n) => n.keeper === props.id).map((n) => `${n.name}（${locationById(n.location).name}）`);
});
const tagList = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name]);
const categories = buyCategories();
const catalogs = catalogOptions();
const catalogName = computed(() => catalogs.find(([t]) => t === def.value.catalog_tag)?.[1] ?? def.value.catalog_tag);
const itemNames = computed(() => {
    void content.version;
    return itemRules.items.filter((i) => canListItem(i.name)).map((i) => i.name);
});
const badItems = computed(() => draft.value.fixed.filter((f) => f.item.trim() && !canListItem(f.item.trim())).map((f) => f.item));
function toggle(list, v, on) {
    const set = new Set(list);
    if (on)
        set.add(v);
    else
        set.delete(v);
    return [...set];
}
function addFixed() {
    draft.value.fixed.push({ item: '', stock: 3, price: '' });
}
function catalogPrice(name) {
    const p = itemRules.items.find((i) => i.name === name.trim())?.price_cc;
    return p === undefined ? '' : formatMoney(p);
}
function placeText(r) {
    return `${locationById(r.area.split('/')[0]).name}・${settlementArea(r.area, false)?.name ?? r.area}（${r.x}, ${r.y}）`;
}
// 位置：內建的店一次移動一格；自建的店另外加一格
const openMove = ref(null);
const adding = ref(null);
const addOpen = ref(false);
function moveTo(i, to) {
    draft.value.moves[i].to = to;
    openMove.value = null;
}
function addPlace(r) {
    if (r && !draft.value.places.some((p) => p.area === r.area && p.x === r.x && p.y === r.y))
        draft.value.places.push(r);
    addOpen.value = false;
}
function toggleWork(on) {
    draft.value.work = on ? { attr: 'cha', dc: 12, rate_cc: 3, desc: '在店裡幫忙。' } : null;
}
function save() {
    try {
        if (badItems.value.length)
            throw new Error(`固定清單裡有不能賣的物品：${badItems.value.join('、')}`);
        const d = draft.value;
        const m = {
            emoji: d.emoji, desc: d.desc, ai: d.ai, keeper: { title: d.title, tags: d.tags },
            fixed: d.fixed.filter((f) => f.item.trim()).map((f) => ({ item: f.item.trim(), stock: f.stock, ...(f.price !== '' ? { price_cc: Number(f.price) } : {}) })),
            buys: d.buys,
            ...(d.work ? { work: { ...d.work } } : {}),
            ...(custom.value
                ? { custom: true, name: d.name, catalog: d.catalog, craft: d.craft, places: d.places }
                : { moves: d.moves.filter((x) => x.to).map((x) => ({ from: x.from, to: x.to })) }),
        };
        const before = JSON.parse(saved.value);
        content.saveShop(props.id, m);
        if (trainable.value && JSON.stringify([...d.train].sort()) !== JSON.stringify([...before.train].sort()))
            content.setShopTraining(def.value.cell, d.train);
        reset();
        game.flash(`已儲存「${def.value.name}」`);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function restore() {
    if (!confirm(`把「${def.value.name}」恢復成內建的樣子？（位置回到原處；受訓清單存在各特質上，不會一起恢復）`))
        return;
    content.restoreShop(props.id);
    reset();
}
function remove() {
    if (!confirm(`刪除自建的商店「${def.value.name}」？地圖上的格子會變回道路。`))
        return;
    try {
        content.deleteShop(props.id);
        emit('deleted');
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
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
__VLS_withDotValue(draft, {});
// @ts-ignore
__VLS_withDotValue(custom, {});
// @ts-ignore
__VLS_withDotValue(def, {});
// @ts-ignore
__VLS_withDotValue(edited, {});
// @ts-ignore
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
// @ts-ignore
__VLS_withDotValue(SHOP_LIMITS, {});
// @ts-ignore
__VLS_withDotValue(keepers, {});
// @ts-ignore
__VLS_withDotValue(trainable, {});
// @ts-ignore
__VLS_withDotValue(openMove, {});
// @ts-ignore
__VLS_withDotValue(addOpen, {});
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
(draft.value.emoji);
(custom.value ? draft.value.name : def.value.name);
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
        ...{ class: "small warn" },
        disabled: (usage.value.length > 0),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
}
if (!custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_ctx.id);
    (__VLS_unwrap(catalogName, {}));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_ctx.id);
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
if (custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: (SHOP_LIMITS.value.name_chars),
    });
    (draft.value.name);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "8",
});
(draft.value.emoji);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.desc),
    rows: "2",
    maxlength: (SHOP_LIMITS.value.desc_chars),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.ai);
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "8",
});
(draft.value.title);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(tagList, {})));
for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (k),
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.tags = toggle(draft.value.tags, k, $event.target.checked));
                // @ts-ignore
                [draft, draft, draft, draft, draft, draft, draft, draft, draft, custom, custom, custom, custom, custom, custom, def, edited, edited, dirty, dirty, dirty, usage, usage, id, id, catalogName, SHOP_LIMITS, SHOP_LIMITS, tagList,];
            } },
        type: "checkbox",
        checked: (draft.value.tags.includes(k)),
    });
    (n);
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (keepers.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (keepers.value.join('、'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
if (custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.catalog),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(catalogs, {})));
    for (const [[t, n]] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (t),
            value: (t),
        });
        (n);
        // @ts-ignore
        [draft, custom, keepers, keepers, catalogs,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (!custom.value) {
    (__VLS_unwrap(catalogName, {}));
}
const __VLS_7 = __VLS_tryAsConstant((draft.value.fixed));
for (const [f, i] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "grow" },
        list: "shop-items",
        placeholder: "物品名稱",
    });
    (f.item);
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check small" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "qty" },
        type: "number",
        min: (SHOP_LIMITS.value.stock[0]),
        max: (SHOP_LIMITS.value.stock[1]),
    });
    (f.stock);
    /** @type {__VLS_StyleScopedClasses['qty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check small" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "num" },
        type: "number",
        min: (SHOP_LIMITS.value.price[0]),
        placeholder: (catalogPrice(f.item) || '目錄價'),
    });
    (f.price);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    if (f.item.trim() && !__VLS_unwrap(canListItem, {})(f.item.trim())) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small warn-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.fixed.splice(i, 1));
                // @ts-ignore
                [draft, draft, custom, catalogName, SHOP_LIMITS, SHOP_LIMITS, SHOP_LIMITS, canListItem,];
            } },
        ...{ class: "small x" },
        title: "移除",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['x']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addFixed) },
    ...{ class: "small" },
    disabled: (draft.value.fixed.length >= SHOP_LIMITS.value.fixed),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(SHOP_LIMITS.value.fixed);
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "shop-items",
});
const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(itemNames, {})));
for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (n),
        value: (n),
    });
    // @ts-ignore
    [draft, SHOP_LIMITS, SHOP_LIMITS, itemNames,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
const __VLS_9 = __VLS_tryAsConstant((__VLS_unwrap(categories, {})));
for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (k),
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.buys = toggle(draft.value.buys, k, $event.target.checked));
                // @ts-ignore
                [draft, draft, categories,];
            } },
        type: "checkbox",
        checked: (draft.value.buys.includes(k)),
    });
    (n);
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
if (custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check small" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(custom.value))
                    throw 0;
                return (toggleWork($event.target.checked));
                // @ts-ignore
                [custom,];
            } },
        type: "checkbox",
        checked: (!!draft.value.work),
    });
}
if (draft.value.work) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    if (custom.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (draft.value.work.attr),
        });
        const __VLS_10 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
        for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (a),
                value: (a),
            });
            (__VLS_unwrap(attrName, {})(a));
            // @ts-ignore
            [draft, draft, draft, custom, ATTR_IDS, attrName,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_unwrap(attrName, {})(draft.value.work.attr)),
            disabled: true,
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: (SHOP_LIMITS.value.work_dc[0]),
        max: (SHOP_LIMITS.value.work_dc[1]),
    });
    (draft.value.work.dc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: (SHOP_LIMITS.value.rate_cc[0]),
        max: (SHOP_LIMITS.value.rate_cc[1]),
    });
    (draft.value.work.rate_cc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "block" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (draft.value.work.desc),
        rows: "2",
        maxlength: (SHOP_LIMITS.value.desc_chars),
    });
}
else if (!custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
if (trainable.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (custom.value ? '' : '：恢復這家店的預設不會改回受訓清單');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_11 = __VLS_tryAsConstant((__VLS_unwrap(trainPerks, {})));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
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
                    if (!(trainable.value))
                        throw 0;
                    return (draft.value.train = toggle(draft.value.train, p.id, $event.target.checked));
                    // @ts-ignore
                    [draft, draft, draft, draft, draft, draft, custom, custom, SHOP_LIMITS, SHOP_LIMITS, SHOP_LIMITS, SHOP_LIMITS, SHOP_LIMITS, attrName, trainable, trainPerks,];
                } },
            type: "checkbox",
            checked: (draft.value.train.includes(p.id)),
        });
        (p.flaw ? '⚠️' : '');
        (p.name);
        // @ts-ignore
        [draft,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    const __VLS_12 = __VLS_tryAsConstant((__VLS_unwrap(CRAFT_KINDS, {})));
    for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (k),
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(custom.value))
                        throw 0;
                    return (draft.value.craft = toggle(draft.value.craft, k, $event.target.checked));
                    // @ts-ignore
                    [draft, draft, custom, CRAFT_KINDS,];
                } },
            type: "checkbox",
            checked: (draft.value.craft.includes(k)),
        });
        (n);
        // @ts-ignore
        [draft,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
if (!custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    if (!draft.value.moves.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    const __VLS_13 = __VLS_tryAsConstant((draft.value.moves));
    for (const [m, i] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "move" },
        });
        /** @type {__VLS_StyleScopedClasses['move']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row small" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (placeText(m.from));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (m.to ? placeText(m.to) : '原地');
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(!custom.value))
                        throw 0;
                    return (openMove.value = openMove.value === i ? null : i);
                    // @ts-ignore
                    [draft, draft, custom, openMove, openMove,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (openMove.value === i ? '收起' : '移動');
        if (m.to) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(!custom.value))
                            throw 0;
                        if (!(m.to))
                            throw 0;
                        return (moveTo(i, null));
                        // @ts-ignore
                        [openMove,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        if (openMove.value === i) {
            const __VLS_14 = CellPicker;
            // @ts-ignore
            const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
                // @ts-ignore
                ...{ 'onUpdate:modelValue': {} }, modelValue: (m.to), location: (m.from.area.split('/')[0]), lockLocation: true, marker: (draft.value.emoji), self: (def.value.cell),
            }));
            const __VLS_16 = __VLS_15({
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (m.to),
                location: (m.from.area.split('/')[0]),
                lockLocation: true,
                marker: (draft.value.emoji),
                self: (def.value.cell),
            }, ...__VLS_functionalComponentArgsRest(__VLS_15));
            let __VLS_19;
            const __VLS_20 = {
                /** @type {typeof __VLS_19.'update:modelValue'} */
                'onUpdate:modelValue': // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(!custom.value))
                        throw 0;
                    if (!(openMove.value === i))
                        throw 0;
                    return (moveTo(i, $event));
                    // @ts-ignore
                    [draft, def, openMove,];
                },
            };
            void __VLS_20;
            var __VLS_17;
            var __VLS_18;
        }
        // @ts-ignore
        [];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (SHOP_LIMITS.value.places);
    if (!draft.value.places.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small warn-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    }
    const __VLS_21 = __VLS_tryAsConstant((draft.value.places));
    for (const [p, i] of __VLS_vFor(__VLS_nonNull(__VLS_21))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`${p.area}-${p.x}-${p.y}`),
            ...{ class: "row small" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (placeText(p));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(!custom.value))
                        throw 0;
                    return (draft.value.places.splice(i, 1));
                    // @ts-ignore
                    [draft, draft, draft, SHOP_LIMITS,];
                } },
            ...{ class: "small x" },
            title: "移除",
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['x']} */ ;
        // @ts-ignore
        [];
    }
    if (!addOpen.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(!custom.value))
                        throw 0;
                    if (!(!addOpen.value))
                        throw 0;
                    return (addOpen.value = true);
                    // @ts-ignore
                    [addOpen, addOpen,];
                } },
            ...{ class: "small" },
            disabled: (draft.value.places.length >= SHOP_LIMITS.value.places),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    else {
        const __VLS_22 = CellPicker;
        // @ts-ignore
        const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
            // @ts-ignore
            ...{ 'onUpdate:modelValue': {} }, modelValue: (__VLS_unwrap(adding, {})), marker: (draft.value.emoji), self: (__VLS_ctx.id),
        }));
        const __VLS_24 = __VLS_23({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (__VLS_unwrap(adding, {})),
            marker: (draft.value.emoji),
            self: (__VLS_ctx.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_23));
        let __VLS_27;
        const __VLS_28 = {
            /** @type {typeof __VLS_27.'update:modelValue'} */
            'onUpdate:modelValue': (addPlace),
        };
        void __VLS_28;
        var __VLS_25;
        var __VLS_26;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(!custom.value))
                        throw 0;
                    if (!!(!addOpen.value))
                        throw 0;
                    return (addOpen.value = false);
                    // @ts-ignore
                    [draft, draft, id, SHOP_LIMITS, addOpen, adding,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
