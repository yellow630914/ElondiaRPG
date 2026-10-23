import { computed } from 'vue';
import { locationById } from '@/engine/data';
import { currentArea, currentCell } from '@/engine/grid';
import { formatMoney } from '@/engine/money';
import { roadProgress, roadTemplate } from '@/engine/road';
import { MODE_NAME } from '@/engine/travel';
import { useGame } from '@/stores/game';
import { eventDialogOpen } from './events/eventQueue';
// 旅途：單行道一格一天往前走；事件出發時就擲好放在格子上（❔ 事件、⚔️ 戰鬥）
const game = useGame();
const s = computed(() => game.state);
const progress = computed(() => {
    void s.value.time.hour;
    return roadProgress(s.value);
});
const cell = computed(() => currentCell(s.value));
const area = computed(() => currentArea(s.value));
const atEnd = computed(() => position.value >= area.value.width - 1);
const position = computed(() => s.value.position?.x ?? 0);
const pending = computed(() => (s.value.roadEvent ? roadTemplate(s.value.roadEvent.template) : undefined));
const busy = computed(() => !!s.value.roadEvent || !!s.value.combat || !!s.value.pendingMasterEvent || !!s.value.standoff || !!s.value.pendingAction || game.judging);
const legs = computed(() => [...new Set((s.value.road?.modes ?? []).map((m) => MODE_NAME[m]))].join('、'));
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(progress, {});
// @ts-ignore
__VLS_withDotValue(cell, {});
// @ts-ignore
__VLS_withDotValue(pending, {});
// @ts-ignore
__VLS_withDotValue(eventDialogOpen, {});
// @ts-ignore
__VLS_withDotValue(area, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(busy, {});
void {};
/** @type {__VLS_StyleScopedClasses['road-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['road-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['event']} */ ;
if (progress.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel road-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['road-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (__VLS_unwrap(locationById, {})(progress.value.to).name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (progress.value.day);
    (progress.value.days);
    (__VLS_unwrap(legs, {}));
    if (cell.value.town) {
        (cell.value.kind === 'waypoint' ? '途經' : '從');
        (__VLS_unwrap(locationById, {})(cell.value.town).name);
        (cell.value.kind === 'waypoint' ? '' : '出發');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (progress.value.money < 0 ? `食宿與船資 ${__VLS_unwrap(formatMoney, {})(-progress.value.money)}` : '沒有花費');
    if (progress.value.recent.length > 1) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain small muted recent" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['recent']} */ ;
        const __VLS_0 = __VLS_tryAsConstant((progress.value.recent.slice(1)));
        for (const [t, i] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (i),
            });
            (t);
            // @ts-ignore
            [progress, progress, progress, progress, progress, progress, progress, progress, locationById, locationById, legs, cell, cell, cell, cell, formatMoney,];
        }
    }
    if (pending.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "event" },
        });
        /** @type {__VLS_StyleScopedClasses['event']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (pending.value.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    __VLS_withDotValue(eventDialogOpen, {});
                    if (!(progress.value))
                        throw 0;
                    if (!(pending.value))
                        throw 0;
                    return (eventDialogOpen.value = true);
                    // @ts-ignore
                    [pending, pending, eventDialogOpen,];
                } },
            ...{ class: "small primary" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    }
    else if (area.value.kind !== 'road') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (area.value.name);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(progress.value))
                        throw 0;
                    if (!!(pending.value))
                        throw 0;
                    if (!!(area.value.kind !== 'road'))
                        throw 0;
                    return (game.value.move(1, 0));
                    // @ts-ignore
                    [area, area, game,];
                } },
            ...{ class: "primary" },
            disabled: (busy.value || __VLS_unwrap(atEnd, {})),
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(progress.value))
                        throw 0;
                    if (!!(pending.value))
                        throw 0;
                    if (!!(area.value.kind !== 'road'))
                        throw 0;
                    return (game.value.walkRoad());
                    // @ts-ignore
                    [game, busy, atEnd,];
                } },
            disabled: (busy.value || __VLS_unwrap(atEnd, {})),
            title: "遇到事件、戰鬥或抵達時停下",
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
// @ts-ignore
[busy, atEnd,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
