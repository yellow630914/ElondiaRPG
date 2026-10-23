import { computed, ref } from 'vue';
import { modTotal, useContent, VANILLA, VANILLA_NAME } from '@/stores/content';
import { useGame } from '@/stores/game';
// 世界管理：好幾套自訂內容。開新遊戲時選一個，存檔記住；遊戲進行中不能切換（可以修改它的內容）
const content = useContent();
const game = useGame();
const locked = computed(() => !!game.state);
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
function switchTo(id) {
    run(() => content.switchWorld(id));
}
function createNew() {
    const name = prompt('新世界的名字（從原版開始，沒有任何自訂內容）', '新的世界');
    if (name !== null)
        run(() => content.switchWorld(content.createWorld(name)));
}
function duplicate() {
    const name = prompt('複製出來的世界叫什麼？', `${content.activeName}（複製）`);
    if (name !== null)
        run(() => {
            const id = content.createWorld(name, content.active === VANILLA ? undefined : content.active);
            if (!locked.value)
                content.switchWorld(id);
            else
                msg.value = `已複製成「${content.worldName(id)}」，回到首頁才能切換過去`;
        });
}
function rename() {
    const name = prompt('世界的名字', content.activeName);
    if (name)
        run(() => content.renameWorld(content.active, name));
}
function remove() {
    if (confirm(`刪除世界「${content.activeName}」？裡面的自訂內容會一起刪掉。用這個世界的存檔，讀檔時會用存檔附上的內容還原（沒有附上時改用原版世界）。`))
        run(() => content.deleteWorld(content.active));
}
async function importAsNew(e) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file)
        return;
    const text = await file.text();
    run(() => {
        const id = content.importMods(text, file.name.replace(/\.json$/i, ''));
        if (!locked.value)
            content.switchWorld(id);
        msg.value = `已匯入成新的世界「${content.worldName(id)}」${locked.value ? '（回到首頁才能切換過去）' : ''}`;
    });
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(content, {});
// @ts-ignore
__VLS_withDotValue(locked, {});
// @ts-ignore
__VLS_withDotValue(msg, {});
void {};
/** @type {__VLS_StyleScopedClasses['world-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['file']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel world-bar" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['world-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (switchTo($event.target.value));
        } },
    value: (content.value.active),
    disabled: (locked.value),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (__VLS_unwrap(VANILLA, {})),
});
(__VLS_unwrap(VANILLA_NAME, {}));
const __VLS_0 = __VLS_tryAsConstant((content.value.worlds));
for (const [w] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (w.id),
        value: (w.id),
    });
    (w.name);
    (__VLS_unwrap(modTotal, {})(w.mods));
    // @ts-ignore
    [content, content, locked, VANILLA, VANILLA_NAME, modTotal,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (createNew) },
    ...{ class: "small" },
    disabled: (locked.value),
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
    disabled: (content.value.readOnly),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "small file" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['file']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (importAsNew) },
    type: "file",
    accept: ".json,application/json",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (remove) },
    ...{ class: "small danger" },
    disabled: (content.value.readOnly || locked.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (locked.value) {
    (content.value.activeName);
}
else {
}
if (content.value.readOnly) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
}
if (msg.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small note" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['note']} */ ;
    (msg.value);
}
// @ts-ignore
[content, content, content, content, locked, locked, locked, msg, msg,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
