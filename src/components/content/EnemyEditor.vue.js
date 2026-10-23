import { computed, ref, watch } from 'vue';
import { abilities, ATTR_IDS, attrName, damageTypeName, damageTypes, enemies, itemRules, monsterTraits } from '@/engine/data';
import { builtinEnemy, builtinPlacementsOf, ENEMY_KINDS, formatDice, parseDice, placementsOf, tableOptions, } from '@/engine/mods';
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
    return clone(content.mods.enemies[props.id] ?? enemies[props.id]);
}
const draft = ref(current());
const saved = ref(JSON.stringify(draft.value));
watch(() => props.id, () => {
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
});
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
const builtin = computed(() => !!builtinEnemy(props.id));
const edited = computed(() => builtin.value && !!content.mods.enemies[props.id]);
// ---- 選項 ----
const damageIds = damageTypes.types.map((t) => t.id);
const monsterAbilities = computed(() => Object.values(abilities).filter((a) => a.classes.includes('monster')));
const otherAbilities = computed(() => Object.values(abilities).filter((a) => !a.classes.includes('monster') && a.type !== 'spell'));
const itemNames = computed(() => {
    void content.version;
    return itemRules.items.map((i) => i.name);
});
const tables = tableOptions();
const builtinPlaces = computed(() => builtinPlacementsOf(props.id));
const nowPlaces = computed(() => {
    void content.version;
    return placementsOf(props.id);
});
const pickAbility = ref('');
function addAbility() {
    if (!pickAbility.value)
        return;
    const list = (draft.value.abilities ??= []);
    if (!list.includes(pickAbility.value))
        list.push(pickAbility.value);
    pickAbility.value = '';
}
function removeAbility(id) {
    draft.value.abilities = (draft.value.abilities ?? []).filter((a) => a !== id);
    setGate(id, '');
}
/** 生命低於 X% 才能用：空白 = 隨時能用 */
function setGate(id, v) {
    const gates = { ...(draft.value.ability_hp_below ?? {}) };
    const n = Math.round(Number(v));
    if (v !== '' && Number.isFinite(n))
        gates[id] = Math.max(1, Math.min(99, n));
    else
        delete gates[id];
    if (Object.keys(gates).length)
        draft.value.ability_hp_below = gates;
    else
        delete draft.value.ability_hp_below;
}
function addLoot() {
    ;
    (draft.value.loot ??= []).push({ item: '', chance: 0.5 });
}
function percent(v) {
    return Math.round((v ?? 0) * 100);
}
function toggleExclude(key, on) {
    const set = new Set(draft.value.exclude ?? []);
    if (on)
        set.add(key);
    else
        set.delete(key);
    draft.value.exclude = [...set];
}
function addSpawn() {
    ;
    (draft.value.spawns ??= []).push({ table: tables[0].key, count: 1 });
}
const money = computed({
    get: () => draft.value.money_cc ?? [0, 0],
    set: (v) => { draft.value.money_cc = v; },
});
function toggleTrait(t, on) {
    const set = new Set(draft.value.traits ?? []);
    if (on)
        set.add(t);
    else
        set.delete(t);
    draft.value.traits = [...set];
}
// 攻擊骰：只能是 {x}d{y}+{z}
const dice = computed(() => parseDice(draft.value.weapon.dice));
function setDice(k, e) {
    draft.value.weapon.dice = formatDice({ ...dice.value, [k]: Number(e.target.value) });
}
// ---- 動作 ----
function save() {
    try {
        content.saveEnemy(props.id, draft.value);
        draft.value = current();
        saved.value = JSON.stringify(draft.value);
        game.flash(`已儲存「${draft.value.name}」`);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function discard() {
    draft.value = current();
}
function restore() {
    if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`))
        return;
    content.restoreEnemy(props.id);
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
}
// 還有地方用到時不能刪（見 docs/CONTENT_DEPENDENCIES.md）
const usage = computed(() => {
    void content.version;
    void game.state?.time.minute;
    return content.usageOf('enemy', props.id);
});
function remove() {
    if (!confirm(`刪除「${draft.value.name}」？已經在地圖上的這種怪物會消失。`))
        return;
    try {
        content.deleteEnemy(props.id);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
        return;
    }
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
__VLS_withDotValue(draft, {});
// @ts-ignore
__VLS_withDotValue(builtin, {});
// @ts-ignore
__VLS_withDotValue(edited, {});
// @ts-ignore
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
// @ts-ignore
__VLS_withDotValue(money, {});
// @ts-ignore
__VLS_withDotValue(dice, {});
// @ts-ignore
__VLS_withDotValue(abilities, {});
// @ts-ignore
__VLS_withDotValue(pickAbility, {});
// @ts-ignore
__VLS_withDotValue(monsterTraits, {});
// @ts-ignore
__VLS_withDotValue(itemNames, {});
// @ts-ignore
__VLS_withDotValue(nowPlaces, {});
// @ts-ignore
__VLS_withDotValue(builtinPlaces, {});
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
(draft.value.name || '（未命名）');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag" },
});
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
(builtin.value ? (edited.value ? '內建・已修改' : '內建') : '自建');
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
    ...{ onClick: (discard) },
    ...{ class: "small" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (builtin.value) {
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
    usage: (usage.value), deletable: (!builtin.value),
}));
const __VLS_2 = __VLS_1({
    usage: (usage.value),
    deletable: (!builtin.value),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_ctx.id);
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "20",
});
(draft.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
    max: "30",
});
(draft.value.level);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.kind),
});
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(ENEMY_KINDS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [draft, draft, draft, draft, builtin, builtin, builtin, edited, edited, dirty, dirty, dirty, usage, usage, usage, id, ENEMY_KINDS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
});
(draft.value.hp);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
    max: "12",
});
(draft.value.ap);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
});
(draft.value.evade);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
});
(draft.value.dr);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
});
(draft.value.xp);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pair" },
});
/** @type {__VLS_StyleScopedClasses['pair']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
});
(money.value[0]);
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
});
(money.value[1]);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.armed);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.rut);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.desc),
    rows: "2",
    maxlength: "200",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (a),
    });
    (__VLS_unwrap(attrName, {})(a));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "30",
    });
    (draft.value.attrs[a]);
    // @ts-ignore
    [draft, draft, draft, draft, draft, draft, draft, draft, draft, money, money, ATTR_IDS, attrName,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "dice-field" },
});
/** @type {__VLS_StyleScopedClasses['dice-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pair dice" },
});
/** @type {__VLS_StyleScopedClasses['pair']} */ ;
/** @type {__VLS_StyleScopedClasses['dice']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setDice('count', $event));
            // @ts-ignore
            [];
        } },
    type: "number",
    min: "1",
    max: "20",
    value: (dice.value.count),
    title: "骰子數量 x",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setDice('sides', $event));
            // @ts-ignore
            [dice,];
        } },
    type: "number",
    min: "2",
    max: "100",
    value: (dice.value.sides),
    title: "骰子面數 y",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setDice('bonus', $event));
            // @ts-ignore
            [dice,];
        } },
    type: "number",
    min: "0",
    max: "99",
    value: (dice.value.bonus),
    title: "固定加值 z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.weapon.type),
});
const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(damageIds, {})));
for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (t),
        value: (t),
    });
    (__VLS_unwrap(damageTypeName, {})(t));
    // @ts-ignore
    [draft, dice, damageIds, damageTypeName,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.weapon.attr),
});
const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (a),
        value: a,
    });
    (__VLS_unwrap(attrName, {})(a));
    // @ts-ignore
    [draft, ATTR_IDS, attrName,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
const __VLS_9 = AffinityRows;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent1(__VLS_9, new __VLS_9({
    // @ts-ignore
    modelValue: (draft.value.resist), label: "抗性",
}));
const __VLS_11 = __VLS_10({
    modelValue: (draft.value.resist),
    label: "抗性",
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
const __VLS_14 = AffinityRows;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    // @ts-ignore
    modelValue: (draft.value.offense), label: "攻擊加成",
}));
const __VLS_16 = __VLS_15({
    modelValue: (draft.value.offense),
    label: "攻擊加成",
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chips" },
});
/** @type {__VLS_StyleScopedClasses['chips']} */ ;
const __VLS_19 = __VLS_tryAsConstant((draft.value.abilities ?? []));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_19))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (a),
        ...{ class: "tag chip" },
        title: (abilities.value[a]?.desc),
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['chip']} */ ;
    (abilities.value[a]?.name ?? a);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "small gate" },
        title: "生命降到這個百分比以下才能用；空白是隨時能用",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['gate']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (setGate(a, $event.target.value));
                // @ts-ignore
                [draft, draft, draft, abilities, abilities,];
            } },
        type: "number",
        min: "1",
        max: "99",
        placeholder: "—",
        value: (draft.value.ability_hp_below?.[a] ?? ''),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (removeAbility(a));
                // @ts-ignore
                [draft,];
            } },
        ...{ class: "x" },
    });
    /** @type {__VLS_StyleScopedClasses['x']} */ ;
    // @ts-ignore
    [];
}
if (!draft.value.abilities?.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (pickAbility.value),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
    label: "怪物技能",
});
const __VLS_20 = __VLS_tryAsConstant((__VLS_unwrap(monsterAbilities, {})));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_20))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (a.id),
        value: (a.id),
    });
    (a.name);
    (a.desc.slice(0, 40));
    // @ts-ignore
    [draft, pickAbility, monsterAbilities,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
    label: "職業技能與戲法",
});
const __VLS_21 = __VLS_tryAsConstant((__VLS_unwrap(otherAbilities, {})));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_21))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (a.id),
        value: (a.id),
    });
    (a.name);
    (a.desc.slice(0, 40));
    // @ts-ignore
    [otherAbilities,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addAbility) },
    ...{ class: "small" },
    disabled: (!pickAbility.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_22 = __VLS_tryAsConstant((monsterTraits.value.traits));
for (const [t, id] of __VLS_vFor(__VLS_nonNull(__VLS_22))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (id),
        ...{ class: "check small" },
        title: (t.desc),
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (toggleTrait(String(id), $event.target.checked));
                // @ts-ignore
                [pickAbility, monsterTraits,];
            } },
        type: "checkbox",
        checked: (draft.value.traits?.includes(String(id))),
    });
    (t.name);
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "item-names",
});
const __VLS_23 = __VLS_tryAsConstant((itemNames.value));
for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_23))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (n),
        value: (n),
    });
    // @ts-ignore
    [itemNames,];
}
const __VLS_24 = __VLS_tryAsConstant((draft.value.loot ?? []));
for (const [l, i] of __VLS_vFor(__VLS_nonNull(__VLS_24))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        list: "item-names",
        placeholder: "物品名稱",
        ...{ class: "grow" },
    });
    (l.item);
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (l.chance = Number($event.target.value) / 100);
                // @ts-ignore
                [draft,];
            } },
        ...{ class: "num" },
        type: "number",
        min: "1",
        max: "100",
        value: (percent(l.chance)),
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
        placeholder: "1",
    });
    (l.qty);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.loot.splice(i, 1));
                // @ts-ignore
                [draft,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (l.item && !itemNames.value.includes(l.item)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small warn-text" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    }
    // @ts-ignore
    [itemNames,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addLoot) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(nowPlaces.value.map((p) => `${p.label}${p.groups > 1 ? `（${p.groups} 組）` : ''}`).join('、') || '（沒有，不會遇到）');
if (builtinPlaces.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    const __VLS_25 = __VLS_tryAsConstant((builtinPlaces.value));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_25))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (p.key),
            ...{ class: "check small" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(builtinPlaces.value.length))
                        throw 0;
                    return (toggleExclude(p.key, $event.target.checked));
                    // @ts-ignore
                    [nowPlaces, builtinPlaces, builtinPlaces,];
                } },
            type: "checkbox",
            checked: (draft.value.exclude?.includes(p.key)),
        });
        (p.label);
        // @ts-ignore
        [draft,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
const __VLS_26 = __VLS_tryAsConstant((draft.value.spawns ?? []));
for (const [s, i] of __VLS_vFor(__VLS_nonNull(__VLS_26))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (s.table),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    const __VLS_27 = __VLS_tryAsConstant((__VLS_unwrap(tables, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_27))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (t.key),
            value: (t.key),
        });
        (t.label);
        // @ts-ignore
        [draft, tables,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "num" },
        type: "number",
        min: "1",
        max: "6",
    });
    (s.count);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    if (!s.table.startsWith('boss:')) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "num" },
            type: "number",
            min: "1",
            max: "5",
            placeholder: "1",
        });
        (s.weight);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.spawns.splice(i, 1));
                // @ts-ignore
                [draft,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addSpawn) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
