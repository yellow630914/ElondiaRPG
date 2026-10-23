import { computed, ref, watch } from 'vue';
import { ATTR_IDS, attrName, damageTypeName, damageTypes, equipment, itemRules } from '@/engine/data';
import { baseSlots, gearRules, gearSummary, rarityName, RARITY_ORDER } from '@/engine/gear';
import { builtinBase, builtinMaterial } from '@/engine/mods';
import { formatMoney } from '@/engine/money';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import AffinityRows from './AffinityRows.vue';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
const KINDS = { metal: '金屬', leather: '皮革', cloth: '布料', wood: '木材', jewel: '寶石' };
const SLOTS = baseSlots();
const MOD_NAME = { hit: '命中', damage: '傷害', evade: '迴避', dr: '減傷', save: '豁免', crit: '幸運一擊', ap_regen: '行動點回復' };
const SCALE_NAME = { full: '材料加成全部', half: '一半（捨去）', up: '一半（進位）', third: '三分之一（捨去）', third_up: '三分之一（進位）' };
const damageIds = damageTypes.types.map((t) => t.id);
function currentBase() {
    const b = clone(content.mods.bases[props.id] ?? gearRules.bases[props.id]);
    if (b.slot === 'main_hand' && !b.weaponDef && b.weapon)
        b.weaponDef = clone(equipment.weapons[b.weapon]);
    if (b.slot === 'body' && !b.armorDef && b.armor)
        b.armorDef = clone(equipment.armors[b.armor]);
    b.stats ??= {};
    b.scale ??= {};
    return b;
}
function currentMaterial() {
    const m = clone(content.mods.materials[props.id] ?? gearRules.materials[props.id]);
    m.armor ??= {};
    return m;
}
const base = ref(props.kind === 'base' ? currentBase() : {});
const mat = ref(props.kind === 'material' ? currentMaterial() : {});
const text = () => JSON.stringify(props.kind === 'base' ? base.value : mat.value);
const saved = ref(text());
function reset() {
    if (props.kind === 'base')
        base.value = currentBase();
    else
        mat.value = currentMaterial();
    saved.value = text();
}
watch(() => [props.kind, props.id], reset);
const dirty = computed(() => text() !== saved.value);
const builtin = computed(() => (props.kind === 'base' ? !!builtinBase(props.id) : !!builtinMaterial(props.id)));
const edited = computed(() => builtin.value && !!(props.kind === 'base' ? content.mods.bases[props.id] : content.mods.materials[props.id]));
// 底材換到主手或上身時補上武器、防具的數值
watch(() => base.value.slot, (s) => {
    if (props.kind !== 'base')
        return;
    if (s === 'main_hand')
        base.value.weaponDef ??= { name: base.value.name, dice: '1d6', type: 'slashing', attr: 'str' };
    if (s === 'body')
        base.value.armorDef ??= { name: base.value.name, evade: 0, dr: 1 };
});
/** 這種底材或材料做成的制式裝備（套用後） */
const catalog = computed(() => {
    void content.version;
    return itemRules.items.filter((i) => i.gear && (props.kind === 'base' ? i.gear.base === props.id : i.gear.material === props.id));
});
function setScale(k, v) {
    const s = { ...(base.value.scale ?? {}) };
    if (v)
        s[k] = v;
    else
        delete s[k];
    base.value.scale = s;
}
function save() {
    try {
        if (props.kind === 'base')
            content.saveBase(props.id, base.value, !builtin.value);
        else
            content.saveMaterial(props.id, mat.value, !builtin.value);
        reset();
        game.flash('已儲存');
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function restore() {
    if (!confirm('恢復成內建的樣子？'))
        return;
    if (props.kind === 'base')
        content.restoreBase(props.id);
    else
        content.restoreMaterial(props.id);
    reset();
}
// 還有地方用到時不能刪（見 docs/CONTENT_DEPENDENCIES.md）
const usage = computed(() => {
    void content.version;
    void game.state?.time.minute;
    return content.usageOf(props.kind === 'base' ? 'base' : 'material', props.id);
});
function remove() {
    if (!confirm('刪除？用它做成的制式裝備會一起消失；其他存檔裡已有的會失效（沒有效果、不能裝備）。'))
        return;
    try {
        if (props.kind === 'base')
            content.deleteBase(props.id);
        else
            content.deleteMaterial(props.id);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
        return;
    }
    emit('deleted');
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
__VLS_withDotValue(base, {});
// @ts-ignore
__VLS_withDotValue(mat, {});
// @ts-ignore
__VLS_withDotValue(builtin, {});
// @ts-ignore
__VLS_withDotValue(edited, {});
// @ts-ignore
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
// @ts-ignore
__VLS_withDotValue(catalog, {});
void {};
/** @type {__VLS_StyleScopedClasses['list']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "editor" },
});
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
(__VLS_ctx.kind === 'base' ? base.value.name : mat.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag" },
});
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
(builtin.value ? (edited.value ? '內建・已修改' : '內建') : '自建');
if (dirty.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag warn" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (save) },
    ...{ class: "small primary" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (reset) },
    ...{ class: "small" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (builtin.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (restore) },
        ...{ class: "small" },
        disabled: (!edited.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (remove) },
        ...{ class: "small danger" },
        disabled: (usage.value.length > 0),
        title: (usage.value.length ? '還有地方用到，不能刪除' : ''),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
const __VLS_0 = UsageNote;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    usage: (usage.value), deletable: (!builtin.value),
}));
const __VLS_2 = __VLS_1({
    usage: (usage.value),
    deletable: (!builtin.value),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_ctx.id);
if (__VLS_ctx.kind === 'base') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "12",
    });
    (base.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (base.value.slot),
        disabled: (builtin.value),
    });
    const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(SLOTS, {})));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [kind, kind, base, base, base, mat, builtin, builtin, builtin, builtin, edited, edited, dirty, dirty, dirty, usage, usage, usage, id, SLOTS,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (base.value.kind),
        disabled: (builtin.value),
    });
    const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(KINDS, {})));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [base, builtin, KINDS,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    (__VLS_unwrap(formatMoney, {})(base.value.price));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
    });
    (base.value.price);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        step: "0.05",
    });
    (base.value.threat);
    if (base.value.slot === 'main_hand') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "check small" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
            disabled: (builtin.value),
        });
        (base.value.two_handed);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "block" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "120",
    });
    (base.value.desc);
    if (base.value.slot !== 'main_hand' && base.value.slot !== 'body') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "check small" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
            disabled: (builtin.value),
        });
        (base.value.restraint);
    }
    if (builtin.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    if (base.value.slot === 'main_hand' && base.value.weaponDef) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: "1d8",
        });
        (base.value.weaponDef.dice);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (base.value.weaponDef.type),
        });
        const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(damageIds, {})));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (t),
                value: (t),
            });
            (__VLS_unwrap(damageTypeName, {})(t));
            // @ts-ignore
            [base, base, base, base, base, base, base, base, base, base, base, base, base, builtin, builtin, builtin, formatMoney, damageIds, damageTypeName,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (base.value.weaponDef.attr),
        });
        const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
        for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (a),
                value: (a),
            });
            (__VLS_unwrap(attrName, {})(a));
            // @ts-ignore
            [base, ATTR_IDS, attrName,];
        }
        if (builtin.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
    }
    if (base.value.slot === 'body' && base.value.armorDef) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
        });
        (base.value.armorDef.evade);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "0",
        });
        (base.value.armorDef.dr);
        const __VLS_9 = AffinityRows;
        // @ts-ignore
        const __VLS_10 = __VLS_asFunctionalComponent1(__VLS_9, new __VLS_9({
            // @ts-ignore
            modelValue: (base.value.armorDef.resist), label: "抗性",
        }));
        const __VLS_11 = __VLS_10({
            modelValue: (base.value.armorDef.resist),
            label: "抗性",
        }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    }
    if (!base.value.restraint) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        const __VLS_14 = __VLS_tryAsConstant((__VLS_unwrap(MOD_NAME, {})));
        for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (k),
            });
            (n);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "pair" },
            });
            /** @type {__VLS_StyleScopedClasses['pair']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                placeholder: "0",
            });
            (base.value.stats[k]);
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(__VLS_ctx.kind === 'base'))
                            throw 0;
                        if (!(!base.value.restraint))
                            throw 0;
                        return (setScale(String(k), $event.target.value));
                        // @ts-ignore
                        [base, base, base, base, base, base, base, base, builtin, MOD_NAME,];
                    } },
                value: (base.value.scale?.[k] ?? ''),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            const __VLS_15 = __VLS_tryAsConstant((__VLS_unwrap(SCALE_NAME, {})));
            for (const [sn, sk] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (sk),
                    value: (sk),
                });
                (sn);
                // @ts-ignore
                [base, SCALE_NAME,];
            }
            // @ts-ignore
            [];
        }
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "8",
    });
    (mat.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (mat.value.kind),
        disabled: (builtin.value),
    });
    const __VLS_16 = __VLS_tryAsConstant((__VLS_unwrap(KINDS, {})));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_16))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [mat, mat, builtin, KINDS,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "5",
        disabled: (builtin.value),
        title: (builtin.value ? '內建材料的等級不能改（隨機裝備依類型與等級找材料）' : ''),
    });
    (mat.value.tier);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "10",
    });
    (mat.value.bonus);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (mat.value.rarity),
    });
    const __VLS_17 = __VLS_tryAsConstant((__VLS_unwrap(RARITY_ORDER, {})));
    for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (r),
            value: (r),
        });
        (__VLS_unwrap(rarityName, {})(r));
        // @ts-ignore
        [mat, mat, mat, builtin, builtin, RARITY_ORDER, rarityName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "30",
    });
    (mat.value.level);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0.1",
        step: "0.5",
    });
    (mat.value.price);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
    });
    (mat.value.armor.evade);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
    });
    (mat.value.armor.dr);
    const __VLS_18 = AffinityRows;
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
        // @ts-ignore
        modelValue: (mat.value.resist), label: "防具與飾品的抗性",
    }));
    const __VLS_20 = __VLS_19({
        modelValue: (mat.value.resist),
        label: "防具與飾品的抗性",
    }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "block" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "120",
    });
    (mat.value.desc);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
(catalog.value.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain small list" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['list']} */ ;
const __VLS_23 = __VLS_tryAsConstant((catalog.value));
for (const [i] of __VLS_vFor(__VLS_nonNull(__VLS_23))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (i.name),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (i.name);
    (__VLS_unwrap(gearSummary, {})(i.gear));
    (__VLS_unwrap(formatMoney, {})(i.price_cc));
    // @ts-ignore
    [mat, mat, mat, mat, mat, mat, formatMoney, catalog, catalog, gearSummary,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
