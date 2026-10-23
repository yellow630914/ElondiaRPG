import { computed, reactive, ref, watch } from 'vue';
import { ATTR_IDS, attrName } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { inkKind, inkPrice, orderTattoo, removePrice, shopRefusal, tattooShop } from '@/engine/tattooShop';
import { freePlaces, oathError, oathText, placeName, tattooError, tattooKindName, tattooName, tattooRules, tattoosOf, } from '@/engine/tattoos';
import { useGame } from '@/stores/game';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const s = computed(() => game.state);
const pc = computed(() => s.value.party.find((m) => m.isPlayer));
const rules = computed(() => tattooShop(props.shop));
const kind = computed(() => inkKind(props.shop));
const refusal = computed(() => shopRefusal(s.value, props.shop));
// ---- 刺青 ----
const templates = computed(() => Object.entries(tattooRules.templates).filter(([, t]) => t.kind === kind.value));
const mode = ref('');
const place = ref('');
const custom = reactive({ name: '', desc: '', attrs: {} });
watch(() => props.shop, () => (mode.value = templates.value[0]?.[0] ?? 'custom'), { immediate: true });
const free = computed(() => freePlaces(pc.value));
// 選圖樣時，部位預設成圖樣建議的空位
watch([mode, free], () => {
    const tpl = tattooRules.templates[mode.value];
    if (place.value && free.value.includes(place.value))
        return;
    place.value = (tpl?.places ?? []).find((p) => free.value.includes(p)) ?? free.value[0] ?? '';
}, { immediate: true });
const order = computed(() => {
    if (!place.value || !kind.value)
        return null;
    return mode.value === 'custom'
        ? { kind: kind.value, name: custom.name, desc: custom.desc, place: place.value, ...(kind.value === 'oath' ? { attrs: { ...custom.attrs } } : {}) }
        : { template: mode.value, place: place.value };
});
const preview = computed(() => {
    if (!order.value)
        return null;
    try {
        return orderTattoo(s.value, order.value);
    }
    catch {
        return null;
    }
});
const problem = computed(() => {
    if (!free.value.length)
        return '身上已經沒有空著的部位';
    if (mode.value === 'custom' && !custom.name.trim())
        return '請替刺青取個名字';
    if (mode.value === 'custom' && kind.value === 'oath')
        return oathError(custom.attrs);
    return preview.value ? tattooError(pc.value, preview.value) : undefined;
});
const price = computed(() => (preview.value ? inkPrice(props.shop, preview.value) : 0));
function setAttr(a, v) {
    if (v)
        custom.attrs[a] = v;
    else
        delete custom.attrs[a];
}
function ink() {
    if (order.value)
        game.inkTattoo(order.value);
}
// ---- 洗刺青 ----
const washable = computed(() => tattoosOf(pc.value).filter((t) => t.kind !== 'slave').map((t) => ({ t, price: removePrice(props.shop, t.kind) })));
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
__VLS_withDotValue(refusal, {});
// @ts-ignore
__VLS_withDotValue(kind, {});
// @ts-ignore
__VLS_withDotValue(tattooRules, {});
// @ts-ignore
__VLS_withDotValue(rules, {});
// @ts-ignore
__VLS_withDotValue(mode, {});
// @ts-ignore
__VLS_withDotValue(custom, {});
// @ts-ignore
__VLS_withDotValue(problem, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(washable, {});
// @ts-ignore
__VLS_withDotValue(game, {});
void {};
/** @type {__VLS_StyleScopedClasses['tattoo-shop']} */ ;
/** @type {__VLS_StyleScopedClasses['custom']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tattoo-shop small" },
});
/** @type {__VLS_StyleScopedClasses['tattoo-shop']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (refusal.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (refusal.value);
}
if (kind.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    (__VLS_unwrap(tattooKindName, {})(kind.value));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    if (kind.value === 'oath') {
        (tattooRules.value.oath.max_change);
        (tattooRules.value.oath.max_attrs);
        (tattooRules.value.oath.max_per_character);
    }
    else {
    }
    (__VLS_unwrap(formatMoney, {})(rules.value.custom_extra ?? 0));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (mode.value),
    });
    const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(templates, {})));
    for (const [[id, t]] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (id),
            value: (id),
        });
        (t.name);
        (t.attrs ? `（${__VLS_unwrap(oathText, {})(t.attrs)}）` : '');
        // @ts-ignore
        [refusal, refusal, kind, kind, kind, tattooKindName, tattooRules, tattooRules, tattooRules, formatMoney, rules, mode, templates, oathText,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "custom",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(place, {})),
    });
    const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(free, {})));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p),
            value: (p),
        });
        (__VLS_unwrap(placeName, {})(p));
        // @ts-ignore
        [place, free, placeName,];
    }
    if (mode.value !== 'custom' && tattooRules.value.templates[mode.value]) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (tattooRules.value.templates[mode.value].desc);
    }
    if (mode.value === 'custom') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "custom" },
        });
        /** @type {__VLS_StyleScopedClasses['custom']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "20",
            placeholder: "名稱",
        });
        (custom.value.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (custom.value.desc),
            rows: "2",
            maxlength: "160",
            placeholder: "外觀（圖樣、顏色、大小）",
        });
        if (kind.value === 'oath') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
            for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    key: (a),
                });
                (__VLS_unwrap(attrName, {})(a));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onInput: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(kind.value))
                                throw 0;
                            if (!(mode.value === 'custom'))
                                throw 0;
                            if (!(kind.value === 'oath'))
                                throw 0;
                            return (setAttr(a, Number($event.target.value)));
                            // @ts-ignore
                            [kind, tattooRules, tattooRules, mode, mode, mode, mode, custom, custom, ATTR_IDS, attrName,];
                        } },
                    type: "number",
                    ...{ class: "num" },
                    min: (-tattooRules.value.oath.max_change),
                    max: (tattooRules.value.oath.max_change),
                    value: (custom.value.attrs[a] ?? 0),
                });
                /** @type {__VLS_StyleScopedClasses['num']} */ ;
                // @ts-ignore
                [tattooRules, tattooRules, custom,];
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (ink) },
        disabled: (!!problem.value || s.value.money_cc < __VLS_unwrap(price, {})),
    });
    (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(price, {})));
    (rules.value.hours);
    if (problem.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "warn" },
        });
        /** @type {__VLS_StyleScopedClasses['warn']} */ ;
        (problem.value);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
if (washable.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_3 = __VLS_tryAsConstant((washable.value));
    for (const [{ t, price: p }] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (t.place),
        });
        (__VLS_unwrap(placeName, {})(t.place));
        (__VLS_unwrap(tattooKindName, {})(t.kind));
        (__VLS_unwrap(tattooName, {})(t));
        if (p !== undefined) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(washable.value.length))
                            throw 0;
                        if (!(p !== undefined))
                            throw 0;
                        return (game.value.washTattoo(t.place));
                        // @ts-ignore
                        [tattooKindName, formatMoney, rules, placeName, problem, problem, problem, s, price, price, washable, washable, tattooName, game,];
                    } },
                ...{ class: "small" },
                disabled: (!!refusal.value || s.value.money_cc < p),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (__VLS_unwrap(formatMoney, {})(p));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(tattooKindName, {})(t.kind));
        }
        // @ts-ignore
        [refusal, tattooKindName, formatMoney, s,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
