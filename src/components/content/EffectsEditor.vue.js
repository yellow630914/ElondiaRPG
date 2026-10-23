import { computed } from 'vue';
import { abilities, ATTR_IDS, attrName, conditionName, contractDef, geography, itemRules, npcs as namedNpcs, choosablePerks, perkDef, slaveryRules, stories, tagDef } from '@/engine/data';
import { gearRules } from '@/engine/gear';
import { EFFECT_CONDITIONS, STORY_EFFECTS } from '@/engine/storyMods';
import { oathError, oathText, TATTOO_PLACES, placeName, tattooKindName, tattooRules } from '@/engine/tattoos';
import { useContent } from '@/stores/content';
const { defineProps, defineModel, } = {};
// 效果的清單（任務點的結果、完成的報酬）：金錢、物品、裝備、經驗、聲望、親密度、記憶、能力、入隊、生命值
const model = defineModel();
const props = defineProps();
const effectOptions = computed(() => Object.entries(STORY_EFFECTS).filter(([t]) => !props.types || props.types.includes(t)));
const conditionList = EFFECT_CONDITIONS().map((k) => [k, conditionName(k)]);
const content = useContent();
const list = computed(() => model.value ?? []);
const items = computed(() => {
    void content.version;
    return itemRules.items.map((i) => i.name);
});
const storyList = computed(() => {
    void content.version;
    return [...stories].sort((a, b) => Number(b.start.kind === 'manual') - Number(a.start.kind === 'manual'));
});
const factions = [...new Set(geography.locations.map((l) => l.faction).filter(Boolean))];
const rows = computed(() => list.value);
const DEFAULTS = {
    money: () => ({ type: 'money', amount: 100 }),
    item: () => ({ type: 'item', name: '治療藥劑', qty: 1 }),
    gear: () => ({ type: 'gear', spec: { base: 'longsword', material: 'steel' } }),
    xp: () => ({ type: 'xp', amount: 50 }),
    reputation: () => ({ type: 'reputation', faction: factions[0] ?? 'local', delta: 1 }),
    affinity: () => ({ type: 'affinity', npc: namedNpcs[0]?.id ?? '', delta: 5 }),
    memory: () => ({ type: 'memory', summary: '', importance: 2 }),
    ability: () => ({ type: 'ability', target: 'pc', choices: 3 }),
    companion: () => ({ type: 'companion', npc: namedNpcs[0]?.id ?? '', mode: 'voluntary' }),
    hp: () => ({ type: 'hp', target: 'pc', ratio: -0.2 }),
    condition: () => ({ type: 'condition', target: 'pc', condition: 'blessed', add: true }),
    start_story: () => ({ type: 'start_story', story: stories.find((s) => s.start.kind === 'manual')?.id ?? stories[0]?.id ?? '' }),
    enslave_player: () => ({ type: 'enslave_player', random: {}, contract: slaveryRules.roles.default }),
    perk: () => ({ type: 'perk', perk: choosablePerks()[0].id }),
    lose_perk: () => ({ type: 'lose_perk', perk: choosablePerks()[0].id }),
    tattoo: () => ({ type: 'tattoo', template: Object.keys(tattooRules.templates)[0] }),
    remove_tattoo: () => ({ type: 'remove_tattoo', kind: 'plain' }),
};
// 刺青：圖樣，或自己描述（誓約要填屬性的加減）
const tattooTemplates = computed(() => {
    void content.version;
    return Object.entries(tattooRules.templates);
});
function tattooMode(r) {
    return typeof r.template === 'string' ? r.template : `custom:${r.kind === 'oath' ? 'oath' : 'plain'}`;
}
function setTattooMode(r, mode) {
    for (const k of ['template', 'kind', 'name', 'text', 'attrs'])
        delete r[k];
    if (mode.startsWith('custom:'))
        Object.assign(r, { kind: mode.slice(7), name: '', text: '', ...(mode === 'custom:oath' ? { attrs: {} } : {}) });
    else
        r.template = mode;
}
function oathAttrs(r) {
    return (r.attrs ??= {});
}
function setOathAttr(r, a, v) {
    const attrs = { ...oathAttrs(r) };
    if (v)
        attrs[a] = v;
    else
        delete attrs[a];
    r.attrs = attrs;
}
function removeTattooMode(r) {
    return typeof r.place === 'string' ? r.place : `kind:${r.kind ?? 'plain'}`;
}
function setRemoveTattooMode(r, mode) {
    delete r.place;
    delete r.kind;
    if (mode.startsWith('kind:'))
        r.kind = mode.slice(5);
    else
        r.place = mode;
}
// 特質的機會：第一個特質加上其他選項
function perkOptions(r) {
    return r.options ?? [];
}
function setPerkOption(r, i, id) {
    const list = [...perkOptions(r)];
    if (id)
        list[i] = id;
    else
        list.splice(i, 1);
    if (list.length)
        r.options = list;
    else
        delete r.options;
}
// 主角淪為奴隸：固定 NPC 當主人，或隨機生成（可以指定身分）
const contracts = computed(() => {
    void content.version;
    return Object.keys(slaveryRules.contracts);
});
const masterTags = Object.keys(slaveryRules.master_tags.tags);
function masterMode(r) {
    return typeof r.master === 'string' ? 'fixed' : 'random';
}
function setMasterMode(r, mode) {
    if (mode === 'fixed') {
        delete r.random;
        r.master = namedNpcs[0]?.id ?? '';
    }
    else {
        delete r.master;
        r.random = {};
    }
}
function randomTag(r) {
    return r.random?.tag ?? '';
}
function setRandomTag(r, tag) {
    r.random = tag ? { tag } : {};
}
function add(type) {
    model.value = [...list.value, DEFAULTS[type]()];
}
function remove(i) {
    const next = list.value.filter((_, j) => j !== i);
    model.value = next.length ? next : undefined;
}
function spec(r) {
    return r.spec;
}
function materialsFor(base) {
    const kind = gearRules.bases[base]?.kind;
    return Object.entries(gearRules.materials).filter(([, m]) => m.kind === kind);
}
function setBase(r, base) {
    r.spec = { base, material: materialsFor(base)[0]?.[0] ?? '' };
}
let __VLS_modelEmit;
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
__VLS_withDotValue(STORY_EFFECTS, {});
// @ts-ignore
__VLS_withDotValue(gearRules, {});
// @ts-ignore
__VLS_withDotValue(tattooTemplates, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "effects" },
});
/** @type {__VLS_StyleScopedClasses['effects']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
    id: "effect-items",
});
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(items, {})));
for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
        key: (n),
        value: (n),
    });
    // @ts-ignore
    [items,];
}
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(rows, {})));
for (const [r, i] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (STORY_EFFECTS.value[r.type] ?? r.type);
    if (r.type === 'money') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            ...{ class: "num" },
        });
        (r.amount);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    else if (r.type === 'item') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            list: "effect-items",
            ...{ class: "grow" },
            placeholder: "物品名稱",
        });
        (r.name);
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            ...{ class: "num" },
            title: "負數為交出",
        });
        (r.qty);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    else if (r.type === 'gear') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(r.type === 'money'))
                        throw 0;
                    if (!!(r.type === 'item'))
                        throw 0;
                    if (!(r.type === 'gear'))
                        throw 0;
                    return (setBase(r, $event.target.value));
                    // @ts-ignore
                    [rows, STORY_EFFECTS,];
                } },
            value: (spec(r).base),
        });
        const __VLS_2 = __VLS_tryAsConstant((gearRules.value.bases));
        for (const [b, id] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (id),
                value: (id),
            });
            (b.name);
            // @ts-ignore
            [gearRules,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (spec(r).material),
        });
        const __VLS_3 = __VLS_tryAsConstant((materialsFor(spec(r).base)));
        for (const [[id, m]] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (id),
                value: (id),
            });
            (m.name);
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "20",
            placeholder: "名稱（選填）",
        });
        (r.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "80",
            ...{ class: "grow" },
            placeholder: "描述（選填）",
        });
        (r.desc);
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    }
    else if (r.type === 'xp') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "0",
            ...{ class: "num" },
        });
        (r.amount);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    else if (r.type === 'reputation') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            list: "effect-factions",
            placeholder: "勢力",
        });
        (r.faction);
        __VLS_asFunctionalElement1(__VLS_intrinsics.datalist, __VLS_intrinsics.datalist)({
            id: "effect-factions",
        });
        const __VLS_4 = __VLS_tryAsConstant((__VLS_unwrap(factions, {})));
        for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option)({
                key: (f),
                value: (f),
            });
            // @ts-ignore
            [factions,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            ...{ class: "num" },
        });
        (r.delta);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    else if (r.type === 'affinity' || r.type === 'companion') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.npc),
        });
        const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(namedNpcs, {})));
        for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (n.id),
                value: (n.id),
            });
            (n.name);
            // @ts-ignore
            [namedNpcs,];
        }
        if (r.type === 'affinity') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                ...{ class: "num" },
            });
            (r.delta);
            /** @type {__VLS_StyleScopedClasses['num']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (r.mode),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "voluntary",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "hired",
            });
        }
    }
    else if (r.type === 'memory') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "grow" },
            maxlength: "200",
            placeholder: "記下的事（之後給 AI 參考）",
        });
        (r.summary);
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    }
    else if (r.type === 'ability') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.ability),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (undefined),
        });
        const __VLS_6 = __VLS_tryAsConstant((Object.values(__VLS_unwrap(abilities, {}))));
        for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (a.id),
                value: (a.id),
            });
            (a.name);
            // @ts-ignore
            [abilities,];
        }
    }
    else if (r.type === 'start_story') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.story),
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(storyList, {})));
        for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (s.id),
                value: (s.id),
            });
            (s.title);
            (s.start.kind === 'manual' ? '（只由其他事件開啟）' : '');
            // @ts-ignore
            [storyList,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (r.type === 'enslave_player') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(r.type === 'money'))
                        throw 0;
                    if (!!(r.type === 'item'))
                        throw 0;
                    if (!!(r.type === 'gear'))
                        throw 0;
                    if (!!(r.type === 'xp'))
                        throw 0;
                    if (!!(r.type === 'reputation'))
                        throw 0;
                    if (!!(r.type === 'affinity' || r.type === 'companion'))
                        throw 0;
                    if (!!(r.type === 'memory'))
                        throw 0;
                    if (!!(r.type === 'ability'))
                        throw 0;
                    if (!!(r.type === 'start_story'))
                        throw 0;
                    if (!(r.type === 'enslave_player'))
                        throw 0;
                    return (setMasterMode(r, $event.target.value));
                    // @ts-ignore
                    [];
                } },
            value: (masterMode(r)),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "fixed",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "random",
        });
        if (masterMode(r) === 'fixed') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (r.master),
            });
            const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(namedNpcs, {})));
            for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (n.id),
                    value: (n.id),
                });
                (n.name);
                // @ts-ignore
                [namedNpcs,];
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(r.type === 'money'))
                            throw 0;
                        if (!!(r.type === 'item'))
                            throw 0;
                        if (!!(r.type === 'gear'))
                            throw 0;
                        if (!!(r.type === 'xp'))
                            throw 0;
                        if (!!(r.type === 'reputation'))
                            throw 0;
                        if (!!(r.type === 'affinity' || r.type === 'companion'))
                            throw 0;
                        if (!!(r.type === 'memory'))
                            throw 0;
                        if (!!(r.type === 'ability'))
                            throw 0;
                        if (!!(r.type === 'start_story'))
                            throw 0;
                        if (!(r.type === 'enslave_player'))
                            throw 0;
                        if (!!(masterMode(r) === 'fixed'))
                            throw 0;
                        return (setRandomTag(r, $event.target.value));
                        // @ts-ignore
                        [];
                    } },
                value: (randomTag(r)),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            const __VLS_9 = __VLS_tryAsConstant((__VLS_unwrap(masterTags, {})));
            for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (t),
                    value: (t),
                });
                (__VLS_unwrap(tagDef, {})(t)?.name ?? t);
                // @ts-ignore
                [masterTags, tagDef,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.contract),
        });
        const __VLS_10 = __VLS_tryAsConstant((__VLS_unwrap(contracts, {})));
        for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (c),
                value: (c),
            });
            (__VLS_unwrap(contractDef, {})(c).name);
            // @ts-ignore
            [contracts, contractDef,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (r.type === 'perk' || r.type === 'lose_perk') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.perk),
        });
        const __VLS_11 = __VLS_tryAsConstant((__VLS_unwrap(choosablePerks, {})()));
        for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (p.id),
                value: (p.id),
            });
            (p.name);
            (p.flaw ? '（缺陷）' : '');
            // @ts-ignore
            [choosablePerks,];
        }
        if (r.type === 'perk' && __VLS_unwrap(perkDef, {})(String(r.perk ?? ''))?.flaw) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        else if (r.type === 'lose_perk' && __VLS_unwrap(perkDef, {})(String(r.perk ?? ''))?.flaw) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        if (r.type === 'perk' && !__VLS_unwrap(perkDef, {})(String(r.perk ?? ''))?.flaw) {
            const __VLS_12 = __VLS_tryAsConstant((perkOptions(r)));
            for (const [id, i] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    ...{ onChange: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!!(r.type === 'money'))
                                throw 0;
                            if (!!(r.type === 'item'))
                                throw 0;
                            if (!!(r.type === 'gear'))
                                throw 0;
                            if (!!(r.type === 'xp'))
                                throw 0;
                            if (!!(r.type === 'reputation'))
                                throw 0;
                            if (!!(r.type === 'affinity' || r.type === 'companion'))
                                throw 0;
                            if (!!(r.type === 'memory'))
                                throw 0;
                            if (!!(r.type === 'ability'))
                                throw 0;
                            if (!!(r.type === 'start_story'))
                                throw 0;
                            if (!!(r.type === 'enslave_player'))
                                throw 0;
                            if (!(r.type === 'perk' || r.type === 'lose_perk'))
                                throw 0;
                            if (!(r.type === 'perk' && !__VLS_unwrap(perkDef, {})(String(r.perk ?? ''))?.flaw))
                                throw 0;
                            return (setPerkOption(r, i, $event.target.value));
                            // @ts-ignore
                            [perkDef, perkDef, perkDef,];
                        } },
                    key: (i),
                    value: (id),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "",
                });
                const __VLS_13 = __VLS_tryAsConstant((__VLS_unwrap(choosablePerks, {})().filter((x) => !x.flaw)));
                for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        key: (p.id),
                        value: (p.id),
                    });
                    (p.name);
                    // @ts-ignore
                    [choosablePerks,];
                }
                // @ts-ignore
                [];
            }
            if (!r.direct && perkOptions(r).length < 5) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                    ...{ onChange: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!!(r.type === 'money'))
                                throw 0;
                            if (!!(r.type === 'item'))
                                throw 0;
                            if (!!(r.type === 'gear'))
                                throw 0;
                            if (!!(r.type === 'xp'))
                                throw 0;
                            if (!!(r.type === 'reputation'))
                                throw 0;
                            if (!!(r.type === 'affinity' || r.type === 'companion'))
                                throw 0;
                            if (!!(r.type === 'memory'))
                                throw 0;
                            if (!!(r.type === 'ability'))
                                throw 0;
                            if (!!(r.type === 'start_story'))
                                throw 0;
                            if (!!(r.type === 'enslave_player'))
                                throw 0;
                            if (!(r.type === 'perk' || r.type === 'lose_perk'))
                                throw 0;
                            if (!(r.type === 'perk' && !__VLS_unwrap(perkDef, {})(String(r.perk ?? ''))?.flaw))
                                throw 0;
                            if (!(!r.direct && perkOptions(r).length < 5))
                                throw 0;
                            setPerkOption(r, perkOptions(r).length, $event.target.value);
                            $event.target.value = '';
                            // @ts-ignore
                            [];
                        } },
                    value: (''),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    value: "",
                });
                const __VLS_14 = __VLS_tryAsConstant((__VLS_unwrap(choosablePerks, {})().filter((x) => !x.flaw)));
                for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        key: (p.id),
                        value: (p.id),
                    });
                    (p.name);
                    // @ts-ignore
                    [choosablePerks,];
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "check small" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "checkbox",
            });
            (r.direct);
            if (!r.direct) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "small muted" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            }
        }
    }
    else if (r.type === 'tattoo') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(r.type === 'money'))
                        throw 0;
                    if (!!(r.type === 'item'))
                        throw 0;
                    if (!!(r.type === 'gear'))
                        throw 0;
                    if (!!(r.type === 'xp'))
                        throw 0;
                    if (!!(r.type === 'reputation'))
                        throw 0;
                    if (!!(r.type === 'affinity' || r.type === 'companion'))
                        throw 0;
                    if (!!(r.type === 'memory'))
                        throw 0;
                    if (!!(r.type === 'ability'))
                        throw 0;
                    if (!!(r.type === 'start_story'))
                        throw 0;
                    if (!!(r.type === 'enslave_player'))
                        throw 0;
                    if (!!(r.type === 'perk' || r.type === 'lose_perk'))
                        throw 0;
                    if (!(r.type === 'tattoo'))
                        throw 0;
                    return (setTattooMode(r, $event.target.value));
                    // @ts-ignore
                    [];
                } },
            value: (tattooMode(r)),
        });
        const __VLS_15 = __VLS_tryAsConstant(['plain', 'oath']);
        for (const [k] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
                key: (k),
                label: (__VLS_unwrap(tattooKindName, {})(k)),
            });
            const __VLS_16 = __VLS_tryAsConstant((tattooTemplates.value.filter(([, x]) => x.kind === k)));
            for (const [[id, t]] of __VLS_vFor(__VLS_nonNull(__VLS_16))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (id),
                    value: (id),
                });
                (t.name);
                (t.attrs ? `（${__VLS_unwrap(oathText, {})(t.attrs)}）` : '');
                // @ts-ignore
                [tattooKindName, tattooTemplates, oathText,];
            }
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "custom:plain",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "custom:oath",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(r.type === 'money'))
                        throw 0;
                    if (!!(r.type === 'item'))
                        throw 0;
                    if (!!(r.type === 'gear'))
                        throw 0;
                    if (!!(r.type === 'xp'))
                        throw 0;
                    if (!!(r.type === 'reputation'))
                        throw 0;
                    if (!!(r.type === 'affinity' || r.type === 'companion'))
                        throw 0;
                    if (!!(r.type === 'memory'))
                        throw 0;
                    if (!!(r.type === 'ability'))
                        throw 0;
                    if (!!(r.type === 'start_story'))
                        throw 0;
                    if (!!(r.type === 'enslave_player'))
                        throw 0;
                    if (!!(r.type === 'perk' || r.type === 'lose_perk'))
                        throw 0;
                    if (!(r.type === 'tattoo'))
                        throw 0;
                    return ($event.target.value ? (r.place = $event.target.value) : delete r.place);
                    // @ts-ignore
                    [];
                } },
            value: (r.place ?? ''),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        const __VLS_17 = __VLS_tryAsConstant((__VLS_unwrap(TATTOO_PLACES, {})));
        for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (p),
                value: (p),
            });
            (__VLS_unwrap(placeName, {})(p));
            // @ts-ignore
            [TATTOO_PLACES, placeName,];
        }
        if (typeof r.template !== 'string') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                maxlength: "20",
                placeholder: "名稱",
            });
            (r.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "grow" },
                maxlength: "160",
                placeholder: "外觀描述",
            });
            (r.text);
            /** @type {__VLS_StyleScopedClasses['grow']} */ ;
            if (r.kind === 'oath') {
                const __VLS_18 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
                for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        key: (a),
                        ...{ class: "small" },
                    });
                    /** @type {__VLS_StyleScopedClasses['small']} */ ;
                    (__VLS_unwrap(attrName, {})(a));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        ...{ onInput: // @ts-ignore
                            (...[$event]) => {
                                void $event;
                                if (!!(r.type === 'money'))
                                    throw 0;
                                if (!!(r.type === 'item'))
                                    throw 0;
                                if (!!(r.type === 'gear'))
                                    throw 0;
                                if (!!(r.type === 'xp'))
                                    throw 0;
                                if (!!(r.type === 'reputation'))
                                    throw 0;
                                if (!!(r.type === 'affinity' || r.type === 'companion'))
                                    throw 0;
                                if (!!(r.type === 'memory'))
                                    throw 0;
                                if (!!(r.type === 'ability'))
                                    throw 0;
                                if (!!(r.type === 'start_story'))
                                    throw 0;
                                if (!!(r.type === 'enslave_player'))
                                    throw 0;
                                if (!!(r.type === 'perk' || r.type === 'lose_perk'))
                                    throw 0;
                                if (!(r.type === 'tattoo'))
                                    throw 0;
                                if (!(typeof r.template !== 'string'))
                                    throw 0;
                                if (!(r.kind === 'oath'))
                                    throw 0;
                                return (setOathAttr(r, a, Number($event.target.value)));
                                // @ts-ignore
                                [ATTR_IDS, attrName,];
                            } },
                        type: "number",
                        ...{ class: "num" },
                        min: "-3",
                        max: "3",
                        value: (oathAttrs(r)[a] ?? 0),
                    });
                    /** @type {__VLS_StyleScopedClasses['num']} */ ;
                    // @ts-ignore
                    [];
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "small" },
                    ...{ class: (__VLS_unwrap(oathError, {})(oathAttrs(r)) ? 'warn' : 'muted') },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                (__VLS_unwrap(oathError, {})(oathAttrs(r)) ?? '加減平衡');
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "20",
            placeholder: "誰刺的（選填）",
        });
        (r.by);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (r.type === 'remove_tattoo') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(r.type === 'money'))
                        throw 0;
                    if (!!(r.type === 'item'))
                        throw 0;
                    if (!!(r.type === 'gear'))
                        throw 0;
                    if (!!(r.type === 'xp'))
                        throw 0;
                    if (!!(r.type === 'reputation'))
                        throw 0;
                    if (!!(r.type === 'affinity' || r.type === 'companion'))
                        throw 0;
                    if (!!(r.type === 'memory'))
                        throw 0;
                    if (!!(r.type === 'ability'))
                        throw 0;
                    if (!!(r.type === 'start_story'))
                        throw 0;
                    if (!!(r.type === 'enslave_player'))
                        throw 0;
                    if (!!(r.type === 'perk' || r.type === 'lose_perk'))
                        throw 0;
                    if (!!(r.type === 'tattoo'))
                        throw 0;
                    if (!(r.type === 'remove_tattoo'))
                        throw 0;
                    return (setRemoveTattooMode(r, $event.target.value));
                    // @ts-ignore
                    [oathError, oathError,];
                } },
            value: (removeTattooMode(r)),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "kind:plain",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "kind:oath",
        });
        const __VLS_19 = __VLS_tryAsConstant((__VLS_unwrap(TATTOO_PLACES, {})));
        for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_19))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (p),
                value: (p),
            });
            (__VLS_unwrap(placeName, {})(p));
            // @ts-ignore
            [TATTOO_PLACES, placeName,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (r.type === 'condition') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.add),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (true),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (false),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (r.condition),
        });
        const __VLS_20 = __VLS_tryAsConstant((__VLS_unwrap(conditionList, {})));
        for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_20))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (k),
                value: (k),
            });
            (n);
            // @ts-ignore
            [conditionList,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (r.type === 'hp') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onInput: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(r.type === 'money'))
                        throw 0;
                    if (!!(r.type === 'item'))
                        throw 0;
                    if (!!(r.type === 'gear'))
                        throw 0;
                    if (!!(r.type === 'xp'))
                        throw 0;
                    if (!!(r.type === 'reputation'))
                        throw 0;
                    if (!!(r.type === 'affinity' || r.type === 'companion'))
                        throw 0;
                    if (!!(r.type === 'memory'))
                        throw 0;
                    if (!!(r.type === 'ability'))
                        throw 0;
                    if (!!(r.type === 'start_story'))
                        throw 0;
                    if (!!(r.type === 'enslave_player'))
                        throw 0;
                    if (!!(r.type === 'perk' || r.type === 'lose_perk'))
                        throw 0;
                    if (!!(r.type === 'tattoo'))
                        throw 0;
                    if (!!(r.type === 'remove_tattoo'))
                        throw 0;
                    if (!!(r.type === 'condition'))
                        throw 0;
                    if (!(r.type === 'hp'))
                        throw 0;
                    return (r.ratio = Number($event.target.value) / 100);
                    // @ts-ignore
                    [];
                } },
            type: "number",
            ...{ class: "num" },
            value: (Math.round(Number(r.ratio ?? 0) * 100)),
        });
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (remove(i));
                // @ts-ignore
                [];
            } },
        ...{ class: "small x" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['x']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            add($event.target.value);
            $event.target.value = '';
            // @ts-ignore
            [];
        } },
    ...{ class: "small" },
    value: (''),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_21 = __VLS_tryAsConstant((__VLS_unwrap(effectOptions, {})));
for (const [[t, n]] of __VLS_vFor(__VLS_nonNull(__VLS_21))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (t),
        value: (t),
    });
    (n);
    // @ts-ignore
    [effectOptions,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
