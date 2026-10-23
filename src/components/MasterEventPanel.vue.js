import { computed, ref } from 'vue';
import { safeText } from '@/engine/content';
import { attrName, slaveryRules } from '@/engine/data';
import { pendingEventDef } from '@/engine/slavery';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
import JudgeToggle from './JudgeToggle.vue';
import { contractOf } from '@/engine/tattoos';
// 主人的突發事件：三選一，或自己輸入回應（見 docs/COMPANIONS.md 2.4）
const game = useGame();
const s = computed(() => game.state);
const ev = computed(() => s.value.pendingMasterEvent);
const def = computed(() => pendingEventDef(s.value));
const master = computed(() => contractOf(s.value.party.find((m) => m.isPlayer))?.masterName ?? '主人');
const busy = computed(() => game.judging || !!s.value.pendingAction);
const text = ref('');
const use = ref('');
function respond() {
    const u = parseUse(use.value);
    void game.perform({ kind: 'master_event', text: text.value, ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(ev, {});
// @ts-ignore
__VLS_withDotValue(def, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(slaveryRules, {});
// @ts-ignore
__VLS_withDotValue(text, {});
void {};
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['options']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel master-event" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['master-event']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
(__VLS_unwrap(master, {}));
const __VLS_0 = JudgeToggle;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
// @ts-ignore
}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
(ev.value.text);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "options" },
});
/** @type {__VLS_StyleScopedClasses['options']} */ ;
const __VLS_5 = __VLS_tryAsConstant((def.value.options));
for (const [o, i] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (game.value.answerMasterEvent(i));
                // @ts-ignore
                [master, ev, def, game,];
            } },
        key: (o.label),
        ...{ class: "small" },
        disabled: (__VLS_unwrap(busy, {})),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(safeText, {})(o.label));
    if (o.check) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(attrName, {})(o.check.attr));
        (o.check.dc);
    }
    // @ts-ignore
    [busy, safeText, attrName,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(def.value.free_dc ?? slaveryRules.value.master_events.free_dc);
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (text.value),
    rows: "2",
    placeholder: "例如：端上一杯熱茶，問主人今天遇到了什麼事",
});
const __VLS_6 = AbilityPicker;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    // @ts-ignore
    modelValue: (__VLS_unwrap(use, {})),
}));
const __VLS_8 = __VLS_7({
    modelValue: (__VLS_unwrap(use, {})),
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (respond) },
    ...{ class: "small primary" },
    disabled: (!text.value.trim() || __VLS_unwrap(busy, {})),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
// @ts-ignore
[def, busy, slaveryRules, text, text, use,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
