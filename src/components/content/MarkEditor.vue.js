import { computed, ref, watch } from 'vue';
import { slaveryRules } from '@/engine/data';
import { builtinMark } from '@/engine/mods';
import { deriveFunctions, termsFromTemplate } from '@/engine/slavery';
import { MARK_EDITOR_LIMITS as L } from '@/engine/tattooMods';
import { placeName, TATTOO_PLACES } from '@/engine/tattoos';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
const current = () => clone(content.mods.marks?.[props.id] ?? slaveryRules.contracts[props.id]);
const draft = ref(current());
const saved = ref(JSON.stringify(draft.value));
const sideText = ref(draft.value.side_effects.join('\n'));
watch(() => props.id, () => {
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
    sideText.value = draft.value.side_effects.join('\n');
});
watch(sideText, (t) => (draft.value.side_effects = t.split('\n').map((x) => x.trim()).filter(Boolean)));
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
const builtin = computed(() => !!builtinMark(props.id));
const edited = computed(() => builtin.value && !!content.mods.marks?.[props.id]);
const usage = computed(() => {
    void content.version;
    return content.usageOf('mark', props.id);
});
const sealed = computed({
    get: () => draft.value.spell_cap !== undefined,
    set: (on) => {
        if (on)
            draft.value.spell_cap = 1;
        else
            delete draft.value.spell_cap;
    },
});
const functionNames = computed(() => {
    const names = slaveryRules.functions;
    return deriveFunctions({ ...termsFromTemplate(props.id), ...draft.value, escape_hp_ratio: draft.value.escape_effects.hp_ratio })
        .map((f) => names[f]?.split('：')[0] ?? f).join('、');
});
function discard() {
    draft.value = current();
    sideText.value = draft.value.side_effects.join('\n');
}
function save() {
    try {
        content.saveMark(props.id, draft.value);
        draft.value = current();
        saved.value = JSON.stringify(draft.value);
        game.flash(`已儲存「${draft.value.name}」`);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function restore() {
    if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`))
        return;
    content.restoreMark(props.id);
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
    sideText.value = draft.value.side_effects.join('\n');
}
function remove() {
    if (!confirm(`刪除「${draft.value.name}」？`))
        return;
    try {
        content.deleteMark(props.id);
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
__VLS_withDotValue(L, {});
// @ts-ignore
__VLS_withDotValue(sealed, {});
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
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_ctx.id);
(__VLS_unwrap(functionNames, {}));
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
    maxlength: (L.value.name_chars),
});
(draft.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.place),
});
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(TATTOO_PLACES, {})));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (p),
        value: (p),
    });
    (__VLS_unwrap(placeName, {})(p));
    // @ts-ignore
    [draft, draft, draft, builtin, builtin, builtin, edited, edited, dirty, dirty, dirty, usage, usage, id, functionNames, L, TATTOO_PLACES, placeName,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "wide" },
});
/** @type {__VLS_StyleScopedClasses['wide']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.mark),
    rows: "2",
    maxlength: (L.value.mark_chars),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "wide" },
});
/** @type {__VLS_StyleScopedClasses['wide']} */ ;
(L.value.side_effects);
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_unwrap(sideText, {})),
    rows: "3",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    step: "0.05",
    min: (L.value.income_share[0]),
    max: (L.value.income_share[1]),
});
(draft.value.income_share);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: (L.value.negotiate_dc[0]),
    max: (L.value.negotiate_dc[1]),
});
(draft.value.negotiate_dc);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: (L.value.escape_dc[0]),
    max: (L.value.escape_dc[1]),
});
(draft.value.escape_dc);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: (L.value.exit_dc[0]),
    max: (L.value.exit_dc[1]),
});
(draft.value.exit_dc);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    step: "0.05",
    min: (L.value.recapture_chance[0]),
    max: (L.value.recapture_chance[1]),
});
(draft.value.recapture_chance);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    step: "0.05",
    min: (L.value.escape_hp_ratio[0]),
    max: (L.value.escape_hp_ratio[1]),
});
(draft.value.escape_effects.hp_ratio);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: (L.value.obedience_penalty[0]),
    max: (L.value.obedience_penalty[1]),
});
(draft.value.obedience_penalty);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(sealed.value);
if (sealed.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: (L.value.spell_cap[0]),
        max: (L.value.spell_cap[1]),
    });
    (draft.value.spell_cap);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(L.value.negotiate_dc.join('～'));
(L.value.exit_dc.join('～'));
(L.value.recapture_chance[1] * 100);
(L.value.escape_hp_ratio[1] * 100);
(L.value.obedience_penalty[1]);
// @ts-ignore
[draft, draft, draft, draft, draft, draft, draft, draft, draft, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, L, sideText, sealed, sealed,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
