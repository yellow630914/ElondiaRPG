import { computed, ref } from 'vue';
import { attrName, craftRules, itemDef } from '@/engine/data';
import { CRAFT_IDS, crafters, skillOf, toolTierFor, toolTierName } from '@/engine/crafting';
import { capsSource, capsText, INVENT_CATEGORY_NAME, INVENT_GRADE_NAME, inventCaps, inventCategories, inventPlan, inventTarget, } from '@/engine/invention';
import { formatMoney } from '@/engine/money';
import { parseUse, useGame } from '@/stores/game';
import { useSettings } from '@/stores/settings';
import AbilityPicker from './AbilityPicker.vue';
const { defineEmits, } = {};
const emit = defineEmits();
const game = useGame();
const settings = useSettings();
const s = computed(() => game.state);
const who = computed(() => crafters(s.value));
const crafterId = ref('pc');
const crafter = computed(() => who.value.find((w) => w.member.id === crafterId.value && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer));
const crafts = CRAFT_IDS.filter((c) => inventCategories(c).length);
const craft = ref('alchemy');
const categories = computed(() => inventCategories(craft.value));
const pickedCategory = ref('consumable');
const category = computed(() => (categories.value.includes(pickedCategory.value) ? pickedCategory.value : categories.value[0]));
const maxLevel = computed(() => skillOf(crafter.value, craft.value).level);
const pickedLevel = ref(1);
const level = computed(() => Math.max(1, Math.min(maxLevel.value, pickedLevel.value)));
// 材料：行囊裡裝備以外的東西
const inputs = ref([]);
const inputPick = ref('');
const inputOptions = computed(() => s.value.inventory.filter((i) => i.qty > 0 && itemDef(i.name)?.category !== 'equipment' && !inputs.value.some((x) => x.name === i.name)));
function addInput() {
    if (!inputPick.value || inputs.value.length >= craftRules.invention.max_inputs)
        return;
    inputs.value.push({ name: inputPick.value, qty: 1 });
    inputPick.value = '';
}
const req = computed(() => ({ craft: craft.value, level: level.value, category: category.value, inputs: inputs.value }));
const plan = computed(() => inventPlan(s.value, req.value, crafter.value));
// 強度依擲骰：各成功程度的上限
const GRADES = ['success', 'critical', 'partial'];
const grades = computed(() => GRADES.map((g) => ({ grade: g, caps: inventCaps(craft.value, level.value, category.value, g) })).filter((x) => x.caps));
const gradeShown = ref('success');
const shownCaps = computed(() => grades.value.find((x) => x.grade === gradeShown.value)?.caps ?? grades.value[0]?.caps);
const skill = computed(() => craftRules.skills[craft.value]);
const aiOn = computed(() => settings.aiJudge && settings.ready('judge'));
const text = ref('');
const use = ref('');
function invent() {
    const u = parseUse(use.value);
    void game.perform({ kind: 'invent', target: inventTarget(crafter.value.id, req.value), text: text.value, ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
    inputs.value = [];
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
__VLS_withDotValue(aiOn, {});
// @ts-ignore
__VLS_withDotValue(craftRules, {});
// @ts-ignore
__VLS_withDotValue(crafter, {});
// @ts-ignore
__VLS_withDotValue(pickedCategory, {});
// @ts-ignore
__VLS_withDotValue(INVENT_CATEGORY_NAME, {});
// @ts-ignore
__VLS_withDotValue(pickedLevel, {});
// @ts-ignore
__VLS_withDotValue(shownCaps, {});
// @ts-ignore
__VLS_withDotValue(gradeShown, {});
// @ts-ignore
__VLS_withDotValue(INVENT_GRADE_NAME, {});
// @ts-ignore
__VLS_withDotValue(inputs, {});
// @ts-ignore
__VLS_withDotValue(inputOptions, {});
// @ts-ignore
__VLS_withDotValue(inputPick, {});
// @ts-ignore
__VLS_withDotValue(plan, {});
// @ts-ignore
__VLS_withDotValue(skill, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(text, {});
void {};
/** @type {__VLS_StyleScopedClasses['invent']} */ ;
/** @type {__VLS_StyleScopedClasses['invent']} */ ;
/** @type {__VLS_StyleScopedClasses['caps']} */ ;
/** @type {__VLS_StyleScopedClasses['grades']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "invent small" },
});
/** @type {__VLS_StyleScopedClasses['invent']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(aiOn.value ? 'AI 會依做法與材料設計成品並取名' : '沒有開啟 AI 判定時，會仿照同級的現成配方做一件「特製」品');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "field" },
});
/** @type {__VLS_StyleScopedClasses['field']} */ ;
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
    [aiOn, crafterId, who,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "field" },
});
/** @type {__VLS_StyleScopedClasses['field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(craft, {})),
});
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(crafts, {})));
for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (c),
        value: (c),
    });
    (craftRules.value.skills[c].name);
    (__VLS_unwrap(skillOf, {})(crafter.value, c).level);
    // @ts-ignore
    [craft, crafts, craftRules, skillOf, crafter,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "field" },
});
/** @type {__VLS_StyleScopedClasses['field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (pickedCategory.value = $event.target.value);
            // @ts-ignore
            [pickedCategory,];
        } },
    value: (__VLS_unwrap(category, {})),
});
const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(categories, {})));
for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (c),
        value: (c),
    });
    (INVENT_CATEGORY_NAME.value[c]);
    // @ts-ignore
    [category, categories, INVENT_CATEGORY_NAME,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "field" },
});
/** @type {__VLS_StyleScopedClasses['field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (pickedLevel.value = Number($event.target.value));
            // @ts-ignore
            [pickedLevel,];
        } },
    value: (__VLS_unwrap(level, {})),
});
const __VLS_3 = __VLS_tryAsConstant((__VLS_unwrap(maxLevel, {})));
for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (n),
        value: (n),
    });
    (n);
    // @ts-ignore
    [level, maxLevel,];
}
if (shownCaps.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "caps" },
    });
    /** @type {__VLS_StyleScopedClasses['caps']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row grades" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['grades']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    const __VLS_4 = __VLS_tryAsConstant((__VLS_unwrap(grades, {})));
    for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(shownCaps.value))
                        throw 0;
                    return (gradeShown.value = x.grade);
                    // @ts-ignore
                    [shownCaps, grades, gradeShown,];
                } },
            key: (x.grade),
            ...{ class: "small" },
            ...{ class: ({ active: shownCaps.value === x.caps }) },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (INVENT_GRADE_NAME.value[x.grade]);
        // @ts-ignore
        [shownCaps, INVENT_GRADE_NAME,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(capsSource, {})(shownCaps.value));
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(capsText, {})(shownCaps.value)));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (t),
        });
        (t);
        // @ts-ignore
        [shownCaps, shownCaps, capsSource, capsText,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "inputs" },
});
/** @type {__VLS_StyleScopedClasses['inputs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(craftRules.value.invention.max_inputs);
const __VLS_6 = __VLS_tryAsConstant((inputs.value));
for (const [x, i] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (x.name),
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (x.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "99",
        ...{ class: "qty" },
    });
    (x.qty);
    /** @type {__VLS_StyleScopedClasses['qty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (inputs.value.splice(i, 1));
                // @ts-ignore
                [craftRules, inputs, inputs,];
            } },
        ...{ class: "x" },
    });
    /** @type {__VLS_StyleScopedClasses['x']} */ ;
    // @ts-ignore
    [];
}
if (inputs.value.length < craftRules.value.invention.max_inputs && inputOptions.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (inputPick.value),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_7 = __VLS_tryAsConstant((inputOptions.value));
    for (const [i] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (i.name),
            value: (i.name),
        });
        (i.name);
        (i.qty);
        // @ts-ignore
        [craftRules, inputs, inputOptions, inputOptions, inputPick,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (addInput) },
        ...{ class: "small" },
        disabled: (!inputPick.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(formatMoney, {})(plan.value.inputValue));
if (plan.value.cost) {
    (__VLS_unwrap(formatMoney, {})(plan.value.cost));
}
if (plan.value.rent) {
    (__VLS_unwrap(formatMoney, {})(plan.value.rent));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(attrName, {})(skill.value.attr));
(plan.value.skill * craftRules.value.level_bonus);
(plan.value.dc);
(plan.value.hours);
(__VLS_unwrap(toolTierName, {})(__VLS_unwrap(toolTierFor, {})(__VLS_unwrap(level, {}))));
(plan.value.tool.source);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (plan.value.blocked) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (plan.value.blocked);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "field" },
    });
    /** @type {__VLS_StyleScopedClasses['field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (text.value),
        rows: "3",
        maxlength: "400",
        placeholder: "例如「把硫磺磨成粉，和藥草汁一起封進陶瓶，瓶口塞一條浸了油的布」「肉抹上蜂蜜和鹽，掛在爐邊慢慢烘乾」",
    });
    const __VLS_8 = AbilityPicker;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        // @ts-ignore
        modelValue: (__VLS_unwrap(use, {})),
    }));
    const __VLS_10 = __VLS_9({
        modelValue: (__VLS_unwrap(use, {})),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (invent) },
        ...{ class: "small" },
        disabled: (game.value.judging || !!s.value.pendingAction || !text.value.trim()),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (crafter.value.isPlayer ? '試做看看' : `請${crafter.value.name}試做`);
}
// @ts-ignore
[craftRules, crafter, crafter, level, inputPick, formatMoney, formatMoney, formatMoney, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, attrName, skill, toolTierName, toolTierFor, text, text, use, game, s,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
