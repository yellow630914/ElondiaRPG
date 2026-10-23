import { computed, ref } from 'vue';
import { attrName, enemies } from '@/engine/data';
import { npcRecord } from '@/engine/npcs';
import { nodesHere, storyOffersHere } from '@/engine/story';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
// 特殊任務：這裡可以接的任務（公會、身邊的固定 NPC），以及這裡的任務點
const game = useGame();
const s = computed(() => game.state);
const offers = computed(() => {
    void s.value.time.minute;
    void s.value.position;
    return storyOffersHere(s.value);
});
const nodes = computed(() => {
    void s.value.time.minute;
    void s.value.position;
    void s.value.flags;
    return nodesHere(s.value);
});
const busy = computed(() => game.judging || !!s.value.pendingAction || !!s.value.combat);
const text = ref({});
const use = ref({});
function checkLabel(c) {
    return `${attrName(c.attr)}檢定・DC ${c.dc}`;
}
function foes(n) {
    return [
        ...(n.enemies ?? []).map(([id, k]) => `${enemies[id]?.name ?? id}${k > 1 ? `×${k}` : ''}`),
        ...(n.foes ?? []).map((id) => npcRecord(s.value, id)?.name ?? id),
    ].join('、');
}
function attempt(ref, option) {
    const u = parseUse(use.value[ref] ?? '');
    void game.perform({ kind: 'story', target: option === undefined ? ref : `${ref}:${option}`, text: text.value[ref] ?? '', ...(u ? { use: u } : {}) });
    text.value[ref] = '';
    use.value[ref] = '';
}
function play(ref, option) {
    game.playStoryNode(ref, option, text.value[ref]?.trim() || undefined);
    text.value[ref] = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(offers, {});
// @ts-ignore
__VLS_withDotValue(nodes, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(text, {});
// @ts-ignore
__VLS_withDotValue(use, {});
void {};
/** @type {__VLS_StyleScopedClasses['story-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
if (offers.value.length || nodes.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel story-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['story-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    const __VLS_0 = __VLS_tryAsConstant((offers.value));
    for (const [d] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (d.id),
            ...{ class: "card" },
        });
        /** @type {__VLS_StyleScopedClasses['card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        if (d.rank) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            (d.rank);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (d.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (d.start.text ?? d.summary);
        if (d.start.text) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (d.summary);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(offers.value.length || nodes.value.length))
                        throw 0;
                    return (game.value.startStory(d.id));
                    // @ts-ignore
                    [offers, offers, nodes, game,];
                } },
            ...{ class: "small primary" },
            disabled: (__VLS_unwrap(busy, {})),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        // @ts-ignore
        [busy,];
    }
    const __VLS_1 = __VLS_tryAsConstant((nodes.value));
    for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (n.ref),
            ...{ class: "card" },
        });
        /** @type {__VLS_StyleScopedClasses['card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (n.def.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (n.node.title);
        if (n.node.text) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (n.node.text);
        }
        if (n.node.kind === 'story') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(offers.value.length || nodes.value.length))
                            throw 0;
                        if (!(n.node.kind === 'story'))
                            throw 0;
                        return (play(n.ref));
                        // @ts-ignore
                        [nodes,];
                    } },
                ...{ class: "small primary" },
                disabled: (__VLS_unwrap(busy, {})),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        }
        else if (n.node.kind === 'combat') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (foes(n.node));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(offers.value.length || nodes.value.length))
                            throw 0;
                        if (!!(n.node.kind === 'story'))
                            throw 0;
                        if (!(n.node.kind === 'combat'))
                            throw 0;
                        return (play(n.ref));
                        // @ts-ignore
                        [busy,];
                    } },
                ...{ class: "small primary" },
                disabled: (__VLS_unwrap(busy, {})),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "grow" },
                placeholder: (n.node.kind === 'check' ? '怎麼做（選填；AI 判定時參考）' : '補充你的做法（選填）'),
            });
            (text.value[n.ref]);
            /** @type {__VLS_StyleScopedClasses['grow']} */ ;
            if (n.node.kind === 'check' || n.node.options?.some((o) => o.check)) {
                const __VLS_2 = AbilityPicker;
                // @ts-ignore
                const __VLS_3 = __VLS_asFunctionalComponent1(__VLS_2, new __VLS_2({
                    // @ts-ignore
                    modelValue: (use.value[n.ref]),
                }));
                const __VLS_4 = __VLS_3({
                    modelValue: (use.value[n.ref]),
                }, ...__VLS_functionalComponentArgsRest(__VLS_3));
            }
            if (n.node.kind === 'check' && n.node.check) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(offers.value.length || nodes.value.length))
                                throw 0;
                            if (!!(n.node.kind === 'story'))
                                throw 0;
                            if (!!(n.node.kind === 'combat'))
                                throw 0;
                            if (!(n.node.kind === 'check' && n.node.check))
                                throw 0;
                            return (attempt(n.ref));
                            // @ts-ignore
                            [busy, text, use,];
                        } },
                    ...{ class: "small primary" },
                    disabled: (__VLS_unwrap(busy, {})),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                (checkLabel(n.node.check));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                const __VLS_7 = __VLS_tryAsConstant((n.node.options ?? []));
                for (const [o, i] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: // @ts-ignore
                            (...[$event]) => {
                                void $event;
                                if (!(offers.value.length || nodes.value.length))
                                    throw 0;
                                if (!!(n.node.kind === 'story'))
                                    throw 0;
                                if (!!(n.node.kind === 'combat'))
                                    throw 0;
                                if (!!(n.node.kind === 'check' && n.node.check))
                                    throw 0;
                                return (o.check ? attempt(n.ref, i) : play(n.ref, i));
                                // @ts-ignore
                                [busy,];
                            } },
                        key: (i),
                        ...{ class: "small" },
                        ...{ class: ({ primary: !o.check }) },
                        disabled: (__VLS_unwrap(busy, {})),
                    });
                    /** @type {__VLS_StyleScopedClasses['small']} */ ;
                    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                    (o.label);
                    if (o.check) {
                        (checkLabel(o.check));
                    }
                    // @ts-ignore
                    [busy,];
                }
            }
        }
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
