import { ref } from 'vue';
const { defineProps, withDefaults, } = {};
const props = withDefaults(defineProps(), { level: 'h4', count: undefined, closed: false });
const KEY = 'elondia.folds';
function readFolds() {
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? '{}');
    }
    catch {
        return {};
    }
}
const open = ref(!(readFolds()[props.id] ?? props.closed));
function toggle() {
    open.value = !open.value;
    try {
        const folds = readFolds();
        if (open.value === !props.closed)
            delete folds[props.id];
        else
            folds[props.id] = !open.value;
        localStorage.setItem(KEY, JSON.stringify(folds));
    }
    catch {
        // 記不住也沒關係
    }
}
const __VLS_defaults = { level: 'h4', count: undefined, closed: false };
void __VLS_defaults;
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(open, {});
void {};
/** @type {__VLS_StyleScopedClasses['fold-head']} */ ;
/** @type {__VLS_StyleScopedClasses['fold-head']} */ ;
/** @type {__VLS_StyleScopedClasses['fold-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['fold-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['caret']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "fold" },
    ...{ class: ({ closed: !open.value }) },
});
/** @type {__VLS_StyleScopedClasses['fold']} */ ;
/** @type {__VLS_StyleScopedClasses['closed']} */ ;
const __VLS_0 = (__VLS_ctx.level);
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    ...{ class: "fold-head" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "fold-head" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['fold-head']} */ ;
const { default: __VLS_5 } = __VLS_nonNull(__VLS_3.slots);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (toggle) },
    ...{ class: "fold-toggle" },
    'aria-expanded': (open.value),
    title: (open.value ? '收起' : '展開'),
});
/** @type {__VLS_StyleScopedClasses['fold-toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "caret" },
});
/** @type {__VLS_StyleScopedClasses['caret']} */ ;
(open.value ? '▾' : '▸');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.title);
if (__VLS_ctx.count !== undefined) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "count muted" },
    });
    /** @type {__VLS_StyleScopedClasses['count']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_ctx.count);
}
var __VLS_6 = {};
// @ts-ignore
[open, open, open, open, level, title, count, count,];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "fold-body" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(__VLS_nonNull(null), { ...__VLS_directiveBindingRestFields, value: (open.value), }, __VLS_nonNull(null), __VLS_nonNull(null));
/** @type {__VLS_StyleScopedClasses['fold-body']} */ ;
var __VLS_8 = {};
var __VLS_7 = __VLS_6, __VLS_9 = __VLS_8;
// @ts-ignore
[open,];
const __VLS_base = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
const __VLS_export = {};
export default {};
