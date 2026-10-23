import { computed, onMounted, ref } from 'vue';
import { formatTime } from '@/engine/state';
import { locationById } from '@/engine/data';
import { slotTitle } from '@/stores/saves';
import { useGame } from '@/stores/game';
import NameTag from './NameTag.vue';
import { download } from './download';
const { defineEmits, } = {};
const emit = defineEmits();
const game = useGame();
const newName = ref('');
const renaming = ref(null);
const renameText = ref('');
const fileInput = ref(null);
onMounted(() => game.refreshSlots());
const KIND = { manual: '💾 手動', quick: '⚡ 快速', auto: '🔄 自動' };
const groups = computed(() => [
    { title: '手動存檔', items: game.slots.filter((m) => m.kind === 'manual') },
    { title: '快速存檔與自動存檔', items: game.slots.filter((m) => m.kind !== 'manual') },
]);
function placeName(id) {
    try {
        return locationById(id).name;
    }
    catch {
        return id;
    }
}
function when(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
async function saveNew() {
    await game.saveToSlot(newName.value);
    newName.value = '';
}
async function overwrite(m) {
    if (confirm(`用目前的進度覆寫「${m.name}」？`))
        await game.saveToSlot(m.name, m.id);
}
async function load(m) {
    if (game.state && !confirm(`讀取「${m.name}」？目前的進度會先自動存一份。`))
        return;
    // 首頁：還沒繼續的遊戲會被蓋掉
    const cur = game.resumeMeta;
    if (!game.state && cur && !confirm(`讀取「${m.name}」會蓋掉進行中的遊戲（${slotTitle(cur)}）。\n它會先備份到自動存檔欄位，之後可以再讀回來。確定讀取？`))
        return;
    await game.loadSlot(m.id);
    if (game.state)
        emit('loaded');
}
async function remove(m) {
    if (confirm(`刪除「${m.name}」？這個動作無法復原。`))
        await game.deleteSlot(m.id);
}
function startRename(m) {
    renaming.value = m.id;
    renameText.value = m.name;
}
async function saveRename(id) {
    if (renameText.value.trim())
        await game.renameSlot(id, renameText.value);
    renaming.value = null;
}
// 匯出的選項：自訂內容（預設附上，通常很小）、這一局的形象圖（圖片很大，預設不附）
const withContent = ref(true);
const withPortraitsOut = ref(false);
async function exportSlot(id) {
    try {
        const file = await game.exportFile(id, { content: withContent.value, portraits: withPortraitsOut.value });
        if (file)
            download(file.name, file.text);
    }
    catch (e) {
        game.error = `匯出失敗：${e instanceof Error ? e.message : String(e)}`;
    }
}
const queue = ref([]);
const pending = computed(() => queue.value[0]);
const withPortraitsIn = ref(true);
function resetChoices() {
    withPortraitsIn.value = true;
}
async function onFile(e) {
    const input = e.target;
    for (const f of Array.from(input.files ?? [])) {
        const text = await f.text();
        try {
            const preview = game.previewImport(text, f.name);
            if (preview.blocked)
                game.error = `匯入失敗：${preview.blocked}`;
            else if (preview.newWorld || preview.portraits)
                queue.value.push({ text, name: f.name, preview });
            else
                await game.importFile(text, f.name);
        }
        catch (err) {
            game.error = `匯入失敗：${err instanceof Error ? err.message : String(err)}`;
        }
    }
    input.value = '';
    resetChoices();
}
async function confirmImport() {
    const p = pending.value;
    if (!p)
        return;
    await game.importFile(p.text, p.name, { portraits: withPortraitsIn.value });
    queue.value.shift();
    resetChoices();
}
function skipImport() {
    queue.value.shift();
    resetChoices();
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
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(fileInput, {});
// @ts-ignore
__VLS_withDotValue(pending, {});
// @ts-ignore
__VLS_withDotValue(queue, {});
// @ts-ignore
__VLS_withDotValue(KIND, {});
// @ts-ignore
__VLS_withDotValue(renaming, {});
void {};
/** @type {__VLS_StyleScopedClasses['new']} */ ;
/** @type {__VLS_StyleScopedClasses['importing']} */ ;
/** @type {__VLS_StyleScopedClasses['importing']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "saves" },
});
/** @type {__VLS_StyleScopedClasses['saves']} */ ;
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel new" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['new']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onKeydown: (saveNew) },
        placeholder: "存檔名稱（選填，例如：進入蛇溪洞窟前）",
        maxlength: "40",
    });
    (__VLS_unwrap(newName, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (saveNew) },
        ...{ class: "primary" },
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (game.value.quickSave());
                // @ts-ignore
                [game, game, newName,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (exportSlot());
                // @ts-ignore
                [];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row tools" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['tools']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (fileInput.value?.click());
            // @ts-ignore
            [fileInput,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (onFile) },
    ref: "fileInput",
    type: "file",
    accept: ".json,application/json",
    multiple: true,
    hidden: true,
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row tools small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['tools']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_unwrap(withContent, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
    title: "這一局所有角色的形象圖；圖片很大，檔案會變大很多",
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_unwrap(withPortraitsOut, {}));
if (pending.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel importing" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['importing']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (pending.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(slotTitle, {})(pending.value.preview.meta));
    if (queue.value.length > 1) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (queue.value.length - 1);
    }
    if (pending.value.preview.newWorld) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (pending.value.preview.world?.name ?? '沒有記錄');
        (pending.value.preview.newWorld);
    }
    if (pending.value.preview.portraits) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
        });
        (__VLS_unwrap(withPortraitsIn, {}));
        (pending.value.preview.portraits);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (confirmImport) },
        ...{ class: "primary" },
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (skipImport) },
    });
}
if (!game.value.slots.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(groups, {})));
for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        key: (g.title),
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(__VLS_nonNull(null), { ...__VLS_directiveBindingRestFields, value: (g.items.length), }, __VLS_nonNull(null), __VLS_nonNull(null));
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (g.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_1 = __VLS_tryAsConstant((g.items));
    for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (m.id),
            ...{ class: "slot" },
        });
        /** @type {__VLS_StyleScopedClasses['slot']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "info" },
        });
        /** @type {__VLS_StyleScopedClasses['info']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (KIND.value[m.kind]);
        if (renaming.value === m.id) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onKeydown: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(renaming.value === m.id))
                            throw 0;
                        return (saveRename(m.id));
                        // @ts-ignore
                        [game, withContent, withPortraitsOut, pending, pending, pending, pending, pending, pending, pending, pending, slotTitle, queue, queue, withPortraitsIn, groups, KIND, renaming,];
                    } },
                maxlength: "40",
            });
            (__VLS_unwrap(renameText, {}));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(renaming.value === m.id))
                            throw 0;
                        return (saveRename(m.id));
                        // @ts-ignore
                        [renameText,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (m.name);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_2 = NameTag;
        // @ts-ignore
        const __VLS_3 = __VLS_asFunctionalComponent1(__VLS_2, new __VLS_2({
            // @ts-ignore
            name: (m.pcName), race: (m.race), cls: (m.cls),
        }));
        const __VLS_4 = __VLS_3({
            name: (m.pcName),
            race: (m.race),
            cls: (m.cls),
        }, ...__VLS_functionalComponentArgsRest(__VLS_3));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (m.level);
        (placeName(m.location));
        (__VLS_unwrap(formatTime, {})(m.time));
        (m.party);
        (m.reports);
        if (m.world) {
            (m.world);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (when(m.savedAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "actions" },
        });
        /** @type {__VLS_StyleScopedClasses['actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (load(m));
                    // @ts-ignore
                    [formatTime,];
                } },
            ...{ class: "small primary" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        if (game.value.state && m.kind === 'manual') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(game.value.state && m.kind === 'manual'))
                            throw 0;
                        return (overwrite(m));
                        // @ts-ignore
                        [game,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        if (m.kind === 'manual') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(m.kind === 'manual'))
                            throw 0;
                        return (startRename(m));
                        // @ts-ignore
                        [];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (exportSlot(m.id));
                    // @ts-ignore
                    [];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (remove(m));
                    // @ts-ignore
                    [];
                } },
            ...{ class: "small danger" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
