import { computed } from 'vue';
import { damageTypeName, damageTypes } from '@/engine/data';
const { defineProps, defineModel, } = {};
// 傷害倍率的加減（抗性、攻擊加成）：每列一種傷害屬性或群組
const model = defineModel();
const __VLS_props = defineProps();
const keys = [...damageTypes.types.map((t) => t.id), ...Object.keys(damageTypes.groups), 'all'];
const name = (k) => (k === 'all' ? '全部' : damageTypeName(k));
const rows = computed(() => Object.entries(model.value ?? {}).filter((e) => e[1] !== undefined));
function set(oldKey, key, value) {
    const next = {};
    for (const [k, v] of Object.entries(model.value ?? {})) {
        if (k === oldKey)
            next[key] = value;
        else if (k !== key && v !== undefined)
            next[k] = v;
    }
    model.value = Object.keys(next).length ? next : undefined;
}
function remove(key) {
    const next = { ...(model.value ?? {}) };
    delete next[key];
    model.value = Object.keys(next).length ? next : undefined;
}
function add() {
    const free = keys.find((k) => !(k in (model.value ?? {})));
    if (free)
        model.value = { ...(model.value ?? {}), [free]: -0.25 };
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
void {};
/** @type {__VLS_StyleScopedClasses['row-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "aff" },
});
/** @type {__VLS_StyleScopedClasses['aff']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(__VLS_ctx.label);
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(rows, {})));
for (const [[k, v]] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (k),
        ...{ class: "row-item" },
    });
    /** @type {__VLS_StyleScopedClasses['row-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (set(k, $event.target.value, v));
                // @ts-ignore
                [label, rows,];
            } },
        value: (k),
    });
    const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(keys, {})));
    for (const [o] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (o),
            value: (o),
        });
        (__VLS_unwrap(name, {})(o));
        // @ts-ignore
        [keys, name,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (set(k, k, Number($event.target.value)));
                // @ts-ignore
                [];
            } },
        type: "number",
        step: "0.25",
        min: "-1",
        max: "2",
        value: (v),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (Math.max(0, Math.round((1 + v) * 100) / 100));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (remove(k));
                // @ts-ignore
                [];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (add) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
