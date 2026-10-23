const { defineProps, } = {};
const __VLS_props = defineProps();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat small" },
});
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
(__VLS_ctx.kind.toUpperCase());
(__VLS_ctx.value);
(__VLS_ctx.max);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "bar" },
    ...{ class: (__VLS_ctx.kind) },
});
/** @type {__VLS_StyleScopedClasses['bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ style: ({ width: `${__VLS_ctx.max > 0 ? Math.max(0, Math.min(100, (__VLS_ctx.value / __VLS_ctx.max) * 100)) : 0}%` }) },
});
// @ts-ignore
[kind, kind, value, value, max, max, max,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
