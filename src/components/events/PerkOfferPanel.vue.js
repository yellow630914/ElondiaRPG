import { computed, ref } from 'vue';
import { attrName, perkDef, perkRules } from '@/engine/data';
import { perkPower } from '@/engine/perks';
import { useGame } from '@/stores/game';
import { useSettings } from '@/stores/settings';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const settings = useSettings();
const memberId = computed(() => props.refid.split(':')[0]);
const offerId = computed(() => props.refid.split(':')[1]);
const m = computed(() => game.state?.party.find((x) => x.id === memberId.value));
const offer = computed(() => m.value?.perkOffers?.find((o) => o.id === offerId.value));
const options = computed(() => (offer.value?.options ?? []).map((id) => perkDef(id)).filter((d) => !!d));
const aiOn = computed(() => settings.aiJudge && settings.ready('judge'));
const canPitch = computed(() => !!offer.value?.pitch && !offer.value.pitched);
const text = ref('');
const p = perkRules.pitch;
function pitch() {
    if (!text.value.trim())
        return;
    void game.pitchPerk(memberId.value, offerId.value, text.value);
    text.value = '';
}
function decline() {
    if (confirm('放棄這次學特質的機會？'))
        game.declinePerk(memberId.value, offerId.value);
}
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
__VLS_withDotValue(m, {});
// @ts-ignore
__VLS_withDotValue(offer, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(options, {});
// @ts-ignore
__VLS_withDotValue(canPitch, {});
// @ts-ignore
__VLS_withDotValue(aiOn, {});
// @ts-ignore
__VLS_withDotValue(p, {});
// @ts-ignore
__VLS_withDotValue(text, {});
void {};
/** @type {__VLS_StyleScopedClasses['perk-offer']} */ ;
/** @type {__VLS_StyleScopedClasses['perk-offer']} */ ;
/** @type {__VLS_StyleScopedClasses['options']} */ ;
/** @type {__VLS_StyleScopedClasses['pitch']} */ ;
if (m.value && offer.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel perk-offer small" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['perk-offer']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (m.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (offer.value.source);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain options" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    /** @type {__VLS_StyleScopedClasses['options']} */ ;
    const __VLS_0 = __VLS_tryAsConstant((options.value));
    for (const [d] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (d.id),
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
        (d.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(perkPower, {})(d));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (d.desc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(m.value && offer.value))
                        throw 0;
                    return (game.value.learnPerk(__VLS_unwrap(memberId, {}), __VLS_unwrap(offerId, {}), d.id));
                    // @ts-ignore
                    [m, m, offer, offer, options, perkPower, game, memberId, offerId,];
                } },
            ...{ class: "small primary" },
            disabled: (game.value.judging || !!game.value.state?.pendingAction),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        // @ts-ignore
        [game, game,];
    }
    if (!options.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    if (canPitch.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pitch" },
        });
        /** @type {__VLS_StyleScopedClasses['pitch']} */ ;
        if (aiOn.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(attrName, {})(p.value.attr));
            (p.value.dc);
            __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
                value: (text.value),
                rows: "3",
                maxlength: "400",
                placeholder: (`例如「這幾年跟著商隊跑遍各地，${m.value.name}比起打架，更懂得怎麼跟人討價還價」`),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (pitch) },
                ...{ class: "small" },
                disabled: (!text.value.trim() || game.value.judging || !!game.value.state?.pendingAction),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
    }
    else if (offer.value.pitched) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (decline) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
// @ts-ignore
[m, offer, options, game, game, canPitch, aiOn, attrName, p, p, text, text,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
