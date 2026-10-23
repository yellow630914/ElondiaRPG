import { computed, ref, watch } from 'vue';
import { ATTR_IDS, attrName } from '@/engine/data';
import { builtinTattoo } from '@/engine/mods';
import { oathError, oathText, placeName, TATTOO_PLACES, tattooRules } from '@/engine/tattoos';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
import UsageNote from './UsageNote.vue';
const { defineProps, defineEmits, } = {};
const props = defineProps();
const emit = defineEmits();
const content = useContent();
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
const current = () => clone(content.mods.tattoos?.[props.id] ?? tattooRules.templates[props.id]);
const draft = ref(current());
const saved = ref(JSON.stringify(draft.value));
watch(() => props.id, () => {
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
});
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
const builtin = computed(() => !!builtinTattoo(props.id));
const edited = computed(() => builtin.value && !!content.mods.tattoos?.[props.id]);
const usage = computed(() => {
    void content.version;
    return content.usageOf('tattoo', props.id);
});
const problem = computed(() => (draft.value.kind === 'oath' ? oathError(draft.value.attrs) : undefined));
const max = tattooRules.oath.max_change;
function setKind(kind) {
    draft.value.kind = kind;
    if (kind === 'oath')
        draft.value.attrs ??= { str: 1, int: -1 };
    else
        delete draft.value.attrs;
}
function setAttr(a, v) {
    const attrs = { ...(draft.value.attrs ?? {}) };
    if (v)
        attrs[a] = v;
    else
        delete attrs[a];
    draft.value.attrs = attrs;
}
function togglePlace(p, on) {
    const set = new Set(draft.value.places ?? []);
    if (on)
        set.add(p);
    else
        set.delete(p);
    if (set.size)
        draft.value.places = TATTOO_PLACES.filter((x) => set.has(x));
    else
        delete draft.value.places;
}
function save() {
    try {
        content.saveTattoo(props.id, draft.value);
        draft.value = current();
        saved.value = JSON.stringify(draft.value);
        game.flash(`已儲存「${draft.value.name}」`);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function restore() {
    if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`))
        return;
    content.restoreTattoo(props.id);
    draft.value = current();
    saved.value = JSON.stringify(draft.value);
}
function remove() {
    if (!confirm(`刪除「${draft.value.name}」？`))
        return;
    try {
        content.deleteTattoo(props.id);
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
__VLS_withDotValue(problem, {});
// @ts-ignore
__VLS_withDotValue(usage, {});
// @ts-ignore
__VLS_withDotValue(tattooRules, {});
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
    disabled: (!dirty.value || !!problem.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (draft.value = __VLS_unwrap(current, {})());
            // @ts-ignore
            [draft, draft, builtin, edited, dirty, dirty, problem, current,];
        } },
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
(__VLS_unwrap(max, {}));
(tattooRules.value.oath.max_attrs);
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
    maxlength: "12",
});
(draft.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setKind($event.target.value));
            // @ts-ignore
            [draft, builtin, builtin, edited, dirty, usage, usage, id, max, tattooRules,];
        } },
    value: (draft.value.kind),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "plain",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "oath",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "wide" },
});
/** @type {__VLS_StyleScopedClasses['wide']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (draft.value.desc),
    rows: "2",
    maxlength: "160",
});
if (draft.value.kind === 'oath') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small" },
        ...{ class: (problem.value ? 'warn-text' : 'muted') },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (problem.value ?? __VLS_unwrap(oathText, {})(draft.value.attrs ?? {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
    for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (a),
        });
        (__VLS_unwrap(attrName, {})(a));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onInput: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(draft.value.kind === 'oath'))
                        throw 0;
                    return (setAttr(a, Number($event.target.value)));
                    // @ts-ignore
                    [draft, draft, draft, draft, problem, problem, oathText, ATTR_IDS, attrName,];
                } },
            type: "number",
            min: (-__VLS_unwrap(max, {})),
            max: (__VLS_unwrap(max, {})),
            value: (draft.value.attrs?.[a] ?? 0),
        });
        // @ts-ignore
        [draft, max, max,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(TATTOO_PLACES, {})));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (p),
        ...{ class: "check small" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (togglePlace(p, $event.target.checked));
                // @ts-ignore
                [TATTOO_PLACES,];
            } },
        type: "checkbox",
        checked: (draft.value.places?.includes(p)),
    });
    (__VLS_unwrap(placeName, {})(p));
    // @ts-ignore
    [draft, placeName,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
