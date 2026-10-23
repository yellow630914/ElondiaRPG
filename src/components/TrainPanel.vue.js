import { computed, ref } from 'vue';
import { attrName } from '@/engine/data';
import { currentCell } from '@/engine/grid';
import { formatMoney } from '@/engine/money';
import { overcomablePerks, trainablePerks } from '@/engine/perks';
import { useGame } from '@/stores/game';
// 受訓：在這個設施花錢、花時間學特質（data/rules/perks.json 的 train）
const game = useGame();
const s = computed(() => game.state);
const pc = computed(() => s.value.party.find((m) => m.isPlayer));
// 身上的缺陷可以在這裡克服的，排在前面
const list = computed(() => [...overcomablePerks(pc.value, currentCell(s.value).kind), ...trainablePerks(pc.value, currentCell(s.value).kind)]);
const text = ref('');
function train(id) {
    void game.train(id, text.value);
    text.value = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(list, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(s, {});
void {};
/** @type {__VLS_StyleScopedClasses['train']} */ ;
/** @type {__VLS_StyleScopedClasses['train']} */ ;
/** @type {__VLS_StyleScopedClasses['train']} */ ;
if (list.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "train small" },
    });
    /** @type {__VLS_StyleScopedClasses['train']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    (list.value.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "怎麼學（選填，會寫進日誌）：例如每天天沒亮就跟著教官練",
    });
    (__VLS_unwrap(text, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_0 = __VLS_tryAsConstant((list.value));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (p.id),
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        if (p.flaw) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (p.name);
        (p.desc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(attrName, {})(p.train.attr));
        (p.train.dc);
        (p.train.hours);
        (__VLS_unwrap(formatMoney, {})(p.train.price_cc));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(list.value.length))
                        throw 0;
                    return (train(p.id));
                    // @ts-ignore
                    [list, list, list, text, attrName, formatMoney,];
                } },
            ...{ class: "small" },
            disabled: (game.value.judging || !!s.value.pendingAction || s.value.money_cc < p.train.price_cc),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        // @ts-ignore
        [game, s, s,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
