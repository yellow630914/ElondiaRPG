import { computed, reactive, ref } from 'vue';
import { itemRules, shopDef } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { npcRecord } from '@/engine/npcs';
import { costText, dealMoney, discount, effectText, isItemDeal, keeperTitle, sellPrice, shopKey } from '@/engine/trade';
import { useGame } from '@/stores/game';
import NameTag from '../NameTag.vue';
import { CATEGORY_ICON, CATEGORY_ORDER, categoryIcon, categoryName, categoryOf, itemEffect, itemText } from './itemInfo';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const s = computed(() => game.state);
const key = computed(() => shopKey(s.value, props.type));
const shop = computed(() => {
    const cur = s.value.shops?.[key.value];
    return cur && cur.day === s.value.time.day ? cur : undefined;
});
const keeper = computed(() => (shop.value ? npcRecord(s.value, shop.value.keeper) : undefined));
const off = computed(() => Math.round(discount(s.value, key.value) * 100));
const busy = computed(() => game.judging);
/** 最近一次交易的結果（顯示在視窗上方） */
const last = ref('');
const itemName = (d) => d.id.slice('item:'.length);
const groupOf = (d) => (isItemDeal(d) ? categoryOf(s.value, itemName(d)) ?? 'special' : 'special');
const deals = computed(() => shop.value?.deals.filter((d) => d.stock > 0) ?? []);
const groups = computed(() => {
    const set = new Set(deals.value.map(groupOf));
    return [...CATEGORY_ORDER.filter((c) => set.has(c)), ...(set.has('special') ? ['special'] : [])];
});
const filter = ref('all');
const shownDeals = computed(() => deals.value.filter((d) => filter.value === 'all' || groupOf(d) === filter.value));
const groupName = (g) => (g === 'special' ? '✨ 特別交易' : `${CATEGORY_ICON[g]} ${itemRules.categories[g]}`);
const buyQty = reactive({});
const qtyOf = (d) => Math.max(1, Math.min(d.stock, Math.floor(buyQty[d.id] ?? 1) || 1));
const price = (d) => dealMoney(s.value, key.value, d);
function affordable(d, n = 1) {
    if (s.value.money_cc < price(d) * n)
        return false;
    return d.gives.every((g) => g.type !== 'item' || (s.value.inventory.find((i) => i.name === g.name)?.qty ?? 0) >= (g.qty ?? 1) * n);
}
// ---- 交涉 ----
const haggling = ref(null);
const haggleText = reactive({});
async function bargain(d) {
    haggling.value = null;
    const before = s.value.reports.length;
    last.value = '交涉中…';
    await game.bargain(props.type, d.id, haggleText[d.id] ?? '');
    const r = s.value.reports.length > before ? s.value.reports[s.value.reports.length - 1] : undefined;
    last.value = r?.outcome.summary ?? '';
}
// ---- 行囊 ----
const buysText = computed(() => shopDef(props.type).buys.map((c) => itemRules.categories[c]).join('、'));
const onlySellable = ref(true);
const bag = computed(() => s.value.inventory
    .filter((i) => i.qty > 0)
    .map((i) => ({ ...i, price: sellPrice(s.value, key.value, i.name) }))
    .filter((i) => !onlySellable.value || i.price !== null)
    .sort((a, b) => Number(b.price !== null) - Number(a.price !== null)));
const sellQty = reactive({});
const sellN = (name, have) => Math.max(1, Math.min(have, Math.floor(sellQty[name] ?? 1) || 1));
// ---- 結果 ----
function done(r) {
    if (r)
        last.value = r.outcome.summary ?? '';
}
function buy(d) {
    done(game.buyDeal(props.type, d.id, isItemDeal(d) ? qtyOf(d) : 1));
    buyQty[d.id] = 1;
}
function sell(name, have) {
    done(game.sellItem(props.type, name, sellN(name, have)));
    sellQty[name] = 1;
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
__VLS_withDotValue(keeper, {});
// @ts-ignore
__VLS_withDotValue(off, {});
// @ts-ignore
__VLS_withDotValue(shop, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(last, {});
// @ts-ignore
__VLS_withDotValue(filter, {});
// @ts-ignore
__VLS_withDotValue(deals, {});
// @ts-ignore
__VLS_withDotValue(buyQty, {});
// @ts-ignore
__VLS_withDotValue(busy, {});
// @ts-ignore
__VLS_withDotValue(haggling, {});
// @ts-ignore
__VLS_withDotValue(haggleText, {});
// @ts-ignore
__VLS_withDotValue(buysText, {});
// @ts-ignore
__VLS_withDotValue(bag, {});
// @ts-ignore
__VLS_withDotValue(onlySellable, {});
// @ts-ignore
__VLS_withDotValue(sellQty, {});
void {};
/** @type {__VLS_StyleScopedClasses['cols']} */ ;
/** @type {__VLS_StyleScopedClasses['col']} */ ;
/** @type {__VLS_StyleScopedClasses['chips']} */ ;
/** @type {__VLS_StyleScopedClasses['entry']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shop-dialog" },
});
/** @type {__VLS_StyleScopedClasses['shop-dialog']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shop-bar" },
});
/** @type {__VLS_StyleScopedClasses['shop-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (keeper.value) {
    (__VLS_unwrap(keeperTitle, {})(__VLS_ctx.type));
    const __VLS_0 = NameTag;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        // @ts-ignore
        id: (keeper.value.id),
    }));
    const __VLS_2 = __VLS_1({
        id: (keeper.value.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (keeper.value.personality);
}
if (off.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag ok" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['ok']} */ ;
    (off.value);
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
else if (shop.value?.source === 'ai') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
    ...{ class: "money" },
});
/** @type {__VLS_StyleScopedClasses['money']} */ ;
(__VLS_unwrap(formatMoney, {})(s.value.money_cc));
if (game.value.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "error small" },
    });
    /** @type {__VLS_StyleScopedClasses['error']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (game.value.error);
}
else if (last.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "last small" },
    });
    /** @type {__VLS_StyleScopedClasses['last']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (last.value);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "cols" },
});
/** @type {__VLS_StyleScopedClasses['cols']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "col" },
});
/** @type {__VLS_StyleScopedClasses['col']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "row chips" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['chips']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (filter.value = 'all');
            // @ts-ignore
            [keeper, keeper, keeper, keeperTitle, type, off, off, loading, shop, formatMoney, s, game, game, last, last, filter,];
        } },
    ...{ class: "small" },
    ...{ class: ({ active: filter.value === 'all' }) },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
(deals.value.length);
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(groups, {})));
for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (filter.value = g);
                // @ts-ignore
                [filter, filter, deals, groups,];
            } },
        key: (g),
        ...{ class: "small" },
        ...{ class: ({ active: filter.value === g }) },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    (__VLS_unwrap(groupName, {})(g));
    // @ts-ignore
    [filter, groupName,];
}
if (!deals.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain list" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['list']} */ ;
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(shownDeals, {})));
for (const [d] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (d.id),
        ...{ class: "entry" },
    });
    /** @type {__VLS_StyleScopedClasses['entry']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row top" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['top']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "icon" },
    });
    /** @type {__VLS_StyleScopedClasses['icon']} */ ;
    (__VLS_unwrap(isItemDeal, {})(d) ? __VLS_unwrap(categoryIcon, {})(s.value, __VLS_unwrap(itemName, {})(d)) : '✨');
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    (d.title);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "price" },
    });
    /** @type {__VLS_StyleScopedClasses['price']} */ ;
    (__VLS_unwrap(costText, {})(s.value, __VLS_unwrap(key, {}), d));
    if (__VLS_unwrap(isItemDeal, {})(d)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(categoryName, {})(s.value, __VLS_unwrap(itemName, {})(d)));
        if (__VLS_unwrap(itemEffect, {})(s.value, __VLS_unwrap(itemName, {})(d))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "effect" },
            });
            /** @type {__VLS_StyleScopedClasses['effect']} */ ;
            (__VLS_unwrap(itemEffect, {})(s.value, __VLS_unwrap(itemName, {})(d)));
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small effect" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['effect']} */ ;
        (d.gets.map((g) => __VLS_unwrap(effectText, {})(s.value, g, shop.value?.keeper)).join('、'));
    }
    if (d.desc || (__VLS_unwrap(isItemDeal, {})(d) && __VLS_unwrap(itemText, {})(s.value, __VLS_unwrap(itemName, {})(d)))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (d.desc ?? __VLS_unwrap(itemText, {})(s.value, __VLS_unwrap(itemName, {})(d)));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row actions" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['actions']} */ ;
    if (d.stock < 20) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (d.stock);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    if (__VLS_unwrap(isItemDeal, {})(d) && d.stock > 1) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "num" },
            type: "number",
            min: "1",
            max: (d.stock),
            placeholder: "1",
        });
        (buyQty.value[d.id]);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (buy(d));
                // @ts-ignore
                [shop, s, s, s, s, s, s, s, s, deals, shownDeals, isItemDeal, isItemDeal, isItemDeal, isItemDeal, categoryIcon, itemName, itemName, itemName, itemName, itemName, itemName, costText, key, categoryName, itemEffect, itemEffect, effectText, itemText, itemText, buyQty,];
            } },
        ...{ class: "small primary" },
        disabled: (busy.value || !affordable(d, __VLS_unwrap(isItemDeal, {})(d) ? __VLS_unwrap(qtyOf, {})(d) : 1)),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    (__VLS_unwrap(isItemDeal, {})(d) && __VLS_unwrap(qtyOf, {})(d) > 1 ? `買 ${__VLS_unwrap(qtyOf, {})(d)} 個（${__VLS_unwrap(formatMoney, {})(__VLS_unwrap(price, {})(d) * __VLS_unwrap(qtyOf, {})(d))}）` : '買下');
    if (__VLS_unwrap(price, {})(d) > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(__VLS_unwrap(price, {})(d) > 0))
                        throw 0;
                    return (haggling.value = haggling.value === d.id ? null : d.id);
                    // @ts-ignore
                    [formatMoney, isItemDeal, isItemDeal, busy, qtyOf, qtyOf, qtyOf, qtyOf, price, price, haggling, haggling,];
                } },
            ...{ class: "small" },
            disabled: (d.haggled || busy.value),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (d.haggled ? '已交涉過' : '交涉');
    }
    if (haggling.value === d.id) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "grow" },
            placeholder: "怎麼交涉？例如：挑出瑕疵、搬出熟人、請店主喝一杯",
        });
        (haggleText.value[d.id]);
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(haggling.value === d.id))
                        throw 0;
                    return (bargain(d));
                    // @ts-ignore
                    [busy, haggling, haggleText,];
                } },
            ...{ class: "small" },
            disabled: (busy.value),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    // @ts-ignore
    [busy,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "col" },
});
/** @type {__VLS_StyleScopedClasses['col']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(buysText.value || '不收東西');
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "grow" },
});
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(onlySellable.value);
if (!bag.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (onlySellable.value ? '沒有這間店收的東西。' : '行囊是空的。');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain list" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['list']} */ ;
const __VLS_7 = __VLS_tryAsConstant((bag.value));
for (const [i] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (i.name),
        ...{ class: "entry" },
        ...{ class: ({ dim: i.price === null }) },
    });
    /** @type {__VLS_StyleScopedClasses['entry']} */ ;
    /** @type {__VLS_StyleScopedClasses['dim']} */ ;
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
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(categoryName, {})(s.value, i.name));
    if (__VLS_unwrap(itemEffect, {})(s.value, i.name)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "effect" },
        });
        /** @type {__VLS_StyleScopedClasses['effect']} */ ;
        (__VLS_unwrap(itemEffect, {})(s.value, i.name));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row actions" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['actions']} */ ;
    if (i.price !== null) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (__VLS_unwrap(formatMoney, {})(i.price));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        if (i.qty > 1) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "num" },
                type: "number",
                min: "1",
                max: (i.qty),
                placeholder: "1",
            });
            (sellQty.value[i.name]);
            /** @type {__VLS_StyleScopedClasses['num']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(i.price !== null))
                        throw 0;
                    return (sell(i.name, i.qty));
                    // @ts-ignore
                    [formatMoney, s, s, s, s, categoryIcon, categoryName, itemEffect, itemEffect, buysText, onlySellable, onlySellable, bag, bag, sellQty,];
                } },
            ...{ class: "small" },
            disabled: (busy.value),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (__VLS_unwrap(sellN, {})(i.name, i.qty) > 1 ? `${__VLS_unwrap(sellN, {})(i.name, i.qty)} 個（${__VLS_unwrap(formatMoney, {})(i.price * __VLS_unwrap(sellN, {})(i.name, i.qty))}）` : `（${__VLS_unwrap(formatMoney, {})(i.price)}）`);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    // @ts-ignore
    [formatMoney, formatMoney, busy, sellN, sellN, sellN,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
