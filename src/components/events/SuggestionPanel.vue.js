import { computed, ref, watch } from 'vue';
import { useGame } from '@/stores/game';
import NameTag from '../NameTag.vue';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const current = computed(() => game.state?.suggestions?.find((x) => x.id === props.id));
const rel = computed(() => (current.value ? game.state?.relationships?.[current.value.npc] : undefined));
const editing = ref(false);
const draft = ref('');
watch(current, (c) => {
    editing.value = false;
    draft.value = c?.text ?? '';
}, { immediate: true });
function accept() {
    if (current.value)
        game.acceptSuggestion(current.value.id, editing.value ? draft.value : current.value.text);
}
function reject() {
    if (current.value)
        game.rejectSuggestion(current.value.id);
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(current, {});
// @ts-ignore
__VLS_withDotValue(rel, {});
// @ts-ignore
__VLS_withDotValue(editing, {});
void {};
/** @type {__VLS_StyleScopedClasses['suggestion']} */ ;
/** @type {__VLS_StyleScopedClasses['suggestion']} */ ;
if (current.value && rel.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel suggestion" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['suggestion']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    const __VLS_0 = NameTag;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        // @ts-ignore
        id: (current.value.npc),
    }));
    const __VLS_2 = __VLS_1({
        id: (current.value.npc),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (rel.value.toPlayer);
    if (!editing.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small proposal" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['proposal']} */ ;
        (current.value.text);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_unwrap(draft, {})),
            rows: "3",
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (accept) },
        ...{ class: "small primary" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(current.value && rel.value))
                    throw 0;
                return (editing.value = !editing.value);
                // @ts-ignore
                [current, current, current, rel, rel, editing, editing, editing, draft,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (editing.value ? '取消修改' : '修改');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (reject) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
// @ts-ignore
[editing,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
