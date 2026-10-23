import { computed, reactive } from 'vue';
import { DEGREE_NAME } from '@/engine/checks';
import { formatMoney } from '@/engine/money';
import { openNegotiationsHere, optionText } from '@/engine/negotiation';
import { npcRecord } from '@/engine/npcs';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
import { useSettings } from '@/stores/settings';
import NameTag from './NameTag.vue';
const game = useGame();
const settings = useSettings();
const s = computed(() => game.state);
const list = computed(() => openNegotiationsHere(s.value));
const text = reactive({});
const use = reactive({});
const DEGREES = Object.keys(DEGREE_NAME);
const aiOn = computed(() => settings.aiJudge && settings.ready('negotiation'));
function free(id) {
    void game.negotiateFreely(id, text[id] ?? '', parseUse(use[id] ?? ''));
    text[id] = '';
    use[id] = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(DEGREE_NAME, {});
// @ts-ignore
__VLS_withDotValue(aiOn, {});
// @ts-ignore
__VLS_withDotValue(text, {});
// @ts-ignore
__VLS_withDotValue(use, {});
void {};
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(list, {})));
for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        key: (n.id),
        ...{ class: "panel nego" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['nego']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (n.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (game.value.abandonNegotiation(n.id));
                // @ts-ignore
                [list, game,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_1 = NameTag;
    // @ts-ignore
    const __VLS_2 = __VLS_asFunctionalComponent1(__VLS_1, new __VLS_1({
        // @ts-ignore
        id: (n.counterpart),
    }));
    const __VLS_3 = __VLS_2({
        id: (n.counterpart),
    }, ...__VLS_functionalComponentArgsRest(__VLS_2));
    (__VLS_unwrap(npcRecord, {})(s.value, n.counterpart)?.personality);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (n.goal);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (n.attempts);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain small results" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['results']} */ ;
    const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(DEGREES, {})));
    for (const [d] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (d),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (DEGREE_NAME.value[d]);
        (n.outcomes[d].text);
        // @ts-ignore
        [npcRecord, s, DEGREES, DEGREE_NAME,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (n.ai) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "options" },
    });
    /** @type {__VLS_StyleScopedClasses['options']} */ ;
    const __VLS_7 = __VLS_tryAsConstant((n.options));
    for (const [o] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (game.value.chooseOption(n.id, o.id));
                    // @ts-ignore
                    [game,];
                } },
            key: (o.id),
            ...{ class: "small option" },
            disabled: ((o.cost_cc ?? 0) > s.value.money_cc || game.value.judging),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['option']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (o.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(optionText, {})(o));
        // @ts-ignore
        [game, s, optionText,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (aiOn.value ? 'AI 看骰值判定' : '依規則判定');
    (n.base_dc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (text.value[n.id]),
        rows: "2",
        placeholder: "例如：提起上次幫他找回貨物的事，請他通融",
    });
    const __VLS_8 = AbilityPicker;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        // @ts-ignore
        modelValue: (use.value[n.id]),
    }));
    const __VLS_10 = __VLS_9({
        modelValue: (use.value[n.id]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (free(n.id));
                // @ts-ignore
                [aiOn, text, use,];
            } },
        ...{ class: "small" },
        disabled: (!(text.value[n.id] ?? '').trim() || game.value.judging),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (n.options.some((o) => o.cost_cc)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(formatMoney, {})(Math.min(...n.options.filter((o) => o.cost_cc).map((o) => o.cost_cc))));
    }
    // @ts-ignore
    [game, text, formatMoney,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
