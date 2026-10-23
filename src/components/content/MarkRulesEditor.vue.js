import { computed, ref } from 'vue';
import { contractDef, slaveryRules } from '@/engine/data';
import { builtinMarkRules } from '@/engine/mods';
import { currentMarkRules } from '@/engine/tattooMods';
import { useContent } from '@/stores/content';
import { useGame } from '@/stores/game';
// 印記的用途與權重：預設印記、老鴇的印記、刻印檢定的輕重順序、奴隸市場與自賣的權重
const content = useContent();
const game = useGame();
const clone = (v) => JSON.parse(JSON.stringify(v));
const current = () => clone(content.mods.markRules?.rules ?? currentMarkRules());
const draft = ref(current());
const saved = ref(JSON.stringify(draft.value));
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value);
const edited = computed(() => !!content.mods.markRules?.rules);
const ids = computed(() => {
    void content.version;
    return Object.keys(slaveryRules.contracts);
});
const name = (id) => contractDef(id).name;
const WEIGHTS = [
    { key: 'public', label: '公開奴隸市場' }, { key: 'black', label: '黑市' }, { key: 'self', label: '自賣（買家打算刻的）' },
];
function weights(key) {
    return key === 'self' ? draft.value.self_sale : draft.value.market_contracts[key];
}
function setWeight(key, id, v) {
    const w = weights(key);
    if (v > 0)
        w[id] = v;
    else
        delete w[id];
}
function move(i, d) {
    const list = draft.value.severity;
    const j = i + d;
    if (j < 0 || j >= list.length)
        return;
    [list[i], list[j]] = [list[j], list[i]];
}
function save() {
    try {
        content.saveMarkRules(draft.value);
        draft.value = current();
        saved.value = JSON.stringify(draft.value);
        game.flash('已儲存印記設定');
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
function restore() {
    if (!confirm('把印記設定恢復成內建的樣子？'))
        return;
    content.restoreMarkRules();
    draft.value = clone(builtinMarkRules());
    saved.value = JSON.stringify(draft.value);
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(edited, {});
// @ts-ignore
__VLS_withDotValue(dirty, {});
// @ts-ignore
__VLS_withDotValue(draft, {});
// @ts-ignore
__VLS_withDotValue(ids, {});
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
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag" },
});
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
(edited.value ? '已修改' : '內建');
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
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (draft.value = __VLS_unwrap(current, {})());
            // @ts-ignore
            [edited, dirty, dirty, draft, current,];
        } },
    ...{ class: "small" },
    disabled: (!dirty.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (restore) },
    ...{ class: "small" },
    disabled: (!edited.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.roles.default),
});
const __VLS_0 = __VLS_tryAsConstant((ids.value));
for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (id),
        value: (id),
    });
    (__VLS_unwrap(name, {})(id));
    // @ts-ignore
    [edited, dirty, draft, ids, name,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (draft.value.roles.madam),
});
const __VLS_1 = __VLS_tryAsConstant((ids.value));
for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (id),
        value: (id),
    });
    (__VLS_unwrap(name, {})(id));
    // @ts-ignore
    [draft, ids, name,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.ol, __VLS_intrinsics.ol)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_2 = __VLS_tryAsConstant((draft.value.severity));
for (const [id, i] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: (id),
    });
    (__VLS_unwrap(name, {})(id));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (move(i, -1));
                // @ts-ignore
                [draft, name,];
            } },
        ...{ class: "small" },
        disabled: (i === 0),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (move(i, 1));
                // @ts-ignore
                [];
            } },
        ...{ class: "small" },
        disabled: (i === draft.value.severity.length - 1),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (draft.value.severity.splice(i, 1));
                // @ts-ignore
                [draft, draft,];
            } },
        ...{ class: "small" },
        disabled: (draft.value.severity.length <= 1),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    // @ts-ignore
    [draft,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            draft.value.severity.push($event.target.value);
            $event.target.value = '';
            // @ts-ignore
            [draft,];
        } },
    ...{ class: "small" },
    value: (''),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_3 = __VLS_tryAsConstant((ids.value.filter((x) => !draft.value.severity.includes(x))));
for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (id),
        value: (id),
    });
    (__VLS_unwrap(name, {})(id));
    // @ts-ignore
    [draft, ids, name,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
const __VLS_4 = __VLS_tryAsConstant((__VLS_unwrap(WEIGHTS, {})));
for (const [w] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        key: (w.key),
    });
    (w.label);
    // @ts-ignore
    [WEIGHTS,];
}
const __VLS_5 = __VLS_tryAsConstant((ids.value));
for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (id),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    (__VLS_unwrap(name, {})(id));
    const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(WEIGHTS, {})));
    for (const [w] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            key: (w.key),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onInput: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    return (setWeight(w.key, id, Number($event.target.value)));
                    // @ts-ignore
                    [ids, name, WEIGHTS,];
                } },
            type: "number",
            min: "0",
            max: "100",
            ...{ style: {} },
            value: (weights(w.key)[id] ?? 0),
        });
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
