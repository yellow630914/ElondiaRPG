import { computed, ref } from 'vue';
import { attrOf } from '@/engine/character';
import { attrName, workRules } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { isBound, isFugitive } from '@/engine/party';
import { jobHere, workers, workPay, workTarget } from '@/engine/work';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
import { contractOf } from '@/engine/tattoos';
// 在設施上工作換錢（data/rules/work.json）
const game = useGame();
const s = computed(() => game.state);
const job = computed(() => jobHere(s.value));
const hours = ref(workRules.hours[1] ?? 4);
const text = ref('');
const use = ref('');
const blocked = computed(() => !!job.value?.official && isFugitive(s.value));
const share = computed(() => (isBound(s.value) ? contractOf(s.value.party.find((m) => m.isPlayer)) : undefined));
// 誰去做：主角自己，或派自己的奴隸（由奴隸擲檢定，工錢歸主角）
const slaves = computed(() => workers(s.value));
const picked = ref('');
const worker = computed(() => slaves.value.find((m) => m.id === picked.value));
function work() {
    const u = parseUse(use.value);
    void game.perform({ kind: 'work', target: workTarget(hours.value, worker.value?.id), text: text.value, ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(job, {});
// @ts-ignore
__VLS_withDotValue(share, {});
// @ts-ignore
__VLS_withDotValue(slaves, {});
// @ts-ignore
__VLS_withDotValue(blocked, {});
// @ts-ignore
__VLS_withDotValue(worker, {});
// @ts-ignore
__VLS_withDotValue(workRules, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(s, {});
void {};
/** @type {__VLS_StyleScopedClasses['work']} */ ;
if (job.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "work small" },
    });
    /** @type {__VLS_StyleScopedClasses['work']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    (job.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (job.value.desc);
    (__VLS_unwrap(attrName, {})(job.value.attr));
    (job.value.dc);
    (__VLS_unwrap(formatMoney, {})(job.value.rate_cc));
    if (share.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    if (slaves.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "who" },
        });
        /** @type {__VLS_StyleScopedClasses['who']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_unwrap(picked, {})),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        const __VLS_0 = __VLS_tryAsConstant((slaves.value));
        for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (m.id),
                value: (m.id),
            });
            (m.name);
            (__VLS_unwrap(attrName, {})(job.value.attr));
            (__VLS_unwrap(attrOf, {})(m, job.value.attr));
            // @ts-ignore
            [job, job, job, job, job, job, job, job, attrName, attrName, formatMoney, share, slaves, slaves, picked, attrOf,];
        }
    }
    if (blocked.value && !worker.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        const __VLS_1 = __VLS_tryAsConstant((workRules.value.hours));
        for (const [h] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (h),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "radio",
                value: (h),
            });
            (__VLS_unwrap(hours, {}));
            (h);
            (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(workPay, {})(job.value, h, 'success')));
            // @ts-ignore
            [job, formatMoney, blocked, worker, workRules, hours, workPay,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            placeholder: (worker.value ? `交代${worker.value.name}怎麼做（選填，會寫進日誌）` : '怎麼做（選填，會寫進日誌）：例如專心招呼熟客、偷偷打聽客人的消息'),
        });
        (__VLS_unwrap(text, {}));
        const __VLS_2 = AbilityPicker;
        // @ts-ignore
        const __VLS_3 = __VLS_asFunctionalComponent1(__VLS_2, new __VLS_2({
            // @ts-ignore
            modelValue: (__VLS_unwrap(use, {})),
        }));
        const __VLS_4 = __VLS_3({
            modelValue: (__VLS_unwrap(use, {})),
        }, ...__VLS_functionalComponentArgsRest(__VLS_3));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (work) },
            ...{ class: "small" },
            disabled: (game.value.judging || !!s.value.pendingAction),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (worker.value ? `派${worker.value.name}去工作` : '開始工作');
    }
}
// @ts-ignore
[worker, worker, worker, worker, text, use, game, s,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
