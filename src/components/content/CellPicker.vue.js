import { computed, ref, watch } from 'vue';
import { geography, locationById } from '@/engine/data';
import { blockKeys, CELL_ICON, cellName, settlementArea } from '@/engine/grid';
import { useContent } from '@/stores/content';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const settlements = geography.locations.filter((l) => l.type !== 'dungeon');
const loc = ref(props.modelValue ? props.modelValue.area.split('/')[0] : props.location ?? settlements[0].id);
const blockKey = ref(props.modelValue?.area ?? blockKeys(loc.value)[0]);
watch(loc, (v) => {
    if (!blockKey.value.startsWith(`${v}/`))
        blockKey.value = blockKeys(v)[0];
});
const blocks = computed(() => blockKeys(loc.value).map((k) => ({ key: k, name: settlementArea(k)?.name ?? k })));
const area = computed(() => {
    void content.version;
    return settlementArea(blockKey.value);
});
const picked = computed(() => (props.modelValue && area.value && props.modelValue.area === blockKey.value ? props.modelValue.y * area.value.width + props.modelValue.x : -1));
const pickable = (kind) => kind === 'floor' || (!!props.self && kind === props.self);
function pick(i) {
    const a = area.value;
    if (!a || !pickable(a.cells[i].kind))
        return;
    emit('update:modelValue', { area: a.key, x: i % a.width, y: Math.floor(i / a.width) });
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
__VLS_withDotValue(loc, {});
// @ts-ignore
__VLS_withDotValue(area, {});
// @ts-ignore
__VLS_withDotValue(picked, {});
// @ts-ignore
__VLS_withDotValue(CELL_ICON, {});
void {};
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "picker" },
});
/** @type {__VLS_StyleScopedClasses['picker']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (!__VLS_ctx.lockLocation) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (loc.value),
    });
    const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(settlements, {})));
    for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (l.id),
            value: (l.id),
        });
        (l.name);
        // @ts-ignore
        [lockLocation, loc, settlements,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_unwrap(locationById, {})(loc.value).name);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(blockKey, {})),
});
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(blocks, {})));
for (const [b] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (b.key),
        value: (b.key),
    });
    (b.name);
    // @ts-ignore
    [loc, locationById, blockKey, blocks,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (area.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cells" },
        ...{ style: ({ gridTemplateColumns: `repeat(${area.value.width}, 22px)` }) },
    });
    /** @type {__VLS_StyleScopedClasses['cells']} */ ;
    const __VLS_2 = __VLS_tryAsConstant((area.value.cells));
    for (const [c, i] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(area.value))
                        throw 0;
                    return (pick(i));
                    // @ts-ignore
                    [area, area, area,];
                } },
            key: (i),
            ...{ class: "cell" },
            ...{ class: ([c.kind, { picked: i === picked.value, off: !__VLS_unwrap(pickable, {})(c.kind) }]) },
            title: (__VLS_unwrap(cellName, {})(c.kind)),
        });
        /** @type {__VLS_StyleScopedClasses['cell']} */ ;
        /** @type {__VLS_StyleScopedClasses['picked']} */ ;
        /** @type {__VLS_StyleScopedClasses['off']} */ ;
        (i === picked.value ? __VLS_ctx.marker : CELL_ICON.value[c.kind] ?? '');
        // @ts-ignore
        [picked, picked, pickable, cellName, marker, CELL_ICON,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
