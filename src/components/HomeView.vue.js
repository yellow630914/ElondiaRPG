import { computed } from 'vue';
import { locationById } from '@/engine/data';
import { formatTime } from '@/engine/state';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import { usePrompts } from '@/stores/prompts';
const { defineEmits, } = {};
const emit = defineEmits();
const game = useGame();
const content = useContent();
const prompts = usePrompts();
const cur = computed(() => game.resumeMeta);
const place = (id) => {
    try {
        return locationById(id).name;
    }
    catch {
        return id;
    }
};
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
__VLS_withDotValue(cur, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(content, {});
// @ts-ignore
__VLS_withDotValue(prompts, {});
void {};
/** @type {__VLS_StyleScopedClasses['title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "home" },
});
/** @type {__VLS_StyleScopedClasses['home']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "title" },
});
/** @type {__VLS_StyleScopedClasses['title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "menu" },
});
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
if (cur.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(cur.value))
                    throw 0;
                return (game.value.continueGame());
                // @ts-ignore
                [cur, game,];
            } },
        ...{ class: "primary big continue" },
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['big']} */ ;
    /** @type {__VLS_StyleScopedClasses['continue']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small detail" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['detail']} */ ;
    (cur.value.pcName);
    (cur.value.level);
    (__VLS_unwrap(place, {})(cur.value.location));
    (__VLS_unwrap(formatTime, {})(cur.value.time));
    if (cur.value.world) {
        (cur.value.world);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('new'));
            // @ts-ignore
            [cur, cur, cur, cur, cur, cur, place, formatTime, emit,];
        } },
    ...{ class: "big" },
});
/** @type {__VLS_StyleScopedClasses['big']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('load'));
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "big" },
});
/** @type {__VLS_StyleScopedClasses['big']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('worlds'));
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "big" },
});
/** @type {__VLS_StyleScopedClasses['big']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small detail" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['detail']} */ ;
(content.value.activeName);
(content.value.worlds.length + 1);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('prompts'));
            // @ts-ignore
            [emit, content, content,];
        } },
    ...{ class: "big" },
});
/** @type {__VLS_StyleScopedClasses['big']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small detail" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['detail']} */ ;
(prompts.value.activeName);
(prompts.value.sets.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('settings'));
            // @ts-ignore
            [emit, prompts, prompts,];
        } },
    ...{ class: "big" },
});
/** @type {__VLS_StyleScopedClasses['big']} */ ;
if (cur.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
// @ts-ignore
[cur,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
