import { computed } from 'vue';
import { choosablePerks, perkRules } from '@/engine/data';
import { creationPerks, racePerks } from '@/engine/perks';
import PerkBuilder from './PerkBuilder.vue';
const { defineProps, defineModel, } = {};
// 建立角色時的特質：清單裡的任選（perks.json 的 creation.slots 不是 0 時有名額），也可以自訂。
// 缺陷最多選兩個，每個多一個一般特質的名額。
const perks = defineModel('perks', { required: true });
const custom = defineModel('custom', { required: true });
const props = defineProps();
const allowed = (p) => (!p.requires?.races?.length || p.requires.races.includes(props.race)) && (!p.requires?.classes?.length || p.requires.classes.includes(props.cls));
const list = computed(() => choosablePerks().filter((p) => !p.flaw && allowed(p)));
const flaws = computed(() => choosablePerks().filter((p) => p.flaw && allowed(p)));
const picked = computed(() => [...perkRules.perks.filter((x) => perks.value.includes(x.id)), ...custom.value]);
const count = computed(() => creationPerks(picked.value));
const rules = perkRules.creation;
function toggle(id) {
    perks.value = perks.value.includes(id) ? perks.value.filter((x) => x !== id) : [...perks.value, id];
}
function blocked(p) {
    if (perks.value.includes(p.id))
        return false;
    if (picked.value.some((o) => o.exclusive?.includes(p.id) || p.exclusive?.includes(o.id)))
        return true;
    // 名額：缺陷最多 max_flaws 個；一般特質不超過名額
    const c = count.value;
    return p.flaw ? c.flaws >= rules.max_flaws : c.slots !== null && c.normal >= c.slots;
}
function addCustom(p) {
    const c = creationPerks([...picked.value, p]);
    if (c.error)
        return;
    custom.value = [...custom.value, p];
}
let __VLS_modelEmit;
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
__VLS_withDotValue(count, {});
// @ts-ignore
__VLS_withDotValue(rules, {});
// @ts-ignore
__VLS_withDotValue(perks, {});
// @ts-ignore
__VLS_withDotValue(custom, {});
void {};
/** @type {__VLS_StyleScopedClasses['perks']} */ ;
/** @type {__VLS_StyleScopedClasses['perks']} */ ;
/** @type {__VLS_StyleScopedClasses['perk']} */ ;
/** @type {__VLS_StyleScopedClasses['perk']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "perks" },
});
/** @type {__VLS_StyleScopedClasses['perks']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(count.value.normal);
(count.value.slots !== null ? ` / ${count.value.slots}` : '');
(count.value.flaws);
(rules.value.max_flaws);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(rules.value.slots > 0 ? `一般特質有 ${rules.value.slots} 個名額，每選一個缺陷多 ${rules.value.slots_per_flaw} 個。` : '建立角色時一般特質不限數量。');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(racePerks, {})(__VLS_ctx.race)));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (p.id),
        ...{ class: "perk small on" },
        title: (p.desc),
    });
    /** @type {__VLS_StyleScopedClasses['perk']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['on']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        checked: true,
        disabled: true,
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (p.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (p.desc);
    // @ts-ignore
    [count, count, count, count, rules, rules, rules, rules, racePerks, race,];
}
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(list, {})));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (p.id),
        ...{ class: "perk small" },
        ...{ class: ({ on: perks.value.includes(p.id) }) },
        title: (p.desc),
    });
    /** @type {__VLS_StyleScopedClasses['perk']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['on']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (toggle(p.id));
                // @ts-ignore
                [list, perks,];
            } },
        type: "checkbox",
        checked: (perks.value.includes(p.id)),
        disabled: (blocked(p)),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (p.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (p.desc);
    // @ts-ignore
    [perks,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
(count.value.flaws);
(rules.value.max_flaws);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(rules.value.max_flaws);
(rules.value.slots > 0 ? `，每個多一個一般特質的名額` : '');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(flaws, {})));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (p.id),
        ...{ class: "perk small" },
        ...{ class: ({ on: perks.value.includes(p.id) }) },
        title: (p.desc),
    });
    /** @type {__VLS_StyleScopedClasses['perk']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['on']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (toggle(p.id));
                // @ts-ignore
                [count, rules, rules, rules, perks, flaws,];
            } },
        type: "checkbox",
        checked: (perks.value.includes(p.id)),
        disabled: (blocked(p)),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (p.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (p.desc);
    // @ts-ignore
    [perks,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
(custom.value.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
const __VLS_3 = __VLS_tryAsConstant((custom.value));
for (const [p, i] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (p.id),
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
    (p.name);
    if (p.flaw) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    }
    (p.desc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (custom.value = custom.value.filter((_, j) => j !== i));
                // @ts-ignore
                [custom, custom, custom, custom,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    // @ts-ignore
    [];
}
const __VLS_4 = PerkBuilder;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent1(__VLS_4, new __VLS_4({
    // @ts-ignore
    ...{ 'onAdd': {} }, allowFlaw: true,
}));
const __VLS_6 = __VLS_5({
    ...{ 'onAdd': {} },
    allowFlaw: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_9;
const __VLS_10 = {
    /** @type {typeof __VLS_9.add} */
    onAdd: (addCustom),
};
void __VLS_10;
var __VLS_7;
var __VLS_8;
if (count.value.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "bad" },
    });
    /** @type {__VLS_StyleScopedClasses['bad']} */ ;
    (count.value.error);
}
// @ts-ignore
[count, count,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
