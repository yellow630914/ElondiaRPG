import { ref } from 'vue';
import { usePrompts } from '@/stores/prompts';
// 提示詞管理：好幾組提示詞（文風、其他提示詞、世界書的修改），隨時可以切換
const prompts = usePrompts();
const msg = ref('');
function run(fn) {
    msg.value = '';
    try {
        fn();
    }
    catch (e) {
        msg.value = e instanceof Error ? e.message : String(e);
    }
}
function createNew() {
    const name = prompt('新提示詞組的名字（從預設內容開始）', '新的提示詞組');
    if (name !== null)
        run(() => prompts.switchSet(prompts.createSet(name)));
}
function duplicate() {
    const name = prompt('複製出來的提示詞組叫什麼？', `${prompts.activeName}（複製）`);
    if (name !== null)
        run(() => prompts.switchSet(prompts.createSet(name, prompts.active)));
}
function rename() {
    const name = prompt('提示詞組的名字', prompts.activeName);
    if (name)
        run(() => prompts.renameSet(prompts.active, name));
}
function remove() {
    if (confirm(`刪除提示詞組「${prompts.activeName}」？`))
        run(() => prompts.deleteSet(prompts.active));
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(prompts, {});
// @ts-ignore
__VLS_withDotValue(msg, {});
void {};
/** @type {__VLS_StyleScopedClasses['set-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel set-bar" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['set-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (prompts.value.switchSet($event.target.value));
            // @ts-ignore
            [prompts,];
        } },
    value: (prompts.value.active),
});
const __VLS_0 = __VLS_tryAsConstant((prompts.value.sets));
for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (x.id),
        value: (x.id),
    });
    (x.name);
    // @ts-ignore
    [prompts, prompts,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (createNew) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (duplicate) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (rename) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (remove) },
    ...{ class: "small danger" },
    disabled: (prompts.value.sets.length <= 1),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (msg.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    (msg.value);
}
// @ts-ignore
[prompts, msg, msg,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
