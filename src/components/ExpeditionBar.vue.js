import { computed } from 'vue';
import { formatMoney } from '@/engine/money';
import { currentArea, currentCell, DUNGEON_LAYERS } from '@/engine/grid';
import { areaLighting, currentLight, isDark, isNight, lightSources } from '@/engine/light';
import { DEFEAT_LOOT_NAME, defeatLootRule, retreatDc } from '@/engine/expedition';
import { useGame } from '@/stores/game';
// 地圖下方的狀態列：光線與光源、地下城這趟探索撿到的東西、緊急撤退
const game = useGame();
const s = computed(() => game.state);
const area = computed(() => currentArea(s.value));
const show = computed(() => area.value.kind !== 'settlement' && area.value.kind !== 'road');
const lighting = computed(() => {
    const l = areaLighting(area.value);
    const dark = isDark(s.value, area.value);
    if (l === 'lit')
        return { icon: '💡', text: '有光' };
    if (l === 'daylight')
        return dark ? { icon: '🌙', text: '夜裡一片漆黑' } : { icon: '☀️', text: '白天有光' };
    return { icon: '🌑', text: '黑暗' };
});
const dark = computed(() => isDark(s.value, area.value));
const light = computed(() => currentLight(s.value));
const spare = computed(() => lightSources(s.value).filter((x) => !x.permanent).reduce((n, x) => n + x.spare, 0));
const expedition = computed(() => (area.value.kind === 'dungeon' && s.value.expedition?.location === s.value.location ? s.value.expedition : undefined));
const lootCount = computed(() => expedition.value?.loot.reduce((n, l) => n + l.qty, 0) ?? 0);
const lootTitle = computed(() => expedition.value?.loot.map((l) => `${l.name}×${l.qty}`).join('、') ?? '');
const safe = computed(() => currentCell(s.value).kind === 'safe');
const atEntrance = computed(() => (area.value.layer ?? 0) === 0 && currentCell(s.value).kind === 'exit');
const busy = computed(() => !!s.value.combat || game.judging || !!s.value.standoff);
const night = computed(() => isNight(s.value.time));
function retreat() {
    const msg = safe.value ? '從安全房循原路撤出地下城？' : `撤出地下城？隊伍中靈巧最高的人帶路檢定（DC ${retreatDc(s.value, area.value)}），失敗會被魔物追上打一場。`;
    if (confirm(msg))
        game.retreat();
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(show, {});
// @ts-ignore
__VLS_withDotValue(night, {});
// @ts-ignore
__VLS_withDotValue(lighting, {});
// @ts-ignore
__VLS_withDotValue(dark, {});
// @ts-ignore
__VLS_withDotValue(light, {});
// @ts-ignore
__VLS_withDotValue(spare, {});
// @ts-ignore
__VLS_withDotValue(expedition, {});
// @ts-ignore
__VLS_withDotValue(lootTitle, {});
// @ts-ignore
__VLS_withDotValue(DUNGEON_LAYERS, {});
// @ts-ignore
__VLS_withDotValue(DEFEAT_LOOT_NAME, {});
// @ts-ignore
__VLS_withDotValue(atEntrance, {});
// @ts-ignore
__VLS_withDotValue(safe, {});
void {};
/** @type {__VLS_StyleScopedClasses['exp']} */ ;
if (show.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "exp small" },
    });
    /** @type {__VLS_StyleScopedClasses['exp']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        title: (night.value ? '晚上' : '白天'),
    });
    (lighting.value.icon);
    (lighting.value.text);
    if (dark.value) {
        if (light.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ok" },
                title: (light.value.permanent ? '不會燒掉' : '在黑暗的地方每走一格燒掉一點，燒完自動點下一份'),
            });
            /** @type {__VLS_StyleScopedClasses['ok']} */ ;
            (light.value.permanent ? '✨' : '🔥');
            (light.value.name);
            if (light.value.left !== undefined) {
                (light.value.left);
            }
            if (!light.value.permanent) {
                (spare.value);
            }
        }
        else if (spare.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
                title: "在黑暗的地方走一步就會點起來",
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (spare.value);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "warn" },
                title: "視野只剩腳下、戰鬥中命中降低、陷阱更難察覺",
            });
            /** @type {__VLS_StyleScopedClasses['warn']} */ ;
        }
    }
    if (expedition.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            title: (lootTitle.value || '還沒撿到東西'),
        });
        (DUNGEON_LAYERS.value[expedition.value.deepest]?.name);
        (__VLS_unwrap(lootCount, {}));
        if (expedition.value.money_cc) {
            (__VLS_unwrap(formatMoney, {})(expedition.value.money_cc));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
            title: "可以在 ⚙️ 設定的「這個存檔的規則」修改",
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (DEFEAT_LOOT_NAME.value[__VLS_unwrap(defeatLootRule, {})(__VLS_unwrap(s, {}))]);
        if (!atEntrance.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (retreat) },
                ...{ class: "small" },
                disabled: (__VLS_unwrap(busy, {})),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (safe.value ? '從安全房撤出' : '緊急撤退');
        }
    }
}
// @ts-ignore
[show, night, lighting, lighting, dark, light, light, light, light, light, light, light, spare, spare, spare, expedition, expedition, expedition, expedition, lootTitle, DUNGEON_LAYERS, lootCount, formatMoney, DEFEAT_LOOT_NAME, defeatLootRule, s, atEntrance, busy, safe,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
