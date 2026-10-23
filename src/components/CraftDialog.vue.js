import { computed, ref } from 'vue';
import { craftRules } from '@/engine/data';
import { CRAFT_IDS, crafters, skillOf, xpToNext } from '@/engine/crafting';
import { useGame } from '@/stores/game';
import CraftPanel from './CraftPanel.vue';
import RecipePanel from './RecipePanel.vue';
import InventPanel from './InventPanel.vue';
const { defineEmits, } = {};
const emit = defineEmits();
const game = useGame();
const s = computed(() => game.state);
const who = computed(() => crafters(s.value));
const tab = ref('recipe');
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
__VLS_withDotValue(craftRules, {});
// @ts-ignore
__VLS_withDotValue(tab, {});
void {};
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "crafts" },
});
/** @type {__VLS_StyleScopedClasses['crafts']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "table" },
});
/** @type {__VLS_StyleScopedClasses['table']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(CRAFT_IDS, {})));
for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        key: (c),
    });
    (craftRules.value.skills[c].name);
    // @ts-ignore
    [CRAFT_IDS, craftRules,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(who, {})));
for (const [w] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (w.member.id),
        ...{ class: ({ off: !!w.refusal }) },
    });
    /** @type {__VLS_StyleScopedClasses['off']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        title: (w.refusal),
    });
    (w.member.name);
    if (w.refusal) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (w.refusal);
    }
    const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(CRAFT_IDS, {})));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            key: (c),
        });
        (__VLS_unwrap(skillOf, {})(w.member, c).level);
        if (__VLS_unwrap(xpToNext, {})(__VLS_unwrap(skillOf, {})(w.member, c).level)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(skillOf, {})(w.member, c).xp);
            (__VLS_unwrap(xpToNext, {})(__VLS_unwrap(skillOf, {})(w.member, c).level));
        }
        // @ts-ignore
        [CRAFT_IDS, who, skillOf, skillOf, skillOf, skillOf, xpToNext, xpToNext,];
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(craftRules.value.companion.min_affinity);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tabs" },
});
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (tab.value = 'recipe');
            // @ts-ignore
            [craftRules, tab,];
        } },
    ...{ class: ({ active: tab.value === 'recipe' }) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (tab.value = 'invent');
            // @ts-ignore
            [tab, tab,];
        } },
    ...{ class: ({ active: tab.value === 'invent' }) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (tab.value = 'gear');
            // @ts-ignore
            [tab, tab,];
        } },
    ...{ class: ({ active: tab.value === 'gear' }) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (tab.value === 'recipe') {
    const __VLS_3 = RecipePanel;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent1(__VLS_3, new __VLS_3({
        // @ts-ignore
        ...{ 'onStarted': {} },
    }));
    const __VLS_5 = __VLS_4({
        ...{ 'onStarted': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    let __VLS_8;
    const __VLS_9 = {
        /** @type {typeof __VLS_8.started} */
        onStarted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!(tab.value === 'recipe'))
                throw 0;
            return (__VLS_unwrap(emit, {})('close'));
            // @ts-ignore
            [tab, tab, emit,];
        },
    };
    void __VLS_9;
    var __VLS_6;
    var __VLS_7;
}
else if (tab.value === 'invent') {
    const __VLS_10 = InventPanel;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        // @ts-ignore
        ...{ 'onStarted': {} },
    }));
    const __VLS_12 = __VLS_11({
        ...{ 'onStarted': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    let __VLS_15;
    const __VLS_16 = {
        /** @type {typeof __VLS_15.started} */
        onStarted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(tab.value === 'recipe'))
                throw 0;
            if (!(tab.value === 'invent'))
                throw 0;
            return (__VLS_unwrap(emit, {})('close'));
            // @ts-ignore
            [tab, emit,];
        },
    };
    void __VLS_16;
    var __VLS_13;
    var __VLS_14;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    const __VLS_17 = CraftPanel;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
        // @ts-ignore
        ...{ 'onStarted': {} }, mode: "make",
    }));
    const __VLS_19 = __VLS_18({
        ...{ 'onStarted': {} },
        mode: "make",
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    let __VLS_22;
    const __VLS_23 = {
        /** @type {typeof __VLS_22.started} */
        onStarted: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!!(tab.value === 'recipe'))
                throw 0;
            if (!!(tab.value === 'invent'))
                throw 0;
            return (__VLS_unwrap(emit, {})('close'));
            // @ts-ignore
            [emit,];
        },
    };
    void __VLS_23;
    var __VLS_20;
    var __VLS_21;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
