import { computed, reactive, ref } from 'vue';
import { actionRules, ATTR_IDS, attrName, damageTypes, npcTags, perkRules } from '@/engine/data';
import { perkPower, sanitizePerk } from '@/engine/perks';
const { defineProps, defineEmits, } = {};
const emit = defineEmits();
const props = defineProps();
const c = perkRules.custom;
const flaw = ref(false);
/** 輸入的是大小（正數），缺陷時換成負的 */
const range = computed(() => {
    const f = flaw.value ? c.flaw : c;
    const mag = (r) => [Math.min(Math.abs(r[0]), Math.abs(r[1])), Math.max(Math.abs(r[0]), Math.abs(r[1]))];
    return { check: mag(f.check_bonus), combat: mag(f.combat) };
});
const name = ref('');
const desc = ref('');
const rows = reactive([]);
const COMBAT = { hit: '命中', evade: '迴避', save: '豁免', damage: '傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊' };
const contexts = Object.entries(perkRules.contexts);
const kinds = Object.entries(actionRules.kinds).map(([k, v]) => [k, v.name]);
const tags = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name]);
const dmgTypes = damageTypes.types.map((t) => [t.id, t.name]);
function addRow() {
    if (rows.length >= c.effects)
        return;
    rows.push({ type: 'check', scope: 'attr', value: 'cha', bonus: 1, stat: 'hit', amount: 1, dmg: dmgTypes[0]?.[0] ?? 'fire', resist: -0.25 });
}
function scopeValues(scope) {
    if (scope === 'attr')
        return ATTR_IDS.map((a) => [a, attrName(a)]);
    if (scope === 'context')
        return contexts;
    if (scope === 'kind')
        return kinds;
    if (scope === 'tag')
        return tags;
    return [];
}
function setScope(r, scope) {
    r.scope = scope;
    r.value = scopeValues(scope)[0]?.[0] ?? '';
}
const draft = computed(() => {
    const sign = flaw.value ? -1 : 1;
    return sanitizePerk({
        name: name.value, desc: desc.value, flaw: flaw.value,
        effects: rows.map((r) => {
            if (r.type === 'combat')
                return { combat: { [r.stat]: sign * Math.abs(r.amount) } };
            if (r.type === 'resist')
                return { resist: { [r.dmg]: sign * Math.abs(r.resist) * -1 } };
            const key = { all: '', attr: 'attrs', context: 'contexts', kind: 'kinds', tag: 'vs_tags' }[r.scope];
            return { check: key ? { [key]: [r.value] } : {}, bonus: sign * Math.abs(r.bonus) };
        }),
    }, `c-${Date.now().toString(36)}`, undefined, props.allowFlaw);
});
function add() {
    if (!draft.value)
        return;
    emit('add', draft.value);
    name.value = '';
    desc.value = '';
    flaw.value = false;
    rows.splice(0);
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
__VLS_withDotValue(c, {});
// @ts-ignore
__VLS_withDotValue(flaw, {});
// @ts-ignore
__VLS_withDotValue(range, {});
// @ts-ignore
__VLS_withDotValue(rows, {});
// @ts-ignore
__VLS_withDotValue(draft, {});
void {};
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "builder small" },
});
/** @type {__VLS_StyleScopedClasses['builder']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: (c.value.name_chars),
    placeholder: "例如：酒館之子",
});
(__VLS_unwrap(name, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "grow" },
});
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: (c.value.desc_chars),
});
(__VLS_unwrap(desc, {}));
if (__VLS_ctx.allowFlaw) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (flaw.value);
}
const __VLS_0 = __VLS_tryAsConstant((rows.value));
for (const [r, i] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "row effect" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['effect']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (r.type),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "check",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "combat",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "resist",
    });
    if (r.type === 'check') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(r.type === 'check'))
                        throw 0;
                    return (setScope(r, $event.target.value));
                    // @ts-ignore
                    [c, c, name, desc, allowFlaw, flaw, rows,];
                } },
            value: (r.scope),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "all",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "attr",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "context",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "kind",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "tag",
        });
        if (r.scope !== 'all') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (r.value),
            });
            const __VLS_1 = __VLS_tryAsConstant((scopeValues(r.scope)));
            for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (k),
                    value: (k),
                });
                (n);
                // @ts-ignore
                [];
            }
        }
        (flaw.value ? '−' : '+');
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: (range.value.check[0]),
            max: (range.value.check[1]),
            ...{ class: "num" },
        });
        (r.bonus);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    else if (r.type === 'combat') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.stat),
        });
        const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(COMBAT, {})));
        for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (k),
                value: (k),
            });
            (n);
            // @ts-ignore
            [flaw, range, range, COMBAT,];
        }
        (flaw.value ? '−' : '+');
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: (range.value.combat[0]),
            max: (range.value.combat[1]),
            ...{ class: "num" },
        });
        (r.amount);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.dmg),
        });
        const __VLS_3 = __VLS_tryAsConstant((__VLS_unwrap(dmgTypes, {})));
        for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (k),
                value: (k),
            });
            (n);
            // @ts-ignore
            [flaw, range, range, dmgTypes,];
        }
        if (flaw.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (r.resist),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: (-0.25),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: (-0.5),
            });
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (r.resist),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: (-0.25),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: (-0.5),
            });
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (rows.value.splice(i, 1));
                // @ts-ignore
                [flaw, rows,];
            } },
        ...{ class: "small x" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['x']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addRow) },
    ...{ class: "small" },
    disabled: (rows.value.length >= c.value.effects),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(c.value.effects);
if (draft.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (draft.value.desc);
    (__VLS_unwrap(perkPower, {})(draft.value));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (add) },
    ...{ class: "small primary" },
    disabled: (!draft.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
(flaw.value ? '加入這個缺陷' : '加入這個特質');
// @ts-ignore
[c, c, flaw, rows, draft, draft, draft, draft, perkPower,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
