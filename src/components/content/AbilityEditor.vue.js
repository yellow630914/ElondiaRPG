import { computed, ref, watch } from 'vue';
import { abilities, ATTR_IDS, attrName, className, damageTypeName, damageTypes, statuses } from '@/engine/data';
import { ABILITY_RESOLVES, ABILITY_TARGETS, ABILITY_TYPES, abilityClasses, builtinAbility, } from '@/engine/mods';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
function current() {
    const a = clone(content.mods.abilities[props.id] ?? abilities[props.id]);
    a.heal ??= {};
    a.shield ??= {};
    a.uses ??= {};
    return a;
}
// 空的 heal、shield、uses 不算修改
const snap = (a) => JSON.stringify(a, (k, v) => (['heal', 'shield', 'uses'].includes(k) && v && !Object.keys(v).length ? undefined : v));
const draft = ref(current());
const saved = ref(snap(draft.value));
watch(() => props.id, () => {
    draft.value = current();
    saved.value = snap(draft.value);
});
const dirty = computed(() => snap(draft.value) !== saved.value);
const builtin = computed(() => !!builtinAbility(props.id));
const edited = computed(() => builtin.value && !!content.mods.abilities[props.id]);
// ---- 選項 ----
const damageIds = damageTypes.types.map((t) => t.id);
// 自建的狀態儲存之後也要列進來
const statusList = computed(() => {
    void content.version;
    return Object.entries(statuses).map(([id, s]) => ({ id, ...s }));
});
const classList = abilityClasses();
const TO = { target: '目標', self: '自己', allies: '所有隊友', enemies: '所有敵人' };
const ON = { hit: '命中時', fail: '豁免失敗時', always: '一定' };
const usage = computed(() => {
    void content.version;
    return content.usageOf('ability', props.id);
});
function toggleClass(c, on) {
    const set = new Set(draft.value.classes);
    if (on)
        set.add(c);
    else
        set.delete(c);
    draft.value.classes = [...set];
}
function addDamage() {
    ;
    (draft.value.damage ??= []).push({ dice: '1d6', type: 'slashing' });
}
function setDamageSource(d, weapon) {
    if (weapon) {
        d.weapon = true;
        delete d.dice;
    }
    else {
        delete d.weapon;
        d.dice ??= '1d6';
    }
}
function addApply() {
    ;
    (draft.value.apply ??= []).push({ status: statusList.value[0].id, turns: 2 });
}
function setScale(d, dice) {
    if (dice)
        d.scale = { dice, per: d.scale?.per ?? 4 };
    else
        delete d.scale;
}
function save() {
    try {
        content.saveAbility(props.id, draft.value);
        draft.value = current();
        saved.value = snap(draft.value);
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
    content.restoreAbility(props.id);
    draft.value = current();
    saved.value = snap(draft.value);
}
function remove() {
    if (!confirm(`刪除「${draft.value.name}」？`))
        return;
    try {
        content.deleteAbility(props.id);
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
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
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
        title: (usage.value.length ? '還有地方用到這個能力，不能刪除' : ''),
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
    maxlength: "16",
});
(draft.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.type),
});
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(ABILITY_TYPES, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [draft, draft, draft, builtin, builtin, builtin, edited, edited, dirty, dirty, dirty, usage, usage, usage, id, ABILITY_TYPES,];
}
if (draft.value.type === 'skill') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "20",
    });
    (draft.value.unlock);
}
if (draft.value.type === 'spell') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "9",
    });
    (draft.value.circle);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "12",
    placeholder: (draft.value.type === 'spell' ? '依環數' : draft.value.type === 'cantrip' ? '0' : ''),
});
(draft.value.ap);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (draft.value.attr = ($event.target.value || undefined));
            // @ts-ignore
            [draft, draft, draft, draft, draft, draft, draft, draft,];
        } },
    value: (draft.value.attr ?? ''),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "casting",
});
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (a),
        value: (a),
    });
    (__VLS_unwrap(attrName, {})(a));
    // @ts-ignore
    [draft, ATTR_IDS, attrName,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "-50",
    max: "50",
});
(draft.value.threat);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(classList, {})));
for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (c),
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (toggleClass(c, $event.target.checked));
                // @ts-ignore
                [draft, classList,];
            } },
        type: "checkbox",
        checked: (draft.value.classes.includes(c)),
    });
    (c === 'monster' ? '怪物' : __VLS_unwrap(className, {})(c));
    // @ts-ignore
    [draft, className,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.target),
});
const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(ABILITY_TARGETS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [draft, ABILITY_TARGETS,];
}
if (draft.value.target === 'random_enemies') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "10",
    });
    (draft.value.count);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.resolve),
});
const __VLS_9 = __VLS_tryAsConstant((__VLS_unwrap(ABILITY_RESOLVES, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [draft, draft, draft, ABILITY_RESOLVES,];
}
if (draft.value.resolve === 'save') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.save),
    });
    const __VLS_10 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
    for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (a),
            value: (a),
        });
        (__VLS_unwrap(attrName, {})(a));
        // @ts-ignore
        [draft, draft, ATTR_IDS, attrName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.on_save),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "half",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "none",
    });
}
if (draft.value.resolve === 'attack') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "-10",
        max: "10",
    });
    (draft.value.hit);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "5",
    });
    (draft.value.crit);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "1",
    max: "6",
    placeholder: "1",
});
(draft.value.hits);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0.1",
    max: "5",
    step: "0.1",
    placeholder: "1",
});
(draft.value.mult);
if (draft.value.resolve === 'attack') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (draft.value.adv);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
const __VLS_11 = __VLS_tryAsConstant((draft.value.damage ?? []));
for (const [d, i] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (setDamageSource(d, $event.target.value === 'weapon'));
                // @ts-ignore
                [draft, draft, draft, draft, draft, draft, draft, draft, draft,];
            } },
        value: (d.weapon ? 'weapon' : 'dice'),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "weapon",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "dice",
    });
    if (!d.weapon) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "num" },
            placeholder: "1d6",
        });
        (d.dice);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (d.type = $event.target.value || undefined);
                // @ts-ignore
                [];
            } },
        value: (d.type ?? ''),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_12 = __VLS_tryAsConstant((__VLS_unwrap(damageIds, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (t),
            value: (t),
        });
        (__VLS_unwrap(damageTypeName, {})(t));
        // @ts-ignore
        [damageIds, damageTypeName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (d.mod);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (d.scale && (d.scale.per = Number($event.target.value) || 4));
                // @ts-ignore
                [];
            } },
        value: (d.scale?.per ?? ''),
        ...{ class: "num" },
        type: "number",
        min: "1",
        max: "20",
        placeholder: "4",
    });
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (setScale(d, $event.target.value.trim()));
                // @ts-ignore
                [];
            } },
        value: (d.scale?.dice ?? ''),
        ...{ class: "num" },
        placeholder: "（不加）",
    });
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.damage.splice(i, 1));
                // @ts-ignore
                [draft,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addDamage) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "1d8",
});
(draft.value.heal.dice);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
});
(draft.value.heal.flat);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
});
(draft.value.shield.flat);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "10",
});
(draft.value.shield.level);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "1",
    step: "0.05",
});
(draft.value.lifesteal);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.heal.mod);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.heal.level);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.heal.full);
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
const __VLS_13 = __VLS_tryAsConstant((draft.value.apply ?? []));
for (const [a, i] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (i),
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (a.status),
        ...{ class: "grow" },
    });
    /** @type {__VLS_StyleScopedClasses['grow']} */ ;
    const __VLS_14 = __VLS_tryAsConstant((__VLS_unwrap(statusList, {})));
    for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (s.id),
            value: (s.id),
        });
        (s.kind === 'buff' ? '🟢' : '🔴');
        (s.name);
        // @ts-ignore
        [draft, draft, draft, draft, draft, draft, draft, draft, draft, statusList,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "num" },
        type: "number",
        min: "1",
        max: "20",
    });
    (a.turns);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (a.to = $event.target.value);
                // @ts-ignore
                [];
            } },
        value: (a.to ?? 'target'),
    });
    const __VLS_15 = __VLS_tryAsConstant((__VLS_unwrap(TO, {})));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [TO,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (a.on = $event.target.value);
                // @ts-ignore
                [];
            } },
        value: (a.on ?? (draft.value.resolve === 'attack' ? 'hit' : draft.value.resolve === 'save' ? 'fail' : 'always')),
    });
    const __VLS_16 = __VLS_tryAsConstant((__VLS_unwrap(ON, {})));
    for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_16))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (n);
        // @ts-ignore
        [draft, draft, ON,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (a.save = ($event.target.value || undefined));
                // @ts-ignore
                [];
            } },
        value: (a.save ?? ''),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    const __VLS_17 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
    for (const [x] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (x),
            value: (x),
        });
        (__VLS_unwrap(attrName, {})(x));
        // @ts-ignore
        [ATTR_IDS, attrName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.apply.splice(i, 1));
                // @ts-ignore
                [draft,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (addApply) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "10",
    placeholder: "不限",
});
(draft.value.uses.per_turn);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "10",
    placeholder: "不限",
});
(draft.value.uses.per_combat);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "10",
    placeholder: "不限",
});
(draft.value.uses.per_rest);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "10",
});
(draft.value.ap_gain);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "10",
});
(draft.value.ap_gain_on_hit);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    placeholder: "不限",
});
(draft.value.hp_limit);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.concentration);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.cleanse);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.recover_slot);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.kill);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.desc),
    rows: "2",
    maxlength: "200",
});
// @ts-ignore
[draft, draft, draft, draft, draft, draft, draft, draft, draft, draft, draft,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
