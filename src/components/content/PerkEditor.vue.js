import { computed, ref, watch } from 'vue';
import { actionRules, ATTR_IDS, attributeRules, attrName, choosablePerks, className, combatClasses, damageTypes, landmarks, npcTags, perkRules, shopRules, } from '@/engine/data';
import { builtinPerk, perkEditorLimits, TRAIN_CELLS } from '@/engine/mods';
import { cellName } from '@/engine/grid';
import { describeEffects, perkPower } from '@/engine/perks';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
// 受訓的地點：設施，加上自建的商店與已經設定的地標
const trainCells = computed(() => {
    void content.version;
    // 地標很多：只列出這個特質已經設定的（在地標頁勾選）
    const lms = (draft.value.train?.cells ?? []).filter((c) => landmarks[c]);
    return [...TRAIN_CELLS, ...Object.values(shopRules.types).filter((d) => d.custom).map((d) => d.cell), ...lms];
});
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
function current() {
    return clone(content.mods.perks[props.id] ?? perkRules.perks.find((p) => p.id === props.id));
}
const draft = ref(current());
const saved = ref(JSON.stringify(draft.value));
watch(() => props.id, () => {
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
});
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
const builtin = computed(() => !!builtinPerk(props.id));
const edited = computed(() => builtin.value && !!content.mods.perks[props.id]);
const race = computed(() => !!draft.value.race);
const limits = computed(() => perkEditorLimits(!!draft.value.flaw));
const usage = computed(() => {
    void content.version;
    void game.state?.time.minute;
    return content.usageOf('perk', props.id);
});
// ---- 選項 ----
const contexts = Object.entries(perkRules.contexts);
const kinds = Object.entries(actionRules.kinds).map(([k, v]) => [k, v.name]);
const tags = Object.entries(npcTags.tags).map(([k, v]) => [k, v.name]);
const dmgTypes = damageTypes.types.map((t) => [t.id, t.name]);
const COMBAT = { hit: '命中', evade: '迴避', save: '豁免', damage: '傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊', threat: '仇恨倍率' };
const others = computed(() => {
    void content.version;
    return choosablePerks().filter((p) => p.id !== props.id);
});
const races = Object.entries(attributeRules.races);
const classList = Object.keys(combatClasses);
const kindOf = (e) => ('check' in e ? 'check' : 'combat' in e ? 'combat' : 'resist' in e ? 'resist' : 'offense');
function addEffect(kind) {
    const list = draft.value.effects;
    if (list.length >= limits.value.effects)
        return;
    if (kind === 'check')
        list.push({ check: {}, bonus: draft.value.flaw ? -1 : 1 });
    else if (kind === 'combat')
        list.push({ combat: { hit: 1 } });
    else if (kind === 'resist')
        list.push({ resist: { [dmgTypes[0][0]]: -0.25 } });
    else
        list.push({ offense: { [dmgTypes[0][0]]: 0.25 } });
}
/** 檢定加值的篩選：勾選或取消一個值 */
function toggleFilter(f, key, v, on) {
    const set = new Set(f[key]);
    if (on)
        set.add(v);
    else
        set.delete(v);
    if (set.size)
        f[key] = [...set];
    else
        delete f[key];
}
function setCombat(m, k, v) {
    if (v === '' || !Number(v))
        delete m[k];
    else
        m[k] = Number(v);
}
/** 抗性、增傷：一列一種傷害類型 */
function affinityRows(map) {
    return Object.entries(map).map(([k, v]) => [k, v ?? 0]);
}
function setAffinity(map, oldKey, key, value) {
    if (oldKey !== key)
        delete map[oldKey];
    map[key] = value;
}
function toggleList(list, v, on) {
    const set = new Set(list);
    if (on)
        set.add(v);
    else
        set.delete(v);
    return set.size ? [...set] : undefined;
}
function setRequires(key, v, on) {
    const r = { ...(draft.value.requires ?? {}) };
    const next = toggleList(r[key], v, on);
    if (next)
        r[key] = next;
    else
        delete r[key];
    if (r.races || r.classes)
        draft.value.requires = r;
    else
        delete draft.value.requires;
}
function setExclusive(v, on) {
    const next = toggleList(draft.value.exclusive, v, on);
    if (next)
        draft.value.exclusive = next;
    else
        delete draft.value.exclusive;
}
function setTrain(on) {
    if (on)
        draft.value.train = { cells: ['guild'], price_cc: 300, hours: 8, attr: 'str', dc: 12 };
    else
        delete draft.value.train;
}
function setNpcWeight(v) {
    const w = Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
    if (w)
        draft.value.npc = { ...(draft.value.npc ?? {}), weight: w };
    else
        delete draft.value.npc;
}
const auto = computed(() => describeEffects(draft.value.effects));
function save() {
    try {
        content.savePerk(props.id, draft.value);
        draft.value = current();
        saved.value = JSON.stringify(draft.value);
        game.flash(`已儲存「${draft.value.name}」`);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function discard() {
    draft.value = current();
}
function restore() {
    if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`))
        return;
    content.restorePerk(props.id);
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
}
function remove() {
    if (!confirm(`刪除「${draft.value.name}」？`))
        return;
    try {
        content.deletePerk(props.id);
        emit('deleted');
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
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
__VLS_withDotValue(draft, {});
// @ts-ignore
__VLS_withDotValue(builtin, {});
// @ts-ignore
__VLS_withDotValue(edited, {});
// @ts-ignore
__VLS_withDotValue(race, {});
// @ts-ignore
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
// @ts-ignore
__VLS_withDotValue(attributeRules, {});
// @ts-ignore
__VLS_withDotValue(perkRules, {});
// @ts-ignore
__VLS_withDotValue(limits, {});
// @ts-ignore
__VLS_withDotValue(dmgTypes, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "editor" },
});
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
(draft.value.name || '（未命名）');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag" },
});
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
(builtin.value ? (edited.value ? '內建・已修改' : '內建') : '自建');
if (race.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
}
if (dirty.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag warn" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['warn']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (save) },
    ...{ class: "small primary" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (discard) },
    ...{ class: "small" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (builtin.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (restore) },
        ...{ class: "small" },
        disabled: (!edited.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (remove) },
        ...{ class: "small danger" },
        disabled: (usage.value.length > 0),
        title: (usage.value.length ? '還有地方用到這個特質，不能刪除' : ''),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['danger']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_ctx.id);
(__VLS_unwrap(perkPower, {})(draft.value));
if (race.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (attributeRules.value.races[draft.value.race]?.name);
}
const __VLS_0 = UsageNote;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    // @ts-ignore
    usage: (usage.value), deletable: (!builtin.value),
}));
const __VLS_2 = __VLS_1({
    usage: (usage.value),
    deletable: (!builtin.value),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: (perkRules.value.custom.name_chars),
});
(draft.value.name);
if (!race.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (draft.value.flaw);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
(__VLS_unwrap(auto, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.desc),
    rows: "2",
    maxlength: (perkRules.value.custom.desc_chars),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
(limits.value.effects);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(limits.value.check_bonus[0]);
(limits.value.check_bonus[1]);
(limits.value.combat[0]);
(limits.value.combat[1]);
(limits.value.threat[0]);
(limits.value.threat[1]);
(limits.value.resist[0]);
(limits.value.resist[1]);
(limits.value.offense[0]);
(limits.value.offense[1]);
(draft.value.flaw ? '缺陷可以有負的檢定加值與戰鬥修正。' : '負的檢定加值與戰鬥修正要勾「缺陷」。');
const __VLS_5 = __VLS_tryAsConstant((draft.value.effects));
for (const [e, i] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "effect" },
    });
    /** @type {__VLS_StyleScopedClasses['effect']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    ({ check: '檢定加值', combat: '戰鬥修正', resist: '抗性（受到的傷害倍率）', offense: '增傷（造成的傷害倍率）' }[__VLS_unwrap(kindOf, {})(e)]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "spacer" },
    });
    /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.effects.splice(i, 1));
                // @ts-ignore
                [draft, draft, draft, draft, draft, draft, draft, draft, draft, builtin, builtin, builtin, edited, edited, race, race, race, dirty, dirty, dirty, usage, usage, usage, id, perkPower, attributeRules, perkRules, perkRules, auto, limits, limits, limits, limits, limits, limits, limits, limits, limits, limits, limits, kindOf,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if ('check' in e) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: (limits.value.check_bonus[0]),
            max: (limits.value.check_bonus[1]),
            ...{ class: "num" },
        });
        (e.bonus);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (e.check.attrs?.length ?? 0);
        const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
        for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (a),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!('check' in e))
                            throw 0;
                        return (toggleFilter(e.check, 'attrs', a, $event.target.checked));
                        // @ts-ignore
                        [limits, limits, ATTR_IDS,];
                    } },
                type: "checkbox",
                checked: (e.check.attrs?.includes(a)),
            });
            (__VLS_unwrap(attrName, {})(a));
            // @ts-ignore
            [attrName,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (e.check.contexts?.length ?? 0);
        const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(contexts, {})));
        for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (k),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!('check' in e))
                            throw 0;
                        return (toggleFilter(e.check, 'contexts', k, $event.target.checked));
                        // @ts-ignore
                        [contexts,];
                    } },
                type: "checkbox",
                checked: (e.check.contexts?.includes(k)),
            });
            (n);
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (e.check.kinds?.length ?? 0);
        const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(kinds, {})));
        for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (k),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!('check' in e))
                            throw 0;
                        return (toggleFilter(e.check, 'kinds', k, $event.target.checked));
                        // @ts-ignore
                        [kinds,];
                    } },
                type: "checkbox",
                checked: (e.check.kinds?.includes(k)),
            });
            (n);
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (e.check.vs_tags?.length ?? 0);
        const __VLS_9 = __VLS_tryAsConstant((__VLS_unwrap(tags, {})));
        for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (k),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!('check' in e))
                            throw 0;
                        return (toggleFilter(e.check, 'vs_tags', k, $event.target.checked));
                        // @ts-ignore
                        [tags,];
                    } },
                type: "checkbox",
                checked: (e.check.vs_tags?.includes(k)),
            });
            (n);
            // @ts-ignore
            [];
        }
    }
    else if ('combat' in e) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        const __VLS_10 = __VLS_tryAsConstant((__VLS_unwrap(COMBAT, {})));
        for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (k),
            });
            (n);
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onInput: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!('check' in e))
                            throw 0;
                        if (!('combat' in e))
                            throw 0;
                        return (setCombat(e.combat, k, $event.target.value));
                        // @ts-ignore
                        [COMBAT,];
                    } },
                type: "number",
                step: (k === 'threat' ? 0.05 : 1),
                min: (k === 'threat' ? limits.value.threat[0] : Math.min(0, limits.value.combat[0])),
                max: (k === 'threat' ? limits.value.threat[1] : limits.value.combat[1]),
                value: (e.combat[k] ?? ''),
                placeholder: "—",
            });
            // @ts-ignore
            [limits, limits, limits, limits,];
        }
    }
    else {
        const __VLS_11 = __VLS_tryAsConstant((affinityRows('resist' in e ? e.resist : e.offense)));
        for (const [[k, v]] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (k),
                ...{ class: "row small" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!('check' in e))
                            throw 0;
                        if (!!('combat' in e))
                            throw 0;
                        return (setAffinity('resist' in e ? e.resist : e.offense, k, $event.target.value, v));
                        // @ts-ignore
                        [];
                    } },
                value: (k),
            });
            const __VLS_12 = __VLS_tryAsConstant((dmgTypes.value));
            for (const [[id, n]] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (id),
                    value: (id),
                });
                (n);
                // @ts-ignore
                [dmgTypes,];
            }
            (v >= 0 ? '+' : '');
            (v);
            (1 + v);
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onInput: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!('check' in e))
                            throw 0;
                        if (!!('combat' in e))
                            throw 0;
                        return (setAffinity('resist' in e ? e.resist : e.offense, k, k, Number($event.target.value)));
                        // @ts-ignore
                        [];
                    } },
                type: "number",
                step: "0.25",
                value: (v),
                ...{ class: "num" },
            });
            /** @type {__VLS_StyleScopedClasses['num']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!('check' in e))
                            throw 0;
                        if (!!('combat' in e))
                            throw 0;
                        return (delete ('resist' in e ? e.resist : e.offense)[k]);
                        // @ts-ignore
                        [];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!('check' in e))
                        throw 0;
                    if (!!('combat' in e))
                        throw 0;
                    return (setAffinity('resist' in e ? e.resist : e.offense, '', dmgTypes.value.find(([id]) => !(id in ('resist' in e ? e.resist : e.offense)))?.[0] ?? dmgTypes.value[0][0], 'resist' in e ? -0.25 : 0.25));
                    // @ts-ignore
                    [dmgTypes, dmgTypes,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (addEffect('check'));
            // @ts-ignore
            [];
        } },
    ...{ class: "small" },
    disabled: (draft.value.effects.length >= limits.value.effects),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (addEffect('combat'));
            // @ts-ignore
            [draft, limits,];
        } },
    ...{ class: "small" },
    disabled: (draft.value.effects.length >= limits.value.effects),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (addEffect('resist'));
            // @ts-ignore
            [draft, limits,];
        } },
    ...{ class: "small" },
    disabled: (draft.value.effects.length >= limits.value.effects),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (addEffect('offense'));
            // @ts-ignore
            [draft, limits,];
        } },
    ...{ class: "small" },
    disabled: (draft.value.effects.length >= limits.value.effects),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (!race.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    const __VLS_13 = __VLS_tryAsConstant((__VLS_unwrap(races, {})));
    for (const [[id, r]] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (id),
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(!race.value))
                        throw 0;
                    return (setRequires('races', id, $event.target.checked));
                    // @ts-ignore
                    [draft, race, limits, races,];
                } },
            type: "checkbox",
            checked: (draft.value.requires?.races?.includes(id)),
        });
        (r.name);
        // @ts-ignore
        [draft,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    const __VLS_14 = __VLS_tryAsConstant((__VLS_unwrap(classList, {})));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (c),
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(!race.value))
                        throw 0;
                    return (setRequires('classes', c, $event.target.checked));
                    // @ts-ignore
                    [classList,];
                } },
            type: "checkbox",
            checked: (draft.value.requires?.classes?.includes(c)),
        });
        (__VLS_unwrap(className, {})(c));
        // @ts-ignore
        [draft, className,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    (draft.value.exclusive?.length ?? 0);
    const __VLS_15 = __VLS_tryAsConstant((__VLS_unwrap(others, {})));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (p.id),
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(!race.value))
                        throw 0;
                    return (setExclusive(p.id, $event.target.checked));
                    // @ts-ignore
                    [draft, others,];
                } },
            type: "checkbox",
            checked: (draft.value.exclusive?.includes(p.id)),
        });
        (p.name);
        // @ts-ignore
        [draft,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check small" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!race.value))
                    throw 0;
                return (setTrain($event.target.checked));
                // @ts-ignore
                [];
            } },
        type: "checkbox",
        checked: (!!draft.value.train),
    });
    if (draft.value.train) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row checks small" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['checks']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        const __VLS_16 = __VLS_tryAsConstant((__VLS_unwrap(trainCells, {})));
        for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_16))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (c),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(!race.value))
                            throw 0;
                        if (!(draft.value.train))
                            throw 0;
                        return (draft.value.train.cells = toggleList(draft.value.train.cells, c, $event.target.checked) ?? []);
                        // @ts-ignore
                        [draft, draft, draft, draft, trainCells,];
                    } },
                type: "checkbox",
                checked: (draft.value.train.cells.includes(c)),
            });
            (__VLS_unwrap(cellName, {})(c));
            // @ts-ignore
            [draft, cellName,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "0",
        });
        (draft.value.train.price_cc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "72",
        });
        (draft.value.train.hours);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (draft.value.train.attr),
        });
        const __VLS_17 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
        for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (a),
                value: (a),
            });
            (__VLS_unwrap(attrName, {})(a));
            // @ts-ignore
            [draft, draft, draft, ATTR_IDS, attrName,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "5",
            max: "30",
        });
        (draft.value.train.dc);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!race.value))
                    throw 0;
                return (setNpcWeight($event.target.value));
                // @ts-ignore
                [draft,];
            } },
        type: "number",
        min: "0",
        max: "10",
        value: (draft.value.npc?.weight ?? 0),
    });
    if (draft.value.npc) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (draft.value.npc.tags?.length ?? 0);
        const __VLS_18 = __VLS_tryAsConstant((__VLS_unwrap(tags, {})));
        for (const [[k, n]] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (k),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(!race.value))
                            throw 0;
                        if (!(draft.value.npc))
                            throw 0;
                        return (draft.value.npc.tags = toggleList(draft.value.npc.tags, k, $event.target.checked));
                        // @ts-ignore
                        [draft, draft, draft, draft, draft, tags,];
                    } },
                type: "checkbox",
                checked: (draft.value.npc.tags?.includes(k)),
            });
            (n);
            // @ts-ignore
            [draft,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
        (draft.value.npc.classes?.length ?? 0);
        const __VLS_19 = __VLS_tryAsConstant((__VLS_unwrap(classList, {})));
        for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_19))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (c),
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(!race.value))
                            throw 0;
                        if (!(draft.value.npc))
                            throw 0;
                        return (draft.value.npc.classes = toggleList(draft.value.npc.classes, c, $event.target.checked));
                        // @ts-ignore
                        [draft, draft, draft, classList,];
                    } },
                type: "checkbox",
                checked: (draft.value.npc.classes?.includes(c)),
            });
            (__VLS_unwrap(className, {})(c));
            // @ts-ignore
            [draft, className,];
        }
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
