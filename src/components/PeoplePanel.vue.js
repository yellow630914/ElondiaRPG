import { npcPerksOf, perksOf } from '@/engine/perks';
import { computed, reactive, ref, watch } from 'vue';
import { affinityStage } from '@/engine/character';
import { askingFor } from '@/engine/companions';
import { combatRules, genderName, raceName, tagDef } from '@/engine/data';
import { cellAt, cellName, currentArea, position } from '@/engine/grid';
import { affinityTable, itemValue } from '@/engine/interactions';
import { CURRENCY, formatMoney } from '@/engine/money';
import { npcTitle } from '@/engine/npcs';
import { isHostile, peopleHere } from '@/engine/population';
import { parseUse, useGame } from '@/stores/game';
import AbilityPicker from './AbilityPicker.vue';
import JudgeToggle from './JudgeToggle.vue';
import FoldSection from './FoldSection.vue';
import NameTag from './NameTag.vue';
// 這裡的人：和主角同一個地點、同一個地區的 NPC（見 docs/NPC_SYSTEM.md 第 7 節）
const game = useGame();
const s = computed(() => game.state);
const people = computed(() => peopleHere(s.value));
const groups = computed(() => [
    { title: '🏪 店主與職員', items: people.value.filter((p) => p.staff) },
    { title: '⚔️ 冒險者', items: people.value.filter((p) => !p.staff && p.kind === 'adventurer') },
    { title: '🧺 普通人', items: people.value.filter((p) => !p.staff && p.kind === 'commoner') },
].filter((g) => g.items.length));
const where = computed(() => currentArea(s.value).name);
// 等待判定、或有擋住行動的事件（刻印、主人的要求、戰敗事件）時，互動按鈕停用
const busy = computed(() => !!s.value.pendingAction || game.judging || !!s.value.pendingMark || !!s.value.pendingMasterEvent || !!s.value.pendingDefeat);
// 換了地點：請 AI 潤飾這裡的居民（AI 判定開啟時，每個地點一次）
watch(() => s.value.location, () => void game.flavorRoster(), { immediate: true });
const open = ref(null);
watch(people, (list) => {
    if (open.value && !list.some((p) => p.rec.id === open.value))
        open.value = null;
});
function rel(id) {
    return s.value.relationships?.[id];
}
function hostile(p) {
    return isHostile(s.value, p.rec);
}
/** 遠處的人在哪裡：方向與格子 */
function whereIs(p) {
    const me = position(s.value);
    const dx = p.x - me.x;
    const dy = p.y - me.y;
    const dir = `${dx < 0 ? '西' : dx > 0 ? '東' : ''}${dy < 0 ? '北' : dy > 0 ? '南' : ''}`;
    const cell = cellAt(currentArea(s.value), p.x, p.y);
    return `在${dir ? `${dir}方` : '這裡'}的${cell ? cellName(cell.kind) : '某處'}（${p.dist} 格）`;
}
function attack(p) {
    if (confirm(`偷襲${p.rec.name}？被人看到的話，這裡與${p.rec.name}常去的地方都會提高警戒、降低聲望。`))
        interact('attack', p);
}
/** 帶到「主動行動」：選好對象，捲到主動行動面板 */
function toAction(p) {
    game.actionTarget = p.rec.id;
    document.querySelector('.action-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector('.action-panel textarea:last-of-type')?.focus({ preventScroll: true });
}
function tagsOf(rec) {
    return (rec.tags ?? []).map((t) => tagDef(t)).filter((t) => !!t);
}
// ---- 互動 ----
const text = reactive({});
const gift = reactive({});
const use = ref('');
const gifts = computed(() => s.value.inventory.filter((i) => i.qty > 0));
function interact(kind, p) {
    const id = p.rec.id;
    const u = parseUse(use.value);
    void game.perform({
        kind, target: id, text: text[id] ?? '',
        ...(kind === 'gift' ? { item: gift[id] } : {}),
        ...(u ? { use: u } : {}),
    });
    text[id] = '';
    use.value = '';
}
function giftHint(rec) {
    const item = gift[rec.id];
    if (!item)
        return '';
    const t = affinityTable(s.value, 'gift', rec, item);
    return `價值 ${formatMoney(itemValue(s.value, item))}・成功時親密度 +${t.success}`;
}
// ---- 雇用（只限冒險者） ----
const candidates = computed(() => {
    // 依存檔取得：雇用、還價、拒絕後即時更新
    const today = s.value.taverns?.[s.value.location];
    return today?.day === s.value.time.day ? today.candidates : [];
});
const offers = reactive({});
const hiring = ref(null);
const partyFull = computed(() => s.value.party.length >= combatRules.party_max);
function candidateOf(id) {
    return candidates.value.find((c) => c.npc === id);
}
function startHire(id) {
    // 第一次查看時建立今天的候選名單
    if (!candidateOf(id))
        game.tavernCandidates();
    const c = candidateOf(id);
    if (!c)
        return;
    offers[id] ??= askingFor(c);
    hiring.value = hiring.value === id ? null : id;
}
async function hire(id) {
    const c = candidateOf(id);
    if (!c)
        return;
    await game.hire(id, Math.max(0, Math.floor(offers[id] ?? askingFor(c))), text[id] ?? '');
    hiring.value = null;
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(people, {});
// @ts-ignore
__VLS_withDotValue(open, {});
// @ts-ignore
__VLS_withDotValue(text, {});
// @ts-ignore
__VLS_withDotValue(busy, {});
// @ts-ignore
__VLS_withDotValue(hiring, {});
// @ts-ignore
__VLS_withDotValue(gift, {});
// @ts-ignore
__VLS_withDotValue(CURRENCY, {});
// @ts-ignore
__VLS_withDotValue(offers, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(partyFull, {});
// @ts-ignore
__VLS_withDotValue(combatRules, {});
void {};
/** @type {__VLS_StyleScopedClasses['people']} */ ;
/** @type {__VLS_StyleScopedClasses['line']} */ ;
/** @type {__VLS_StyleScopedClasses['detail']} */ ;
/** @type {__VLS_StyleScopedClasses['detail']} */ ;
/** @type {__VLS_StyleScopedClasses['detail']} */ ;
/** @type {__VLS_StyleScopedClasses['hire']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel people" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['people']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(where, {}));
(people.value.length);
(people.value.filter((p) => p.dist <= 1).length);
const __VLS_0 = JudgeToggle;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
// @ts-ignore
}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (!people.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "groups" },
});
/** @type {__VLS_StyleScopedClasses['groups']} */ ;
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(groups, {})));
for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    const __VLS_6 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        // @ts-ignore
        id: (`people.${g.title}`), key: (g.title), ...{ class: "group" }, title: (g.title), count: (g.items.length),
    }));
    const __VLS_8 = __VLS_7({
        id: (`people.${g.title}`),
        key: (g.title),
        ...{ class: "group" },
        title: (g.title),
        count: (g.items.length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    /** @type {__VLS_StyleScopedClasses['group']} */ ;
    const { default: __VLS_11 } = __VLS_nonNull(__VLS_9.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_12 = __VLS_tryAsConstant((g.items));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (p.rec.id),
            ...{ class: ({ open: open.value === p.rec.id, far: p.dist > 1 }) },
        });
        /** @type {__VLS_StyleScopedClasses['open']} */ ;
        /** @type {__VLS_StyleScopedClasses['far']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (open.value = open.value === p.rec.id ? null : p.rec.id);
                    // @ts-ignore
                    [where, people, people, people, groups, open, open, open,];
                } },
            ...{ class: "row line" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['line']} */ ;
        const __VLS_13 = NameTag;
        // @ts-ignore
        const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({
            // @ts-ignore
            id: (p.rec.id),
        }));
        const __VLS_15 = __VLS_14({
            id: (p.rec.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_14));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(npcTitle, {})(p.rec));
        if (hostile(p)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag small bad" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['bad']} */ ;
        }
        if (p.dist > 1) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (p.dist);
        }
        const __VLS_18 = __VLS_tryAsConstant((tagsOf(p.rec)));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (t.name),
                ...{ class: "tag small" },
                title: (t.ai_hint),
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (t.emoji);
            (t.name);
            // @ts-ignore
            [npcTitle,];
        }
        if (rel(p.rec.id)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small known" },
                title: (`親密度 ${rel(p.rec.id).affinity}`),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['known']} */ ;
            (__VLS_unwrap(affinityStage, {})(rel(p.rec.id).affinity));
        }
        if (open.value === p.rec.id) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "detail small" },
            });
            /** @type {__VLS_StyleScopedClasses['detail']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(genderName, {})(p.rec.gender));
            (__VLS_unwrap(raceName, {})(p.rec.race));
            if (p.rec.lineage) {
                (p.rec.lineage);
            }
            (__VLS_unwrap(npcTitle, {})(p.rec));
            (p.rec.level);
            if (p.rec.appearance) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (p.rec.appearance);
            }
            if (rel(p.rec.id)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (p.rec.personality);
            }
            if (rel(p.rec.id)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (__VLS_unwrap(perksOf, {})({ perks: __VLS_unwrap(npcPerksOf, {})(p.rec), race: p.rec.race }).map((x) => (x.flaw ? `${x.name}（缺陷）` : x.name)).join('、'));
            }
            if (rel(p.rec.id)?.toPlayer) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (rel(p.rec.id).toPlayer);
            }
            if (p.dist > 1) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (whereIs(p));
            }
            else if (!hostile(p)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    placeholder: "想說什麼、怎麼做（選填，會交給 AI 判定）",
                });
                (text.value[p.rec.id]);
                const __VLS_19 = AbilityPicker;
                // @ts-ignore
                const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
                    // @ts-ignore
                    modelValue: (__VLS_unwrap(use, {})),
                }));
                const __VLS_21 = __VLS_20({
                    modelValue: (__VLS_unwrap(use, {})),
                }, ...__VLS_functionalComponentArgsRest(__VLS_20));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(open.value === p.rec.id))
                                throw 0;
                            if (!!(p.dist > 1))
                                throw 0;
                            if (!(!hostile(p)))
                                throw 0;
                            return (interact('chat', p));
                            // @ts-ignore
                            [open, npcTitle, affinityStage, genderName, raceName, perksOf, npcPerksOf, text, use,];
                        } },
                    ...{ class: "small" },
                    disabled: (busy.value),
                    title: "魅力檢定：聊得好會拉近關係，也可能聽到消息",
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(open.value === p.rec.id))
                                throw 0;
                            if (!!(p.dist > 1))
                                throw 0;
                            if (!(!hostile(p)))
                                throw 0;
                            return (interact('flatter', p));
                            // @ts-ignore
                            [busy,];
                        } },
                    ...{ class: "small" },
                    disabled: (busy.value),
                    title: "魅力檢定：奉承、討好；失敗會降低親密度，對貴族更難",
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(open.value === p.rec.id))
                                throw 0;
                            if (!!(p.dist > 1))
                                throw 0;
                            if (!(!hostile(p)))
                                throw 0;
                            return (toAction(p));
                            // @ts-ignore
                            [busy,];
                        } },
                    ...{ class: "small" },
                    disabled: (busy.value),
                    title: "在主動行動裡以這個人為對象，自由描述要做的事",
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                if (p.kind === 'adventurer' && !p.staff) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: // @ts-ignore
                            (...[$event]) => {
                                void $event;
                                if (!(open.value === p.rec.id))
                                    throw 0;
                                if (!!(p.dist > 1))
                                    throw 0;
                                if (!(!hostile(p)))
                                    throw 0;
                                if (!(p.kind === 'adventurer' && !p.staff))
                                    throw 0;
                                return (startHire(p.rec.id));
                                // @ts-ignore
                                [busy,];
                            } },
                        ...{ class: "small" },
                        disabled: (busy.value || partyFull.value),
                    });
                    /** @type {__VLS_StyleScopedClasses['small']} */ ;
                    (hiring.value === p.rec.id ? '收起' : '雇用');
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(open.value === p.rec.id))
                                throw 0;
                            if (!!(p.dist > 1))
                                throw 0;
                            if (!(!hostile(p)))
                                throw 0;
                            return (interact('steal', p));
                            // @ts-ignore
                            [busy, partyFull, hiring,];
                        } },
                    ...{ class: "small" },
                    disabled: (busy.value),
                    title: "靈巧檢定：偷錢或東西；被發現會降低親密度，在城裡還會提高衛兵警戒、降低聲望",
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                if (p.kind === 'adventurer' && !p.staff) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: // @ts-ignore
                            (...[$event]) => {
                                void $event;
                                if (!(open.value === p.rec.id))
                                    throw 0;
                                if (!!(p.dist > 1))
                                    throw 0;
                                if (!(!hostile(p)))
                                    throw 0;
                                if (!(p.kind === 'adventurer' && !p.staff))
                                    throw 0;
                                return (attack(p));
                                // @ts-ignore
                                [busy,];
                            } },
                        ...{ class: "small danger" },
                        disabled: (busy.value),
                        title: "靈巧檢定：成功就先手開戰；被看到會有衛兵與聲望的後果",
                    });
                    /** @type {__VLS_StyleScopedClasses['small']} */ ;
                    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    value: (gift.value[p.rec.id]),
                    ...{ class: "small" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: (undefined),
                });
                const __VLS_24 = __VLS_tryAsConstant((__VLS_unwrap(gifts, {})));
                for (const [i] of __VLS_vFor(__VLS_nonNull(__VLS_24))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        key: (i.name),
                        value: (i.name),
                    });
                    (i.name);
                    (i.qty);
                    // @ts-ignore
                    [busy, gift, gifts,];
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(open.value === p.rec.id))
                                throw 0;
                            if (!!(p.dist > 1))
                                throw 0;
                            if (!(!hostile(p)))
                                throw 0;
                            return (interact('gift', p));
                            // @ts-ignore
                            [];
                        } },
                    ...{ class: "small" },
                    disabled: (busy.value || !gift.value[p.rec.id]),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (giftHint(p.rec));
                if (hiring.value === p.rec.id && candidateOf(p.rec.id)) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "hire" },
                    });
                    /** @type {__VLS_StyleScopedClasses['hire']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(askingFor, {})(candidateOf(p.rec.id))));
                    if (candidateOf(p.rec.id).counter_cc) {
                    }
                    if (candidateOf(p.rec.id).declined) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "muted" },
                        });
                        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                    }
                    else {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                        (CURRENCY.value.short);
                        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                            type: "number",
                            min: "0",
                            step: "5",
                        });
                        (offers.value[p.rec.id]);
                        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                            ...{ onClick: // @ts-ignore
                                (...[$event]) => {
                                    void $event;
                                    if (!(open.value === p.rec.id))
                                        throw 0;
                                    if (!!(p.dist > 1))
                                        throw 0;
                                    if (!(!hostile(p)))
                                        throw 0;
                                    if (!(hiring.value === p.rec.id && candidateOf(p.rec.id)))
                                        throw 0;
                                    if (!!(candidateOf(p.rec.id).declined))
                                        throw 0;
                                    return (hire(p.rec.id));
                                    // @ts-ignore
                                    [busy, hiring, gift, formatMoney, askingFor, CURRENCY, offers,];
                                } },
                            ...{ class: "small primary" },
                            disabled: ((offers.value[p.rec.id] ?? 0) > s.value.money_cc || busy.value),
                        });
                        /** @type {__VLS_StyleScopedClasses['small']} */ ;
                        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                        ((offers.value[p.rec.id] ?? 0) >= __VLS_unwrap(askingFor, {})(candidateOf(p.rec.id)) ? `雇用（${__VLS_unwrap(formatMoney, {})(offers.value[p.rec.id] ?? 0)}）` : '提出條件（魅力檢定）');
                    }
                }
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (p.rec.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(open.value === p.rec.id))
                                throw 0;
                            if (!!(p.dist > 1))
                                throw 0;
                            if (!!(!hostile(p)))
                                throw 0;
                            return (toAction(p));
                            // @ts-ignore
                            [busy, formatMoney, askingFor, offers, offers, offers, s,];
                        } },
                    ...{ class: "small" },
                    disabled: (busy.value),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(open.value === p.rec.id))
                                throw 0;
                            if (!!(p.dist > 1))
                                throw 0;
                            if (!!(!hostile(p)))
                                throw 0;
                            return (interact('steal', p));
                            // @ts-ignore
                            [busy,];
                        } },
                    ...{ class: "small" },
                    disabled: (busy.value),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                if (p.kind === 'adventurer' && !p.staff) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: // @ts-ignore
                            (...[$event]) => {
                                void $event;
                                if (!(open.value === p.rec.id))
                                    throw 0;
                                if (!!(p.dist > 1))
                                    throw 0;
                                if (!!(!hostile(p)))
                                    throw 0;
                                if (!(p.kind === 'adventurer' && !p.staff))
                                    throw 0;
                                return (attack(p));
                                // @ts-ignore
                                [busy,];
                            } },
                        ...{ class: "small danger" },
                        disabled: (busy.value),
                    });
                    /** @type {__VLS_StyleScopedClasses['small']} */ ;
                    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
                }
            }
        }
        // @ts-ignore
        [busy,];
    }
    // @ts-ignore
    [];
    var __VLS_9;
    // @ts-ignore
    [];
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
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
