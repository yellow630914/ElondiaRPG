import { computed, ref, watch } from 'vue';
import { useGame } from '@/stores/game';
import AppDialog from '../AppDialog.vue';
import DefeatEventPanel from '../DefeatEventPanel.vue';
import MasterEventPanel from '../MasterEventPanel.vue';
import StandoffPanel from '../StandoffPanel.vue';
import LevelUpPanel from './LevelUpPanel.vue';
import MarkingPanel from './MarkingPanel.vue';
import PerkOfferPanel from './PerkOfferPanel.vue';
import RoadEventPanel from './RoadEventPanel.vue';
import SuggestionPanel from './SuggestionPanel.vue';
import { activeEvents, eventDialogOpen, snoozed } from './eventQueue';
const { defineEmits, } = {};
const emit = defineEmits();
const game = useGame();
const events = computed(() => activeEvents(game.state));
const current = computed(() => events.value[0]);
const next = computed(() => events.value.slice(1));
// 出現新的事件就打開；升級選了一部分（剩下的能力或屬性點變少）不算新的事件，免得蓋住正在用的隊伍視窗
const seen = ref(new Set());
const levelUpLeft = new Map();
function isFresh(e) {
    if (e.kind !== 'levelup')
        return !seen.value.has(e.id);
    const [, member, level, choices, points] = e.id.split(':');
    const key = `${member}:${level}`;
    const left = Number(choices) + Number(points);
    const before = levelUpLeft.get(key);
    levelUpLeft.set(key, left);
    return before === undefined || left > before;
}
watch(events, (list) => {
    const fresh = list.filter(isFresh);
    if (fresh.length) {
        seen.value = new Set([...seen.value, ...fresh.map((e) => e.id)]);
        eventDialogOpen.value = true;
    }
    if (!list.length)
        eventDialogOpen.value = false;
}, { immediate: true });
// 被擋住（撞到「先回應主人的要求」之類）時再打開
watch(() => game.bump, () => {
    if (events.value.some((e) => e.blocking))
        eventDialogOpen.value = true;
});
function later() {
    const e = current.value;
    if (!e || e.blocking)
        return;
    snoozed.value = new Set([...snoozed.value, e.id]);
}
function openParty() {
    eventDialogOpen.value = false;
    emit('open-party');
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
__VLS_withDotValue(eventDialogOpen, {});
// @ts-ignore
__VLS_withDotValue(current, {});
// @ts-ignore
__VLS_withDotValue(events, {});
// @ts-ignore
__VLS_withDotValue(next, {});
void {};
/** @type {__VLS_StyleScopedClasses['event-center']} */ ;
const __VLS_0 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (eventDialogOpen.value && !!current.value), title: (events.value.length > 1 ? `需要你處理的事（還有 ${events.value.length - 1} 件）` : '需要你處理的事'), icon: "🔔", width: "720px",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClose': {} },
    open: (eventDialogOpen.value && !!current.value),
    title: (events.value.length > 1 ? `需要你處理的事（還有 ${events.value.length - 1} 件）` : '需要你處理的事'),
    icon: "🔔",
    width: "720px",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = {
    /** @type {typeof __VLS_5.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        __VLS_withDotValue(eventDialogOpen, {});
        return (eventDialogOpen.value = false);
        // @ts-ignore
        [eventDialogOpen, eventDialogOpen, current, events, events,];
    },
};
void __VLS_6;
const { default: __VLS_7 } = __VLS_nonNull(__VLS_3.slots);
if (current.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "event-center" },
    });
    /** @type {__VLS_StyleScopedClasses['event-center']} */ ;
    if (current.value.kind === 'defeat') {
        const __VLS_8 = DefeatEventPanel;
        // @ts-ignore
        const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        // @ts-ignore
        }));
        const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
    }
    else if (current.value.kind === 'standoff') {
        const __VLS_13 = StandoffPanel;
        // @ts-ignore
        const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({
        // @ts-ignore
        }));
        const __VLS_15 = __VLS_14({}, ...__VLS_functionalComponentArgsRest(__VLS_14));
    }
    else if (current.value.kind === 'mark') {
        const __VLS_18 = MarkingPanel;
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
        // @ts-ignore
        }));
        const __VLS_20 = __VLS_19({}, ...__VLS_functionalComponentArgsRest(__VLS_19));
    }
    else if (current.value.kind === 'master') {
        const __VLS_23 = MasterEventPanel;
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent1(__VLS_23, new __VLS_23({
        // @ts-ignore
        }));
        const __VLS_25 = __VLS_24({}, ...__VLS_functionalComponentArgsRest(__VLS_24));
    }
    else if (current.value.kind === 'road') {
        const __VLS_28 = RoadEventPanel;
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
        // @ts-ignore
        }));
        const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
    }
    else if (current.value.kind === 'suggestion') {
        const __VLS_33 = SuggestionPanel;
        // @ts-ignore
        const __VLS_34 = __VLS_asFunctionalComponent1(__VLS_33, new __VLS_33({
            // @ts-ignore
            id: (current.value.ref),
        }));
        const __VLS_35 = __VLS_34({
            id: (current.value.ref),
        }, ...__VLS_functionalComponentArgsRest(__VLS_34));
    }
    else if (current.value.kind === 'levelup') {
        const __VLS_38 = LevelUpPanel;
        // @ts-ignore
        const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({
            // @ts-ignore
            ...{ 'onOpenParty': {} }, id: (current.value.ref),
        }));
        const __VLS_40 = __VLS_39({
            ...{ 'onOpenParty': {} },
            id: (current.value.ref),
        }, ...__VLS_functionalComponentArgsRest(__VLS_39));
        let __VLS_43;
        const __VLS_44 = {
            /** @type {typeof __VLS_43.openParty} */
            onOpenParty: (openParty),
        };
        void __VLS_44;
        var __VLS_41;
        var __VLS_42;
    }
    else if (current.value.kind === 'perk') {
        const __VLS_45 = PerkOfferPanel;
        // @ts-ignore
        const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
            // @ts-ignore
            refid: (current.value.ref),
        }));
        const __VLS_47 = __VLS_46({
            refid: (current.value.ref),
        }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row foot" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['foot']} */ ;
    if (current.value.blocking) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (later) },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        if (current.value.kind === 'suggestion') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        __VLS_withDotValue(eventDialogOpen, {});
                        if (!(current.value))
                            throw 0;
                        if (!!(current.value.blocking))
                            throw 0;
                        if (!(current.value.kind === 'suggestion'))
                            throw 0;
                        eventDialogOpen.value = false;
                        __VLS_unwrap(emit, {})('open-relations');
                        // @ts-ignore
                        [eventDialogOpen, current, current, current, current, current, current, current, current, current, current, current, current, current, current, emit,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
    }
    if (next.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (next.value.map((e) => `${e.icon} ${e.title}`).join('・'));
    }
}
// @ts-ignore
[next, next,];
var __VLS_3;
var __VLS_4;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
