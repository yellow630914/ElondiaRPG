import { computed, ref } from 'vue';
import { attrName, contractDef, slaveryRules } from '@/engine/data';
import { useGame } from '@/stores/game';
import MarkPicker from '../MarkPicker.vue';
import { contractOf } from '@/engine/tattoos';
// 刻下契約印記：刻印前還有一次檢定，之後選擇要刻的印記
const game = useGame();
const s = computed(() => game.state);
const pendingMark = computed(() => s.value.pendingMark);
const master = computed(() => contractOf(s.value.party.find((m) => m.isPlayer))?.masterName || '主人');
const markText = ref('');
const markChoice = ref(slaveryRules.roles.default);
function doMarking() {
    void game.perform({ kind: 'marking', text: markText.value });
    markText.value = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(pendingMark, {});
// @ts-ignore
__VLS_withDotValue(slaveryRules, {});
// @ts-ignore
__VLS_withDotValue(game, {});
void {};
/** @type {__VLS_StyleScopedClasses['marking']} */ ;
/** @type {__VLS_StyleScopedClasses['marking']} */ ;
/** @type {__VLS_StyleScopedClasses['marking']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel marking" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['marking']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
if (!pendingMark.value.rolled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(master, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_unwrap(contractDef, {})(pendingMark.value.intended).name);
    (__VLS_unwrap(contractDef, {})(pendingMark.value.intended).mark);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(attrName, {})(slaveryRules.value.marking.attr));
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (__VLS_unwrap(markText, {})),
        rows: "2",
        placeholder: "例如：低頭順從，懇求用最輕的印記；或趁刻印師分心時掙扎",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (doMarking) },
        ...{ class: "small primary" },
        disabled: (game.value.judging),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
}
else {
    if (pendingMark.value.suggestion?.name || pendingMark.value.suggestion?.mark) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small mark" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['mark']} */ ;
        (pendingMark.value.suggestion.name);
        (pendingMark.value.suggestion.mark);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (pendingMark.value.custom ? '，或自訂' : '');
    const __VLS_0 = MarkPicker;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        // @ts-ignore
        key: (pendingMark.value.allowed?.join()), modelValue: (__VLS_unwrap(markChoice, {})), allowed: (pendingMark.value.allowed), allowCustom: (pendingMark.value.custom), base: (pendingMark.value.intended),
    }));
    const __VLS_2 = __VLS_1({
        key: (pendingMark.value.allowed?.join()),
        modelValue: (__VLS_unwrap(markChoice, {})),
        allowed: (pendingMark.value.allowed),
        allowCustom: (pendingMark.value.custom),
        base: (pendingMark.value.intended),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(!pendingMark.value.rolled))
                    throw 0;
                return (game.value.chooseMark(__VLS_unwrap(markChoice, {})));
                // @ts-ignore
                [pendingMark, pendingMark, pendingMark, pendingMark, pendingMark, pendingMark, pendingMark, pendingMark, pendingMark, pendingMark, pendingMark, pendingMark, master, contractDef, contractDef, attrName, slaveryRules, markText, game, game, markChoice, markChoice,];
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
