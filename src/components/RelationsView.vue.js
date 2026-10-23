import { computed, reactive, ref } from 'vue';
import { affinityStage } from '@/engine/character';
import { locationById, npcs } from '@/engine/data';
import { formatTime } from '@/engine/state';
import { useGame } from '@/stores/game';
import NameTag from './NameTag.vue';
import { canPromote } from '@/engine/promoteNpc';
import { useContent, VANILLA_NAME } from '@/stores/content';
import PortraitBox from './PortraitBox.vue';
const game = useGame();
const content = useContent();
const s = computed(() => game.state);
// 生成的人存成固定 NPC（存進目前的世界）
function promotable(id) {
    void content.version;
    return canPromote(s.value, id);
}
function promote(id, name) {
    if (!confirm(`把「${name}」存成目前世界的固定 NPC？之後可以在內容頁籤的「固定 NPC」編輯。`))
        return;
    game.promoteNpc(id);
    if (!game.error)
        game.flash(`已把「${name}」存成固定 NPC`);
}
const rels = computed(() => Object.values(s.value.relationships ?? {}));
const pcName = computed(() => s.value.party.find((m) => m.isPlayer)?.name ?? '主角');
function nameOf(id) {
    if (id === 'pc')
        return pcName.value;
    // 還沒認識的人：從存檔裡的 NPC 或固定 NPC 名單找名字
    return s.value.relationships?.[id]?.name ?? s.value.npcs?.[id]?.name ?? npcs.find((n) => n.id === id)?.name ?? id;
}
// ---- 人際關係編輯 ----
const editing = ref(null);
const draft = reactive({ appearance: '', toPlayer: '', aliases: '', others: [] });
function startEdit(r) {
    editing.value = r.id;
    draft.appearance = r.appearance;
    draft.toPlayer = r.toPlayer;
    draft.aliases = (r.aliases ?? []).join('、');
    draft.others = Object.entries(r.toOthers).map(([id, text]) => ({ id, text }));
}
function saveEdit(id) {
    game.editRelationship(id, {
        appearance: draft.appearance.trim(),
        toPlayer: draft.toPlayer.trim(),
        aliases: draft.aliases.split(/[、,，]/).map((x) => x.trim()),
        toOthers: Object.fromEntries(draft.others.map((o) => [o.id, o.text.trim()])),
    });
    editing.value = null;
}
function affinityPct(v) {
    return `${(v + 100) / 2}%`;
}
// ---- 共同記憶 ----
const filterPerson = ref('');
const filterLocation = ref('');
const memories = computed(() => [...(s.value.memories ?? [])]
    .filter((m) => !filterPerson.value || m.participants.includes(filterPerson.value))
    .filter((m) => !filterLocation.value || m.location === filterLocation.value)
    .reverse());
const memoryLocations = computed(() => [...new Set((s.value.memories ?? []).map((m) => m.location))]);
const editingMemory = ref(null);
const memoryDraft = ref('');
function editSummary(m) {
    editingMemory.value = m.id;
    memoryDraft.value = m.summary;
}
function saveSummary(id) {
    game.editMemory(id, { summary: memoryDraft.value.trim() });
    editingMemory.value = null;
}
function removeMemory(id) {
    if (confirm('刪除這段記憶？'))
        game.deleteMemory(id);
}
const newMemory = reactive({ summary: '', participants: [], importance: 2 });
function addMemory() {
    if (!newMemory.summary.trim())
        return;
    game.addMemory({
        time: { ...s.value.time },
        location: s.value.location,
        participants: ['pc', ...newMemory.participants],
        summary: newMemory.summary.trim(),
        importance: newMemory.importance,
    });
    newMemory.summary = '';
    newMemory.participants = [];
}
const STARS = { 1: '★', 2: '★★', 3: '★★★' };
// ---- AI 提議的關係更新 ----
const suggestions = computed(() => s.value.suggestions ?? []);
const suggestionDraft = reactive({});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(rels, {});
// @ts-ignore
__VLS_withDotValue(suggestions, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(suggestionDraft, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(editing, {});
// @ts-ignore
__VLS_withDotValue(content, {});
// @ts-ignore
__VLS_withDotValue(draft, {});
// @ts-ignore
__VLS_withDotValue(newMemory, {});
// @ts-ignore
__VLS_withDotValue(memories, {});
// @ts-ignore
__VLS_withDotValue(STARS, {});
// @ts-ignore
__VLS_withDotValue(editingMemory, {});
void {};
/** @type {__VLS_StyleScopedClasses['affinity']} */ ;
/** @type {__VLS_StyleScopedClasses['edit']} */ ;
/** @type {__VLS_StyleScopedClasses['add']} */ ;
/** @type {__VLS_StyleScopedClasses['suggestion']} */ ;
/** @type {__VLS_StyleScopedClasses['summary']} */ ;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "layout" },
});
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (rels.value.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted small" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
if (suggestions.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "suggestions" },
    });
    /** @type {__VLS_StyleScopedClasses['suggestions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(pcName, {}));
    const __VLS_0 = __VLS_tryAsConstant((suggestions.value));
    for (const [sg] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (sg.id),
            ...{ class: "suggestion small" },
        });
        /** @type {__VLS_StyleScopedClasses['suggestion']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        const __VLS_1 = NameTag;
        // @ts-ignore
        const __VLS_2 = __VLS_asFunctionalComponent1(__VLS_1, new __VLS_1({
            // @ts-ignore
            id: (sg.npc),
        }));
        const __VLS_3 = __VLS_2({
            id: (sg.npc),
        }, ...__VLS_functionalComponentArgsRest(__VLS_2));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (s.value.relationships?.[sg.npc]?.toPlayer);
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (suggestionDraft.value[sg.id]),
            rows: "2",
            placeholder: (sg.text),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(suggestions.value.length))
                        throw 0;
                    return (game.value.acceptSuggestion(sg.id, suggestionDraft.value[sg.id] || sg.text));
                    // @ts-ignore
                    [rels, suggestions, suggestions, pcName, s, suggestionDraft, suggestionDraft, game,];
                } },
            ...{ class: "small primary" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(suggestions.value.length))
                        throw 0;
                    return (game.value.rejectSuggestion(sg.id));
                    // @ts-ignore
                    [game,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        // @ts-ignore
        [];
    }
}
const __VLS_6 = __VLS_tryAsConstant((rels.value));
for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        key: (r.id),
        ...{ class: "rel" },
    });
    /** @type {__VLS_StyleScopedClasses['rel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    const __VLS_7 = NameTag;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        // @ts-ignore
        id: (r.id),
    }));
    const __VLS_9 = __VLS_8({
        id: (r.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(affinityStage, {})(r.affinity));
    (r.affinity);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "affinity" },
    });
    /** @type {__VLS_StyleScopedClasses['affinity']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ style: ({ left: affinityPct(r.affinity) }) },
    });
    if (game.value.state) {
        const __VLS_12 = PortraitBox;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
            // @ts-ignore
            id: (r.id), size: "small",
        }));
        const __VLS_14 = __VLS_13({
            id: (r.id),
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    if (editing.value !== r.id) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (r.appearance || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
        (__VLS_unwrap(pcName, {}));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
        (r.toPlayer || '—');
        if (Object.keys(r.toOthers).length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
            const __VLS_17 = __VLS_tryAsConstant((r.toOthers));
            for (const [text, id] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (id),
                });
                (nameOf(String(id)));
                (text);
                // @ts-ignore
                [rels, pcName, game, affinityStage, editing,];
            }
        }
        if (r.aliases?.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
            (r.aliases.join('、'));
        }
        if (r.firstMet) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({});
            (__VLS_unwrap(formatTime, {})(r.firstMet.time));
            (__VLS_unwrap(locationById, {})(r.firstMet.location).name);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(editing.value !== r.id))
                        throw 0;
                    return (startEdit(r));
                    // @ts-ignore
                    [formatTime, locationById,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        if (promotable(r.id)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(editing.value !== r.id))
                            throw 0;
                        if (!(promotable(r.id)))
                            throw 0;
                        return (promote(r.id, r.name));
                        // @ts-ignore
                        [];
                    } },
                ...{ class: "small" },
                disabled: (content.value.readOnly),
                title: (content.value.readOnly ? `${__VLS_unwrap(VANILLA_NAME, {})}不能修改：要先建立自己的世界，再用那個世界開始遊戲` : '把這個人目前的樣子（能力值、技能、特質、裝備、出沒的地方）存進目前的世界，之後可以在內容頁籤編輯；親密度與記憶延續'),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
            ...{ onSubmit: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(editing.value !== r.id))
                        throw 0;
                    return (saveEdit(r.id));
                    // @ts-ignore
                    [content, content, VANILLA_NAME,];
                } },
            ...{ class: "edit small" },
        });
        /** @type {__VLS_StyleScopedClasses['edit']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (draft.value.appearance),
            rows: "2",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        (__VLS_unwrap(pcName, {}));
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (draft.value.toPlayer),
            rows: "2",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
        (draft.value.aliases);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        const __VLS_18 = __VLS_tryAsConstant((draft.value.others));
        for (const [o, i] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (i),
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (o.id),
            });
            const __VLS_19 = __VLS_tryAsConstant((rels.value.filter((x) => x.id !== r.id)));
            for (const [other] of __VLS_vFor(__VLS_nonNull(__VLS_19))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (other.id),
                    value: (other.id),
                });
                (other.name);
                // @ts-ignore
                [rels, pcName, draft, draft, draft, draft,];
            }
            if (!rels.value.some((x) => x.id === o.id)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: (o.id),
                });
                (nameOf(o.id));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ style: {} },
            });
            (o.text);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(editing.value !== r.id))
                            throw 0;
                        return (draft.value.others.splice(i, 1));
                        // @ts-ignore
                        [rels, draft,];
                    } },
                type: "button",
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            // @ts-ignore
            [];
        }
        if (rels.value.length > 1) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(editing.value !== r.id))
                            throw 0;
                        if (!(rels.value.length > 1))
                            throw 0;
                        return (draft.value.others.push({ id: rels.value.find((x) => x.id !== r.id).id, text: '' }));
                        // @ts-ignore
                        [rels, rels, draft,];
                    } },
                type: "button",
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ class: "small primary" },
            type: "submit",
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(editing.value !== r.id))
                        throw 0;
                    return (editing.value = null);
                    // @ts-ignore
                    [editing,];
                } },
            ...{ class: "small" },
            type: "button",
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row filters small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(filterPerson, {})),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_20 = __VLS_tryAsConstant((rels.value));
for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_20))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (r.id),
        value: (r.id),
    });
    (r.name);
    // @ts-ignore
    [rels, filterPerson,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(filterLocation, {})),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_21 = __VLS_tryAsConstant((__VLS_unwrap(memoryLocations, {})));
for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_21))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (id),
        value: (id),
    });
    (__VLS_unwrap(locationById, {})(id).name);
    // @ts-ignore
    [locationById, filterLocation, memoryLocations,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
    ...{ class: "add small" },
});
/** @type {__VLS_StyleScopedClasses['add']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (newMemory.value.summary),
    rows: "2",
    placeholder: "例如：在河谷鎮的舊石橋上，莉娜第一次說出自己怕水的原因。",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
const __VLS_22 = __VLS_tryAsConstant((rels.value));
for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_22))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (r.id),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        value: (r.id),
    });
    (newMemory.value.participants);
    (r.name);
    // @ts-ignore
    [rels, newMemory, newMemory,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (newMemory.value.importance),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (1),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (2),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (3),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addMemory) },
    ...{ class: "small primary" },
    disabled: (!newMemory.value.summary.trim()),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
(__VLS_unwrap(formatTime, {})(s.value.time));
(__VLS_unwrap(locationById, {})(s.value.location).name);
if (memories.value.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted small" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
const __VLS_23 = __VLS_tryAsConstant((memories.value));
for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_23))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (m.id),
        ...{ class: "memory" },
    });
    /** @type {__VLS_StyleScopedClasses['memory']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small meta" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['meta']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_unwrap(formatTime, {})(m.time));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (m.scene ?? __VLS_unwrap(locationById, {})(m.location).name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (m.participants.map(nameOf).join('、'));
    if (m.merged) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
            title: "記憶超過 200 筆時，舊的日常記憶會合併成摘要",
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (m.merged);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "spacer" },
    });
    /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (game.value.editMemory(m.id, { importance: ((m.importance % 3) + 1) }));
                // @ts-ignore
                [s, s, game, formatTime, formatTime, locationById, locationById, newMemory, newMemory, memories, memories,];
            } },
        ...{ class: "small star" },
        title: ('重要程度：' + ['', '日常', '重要', '難忘'][m.importance]),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['star']} */ ;
    (STARS.value[m.importance]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (game.value.editMemory(m.id, { pinned: !m.pinned }));
                // @ts-ignore
                [game, STARS,];
            } },
        ...{ class: "small" },
        ...{ class: ({ pinned: m.pinned }) },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['pinned']} */ ;
    (m.pinned ? '已釘選' : '釘選');
    if (editingMemory.value !== m.id) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(editingMemory.value !== m.id))
                        throw 0;
                    return (editSummary(m));
                    // @ts-ignore
                    [editingMemory,];
                } },
            ...{ class: "summary" },
        });
        /** @type {__VLS_StyleScopedClasses['summary']} */ ;
        (m.summary);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_unwrap(memoryDraft, {})),
            rows: "2",
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(editingMemory.value !== m.id))
                        throw 0;
                    return (saveSummary(m.id));
                    // @ts-ignore
                    [memoryDraft,];
                } },
            ...{ class: "small primary" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(editingMemory.value !== m.id))
                        throw 0;
                    return (removeMemory(m.id));
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
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
