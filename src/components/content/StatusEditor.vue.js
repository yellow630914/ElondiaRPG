import { computed, ref, watch } from 'vue';
import { damageTypeName, damageTypes, describeStatus, statuses } from '@/engine/data';
import { builtinStatus, LUCK_ROLLS, STATUS_CONTROLS, STATUS_SPECIALS } from '@/engine/mods';
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
    const s = clone(content.mods.statuses[props.id] ?? statuses[props.id]);
    s.mods ??= {};
    return s;
}
// 空的 mods 不算修改
const snap = (s) => JSON.stringify(s, (k, v) => (k === 'mods' && v && !Object.values(v).some(Boolean) ? undefined : v));
const draft = ref(current());
const saved = ref(snap(draft.value));
watch(() => props.id, () => {
    draft.value = current();
    saved.value = snap(draft.value);
});
const dirty = computed(() => snap(draft.value) !== saved.value);
const builtin = computed(() => !!builtinStatus(props.id));
const edited = computed(() => builtin.value && !!content.mods.statuses[props.id]);
const usage = computed(() => {
    void content.version;
    void game.state?.combat?.round;
    return content.usageOf('status', props.id);
});
const preview = computed(() => describeStatus(draft.value));
// ---- 選項 ----
const MODS = { hit: '命中', evade: '迴避', save: '豁免', damage: '武器傷害', dr: '減傷', ap_regen: '行動點回復', crit: '幸運一擊閾值降低', threat: '仇恨倍率' };
const damageIds = damageTypes.types.map((t) => t.id);
const affinityKeys = [...damageIds, ...Object.keys(damageTypes.groups)];
const others = computed(() => {
    void content.version;
    return Object.entries(statuses).filter(([id]) => id !== props.id).map(([id, s]) => ({ id, name: s.name, kind: s.kind }));
});
function setMod(k, v) {
    const m = (draft.value.mods ??= {});
    if (v === '' || !Number(v))
        delete m[k];
    else
        m[k] = Number(v);
}
function toggleRoll(field, r, on) {
    const set = new Set(draft.value[field] ?? []);
    if (on)
        set.add(r);
    else
        set.delete(r);
    if (set.size)
        draft.value[field] = [...set];
    else
        delete draft.value[field];
}
/** 傷害倍率：一列一種傷害類型（或群組） */
function rows(map) {
    return Object.entries(map ?? {}).map(([k, v]) => [k, v ?? 0]);
}
function addAffinity(field) {
    const map = (draft.value[field] ??= {});
    const free = affinityKeys.find((k) => !(k in map)) ?? 'all';
    map[free] = field === 'resist' ? -0.25 : 0.25;
}
function setAffinity(field, oldKey, key, value) {
    const map = (draft.value[field] ??= {});
    delete map[oldKey];
    map[key] = value;
}
function removeAffinity(field, key) {
    const map = draft.value[field];
    if (!map)
        return;
    delete map[key];
    if (!Object.keys(map).length)
        delete draft.value[field];
}
function toggleTyped(field, on) {
    if (on)
        draft.value[field] = { dice: '1d6', type: field === 'dot' ? 'poison' : 'force' };
    else
        delete draft.value[field];
}
const onHitKind = computed(() => (draft.value.on_hit?.status ? 'status' : draft.value.on_hit?.dice ? 'damage' : ''));
function setOnHit(kind) {
    if (kind === 'damage')
        draft.value.on_hit = { dice: '1d4', type: 'radiant' };
    else if (kind === 'status')
        draft.value.on_hit = { status: others.value.find((s) => s.kind === 'debuff')?.id ?? others.value[0].id, turns: 2 };
    else
        delete draft.value.on_hit;
}
function save() {
    try {
        content.saveStatus(props.id, draft.value);
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
    content.restoreStatus(props.id);
    draft.value = current();
    saved.value = snap(draft.value);
}
function remove() {
    if (!confirm(`刪除「${draft.value.name}」？`))
        return;
    try {
        content.deleteStatus(props.id);
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
// @ts-ignore
__VLS_withDotValue(onHitKind, {});
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
(draft.value.kind === 'buff' ? '🟢' : '🔴');
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
        title: (usage.value.length ? '還有地方用到這個狀態，不能刪除' : ''),
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
(__VLS_unwrap(preview, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
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
    maxlength: "10",
});
(draft.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.kind),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "buff",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "debuff",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "10",
    placeholder: "不限（看回合）",
});
(draft.value.charges);
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(MODS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (k),
    });
    (n);
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (setMod(k, $event.target.value));
                // @ts-ignore
                [draft, draft, draft, draft, draft, builtin, builtin, builtin, edited, edited, dirty, dirty, dirty, usage, usage, usage, id, preview, MODS,];
            } },
        type: "number",
        step: (k === 'threat' ? 0.05 : 1),
        min: (k === 'threat' ? -1 : -10),
        max: (k === 'threat' ? 2 : 10),
        value: (draft.value.mods?.[k] ?? ''),
        placeholder: "—",
    });
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "num" },
    placeholder: "1d4 或 -1d4",
});
(draft.value.luck);
/** @type {__VLS_StyleScopedClasses['num']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(LUCK_ROLLS, {})));
for (const [n, r] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (r),
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (toggleRoll('luck_on', r, $event.target.checked));
                // @ts-ignore
                [draft, LUCK_ROLLS,];
            } },
        type: "checkbox",
        checked: (draft.value.luck_on?.includes(r)),
    });
    (n);
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(LUCK_ROLLS, {})));
for (const [n, r] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (r),
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (toggleRoll('advantage', r, $event.target.checked));
                // @ts-ignore
                [LUCK_ROLLS,];
            } },
        type: "checkbox",
        checked: (draft.value.advantage?.includes(r)),
    });
    (n);
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
const __VLS_8 = __VLS_tryAsConstant((__VLS_unwrap(LUCK_ROLLS, {})));
for (const [n, r] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (`d-${r}`),
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (toggleRoll('disadvantage', r, $event.target.checked));
                // @ts-ignore
                [LUCK_ROLLS,];
            } },
        type: "checkbox",
        checked: (draft.value.disadvantage?.includes(r)),
    });
    (n);
    // @ts-ignore
    [draft,];
}
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
(draft.value.attacked_advantage);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(draft.value.attacked_disadvantage);
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
const __VLS_9 = __VLS_tryAsConstant(['resist', 'offense']);
for (const [field] of __VLS_vFor(__VLS_nonNull(__VLS_9))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (field),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (field === 'resist' ? '受到的傷害' : '造成的傷害');
    const __VLS_10 = __VLS_tryAsConstant((rows(draft.value[field])));
    for (const [[k, v]] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
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
                    return (setAffinity(field, k, $event.target.value, v));
                    // @ts-ignore
                    [draft, draft, draft,];
                } },
            value: (k),
        });
        const __VLS_11 = __VLS_tryAsConstant((__VLS_unwrap(affinityKeys, {})));
        for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (id),
                value: (id),
            });
            (__VLS_unwrap(damageTypeName, {})(id));
            // @ts-ignore
            [affinityKeys, damageTypeName,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onInput: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (setAffinity(field, k, k, Number($event.target.value)));
                    // @ts-ignore
                    [];
                } },
            type: "number",
            step: "0.05",
            min: "-1",
            max: "2",
            ...{ class: "num" },
            value: (v),
        });
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (Math.round((1 + v) * 100) / 100);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (removeAffinity(field, k));
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
                return (addAffinity(field));
                // @ts-ignore
                [];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (field === 'resist' ? '受到的傷害倍率' : '造成的傷害倍率');
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (toggleTyped('dot', $event.target.checked));
            // @ts-ignore
            [];
        } },
    type: "checkbox",
    checked: (!!draft.value.dot),
});
if (draft.value.dot) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "num" },
    });
    (draft.value.dot.dice);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.dot.type),
    });
    const __VLS_12 = __VLS_tryAsConstant((__VLS_unwrap(damageIds, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (t),
            value: (t),
        });
        (__VLS_unwrap(damageTypeName, {})(t));
        // @ts-ignore
        [draft, draft, draft, draft, damageTypeName, damageIds,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "num" },
    placeholder: "1d6",
});
(draft.value.hot);
/** @type {__VLS_StyleScopedClasses['num']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (toggleTyped('pulse', $event.target.checked));
            // @ts-ignore
            [draft,];
        } },
    type: "checkbox",
    checked: (!!draft.value.pulse),
});
if (draft.value.pulse) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "num" },
    });
    (draft.value.pulse.dice);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.pulse.type),
    });
    const __VLS_13 = __VLS_tryAsConstant((__VLS_unwrap(damageIds, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (t),
            value: (t),
        });
        (__VLS_unwrap(damageTypeName, {})(t));
        // @ts-ignore
        [draft, draft, draft, draft, damageTypeName, damageIds,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (draft.value.pulse.mod);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setOnHit($event.target.value));
            // @ts-ignore
            [draft,];
        } },
    value: (onHitKind.value),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "damage",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "status",
});
if (draft.value.on_hit?.dice !== undefined && onHitKind.value === 'damage') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "num" },
    });
    (draft.value.on_hit.dice);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.on_hit.type),
    });
    const __VLS_14 = __VLS_tryAsConstant((__VLS_unwrap(damageIds, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (t),
            value: (t),
        });
        (__VLS_unwrap(damageTypeName, {})(t));
        // @ts-ignore
        [draft, draft, draft, damageTypeName, damageIds, onHitKind, onHitKind,];
    }
}
if (draft.value.on_hit && onHitKind.value === 'status') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (draft.value.on_hit.status),
    });
    const __VLS_15 = __VLS_tryAsConstant((__VLS_unwrap(others, {})));
    for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (s.id),
            value: (s.id),
        });
        (s.kind === 'buff' ? '🟢' : '🔴');
        (s.name);
        // @ts-ignore
        [draft, draft, onHitKind, others,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "num" },
        type: "number",
        min: "1",
        max: "20",
    });
    (draft.value.on_hit.turns);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (draft.value.control = ($event.target.value || undefined));
            // @ts-ignore
            [draft, draft,];
        } },
    value: (draft.value.control ?? ''),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_16 = __VLS_tryAsConstant((__VLS_unwrap(STATUS_CONTROLS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_16))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [draft, STATUS_CONTROLS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (draft.value.special = ($event.target.value || undefined));
            // @ts-ignore
            [draft,];
        } },
    value: (draft.value.special ?? ''),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_17 = __VLS_tryAsConstant((__VLS_unwrap(STATUS_SPECIALS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [draft, STATUS_SPECIALS,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
