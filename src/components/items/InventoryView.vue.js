import { computed, reactive, ref } from 'vue';
import { itemRules } from '@/engine/data';
import { canEquip, canUse, isIntelItem } from '@/engine/inventory';
import { formatMoney } from '@/engine/money';
import { itemValue } from '@/engine/trade';
import { useGame } from '@/stores/game';
import { CATEGORY_ICON, CATEGORY_ORDER, categoryIcon, categoryName, categoryOf, itemEffect, itemText } from './itemInfo';
// 行囊：依類別篩選，使用、裝備（戰鬥以外）
const game = useGame();
const s = computed(() => game.state);
const inCombat = computed(() => !!s.value.combat);
const filter = ref('all');
const items = computed(() => s.value.inventory.filter((i) => i.qty > 0));
const counts = computed(() => {
    const out = {};
    for (const i of items.value) {
        const c = categoryOf(s.value, i.name);
        if (c)
            out[c] = (out[c] ?? 0) + 1;
    }
    return out;
});
const shown = computed(() => items.value.filter((i) => filter.value === 'all' || categoryOf(s.value, i.name) === filter.value));
const target = reactive({});
const value = (name) => itemValue(s.value, name);
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(items, {});
// @ts-ignore
__VLS_withDotValue(filter, {});
// @ts-ignore
__VLS_withDotValue(counts, {});
// @ts-ignore
__VLS_withDotValue(CATEGORY_ICON, {});
// @ts-ignore
__VLS_withDotValue(itemRules, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(target, {});
// @ts-ignore
__VLS_withDotValue(inCombat, {});
void {};
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "inventory" },
});
/** @type {__VLS_StyleScopedClasses['inventory']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_unwrap(formatMoney, {})(s.value.money_cc));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(items.value.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "row tabs" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (filter.value = 'all');
            // @ts-ignore
            [formatMoney, s, items, filter,];
        } },
    ...{ class: "small" },
    ...{ class: ({ active: filter.value === 'all' }) },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
(items.value.length);
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(CATEGORY_ORDER, {})));
for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.template)({
        key: (c),
    });
    if (counts.value[c]) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(counts.value[c]))
                        throw 0;
                    return (filter.value = c);
                    // @ts-ignore
                    [items, filter, filter, CATEGORY_ORDER, counts,];
                } },
            ...{ class: "small" },
            ...{ class: ({ active: filter.value === c }) },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (CATEGORY_ICON.value[c]);
        (itemRules.value.categories[c]);
        (counts.value[c]);
    }
    // @ts-ignore
    [filter, counts, CATEGORY_ICON, itemRules,];
}
if (!items.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted small" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain grid" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(shown, {})));
for (const [i] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (i.name),
        ...{ class: "item" },
    });
    /** @type {__VLS_StyleScopedClasses['item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row top" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['top']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "icon" },
    });
    /** @type {__VLS_StyleScopedClasses['icon']} */ ;
    (__VLS_unwrap(categoryIcon, {})(s.value, i.name));
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    (i.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "qty" },
    });
    /** @type {__VLS_StyleScopedClasses['qty']} */ ;
    (i.qty);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(categoryName, {})(s.value, i.name));
    if (__VLS_unwrap(value, {})(i.name) !== undefined) {
        (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(value, {})(i.name)));
    }
    if (__VLS_unwrap(itemEffect, {})(s.value, i.name)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small effect" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['effect']} */ ;
        (__VLS_unwrap(itemEffect, {})(s.value, i.name));
    }
    if (__VLS_unwrap(itemText, {})(s.value, i.name)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(itemText, {})(s.value, i.name));
    }
    if (__VLS_unwrap(isIntelItem, {})(s.value, i.name)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row actions" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(__VLS_unwrap(isIntelItem, {})(s.value, i.name)))
                        throw 0;
                    return (game.value.readIntel(i.name));
                    // @ts-ignore
                    [formatMoney, s, s, s, s, s, s, s, items, shown, categoryIcon, categoryName, value, value, itemEffect, itemEffect, itemText, itemText, isIntelItem, game,];
                } },
            ...{ class: "small" },
            disabled: (inCombat.value),
            title: "記進冒險筆記（和向情報商買情報一樣），用掉這件情報",
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    else if (__VLS_unwrap(canUse, {})(i.name) || __VLS_unwrap(canEquip, {})(s.value, i.name)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row actions" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(__VLS_unwrap(isIntelItem, {})(s.value, i.name)))
                        throw 0;
                    if (!(__VLS_unwrap(canUse, {})(i.name) || __VLS_unwrap(canEquip, {})(s.value, i.name)))
                        throw 0;
                    return (target.value[i.name] = $event.target.value);
                    // @ts-ignore
                    [s, inCombat, canUse, canEquip, target,];
                } },
            value: (target.value[i.name] ?? s.value.party[0]?.id),
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_2 = __VLS_tryAsConstant((s.value.party));
        for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (m.id),
                value: (m.id),
            });
            (m.name);
            // @ts-ignore
            [s, s, target,];
        }
        if (__VLS_unwrap(canUse, {})(i.name)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(__VLS_unwrap(isIntelItem, {})(s.value, i.name)))
                            throw 0;
                        if (!(__VLS_unwrap(canUse, {})(i.name) || __VLS_unwrap(canEquip, {})(s.value, i.name)))
                            throw 0;
                        if (!(__VLS_unwrap(canUse, {})(i.name)))
                            throw 0;
                        return (game.value.useItem(i.name, target.value[i.name] ?? s.value.party[0].id));
                        // @ts-ignore
                        [s, game, canUse, target,];
                    } },
                ...{ class: "small" },
                disabled: (inCombat.value),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        if (__VLS_unwrap(canEquip, {})(s.value, i.name)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(__VLS_unwrap(isIntelItem, {})(s.value, i.name)))
                            throw 0;
                        if (!(__VLS_unwrap(canUse, {})(i.name) || __VLS_unwrap(canEquip, {})(s.value, i.name)))
                            throw 0;
                        if (!(__VLS_unwrap(canEquip, {})(s.value, i.name)))
                            throw 0;
                        return (game.value.equipItem(i.name, target.value[i.name] ?? s.value.party[0].id));
                        // @ts-ignore
                        [s, s, game, inCombat, canEquip, target,];
                    } },
                ...{ class: "small" },
                disabled: (inCombat.value),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
    }
    // @ts-ignore
    [inCombat,];
}
if (inCombat.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
// @ts-ignore
[inCombat,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
