import { computed, reactive, ref, watch } from 'vue';
import { slaveryRules } from '@/engine/data';
import { sanitizeTerms, templateTerms } from '@/engine/slavery';
import { placeName, TATTOO_PLACES } from '@/engine/tattoos';
const { defineProps, defineModel, } = {};
const props = defineProps();
const model = defineModel({ required: true });
const templates = computed(() => props.allowed ?? Object.keys(slaveryRules.contracts));
// 初始值不在可選範圍內時改選第一個可選的印記
const mode = ref(typeof model.value !== 'string' ? (props.allowCustom ? 'custom' : templates.value[0])
    : templates.value.includes(model.value) ? model.value : templates.value[0] ?? (props.allowCustom ? 'custom' : model.value));
const r = slaveryRules.custom_mark;
const custom = reactive(templateTerms(props.base ?? templates.value[0] ?? slaveryRules.roles.default));
const sideText = ref(custom.side_effects.join('\n'));
watch([mode, custom, sideText], () => {
    model.value = mode.value === 'custom'
        ? sanitizeTerms({ ...custom, side_effects: sideText.value.split('\n') })
        : mode.value;
}, { deep: true, immediate: true });
const pct = (n) => `${Math.round(n * 100)}%`;
function summary(t) {
    return `收益 ${pct(t.income_share)}・談判 DC ${t.negotiate_dc}・逃離 DC ${t.escape_dc}・出城 DC ${t.exit_dc}・被找到 ${pct(t.recapture_chance)}・反噬 ${pct(t.escape_hp_ratio)}・服從 -${t.obedience_penalty}`;
}
/** 從模板開始改 */
function startFrom(id) {
    Object.assign(custom, templateTerms(id));
    sideText.value = custom.side_effects.join('\n');
    mode.value = 'custom';
}
let __VLS_modelEmit;
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
__VLS_withDotValue(mode, {});
// @ts-ignore
__VLS_withDotValue(slaveryRules, {});
// @ts-ignore
__VLS_withDotValue(r, {});
// @ts-ignore
__VLS_withDotValue(custom, {});
void {};
/** @type {__VLS_StyleScopedClasses['custom']} */ ;
/** @type {__VLS_StyleScopedClasses['custom']} */ ;
/** @type {__VLS_StyleScopedClasses['nums']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mark-picker small" },
});
/** @type {__VLS_StyleScopedClasses['mark-picker']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(templates, {})));
for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (id),
        ...{ class: "option" },
    });
    /** @type {__VLS_StyleScopedClasses['option']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: (id),
    });
    (mode.value);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_unwrap(templateTerms, {})(id).name);
    (__VLS_unwrap(placeName, {})(__VLS_unwrap(templateTerms, {})(id).place));
    (__VLS_unwrap(templateTerms, {})(id).mark);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    (summary(__VLS_unwrap(templateTerms, {})(id)));
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    (__VLS_unwrap(templateTerms, {})(id).side_effects.join('；'));
    // @ts-ignore
    [templates, mode, templateTerms, templateTerms, templateTerms, templateTerms, templateTerms, placeName,];
}
if (__VLS_ctx.allowCustom) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "option" },
    });
    /** @type {__VLS_StyleScopedClasses['option']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: "custom",
    });
    (mode.value);
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    if (mode.value === 'custom') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "custom" },
        });
        /** @type {__VLS_StyleScopedClasses['custom']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        const __VLS_1 = __VLS_tryAsConstant((Object.keys(slaveryRules.value.contracts)));
        for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(__VLS_ctx.allowCustom))
                            throw 0;
                        if (!(mode.value === 'custom'))
                            throw 0;
                        return (startFrom(id));
                        // @ts-ignore
                        [mode, mode, allowCustom, slaveryRules,];
                    } },
                key: (id),
                ...{ class: "small" },
                type: "button",
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (__VLS_unwrap(templateTerms, {})(id).name);
            // @ts-ignore
            [templateTerms,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: (r.value.name_chars),
        });
        (custom.value.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (custom.value.mark),
            rows: "2",
            maxlength: (r.value.mark_chars),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (custom.value.place),
        });
        const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(TATTOO_PLACES, {})));
        for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (p),
                value: (p),
            });
            (__VLS_unwrap(placeName, {})(p));
            // @ts-ignore
            [placeName, r, r, custom, custom, custom, TATTOO_PLACES,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "nums" },
        });
        /** @type {__VLS_StyleScopedClasses['nums']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            step: "0.05",
            min: (r.value.income_share[0]),
            max: (r.value.income_share[1]),
        });
        (custom.value.income_share);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: (r.value.negotiate_dc[0]),
            max: (r.value.negotiate_dc[1]),
        });
        (custom.value.negotiate_dc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: (r.value.escape_dc[0]),
            max: (r.value.escape_dc[1]),
        });
        (custom.value.escape_dc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: (r.value.exit_dc[0]),
            max: (r.value.exit_dc[1]),
        });
        (custom.value.exit_dc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            step: "0.05",
            min: (r.value.recapture_chance[0]),
            max: (r.value.recapture_chance[1]),
        });
        (custom.value.recapture_chance);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            step: "0.05",
            min: (r.value.escape_hp_ratio[0]),
            max: (r.value.escape_hp_ratio[1]),
        });
        (custom.value.escape_hp_ratio);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: (r.value.obedience_penalty[0]),
            max: (r.value.obedience_penalty[1]),
        });
        (custom.value.obedience_penalty);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        (r.value.side_effects);
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_unwrap(sideText, {})),
            rows: "2",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
}
// @ts-ignore
[r, r, r, r, r, r, r, r, r, r, r, r, r, r, r, custom, custom, custom, custom, custom, custom, custom, sideText,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
