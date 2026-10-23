import { computed, ref } from 'vue';
import { attrName } from '@/engine/data';
import { blockedReason, landmarkClosed, landmarkHere } from '@/engine/landmarks';
import { formatMoney } from '@/engine/money';
import { effectText } from '@/engine/trade';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
// 站在城鎮的特色地標上：開放的狀態、參訪、探索（data/world/landmarks.json，見 docs/LANDMARKS.md）
const game = useGame();
const s = computed(() => game.state);
const l = computed(() => landmarkHere(s.value));
const closed = computed(() => (l.value ? landmarkClosed(s.value, l.value) : undefined));
const visitBlocked = computed(() => (l.value?.visit ? blockedReason(s.value, 'visit') : undefined));
const exploreBlocked = computed(() => (l.value?.explore ? blockedReason(s.value, 'explore') : undefined));
const gains = (list = []) => list.map((e) => effectText(s.value, e)).join('、');
const text = ref('');
const use = ref('');
function explore() {
    const u = parseUse(use.value);
    void game.perform({ kind: 'explore', text: text.value, ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(l, {});
// @ts-ignore
__VLS_withDotValue(closed, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(visitBlocked, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(exploreBlocked, {});
void {};
/** @type {__VLS_StyleScopedClasses['item']} */ ;
/** @type {__VLS_StyleScopedClasses['item']} */ ;
if (l.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "landmark small" },
    });
    /** @type {__VLS_StyleScopedClasses['landmark']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (closed.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "warn-text" },
        });
        /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
        (closed.value);
    }
    if (l.value.visit) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "item" },
        });
        /** @type {__VLS_StyleScopedClasses['item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (l.value.visit.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (l.value.visit.money_cc ? `${__VLS_unwrap(formatMoney, {})(l.value.visit.money_cc)}・` : '');
        (l.value.visit.hours ?? 0.5);
        ((l.value.visit.cooldown_days ?? 1) > 1 ? `・每 ${l.value.visit.cooldown_days} 天一次` : '・每天一次');
        if (l.value.visit.desc) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (l.value.visit.desc);
        }
        if (__VLS_unwrap(gains, {})(l.value.visit.effects)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(gains, {})(l.value.visit.effects));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(l.value))
                        throw 0;
                    if (!(l.value.visit))
                        throw 0;
                    return (game.value.visitLandmark());
                    // @ts-ignore
                    [l, l, l, l, l, l, l, l, l, l, l, l, closed, closed, formatMoney, gains, gains, game,];
                } },
            ...{ class: "small" },
            disabled: (!!visitBlocked.value || game.value.judging || !!s.value.pendingAction),
            title: (visitBlocked.value ?? ''),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (visitBlocked.value ?? l.value.visit.title);
    }
    if (l.value.explore) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "item" },
        });
        /** @type {__VLS_StyleScopedClasses['item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (l.value.explore.title);
        (__VLS_unwrap(attrName, {})(l.value.explore.attr));
        (l.value.explore.dc);
        (l.value.explore.hours);
        if (l.value.explore.desc) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (l.value.explore.desc);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(gains, {})(l.value.explore.effects) || '有所收穫');
        (l.value.explore.critical?.length ? `；大成功另外 ${__VLS_unwrap(gains, {})(l.value.explore.critical)}` : '');
        ((l.value.explore.cooldown_days ?? 7));
        if (!exploreBlocked.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                placeholder: "怎麼做（選填，會寫進日誌）",
            });
            (__VLS_unwrap(text, {}));
            const __VLS_0 = AbilityPicker;
            // @ts-ignore
            const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
                // @ts-ignore
                modelValue: (__VLS_unwrap(use, {})),
            }));
            const __VLS_2 = __VLS_1({
                modelValue: (__VLS_unwrap(use, {})),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (explore) },
                ...{ class: "small" },
                disabled: (game.value.judging || !!s.value.pendingAction),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (exploreBlocked.value);
        }
    }
}
// @ts-ignore
[l, l, l, l, l, l, l, l, l, l, l, l, gains, gains, game, game, visitBlocked, visitBlocked, visitBlocked, s, s, attrName, exploreBlocked, exploreBlocked, text, use,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
