import { computed, ref } from 'vue';
import { attrName, craftRules } from '@/engine/data';
import { CRAFT_IDS, crafters, toolTierFor, toolTierName } from '@/engine/crafting';
import { formatMoney } from '@/engine/money';
import { producedQty, produceTarget, recipeItems, recipePlan } from '@/engine/recipes';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
import { itemEffect, itemText } from './items/itemInfo';
const { defineEmits, } = {};
const emit = defineEmits();
const game = useGame();
const s = computed(() => game.state);
const who = computed(() => crafters(s.value));
const crafterId = ref('pc');
const crafter = computed(() => who.value.find((w) => w.member.id === crafterId.value && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer));
const craft = ref('');
const onlyReady = ref(false);
const crafts = computed(() => CRAFT_IDS.filter((c) => recipeItems(c).length));
const rows = computed(() => recipeItems(craft.value || undefined)
    .map((r) => ({ ...r, blocked: recipePlan(s.value, r.name, 1, crafter.value).blocked }))
    .filter((r) => !onlyReady.value || !r.blocked)
    .sort((a, b) => CRAFT_IDS.indexOf(a.recipe.craft) - CRAFT_IDS.indexOf(b.recipe.craft) || a.recipe.level - b.recipe.level));
const groups = computed(() => CRAFT_IDS.map((c) => ({ craft: c, rows: rows.value.filter((r) => r.recipe.craft === c) })).filter((g) => g.rows.length));
const picked = ref('');
const name = computed(() => (rows.value.some((r) => r.name === picked.value) ? picked.value : rows.value[0]?.name ?? ''));
const batches = ref(1);
const plan = computed(() => (name.value ? recipePlan(s.value, name.value, batches.value, crafter.value) : undefined));
const skill = computed(() => (plan.value ? craftRules.skills[plan.value.recipe.craft] : undefined));
const text = ref('');
const use = ref('');
function rename() {
    const from = plan.value?.name;
    if (!from)
        return;
    const to = prompt('自創物品的名字（配方也跟著改）', from);
    if (!to || to.trim() === from)
        return;
    const name = game.renameInvention(from, to);
    if (name)
        picked.value = name;
}
function forget() {
    if (plan.value && confirm(`忘記「${plan.value.name}」的配方？做好的成品會留著，但之後不能再做。`))
        game.forgetInvention(plan.value.name);
}
function produce() {
    if (!plan.value)
        return;
    const u = parseUse(use.value);
    void game.perform({ kind: 'produce', target: produceTarget(crafter.value.id, name.value, plan.value.batches), text: text.value, ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
    emit('started');
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
__VLS_withDotValue(craftRules, {});
// @ts-ignore
__VLS_withDotValue(rows, {});
// @ts-ignore
__VLS_withDotValue(picked, {});
// @ts-ignore
__VLS_withDotValue(plan, {});
// @ts-ignore
__VLS_withDotValue(skill, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(crafter, {});
// @ts-ignore
__VLS_withDotValue(game, {});
void {};
/** @type {__VLS_StyleScopedClasses['recipes']} */ ;
/** @type {__VLS_StyleScopedClasses['recipes']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "recipes small" },
});
/** @type {__VLS_StyleScopedClasses['recipes']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "who" },
});
/** @type {__VLS_StyleScopedClasses['who']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(crafterId, {})),
});
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(who, {})));
for (const [w] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (w.member.id),
        value: (w.member.id),
        disabled: (!!w.refusal),
    });
    (w.member.name);
    (w.refusal ? `（${w.refusal}）` : '');
    // @ts-ignore
    [crafterId, who,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "who" },
});
/** @type {__VLS_StyleScopedClasses['who']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(craft, {})),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(crafts, {})));
for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (c),
        value: (c),
    });
    (craftRules.value.skills[c].name);
    // @ts-ignore
    [craft, crafts, craftRules,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_unwrap(onlyReady, {}));
if (rows.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(rows.value.length))
                    throw 0;
                return (picked.value = $event.target.value);
                // @ts-ignore
                [onlyReady, rows, picked,];
            } },
        value: (__VLS_unwrap(name, {})),
    });
    const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(groups, {})));
    for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
            key: (g.craft),
            label: (craftRules.value.skills[g.craft].name),
        });
        const __VLS_3 = __VLS_tryAsConstant((g.rows));
        for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (r.name),
                value: (r.name),
            });
            (r.blocked ? '✗' : '✓');
            (r.recipe.level);
            (r.invented ? '💡' : '');
            (r.name);
            ((r.recipe.qty ?? 1) > 1 ? ` ×${r.recipe.qty}` : '');
            // @ts-ignore
            [craftRules, name, groups,];
        }
        // @ts-ignore
        [];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (plan.value && skill.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (plan.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(itemEffect, {})(s.value, plan.value.name));
    if (s.value.inventions?.[plan.value.name]) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (rename) },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (forget) },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    if (__VLS_unwrap(itemText, {})(s.value, plan.value.name)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(itemText, {})(s.value, plan.value.name));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (skill.value.name);
    (plan.value.recipe.level);
    (crafter.value.name);
    (plan.value.level);
    (__VLS_unwrap(attrName, {})(skill.value.attr));
    (plan.value.level * craftRules.value.level_bonus);
    (plan.value.dc);
    (plan.value.hours);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(toolTierName, {})(__VLS_unwrap(toolTierFor, {})(plan.value.recipe.level)));
    (plan.value.tool.source);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    const __VLS_4 = __VLS_tryAsConstant((plan.value.inputs));
    for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (x.name),
            ...{ class: ({ short: x.have < x.need }) },
            ...{ class: "input" },
        });
        /** @type {__VLS_StyleScopedClasses['short']} */ ;
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        (x.name);
        (x.have);
        (x.need);
        // @ts-ignore
        [craftRules, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, skill, skill, skill, itemEffect, s, s, s, s, itemText, itemText, crafter, attrName, toolTierName, toolTierFor,];
    }
    if (plan.value.fee) {
        (__VLS_unwrap(formatMoney, {})(plan.value.fee));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (plan.value.rent ? `（含工坊租金 ${__VLS_unwrap(formatMoney, {})(plan.value.rent)}）` : '');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: (craftRules.value.recipe.max_batches),
        ...{ class: "qty" },
    });
    (__VLS_unwrap(batches, {}));
    /** @type {__VLS_StyleScopedClasses['qty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(producedQty, {})(plan.value.qty, 'critical'));
    (plan.value.qty);
    (__VLS_unwrap(producedQty, {})(plan.value.qty, 'partial'));
    if (plan.value.blocked) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (plan.value.blocked);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "想怎麼做（選填）：例如加一點蜂蜜讓藥比較好入口",
        });
        (__VLS_unwrap(text, {}));
        const __VLS_5 = AbilityPicker;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            // @ts-ignore
            modelValue: (__VLS_unwrap(use, {})),
        }));
        const __VLS_7 = __VLS_6({
            modelValue: (__VLS_unwrap(use, {})),
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (produce) },
            ...{ class: "small" },
            disabled: (game.value.judging || !!s.value.pendingAction),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (crafter.value.isPlayer ? '動手製作' : `請${crafter.value.name}製作`);
    }
}
// @ts-ignore
[craftRules, plan, plan, plan, plan, plan, plan, plan, plan, plan, s, crafter, crafter, formatMoney, formatMoney, batches, producedQty, producedQty, text, use, game,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
