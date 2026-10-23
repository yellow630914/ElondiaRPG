import { computed, ref } from 'vue';
import { classEmoji, companionRules, raceEmoji } from '@/engine/data';
import { currentArea, currentCell } from '@/engine/grid';
import { formatMoney } from '@/engine/money';
import { leaderOf } from '@/engine/party';
import { autoHitDice, hitDiceLeft, hitDie, innCost, longRestBlocked, longRestGapHours, longRestWait, waitText } from '@/engine/rest';
import { useGame } from '@/stores/game';
import NameTag from './NameTag.vue';
import JudgeToggle from './JudgeToggle.vue';
const game = useGame();
const s = computed(() => game.state);
const cell = computed(() => currentCell(s.value));
const area = computed(() => currentArea(s.value));
const rations = computed(() => s.value.inventory.find((i) => i.name === '乾糧')?.qty ?? 0);
const ambush = computed(() => (cell.value.kind === 'safe' ? 0 : companionRules.rest.ambush[area.value.kind] ?? 0));
const place = computed(() => (cell.value.kind === 'inn' ? 'inn' : cell.value.kind === 'safe' ? 'safe' : area.value.kind === 'home' ? 'home' : null));
const blocked = computed(() => (place.value ? longRestBlocked(s.value, place.value) : null));
// 長休倒數（跟著遊戲時間更新）
const wait = computed(() => longRestWait(s.value));
const leaveMode = computed(() => s.value.pendingLeave?.mode);
const lowAffinity = computed(() => s.value.party.filter((m) => !m.isPlayer && m.bond !== 'slave' && (m.affinity ?? 0) <= companionRules.leave_threshold));
const leader = computed(() => leaderOf(s.value));
// 長休時的互動
const talkText = ref('');
const talkTarget = ref('');
const companions = computed(() => s.value.party.filter((m) => !m.isPlayer));
async function doLongRest(where) {
    const text = talkText.value.trim();
    talkText.value = '';
    await game.longRest(where, text ? { text, ...(talkTarget.value ? { target: talkTarget.value } : {}) } : undefined);
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(ambush, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(place, {});
// @ts-ignore
__VLS_withDotValue(blocked, {});
// @ts-ignore
__VLS_withDotValue(leaveMode, {});
// @ts-ignore
__VLS_withDotValue(leader, {});
// @ts-ignore
__VLS_withDotValue(lowAffinity, {});
void {};
/** @type {__VLS_StyleScopedClasses['talk']} */ ;
/** @type {__VLS_StyleScopedClasses['talk']} */ ;
/** @type {__VLS_StyleScopedClasses['talk']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
if (ambush.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (Math.round(ambush.value * 100));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain small dice" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['dice']} */ ;
const __VLS_0 = __VLS_tryAsConstant((s.value.party));
for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (m.id),
    });
    const __VLS_1 = NameTag;
    // @ts-ignore
    const __VLS_2 = __VLS_asFunctionalComponent1(__VLS_1, new __VLS_1({
        // @ts-ignore
        id: (m.id),
    }));
    const __VLS_3 = __VLS_2({
        id: (m.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_2));
    (__VLS_unwrap(hitDie, {})(m));
    (__VLS_unwrap(hitDiceLeft, {})(m));
    (m.level);
    if (__VLS_unwrap(autoHitDice, {})(m)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(autoHitDice, {})(m));
    }
    // @ts-ignore
    [ambush, ambush, s, hitDie, hitDiceLeft, autoHitDice, autoHitDice,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (game.value.shortRest());
            // @ts-ignore
            [game,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (place.value === 'inn') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(longRestGapHours, {})());
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(place.value === 'inn'))
                    throw 0;
                return (doLongRest('inn'));
                // @ts-ignore
                [place, longRestGapHours,];
            } },
        disabled: (!!blocked.value || s.value.money_cc < __VLS_unwrap(innCost, {})(s.value)),
    });
    (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(innCost, {})(s.value)));
}
else if (place.value === 'safe') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(place.value === 'inn'))
                    throw 0;
                if (!(place.value === 'safe'))
                    throw 0;
                return (doLongRest('safe'));
                // @ts-ignore
                [s, s, s, place, blocked, innCost, innCost, formatMoney,];
            } },
        disabled: (!!blocked.value || __VLS_unwrap(rations, {}) < s.value.party.length),
    });
    (s.value.party.length);
}
else if (place.value === 'home') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(place.value === 'inn'))
                    throw 0;
                if (!!(place.value === 'safe'))
                    throw 0;
                if (!(place.value === 'home'))
                    throw 0;
                return (doLongRest('home'));
                // @ts-ignore
                [s, s, place, blocked, rations,];
            } },
        disabled: (!!blocked.value),
    });
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (blocked.value && place.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (blocked.value);
}
else if (__VLS_unwrap(wait, {}) > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(waitText, {})(__VLS_unwrap(wait, {})));
}
if (place.value && !blocked.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "talk small" },
    });
    /** @type {__VLS_StyleScopedClasses['talk']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (__VLS_unwrap(talkText, {})),
        rows: "2",
        placeholder: (place.value === 'inn' ? '例如：睡前在旅店大廳和其他旅客聊天、陪莉娜看星星' : '例如：守夜時和隊友聊起各自的故鄉'),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row talk-row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['talk-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(talkTarget, {})),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(companions, {})));
    for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (m.id),
            value: (m.id),
        });
        (__VLS_unwrap(raceEmoji, {})(m.race));
        (m.name);
        (__VLS_unwrap(classEmoji, {})(m.class));
        // @ts-ignore
        [place, place, place, blocked, blocked, blocked, blocked, wait, wait, waitText, talkText, talkTarget, companions, raceEmoji, classEmoji,];
    }
    if (place.value === 'inn') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "guests",
        });
    }
    const __VLS_7 = JudgeToggle;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    // @ts-ignore
    }));
    const __VLS_9 = __VLS_8({}, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (leaveMode.value && leader.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
    (leaveMode.value === 'sneak' ? '偷偷離開' : '向' + leader.value.name + '正式道別並離開');
}
if (lowAffinity.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small warn" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
    (lowAffinity.value.map((m) => m.name).join('、'));
}
// @ts-ignore
[place, leaveMode, leaveMode, leader, leader, lowAffinity, lowAffinity,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
