import { computed, ref, watch } from 'vue';
import { affinityStage } from '@/engine/character';
import { geography, npcs as namedNpcs, stories } from '@/engine/data';
import { storyMerit } from '@/engine/guild';
import { RANK_ORDER } from '@/engine/materialQuests';
import { placeText, storyDef } from '@/engine/story';
import { newModId } from '@/engine/mods';
import { builtinStory, copyStory, flagUsage, NODE_KINDS, newNode, progressBreaks, START_KINDS, storyCheck } from '@/engine/storyMods';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import EffectsEditor from './EffectsEditor.vue';
import FlagInput from './FlagInput.vue';
import StoryNodeEditor from './StoryNodeEditor.vue';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
function current() {
    return clone(content.mods.stories[props.id] ?? stories.find((s) => s.id === props.id));
}
const draft = ref(current());
// 比較時略過空的條件（表單會先建立空的 requires 物件）
const snap = (v) => JSON.stringify(v, (k, x) => (k === 'requires' && x && !x.flags?.length && !x.flags_none?.length ? undefined : x));
const saved = ref(snap(draft.value));
watch(() => props.id, () => {
    draft.value = current();
    saved.value = snap(draft.value);
    open.value = 0;
});
const dirty = computed(() => snap(draft.value) !== saved.value);
const builtin = computed(() => !!builtinStory(props.id));
const edited = computed(() => builtin.value && !!content.mods.stories[props.id]);
const settlements = geography.locations.filter((l) => l.type !== 'dungeon');
const startReq = computed(() => (draft.value.start.requires ??= {}));
const open = ref(0);
// 錯誤擋儲存，警告只提醒（storyCheck）
const check = computed(() => {
    void content.version;
    return storyCheck(draft.value);
});
// 目前的存檔正在進行這個任務、這次修改會弄壞它的進度：擋儲存，改成複製或放棄進度
const breaks = computed(() => {
    void content.version;
    void game.state?.time.minute;
    return dirty.value && game.state ? progressBreaks(game.state, storyDef(props.id), draft.value) : [];
});
const flags = computed(() => flagUsage(draft.value));
const ICON = { story: '📜', check: '🎲', combat: '⚔️', choice: '🔀' };
function setsOf(n) {
    const outs = [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])];
    return [...new Set(outs.flatMap((o) => o?.set_flags ?? []))];
}
function ends(n) {
    const outs = [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])];
    return [outs.some((o) => o?.complete) ? '✅' : '', outs.some((o) => o?.fail_quest) ? '❌' : ''].join('');
}
function addNode() {
    draft.value.nodes.push(newNode(draft.value));
    open.value = draft.value.nodes.length - 1;
}
function move(i, d) {
    const list = draft.value.nodes;
    const j = i + d;
    if (j < 0 || j >= list.length)
        return;
    [list[i], list[j]] = [list[j], list[i]];
    open.value = j;
}
function duplicate(i) {
    const n = clone(draft.value.nodes[i]);
    n.id = `${n.id}_copy`;
    n.title = `${n.title}（複製）`.slice(0, 40);
    draft.value.nodes.splice(i + 1, 0, n);
    open.value = i + 1;
}
function removeNode(i) {
    if (!confirm(`刪除任務點「${draft.value.nodes[i].title}」？`))
        return;
    draft.value.nodes.splice(i, 1);
    open.value = null;
}
function setStartKind(kind) {
    draft.value.start = { ...draft.value.start, kind };
    if (kind !== 'npc')
        delete draft.value.start.min_affinity;
    if (kind === 'npc')
        draft.value.start.npc ??= namedNpcs[0]?.id;
    if (kind === 'guild')
        draft.value.start.location ??= 'soriel';
    if (kind === 'travel')
        draft.value.start.chance ??= 0.2;
    if (kind === 'informant')
        draft.value.start.price ??= 100;
}
function setMinAffinity(v) {
    if (v.trim() === '' || !Number.isFinite(Number(v)))
        delete draft.value.start.min_affinity;
    else
        draft.value.start.min_affinity = Math.max(-100, Math.min(100, Math.round(Number(v))));
}
// ---- 動作 ----
function save() {
    try {
        content.saveStory(props.id, draft.value);
        draft.value = current();
        saved.value = snap(draft.value);
        game.flash(`已儲存「${draft.value.title}」`);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function discard() {
    draft.value = current();
}
/** 進度會壞掉時：把修改後的內容存成新的任務，原本的任務不動 */
function saveAsCopy() {
    const id = newModId('story');
    try {
        content.saveStory(id, copyStory(draft.value, id));
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
        return;
    }
    draft.value = current();
    saved.value = snap(draft.value);
    game.flash('已複製成新的任務，原本的任務沒有改');
    emit('open', id);
}
/** 進度會壞掉時：放棄這個存檔裡的任務進度（同冒險筆記的放棄），再儲存 */
function abandonAndSave() {
    if (!confirm(`放棄目前存檔裡「${draft.value.title}」的進度後儲存？放棄後這個存檔不能再接這個任務。`))
        return;
    game.abandonStory(props.id);
    if (game.state?.stories?.[props.id]?.status === 'active')
        return;
    save();
}
function restore() {
    if (!confirm(`把「${draft.value.title}」恢復成內建的樣子？`))
        return;
    content.restoreStory(props.id);
    draft.value = current();
    saved.value = snap(draft.value);
}
// 目前存檔裡這個任務的進度：完成過的任務點 id 不能改
const progress = computed(() => game.state?.stories?.[props.id]);
const doneInSave = computed(() => new Set(progress.value?.done ?? []));
// 還有地方用到時不能刪（見 docs/CONTENT_DEPENDENCIES.md）
const usage = computed(() => {
    void content.version;
    void game.state?.time.minute;
    return content.usageOf('story', props.id);
});
function remove() {
    if (!confirm(`刪除「${draft.value.title}」？其他存檔裡進行中的這個任務會中斷（任務同行的夥伴在讀檔時離隊）。`))
        return;
    try {
        content.deleteStory(props.id);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
        return;
    }
    emit('deleted');
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
__VLS_withDotValue(draft, {});
// @ts-ignore
__VLS_withDotValue(builtin, {});
// @ts-ignore
__VLS_withDotValue(edited, {});
// @ts-ignore
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(check, {});
// @ts-ignore
__VLS_withDotValue(breaks, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
// @ts-ignore
__VLS_withDotValue(progress, {});
// @ts-ignore
__VLS_withDotValue(geography, {});
// @ts-ignore
__VLS_withDotValue(startReq, {});
// @ts-ignore
__VLS_withDotValue(open, {});
// @ts-ignore
__VLS_withDotValue(ICON, {});
// @ts-ignore
__VLS_withDotValue(NODE_KINDS, {});
// @ts-ignore
__VLS_withDotValue(doneInSave, {});
// @ts-ignore
__VLS_withDotValue(flags, {});
void {};
/** @type {__VLS_StyleScopedClasses['node-card']} */ ;
/** @type {__VLS_StyleScopedClasses['flags']} */ ;
/** @type {__VLS_StyleScopedClasses['flags']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "editor" },
});
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
(draft.value.title || '（未命名）');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag" },
});
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
(builtin.value ? (edited.value ? '內建・已修改' : '內建') : '自建');
if (dirty.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag warn" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (save) },
    ...{ class: "small primary" },
    disabled: (!dirty.value || check.value.errors.length > 0 || breaks.value.length > 0),
    title: (check.value.errors.length ? '任務鏈有錯誤，修正後才能儲存' : breaks.value.length ? '這次修改會弄壞目前存檔的任務進度' : ''),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (discard) },
    ...{ class: "small" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (builtin.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (restore) },
        ...{ class: "small" },
        disabled: (!edited.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (remove) },
        ...{ class: "small danger" },
        disabled: (usage.value.length > 0),
        title: (usage.value.length ? '還有地方用到，不能刪除' : ''),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
const __VLS_0 = UsageNote;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    usage: (usage.value), deletable: (!builtin.value),
}));
const __VLS_2 = __VLS_1({
    usage: (usage.value),
    deletable: (!builtin.value),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (progress.value?.status === 'active') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    (progress.value.done.length);
}
if (breaks.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "block-note" },
    });
    /** @type {__VLS_StyleScopedClasses['block-note']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    const __VLS_5 = __VLS_tryAsConstant((breaks.value));
    for (const [x, i] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (i),
        });
        (x);
        // @ts-ignore
        [draft, builtin, builtin, builtin, edited, edited, dirty, dirty, dirty, check, check, breaks, breaks, breaks, breaks, usage, usage, usage, progress, progress,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (saveAsCopy) },
        ...{ class: "small" },
        disabled: (check.value.errors.length > 0),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (abandonAndSave) },
        ...{ class: "small danger" },
        disabled: (check.value.errors.length > 0),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_ctx.id);
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "30",
});
(draft.value.title);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.rank),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (undefined),
});
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(RANK_ORDER, {})));
for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (r),
        value: (r),
    });
    (r);
    // @ts-ignore
    [draft, draft, check, check, id, RANK_ORDER,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "100",
    placeholder: (`預設 ${__VLS_unwrap(storyMerit, {})()}`),
});
(draft.value.merit);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.summary),
    rows: "2",
    maxlength: "300",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setStartKind($event.target.value));
            // @ts-ignore
            [draft, draft, storyMerit,];
        } },
    value: (draft.value.start.kind),
});
const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(START_KINDS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [draft, START_KINDS,];
}
if (draft.value.start.kind === 'guild' || draft.value.start.kind === 'informant') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    (draft.value.start.kind === 'guild' ? '哪座城鎮的公會' : '哪座城鎮的情報商');
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.start.location),
    });
    if (draft.value.start.kind === 'informant') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (undefined),
        });
    }
    const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(settlements, {})));
    for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (l.id),
            value: (l.id),
        });
        (l.name);
        // @ts-ignore
        [draft, draft, draft, draft, draft, settlements,];
    }
}
if (draft.value.start.kind === 'npc') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.start.npc),
    });
    const __VLS_9 = __VLS_tryAsConstant((__VLS_unwrap(namedNpcs, {})));
    for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (n.id),
            value: (n.id),
        });
        (n.name);
        // @ts-ignore
        [draft, draft, namedNpcs,];
    }
}
if (draft.value.start.kind === 'npc') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.start.kind === 'npc'))
                    throw 0;
                return (setMinAffinity($event.target.value));
                // @ts-ignore
                [draft,];
            } },
        type: "number",
        min: "-100",
        max: "100",
        placeholder: "不限",
        value: (draft.value.start.min_affinity ?? ''),
    });
    if (draft.value.start.min_affinity !== undefined) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(affinityStage, {})(draft.value.start.min_affinity));
    }
}
if (draft.value.start.kind === 'travel') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(draft.value.start.kind === 'travel'))
                    throw 0;
                return (draft.value.start.chance = Number($event.target.value) / 100);
                // @ts-ignore
                [draft, draft, draft, draft, draft, affinityStage,];
            } },
        type: "number",
        min: "1",
        max: "100",
        value: (Math.round((draft.value.start.chance ?? 0.2) * 100)),
    });
}
if (draft.value.start.kind === 'informant') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
    });
    (draft.value.start.price);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
    max: "20",
    placeholder: "不限",
});
(draft.value.start.min_level);
if (draft.value.start.kind === 'travel') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    const __VLS_10 = __VLS_tryAsConstant((geography.value.regions));
    for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (r.id),
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.start.kind === 'travel'))
                        throw 0;
                    return (draft.value.start.regions = $event.target.checked ? [...(draft.value.start.regions ?? []), r.id] : (draft.value.start.regions ?? []).filter((x) => x !== r.id));
                    // @ts-ignore
                    [draft, draft, draft, draft, draft, draft, draft, draft, geography,];
                } },
            type: "checkbox",
            checked: (draft.value.start.regions?.includes(r.id)),
        });
        (r.name);
        // @ts-ignore
        [draft,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.start.text),
    rows: "2",
    maxlength: "400",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_11 = FlagInput;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
    // @ts-ignore
    modelValue: (startReq.value.flags),
}));
const __VLS_13 = __VLS_12({
    modelValue: (startReq.value.flags),
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_16 = FlagInput;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
    // @ts-ignore
    modelValue: (startReq.value.flags_none),
}));
const __VLS_18 = __VLS_17({
    modelValue: (startReq.value.flags_none),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_21 = FlagInput;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
    // @ts-ignore
    modelValue: (draft.value.start_flags),
}));
const __VLS_23 = __VLS_22({
    modelValue: (draft.value.start_flags),
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
(draft.value.nodes.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
const __VLS_26 = __VLS_tryAsConstant((draft.value.nodes));
for (const [n, i] of __VLS_vFor(__VLS_nonNull(__VLS_26))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "node-card" },
        ...{ class: ({ open: open.value === i }) },
    });
    /** @type {__VLS_StyleScopedClasses['node-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['open']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (open.value = open.value === i ? null : i);
                // @ts-ignore
                [draft, draft, draft, draft, startReq, startReq, open, open, open,];
            } },
        ...{ class: "row node-head" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['node-head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (ICON.value[n.kind]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    (n.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (NODE_KINDS.value[n.kind]);
    (__VLS_unwrap(placeText, {})(n));
    const __VLS_27 = __VLS_tryAsConstant((n.requires?.flags ?? []));
    for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_27))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (`r-${f}`),
            ...{ class: "tag small" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (f);
        // @ts-ignore
        [ICON, NODE_KINDS, placeText,];
    }
    const __VLS_28 = __VLS_tryAsConstant((setsOf(n)));
    for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_28))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (`s-${f}`),
            ...{ class: "tag small set" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['set']} */ ;
        (f);
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (ends(n));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (move(i, -1));
                // @ts-ignore
                [];
            } },
        ...{ class: "small" },
        title: "往上",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (move(i, 1));
                // @ts-ignore
                [];
            } },
        ...{ class: "small" },
        title: "往下",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (duplicate(i));
                // @ts-ignore
                [];
            } },
        ...{ class: "small" },
        title: "複製",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (removeNode(i));
                // @ts-ignore
                [];
            } },
        ...{ class: "small" },
        title: "刪除",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (open.value === i) {
        const __VLS_29 = StoryNodeEditor;
        // @ts-ignore
        const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
            // @ts-ignore
            modelValue: (draft.value.nodes[i]), lockedId: (doneInSave.value.has(draft.value.nodes[i].id)),
        }));
        const __VLS_31 = __VLS_30({
            modelValue: (draft.value.nodes[i]),
            lockedId: (doneInSave.value.has(draft.value.nodes[i].id)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    }
    // @ts-ignore
    [draft, draft, open, doneInSave,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addNode) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
const __VLS_34 = EffectsEditor;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
    // @ts-ignore
    modelValue: (draft.value.rewards),
}));
const __VLS_36 = __VLS_35({
    modelValue: (draft.value.rewards),
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
if (!check.value.errors.length && !check.value.warnings.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
if (check.value.errors.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "small warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
    const __VLS_39 = __VLS_tryAsConstant((check.value.errors));
    for (const [x, i] of __VLS_vFor(__VLS_nonNull(__VLS_39))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (i),
        });
        (x);
        // @ts-ignore
        [draft, check, check, check, check,];
    }
}
if (check.value.warnings.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    const __VLS_40 = __VLS_tryAsConstant((check.value.warnings));
    for (const [x, i] of __VLS_vFor(__VLS_nonNull(__VLS_40))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (i),
        });
        (x);
        // @ts-ignore
        [check, check,];
    }
}
if (flags.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "flags small" },
    });
    /** @type {__VLS_StyleScopedClasses['flags']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    const __VLS_41 = __VLS_tryAsConstant((flags.value));
    for (const [u] of __VLS_vFor(__VLS_nonNull(__VLS_41))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (u.flag),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (u.flag);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (u.setBy.join('、') || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (u.clearedBy.join('、') || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (u.requiredBy.join('、') || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (u.blockedBy.join('、') || '—');
        // @ts-ignore
        [flags, flags,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
