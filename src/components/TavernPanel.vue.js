import FoldSection from './FoldSection.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { askingFor, invitable, marketsHere, partyOffersHere, waitChance } from '@/engine/companions';
import { className, combatRules, companionRules, conditionName, genderName, raceName } from '@/engine/data';
import { mealMenu } from '@/engine/meals';
import { CURRENCY, formatMoney } from '@/engine/money';
import { npcRecord } from '@/engine/npcs';
import { isBound, leaderOf } from '@/engine/party';
import { useGame } from '@/stores/game';
import MarketPanel from './MarketPanel.vue';
import NameTag from './NameTag.vue';
const game = useGame();
const s = computed(() => game.state);
const candidates = ref([]);
const bound = computed(() => isBound(s.value));
const partyFull = computed(() => s.value.party.length >= combatRules.party_max);
function refresh() {
    candidates.value = game.tavernCandidates();
}
onMounted(async () => {
    refresh();
    await game.flavorRoster();
    refresh();
});
const visible = computed(() => {
    // 依存檔重新取：雇用、還價、拒絕後即時更新
    const today = s.value.taverns?.[s.value.location];
    const list = today && today.day === s.value.time.day ? today.candidates : candidates.value;
    return list.filter((c) => !s.value.party.some((m) => m.id === c.npc));
});
const offers = reactive({});
const approach = reactive({});
const open = ref(null);
function toggle(c) {
    open.value = open.value === c.npc ? null : c.npc;
    offers[c.npc] ??= askingFor(c);
}
async function hire(c) {
    await game.hire(c.npc, Math.max(0, Math.floor(offers[c.npc] ?? askingFor(c))), approach[c.npc] ?? '');
    open.value = null;
}
// ---- 用餐 ----
const menu = computed(() => {
    void s.value.time.minute;
    return mealMenu(s.value);
});
// 隊伍現在的用餐與喝酒狀態
const MEAL_CONDITIONS = new Set(['fed_light', 'fed_well', 'fed_fine', 'fed_feast', 'fed_legend', 'cheered', 'tipsy']);
const fed = computed(() => s.value.party
    .map((m) => ({ name: m.name, list: m.status.filter((c) => MEAL_CONDITIONS.has(c)).map(conditionName) }))
    .filter((x) => x.list.length));
// ---- 組隊 ----
const offersHere = computed(() => partyOffersHere(s.value));
const leader = computed(() => leaderOf(s.value));
const chance = computed(() => Math.round(waitChance(s.value) * 100));
// ---- 邀請、黑市 ----
const inviteList = computed(() => invitable(s.value));
const inviteText = ref('');
const blackText = ref('');
const blackKnown = computed(() => marketsHere(s.value).some((m) => m.kind === 'black'));
const showBlack = ref(false);
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(fed, {});
// @ts-ignore
__VLS_withDotValue(bound, {});
// @ts-ignore
__VLS_withDotValue(visible, {});
// @ts-ignore
__VLS_withDotValue(open, {});
// @ts-ignore
__VLS_withDotValue(CURRENCY, {});
// @ts-ignore
__VLS_withDotValue(offers, {});
// @ts-ignore
__VLS_withDotValue(approach, {});
// @ts-ignore
__VLS_withDotValue(partyFull, {});
// @ts-ignore
__VLS_withDotValue(combatRules, {});
// @ts-ignore
__VLS_withDotValue(leader, {});
// @ts-ignore
__VLS_withDotValue(offersHere, {});
// @ts-ignore
__VLS_withDotValue(companionRules, {});
// @ts-ignore
__VLS_withDotValue(inviteList, {});
// @ts-ignore
__VLS_withDotValue(inviteText, {});
// @ts-ignore
__VLS_withDotValue(blackKnown, {});
// @ts-ignore
__VLS_withDotValue(showBlack, {});
// @ts-ignore
__VLS_withDotValue(blackText, {});
void {};
/** @type {__VLS_StyleScopedClasses['tavern']} */ ;
/** @type {__VLS_StyleScopedClasses['nego']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tavern" },
});
/** @type {__VLS_StyleScopedClasses['tavern']} */ ;
const __VLS_0 = FoldSection || FoldSection;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    id: "tavern.meals", title: "🍲 用餐",
}));
const __VLS_2 = __VLS_1({
    id: "tavern.meals",
    title: "🍲 用餐",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_nonNull(__VLS_3.slots);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "menu" },
});
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(menu, {})));
for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (game.value.eatMeal(m.id));
                // @ts-ignore
                [menu, game,];
            } },
        key: (m.id),
        ...{ class: "small" },
        disabled: (!!m.unavailable || s.value.money_cc < m.total || game.value.judging),
        title: (m.unavailable ?? `${__VLS_unwrap(conditionName, {})(m.condition)}：${m.desc}`),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (m.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (m.unavailable ?? `${__VLS_unwrap(formatMoney, {})(m.price)}${s.value.party.length > 1 ? ` ×${s.value.party.length}` : ''}`);
    // @ts-ignore
    [game, s, s, s, conditionName, formatMoney,];
}
if (fed.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (fed.value.map((x) => `${x.name}：${x.list.join('、')}`).join('；'));
}
// @ts-ignore
[fed, fed,];
var __VLS_3;
if (bound.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
else {
    const __VLS_7 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        // @ts-ignore
        id: "tavern.candidates", title: "🧑‍🤝‍🧑 候選冒險者", count: (visible.value.length),
    }));
    const __VLS_9 = __VLS_8({
        id: "tavern.candidates",
        title: "🧑‍🤝‍🧑 候選冒險者",
        count: (visible.value.length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    const { default: __VLS_12 } = __VLS_nonNull(__VLS_10.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    if (visible.value.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_13 = __VLS_tryAsConstant((visible.value));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (c.npc),
            ...{ class: "cand" },
        });
        /** @type {__VLS_StyleScopedClasses['cand']} */ ;
        if (__VLS_unwrap(npcRecord, {})(s.value, c.npc)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            const __VLS_14 = NameTag;
            // @ts-ignore
            const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
                // @ts-ignore
                id: (c.npc),
            }));
            const __VLS_16 = __VLS_15({
                id: (c.npc),
            }, ...__VLS_functionalComponentArgsRest(__VLS_15));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(genderName, {})(__VLS_unwrap(npcRecord, {})(s.value, c.npc).gender));
            (__VLS_unwrap(raceName, {})(__VLS_unwrap(npcRecord, {})(s.value, c.npc).race));
            (__VLS_unwrap(className, {})(__VLS_unwrap(npcRecord, {})(s.value, c.npc).class));
            (__VLS_unwrap(npcRecord, {})(s.value, c.npc).level);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(npcRecord, {})(s.value, c.npc).personality);
            if (__VLS_unwrap(npcRecord, {})(s.value, c.npc).appearance) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "small muted" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (__VLS_unwrap(npcRecord, {})(s.value, c.npc).appearance);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row small" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(askingFor, {})(c)));
            if (c.counter_cc) {
            }
            if (c.declined) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!!(bound.value))
                                throw 0;
                            if (!(__VLS_unwrap(npcRecord, {})(s.value, c.npc)))
                                throw 0;
                            if (!!(c.declined))
                                throw 0;
                            return (toggle(c));
                            // @ts-ignore
                            [s, s, s, s, s, s, s, s, formatMoney, bound, visible, visible, visible, npcRecord, npcRecord, npcRecord, npcRecord, npcRecord, npcRecord, npcRecord, npcRecord, genderName, raceName, className, askingFor,];
                        } },
                    ...{ class: "small" },
                    disabled: (partyFull.value),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                (open.value === c.npc ? '收起' : '談雇傭');
            }
            if (open.value === c.npc) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "nego small" },
                });
                /** @type {__VLS_StyleScopedClasses['nego']} */ ;
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                (CURRENCY.value.short);
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    type: "number",
                    min: "0",
                    step: "5",
                });
                (offers.value[c.npc]);
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    placeholder: "例如：答應分他一成戰利品、請他喝酒",
                });
                (approach.value[c.npc]);
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!!(bound.value))
                                throw 0;
                            if (!(__VLS_unwrap(npcRecord, {})(s.value, c.npc)))
                                throw 0;
                            if (!(open.value === c.npc))
                                throw 0;
                            return (hire(c));
                            // @ts-ignore
                            [partyFull, open, open, CURRENCY, offers, approach,];
                        } },
                    ...{ class: "small primary" },
                    disabled: ((offers.value[c.npc] ?? 0) > s.value.money_cc || game.value.judging),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                ((offers.value[c.npc] ?? 0) >= __VLS_unwrap(askingFor, {})(c) ? `雇用（${__VLS_unwrap(formatMoney, {})(offers.value[c.npc] ?? 0)}）` : '提出條件（魅力檢定）');
            }
        }
        // @ts-ignore
        [game, s, formatMoney, askingFor, offers, offers, offers,];
    }
    if (partyFull.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (combatRules.value.party_max);
    }
    // @ts-ignore
    [partyFull, combatRules,];
    var __VLS_10;
    const __VLS_19 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
        // @ts-ignore
        id: "tavern.offers", title: "🚩 加入別人的隊伍", count: (leader.value ? undefined : offersHere.value.length),
    }));
    const __VLS_21 = __VLS_20({
        id: "tavern.offers",
        title: "🚩 加入別人的隊伍",
        count: (leader.value ? undefined : offersHere.value.length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
    const { default: __VLS_24 } = __VLS_nonNull(__VLS_22.slots);
    if (leader.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (leader.value.name);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (companionRules.value.wait_party.hours);
        (__VLS_unwrap(chance, {}));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(bound.value))
                        throw 0;
                    if (!!(leader.value))
                        throw 0;
                    return (game.value.waitForParty());
                    // @ts-ignore
                    [game, leader, leader, leader, offersHere, companionRules, chance,];
                } },
            ...{ class: "small" },
            disabled: (partyFull.value),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        const __VLS_25 = __VLS_tryAsConstant((offersHere.value));
        for (const [o] of __VLS_vFor(__VLS_nonNull(__VLS_25))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (o.id),
                ...{ class: "cand small" },
            });
            /** @type {__VLS_StyleScopedClasses['cand']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            const __VLS_26 = NameTag;
            // @ts-ignore
            const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
                // @ts-ignore
                id: (o.leader),
            }));
            const __VLS_28 = __VLS_27({
                id: (o.leader),
            }, ...__VLS_functionalComponentArgsRest(__VLS_27));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(npcRecord, {})(s.value, o.leader)?.level);
            if (o.pay_cc) {
                (__VLS_unwrap(formatMoney, {})(o.pay_cc));
            }
            if (o.members.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                const __VLS_31 = __VLS_tryAsConstant((o.members));
                for (const [id, i] of __VLS_vFor(__VLS_nonNull(__VLS_31))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.template)({
                        key: (id),
                    });
                    if (i) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    }
                    const __VLS_32 = NameTag;
                    // @ts-ignore
                    const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
                        // @ts-ignore
                        id: (id),
                    }));
                    const __VLS_34 = __VLS_33({
                        id: (id),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
                    // @ts-ignore
                    [s, formatMoney, npcRecord, partyFull, offersHere,];
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(npcRecord, {})(s.value, o.leader)?.personality);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(bound.value))
                            throw 0;
                        if (!!(leader.value))
                            throw 0;
                        return (game.value.acceptPartyOffer(o.id));
                        // @ts-ignore
                        [game, s, npcRecord,];
                    } },
                ...{ class: "small primary" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['primary']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(bound.value))
                            throw 0;
                        if (!!(leader.value))
                            throw 0;
                        return (game.value.declinePartyOffer(o.id));
                        // @ts-ignore
                        [game,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            // @ts-ignore
            [];
        }
    }
    // @ts-ignore
    [];
    var __VLS_22;
    if (inviteList.value.length) {
        const __VLS_37 = FoldSection || FoldSection;
        // @ts-ignore
        const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
            // @ts-ignore
            id: "tavern.invite", title: "✉️ 邀請認識的人", count: (inviteList.value.length),
        }));
        const __VLS_39 = __VLS_38({
            id: "tavern.invite",
            title: "✉️ 邀請認識的人",
            count: (inviteList.value.length),
        }, ...__VLS_functionalComponentArgsRest(__VLS_38));
        const { default: __VLS_42 } = __VLS_nonNull(__VLS_40.slots);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "wide small" },
            placeholder: "邀請的方式（選填）",
        });
        (inviteText.value);
        /** @type {__VLS_StyleScopedClasses['wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain small" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_43 = __VLS_tryAsConstant((inviteList.value));
        for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_43))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (r.id),
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            const __VLS_44 = NameTag;
            // @ts-ignore
            const __VLS_45 = __VLS_asFunctionalComponent1(__VLS_44, new __VLS_44({
                // @ts-ignore
                id: (r.id),
            }));
            const __VLS_46 = __VLS_45({
                id: (r.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_45));
            (r.level);
            (s.value.relationships?.[r.id]?.affinity);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(bound.value))
                            throw 0;
                        if (!(inviteList.value.length))
                            throw 0;
                        game.value.perform({ kind: 'invite', target: r.id, text: inviteText.value });
                        inviteText.value = '';
                        // @ts-ignore
                        [game, s, inviteList, inviteList, inviteList, inviteText, inviteText, inviteText,];
                    } },
                ...{ class: "small" },
                disabled: (partyFull.value || game.value.judging),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            // @ts-ignore
            [game, partyFull,];
        }
        // @ts-ignore
        [];
        var __VLS_40;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({});
    if (blackKnown.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(bound.value))
                        throw 0;
                    if (!(blackKnown.value))
                        throw 0;
                    return (showBlack.value = !showBlack.value);
                    // @ts-ignore
                    [blackKnown, showBlack, showBlack,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (showBlack.value ? '離開黑市' : '前往黑市');
        if (showBlack.value) {
            const __VLS_49 = MarketPanel;
            // @ts-ignore
            const __VLS_50 = __VLS_asFunctionalComponent1(__VLS_49, new __VLS_49({
                // @ts-ignore
                kind: "black",
            }));
            const __VLS_51 = __VLS_50({
                kind: "black",
            }, ...__VLS_functionalComponentArgsRest(__VLS_50));
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "wide small" },
            placeholder: "打聽的方式（選填）",
        });
        (blackText.value);
        /** @type {__VLS_StyleScopedClasses['wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(bound.value))
                        throw 0;
                    if (!!(blackKnown.value))
                        throw 0;
                    game.value.perform({ kind: 'black_market', text: blackText.value });
                    blackText.value = '';
                    // @ts-ignore
                    [game, showBlack, showBlack, blackText, blackText, blackText,];
                } },
            ...{ class: "small" },
            disabled: (game.value.judging),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
}
// @ts-ignore
[game,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
