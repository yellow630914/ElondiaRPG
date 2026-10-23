import { computed, watch } from 'vue';
import { geography, landmarkDef, landmarksIn, regionById } from '@/engine/data';
import { blockKeys, CELL_ICON, cellName, settlementArea, ZONES } from '@/engine/grid';
const { defineProps, defineModel, } = {};
const target = defineModel({ required: true });
const props = defineProps();
const landmarkList = computed(() => landmarksIn(target.value.location));
const ZONE_NAME = { town: '城區', noble: '貴族區', palace: '王城', temple: '神殿', brothel: '娼館', outskirts: '近郊', dungeon: '地下城' };
const settlements = geography.locations.filter((l) => l.type !== 'dungeon');
const places = geography.locations;
const mode = computed({
    get: () => (target.value.landmark ? 'landmark' : target.value.fixed ? 'fixed' : 'haunts'),
    set: (v) => {
        delete target.value.landmark;
        if (v === 'fixed')
            setBlock(blockKeys(target.value.location)[0]);
        else
            delete target.value.fixed;
        if (v === 'landmark')
            target.value.landmark = landmarkList.value[0]?.id;
    },
});
const blocks = computed(() => blockKeys(target.value.location).map((k) => ({ key: k, area: settlementArea(k) })).filter((b) => b.area));
const block = computed(() => (target.value.fixed ? settlementArea(target.value.fixed.area) : undefined));
function pickCell(i) {
    const a = block.value;
    if (!a || !target.value.fixed)
        return;
    const kind = a.cells[i].kind;
    if (kind === 'wall' || kind === 'water')
        return;
    target.value.fixed = { area: a.key, x: i % a.width, y: Math.floor(i / a.width) };
}
function setBlock(key) {
    target.value.fixed = { area: key, x: 0, y: 0 };
    const a = settlementArea(key);
    const i = a?.cells.findIndex((c) => c.kind !== 'wall' && c.kind !== 'water') ?? -1;
    if (a && i >= 0)
        target.value.fixed = { area: key, x: i % a.width, y: Math.floor(i / a.width) };
}
// 換了所屬地點：固定的格子跟著換到那裡的第一個區塊，在原本地點的活躍地點也一起搬過去
watch(() => target.value.location, (loc, old) => {
    if (target.value.fixed && !blockKeys(loc).includes(target.value.fixed.area))
        setBlock(blockKeys(loc)[0]);
    if (target.value.landmark && landmarkDef(target.value.landmark)?.location !== loc) {
        if (landmarkList.value.length)
            target.value.landmark = landmarkList.value[0].id;
        else
            delete target.value.landmark;
    }
    for (const h of target.value.haunts ?? [])
        if (h.location === old)
            h.location = loc;
});
function addHaunt() {
    ;
    (target.value.haunts ??= []).push({ location: target.value.location, zone: 'town', weight: 1 });
}
const picked = computed(() => (target.value.fixed && block.value ? target.value.fixed.y * block.value.width + target.value.fixed.x : -1));
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
__VLS_withDotValue(target, {});
// @ts-ignore
__VLS_withDotValue(landmarkList, {});
// @ts-ignore
__VLS_withDotValue(mode, {});
// @ts-ignore
__VLS_withDotValue(ZONE_NAME, {});
// @ts-ignore
__VLS_withDotValue(block, {});
// @ts-ignore
__VLS_withDotValue(picked, {});
// @ts-ignore
__VLS_withDotValue(CELL_ICON, {});
void {};
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "placement" },
});
/** @type {__VLS_StyleScopedClasses['placement']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (target.value.location),
});
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(settlements, {})));
for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (l.id),
        value: (l.id),
    });
    (l.name);
    (__VLS_unwrap(regionById, {})(l.region).name);
    // @ts-ignore
    [target, settlements, regionById,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (mode.value),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "haunts",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "fixed",
});
if (props.allowLandmark) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "landmark",
        disabled: (!landmarkList.value.length),
    });
    (landmarkList.value.length ? '' : '（這裡沒有地標）');
}
if (mode.value === 'landmark') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (target.value.landmark),
    });
    const __VLS_1 = __VLS_tryAsConstant((landmarkList.value));
    for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (l.id),
            value: (l.id),
        });
        (l.emoji);
        (l.name);
        // @ts-ignore
        [target, mode, mode, landmarkList, landmarkList, landmarkList,];
    }
}
if (mode.value === 'landmark') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (mode.value === 'haunts') {
    const __VLS_2 = __VLS_tryAsConstant((target.value.haunts ?? []));
    for (const [h, i] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (h.location),
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        const __VLS_3 = __VLS_tryAsConstant((__VLS_unwrap(places, {})));
        for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (l.id),
                value: (l.id),
            });
            (l.name);
            // @ts-ignore
            [target, mode, mode, places,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (h.zone),
        });
        const __VLS_4 = __VLS_tryAsConstant((__VLS_unwrap(ZONES, {})));
        for (const [z] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (z),
                value: (z),
            });
            (ZONE_NAME.value[z]);
            // @ts-ignore
            [ZONES, ZONE_NAME,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "num" },
            type: "number",
            min: "0.01",
            step: "0.1",
        });
        (h.weight);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(mode.value === 'haunts'))
                        throw 0;
                    return (target.value.haunts.splice(i, 1));
                    // @ts-ignore
                    [target,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (addHaunt) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (!target.value.haunts?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
}
else if (target.value.fixed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(mode.value === 'haunts'))
                    throw 0;
                if (!(target.value.fixed))
                    throw 0;
                return (setBlock($event.target.value));
                // @ts-ignore
                [target, target,];
            } },
        value: (target.value.fixed.area),
    });
    const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(blocks, {})));
    for (const [b] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (b.key),
            value: (b.key),
        });
        (b.area.name);
        // @ts-ignore
        [target, blocks,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (target.value.fixed.x);
    (target.value.fixed.y);
    (block.value && picked.value >= 0 ? __VLS_unwrap(cellName, {})(block.value.cells[picked.value].kind) : '');
    if (block.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cells" },
            ...{ style: ({ gridTemplateColumns: `repeat(${block.value.width}, 22px)` }) },
        });
        /** @type {__VLS_StyleScopedClasses['cells']} */ ;
        const __VLS_6 = __VLS_tryAsConstant((block.value.cells));
        for (const [c, i] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(mode.value === 'haunts'))
                            throw 0;
                        if (!(target.value.fixed))
                            throw 0;
                        if (!(block.value))
                            throw 0;
                        return (pickCell(i));
                        // @ts-ignore
                        [target, target, block, block, block, block, block, picked, picked, cellName,];
                    } },
                key: (i),
                ...{ class: "cell" },
                ...{ class: ([c.kind, { picked: i === picked.value }]) },
                title: (__VLS_unwrap(cellName, {})(c.kind)),
            });
            /** @type {__VLS_StyleScopedClasses['cell']} */ ;
            /** @type {__VLS_StyleScopedClasses['picked']} */ ;
            (i === picked.value ? '🧍' : CELL_ICON.value[c.kind] ?? '');
            // @ts-ignore
            [picked, picked, cellName, CELL_ICON,];
        }
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
