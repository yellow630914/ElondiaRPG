import { computed, ref } from 'vue';
import mapUrl from '../../assets/map/elondia-map.webp';
import { geography, locationById } from '@/engine/data';
import { currentArea, DUNGEON_LAYERS } from '@/engine/grid';
import { layerRank } from '@/engine/materialQuests';
import { useGame } from '@/stores/game';
import AppDialog from './AppDialog.vue';
import AreaMap from './AreaMap.vue';
import ExpeditionBar from './ExpeditionBar.vue';
const game = useGame();
const s = computed(() => game.state);
const here = computed(() => locationById(s.value.location));
const area = computed(() => currentArea(s.value));
const layerName = computed(() => (area.value.kind === 'dungeon' && area.value.layer !== undefined ? DUNGEON_LAYERS[area.value.layer]?.name : undefined));
/** 建議階級：看目前這一層的怪物（地下城沒有整座的階級） */
const layerRankHere = computed(() => {
    const a = area.value;
    if (a.kind !== 'dungeon')
        return undefined;
    const id = DUNGEON_LAYERS[a.layer ?? 0]?.id;
    return id ? layerRank(a.location, id) : undefined;
});
const showWorldMap = ref(false);
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(area, {});
// @ts-ignore
__VLS_withDotValue(here, {});
// @ts-ignore
__VLS_withDotValue(geography, {});
// @ts-ignore
__VLS_withDotValue(layerName, {});
// @ts-ignore
__VLS_withDotValue(layerRankHere, {});
// @ts-ignore
__VLS_withDotValue(showWorldMap, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
(area.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted small" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(here.value.name);
(geography.value.regions.find((r) => r.id === here.value.region)?.name);
if (layerName.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (layerName.value);
}
if (layerRankHere.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (layerRankHere.value);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (showWorldMap.value = true);
            // @ts-ignore
            [area, here, here, geography, layerName, layerName, layerRankHere, layerRankHere, showWorldMap,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_0 = ExpeditionBar;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
// @ts-ignore
}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_5 = AreaMap;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
// @ts-ignore
}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const __VLS_10 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showWorldMap.value), title: "埃隆迪亞大陸", icon: "🗺️", width: "1100px",
}));
const __VLS_12 = __VLS_11({
    ...{ 'onClose': {} },
    open: (showWorldMap.value),
    title: "埃隆迪亞大陸",
    icon: "🗺️",
    width: "1100px",
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
const __VLS_16 = {
    /** @type {typeof __VLS_15.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showWorldMap.value = false);
        // @ts-ignore
        [showWorldMap, showWorldMap,];
    },
};
void __VLS_16;
const { default: __VLS_17 } = __VLS_nonNull(__VLS_13.slots);
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    src: (__VLS_unwrap(mapUrl, {})),
    alt: "埃隆迪亞大陸地圖",
    ...{ class: "world-map" },
});
/** @type {__VLS_StyleScopedClasses['world-map']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(here.value.name);
(geography.value.regions.find((r) => r.id === here.value.region)?.name);
// @ts-ignore
[here, here, geography, mapUrl,];
var __VLS_13;
var __VLS_14;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
