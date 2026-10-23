import { computed } from 'vue';
import { slotsLeft } from '@/engine/character';
import { abilityDef, classEmoji, raceEmoji } from '@/engine/data';
import { useGame } from '@/stores/game';
const { defineModel, } = {};
// 主動行動時搭配使用的能力（例如用魅惑術幫談判）：法術花法術環、限次技能花次數，換檢定加值。
const model = defineModel({ default: '' });
const game = useGame();
const options = computed(() => {
    const s = game.state;
    if (!s)
        return [];
    return s.party.filter((m) => m.hp > 0).flatMap((m) => m.abilities.map((id) => {
        const a = abilityDef(id);
        let note = '';
        let ok = true;
        if (a.type === 'spell') {
            const left = slotsLeft(m).slice((a.circle ?? 1) - 1).reduce((x, y) => x + y, 0);
            note = `${a.circle} 環法術・剩 ${left} 個可用法術環・+${Math.min(6, 2 + (a.circle ?? 1))}`;
            ok = left > 0;
        }
        else if (a.type === 'skill' && a.uses?.per_rest !== undefined) {
            const left = a.uses.per_rest - (m.usesPerRest[a.id] ?? 0);
            note = `每次休息 ${a.uses.per_rest} 次・剩 ${left}・+3`;
            ok = left > 0;
        }
        else
            note = a.type === 'cantrip' ? '戲法・+1' : '技能・+2';
        return { value: `${m.id}|${id}`, label: `${raceEmoji(m.race)}${m.name}${classEmoji(m.class)}：${a.name}（${note}）`, ok, title: a.desc };
    }));
});
const __VLS_defaultModels = {
    'modelValue': '',
};
void __VLS_defaultModels;
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
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(model, {})),
    ...{ class: "ability-picker" },
    title: "搭配使用的能力會先花掉資源，再換取檢定加值",
});
/** @type {__VLS_StyleScopedClasses['ability-picker']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(options, {})));
for (const [o] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (o.value),
        value: (o.value),
        disabled: (!o.ok),
        title: (o.title),
    });
    (o.label);
    // @ts-ignore
    [model, options,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
