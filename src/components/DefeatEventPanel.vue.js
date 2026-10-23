import { computed, ref } from 'vue';
import { attrName, combatRules } from '@/engine/data';
import { parseUse, useGame } from '@/stores/game';
import { useSettings } from '@/stores/settings';
import AbilityPicker from './AbilityPicker.vue';
import JudgeToggle from './JudgeToggle.vue';
// 成人向的戰敗事件：敵人圍了上來，三選一或自己描述反應（data/rules/combat.json 的 defeat_event）
const game = useGame();
const settings = useSettings();
const s = computed(() => game.state);
const ev = computed(() => s.value.pendingDefeat);
const rules = combatRules.defeat_event;
const busy = computed(() => game.judging || !!s.value.pendingAction);
const text = ref('');
const use = ref('');
const foes = computed(() => ev.value.foes.map((f) => f.name).join('、'));
function choose(i) {
    void game.perform({ kind: 'defeat_event', target: `opt:${i}`, text: rules.options[i].label });
}
function respond() {
    const u = parseUse(use.value);
    void game.perform({ kind: 'defeat_event', target: 'free', text: text.value, ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(ev, {});
// @ts-ignore
__VLS_withDotValue(rules, {});
// @ts-ignore
__VLS_withDotValue(text, {});
// @ts-ignore
__VLS_withDotValue(game, {});
void {};
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['options']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel defeat-event" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['defeat-event']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
if (settings.value.adult) {
    const __VLS_0 = JudgeToggle;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    }));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
if (settings.value.adult) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (ev.value.scene);
    (__VLS_unwrap(foes, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "options" },
    });
    /** @type {__VLS_StyleScopedClasses['options']} */ ;
    const __VLS_5 = __VLS_tryAsConstant((rules.value.options));
    for (const [o, i] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(settings.value.adult))
                        throw 0;
                    return (choose(i));
                    // @ts-ignore
                    [settings, settings, ev, foes, rules,];
                } },
            key: (o.label),
            ...{ class: "small" },
            disabled: (__VLS_unwrap(busy, {})),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (o.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(attrName, {})(o.attr));
        (o.dc);
        // @ts-ignore
        [busy, attrName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (rules.value.free_dc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (text.value),
        rows: "2",
        placeholder: "例如：假裝昏迷，等最近的那個靠過來時抓起沙子往牠臉上撒",
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_unwrap(foes, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(settings.value.adult))
                    throw 0;
                return (game.value.skipDefeatEvent());
                // @ts-ignore
                [foes, rules, busy, text, text, use, game,];
            } },
        ...{ class: "small primary" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
