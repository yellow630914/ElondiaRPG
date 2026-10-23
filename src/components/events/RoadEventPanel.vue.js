import { computed } from 'vue';
import { attrName } from '@/engine/data';
import { roadTemplate } from '@/engine/road';
import { useGame } from '@/stores/game';
// 旅途上的事件：出發時就擲好放在格子上，走到時要選一個應付的方式
const game = useGame();
const pending = computed(() => (game.state?.roadEvent ? roadTemplate(game.state.roadEvent.template) : undefined));
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(pending, {});
// @ts-ignore
__VLS_withDotValue(game, {});
void {};
/** @type {__VLS_StyleScopedClasses['road-event']} */ ;
/** @type {__VLS_StyleScopedClasses['road-event']} */ ;
/** @type {__VLS_StyleScopedClasses['road-event']} */ ;
if (pending.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel road-event" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['road-event']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (pending.value.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (pending.value.text);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    const __VLS_0 = __VLS_tryAsConstant((pending.value.options ?? []));
    for (const [o, i] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(pending.value))
                        throw 0;
                    return (game.value.answerRoadEvent(i));
                    // @ts-ignore
                    [pending, pending, pending, pending, game,];
                } },
            key: (i),
            ...{ class: "small" },
            disabled: (game.value.judging),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (o.label);
        if (o.check) {
            (__VLS_unwrap(attrName, {})(o.check.attr));
            (o.check.dc);
        }
        // @ts-ignore
        [game, attrName,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
