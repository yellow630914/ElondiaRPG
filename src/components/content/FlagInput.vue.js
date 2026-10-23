import { computed, ref } from 'vue';
import { cleanFlag } from '@/engine/storyFlags';
import { useContent } from '@/stores/content';
const { defineProps, defineModel, } = {};
// 劇情旗標的清單：一個一個加入，有自動完成（內容頁籤裡用過的旗標）
const model = defineModel();
const __VLS_props = defineProps();
const content = useContent();
const text = ref('');
const listId = `flags-${Math.random().toString(36).slice(2, 8)}`;
const known = computed(() => {
    void content.version;
    return content.knownFlags();
});
function add() {
    const f = cleanFlag(text.value);
    if (!f)
        return;
    const list = model.value ?? [];
    if (!list.includes(f))
        model.value = [...list, f];
    text.value = '';
}
function remove(f) {
    const list = (model.value ?? []).filter((x) => x !== f);
    model.value = list.length ? list : undefined;
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
__VLS_withDotValue(model, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "flag-input" },
});
/** @type {__VLS_StyleScopedClasses['flag-input']} */ ;
const __VLS_0 = __VLS_tryAsConstant((model.value ?? []));
for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (f),
        ...{ class: "tag chip" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['chip']} */ ;
    (f);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (remove(f));
                // @ts-ignore
                [model,];
            } },
        ...{ class: "x" },
    });
    /** @type {__VLS_StyleScopedClasses['x']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onKeydown: (add) },
    ...{ onChange: (add) },
    list: (__VLS_unwrap(listId, {})),
    placeholder: (__VLS_ctx.placeholder ?? '旗標名稱'),
    ...{ class: "flag-text" },
});
(__VLS_unwrap(text, {}));
/** @type {__VLS_StyleScopedClasses['flag-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: (__VLS_unwrap(listId, {})),
});
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(known, {})));
for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (f),
        value: (f),
    });
    // @ts-ignore
    [listId, listId, placeholder, text, known,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
