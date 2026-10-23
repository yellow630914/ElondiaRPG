import { computed, ref } from 'vue';
import { standoffFoes } from '@/engine/encounters';
import { tagDef } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { npcTitle } from '@/engine/npcs';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
import JudgeToggle from './JudgeToggle.vue';
import NameTag from './NameTag.vue';
// 和敵對的冒險者對峙（見 docs/NPC_SYSTEM.md 第 8.1 節）
const game = useGame();
const s = computed(() => game.state);
const standoff = computed(() => s.value.standoff);
const foes = computed(() => standoffFoes(s.value));
const busy = computed(() => game.judging || !!s.value.pendingAction);
const text = ref('');
const use = ref('');
function talk(kind) {
    const u = parseUse(use.value);
    void game.perform({ kind, target: foes.value[0].id, text: text.value, ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(tagDef, {});
// @ts-ignore
__VLS_withDotValue(standoff, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(busy, {});
// @ts-ignore
__VLS_withDotValue(s, {});
void {};
/** @type {__VLS_StyleScopedClasses['standoff']} */ ;
/** @type {__VLS_StyleScopedClasses['standoff']} */ ;
/** @type {__VLS_StyleScopedClasses['standoff']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel standoff" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['standoff']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
const __VLS_0 = JudgeToggle;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
// @ts-ignore
}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain small" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(foes, {})));
for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (f.id),
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    const __VLS_6 = NameTag;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        // @ts-ignore
        id: (f.id),
    }));
    const __VLS_8 = __VLS_7({
        id: (f.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(npcTitle, {})(f));
    (f.level);
    const __VLS_11 = __VLS_tryAsConstant(((f.tags ?? []).map(tagDef.value).filter(Boolean)));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (t.name),
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (t.emoji);
        (t.name);
        // @ts-ignore
        [foes, npcTitle, tagDef,];
    }
    // @ts-ignore
    [];
}
if (!standoff.value.detected) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!standoff.value.detected))
                    throw 0;
                return (game.value.avoidFoes());
                // @ts-ignore
                [standoff, game,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!standoff.value.detected))
                    throw 0;
                return (game.value.fightFoes());
                // @ts-ignore
                [game,];
            } },
        ...{ class: "small danger" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!standoff.value.detected))
                    throw 0;
                return (game.value.revealSelf());
                // @ts-ignore
                [game,];
            } },
        ...{ class: "small" },
        title: "之後的蒙混或威嚇檢定 +2",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(formatMoney, {})(standoff.value.demand_cc));
    if (standoff.value.revealed) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (__VLS_unwrap(text, {})),
        rows: "2",
        placeholder: "怎麼蒙混或威嚇（選填，會交給 AI 判定）",
    });
    const __VLS_12 = AbilityPicker;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        // @ts-ignore
        modelValue: (__VLS_unwrap(use, {})),
    }));
    const __VLS_14 = __VLS_13({
        modelValue: (__VLS_unwrap(use, {})),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(!standoff.value.detected))
                    throw 0;
                return (talk('bluff'));
                // @ts-ignore
                [standoff, standoff, formatMoney, text, use,];
            } },
        ...{ class: "small" },
        disabled: (busy.value),
        title: "魅力檢定：成功就放行，失敗開戰",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(!standoff.value.detected))
                    throw 0;
                return (talk('intimidate'));
                // @ts-ignore
                [busy,];
            } },
        ...{ class: "small" },
        disabled: (busy.value),
        title: "力量檢定（依雙方等級修正）：成功就放行，失敗開戰",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(!standoff.value.detected))
                    throw 0;
                return (game.value.payToll());
                // @ts-ignore
                [game, busy,];
            } },
        ...{ class: "small" },
        disabled: (busy.value || s.value.money_cc < standoff.value.demand_cc),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(formatMoney, {})(standoff.value.demand_cc));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(!standoff.value.detected))
                    throw 0;
                return (game.value.fightFoes());
                // @ts-ignore
                [standoff, standoff, game, formatMoney, busy, s,];
            } },
        ...{ class: "small danger" },
        disabled: (busy.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
// @ts-ignore
[busy,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
