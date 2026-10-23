import { useSummary } from '@/engine/inventory';
import { computed, nextTick, ref, watch } from 'vue';
import { abilityApCost, combatItems, currentActor, isActive, itemTargets, multLabel, threatMultOf, threatShares, unusableReason, validTargets, } from '@/engine/combat';
import { luckyThreshold } from '@/engine/character';
import { safeText } from '@/engine/content';
import { abilityDef, combatRules, damageTypeName, describeStatus, monsterTraits, statusDef } from '@/engine/data';
import { describeEntry } from '@/narrator/describe';
import { useGame } from '@/stores/game';
import StatBar from './StatBar.vue';
import NameTag from './NameTag.vue';
const { defineEmits, } = {};
const emit = defineEmits();
const game = useGame();
const combat = computed(() => game.state.combat);
// 仇恨值：敵人選目標的機率（不是絕對的）
const shares = computed(() => threatShares(combat.value));
const actor = computed(() => currentActor(combat.value));
const party = computed(() => combat.value.combatants.filter((c) => c.side === 'party'));
const foes = computed(() => combat.value.combatants.filter((c) => c.side === 'enemy'));
const names = computed(() => Object.fromEntries(combat.value.combatants.map((c) => [c.id, c.name])));
const log = ref(null);
const costs = combatRules.action_costs;
/** 已選擇、等待指定目標的行動 */
const pending = ref(null);
const targets = computed(() => {
    if (!actor.value || !pending.value)
        return [];
    if (pending.value.kind === 'item')
        return itemTargets(combat.value, pending.value.item);
    return validTargets(combat.value, actor.value.id, pending.value.kind === 'ability' ? pending.value.ability : undefined);
});
// 道具：行囊裡可以在戰鬥中使用的東西
const items = computed(() => combatItems(game.state));
function itemEffect(name) {
    return useSummary(items.value.find((i) => i.name === name)?.def.use).replace('・戰鬥中', '');
}
const groups = computed(() => {
    const a = actor.value;
    if (!a)
        return [];
    const list = a.abilities.map(abilityDef);
    return [
        { name: '技能', items: list.filter((x) => x.type === 'skill') },
        { name: '法術', items: list.filter((x) => x.type === 'spell').sort((x, y) => (x.circle ?? 0) - (y.circle ?? 0)) },
        { name: '戲法', items: list.filter((x) => x.type === 'cantrip') },
    ].filter((g) => g.items.length > 0);
});
function reason(a) {
    return actor.value ? unusableReason(combat.value, actor.value, a.id) : '不是你的回合';
}
function costText(a) {
    const ap = abilityApCost(a);
    if (a.type === 'cantrip')
        return '0 AP・每回合一次';
    if (a.type === 'spell')
        return `${a.circle} 環・${ap} AP`;
    const gain = a.ap_gain ? `・+${a.ap_gain} AP` : a.ap_gain_on_hit ? `・命中 +${a.ap_gain_on_hit} AP` : '';
    return `${ap} AP${gain}`;
}
function send(action) {
    pending.value = null;
    game.act(action);
}
function choose(a) {
    if (a.target === 'enemy' || a.target === 'ally' || a.target === 'ally_or_downed')
        pending.value = { kind: 'ability', ability: a };
    else
        send({ type: 'ability', ability: a.id });
}
function chooseTarget(id) {
    const p = pending.value;
    if (!p)
        return;
    if (p.kind === 'item')
        send({ type: 'item', item: p.item, target: id });
    else
        send(p.kind === 'attack' ? { type: 'attack', target: id } : { type: 'ability', ability: p.ability.id, target: id });
}
function finish() {
    if (game.finishCombat())
        emit('finished');
}
/** 敵人的屬性抗性與弱點，讓玩家能針對弱點選擇攻擊 */
function affinityTags(c) {
    const tags = [];
    for (const [key, delta] of Object.entries(c.resist)) {
        if (!delta)
            continue;
        const m = Math.max(0, 1 + delta);
        const label = multLabel(m);
        tags.push({
            text: `${damageTypeName(key)} ${label} ×${m}`,
            kind: m === 0 ? 'immune' : m < 1 ? 'resist' : 'weak',
        });
    }
    return tags;
}
function slotsText(c) {
    if (!c.slotMax.length)
        return '';
    return c.slotMax.map((max, i) => `${i + 1}環 ${c.slots[i] ?? 0}/${max}`).join('　');
}
function statusTitle(id) {
    const def = statusDef(id);
    return `${def.kind === 'buff' ? '增益' : '減益'}：${def.name}（${describeStatus(def)}）`;
}
watch(() => combat.value.timeline.length, async () => {
    await nextTick();
    log.value?.scrollTo({ top: log.value.scrollHeight });
});
const resultText = { victory: '勝利！', defeat: '戰敗……', fled: '成功撤退', ongoing: '' };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(combat, {});
// @ts-ignore
__VLS_withDotValue(actor, {});
// @ts-ignore
__VLS_withDotValue(shares, {});
// @ts-ignore
__VLS_withDotValue(targets, {});
// @ts-ignore
__VLS_withDotValue(monsterTraits, {});
// @ts-ignore
__VLS_withDotValue(pending, {});
// @ts-ignore
__VLS_withDotValue(costs, {});
// @ts-ignore
__VLS_withDotValue(items, {});
// @ts-ignore
__VLS_withDotValue(resultText, {});
void {};
/** @type {__VLS_StyleScopedClasses['fighter']} */ ;
/** @type {__VLS_StyleScopedClasses['fighter']} */ ;
/** @type {__VLS_StyleScopedClasses['fighter']} */ ;
/** @type {__VLS_StyleScopedClasses['pips']} */ ;
/** @type {__VLS_StyleScopedClasses['pips']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['ability']} */ ;
/** @type {__VLS_StyleScopedClasses['sides']} */ ;
/** @type {__VLS_StyleScopedClasses['threat']} */ ;
/** @type {__VLS_StyleScopedClasses['threat']} */ ;
/** @type {__VLS_StyleScopedClasses['bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
(combat.value.scene ?? '');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(combat.value.round);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sides" },
});
/** @type {__VLS_StyleScopedClasses['sides']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(party, {})));
for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (c.id),
        ...{ class: "fighter" },
        ...{ class: ({ current: actor.value?.id === c.id, down: !__VLS_unwrap(isActive, {})(c) }) },
    });
    /** @type {__VLS_StyleScopedClasses['fighter']} */ ;
    /** @type {__VLS_StyleScopedClasses['current']} */ ;
    /** @type {__VLS_StyleScopedClasses['down']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    const __VLS_1 = NameTag;
    // @ts-ignore
    const __VLS_2 = __VLS_asFunctionalComponent1(__VLS_1, new __VLS_1({
        // @ts-ignore
        id: (c.id),
    }));
    const __VLS_3 = __VLS_2({
        id: (c.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_2));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (c.level);
    (__VLS_unwrap(luckyThreshold, {})(c.attrs));
    const __VLS_6 = StatBar;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        // @ts-ignore
        kind: "hp", value: (c.hp), max: (c.maxHp),
    }));
    const __VLS_8 = __VLS_7({
        kind: "hp",
        value: (c.hp),
        max: (c.maxHp),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small row ap" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['ap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "pips" },
    });
    /** @type {__VLS_StyleScopedClasses['pips']} */ ;
    const __VLS_11 = __VLS_tryAsConstant((c.apMax));
    for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.i)({
            key: (n),
            ...{ class: ({ on: n <= c.ap }) },
        });
        /** @type {__VLS_StyleScopedClasses['on']} */ ;
        // @ts-ignore
        [combat, combat, party, actor, isActive, luckyThreshold,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (c.ap);
    (c.apMax);
    (c.apRegen);
    if (c.tempHp) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (c.tempHp);
    }
    if (__VLS_unwrap(isActive, {})(c)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small muted threat" },
            title: (`仇恨值 ${Math.round(c.threat ?? 0)}・累積倍率 ×${__VLS_unwrap(threatMultOf, {})(c).toFixed(2)}（職業、裝備、天賦與狀態）。敵人依仇恨加權選目標，不是絕對的。`),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['threat']} */ ;
        (Math.round(c.threat ?? 0));
        (Math.round((shares.value[c.id] ?? 0) * 100));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "bar" },
        });
        /** @type {__VLS_StyleScopedClasses['bar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.i)({
            ...{ style: ({ width: `${Math.round((shares.value[c.id] ?? 0) * 100)}%` }) },
        });
    }
    if (c.slotMax.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (slotsText(c));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_12 = __VLS_tryAsConstant((c.statuses));
    for (const [st] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (st.id),
            ...{ class: "tag" },
            ...{ class: (__VLS_unwrap(statusDef, {})(st.id).kind) },
            title: (statusTitle(st.id)),
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (__VLS_unwrap(statusDef, {})(st.id).name);
        (st.turns < 99 ? ` ${st.turns}` : '');
        // @ts-ignore
        [isActive, threatMultOf, shares, shares, statusDef, statusDef,];
    }
    if (c.concentration) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (__VLS_unwrap(abilityDef, {})(c.concentration).name);
    }
    // @ts-ignore
    [abilityDef,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
const __VLS_13 = __VLS_tryAsConstant((__VLS_unwrap(foes, {})));
for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (targets.value.some((t) => t.id === c.id) && chooseTarget(c.id));
                // @ts-ignore
                [foes, targets,];
            } },
        key: (c.id),
        ...{ class: "fighter" },
        ...{ class: ({ current: actor.value?.id === c.id, down: !__VLS_unwrap(isActive, {})(c), targetable: targets.value.some((t) => t.id === c.id) }) },
    });
    /** @type {__VLS_StyleScopedClasses['fighter']} */ ;
    /** @type {__VLS_StyleScopedClasses['current']} */ ;
    /** @type {__VLS_StyleScopedClasses['down']} */ ;
    /** @type {__VLS_StyleScopedClasses['targetable']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (c.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (c.level);
    (c.fled ? '・已逃走' : c.hp === 0 ? '・倒下' : '');
    const __VLS_14 = StatBar;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
        // @ts-ignore
        kind: "hp", value: (c.hp), max: (c.maxHp),
    }));
    const __VLS_16 = __VLS_15({
        kind: "hp",
        value: (c.hp),
        max: (c.maxHp),
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (__VLS_unwrap(damageTypeName, {})(c.weapon.type));
    const __VLS_19 = __VLS_tryAsConstant((affinityTags(c)));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_19))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (t.text),
            ...{ class: "tag" },
            ...{ class: (t.kind) },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (t.text);
        // @ts-ignore
        [actor, isActive, targets, damageTypeName,];
    }
    if (c.traits?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_20 = __VLS_tryAsConstant((c.traits));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_20))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (t),
                ...{ class: "tag trait" },
                title: (__VLS_unwrap(safeText, {})(monsterTraits.value.traits[t]?.desc ?? '')),
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            /** @type {__VLS_StyleScopedClasses['trait']} */ ;
            (__VLS_unwrap(safeText, {})(monsterTraits.value.traits[t]?.name ?? t));
            // @ts-ignore
            [safeText, safeText, monsterTraits, monsterTraits,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_21 = __VLS_tryAsConstant((c.statuses));
    for (const [st] of __VLS_vFor(__VLS_nonNull(__VLS_21))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (st.id),
            ...{ class: "tag" },
            ...{ class: (__VLS_unwrap(statusDef, {})(st.id).kind) },
            title: (statusTitle(st.id)),
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (__VLS_unwrap(statusDef, {})(st.id).name);
        (st.turns < 99 ? ` ${st.turns}` : '');
        // @ts-ignore
        [statusDef, statusDef,];
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
if (combat.value.status === 'ongoing' && actor.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (actor.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (actor.value.ap);
    if (pending.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        const __VLS_22 = __VLS_tryAsConstant((targets.value));
        for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_22))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(combat.value.status === 'ongoing' && actor.value))
                            throw 0;
                        if (!(pending.value))
                            throw 0;
                        return (chooseTarget(t.id));
                        // @ts-ignore
                        [combat, actor, actor, actor, targets, pending,];
                    } },
                key: (t.id),
            });
            (t.name);
            (t.hp);
            (t.maxHp);
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(combat.value.status === 'ongoing' && actor.value))
                        throw 0;
                    if (!(pending.value))
                        throw 0;
                    return (pending.value = null);
                    // @ts-ignore
                    [pending,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row basics" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['basics']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(combat.value.status === 'ongoing' && actor.value))
                        throw 0;
                    if (!!(pending.value))
                        throw 0;
                    return (pending.value = { kind: 'attack' });
                    // @ts-ignore
                    [pending,];
                } },
            ...{ class: "primary" },
            disabled: (actor.value.ap < costs.value.weapon_attack),
        });
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        (actor.value.weapon.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (costs.value.weapon_attack);
        (__VLS_unwrap(damageTypeName, {})(actor.value.weapon.type));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(combat.value.status === 'ongoing' && actor.value))
                        throw 0;
                    if (!!(pending.value))
                        throw 0;
                    return (send({ type: 'defend' }));
                    // @ts-ignore
                    [actor, actor, actor, damageTypeName, costs, costs,];
                } },
            disabled: (actor.value.ap < costs.value.defend),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (costs.value.defend);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(combat.value.status === 'ongoing' && actor.value))
                        throw 0;
                    if (!!(pending.value))
                        throw 0;
                    return (send({ type: 'flee' }));
                    // @ts-ignore
                    [actor, costs, costs,];
                } },
            ...{ class: "danger" },
            disabled: (actor.value.ap < costs.value.flee),
        });
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (costs.value.flee);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(combat.value.status === 'ongoing' && actor.value))
                        throw 0;
                    if (!!(pending.value))
                        throw 0;
                    return (send({ type: 'end_turn' }));
                    // @ts-ignore
                    [actor, costs, costs,];
                } },
        });
        const __VLS_23 = __VLS_tryAsConstant((__VLS_unwrap(groups, {})));
        for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_23))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (g.name),
                ...{ class: "group" },
            });
            /** @type {__VLS_StyleScopedClasses['group']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (g.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            const __VLS_24 = __VLS_tryAsConstant((g.items));
            for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_24))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(combat.value.status === 'ongoing' && actor.value))
                                throw 0;
                            if (!!(pending.value))
                                throw 0;
                            return (choose(a));
                            // @ts-ignore
                            [groups,];
                        } },
                    key: (a.id),
                    disabled: (reason(a) !== null),
                    title: (`${a.desc}${reason(a) ? `\n（${reason(a)}）` : ''}`),
                    ...{ class: "ability" },
                });
                /** @type {__VLS_StyleScopedClasses['ability']} */ ;
                (a.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "small muted" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (costText(a));
                if (reason(a)) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "small why" },
                    });
                    /** @type {__VLS_StyleScopedClasses['small']} */ ;
                    /** @type {__VLS_StyleScopedClasses['why']} */ ;
                    (reason(a));
                }
                // @ts-ignore
                [];
            }
            // @ts-ignore
            [];
        }
        if (items.value.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "group" },
            });
            /** @type {__VLS_StyleScopedClasses['group']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (costs.value.item);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            const __VLS_25 = __VLS_tryAsConstant((items.value));
            for (const [i] of __VLS_vFor(__VLS_nonNull(__VLS_25))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(combat.value.status === 'ongoing' && actor.value))
                                throw 0;
                            if (!!(pending.value))
                                throw 0;
                            if (!(items.value.length))
                                throw 0;
                            return (pending.value = { kind: 'item', item: i.name });
                            // @ts-ignore
                            [pending, costs, items, items,];
                        } },
                    key: (i.name),
                    ...{ class: "ability" },
                    disabled: (actor.value.ap < costs.value.item),
                    title: (i.def.desc ?? ''),
                });
                /** @type {__VLS_StyleScopedClasses['ability']} */ ;
                (i.name);
                (i.qty);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "small muted" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (itemEffect(i.name));
                // @ts-ignore
                [actor, costs,];
            }
        }
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (resultText.value[combat.value.status]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (finish) },
        ...{ class: "primary" },
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "log",
    ...{ class: "log small" },
});
/** @type {__VLS_StyleScopedClasses['log']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_26 = __VLS_tryAsConstant((combat.value.timeline));
for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_26))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (t.seq),
    });
    (__VLS_unwrap(describeEntry, {})(t, __VLS_unwrap(names, {})));
    // @ts-ignore
    [combat, combat, resultText, describeEntry, names,];
}
if (combat.value.timeline.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
// @ts-ignore
[combat,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
