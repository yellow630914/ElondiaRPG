import { nextTick, onMounted, ref, watch } from 'vue';
const { defineProps, defineEmits, withDefaults, } = {};
const props = withDefaults(defineProps(), { width: '960px' });
const emit = defineEmits();
const el = ref(null);
function sync() {
    const d = el.value;
    if (!d)
        return;
    if (props.open && !d.open)
        d.showModal();
    else if (!props.open && d.open)
        d.close();
}
watch(() => props.open, () => nextTick(sync));
onMounted(sync);
function onClick(e) {
    // 點到對話框外的背景才關閉
    if (e.target === el.value)
        emit('close');
}
const __VLS_defaults = { width: '960px' };
void __VLS_defaults;
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
void {};
/** @type {__VLS_StyleScopedClasses['app-dialog']} */ ;
/** @type {__VLS_StyleScopedClasses['dialog-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.dialog, __VLS_intrinsics.dialog)({
    ...{ onClose: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('close'));
            // @ts-ignore
            [emit,];
        } },
    ...{ onClick: (onClick) },
    ref: "el",
    ...{ class: "app-dialog" },
    ...{ style: ({ '--dialog-width': __VLS_ctx.width }) },
});
/** @type {__VLS_StyleScopedClasses['app-dialog']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dialog-inner" },
});
/** @type {__VLS_StyleScopedClasses['dialog-inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "dialog-head" },
});
/** @type {__VLS_StyleScopedClasses['dialog-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
if (__VLS_ctx.icon) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "icon" },
    });
    /** @type {__VLS_StyleScopedClasses['icon']} */ ;
    (__VLS_ctx.icon);
}
(__VLS_ctx.title);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('close'));
            // @ts-ignore
            [emit, width, icon, icon, title,];
        } },
    ...{ class: "small" },
    'aria-label': "關閉",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dialog-body" },
});
/** @type {__VLS_StyleScopedClasses['dialog-body']} */ ;
if (__VLS_ctx.open) {
    var __VLS_0 = {};
}
var __VLS_1 = __VLS_0;
// @ts-ignore
[open,];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
const __VLS_export = {};
export default {};
