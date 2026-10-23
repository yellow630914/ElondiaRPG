import { computed } from 'vue';
import { locationById } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { alertLevel, factionName, fineDue, isWanted, reputationBand, reputationOf, securityRules } from '@/engine/security';
import { useGame } from '@/stores/game';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const s = computed(() => game.state);
const loc = computed(() => locationById(s.value.location));
const alert = computed(() => alertLevel(s.value));
const wanted = computed(() => isWanted(s.value, loc.value.faction));
const due = computed(() => fineDue(s.value));
const rep = computed(() => reputationOf(s.value, loc.value.faction));
const band = computed(() => reputationBand(s.value));
const pct = (n) => `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`;
const blockedToday = computed(() => s.value.gateBlock?.[loc.value.id] === s.value.time.day);
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
__VLS_withDotValue(loc, {});
// @ts-ignore
__VLS_withDotValue(band, {});
// @ts-ignore
__VLS_withDotValue(wanted, {});
// @ts-ignore
__VLS_withDotValue(alert, {});
// @ts-ignore
__VLS_withDotValue(securityRules, {});
// @ts-ignore
__VLS_withDotValue(blockedToday, {});
// @ts-ignore
__VLS_withDotValue(due, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(s, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "guard small" },
});
/** @type {__VLS_StyleScopedClasses['guard']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (loc.value.faction) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(factionName, {})(loc.value.faction));
    (__VLS_unwrap(rep, {}));
    if (band.value.buy || band.value.sell) {
        (__VLS_unwrap(pct, {})(band.value.buy));
        (__VLS_unwrap(pct, {})(band.value.sell));
    }
}
if (wanted.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "bad" },
    });
    /** @type {__VLS_StyleScopedClasses['bad']} */ ;
    (__VLS_unwrap(factionName, {})(loc.value.faction));
}
else if (alert.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "warn" },
    });
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
    (alert.value);
    (securityRules.value.alert.max);
    (securityRules.value.alert.gate_dc_base + securityRules.value.alert.gate_dc_per_level * alert.value);
    if (blockedToday.value) {
    }
    (securityRules.value.alert.decay_days);
}
if (due.value.amount && props.canPay) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(due.value.amount && props.canPay))
                    throw 0;
                return (game.value.payFine());
                // @ts-ignore
                [loc, loc, loc, factionName, factionName, rep, band, band, band, band, pct, pct, wanted, alert, alert, alert, securityRules, securityRules, securityRules, securityRules, blockedToday, due, game,];
            } },
        ...{ class: "small" },
        ...{ class: ({ primary: wanted.value || blockedToday.value }) },
        disabled: (s.value.money_cc < due.value.amount),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    (due.value.wanted ? '通緝' : '警戒');
    (__VLS_unwrap(formatMoney, {})(due.value.amount));
    if (s.value.money_cc < due.value.amount) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
}
// @ts-ignore
[wanted, blockedToday, due, due, due, due, s, s, formatMoney,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
