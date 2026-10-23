import FoldSection from './FoldSection.vue';
import { computed, onMounted, reactive, ref } from 'vue';
import { marketsHere, selfSaleChance } from '@/engine/companions';
import { className, combatRules, contractDef, genderName, raceName, slaveryRules, tagDef } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { npcRecord } from '@/engine/npcs';
import { isBound, isEnslaved } from '@/engine/party';
import { useGame } from '@/stores/game';
import MarkPicker from './MarkPicker.vue';
import NameTag from './NameTag.vue';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const s = computed(() => game.state);
const market = computed(() => marketsHere(s.value).find((m) => m.kind === props.kind)?.def);
const loaded = ref([]);
onMounted(() => {
    loaded.value = game.marketStock(props.kind);
});
const stock = computed(() => s.value.markets?.[`${s.value.location}/${props.kind}`]?.stock ?? loaded.value);
const partyFull = computed(() => s.value.party.length >= combatRules.party_max);
const enslaved = computed(() => isEnslaved(s.value));
const bound = computed(() => isBound(s.value));
// 這個市場常見的買家（依權重）
const buyers = computed(() => Object.entries(slaveryRules.master_tags.tags)
    .filter(([, t]) => t[props.kind] > 0)
    .sort((a, b) => b[1][props.kind] - a[1][props.kind])
    .map(([id, t]) => `${tagDef(id)?.name ?? id}${t.chance ? `（${t.chance > 0 ? '+' : ''}${Math.round(t.chance * 100)}%）` : ''}`)
    .join('、'));
const haggleText = reactive({});
const open = ref(null);
// 買下前選印記：預設是這名奴隸身上原本的契約
const marking = ref(null);
const marks = reactive({});
function toggleMarking(l) {
    marks[l.npc] ??= l.contract;
    marking.value = marking.value === l.npc ? null : l.npc;
}
function buy(l) {
    game.buySlave(props.kind, l.npc, marks[l.npc] ?? l.contract);
    marking.value = null;
}
function haggle(l) {
    void game.perform({ kind: 'haggle', target: `${props.kind}:${l.npc}`, text: haggleText[l.npc] ?? '' });
    open.value = null;
}
function sellSelf() {
    const msg = enslaved.value
        ? '登記出售自己：買下你的人會成為新主人，身上的印記沿用。確定嗎？'
        : '登記出售自己：買家主要看你的魅力與等級，你幾乎無法影響結果。被買下後要過一次刻印檢定，決定刻上哪一種契約印記；原本的同伴會離開。確定嗎？';
    if (confirm(msg)) {
        game.offerSelf(props.kind);
    }
}
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
__VLS_withDotValue(market, {});
// @ts-ignore
__VLS_withDotValue(stock, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(partyFull, {});
// @ts-ignore
__VLS_withDotValue(enslaved, {});
// @ts-ignore
__VLS_withDotValue(open, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(marking, {});
// @ts-ignore
__VLS_withDotValue(marks, {});
// @ts-ignore
__VLS_withDotValue(haggleText, {});
// @ts-ignore
__VLS_withDotValue(bound, {});
// @ts-ignore
__VLS_withDotValue(slaveryRules, {});
void {};
if (market.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "market" },
    });
    /** @type {__VLS_StyleScopedClasses['market']} */ ;
    const __VLS_0 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        // @ts-ignore
        id: (`market.${__VLS_ctx.kind}`), title: (`⛓️ ${market.value.name}`), count: (stock.value.length),
    }));
    const __VLS_2 = __VLS_1({
        id: (`market.${__VLS_ctx.kind}`),
        title: (`⛓️ ${market.value.name}`),
        count: (stock.value.length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    const { default: __VLS_5 } = __VLS_nonNull(__VLS_3.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_ctx.kind === 'black' ? '不公開的買賣，價格較低，也有精靈這類在公開市場買不到的人，但風險自負。' : '合法的奴隸市場。');
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_6 = __VLS_tryAsConstant((stock.value));
    for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (l.npc),
            ...{ class: "item small" },
        });
        /** @type {__VLS_StyleScopedClasses['item']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        if (__VLS_unwrap(npcRecord, {})(s.value, l.npc)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            const __VLS_7 = NameTag;
            // @ts-ignore
            const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
                // @ts-ignore
                id: (l.npc),
            }));
            const __VLS_9 = __VLS_8({
                id: (l.npc),
            }, ...__VLS_functionalComponentArgsRest(__VLS_8));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(genderName, {})(__VLS_unwrap(npcRecord, {})(s.value, l.npc).gender));
            (__VLS_unwrap(raceName, {})(__VLS_unwrap(npcRecord, {})(s.value, l.npc).race));
            (__VLS_unwrap(className, {})(__VLS_unwrap(npcRecord, {})(s.value, l.npc).class));
            (__VLS_unwrap(npcRecord, {})(s.value, l.npc).level);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(npcRecord, {})(s.value, l.npc).appearance);
            (__VLS_unwrap(npcRecord, {})(s.value, l.npc).background);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "muted" },
                title: (__VLS_unwrap(contractDef, {})(l.contract).side_effects.join('；')),
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(contractDef, {})(l.contract).name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_unwrap(formatMoney, {})(l.price_cc));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(market.value))
                            throw 0;
                        if (!(__VLS_unwrap(npcRecord, {})(s.value, l.npc)))
                            throw 0;
                        return (toggleMarking(l));
                        // @ts-ignore
                        [market, market, kind, kind, stock, stock, npcRecord, npcRecord, npcRecord, npcRecord, npcRecord, npcRecord, npcRecord, s, s, s, s, s, s, s, genderName, raceName, className, contractDef, contractDef, formatMoney,];
                    } },
                ...{ class: "small primary" },
                disabled: (partyFull.value || enslaved.value || s.value.money_cc < l.price_cc),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['primary']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(market.value))
                            throw 0;
                        if (!(__VLS_unwrap(npcRecord, {})(s.value, l.npc)))
                            throw 0;
                        return (open.value = open.value === l.npc ? null : l.npc);
                        // @ts-ignore
                        [s, partyFull, enslaved, open, open,];
                    } },
                ...{ class: "small" },
                disabled: (l.haggled || enslaved.value || game.value.judging),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (l.haggled ? '已殺過價' : '殺價／交涉');
            if (marking.value === l.npc) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "pick" },
                });
                /** @type {__VLS_StyleScopedClasses['pick']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                const __VLS_12 = MarkPicker;
                // @ts-ignore
                const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
                    // @ts-ignore
                    modelValue: (marks.value[l.npc]), allowCustom: true, base: (l.contract),
                }));
                const __VLS_14 = __VLS_13({
                    modelValue: (marks.value[l.npc]),
                    allowCustom: true,
                    base: (l.contract),
                }, ...__VLS_functionalComponentArgsRest(__VLS_13));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(market.value))
                                throw 0;
                            if (!(__VLS_unwrap(npcRecord, {})(s.value, l.npc)))
                                throw 0;
                            if (!(marking.value === l.npc))
                                throw 0;
                            return (buy(l));
                            // @ts-ignore
                            [enslaved, game, marking, marks,];
                        } },
                    ...{ class: "small primary" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                (__VLS_unwrap(formatMoney, {})(l.price_cc));
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(market.value))
                                throw 0;
                            if (!(__VLS_unwrap(npcRecord, {})(s.value, l.npc)))
                                throw 0;
                            if (!(marking.value === l.npc))
                                throw 0;
                            return (marking.value = null);
                            // @ts-ignore
                            [formatMoney, marking,];
                        } },
                    ...{ class: "small" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
            if (open.value === l.npc) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ style: {} },
                    placeholder: "例如：指出他身上的舊傷、對商人拋媚眼、搬出公會的名號",
                });
                (haggleText.value[l.npc]);
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(market.value))
                                throw 0;
                            if (!(__VLS_unwrap(npcRecord, {})(s.value, l.npc)))
                                throw 0;
                            if (!(open.value === l.npc))
                                throw 0;
                            return (haggle(l));
                            // @ts-ignore
                            [open, haggleText,];
                        } },
                    ...{ class: "small" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
        }
        // @ts-ignore
        [];
    }
    if (stock.value.length === 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    // @ts-ignore
    [stock,];
    var __VLS_3;
    if (!bound.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (enslaved.value ? '登記出售自己（找新主人）' : '登記出售自己');
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (slaveryRules.value.self_sale.hours);
        (Math.round(__VLS_unwrap(selfSaleChance, {})(s.value) * 100));
        (Math.round(slaveryRules.value.self_sale.share * 100));
        if (enslaved.value) {
        }
        if (enslaved.value) {
        }
        else {
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(buyers, {}));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (sellSelf) },
            ...{ class: "small danger" },
            disabled: (s.value.party.length > 1),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    }
}
// @ts-ignore
[s, s, enslaved, enslaved, enslaved, bound, slaveryRules, slaveryRules, selfSaleChance, buyers,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
