import { computed, ref } from 'vue';
import { attrName, craftRules, damageTypeName, itemDef } from '@/engine/data';
import { canCraftHere, craftKindsHere, craftPlan, craftRarity, craftTarget, makeTarget } from '@/engine/craft';
import { crafters, skillOf, toolTierFor, toolTierName } from '@/engine/crafting';
import { baseSlotName, gearName, gearRules, gearSummary, rarityName, rarityPoints } from '@/engine/gear';
import { formatMoney } from '@/engine/money';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
const { defineProps, defineEmits, withDefaults, } = {};
const props = withDefaults(defineProps(), { mode: 'commission' });
const make = computed(() => props.mode === 'make');
const emit = defineEmits();
const game = useGame();
const s = computed(() => game.state);
const here = computed(() => make.value || canCraftHere(s.value));
// 自己動手：誰來做（不肯幫忙的列出原因）
const who = computed(() => crafters(s.value));
const crafterId = ref('pc');
const crafter = computed(() => who.value.find((w) => w.member.id === crafterId.value && !w.refusal)?.member ?? s.value.party.find((m) => m.isPlayer));
// 委託：只列這間店做得出來的底材（鐵匠鋪：金屬、木材；裁縫店：皮革、布料；珠寶店：寶石）；自己動手：全部
const bases = computed(() => Object.entries(gearRules.bases).filter(([, b]) => !b.restraint && (make.value || craftKindsHere(s.value).includes(b.kind))).map(([id, b]) => ({ id, ...b })));
const picked = ref('');
const base = computed({
    get: () => (bases.value.some((b) => b.id === picked.value) ? picked.value : bases.value[0]?.id ?? 'longsword'),
    set: (v) => { picked.value = v; },
});
const kind = computed(() => gearRules.bases[base.value].kind);
const materials = computed(() => Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind.value).map(([id, m]) => ({ id, ...m })));
const material = ref('iron');
const mat = computed(() => (gearRules.materials[material.value]?.kind === kind.value ? material.value : materials.value[0].id));
// 輔料：行囊裡的任何材料（最多三種），不論結果都會用掉
const aux = ref([]);
const auxPick = ref('');
const auxRules = gearRules.craft.aux;
const auxOptions = computed(() => s.value.inventory.filter((i) => itemDef(i.name)?.category === 'material' && !aux.value.some((a) => a.name === i.name)));
function addAux() {
    if (!auxPick.value || aux.value.length >= auxRules.max_kinds)
        return;
    aux.value.push({ name: auxPick.value, qty: 1 });
    auxPick.value = '';
}
const plan = computed(() => craftPlan(s.value, base.value, mat.value, aux.value, make.value ? crafter.value : undefined));
const skill = computed(() => craftRules.skills[plan.value.craft]);
const text = ref('');
const use = ref('');
const slotLabel = (slot) => baseSlotName(slot);
function craft() {
    const u = parseUse(use.value);
    const target = make.value ? makeTarget(crafter.value.id, base.value, mat.value, aux.value) : craftTarget(base.value, mat.value, aux.value);
    void game.perform({ kind: make.value ? 'make' : 'craft', target, text: text.value, ...(u ? { use: u } : {}) });
    text.value = '';
    aux.value = [];
    use.value = '';
    emit('started');
}
const __VLS_defaults = { mode: 'commission' };
void __VLS_defaults;
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
__VLS_withDotValue(here, {});
// @ts-ignore
__VLS_withDotValue(make, {});
// @ts-ignore
__VLS_withDotValue(gearRules, {});
// @ts-ignore
__VLS_withDotValue(craftRules, {});
// @ts-ignore
__VLS_withDotValue(material, {});
// @ts-ignore
__VLS_withDotValue(skill, {});
// @ts-ignore
__VLS_withDotValue(crafter, {});
// @ts-ignore
__VLS_withDotValue(plan, {});
// @ts-ignore
__VLS_withDotValue(auxRules, {});
// @ts-ignore
__VLS_withDotValue(aux, {});
// @ts-ignore
__VLS_withDotValue(auxOptions, {});
// @ts-ignore
__VLS_withDotValue(auxPick, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(s, {});
void {};
/** @type {__VLS_StyleScopedClasses['craft']} */ ;
/** @type {__VLS_StyleScopedClasses['craft']} */ ;
/** @type {__VLS_StyleScopedClasses['aux']} */ ;
/** @type {__VLS_StyleScopedClasses['aux']} */ ;
if (here.value) {
    const __VLS_0 = (make.value ? 'div' : 'details');
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        // @ts-ignore
        ...{ class: "craft small" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "craft small" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['craft']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const { default: __VLS_5 } = __VLS_nonNull(__VLS_3.slots);
    if (!make.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    }
    if (!make.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(attrName, {})(gearRules.value.craft.attr));
        (gearRules.value.craft.hours);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (craftRules.value.self.hours);
    }
    if (make.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "who" },
        });
        /** @type {__VLS_StyleScopedClasses['who']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_unwrap(crafterId, {})),
        });
        const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(who, {})));
        for (const [w] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (w.member.id),
                value: (w.member.id),
                disabled: (!!w.refusal),
            });
            (w.member.name);
            (w.refusal ? `（${w.refusal}）` : '');
            // @ts-ignore
            [here, make, make, make, make, attrName, gearRules, gearRules, craftRules, crafterId, who,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(base, {})),
    });
    const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(bases, {})));
    for (const [b] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (b.id),
            value: (b.id),
        });
        (__VLS_unwrap(slotLabel, {})(b.slot));
        (b.name);
        // @ts-ignore
        [base, bases, slotLabel,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(here.value))
                    throw 0;
                return (material.value = $event.target.value);
                // @ts-ignore
                [material,];
            } },
        value: (__VLS_unwrap(mat, {})),
    });
    const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(materials, {})));
    for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (m.id),
            value: (m.id),
        });
        (m.name);
        (__VLS_unwrap(rarityName, {})(m.rarity));
        (m.level);
        // @ts-ignore
        [mat, materials, rarityName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (__VLS_unwrap(gearName, {})({ base: __VLS_unwrap(base, {}), material: __VLS_unwrap(mat, {}) }));
    (__VLS_unwrap(gearSummary, {})({ base: __VLS_unwrap(base, {}), material: __VLS_unwrap(mat, {}) }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (skill.value.name);
    (make.value ? `${crafter.value.name} Lv.${__VLS_unwrap(skillOf, {})(crafter.value, plan.value.craft).level}` : `工匠 Lv.${plan.value.level}`);
    (plan.value.tier);
    if (make.value) {
        (__VLS_unwrap(attrName, {})(skill.value.attr));
        (plan.value.level * craftRules.value.level_bonus);
        (__VLS_unwrap(toolTierName, {})(__VLS_unwrap(toolTierFor, {})(plan.value.tier)));
        (plan.value.tool?.source);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (make.value ? `花費 ${__VLS_unwrap(formatMoney, {})(plan.value.fee)}${plan.value.materialCost ? `（材料費 ${__VLS_unwrap(formatMoney, {})(plan.value.materialCost)}）` : ''}${plan.value.rent ? `（工坊租金 ${__VLS_unwrap(formatMoney, {})(plan.value.rent)}）` : ''}` : `工錢 ${__VLS_unwrap(formatMoney, {})(plan.value.fee)}`);
    (plan.value.dc);
    if (plan.value.units) {
        (plan.value.have);
        (plan.value.units);
        if (plan.value.uses.length) {
            (plan.value.uses.map((u) => `${u.name}×${u.qty}`).join('、'));
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(rarityName, {})(__VLS_unwrap(craftRarity, {})(__VLS_unwrap(mat, {}), 'critical')));
    (__VLS_unwrap(rarityPoints, {})(__VLS_unwrap(craftRarity, {})(__VLS_unwrap(mat, {}), 'critical')));
    (__VLS_unwrap(rarityName, {})(__VLS_unwrap(craftRarity, {})(__VLS_unwrap(mat, {}), 'success')));
    (__VLS_unwrap(rarityPoints, {})(__VLS_unwrap(craftRarity, {})(__VLS_unwrap(mat, {}), 'success')));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "aux" },
    });
    /** @type {__VLS_StyleScopedClasses['aux']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (auxRules.value.max_kinds);
    const __VLS_9 = __VLS_tryAsConstant((aux.value));
    for (const [a, i] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (a.name),
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (a.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: (auxRules.value.max_qty),
            ...{ class: "qty" },
        });
        (a.qty);
        /** @type {__VLS_StyleScopedClasses['qty']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(here.value))
                        throw 0;
                    return (aux.value.splice(i, 1));
                    // @ts-ignore
                    [make, make, make, attrName, craftRules, base, base, mat, mat, mat, mat, mat, mat, rarityName, rarityName, gearName, gearSummary, skill, skill, crafter, crafter, skillOf, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, plan, toolTierName, toolTierFor, formatMoney, formatMoney, formatMoney, formatMoney, craftRarity, craftRarity, craftRarity, craftRarity, rarityPoints, rarityPoints, auxRules, auxRules, aux, aux,];
                } },
            ...{ class: "x" },
        });
        /** @type {__VLS_StyleScopedClasses['x']} */ ;
        // @ts-ignore
        [];
    }
    if (aux.value.length < auxRules.value.max_kinds && auxOptions.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (auxPick.value),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        const __VLS_10 = __VLS_tryAsConstant((auxOptions.value));
        for (const [i] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (i.name),
                value: (i.name),
            });
            (i.name);
            (i.qty);
            // @ts-ignore
            [auxRules, aux, auxOptions, auxOptions, auxPick,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (addAux) },
            ...{ class: "small" },
            disabled: (!auxPick.value),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    else if (!aux.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    if (aux.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(formatMoney, {})(plan.value.auxValue));
        (Math.round(plan.value.auxChance * 100));
        if (plan.value.elements.length) {
            (plan.value.elements.map((e) => __VLS_unwrap(damageTypeName, {})(e)).join('、'));
        }
    }
    if (plan.value.blocked) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (plan.value.blocked);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "想要的樣子（選填）：例如刻上家紋、劍身帶著火焰紋路、取名「破曉」",
        });
        (__VLS_unwrap(text, {}));
        const __VLS_11 = AbilityPicker;
        // @ts-ignore
        const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
            // @ts-ignore
            modelValue: (__VLS_unwrap(use, {})),
        }));
        const __VLS_13 = __VLS_12({
            modelValue: (__VLS_unwrap(use, {})),
        }, ...__VLS_functionalComponentArgsRest(__VLS_12));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (craft) },
            ...{ class: "small" },
            disabled: (game.value.judging || !!s.value.pendingAction),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (make.value ? `🛠️ ${crafter.value.isPlayer ? '親手' : `請${crafter.value.name}`}打造` : '委託打造');
    }
    // @ts-ignore
    [make, crafter, crafter, plan, plan, plan, plan, plan, plan, formatMoney, aux, aux, auxPick, damageTypeName, text, use, game, s,];
    var __VLS_3;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
