import { computed, onMounted, ref } from 'vue';
import { shopDef } from '@/engine/data';
import { canNegotiate } from '@/engine/negotiation';
import { npcRecord } from '@/engine/npcs';
import { discount, isItemDeal, keeperTitle, sellPrice, shopKey } from '@/engine/trade';
import { useGame } from '@/stores/game';
import { useSettings } from '@/stores/settings';
import AppDialog from './AppDialog.vue';
import ShopDialog from './items/ShopDialog.vue';
import NameTag from './NameTag.vue';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const settings = useSettings();
const s = computed(() => game.state);
const key = computed(() => shopKey(s.value, props.type));
const loading = ref(false);
onMounted(async () => {
    game.shopState(props.type);
    loading.value = settings.aiJudge && settings.ready('shop');
    await game.flavorShop(props.type);
    loading.value = false;
});
const shop = computed(() => {
    const cur = s.value.shops?.[key.value];
    return cur && cur.day === s.value.time.day ? cur : undefined;
});
const keeper = computed(() => (shop.value ? npcRecord(s.value, shop.value.keeper) : undefined));
const deals = computed(() => shop.value?.deals.filter((d) => d.stock > 0) ?? []);
const off = computed(() => Math.round(discount(s.value, key.value) * 100));
// ---- 交易視窗 ----
const showDialog = ref(false);
const counts = computed(() => {
    const items = deals.value.filter(isItemDeal).length;
    return { items, special: deals.value.length - items };
});
const sellable = computed(() => s.value.inventory.filter((i) => sellPrice(s.value, key.value, i.name) !== null).length);
const discountBlocked = computed(() => canNegotiate(s.value, 'shop_discount', { shop: props.type }));
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
__VLS_withDotValue(loading, {});
// @ts-ignore
__VLS_withDotValue(shop, {});
// @ts-ignore
__VLS_withDotValue(keeper, {});
// @ts-ignore
__VLS_withDotValue(off, {});
// @ts-ignore
__VLS_withDotValue(counts, {});
// @ts-ignore
__VLS_withDotValue(sellable, {});
// @ts-ignore
__VLS_withDotValue(showDialog, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(discountBlocked, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "shop" },
});
/** @type {__VLS_StyleScopedClasses['shop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
(__VLS_unwrap(shopDef, {})(__VLS_ctx.type).name);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (loading.value) {
}
else if (shop.value?.source === 'ai') {
}
if (keeper.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
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
    (keeper.value.personality);
    if (off.value) {
        (off.value);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(counts.value.items);
(counts.value.special ? `、${counts.value.special} 筆特別交易` : '');
if (sellable.value) {
    (sellable.value);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (showDialog.value = true);
            // @ts-ignore
            [shopDef, type, type, loading, shop, keeper, keeper, keeper, keeperTitle, off, off, counts, counts, counts, sellable, sellable, showDialog,];
        } },
    ...{ class: "primary open" },
});
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['open']} */ ;
const __VLS_5 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showDialog.value), title: (__VLS_unwrap(shopDef, {})(__VLS_ctx.type).name), icon: "🛒", width: "1180px",
}));
const __VLS_7 = __VLS_6({
    ...{ 'onClose': {} },
    open: (showDialog.value),
    title: (__VLS_unwrap(shopDef, {})(__VLS_ctx.type).name),
    icon: "🛒",
    width: "1180px",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
const __VLS_11 = {
    /** @type {typeof __VLS_10.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showDialog.value = false);
        // @ts-ignore
        [shopDef, type, showDialog, showDialog,];
    },
};
void __VLS_11;
const { default: __VLS_12 } = __VLS_nonNull(__VLS_8.slots);
const __VLS_13 = ShopDialog;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({
    // @ts-ignore
    type: (__VLS_ctx.type), loading: (loading.value),
}));
const __VLS_15 = __VLS_14({
    type: (__VLS_ctx.type),
    loading: (loading.value),
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
// @ts-ignore
[type, loading,];
var __VLS_8;
var __VLS_9;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (game.value.startNegotiation('shop_discount', { shop: __VLS_ctx.type }));
            // @ts-ignore
            [type, game,];
        } },
    ...{ class: "small" },
    disabled: (!!discountBlocked.value),
    title: (discountBlocked.value ?? ''),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (discountBlocked.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (discountBlocked.value);
}
// @ts-ignore
[discountBlocked, discountBlocked, discountBlocked, discountBlocked,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
