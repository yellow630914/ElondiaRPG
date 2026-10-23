import FoldSection from './FoldSection.vue';
import HomePanel from './HomePanel.vue';
import { computed, ref, watch } from 'vue';
import { attrOf, mod } from '@/engine/character';
import { attrName, geography, isCustomShopId, landmarkDef, locationById, shopRules } from '@/engine/data';
import { canTravelHere, CELL_ICON, cellName, currentArea, currentCell, DUNGEON_LAYERS, LOCK_METHODS, lockPicker, questRunnableHere } from '@/engine/grid';
import { formatMoney } from '@/engine/money';
import { marketsHere } from '@/engine/companions';
import { canNegotiate } from '@/engine/negotiation';
import { canAcceptRank, guildQuests, questSpot, questTemplate, templeCost } from '@/engine/town';
import { examQuest, isExam, promotionStatus } from '@/engine/guild';
import { canTurnIn, deliverable, isCollectQuest, isMaterialQuest, layerName, layerRanks, questProgressText, rewardFor } from '@/engine/materialQuests';
import { bestTool } from '@/engine/tools';
import { legFare, MODE_NAME } from '@/engine/travel';
import { reachable } from '@/engine/world';
import { useGame } from '@/stores/game';
import { useContent } from '@/stores/content';
import BrothelPanel from './BrothelPanel.vue';
import GuardStatus from './GuardStatus.vue';
import MarketPanel from './MarketPanel.vue';
import NegotiationPanel from './NegotiationPanel.vue';
import StoryPanel from './StoryPanel.vue';
import ShopPanel from './ShopPanel.vue';
import LandmarkPanel from './LandmarkPanel.vue';
import { closedHere } from '@/engine/landmarks';
import TattooPanel from './TattooPanel.vue';
import TavernPanel from './TavernPanel.vue';
import WorkPanel from './WorkPanel.vue';
import TrainPanel from './TrainPanel.vue';
import { checkBonus } from '@/engine/perks';
import CraftPanel from './CraftPanel.vue';
const game = useGame();
const content = useContent();
const s = computed(() => game.state);
const here = computed(() => locationById(s.value.location));
const area = computed(() => currentArea(s.value));
const cell = computed(() => currentCell(s.value));
const lockTool = computed(() => bestTool(s.value, 'lockpick'));
const LOCK_ICON = { dex: '🔓', str: '💪', int: '🧠' };
function lockBonus(k) {
    const picker = lockPicker(s.value, k);
    return mod(attrOf(picker, k)) + (k === 'dex' ? lockTool.value?.bonus ?? 0 : 0) + checkBonus(picker, { context: 'lock', attr: k });
}
const signed = (n) => (n >= 0 ? `+${n}` : String(n));
const intent = computed({ get: () => game.intent, set: (v) => (game.intent = v) });
const AREA_NAME = { town: '城內', outskirts: '近郊', dungeon: '冒險區域' };
// ---- 公會委託（走進公會時才產生） ----
const quests = ref([]);
watch(() => [cell.value.kind, area.value.key], ([kind]) => {
    if (kind === 'guild')
        quests.value = game.visitGuild();
}, { immediate: true });
function refreshQuests() {
    quests.value = guildQuests(s.value);
}
const promo = computed(() => promotionStatus(s.value));
const exam = computed(() => examQuest(s.value));
const activeQuests = computed(() => s.value.quests.filter((q) => q.status === 'accepted' || q.status === 'ready'));
// 材料委託可以過量交付：選要交幾份（預設全部）
const turnInQty = ref({});
function turnIn(q) {
    game.turnInQuest(q.id, isMaterialQuest(q) ? turnInQty.value[q.id] ?? deliverable(s.value, q) : undefined);
    refreshQuests();
}
const runnableHere = computed(() => activeQuests.value.filter((q) => q.status === 'accepted' && q.area !== 'dungeon' && questRunnableHere(s.value, { ...q, spot: questSpot(q) })));
function questWhere(q) {
    if (canTurnIn(s.value, q))
        return `可以交付了！回到${locationById(q.giver).name}的冒險者公會${isMaterialQuest(q) ? '（可以多交，報酬依數量增加）' : ''}`;
    if (q.area === 'dungeon')
        return `目標：${locationById(q.target).name}${q.layer ? `・${layerName(q.layer)}` : ''}`;
    if (isMaterialQuest(q))
        return `地點：${locationById(q.target).name}近郊（${isCollectQuest(q) && q.monster ? '打倒牠們' : '採集點'}）`;
    if (q.area === 'outskirts')
        return `地點：${locationById(q.target).name}近郊（地圖上的 ❗）`;
    return `地點：${locationById(q.target).name}的${cellName(questSpot(q)) || questSpot(q)}`;
}
/** 按鈕上的耗時：驅除、討伐直接開打，時間照戰鬥回合算，不是範本上的小時數 */
function questTime(q) {
    const tpl = questTemplate(q);
    if (tpl?.kind === 'pest' || tpl?.kind === 'hunt')
        return '直接進入戰鬥';
    return `約 ${tpl?.hours ?? 1} 小時`;
}
function runQuest(id) {
    game.doTownQuest(id, intent.value || undefined);
    intent.value = '';
}
// ---- 市場 ----
const publicMarket = computed(() => marketsHere(s.value).some((m) => m.kind === 'public'));
const rations = computed(() => s.value.inventory.find((i) => i.name === '乾糧')?.qty ?? 0);
// ---- 旅行 ----
const destinations = computed(() => {
    const list = reachable(s.value.location);
    return geography.regions
        .map((r) => ({ region: r, items: list.filter((d) => locationById(d.id).region === r.id) }))
        .filter((g) => g.items.length > 0);
});
function daysText(days) {
    return days[0] === days[1] ? `${days[0]} 天` : `${days[0]}～${days[1]} 天`;
}
function routeText(path) {
    const modes = [...new Set(path.legs.map((l) => MODE_NAME[l.mode]))].join('/');
    const via = path.legs.slice(0, -1).map((l) => locationById(l.to).name);
    const fare = path.legs.reduce((sum, l) => sum + legFare(l), 0);
    const text = via.length ? `${modes}・經${via.join('、')}` : modes;
    return fare > 0 ? `${text}・船資每人 ${formatMoney(fare)}` : text;
}
/** 地下城各層的階級，例如「淺層 E・中層 D・深層 C」 */
function layerRankText(id) {
    return layerRanks(id).map((r) => `${layerName(r.layer)} ${r.rank}`).join('・');
}
function go(id) {
    game.travel(id, intent.value || undefined);
    intent.value = '';
}
const ICON = computed(() => {
    void content.version;
    return { ...CELL_ICON, floor: '🧭' };
});
// 鐵匠鋪、裁縫店、珠寶店、魔法物品店、情報商：各自的交易清單
const SHOPS = ['smithy', 'tailor', 'jeweler', 'magic', 'informant'];
// 自建的商店（內容編輯器擺的）：格子的種類就是商店的 id
const shopHere = computed(() => {
    void content.version;
    const k = cell.value.kind;
    if (SHOPS.includes(k))
        return k;
    return isCustomShopId(k) && shopRules.types[k] ? k : null;
});
// 商店的說明（shops.json 的 desc，內容頁籤可以改）
const shopDesc = computed(() => {
    void content.version;
    return Object.values(shopRules.types).find((t) => t.cell === cell.value.kind)?.desc ?? landmarkDef(cell.value.kind)?.desc ?? '';
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(area, {});
// @ts-ignore
__VLS_withDotValue(cell, {});
// @ts-ignore
__VLS_withDotValue(ICON, {});
// @ts-ignore
__VLS_withDotValue(shopDesc, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(publicMarket, {});
// @ts-ignore
__VLS_withDotValue(shopHere, {});
// @ts-ignore
__VLS_withDotValue(promo, {});
// @ts-ignore
__VLS_withDotValue(exam, {});
// @ts-ignore
__VLS_withDotValue(quests, {});
// @ts-ignore
__VLS_withDotValue(AREA_NAME, {});
// @ts-ignore
__VLS_withDotValue(turnInQty, {});
// @ts-ignore
__VLS_withDotValue(here, {});
// @ts-ignore
__VLS_withDotValue(DUNGEON_LAYERS, {});
// @ts-ignore
__VLS_withDotValue(lockTool, {});
// @ts-ignore
__VLS_withDotValue(LOCK_ICON, {});
// @ts-ignore
__VLS_withDotValue(activeQuests, {});
void {};
/** @type {__VLS_StyleScopedClasses['guild-rank']} */ ;
/** @type {__VLS_StyleScopedClasses['hot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "place" },
});
/** @type {__VLS_StyleScopedClasses['place']} */ ;
const __VLS_0 = HomePanel;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
// @ts-ignore
}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (area.value.kind !== 'road' && area.value.kind !== 'home') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    if (cell.value.storyNode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        (ICON.value[cell.value.kind] ?? '📍');
        (cell.value.kind === 'wall' ? '道路' : __VLS_unwrap(cellName, {})(cell.value.kind));
    }
    if (shopDesc.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (shopDesc.value);
    }
    if (cell.value.kind === 'inn') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    else if (cell.value.kind === 'temple') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                        throw 0;
                    if (!!(cell.value.kind === 'inn'))
                        throw 0;
                    if (!(cell.value.kind === 'temple'))
                        throw 0;
                    return (game.value.templeHeal());
                    // @ts-ignore
                    [area, area, cell, cell, cell, cell, cell, cell, ICON, cellName, shopDesc, shopDesc, game,];
                } },
            disabled: (__VLS_unwrap(templeCost, {})(s.value) === 0 || s.value.money_cc < __VLS_unwrap(templeCost, {})(s.value)),
        });
        (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(templeCost, {})(s.value)));
        const __VLS_5 = ShopPanel;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            // @ts-ignore
            key: (`temple-${s.value.location}-${s.value.time.day}`), type: "temple",
        }));
        const __VLS_7 = __VLS_6({
            key: (`temple-${s.value.location}-${s.value.time.day}`),
            type: "temple",
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "tavern-trade" },
        });
        /** @type {__VLS_StyleScopedClasses['tavern-trade']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_10 = TattooPanel;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            // @ts-ignore
            shop: "temple",
        }));
        const __VLS_12 = __VLS_11({
            shop: "temple",
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    }
    else if (cell.value.kind === 'tattoo') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_15 = TattooPanel;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            // @ts-ignore
            shop: "parlor",
        }));
        const __VLS_17 = __VLS_16({
            shop: "parlor",
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    }
    else if (cell.value.kind === 'carver') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_20 = TattooPanel;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
            // @ts-ignore
            shop: "carver",
        }));
        const __VLS_22 = __VLS_21({
            shop: "carver",
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    else if (cell.value.kind === 'shop') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (__VLS_unwrap(rations, {}));
        const __VLS_25 = ShopPanel;
        // @ts-ignore
        const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
            // @ts-ignore
            key: (`general-${s.value.location}-${s.value.time.day}`), type: "general",
        }));
        const __VLS_27 = __VLS_26({
            key: (`general-${s.value.location}-${s.value.time.day}`),
            type: "general",
        }, ...__VLS_functionalComponentArgsRest(__VLS_26));
        if (publicMarket.value) {
            const __VLS_30 = MarketPanel;
            // @ts-ignore
            const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
                // @ts-ignore
                kind: "public",
            }));
            const __VLS_32 = __VLS_31({
                kind: "public",
            }, ...__VLS_functionalComponentArgsRest(__VLS_31));
        }
    }
    else if (shopHere.value) {
        const __VLS_35 = ShopPanel;
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
            // @ts-ignore
            key: (`${shopHere.value}-${s.value.location}-${s.value.time.day}`), type: (shopHere.value),
        }));
        const __VLS_37 = __VLS_36({
            key: (`${shopHere.value}-${s.value.location}-${s.value.time.day}`),
            type: (shopHere.value),
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    }
    else if (cell.value.kind === 'tavern') {
        const __VLS_40 = TavernPanel;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
            // @ts-ignore
            key: (`${s.value.location}-${s.value.time.day}`),
        }));
        const __VLS_42 = __VLS_41({
            key: (`${s.value.location}-${s.value.time.day}`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "tavern-trade" },
        });
        /** @type {__VLS_StyleScopedClasses['tavern-trade']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_45 = ShopPanel;
        // @ts-ignore
        const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
            // @ts-ignore
            key: (`tavern-${s.value.location}-${s.value.time.day}`), type: "tavern",
        }));
        const __VLS_47 = __VLS_46({
            key: (`tavern-${s.value.location}-${s.value.time.day}`),
            type: "tavern",
        }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    }
    else if (cell.value.kind === 'guild') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "guild-rank small" },
        });
        /** @type {__VLS_StyleScopedClasses['guild-rank']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (promo.value.rank);
        (promo.value.merit);
        if (promo.value.next) {
            (promo.value.next);
            (promo.value.needMerit);
            (promo.value.needLevel);
        }
        if (exam.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "hot" },
            });
            /** @type {__VLS_StyleScopedClasses['hot']} */ ;
            (exam.value.title);
            (exam.value.status === 'available' ? '在委託板上，可以接取' : exam.value.status === 'ready' ? '完成了，可以交付' : '進行中');
        }
        else if (promo.value.next) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        const __VLS_50 = FoldSection || FoldSection;
        // @ts-ignore
        const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
            // @ts-ignore
            id: "guild.board", title: "📋 委託板", count: (quests.value.length),
        }));
        const __VLS_52 = __VLS_51({
            id: "guild.board",
            title: "📋 委託板",
            count: (quests.value.length),
        }, ...__VLS_functionalComponentArgsRest(__VLS_51));
        const { default: __VLS_55 } = __VLS_nonNull(__VLS_53.slots);
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        if (quests.value.length === 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                ...{ class: "muted small" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        const __VLS_56 = __VLS_tryAsConstant((quests.value));
        for (const [q] of __VLS_vFor(__VLS_nonNull(__VLS_56))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (q.id),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
                ...{ class: ({ hot: __VLS_unwrap(isExam, {})(q) }) },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            /** @type {__VLS_StyleScopedClasses['hot']} */ ;
            (__VLS_unwrap(isExam, {})(q) ? `晉升 ${q.rank}` : q.rank);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            (AREA_NAME.value[q.area]);
            (q.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(formatMoney, {})(q.reward_cc));
            if (__VLS_unwrap(isMaterialQuest, {})(q) && (q.max ?? q.goal) > q.goal) {
                (q.max);
                (__VLS_unwrap(isCollectQuest, {})(q) ? ' 份' : ' 次');
            }
            if (q.status !== 'available') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_unwrap(questProgressText, {})(s.value, q));
            }
            if (q.status === 'available') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                                throw 0;
                            if (!!(cell.value.kind === 'inn'))
                                throw 0;
                            if (!!(cell.value.kind === 'temple'))
                                throw 0;
                            if (!!(cell.value.kind === 'tattoo'))
                                throw 0;
                            if (!!(cell.value.kind === 'carver'))
                                throw 0;
                            if (!!(cell.value.kind === 'shop'))
                                throw 0;
                            if (!!(shopHere.value))
                                throw 0;
                            if (!!(cell.value.kind === 'tavern'))
                                throw 0;
                            if (!(cell.value.kind === 'guild'))
                                throw 0;
                            if (!(q.status === 'available'))
                                throw 0;
                            game.value.acceptQuest(q.id);
                            refreshQuests();
                            // @ts-ignore
                            [cell, cell, cell, cell, cell, game, templeCost, templeCost, templeCost, s, s, s, s, s, s, s, s, s, s, s, s, s, s, s, formatMoney, formatMoney, rations, publicMarket, shopHere, shopHere, shopHere, promo, promo, promo, promo, promo, promo, promo, exam, exam, exam, exam, quests, quests, quests, isExam, isExam, AREA_NAME, isMaterialQuest, isCollectQuest, questProgressText,];
                        } },
                    ...{ class: "small" },
                    disabled: (!__VLS_unwrap(canAcceptRank, {})(s.value, q.rank, q)),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                (__VLS_unwrap(canAcceptRank, {})(s.value, q.rank, q) ? '接取' : '階級不足');
            }
            else if (__VLS_unwrap(canTurnIn, {})(s.value, q)) {
                if (__VLS_unwrap(isMaterialQuest, {})(q) && __VLS_unwrap(deliverable, {})(s.value, q) > q.goal) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        type: "number",
                        ...{ class: "qty" },
                        min: (q.goal),
                        max: (__VLS_unwrap(deliverable, {})(s.value, q)),
                        placeholder: (String(__VLS_unwrap(deliverable, {})(s.value, q))),
                    });
                    (turnInQty.value[q.id]);
                    /** @type {__VLS_StyleScopedClasses['qty']} */ ;
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                                throw 0;
                            if (!!(cell.value.kind === 'inn'))
                                throw 0;
                            if (!!(cell.value.kind === 'temple'))
                                throw 0;
                            if (!!(cell.value.kind === 'tattoo'))
                                throw 0;
                            if (!!(cell.value.kind === 'carver'))
                                throw 0;
                            if (!!(cell.value.kind === 'shop'))
                                throw 0;
                            if (!!(shopHere.value))
                                throw 0;
                            if (!!(cell.value.kind === 'tavern'))
                                throw 0;
                            if (!(cell.value.kind === 'guild'))
                                throw 0;
                            if (!!(q.status === 'available'))
                                throw 0;
                            if (!(__VLS_unwrap(canTurnIn, {})(s.value, q)))
                                throw 0;
                            return (turnIn(q));
                            // @ts-ignore
                            [s, s, s, s, s, s, isMaterialQuest, canAcceptRank, canAcceptRank, canTurnIn, deliverable, deliverable, deliverable, turnInQty,];
                        } },
                    ...{ class: "small primary" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                if (__VLS_unwrap(isMaterialQuest, {})(q)) {
                    (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(rewardFor, {})(q, turnInQty.value[q.id] ?? __VLS_unwrap(deliverable, {})(s.value, q))));
                }
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "small muted" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            }
            if (!__VLS_unwrap(canNegotiate, {})(s.value, 'quest_reward', { quest: q.id })) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                                throw 0;
                            if (!!(cell.value.kind === 'inn'))
                                throw 0;
                            if (!!(cell.value.kind === 'temple'))
                                throw 0;
                            if (!!(cell.value.kind === 'tattoo'))
                                throw 0;
                            if (!!(cell.value.kind === 'carver'))
                                throw 0;
                            if (!!(cell.value.kind === 'shop'))
                                throw 0;
                            if (!!(shopHere.value))
                                throw 0;
                            if (!!(cell.value.kind === 'tavern'))
                                throw 0;
                            if (!(cell.value.kind === 'guild'))
                                throw 0;
                            if (!(!__VLS_unwrap(canNegotiate, {})(s.value, 'quest_reward', { quest: q.id })))
                                throw 0;
                            return (game.value.startNegotiation('quest_reward', { quest: q.id }));
                            // @ts-ignore
                            [game, s, s, formatMoney, isMaterialQuest, deliverable, turnInQty, rewardFor, canNegotiate,];
                        } },
                    ...{ class: "small" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
            else if (q.flags?.negotiated) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "small muted" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            }
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_53;
    }
    else if (cell.value.kind === 'gate') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_57 = GuardStatus;
        // @ts-ignore
        const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
            // @ts-ignore
            canPay: true,
        }));
        const __VLS_59 = __VLS_58({
            canPay: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_58));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                        throw 0;
                    if (!!(cell.value.kind === 'inn'))
                        throw 0;
                    if (!!(cell.value.kind === 'temple'))
                        throw 0;
                    if (!!(cell.value.kind === 'tattoo'))
                        throw 0;
                    if (!!(cell.value.kind === 'carver'))
                        throw 0;
                    if (!!(cell.value.kind === 'shop'))
                        throw 0;
                    if (!!(shopHere.value))
                        throw 0;
                    if (!!(cell.value.kind === 'tavern'))
                        throw 0;
                    if (!!(cell.value.kind === 'guild'))
                        throw 0;
                    if (!(cell.value.kind === 'gate'))
                        throw 0;
                    return (game.value.goOutskirts());
                    // @ts-ignore
                    [cell, game,];
                } },
        });
        (here.value.name);
    }
    else if (cell.value.kind === 'exit' && area.value.kind === 'wild') {
        const __VLS_62 = GuardStatus;
        // @ts-ignore
        const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
            // @ts-ignore
            canPay: true,
        }));
        const __VLS_64 = __VLS_63({
            canPay: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_63));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                        throw 0;
                    if (!!(cell.value.kind === 'inn'))
                        throw 0;
                    if (!!(cell.value.kind === 'temple'))
                        throw 0;
                    if (!!(cell.value.kind === 'tattoo'))
                        throw 0;
                    if (!!(cell.value.kind === 'carver'))
                        throw 0;
                    if (!!(cell.value.kind === 'shop'))
                        throw 0;
                    if (!!(shopHere.value))
                        throw 0;
                    if (!!(cell.value.kind === 'tavern'))
                        throw 0;
                    if (!!(cell.value.kind === 'guild'))
                        throw 0;
                    if (!!(cell.value.kind === 'gate'))
                        throw 0;
                    if (!(cell.value.kind === 'exit' && area.value.kind === 'wild'))
                        throw 0;
                    return (game.value.returnToTown());
                    // @ts-ignore
                    [area, cell, game, here,];
                } },
        });
        (here.value.name);
    }
    else if (cell.value.kind === 'merchant') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_67 = ShopPanel;
        // @ts-ignore
        const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
            // @ts-ignore
            key: (`wanderer-${s.value.location}-${s.value.time.day}`), type: "wanderer",
        }));
        const __VLS_69 = __VLS_68({
            key: (`wanderer-${s.value.location}-${s.value.time.day}`),
            type: "wanderer",
        }, ...__VLS_functionalComponentArgsRest(__VLS_68));
    }
    else if (cell.value.kind === 'exit' && area.value.kind === 'side') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (area.value.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                        throw 0;
                    if (!!(cell.value.kind === 'inn'))
                        throw 0;
                    if (!!(cell.value.kind === 'temple'))
                        throw 0;
                    if (!!(cell.value.kind === 'tattoo'))
                        throw 0;
                    if (!!(cell.value.kind === 'carver'))
                        throw 0;
                    if (!!(cell.value.kind === 'shop'))
                        throw 0;
                    if (!!(shopHere.value))
                        throw 0;
                    if (!!(cell.value.kind === 'tavern'))
                        throw 0;
                    if (!!(cell.value.kind === 'guild'))
                        throw 0;
                    if (!!(cell.value.kind === 'gate'))
                        throw 0;
                    if (!!(cell.value.kind === 'exit' && area.value.kind === 'wild'))
                        throw 0;
                    if (!!(cell.value.kind === 'merchant'))
                        throw 0;
                    if (!(cell.value.kind === 'exit' && area.value.kind === 'side'))
                        throw 0;
                    return (game.value.leaveSide());
                    // @ts-ignore
                    [area, area, cell, cell, game, s, s, here,];
                } },
        });
        (s.value.road ? '旅途' : '原本的地方');
    }
    else if (cell.value.kind === 'exit' && area.value.kind === 'dungeon') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (here.value.name);
    }
    else if (cell.value.kind === 'stairs_down') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (DUNGEON_LAYERS.value[(area.value.layer ?? 0) + 1]?.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                        throw 0;
                    if (!!(cell.value.kind === 'inn'))
                        throw 0;
                    if (!!(cell.value.kind === 'temple'))
                        throw 0;
                    if (!!(cell.value.kind === 'tattoo'))
                        throw 0;
                    if (!!(cell.value.kind === 'carver'))
                        throw 0;
                    if (!!(cell.value.kind === 'shop'))
                        throw 0;
                    if (!!(shopHere.value))
                        throw 0;
                    if (!!(cell.value.kind === 'tavern'))
                        throw 0;
                    if (!!(cell.value.kind === 'guild'))
                        throw 0;
                    if (!!(cell.value.kind === 'gate'))
                        throw 0;
                    if (!!(cell.value.kind === 'exit' && area.value.kind === 'wild'))
                        throw 0;
                    if (!!(cell.value.kind === 'merchant'))
                        throw 0;
                    if (!!(cell.value.kind === 'exit' && area.value.kind === 'side'))
                        throw 0;
                    if (!!(cell.value.kind === 'exit' && area.value.kind === 'dungeon'))
                        throw 0;
                    if (!(cell.value.kind === 'stairs_down'))
                        throw 0;
                    return (game.value.descend());
                    // @ts-ignore
                    [area, area, cell, cell, game, s, here, DUNGEON_LAYERS,];
                } },
            ...{ class: "primary" },
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    }
    else if (cell.value.kind === 'stairs_up') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                        throw 0;
                    if (!!(cell.value.kind === 'inn'))
                        throw 0;
                    if (!!(cell.value.kind === 'temple'))
                        throw 0;
                    if (!!(cell.value.kind === 'tattoo'))
                        throw 0;
                    if (!!(cell.value.kind === 'carver'))
                        throw 0;
                    if (!!(cell.value.kind === 'shop'))
                        throw 0;
                    if (!!(shopHere.value))
                        throw 0;
                    if (!!(cell.value.kind === 'tavern'))
                        throw 0;
                    if (!!(cell.value.kind === 'guild'))
                        throw 0;
                    if (!!(cell.value.kind === 'gate'))
                        throw 0;
                    if (!!(cell.value.kind === 'exit' && area.value.kind === 'wild'))
                        throw 0;
                    if (!!(cell.value.kind === 'merchant'))
                        throw 0;
                    if (!!(cell.value.kind === 'exit' && area.value.kind === 'side'))
                        throw 0;
                    if (!!(cell.value.kind === 'exit' && area.value.kind === 'dungeon'))
                        throw 0;
                    if (!!(cell.value.kind === 'stairs_down'))
                        throw 0;
                    if (!(cell.value.kind === 'stairs_up'))
                        throw 0;
                    return (game.value.ascend());
                    // @ts-ignore
                    [cell, game,];
                } },
        });
        (DUNGEON_LAYERS.value[(area.value.layer ?? 1) - 1]?.name);
    }
    else if (cell.value.kind === 'brothel') {
        const __VLS_72 = BrothelPanel;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({
        // @ts-ignore
        }));
        const __VLS_74 = __VLS_73({}, ...__VLS_functionalComponentArgsRest(__VLS_73));
    }
    else if (cell.value.kind === 'safe') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    else if (cell.value.kind === 'chest' && !cell.value.done && cell.value.lock) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (cell.value.lock);
        (lockTool.value ? `開鎖時用${lockTool.value.name}（+${lockTool.value.bonus}）。` : '靈巧開鎖時，帶著開鎖類的工具會容易一點。');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row lock-methods" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['lock-methods']} */ ;
        const __VLS_77 = __VLS_tryAsConstant((__VLS_unwrap(LOCK_METHODS, {})));
        for (const [m, k] of __VLS_vFor(__VLS_nonNull(__VLS_77))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                            throw 0;
                        if (!!(cell.value.kind === 'inn'))
                            throw 0;
                        if (!!(cell.value.kind === 'temple'))
                            throw 0;
                        if (!!(cell.value.kind === 'tattoo'))
                            throw 0;
                        if (!!(cell.value.kind === 'carver'))
                            throw 0;
                        if (!!(cell.value.kind === 'shop'))
                            throw 0;
                        if (!!(shopHere.value))
                            throw 0;
                        if (!!(cell.value.kind === 'tavern'))
                            throw 0;
                        if (!!(cell.value.kind === 'guild'))
                            throw 0;
                        if (!!(cell.value.kind === 'gate'))
                            throw 0;
                        if (!!(cell.value.kind === 'exit' && area.value.kind === 'wild'))
                            throw 0;
                        if (!!(cell.value.kind === 'merchant'))
                            throw 0;
                        if (!!(cell.value.kind === 'exit' && area.value.kind === 'side'))
                            throw 0;
                        if (!!(cell.value.kind === 'exit' && area.value.kind === 'dungeon'))
                            throw 0;
                        if (!!(cell.value.kind === 'stairs_down'))
                            throw 0;
                        if (!!(cell.value.kind === 'stairs_up'))
                            throw 0;
                        if (!!(cell.value.kind === 'brothel'))
                            throw 0;
                        if (!!(cell.value.kind === 'safe'))
                            throw 0;
                        if (!(cell.value.kind === 'chest' && !cell.value.done && cell.value.lock))
                            throw 0;
                        return (game.value.pickLock(k));
                        // @ts-ignore
                        [area, cell, cell, cell, cell, cell, cell, game, DUNGEON_LAYERS, lockTool, lockTool, lockTool, LOCK_METHODS,];
                    } },
                key: (k),
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (LOCK_ICON.value[k]);
            (m.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(attrName, {})(k));
            (__VLS_unwrap(lockPicker, {})(s.value, k).name);
            (__VLS_unwrap(signed, {})(lockBonus(k)));
            // @ts-ignore
            [s, LOCK_ICON, attrName, lockPicker, signed,];
        }
    }
    else if (__VLS_unwrap(landmarkDef, {})(cell.value.kind)) {
        const __VLS_78 = LandmarkPanel;
        // @ts-ignore
        const __VLS_79 = __VLS_asFunctionalComponent1(__VLS_78, new __VLS_78({
            // @ts-ignore
            key: (`lm-${area.value.key}-${cell.value.kind}`),
        }));
        const __VLS_80 = __VLS_79({
            key: (`lm-${area.value.key}-${cell.value.kind}`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_79));
    }
    else if (!cell.value.storyNode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted small" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (cell.value.done ? '這裡已經清理乾淨了。' : '四下無事。');
    }
    const __VLS_83 = WorkPanel;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent1(__VLS_83, new __VLS_83({
        // @ts-ignore
        key: (`${area.value.key}-${cell.value.kind}`),
    }));
    const __VLS_85 = __VLS_84({
        key: (`${area.value.key}-${cell.value.kind}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    if (!__VLS_unwrap(closedHere, {})(s.value)) {
        const __VLS_88 = TrainPanel;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent1(__VLS_88, new __VLS_88({
            // @ts-ignore
            key: (`train-${area.value.key}-${cell.value.kind}`),
        }));
        const __VLS_90 = __VLS_89({
            key: (`train-${area.value.key}-${cell.value.kind}`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    }
    const __VLS_93 = CraftPanel;
    // @ts-ignore
    const __VLS_94 = __VLS_asFunctionalComponent1(__VLS_93, new __VLS_93({
        // @ts-ignore
        key: (`craft-${area.value.key}-${cell.value.kind}`),
    }));
    const __VLS_95 = __VLS_94({
        key: (`craft-${area.value.key}-${cell.value.kind}`),
    }, ...__VLS_functionalComponentArgsRest(__VLS_94));
    const __VLS_98 = __VLS_tryAsConstant((__VLS_unwrap(runnableHere, {})));
    for (const [q] of __VLS_vFor(__VLS_nonNull(__VLS_98))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (q.id),
            ...{ class: "quest-here" },
        });
        /** @type {__VLS_StyleScopedClasses['quest-here']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (q.rank);
        (q.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(area.value.kind !== 'road' && area.value.kind !== 'home'))
                        throw 0;
                    return (runQuest(q.id));
                    // @ts-ignore
                    [area, area, area, area, cell, cell, cell, cell, cell, cell, cell, s, landmarkDef, closedHere, runnableHere,];
                } },
            ...{ class: "small primary" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        (questTime(q));
        // @ts-ignore
        [];
    }
}
const __VLS_99 = NegotiationPanel;
// @ts-ignore
const __VLS_100 = __VLS_asFunctionalComponent1(__VLS_99, new __VLS_99({
// @ts-ignore
}));
const __VLS_101 = __VLS_100({}, ...__VLS_functionalComponentArgsRest(__VLS_100));
const __VLS_104 = StoryPanel;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent1(__VLS_104, new __VLS_104({
// @ts-ignore
}));
const __VLS_106 = __VLS_105({}, ...__VLS_functionalComponentArgsRest(__VLS_105));
if (activeQuests.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    const __VLS_109 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_110 = __VLS_asFunctionalComponent1(__VLS_109, new __VLS_109({
        // @ts-ignore
        id: "quests.active", title: "📜 進行中的委託", count: (activeQuests.value.length), level: "h3",
    }));
    const __VLS_111 = __VLS_110({
        id: "quests.active",
        title: "📜 進行中的委託",
        count: (activeQuests.value.length),
        level: "h3",
    }, ...__VLS_functionalComponentArgsRest(__VLS_110));
    const { default: __VLS_114 } = __VLS_nonNull(__VLS_112.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain small" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_115 = __VLS_tryAsConstant((activeQuests.value));
    for (const [q] of __VLS_vFor(__VLS_nonNull(__VLS_115))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (q.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (q.rank);
        (q.title);
        (__VLS_unwrap(questProgressText, {})(s.value, q));
        if (q.flags?.lead) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (questWhere(q));
        // @ts-ignore
        [s, questProgressText, activeQuests, activeQuests, activeQuests,];
    }
    // @ts-ignore
    [];
    var __VLS_112;
}
if (__VLS_unwrap(canTravelHere, {})(s.value)) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    const __VLS_116 = __VLS_tryAsConstant((__VLS_unwrap(destinations, {})));
    for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_116))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            key: (g.region.id),
            open: (g.region.id === here.value.region),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (g.region.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        const __VLS_117 = __VLS_tryAsConstant((g.items));
        for (const [d] of __VLS_vFor(__VLS_nonNull(__VLS_117))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (d.id),
                ...{ class: "row" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_unwrap(locationById, {})(d.id).name);
            if (__VLS_unwrap(locationById, {})(d.id).type === 'dungeon') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "tag" },
                    title: (layerRankText(d.id)),
                });
                /** @type {__VLS_StyleScopedClasses['tag']} */ ;
                (layerRankText(d.id));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (daysText(d.path.days));
            (routeText(d.path));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(__VLS_unwrap(canTravelHere, {})(s.value)))
                            throw 0;
                        return (go(d.id));
                        // @ts-ignore
                        [s, here, canTravelHere, destinations, locationById, locationById,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
