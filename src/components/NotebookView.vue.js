import { computed, ref } from 'vue';
import { enemies, locationById, stories } from '@/engine/data';
import { expireIntel, intelPlace } from '@/engine/intel';
import { canTurnIn, isMaterialQuest, layerName, questProgressText } from '@/engine/materialQuests';
import { formatMoney } from '@/engine/money';
import { formatTime } from '@/engine/state';
import { activeNodes, placeText } from '@/engine/story';
import { questScene, questTemplate } from '@/engine/town';
import { useGame } from '@/stores/game';
// 冒險筆記：一般委託、特殊任務（目前的目標與經過）、情報
const game = useGame();
const s = computed(() => game.state);
const tab = ref('quests');
// ---- 一般委託 ----
const AREA = { town: '城內', outskirts: '近郊', dungeon: '冒險區域' };
const active = computed(() => s.value.quests.filter((q) => q.status === 'accepted' || q.status === 'ready'));
const finished = computed(() => s.value.quests.filter((q) => q.status === 'completed').slice(-20).reverse());
function where(q) {
    if (q.area === 'dungeon')
        return `${locationById(q.target).name}${q.layer ? `・${layerName(q.layer)}` : ''}`;
    if (q.area === 'outskirts')
        return `${locationById(q.target).name}近郊`;
    return questTemplate(q) ? questScene(q) : `${locationById(q.target).name}・城內`;
}
function abandonQuest(q) {
    if (confirm(`放棄委託「${q.title}」？公會聲望 -1。`))
        game.abandonQuest(q.id);
}
// ---- 特殊任務 ----
const myStories = computed(() => {
    void s.value.time.minute;
    void s.value.flags;
    const nodes = activeNodes(s.value);
    return Object.values(s.value.stories ?? {})
        .map((p) => ({ p, def: stories.find((d) => d.id === p.id), goals: nodes.filter((n) => n.def.id === p.id) }))
        .filter((x) => x.def)
        .sort((a, b) => Number(a.p.status !== 'active') - Number(b.p.status !== 'active'));
});
function abandon(id, title) {
    if (confirm(`放棄特殊任務「${title}」？放棄後不能再接。`))
        game.abandonStory(id);
}
// ---- 情報 ----
const intel = computed(() => {
    void s.value.time.day;
    expireIntel(s.value);
    return [...(s.value.intel ?? [])].sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || b.time.day - a.time.day);
});
const EVENT = { combat: '💀 盤踞的強敵', chest: '🎁 藏寶處', merchant: '🧳 流浪商人' };
const STATUS = { active: '有效', done: '已完成', expired: '已過期' };
const counts = computed(() => ({
    quests: active.value.length,
    stories: myStories.value.filter((x) => x.p.status === 'active').length,
    intel: intel.value.filter((i) => i.status === 'active' && i.kind === 'point').length,
}));
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(tab, {});
// @ts-ignore
__VLS_withDotValue(counts, {});
// @ts-ignore
__VLS_withDotValue(active, {});
// @ts-ignore
__VLS_withDotValue(AREA, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(enemies, {});
// @ts-ignore
__VLS_withDotValue(finished, {});
// @ts-ignore
__VLS_withDotValue(myStories, {});
// @ts-ignore
__VLS_withDotValue(intel, {});
// @ts-ignore
__VLS_withDotValue(EVENT, {});
// @ts-ignore
__VLS_withDotValue(STATUS, {});
void {};
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "notebook" },
});
/** @type {__VLS_StyleScopedClasses['notebook']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "row tabs" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (tab.value = 'quests');
            // @ts-ignore
            [tab,];
        } },
    ...{ class: ({ active: tab.value === 'quests' }) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
if (counts.value.quests) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (counts.value.quests);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (tab.value = 'stories');
            // @ts-ignore
            [tab, tab, counts, counts,];
        } },
    ...{ class: ({ active: tab.value === 'stories' }) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
if (counts.value.stories) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (counts.value.stories);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (tab.value = 'intel');
            // @ts-ignore
            [tab, tab, counts, counts,];
        } },
    ...{ class: ({ active: tab.value === 'intel' }) },
});
/** @type {__VLS_StyleScopedClasses['active']} */ ;
if (counts.value.intel) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (counts.value.intel);
}
if (tab.value === 'quests') {
    if (!active.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    const __VLS_0 = __VLS_tryAsConstant((active.value));
    for (const [q] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (q.id),
            ...{ class: "card" },
        });
        /** @type {__VLS_StyleScopedClasses['card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (q.rank);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (AREA.value[q.area]);
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        (q.title);
        if (__VLS_unwrap(canTurnIn, {})(s.value, q)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag ok" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            /** @type {__VLS_StyleScopedClasses['ok']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(tab.value === 'quests'))
                        throw 0;
                    return (abandonQuest(q));
                    // @ts-ignore
                    [tab, tab, counts, counts, active, active, AREA, canTurnIn, s,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (__VLS_unwrap(questProgressText, {})(s.value, q));
        (__VLS_unwrap(formatMoney, {})(q.reward_cc));
        (__VLS_unwrap(isMaterialQuest, {})(q) && (q.max ?? q.goal) > q.goal ? '（可以多交，報酬依數量增加）' : '');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (where(q));
        if (q.monster) {
            (enemies.value[q.monster]?.name ?? q.monster);
        }
        (__VLS_unwrap(locationById, {})(q.giver).name);
        if (q.flags?.lead) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        }
        // @ts-ignore
        [s, questProgressText, formatMoney, isMaterialQuest, enemies, locationById,];
    }
    if (finished.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "history" },
        });
        /** @type {__VLS_StyleScopedClasses['history']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (finished.value.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        const __VLS_1 = __VLS_tryAsConstant((finished.value));
        for (const [q] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (q.id),
            });
            (q.rank);
            (q.title);
            if (q.delivered && q.delivered > q.goal) {
                (q.delivered);
            }
            // @ts-ignore
            [finished, finished, finished,];
        }
    }
}
else if (tab.value === 'stories') {
    if (!myStories.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    const __VLS_2 = __VLS_tryAsConstant((myStories.value));
    for (const [{ p, def, goals }] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (p.id),
            ...{ class: "card" },
            ...{ class: (p.status) },
        });
        /** @type {__VLS_StyleScopedClasses['card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        if (def.rank) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            (def.rank);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        (def.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
            ...{ class: ({ ok: p.status === 'completed' }) },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['ok']} */ ;
        (p.status === 'active' ? '進行中' : p.status === 'completed' ? '✅ 完成' : '❌ 失敗');
        if (p.status === 'active') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(tab.value === 'quests'))
                            throw 0;
                        if (!(tab.value === 'stories'))
                            throw 0;
                        if (!(p.status === 'active'))
                            throw 0;
                        return (abandon(p.id, def.title));
                        // @ts-ignore
                        [tab, myStories, myStories,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (def.summary);
        if (p.status === 'active') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
                ...{ class: "plain goals" },
            });
            /** @type {__VLS_StyleScopedClasses['plain']} */ ;
            /** @type {__VLS_StyleScopedClasses['goals']} */ ;
            const __VLS_3 = __VLS_tryAsConstant((goals));
            for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                    key: (g.ref),
                });
                (g.node.title);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (__VLS_unwrap(placeText, {})(g.node, s.value));
                // @ts-ignore
                [s, placeText,];
            }
            if (!goals.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "history" },
            open: (p.status === 'active'),
        });
        /** @type {__VLS_StyleScopedClasses['history']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (p.log.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain small log" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['log']} */ ;
        const __VLS_4 = __VLS_tryAsConstant(([...p.log].reverse()));
        for (const [l, i] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (i),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(formatTime, {})(l.time));
            (l.text);
            // @ts-ignore
            [formatTime,];
        }
        // @ts-ignore
        [];
    }
}
else {
    if (!intel.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    const __VLS_5 = __VLS_tryAsConstant((intel.value));
    for (const [it] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (it.id),
            ...{ class: "card" },
            ...{ class: (it.status) },
        });
        /** @type {__VLS_StyleScopedClasses['card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        (it.kind === 'story' ? '⭐ ' : '');
        (it.title);
        if (it.event) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            (EVENT.value[it.event]);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
            ...{ class: ({ ok: it.status === 'active' }) },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['ok']} */ ;
        (STATUS.value[it.status]);
        if (it.text) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (it.text);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        if (it.kind === 'point') {
            (__VLS_unwrap(intelPlace, {})(it));
            (it.until);
        }
        (__VLS_unwrap(formatTime, {})(it.time));
        (it.source ? `在${__VLS_unwrap(locationById, {})(it.from).name}解讀「${it.source}」得到` : `在${__VLS_unwrap(locationById, {})(it.from).name}的情報商買到`);
        // @ts-ignore
        [locationById, locationById, formatTime, intel, intel, EVENT, STATUS, intelPlace,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
