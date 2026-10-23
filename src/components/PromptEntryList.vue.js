import { computed, ref } from 'vue';
import { estimateTokens, PROMPT_TARGETS, TARGET_NAME } from '@/narrator/promptConfig';
import { useGame } from '@/stores/game';
import { usePrompts } from '@/stores/prompts';
import { useSettings } from '@/stores/settings';
import { dateStamp, download } from './download';
const { defineProps, } = {};
const props = defineProps();
const prompts = usePrompts();
const game = useGame();
const settings = useSettings();
const fileInput = ref(null);
const label = computed(() => (props.list === 'styles' ? '文風' : '提示詞'));
function exportList(onlyEnabled) {
    const name = props.list === 'styles' ? 'styles' : 'prompts';
    download(`elondia-${name}${onlyEnabled ? '-enabled' : ''}-${dateStamp()}.json`, prompts.exportEntries(props.list, onlyEnabled));
}
async function onImport(e) {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    input.value = '';
    let added = 0;
    let skipped = 0;
    try {
        for (const f of files) {
            const r = prompts.importEntries(props.list, await f.text(), f.name);
            added += r.added;
            skipped += r.skipped;
        }
        game.flash(`已匯入 ${added} 個${label.value}${skipped ? `，略過 ${skipped} 個重複的` : ''}`);
    }
    catch (err) {
        game.error = `匯入${label.value}失敗：${err instanceof Error ? err.message : String(err)}`;
    }
}
const entries = computed(() => prompts.config[props.list]);
const open = ref(null);
const TARGETS = PROMPT_TARGETS;
function toggleTarget(e, t) {
    e.targets = e.targets.includes(t) ? e.targets.filter((x) => x !== t) : [...e.targets, t];
}
function add() {
    open.value = prompts.addEntry(props.list).id;
}
function remove(e) {
    if (confirm(`刪除「${e.name}」？`))
        prompts.removeEntry(props.list, e.id);
}
function changed(e) {
    const p = prompts.presetOf(props.list, e);
    return !!p && (p.content !== e.content || p.name !== e.name);
}
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
// @ts-ignore
__VLS_withDotValue(TARGET_NAME, {});
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(prompts, {});
// @ts-ignore
__VLS_withDotValue(entries, {});
// @ts-ignore
__VLS_withDotValue(fileInput, {});
void {};
/** @type {__VLS_StyleScopedClasses['name']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain entries" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['entries']} */ ;
const __VLS_0 = __VLS_tryAsConstant((entries.value));
for (const [e, i] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (e.id),
        ...{ class: ({ off: !e.enabled }) },
    });
    /** @type {__VLS_StyleScopedClasses['off']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "head row" },
    });
    /** @type {__VLS_StyleScopedClasses['head']} */ ;
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "switch" },
        title: (e.enabled ? '已開啟' : '已關閉'),
    });
    /** @type {__VLS_StyleScopedClasses['switch']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (e.enabled);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "order small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['order']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (i + 1);
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (open.value = open.value === e.id ? null : e.id);
                // @ts-ignore
                [entries, open, open,];
            } },
        ...{ class: "name" },
    });
    /** @type {__VLS_StyleScopedClasses['name']} */ ;
    (e.name || '未命名');
    const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(TARGETS, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (t),
            ...{ class: "tag" },
            ...{ class: ({ dim: !e.targets.includes(t) }) },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['dim']} */ ;
        (TARGET_NAME.value[t]);
        // @ts-ignore
        [TARGETS, TARGET_NAME,];
    }
    if (__VLS_ctx.list === 'custom') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        ((e.position ?? 'system') === 'system' ? '前段' : '後段');
    }
    if (e.adult) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
            ...{ class: ({ dim: !settings.value.adult }) },
            title: (settings.value.adult ? '成人向：已開啟成人向，會送出' : '成人向：設定沒有開啟成人向，不會送出'),
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['dim']} */ ;
    }
    if (e.preset) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
            title: (changed(e) ? '內建條目，已修改' : '內建條目'),
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (changed(e) ? '・已改' : '');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (e.content.length);
    (__VLS_unwrap(estimateTokens, {})(e.content));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tools row" },
    });
    /** @type {__VLS_StyleScopedClasses['tools']} */ ;
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (prompts.value.moveEntry(__VLS_ctx.list, e.id, -1));
                // @ts-ignore
                [list, list, settings, settings, estimateTokens, prompts,];
            } },
        ...{ class: "small" },
        disabled: (i === 0),
        title: "往前",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (prompts.value.moveEntry(__VLS_ctx.list, e.id, 1));
                // @ts-ignore
                [list, prompts,];
            } },
        ...{ class: "small" },
        disabled: (i === entries.value.length - 1),
        title: "往後",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (open.value = open.value === e.id ? null : e.id);
                // @ts-ignore
                [entries, open, open,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (open.value === e.id ? '收起' : '✏️ 編輯');
    if (open.value === e.id) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "editor" },
        });
        /** @type {__VLS_StyleScopedClasses['editor']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "40",
        });
        (e.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row small" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(TARGETS, {})));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (t),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(open.value === e.id))
                            throw 0;
                        return (toggleTarget(e, t));
                        // @ts-ignore
                        [open, open, TARGETS,];
                    } },
                type: "checkbox",
                checked: (e.targets.includes(t)),
            });
            (TARGET_NAME.value[t]);
            // @ts-ignore
            [TARGET_NAME,];
        }
        if (__VLS_ctx.list === 'custom') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "radio",
                value: "system",
            });
            (e.position);
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "radio",
                value: "end",
            });
            (e.position);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "check" },
            title: "只在設定開啟成人向時送出",
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(open.value === e.id))
                        throw 0;
                    return (e.adult = $event.target.checked || undefined);
                    // @ts-ignore
                    [list,];
                } },
            checked: (!!e.adult),
            type: "checkbox",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (e.content),
            rows: "8",
            placeholder: "寫給 AI 的指示。可以用 {{player}} 代表主角名字。",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(open.value === e.id))
                        throw 0;
                    return (prompts.value.duplicateEntry(__VLS_ctx.list, e.id));
                    // @ts-ignore
                    [list, prompts,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        if (e.preset) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(open.value === e.id))
                            throw 0;
                        if (!(e.preset))
                            throw 0;
                        return (prompts.value.restoreEntry(__VLS_ctx.list, e.id));
                        // @ts-ignore
                        [list, prompts,];
                    } },
                ...{ class: "small" },
                disabled: (!changed(e)),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(open.value === e.id))
                        throw 0;
                    return (remove(e));
                    // @ts-ignore
                    [];
                } },
            ...{ class: "small danger" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    }
    // @ts-ignore
    [];
}
if (!entries.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted small" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (add) },
    ...{ class: "primary small" },
});
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(__VLS_ctx.list === 'styles' ? '文風' : '提示詞');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (prompts.value.restorePresets(__VLS_ctx.list));
            // @ts-ignore
            [entries, list, list, prompts,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (exportList(false));
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
            return (exportList(true));
            // @ts-ignore
            [];
        } },
    ...{ class: "small" },
    disabled: (!entries.value.some((e) => e.enabled)),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (fileInput.value?.click());
            // @ts-ignore
            [entries, fileInput,];
        } },
    ...{ class: "small" },
    title: "本遊戲匯出的 JSON，或純文字／Markdown（整份當一個條目，檔名當名稱）",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (onImport) },
    ref: "fileInput",
    type: "file",
    accept: ".json,.txt,.md,application/json,text/plain,text/markdown",
    multiple: true,
    hidden: true,
});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(label, {}));
// @ts-ignore
[label,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
