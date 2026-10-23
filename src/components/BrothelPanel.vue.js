import { computed, ref } from 'vue';
import { madamHere, patronPrice } from '@/engine/brothel';
import { safeText } from '@/engine/content';
import { contractDef, raceName, slaveryRules } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { npcTitle } from '@/engine/npcs';
import { isBound, isEnslaved } from '@/engine/party';
import { nearbyPeople } from '@/engine/population';
import { seekMasterDc } from '@/engine/slavery';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
// 娼館（關閉成人向時是按摩店）：消費、找老鴇當主人
const game = useGame();
const s = computed(() => game.state);
const busy = computed(() => game.judging || !!s.value.pendingAction);
const bound = computed(() => isBound(s.value));
const marked = computed(() => isEnslaved(s.value) && !bound.value);
const madam = computed(() => madamHere(s.value));
const workers = computed(() => nearbyPeople(s.value)
    .filter((p) => p.rec.tags?.includes('prostitute') && p.rec.id !== madam.value?.id)
    .map((p) => ({ id: p.rec.id, name: p.rec.name, title: `${raceName(p.rec.race)}・${npcTitle(p.rec)}`, price: patronPrice(s.value, p.rec.id) })));
const target = ref('');
const price = computed(() => patronPrice(s.value, target.value || undefined));
const text = ref('');
const use = ref('');
function patron() {
    const u = parseUse(use.value);
    void game.perform({ kind: 'patron', text: text.value, ...(target.value ? { target: target.value } : {}), ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
}
function seekMadam() {
    void game.perform({ kind: 'seek_master', target: madam.value.id, text: text.value });
    text.value = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(bound, {});
// @ts-ignore
__VLS_withDotValue(busy, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(marked, {});
// @ts-ignore
__VLS_withDotValue(madam, {});
// @ts-ignore
__VLS_withDotValue(slaveryRules, {});
void {};
/** @type {__VLS_StyleScopedClasses['brothel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "brothel small" },
});
/** @type {__VLS_StyleScopedClasses['brothel']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(safeText, {})('娼館。老鴇招呼著客人，娼妓們在廳裡陪酒說笑。'));
if (bound.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mark" },
    });
    /** @type {__VLS_StyleScopedClasses['mark']} */ ;
    (__VLS_unwrap(safeText, {})('有主人的奴隸不能在娼館消費。被主人帶著經過時，還可能被推進去接客。'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    (__VLS_unwrap(safeText, {})('消費'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(target, {})),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    (__VLS_unwrap(safeText, {})('交給老鴇安排'));
    (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(patronPrice, {})(s.value)));
    const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(workers, {})));
    for (const [w] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (w.id),
            value: (w.id),
        });
        (w.name);
        (w.title);
        (__VLS_unwrap(formatMoney, {})(w.price));
        // @ts-ignore
        [safeText, safeText, safeText, safeText, bound, target, formatMoney, formatMoney, patronPrice, s, workers,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: (__VLS_unwrap(safeText, {})('想怎麼度過（選填，會交給 AI 判定與描寫）')),
    });
    (__VLS_unwrap(text, {}));
    const __VLS_1 = AbilityPicker;
    // @ts-ignore
    const __VLS_2 = __VLS_asFunctionalComponent1(__VLS_1, new __VLS_1({
        // @ts-ignore
        modelValue: (__VLS_unwrap(use, {})),
    }));
    const __VLS_3 = __VLS_2({
        modelValue: (__VLS_unwrap(use, {})),
    }, ...__VLS_functionalComponentArgsRest(__VLS_2));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (patron) },
        ...{ class: "small primary" },
        disabled: (busy.value || s.value.money_cc < __VLS_unwrap(price, {})),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(price, {})));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(safeText, {})('魅力檢定：表現好可以打折、身心放鬆（下次長休前檢定 +1）；搞砸了可能被多收錢，甚至被摸走錢袋。'));
}
if (marked.value && madam.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    (__VLS_unwrap(safeText, {})('請老鴇收留'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(safeText, {})(`你身上有印記卻沒有人帶著：可以請${madam.value.name}收下你（魅力，DC ${__VLS_unwrap(seekMasterDc, {})(s.value, madam.value)}）。老鴇會把印記改刻成${__VLS_unwrap(contractDef, {})(slaveryRules.value.roles.madam).name}，收入九成歸她。`));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (seekMadam) },
        ...{ class: "small" },
        disabled: (busy.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(safeText, {})(`請${madam.value.name}收留`));
}
// @ts-ignore
[safeText, safeText, safeText, safeText, safeText, formatMoney, s, s, text, use, busy, busy, price, price, marked, madam, madam, madam, madam, seekMasterDc, contractDef, slaveryRules,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
