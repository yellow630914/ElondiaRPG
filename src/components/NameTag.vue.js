import { computed } from 'vue';
import { className, classEmoji, genderDef, raceEmoji, raceName } from '@/engine/data';
import { npcRecord } from '@/engine/npcs';
import { useGame } from '@/stores/game';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const info = computed(() => {
    const s = game.state;
    const member = props.id && s ? s.party.find((m) => m.id === props.id) : undefined;
    const rec = !member && props.id && s ? npcRecord(s, props.id) : undefined;
    const src = member ?? rec;
    return {
        name: props.name ?? src?.name ?? (props.id && s?.relationships?.[props.id]?.name) ?? props.id ?? '',
        race: props.race ?? src?.race,
        cls: props.cls ?? src?.class,
        gender: props.gender ?? src?.gender,
    };
});
const gender = computed(() => genderDef(info.value.gender));
const title = computed(() => [gender.value?.name ?? info.value.gender, info.value.race && raceName(info.value.race), info.value.cls && className(info.value.cls)]
    .filter(Boolean).join('・'));
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
__VLS_withDotValue(info, {});
// @ts-ignore
__VLS_withDotValue(gender, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "name-tag" },
    title: (__VLS_unwrap(title, {})),
});
/** @type {__VLS_StyleScopedClasses['name-tag']} */ ;
if (info.value.race) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "emoji" },
    });
    /** @type {__VLS_StyleScopedClasses['emoji']} */ ;
    (__VLS_unwrap(raceEmoji, {})(info.value.race));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "name" },
    ...{ style: (gender.value ? { color: gender.value.color } : {}) },
});
/** @type {__VLS_StyleScopedClasses['name']} */ ;
(info.value.name);
if (info.value.cls) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "emoji" },
    });
    /** @type {__VLS_StyleScopedClasses['emoji']} */ ;
    (__VLS_unwrap(classEmoji, {})(info.value.cls));
}
// @ts-ignore
[title, info, info, info, info, info, raceEmoji, gender, gender, classEmoji,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
