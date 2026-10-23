import { choosablePerks, KEEPER_SHOPS, perkDef, shopRules } from '@/engine/data';
import { npcPerksOf } from '@/engine/perks';
import { computed, ref, watch } from 'vue';
import { createNpc } from '@/engine/character';
import { abilities as abilityTable, ATTR_IDS, attrName, attributeRules, classAbilities, className, combatClasses, GENDER_IDS, genderName, geography, locationById, npcs as namedNpcs, npcTags, raceName, } from '@/engine/data';
import { baseFits, gearName, gearRules, rarityName, RARITY_ORDER, slotName } from '@/engine/gear';
import { builtinNpc } from '@/engine/mods';
import { Rng } from '@/engine/rng';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import FlagInput from './FlagInput.vue';
import NpcPlacementEditor from './NpcPlacementEditor.vue';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
// 可以擔任店主的店：內建的固定商店與自建的商店
const keeperShops = computed(() => {
    void content.version;
    return Object.entries(shopRules.types).filter(([t, d]) => KEEPER_SHOPS.includes(t) || d.custom).map(([t, d]) => [t, d.name]);
});
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
function current() {
    return clone(content.mods.npcs[props.id] ?? namedNpcs.find((n) => n.id === props.id));
}
const draft = ref(current());
// 比較時略過空的條件（表單會先建立空的 requires 物件）
const snap = (v) => JSON.stringify(v, (k, x) => (k === 'requires' && x && !x.flags?.length && !x.flags_none?.length ? undefined : x));
const saved = ref(snap(draft.value));
watch(() => props.id, () => {
    draft.value = current();
    saved.value = snap(draft.value);
});
const dirty = computed(() => snap(draft.value) !== saved.value);
const builtin = computed(() => !!builtinNpc(props.id));
const edited = computed(() => builtin.value && !!content.mods.npcs[props.id]);
// ---- 選項 ----
const ZONE_NAME = { town: '城區', noble: '貴族區', palace: '王城', temple: '神殿', brothel: '娼館', outskirts: '近郊', dungeon: '地下城' };
const settlements = geography.locations.filter((l) => l.type !== 'dungeon');
const places = geography.locations;
const tags = computed(() => Object.entries(npcTags.tags).filter(([, t]) => t.kinds.includes(draft.value.kind ?? 'adventurer')));
// ---- 依劇情旗標改變出沒：由上往下第一組條件成立的設定 ----
function addStage() {
    ;
    (draft.value.stages ??= []).push({ requires: { flags: [] }, location: draft.value.location, haunts: [{ location: draft.value.location, zone: 'town', weight: 1 }] });
}
function moveStage(i, d) {
    const list = draft.value.stages;
    const j = i + d;
    if (j < 0 || j >= list.length)
        return;
    [list[i], list[j]] = [list[j], list[i]];
}
// ---- 劇情條件 ----
const requires = computed(() => (draft.value.requires ??= {}));
// ---- 屬性、能力、裝備 ----
const customAttrs = computed({
    get: () => !!draft.value.attrs,
    set: (on) => {
        if (on)
            draft.value.attrs = { ...preview.value.attrs };
        else
            delete draft.value.attrs;
    },
});
const classList = computed(() => (draft.value.kind === 'commoner' ? [] : classAbilities(draft.value.class)));
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
    if (!draft.value.abilities.length)
        delete draft.value.abilities;
}
// 特質：指定時取代依 id 抽的（空的清單＝沒有特質）
const pickPerk = ref('');
function addPerk() {
    if (!pickPerk.value)
        return;
    const list = (draft.value.perks ??= []);
    if (!list.includes(pickPerk.value))
        list.push(pickPerk.value);
    pickPerk.value = '';
}
function removePerk(id) {
    draft.value.perks = (draft.value.perks ?? []).filter((p) => p !== id);
}
const SLOTS = Object.keys(gearRules.slots);
const customGear = computed({
    get: () => !!draft.value.gear,
    set: (on) => {
        if (on)
            draft.value.gear = Object.fromEntries(Object.entries(preview.value.gear ?? {}).map(([k, g]) => [k, clone(g.spec)]));
        else
            delete draft.value.gear;
    },
});
function basesFor(slot) {
    return Object.entries(gearRules.bases).filter(([, b]) => baseFits(b.slot, slot));
}
function materialsFor(base) {
    const kind = gearRules.bases[base]?.kind;
    return Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind);
}
function setBase(slot, base) {
    const g = (draft.value.gear ??= {});
    if (!base) {
        delete g[slot];
        return;
    }
    g[slot] = { base, material: materialsFor(base)[0]?.[0] ?? '' };
}
// ---- 預覽：照這份設定建立的角色 ----
const preview = computed(() => {
    void content.version;
    return createNpc({ ...draft.value, class: draft.value.class || 'noncombatant' }, new Rng(1));
});
const previewAbilities = computed(() => preview.value.abilities.map((id) => abilityTable[id]?.name ?? id).join('、'));
// ---- 動作 ----
function save() {
    try {
        if (draft.value.requires && !draft.value.requires.flags?.length && !draft.value.requires.flags_none?.length)
            delete draft.value.requires;
        content.saveNpc(props.id, draft.value);
        draft.value = current();
        saved.value = snap(draft.value);
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
    content.restoreNpc(props.id);
    draft.value = current();
    saved.value = snap(draft.value);
}
// 還有地方用到時不能刪（見 docs/CONTENT_DEPENDENCIES.md）
const usage = computed(() => {
    void content.version;
    void game.state?.time.minute;
    return content.usageOf('npc', props.id);
});
function remove() {
    if (!confirm(`刪除「${draft.value.name}」？其他存檔裡已經登場過的這個角色會留著，但不會再更新。`))
        return;
    try {
        content.deleteNpc(props.id);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
        return;
    }
    emit('deleted');
}
function setKeeper(v) {
    if (v)
        draft.value.keeper = v;
    else
        delete draft.value.keeper;
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
__VLS_withDotValue(attributeRules, {});
// @ts-ignore
__VLS_withDotValue(requires, {});
// @ts-ignore
__VLS_withDotValue(preview, {});
// @ts-ignore
__VLS_withDotValue(ATTR_IDS, {});
// @ts-ignore
__VLS_withDotValue(abilityTable, {});
// @ts-ignore
__VLS_withDotValue(previewAbilities, {});
// @ts-ignore
__VLS_withDotValue(classList, {});
// @ts-ignore
__VLS_withDotValue(pickAbility, {});
// @ts-ignore
__VLS_withDotValue(pickPerk, {});
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
    maxlength: "12",
});
(draft.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.gender),
});
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(GENDER_IDS, {})));
for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (g),
        value: (g),
    });
    (__VLS_unwrap(genderName, {})(g));
    // @ts-ignore
    [draft, draft, draft, builtin, builtin, builtin, edited, edited, dirty, dirty, dirty, usage, usage, usage, id, GENDER_IDS, genderName,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.race),
});
const __VLS_6 = __VLS_tryAsConstant((attributeRules.value.races));
for (const [r, k] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (__VLS_unwrap(raceName, {})(String(k)));
    // @ts-ignore
    [draft, attributeRules, raceName,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.kind),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "adventurer",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "commoner",
});
if (draft.value.kind !== 'commoner') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.class),
    });
    const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(combatClasses, {})));
    for (const [c, k] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (__VLS_unwrap(className, {})(String(k)));
        // @ts-ignore
        [draft, draft, draft, combatClasses, className,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "12",
        placeholder: "鐵匠、修女……",
    });
    (draft.value.occupation);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
    max: "20",
});
(draft.value.level);
if (draft.value.kind !== 'commoner') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (draft.value.hire_cc);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "30",
});
(draft.value.faction);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "30",
    placeholder: "部族、氏族……",
});
(draft.value.lineage);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.personality),
    rows: "2",
    maxlength: "160",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.appearance),
    rows: "2",
    maxlength: "240",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.background),
    rows: "3",
    maxlength: "400",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(tags, {})));
for (const [[k, t]] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (k),
        ...{ class: "check small" },
        title: (t.ai_hint),
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.tags = $event.target.checked ? [...(draft.value.tags ?? []), k] : (draft.value.tags ?? []).filter((x) => x !== k));
                // @ts-ignore
                [draft, draft, draft, draft, draft, draft, draft, draft, draft, draft, draft, draft, tags,];
            } },
        type: "checkbox",
        checked: (draft.value.tags?.includes(k)),
    });
    (t.name);
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
const __VLS_9 = NpcPlacementEditor;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent1(__VLS_9, new __VLS_9({
    // @ts-ignore
    modelValue: (draft.value), allowLandmark: true,
}));
const __VLS_11 = __VLS_10({
    modelValue: (draft.value),
    allowLandmark: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setKeeper($event.target.value));
            // @ts-ignore
            [draft,];
        } },
    value: (draft.value.keeper ?? ''),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_14 = __VLS_tryAsConstant((__VLS_unwrap(keeperShops, {})));
for (const [[t, name]] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (t),
        value: (t),
    });
    (name);
    // @ts-ignore
    [draft, keeperShops,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_15 = FlagInput;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    // @ts-ignore
    modelValue: (requires.value.flags),
}));
const __VLS_17 = __VLS_16({
    modelValue: (requires.value.flags),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_20 = FlagInput;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    // @ts-ignore
    modelValue: (requires.value.flags_none),
}));
const __VLS_22 = __VLS_21({
    modelValue: (requires.value.flags_none),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
const __VLS_25 = __VLS_tryAsConstant((draft.value.stages ?? []));
for (const [st, i] of __VLS_vFor(__VLS_nonNull(__VLS_25))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "stage" },
    });
    /** @type {__VLS_StyleScopedClasses['stage']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (i + 1);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "spacer" },
    });
    /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (moveStage(i, -1));
                // @ts-ignore
                [draft, requires, requires,];
            } },
        ...{ class: "small" },
        title: "往上",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (moveStage(i, 1));
                // @ts-ignore
                [];
            } },
        ...{ class: "small" },
        title: "往下",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.stages.splice(i, 1));
                // @ts-ignore
                [draft,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_26 = FlagInput;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
        // @ts-ignore
        modelValue: (st.requires.flags),
    }));
    const __VLS_28 = __VLS_27({
        modelValue: (st.requires.flags),
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_31 = FlagInput;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
        // @ts-ignore
        modelValue: (st.requires.flags_none),
    }));
    const __VLS_33 = __VLS_32({
        modelValue: (st.requires.flags_none),
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    const __VLS_36 = NpcPlacementEditor;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
        // @ts-ignore
        modelValue: (draft.value.stages[i]),
    }));
    const __VLS_38 = __VLS_37({
        modelValue: (draft.value.stages[i]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addStage) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(className, {})(preview.value.class));
(preview.value.level);
(preview.value.maxHp);
(ATTR_IDS.value.map((a) => `${__VLS_unwrap(attrName, {})(a)} ${preview.value.attrs[a]}`).join('、'));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_unwrap(customAttrs, {}));
if (draft.value.attrs) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    const __VLS_41 = __VLS_tryAsConstant((ATTR_IDS.value));
    for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_41))) {
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
        [draft, draft, className, preview, preview, preview, preview, ATTR_IDS, ATTR_IDS, attrName, attrName, customAttrs,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chips" },
});
/** @type {__VLS_StyleScopedClasses['chips']} */ ;
const __VLS_42 = __VLS_tryAsConstant((draft.value.abilities ?? []));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_42))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (a),
        ...{ class: "tag chip" },
        title: (abilityTable.value[a]?.desc),
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['chip']} */ ;
    (abilityTable.value[a]?.name ?? a);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (removeAbility(a));
                // @ts-ignore
                [draft, abilityTable, abilityTable,];
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
    (previewAbilities.value || '無');
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
    label: (`${__VLS_unwrap(className, {})(draft.value.class)}的能力`),
});
const __VLS_43 = __VLS_tryAsConstant((classList.value));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_43))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (a.id),
        value: (a.id),
    });
    (a.name);
    (a.desc.slice(0, 40));
    // @ts-ignore
    [draft, draft, className, previewAbilities, pickAbility, classList,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
    label: "其他",
});
const __VLS_44 = __VLS_tryAsConstant((Object.values(abilityTable.value).filter((x) => !classList.value.includes(x))));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_44))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (a.id),
        value: (a.id),
    });
    (a.name);
    // @ts-ignore
    [abilityTable, classList,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addAbility) },
    ...{ class: "small" },
    disabled: (!pickAbility.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "chips" },
});
/** @type {__VLS_StyleScopedClasses['chips']} */ ;
const __VLS_45 = __VLS_tryAsConstant((draft.value.perks ?? []));
for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_45))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (id),
        ...{ class: "tag chip" },
        title: (__VLS_unwrap(perkDef, {})(id)?.desc),
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['chip']} */ ;
    (__VLS_unwrap(perkDef, {})(id)?.name ?? id);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (removePerk(id));
                // @ts-ignore
                [draft, pickAbility, perkDef, perkDef,];
            } },
        ...{ class: "x" },
    });
    /** @type {__VLS_StyleScopedClasses['x']} */ ;
    // @ts-ignore
    [];
}
if (!draft.value.perks) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(npcPerksOf, {})(draft.value).map((id) => __VLS_unwrap(perkDef, {})(id)?.name).join('、') || '無');
}
else if (!draft.value.perks.length) {
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
    value: (pickPerk.value),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_46 = __VLS_tryAsConstant((__VLS_unwrap(choosablePerks, {})()));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_46))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (p.id),
        value: (p.id),
    });
    (p.name);
    (p.flaw ? '（缺陷）' : '');
    (p.desc.slice(0, 40));
    // @ts-ignore
    [draft, draft, draft, perkDef, npcPerksOf, pickPerk, choosablePerks,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addPerk) },
    ...{ class: "small" },
    disabled: (!pickPerk.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (draft.value.perks) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.perks))
                    throw 0;
                return (delete draft.value.perks);
                // @ts-ignore
                [draft, draft, pickPerk,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_unwrap(customGear, {}));
if (draft.value.gear) {
    const __VLS_47 = __VLS_tryAsConstant((__VLS_unwrap(SLOTS, {})));
    for (const [slot] of __VLS_vFor(__VLS_nonNull(__VLS_47))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (slot),
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small slot" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['slot']} */ ;
        (__VLS_unwrap(slotName, {})(slot));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.gear))
                        throw 0;
                    return (setBase(slot, $event.target.value));
                    // @ts-ignore
                    [draft, customGear, SLOTS, slotName,];
                } },
            value: (draft.value.gear[slot]?.base ?? ''),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        const __VLS_48 = __VLS_tryAsConstant((basesFor(slot)));
        for (const [[id, b]] of __VLS_vFor(__VLS_nonNull(__VLS_48))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (id),
                value: (id),
            });
            (b.name);
            // @ts-ignore
            [draft,];
        }
        if (draft.value.gear[slot]) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (draft.value.gear[slot].material),
            });
            const __VLS_49 = __VLS_tryAsConstant((materialsFor(draft.value.gear[slot].base)));
            for (const [[id, m]] of __VLS_vFor(__VLS_nonNull(__VLS_49))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (id),
                    value: (id),
                });
                (m.name);
                // @ts-ignore
                [draft, draft, draft,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (draft.value.gear[slot].rarity),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: (undefined),
            });
            const __VLS_50 = __VLS_tryAsConstant((__VLS_unwrap(RARITY_ORDER, {})));
            for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_50))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (r),
                    value: (r),
                });
                (__VLS_unwrap(rarityName, {})(r));
                // @ts-ignore
                [draft, RARITY_ORDER, rarityName,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(gearName, {})(draft.value.gear[slot]));
        }
        // @ts-ignore
        [draft, gearName,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (Object.values(preview.value.gear ?? {}).map((g) => g.name).join('、') || '無');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(locationById, {})(draft.value.location).name);
// @ts-ignore
[draft, preview, locationById,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
