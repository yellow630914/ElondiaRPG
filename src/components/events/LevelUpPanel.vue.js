import { computed } from 'vue';
import { useGame } from '@/stores/game';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const game = useGame();
const m = computed(() => game.state?.party.find((x) => x.id === props.id));
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
__VLS_withDotValue(m, {});
void {};
/** @type {__VLS_StyleScopedClasses['level-up']} */ ;
/** @type {__VLS_StyleScopedClasses['level-up']} */ ;
if (m.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel level-up" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['level-up']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (m.value.name);
    (m.value.level);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (m.value.pendingAbilityChoices?.length) {
        (m.value.pendingAbilityChoices.length);
    }
    if (m.value.attrPoints > 0) {
        (m.value.attrPoints);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(m.value))
                    throw 0;
                return (__VLS_unwrap(emit, {})('open-party'));
                // @ts-ignore
                [m, m, m, m, m, m, m, emit,];
            } },
        ...{ class: "small primary" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
