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
/** @type {__VLS_StyleScopedClasses['usage']} */ ;
/** @type {__VLS_StyleScopedClasses['usage']} */ ;
if (__VLS_ctx.usage.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "usage small" },
    });
    /** @type {__VLS_StyleScopedClasses['usage']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    (__VLS_ctx.usage.length);
    (__VLS_ctx.deletable ? '（都拿掉之後才能刪除）' : '');
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
    const __VLS_0 = __VLS_tryAsConstant((__VLS_ctx.usage));
    for (const [u] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (u),
        });
        (u);
        // @ts-ignore
        [usage, usage, usage, deletable,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
