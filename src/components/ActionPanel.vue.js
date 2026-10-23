import { computed, ref, watch } from 'vue';
import { DEGREE_NAME, situationalTotal } from '@/engine/actions';
import { actionRules, ATTR_IDS, attrName, classEmoji, raceEmoji, slaveryRules } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { npcRecord } from '@/engine/npcs';
import { npcTitle } from '@/engine/npcs';
import { isHostile, peopleHere } from '@/engine/population';
import { isBound, isEnslaved, isFugitive } from '@/engine/party';
import { atSafeSpot, contractTerms, markSummary, masterAllows, masterNearby, masterRefusedToday, masterWhereabouts, seekMasterDc, unmarkOffers, } from '@/engine/slavery';
import { currentArea } from '@/engine/grid';
import { atMasterHome, houseRefusedToday, leaveDc, masterHomeSummary, mayLeaveHouse, strictPoints } from '@/engine/masterHome';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
import { useSettings } from '@/stores/settings';
import JudgeToggle from './JudgeToggle.vue';
import { eventDialogOpen } from './events/eventQueue';
import { contractOf } from '@/engine/tattoos';
const game = useGame();
const settings = useSettings();
const s = computed(() => game.state);
const pending = computed(() => s.value.pendingAction);
const aiOn = computed(() => settings.aiJudge && settings.ready('judge'));
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
// ---- 等待判定的行動 ----
const DEGREES = Object.keys(DEGREE_NAME);
const totals = computed(() => {
    const p = pending.value;
    if (!p)
        return [];
    const sit = situationalTotal(p);
    return ATTR_IDS.map((a) => ({ attr: a, total: p.natural + p.modifiers[a] + sit, isDefault: a === p.attr }));
});
// ---- 自由行動 ----
const text = ref('');
// 對象：隊友，以及「這裡的人」（身邊的人可以選；同一區較遠的人要先走近）
const target = computed({ get: () => game.actionTarget, set: (v) => { game.actionTarget = v; } });
function label(id, name) {
    const rec = s.value.party.find((m) => m.id === id) ?? npcRecord(s.value, id);
    return rec ? `${raceEmoji(rec.race)}${name}${classEmoji(rec.class)}` : name;
}
const partyTargets = computed(() => s.value.party.filter((m) => !m.isPlayer).map((m) => ({ id: m.id, name: label(m.id, m.name), note: '' })));
const people = computed(() => peopleHere(s.value).map((p) => ({
    id: p.rec.id, name: label(p.rec.id, p.rec.name), note: npcTitle(p.rec), near: p.dist <= 1, dist: p.dist,
})));
const nearTargets = computed(() => people.value.filter((p) => p.near));
const farTargets = computed(() => people.value.filter((p) => !p.near));
// 移動之後，原本選的對象不在身邊了就清掉
watch([partyTargets, nearTargets], ([party, near]) => {
    if (target.value && ![...party, ...near].some((t) => t.id === target.value))
        target.value = '';
}, { immediate: true });
const use = ref('');
function doFree() {
    const u = parseUse(use.value);
    void game.perform({ kind: 'free', text: text.value, ...(target.value ? { target: target.value } : {}), ...(u ? { use: u } : {}) });
    text.value = '';
    use.value = '';
}
// ---- 奴隸身分 ----
const bound = computed(() => isBound(s.value));
const fugitive = computed(() => isFugitive(s.value));
const enslaved = computed(() => isEnslaved(s.value));
const contract = computed(() => {
    const c = contractOf(s.value.party.find((m) => m.isPlayer));
    return c ? { ...c, def: contractTerms(c), summary: markSummary(c) } : null;
});
const safe = computed(() => atSafeSpot(s.value));
// 在聚落裡、主人今天還沒同意出城：可以請求
const inTown = computed(() => currentArea(s.value).kind === 'settlement');
const permitted = computed(() => masterAllows(s.value));
const refused = computed(() => masterRefusedToday(s.value));
const freedomText = ref('');
// 主人的家：離家期限、嚴加看管、出門要主人同意
const homeLine = computed(() => masterHomeSummary(s.value));
const strict = computed(() => strictPoints(s.value));
const atHome = computed(() => atMasterHome(s.value));
const mayLeave = computed(() => mayLeaveHouse(s.value));
const houseRefused = computed(() => houseRefusedToday(s.value));
// 逃亡或無主：找到主人、投靠新主人、解除印記
const whereabouts = computed(() => masterWhereabouts(s.value));
const nearMaster = computed(() => masterNearby(s.value));
const offers = computed(() => unmarkOffers(s.value).filter((o) => !o.place));
// 請法師拆誓約印記（紋樣留下來變成普通刺青）
const oathOffers = computed(() => unmarkOffers(s.value).filter((o) => o.place));
const seekTarget = ref('');
const seekTargets = computed(() => {
    if (!enslaved.value || bound.value)
        return [];
    return peopleHere(s.value)
        .filter((p) => p.dist <= 1 && p.rec.id !== contract.value?.master && !p.rec.tags?.includes('slave') && !isHostile(s.value, p.rec))
        .map((p) => ({ id: p.rec.id, name: `${label(p.rec.id, p.rec.name)}・${npcTitle(p.rec)}・DC ${seekMasterDc(s.value, p.rec)}${p.kind === 'commoner' ? '・不戰鬥' : ''}` }));
});
function doFreedom(kind, target) {
    const u = parseUse(use.value);
    void game.perform({ kind, text: freedomText.value, ...(target ? { target } : {}), ...(u ? { use: u } : {}) });
    freedomText.value = '';
    use.value = '';
}
// ---- 刻印 ----
const pendingMark = computed(() => s.value.pendingMark);
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(pending, {});
// @ts-ignore
__VLS_withDotValue(actionRules, {});
// @ts-ignore
__VLS_withDotValue(DEGREE_NAME, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(pendingMark, {});
// @ts-ignore
__VLS_withDotValue(eventDialogOpen, {});
// @ts-ignore
__VLS_withDotValue(contract, {});
// @ts-ignore
__VLS_withDotValue(bound, {});
// @ts-ignore
__VLS_withDotValue(homeLine, {});
// @ts-ignore
__VLS_withDotValue(strict, {});
// @ts-ignore
__VLS_withDotValue(atHome, {});
// @ts-ignore
__VLS_withDotValue(mayLeave, {});
// @ts-ignore
__VLS_withDotValue(houseRefused, {});
// @ts-ignore
__VLS_withDotValue(slaveryRules, {});
// @ts-ignore
__VLS_withDotValue(inTown, {});
// @ts-ignore
__VLS_withDotValue(permitted, {});
// @ts-ignore
__VLS_withDotValue(refused, {});
// @ts-ignore
__VLS_withDotValue(safe, {});
// @ts-ignore
__VLS_withDotValue(enslaved, {});
// @ts-ignore
__VLS_withDotValue(fugitive, {});
// @ts-ignore
__VLS_withDotValue(whereabouts, {});
// @ts-ignore
__VLS_withDotValue(nearMaster, {});
// @ts-ignore
__VLS_withDotValue(seekTargets, {});
// @ts-ignore
__VLS_withDotValue(seekTarget, {});
// @ts-ignore
__VLS_withDotValue(offers, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(oathOffers, {});
// @ts-ignore
__VLS_withDotValue(aiOn, {});
// @ts-ignore
__VLS_withDotValue(partyTargets, {});
// @ts-ignore
__VLS_withDotValue(nearTargets, {});
// @ts-ignore
__VLS_withDotValue(farTargets, {});
// @ts-ignore
__VLS_withDotValue(text, {});
void {};
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['totals']} */ ;
if (pending.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel pending" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['pending']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (actionRules.value.kinds[pending.value.kind].name);
    if (pending.value.targetName) {
        (pending.value.targetName);
    }
    if (pending.value.text) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (pending.value.text);
    }
    if (pending.value.offer_cc !== undefined) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (__VLS_unwrap(formatMoney, {})(pending.value.offer_cc));
    }
    if (pending.value.item) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (pending.value.item);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
        ...{ class: "dice" },
    });
    /** @type {__VLS_StyleScopedClasses['dice']} */ ;
    (pending.value.natural);
    (pending.value.base_dc);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    if (pending.value.situational.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        const __VLS_0 = __VLS_tryAsConstant((pending.value.situational));
        for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (x.label),
            });
            (x.label);
            (__VLS_unwrap(signed, {})(x.value));
            // @ts-ignore
            [pending, pending, pending, pending, pending, pending, pending, pending, pending, pending, pending, pending, pending, pending, actionRules, formatMoney, signed,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small totals" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['totals']} */ ;
    const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(totals, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (t.attr),
            ...{ class: ({ def: t.isDefault }) },
        });
        /** @type {__VLS_StyleScopedClasses['def']} */ ;
        (__VLS_unwrap(attrName, {})(t.attr));
        (t.total);
        // @ts-ignore
        [totals, attrName,];
    }
    if (Object.keys(pending.value.outcomes).length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain small outcomes" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['outcomes']} */ ;
        const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(DEGREES, {})));
        for (const [d] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.template)({
                key: (d),
            });
            if (pending.value.outcomes[d]) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "tag" },
                });
                /** @type {__VLS_StyleScopedClasses['tag']} */ ;
                (DEGREE_NAME.value[d]);
                (pending.value.outcomes[d]);
            }
            // @ts-ignore
            [pending, pending, pending, DEGREES, DEGREE_NAME,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(pending.value))
                    throw 0;
                return (game.value.judge(true));
                // @ts-ignore
                [game,];
            } },
        ...{ class: "primary" },
        disabled: (game.value.judging || !settings.value.ready('judge')),
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    (game.value.judging ? 'AI 判定中…' : 'AI 判定');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(pending.value))
                    throw 0;
                return (game.value.judge(false));
                // @ts-ignore
                [game, game, game, settings,];
            } },
        disabled: (game.value.judging),
    });
    (__VLS_unwrap(attrName, {})(pending.value.attr));
    if (!settings.value.ready('judge')) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
}
else if (pendingMark.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel pending" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['pending']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                __VLS_withDotValue(eventDialogOpen, {});
                if (!!(pending.value))
                    throw 0;
                if (!(pendingMark.value))
                    throw 0;
                return (eventDialogOpen.value = true);
                // @ts-ignore
                [pending, attrName, game, settings, pendingMark, eventDialogOpen,];
            } },
        ...{ class: "small primary" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel action-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['action-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row head" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    const __VLS_3 = JudgeToggle;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent1(__VLS_3, new __VLS_3({
    // @ts-ignore
    }));
    const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
    if (contract.value && bound.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small mark pre" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['mark']} */ ;
        /** @type {__VLS_StyleScopedClasses['pre']} */ ;
        (contract.value.summary);
        if (homeLine.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (homeLine.value);
            if (strict.value) {
                (strict.value);
                (strict.value);
            }
        }
        if (atHome.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (mayLeave.value ? `${contract.value.masterName}今天同意你出門。` : houseRefused.value ? `${contract.value.masterName}今天不准你出門。` : `要走出大門，先請求${contract.value.masterName}同意（${__VLS_unwrap(attrName, {})(slaveryRules.value.master_home.leave.attr)}檢定，參考 DC ${__VLS_unwrap(leaveDc, {})(s.value)}）。`);
        }
        if (inTown.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (permitted.value ? `${contract.value.masterName}今天同意你出城。` : refused.value ? `${contract.value.masterName}今天不准你離開這座城。` : `出城或旅行前要先請求${contract.value.masterName}同意（${__VLS_unwrap(attrName, {})(slaveryRules.value.master_permit.attr)}檢定，印記越重越難）。`);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_unwrap(freedomText, {})),
            rows: "2",
            placeholder: "描述你打算怎麼說服主人、用什麼理由請求出城，或怎麼逃走",
        });
        const __VLS_8 = AbilityPicker;
        // @ts-ignore
        const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
            // @ts-ignore
            modelValue: (__VLS_unwrap(use, {})),
        }));
        const __VLS_10 = __VLS_9({
            modelValue: (__VLS_unwrap(use, {})),
        }, ...__VLS_functionalComponentArgsRest(__VLS_9));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        if (atHome.value && !mayLeave.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(pending.value))
                            throw 0;
                        if (!!(pendingMark.value))
                            throw 0;
                        if (!(contract.value && bound.value))
                            throw 0;
                        if (!(atHome.value && !mayLeave.value))
                            throw 0;
                        return (doFreedom('master_leave'));
                        // @ts-ignore
                        [attrName, attrName, contract, contract, contract, contract, contract, contract, contract, contract, bound, homeLine, homeLine, strict, strict, strict, atHome, atHome, mayLeave, mayLeave, houseRefused, slaveryRules, slaveryRules, leaveDc, s, inTown, permitted, refused, freedomText, use,];
                    } },
                ...{ class: "small" },
                disabled: (houseRefused.value || game.value.judging),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        if (inTown.value && !permitted.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(pending.value))
                            throw 0;
                        if (!!(pendingMark.value))
                            throw 0;
                        if (!(contract.value && bound.value))
                            throw 0;
                        if (!(inTown.value && !permitted.value))
                            throw 0;
                        return (doFreedom('master_permit'));
                        // @ts-ignore
                        [game, houseRefused, inTown, permitted,];
                    } },
                ...{ class: "small" },
                disabled: (refused.value || game.value.judging),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(pending.value))
                        throw 0;
                    if (!!(pendingMark.value))
                        throw 0;
                    if (!(contract.value && bound.value))
                        throw 0;
                    return (doFreedom('negotiate'));
                    // @ts-ignore
                    [game, refused,];
                } },
            ...{ class: "small" },
            disabled: (!safe.value || game.value.judging),
            title: (safe.value ? '' : '要在旅店、安全房、神殿或主人的家才能談判'),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(pending.value))
                        throw 0;
                    if (!!(pendingMark.value))
                        throw 0;
                    if (!(contract.value && bound.value))
                        throw 0;
                    return (doFreedom('escape'));
                    // @ts-ignore
                    [game, safe, safe,];
                } },
            ...{ class: "small danger" },
            disabled: (game.value.judging),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        if (!safe.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.hr)({});
    }
    else if (contract.value && enslaved.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small mark pre" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['mark']} */ ;
        /** @type {__VLS_StyleScopedClasses['pre']} */ ;
        (contract.value.summary);
        if (fugitive.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small mark" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['mark']} */ ;
            (contract.value.def.functions.includes('tracking') ? `，每次休息都可能被${contract.value.masterName}找到` : '');
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        if (whereabouts.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (whereabouts.value);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_unwrap(freedomText, {})),
            rows: "2",
            placeholder: "描述你的做法：怎麼向主人認錯或談條件、怎麼請人收下你，或怎麼撐過解除印記的痛",
        });
        const __VLS_13 = AbilityPicker;
        // @ts-ignore
        const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({
            // @ts-ignore
            modelValue: (__VLS_unwrap(use, {})),
        }));
        const __VLS_15 = __VLS_14({
            modelValue: (__VLS_unwrap(use, {})),
        }, ...__VLS_functionalComponentArgsRest(__VLS_14));
        if (nearMaster.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(pending.value))
                            throw 0;
                        if (!!(pendingMark.value))
                            throw 0;
                        if (!!(contract.value && bound.value))
                            throw 0;
                        if (!(contract.value && enslaved.value))
                            throw 0;
                        if (!(nearMaster.value))
                            throw 0;
                        return (doFreedom('master_return'));
                        // @ts-ignore
                        [game, contract, contract, contract, contract, freedomText, use, safe, enslaved, fugitive, whereabouts, whereabouts, nearMaster,];
                    } },
                ...{ class: "small" },
                disabled: (game.value.judging),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (contract.value.masterName);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(pending.value))
                            throw 0;
                        if (!!(pendingMark.value))
                            throw 0;
                        if (!!(contract.value && bound.value))
                            throw 0;
                        if (!(contract.value && enslaved.value))
                            throw 0;
                        if (!(nearMaster.value))
                            throw 0;
                        return (doFreedom('negotiate'));
                        // @ts-ignore
                        [game, contract,];
                    } },
                ...{ class: "small" },
                disabled: (game.value.judging),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        if (seekTargets.value.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (seekTarget.value),
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            const __VLS_18 = __VLS_tryAsConstant((seekTargets.value));
            for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (t.id),
                    value: (t.id),
                });
                (t.name);
                // @ts-ignore
                [game, seekTargets, seekTargets, seekTarget,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(pending.value))
                            throw 0;
                        if (!!(pendingMark.value))
                            throw 0;
                        if (!!(contract.value && bound.value))
                            throw 0;
                        if (!(contract.value && enslaved.value))
                            throw 0;
                        if (!(seekTargets.value.length))
                            throw 0;
                        return (doFreedom('seek_master', seekTarget.value));
                        // @ts-ignore
                        [seekTarget,];
                    } },
                ...{ class: "small" },
                disabled: (!seekTarget.value || game.value.judging),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        if (offers.value.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
                ...{ class: "plain small offers" },
            });
            /** @type {__VLS_StyleScopedClasses['plain']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['offers']} */ ;
            const __VLS_19 = __VLS_tryAsConstant((offers.value));
            for (const [o] of __VLS_vFor(__VLS_nonNull(__VLS_19))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                    key: (o.target),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
                (o.name);
                if (o.helper) {
                    (o.helper);
                }
                (__VLS_unwrap(attrName, {})(o.attr));
                (o.dc);
                (o.fee_cc ? __VLS_unwrap(formatMoney, {})(o.fee_cc) : '免費');
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!!(pending.value))
                                throw 0;
                            if (!!(pendingMark.value))
                                throw 0;
                            if (!!(contract.value && bound.value))
                                throw 0;
                            if (!(contract.value && enslaved.value))
                                throw 0;
                            if (!(offers.value.length))
                                throw 0;
                            return (doFreedom('unmark', o.target));
                            // @ts-ignore
                            [formatMoney, attrName, game, seekTarget, offers, offers,];
                        } },
                    ...{ class: "small" },
                    disabled: (game.value.judging || s.value.money_cc < o.fee_cc),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (o.desc);
                // @ts-ignore
                [game, s,];
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.hr)({});
    }
    if (oathOffers.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain small offers" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['offers']} */ ;
        const __VLS_20 = __VLS_tryAsConstant((oathOffers.value));
        for (const [o] of __VLS_vFor(__VLS_nonNull(__VLS_20))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (o.target),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (o.name);
            (o.helper);
            (__VLS_unwrap(attrName, {})(o.attr));
            (o.dc);
            (o.fee_cc ? __VLS_unwrap(formatMoney, {})(o.fee_cc) : '免費');
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(pending.value))
                            throw 0;
                        if (!!(pendingMark.value))
                            throw 0;
                        if (!(oathOffers.value.length))
                            throw 0;
                        return (doFreedom('unmark', o.target));
                        // @ts-ignore
                        [formatMoney, attrName, oathOffers, oathOffers,];
                    } },
                ...{ class: "small" },
                disabled: (game.value.judging || s.value.money_cc < o.fee_cc),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (o.desc);
            // @ts-ignore
            [game, s,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.hr)({});
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (aiOn.value ? '再把骰值與完整資料交給 AI，由 AI 決定成敗並寫出經過' : '依規則判定（骰值對參考 DC）');
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
    if (partyTargets.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
            label: "隊伍",
        });
        const __VLS_21 = __VLS_tryAsConstant((partyTargets.value));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_21))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (t.id),
                value: (t.id),
            });
            (t.name);
            // @ts-ignore
            [aiOn, target, partyTargets, partyTargets,];
        }
    }
    if (nearTargets.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
            label: "身邊的人",
        });
        const __VLS_22 = __VLS_tryAsConstant((nearTargets.value));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_22))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (t.id),
                value: (t.id),
            });
            (t.name);
            (t.note);
            // @ts-ignore
            [nearTargets, nearTargets,];
        }
    }
    if (farTargets.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
            label: "這一區（要先走近）",
        });
        const __VLS_23 = __VLS_tryAsConstant((farTargets.value));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_23))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (t.id),
                value: (t.id),
                disabled: true,
            });
            (t.name);
            (t.note);
            (t.dist);
            // @ts-ignore
            [farTargets, farTargets,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (text.value),
        rows: "2",
        placeholder: "例如：買一份甜點給莉娜，順便問她怕水的原因",
    });
    const __VLS_24 = AbilityPicker;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
        // @ts-ignore
        modelValue: (__VLS_unwrap(use, {})),
    }));
    const __VLS_26 = __VLS_25({
        modelValue: (__VLS_unwrap(use, {})),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (doFree) },
        ...{ class: "small primary" },
        disabled: (!text.value.trim() || game.value.judging),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
}
// @ts-ignore
[game, use, text, text,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
