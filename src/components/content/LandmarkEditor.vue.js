import { computed, ref, watch } from 'vue';
import { ATTR_IDS, attrName, landmarks, landmarkTypes, locationById, perkRules } from '@/engine/data';
import { settlementArea } from '@/engine/grid';
import { builtinLandmark, LANDMARK_EFFECTS, LANDMARK_LIMITS, landmarkTraining, landmarkUsage } from '@/engine/landmarkMods';
import { builtinPerk } from '@/engine/mods';
import EffectsEditor from './EffectsEditor.vue';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import CellPicker from './CellPicker.vue';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
function current() {
    void content.version;
    const l = clone(landmarks[props.id]);
    return {
        scene: '', ...l, open: l.open ?? {}, ...(builtinLandmark(props.id) ? {} : { custom: true }),
        train: landmarkTraining(props.id), flagsText: (l.open?.flags ?? []).join('、'), flagsNoneText: (l.open?.flags_none ?? []).join('、'),
    };
}
const draft = ref(current());
const saved = ref(JSON.stringify(draft.value));
const picking = ref(false);
function reset() {
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
    picking.value = false;
}
watch(() => props.id, reset);
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
const builtin = computed(() => !!builtinLandmark(props.id));
const edited = computed(() => builtin.value && !!content.mods.landmarks?.[props.id]);
const usage = computed(() => {
    void content.version;
    return landmarkUsage(props.id);
});
const typeList = Object.entries(landmarkTypes).map(([k, t]) => [k, t.name]);
function placeText(r) {
    return `${locationById(r.area.split('/')[0]).name}・${settlementArea(r.area, false)?.name ?? r.area}（${r.x}, ${r.y}）`;
}
function toggleType(t, on) {
    const set = new Set(draft.value.types);
    if (on)
        set.add(t);
    else
        set.delete(t);
    draft.value.types = [...set];
}
function pick(r) {
    if (!r)
        return;
    draft.value.at = r;
    draft.value.location = r.area.split('/')[0];
    picking.value = false;
}
// 受訓：有受訓設定的特質（種族天賦除外）
const trainPerks = computed(() => {
    void content.version;
    return perkRules.perks.filter((p) => !p.race && (p.train ?? builtinPerk(p.id)?.train));
});
function toggleTrain(id, on) {
    const set = new Set(draft.value.train);
    if (on)
        set.add(id);
    else
        set.delete(id);
    draft.value.train = [...set];
}
const open = computed(() => draft.value.open);
const splitFlags = (t) => t.split(/[、,，\s]+/).map((x) => x.trim()).filter(Boolean);
function toggleVisit(on) {
    if (on)
        draft.value.visit = { title: '參訪', hours: 0.5, effects: [] };
    else
        delete draft.value.visit;
}
function toggleExplore(on) {
    if (on)
        draft.value.explore = { title: '四處探索', attr: 'int', dc: 12, hours: 2, effects: [{ type: 'money', amount: 30 }] };
    else
        delete draft.value.explore;
}
function toggleWork(on) {
    if (on)
        draft.value.work = { attr: 'cha', dc: 12, rate_cc: 3, desc: '在這裡幫忙。' };
    else
        delete draft.value.work;
}
function save() {
    try {
        const { train, flagsText, flagsNoneText, ...m } = draft.value;
        m.open = { ...m.open, flags: splitFlags(flagsText), flags_none: splitFlags(flagsNoneText) };
        const before = JSON.parse(saved.value).train;
        content.saveLandmark(props.id, m);
        if (JSON.stringify([...train].sort()) !== JSON.stringify([...before].sort()))
            content.setShopTraining(props.id, train);
        reset();
        game.flash(`已儲存「${landmarks[props.id]?.name}」`);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function restore() {
    if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？（位置也回到原處）`))
        return;
    content.restoreLandmark(props.id);
    reset();
}
function remove() {
    if (!confirm(`刪除自建的地標「${draft.value.name}」？地圖上的格子會變回道路。`))
        return;
    try {
        content.deleteLandmark(props.id);
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
__VLS_withDotValue(builtin, {});
// @ts-ignore
__VLS_withDotValue(edited, {});
// @ts-ignore
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
// @ts-ignore
__VLS_withDotValue(LANDMARK_LIMITS, {});
// @ts-ignore
__VLS_withDotValue(picking, {});
// @ts-ignore
__VLS_withDotValue(open, {});
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
(draft.value.name);
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
    ...{ onClick: (reset) },
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
        ...{ class: "small warn" },
        disabled: (usage.value.length > 0),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_ctx.id);
(builtin.value ? '內建的地標只能在同一個聚落裡移動、不能刪除。' : '');
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
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: (LANDMARK_LIMITS.value.name_chars),
});
(draft.value.name);
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
    maxlength: (LANDMARK_LIMITS.value.desc_chars),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.scene),
    rows: "2",
    maxlength: (LANDMARK_LIMITS.value.scene_chars),
});
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
(LANDMARK_LIMITS.value.types);
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(typeList, {})));
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
                return (toggleType(k, $event.target.checked));
                // @ts-ignore
                [draft, draft, draft, draft, draft, draft, builtin, builtin, builtin, builtin, edited, edited, dirty, dirty, dirty, usage, usage, id, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, typeList,];
            } },
        type: "checkbox",
        checked: (draft.value.types.includes(k)),
        disabled: (!draft.value.types.includes(k) && draft.value.types.length >= LANDMARK_LIMITS.value.types),
    });
    (n);
    // @ts-ignore
    [draft, draft, draft, LANDMARK_LIMITS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(draft.value.at.area ? placeText(draft.value.at) : '還沒選');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (picking.value = !picking.value);
            // @ts-ignore
            [draft, draft, picking, picking,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(picking.value ? '收起' : builtin.value ? '移動' : '選位置');
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(builtin.value ? '在同一個聚落裡搬到一格空地（道路），可以換區塊。' : '選聚落與區塊，點一格空地（道路）。');
if (picking.value) {
    const __VLS_6 = CellPicker;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        // @ts-ignore
        ...{ 'onUpdate:modelValue': {} }, modelValue: (draft.value.at.area ? draft.value.at : null), location: (draft.value.location), lockLocation: (builtin.value), marker: (draft.value.emoji), self: (__VLS_ctx.id),
    }));
    const __VLS_8 = __VLS_7({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (draft.value.at.area ? draft.value.at : null),
        location: (draft.value.location),
        lockLocation: (builtin.value),
        marker: (draft.value.emoji),
        self: (__VLS_ctx.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    let __VLS_11;
    const __VLS_12 = {
        /** @type {typeof __VLS_11.'update:modelValue'} */
        'onUpdate:modelValue': (pick),
    };
    void __VLS_12;
    var __VLS_9;
    var __VLS_10;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (open.value.hours),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (undefined),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "day",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "night",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: (LANDMARK_LIMITS.value.reputation[0]),
    max: (LANDMARK_LIMITS.value.reputation[1]),
});
(open.value.min_reputation);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(open.value.official);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
(draft.value.flagsText);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
(draft.value.flagsNoneText);
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (toggleVisit($event.target.checked));
            // @ts-ignore
            [draft, draft, draft, draft, draft, draft, builtin, builtin, builtin, id, LANDMARK_LIMITS, LANDMARK_LIMITS, picking, picking, open, open, open,];
        } },
    type: "checkbox",
    checked: (!!draft.value.visit),
});
if (draft.value.visit) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: (LANDMARK_LIMITS.value.title_chars),
    });
    (draft.value.visit.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (draft.value.visit.money_cc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        step: "0.5",
        min: (LANDMARK_LIMITS.value.hours[0]),
        max: (LANDMARK_LIMITS.value.hours[1]),
    });
    (draft.value.visit.hours);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: (LANDMARK_LIMITS.value.cooldown[0]),
        max: (LANDMARK_LIMITS.value.cooldown[1]),
        placeholder: "1",
    });
    (draft.value.visit.cooldown_days);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "block" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: (LANDMARK_LIMITS.value.desc_chars),
    });
    (draft.value.visit.desc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (LANDMARK_LIMITS.value.effects);
    const __VLS_13 = EffectsEditor;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({
        // @ts-ignore
        modelValue: (draft.value.visit.effects), types: (__VLS_unwrap(LANDMARK_EFFECTS, {})),
    }));
    const __VLS_15 = __VLS_14({
        modelValue: (draft.value.visit.effects),
        types: (__VLS_unwrap(LANDMARK_EFFECTS, {})),
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (toggleExplore($event.target.checked));
            // @ts-ignore
            [draft, draft, draft, draft, draft, draft, draft, draft, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_EFFECTS,];
        } },
    type: "checkbox",
    checked: (!!draft.value.explore),
});
if (draft.value.explore) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: (LANDMARK_LIMITS.value.title_chars),
    });
    (draft.value.explore.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.explore.attr),
    });
    const __VLS_18 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
    for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (a),
            value: (a),
        });
        (__VLS_unwrap(attrName, {})(a));
        // @ts-ignore
        [draft, draft, draft, draft, LANDMARK_LIMITS, ATTR_IDS, attrName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: (LANDMARK_LIMITS.value.dc[0]),
        max: (LANDMARK_LIMITS.value.dc[1]),
    });
    (draft.value.explore.dc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        step: "0.5",
        min: (LANDMARK_LIMITS.value.hours[0]),
        max: (LANDMARK_LIMITS.value.hours[1]),
    });
    (draft.value.explore.hours);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: (LANDMARK_LIMITS.value.cooldown[0]),
        max: (LANDMARK_LIMITS.value.cooldown[1]),
        placeholder: "7",
    });
    (draft.value.explore.cooldown_days);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "block" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: (LANDMARK_LIMITS.value.desc_chars),
    });
    (draft.value.explore.desc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_19 = EffectsEditor;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
        // @ts-ignore
        modelValue: (draft.value.explore.effects), types: (__VLS_unwrap(LANDMARK_EFFECTS, {})),
    }));
    const __VLS_21 = __VLS_20({
        modelValue: (draft.value.explore.effects),
        types: (__VLS_unwrap(LANDMARK_EFFECTS, {})),
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_24 = EffectsEditor;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
        // @ts-ignore
        modelValue: (draft.value.explore.critical), types: (__VLS_unwrap(LANDMARK_EFFECTS, {})),
    }));
    const __VLS_26 = __VLS_25({
        modelValue: (draft.value.explore.critical),
        types: (__VLS_unwrap(LANDMARK_EFFECTS, {})),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (toggleWork($event.target.checked));
            // @ts-ignore
            [draft, draft, draft, draft, draft, draft, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_EFFECTS, LANDMARK_EFFECTS,];
        } },
    type: "checkbox",
    checked: (!!draft.value.work),
});
if (draft.value.work) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.work.attr),
    });
    const __VLS_29 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
    for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_29))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (a),
            value: (a),
        });
        (__VLS_unwrap(attrName, {})(a));
        // @ts-ignore
        [draft, draft, draft, ATTR_IDS, attrName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: (LANDMARK_LIMITS.value.dc[0]),
        max: (LANDMARK_LIMITS.value.dc[1]),
    });
    (draft.value.work.dc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: (LANDMARK_LIMITS.value.rate_cc[0]),
        max: (LANDMARK_LIMITS.value.rate_cc[1]),
    });
    (draft.value.work.rate_cc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "block" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: (LANDMARK_LIMITS.value.desc_chars),
    });
    (draft.value.work.desc);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_30 = __VLS_tryAsConstant((__VLS_unwrap(trainPerks, {})));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_30))) {
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
                return (toggleTrain(p.id, $event.target.checked));
                // @ts-ignore
                [draft, draft, draft, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, LANDMARK_LIMITS, trainPerks,];
            } },
        type: "checkbox",
        checked: (draft.value.train.includes(p.id)),
    });
    (p.flaw ? '⚠️' : '');
    (p.name);
    // @ts-ignore
    [draft,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
