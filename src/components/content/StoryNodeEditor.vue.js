import { computed } from 'vue';
import { ATTR_IDS, attrName, enemies, geography, landmarksIn, npcs as namedNpcs, shopRules } from '@/engine/data';
import { cellName } from '@/engine/grid';
import { LAYER_NAME, NODE_KINDS, SIDE_MAPS, STORY_CELLS, STORY_LAYERS, WHERE_NAME } from '@/engine/storyMods';
import { travelEvents } from '@/engine/road';
import FlagInput from './FlagInput.vue';
import OutcomeEditor from './OutcomeEditor.vue';
const { defineProps, defineModel, } = {};
// 一個任務點：在哪裡、解鎖的條件、種類（劇情、判定、戰鬥、選擇）、結果
const node = defineModel({ required: true });
const props = defineProps();
const where = computed(() => node.value.at.where);
const locations = computed(() => geography.locations.filter((l) => where.value === 'dungeon' ? l.type === 'dungeon' : where.value === 'npc' ? true : l.type !== 'dungeon'));
const requires = computed(() => (node.value.requires ??= {}));
// 設施、自建的商店，加上這個地點的特色地標
const cellOptions = computed(() => [
    ...STORY_CELLS,
    ...Object.values(shopRules.types).filter((d) => d.custom).map((d) => d.cell),
    ...landmarksIn(node.value.at.location ?? '').map((l) => l.id),
]);
const enemyList = computed(() => Object.values(enemies).sort((a, b) => a.level - b.level));
function setKind(kind) {
    node.value.kind = kind;
    if (kind === 'check')
        node.value.check ??= { attr: 'int', dc: 12 };
    if (kind === 'choice')
        node.value.options ??= [{ label: '選項一', success: {} }, { label: '選項二', success: {} }];
    if (kind === 'combat')
        node.value.enemies ??= [['bandit', 1]];
}
function setWhere(w) {
    node.value.at = { ...node.value.at, where: w };
    if (w === 'cell')
        node.value.at.cell ??= 'tavern';
    if (w === 'dungeon') {
        node.value.at.layer ??= 'outskirts';
        if (!geography.locations.find((l) => l.id === node.value.at.location && l.type === 'dungeon'))
            node.value.at.location = locations.value.find((l) => l.type === 'dungeon')?.id;
    }
    else if (w !== 'npc' && geography.locations.find((l) => l.id === node.value.at.location)?.type === 'dungeon') {
        node.value.at.location = 'soriel';
    }
    if (w === 'npc')
        node.value.at.npc ??= namedNpcs[0]?.id;
}
function addOption() {
    ;
    (node.value.options ??= []).push({ label: '新的選項', success: {} });
}
function toggleCheck(o, on) {
    if (on)
        o.check = { attr: 'cha', dc: 12 };
    else {
        delete o.check;
        delete o.fail;
    }
}
function toggleNpc(field, id, on) {
    const set = new Set(node.value[field] ?? []);
    if (on)
        set.add(id);
    else
        set.delete(id);
    node.value[field] = set.size ? [...set] : undefined;
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
__VLS_withDotValue(node, {});
// @ts-ignore
__VLS_withDotValue(where, {});
// @ts-ignore
__VLS_withDotValue(LAYER_NAME, {});
// @ts-ignore
__VLS_withDotValue(travelEvents, {});
// @ts-ignore
__VLS_withDotValue(requires, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "node" },
});
/** @type {__VLS_StyleScopedClasses['node']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "40",
    disabled: (props.lockedId),
    title: (props.lockedId ? '目前的存檔已經完成這個任務點，id 不能改（改了會再觸發一次）' : ''),
});
(node.value.id);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "40",
});
(node.value.title);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setKind($event.target.value));
            // @ts-ignore
            [node, node,];
        } },
    value: (node.value.kind),
});
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(NODE_KINDS, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [node, NODE_KINDS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "block" },
});
/** @type {__VLS_StyleScopedClasses['block']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (node.value.text),
    rows: "3",
    maxlength: "600",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (setWhere($event.target.value));
            // @ts-ignore
            [node,];
        } },
    value: (where.value),
});
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(WHERE_NAME, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [where, WHERE_NAME,];
}
if (where.value !== 'road' && where.value !== 'side') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    (where.value === 'npc' ? '地點（選填：只在這裡）' : '地點');
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (node.value.at.location),
    });
    if (where.value === 'npc') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (undefined),
        });
    }
    const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(locations, {})));
    for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (l.id),
            value: (l.id),
        });
        (l.name);
        // @ts-ignore
        [node, where, where, where, where, locations,];
    }
}
if (where.value === 'cell') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (node.value.at.cell),
    });
    const __VLS_3 = __VLS_tryAsConstant((__VLS_unwrap(cellOptions, {})));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (c),
            value: (c),
        });
        (__VLS_unwrap(cellName, {})(c));
        // @ts-ignore
        [node, where, cellOptions, cellName,];
    }
}
if (where.value === 'dungeon') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (node.value.at.layer),
    });
    const __VLS_4 = __VLS_tryAsConstant((__VLS_unwrap(STORY_LAYERS, {})));
    for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (l),
            value: (l),
        });
        (LAYER_NAME.value[l]);
        // @ts-ignore
        [node, where, STORY_LAYERS, LAYER_NAME,];
    }
}
if (where.value === 'side') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (node.value.at.side_map),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (undefined),
    });
    const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(SIDE_MAPS, {})()));
    for (const [k] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (travelEvents.value.side_maps[k].name);
        // @ts-ignore
        [node, where, SIDE_MAPS, travelEvents,];
    }
}
if (where.value === 'npc') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (node.value.at.npc),
    });
    const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(namedNpcs, {})));
    for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (n.id),
            value: (n.id),
        });
        (n.name);
        // @ts-ignore
        [node, where, namedNpcs,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_7 = FlagInput;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    // @ts-ignore
    modelValue: (requires.value.flags), placeholder: "全部成立才解鎖",
}));
const __VLS_9 = __VLS_8({
    modelValue: (requires.value.flags),
    placeholder: "全部成立才解鎖",
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_12 = FlagInput;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    // @ts-ignore
    modelValue: (requires.value.flags_none),
}));
const __VLS_14 = __VLS_13({
    modelValue: (requires.value.flags_none),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row checks small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['checks']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
const __VLS_17 = __VLS_tryAsConstant((__VLS_unwrap(namedNpcs, {})));
for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        key: (n.id),
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (toggleNpc('allies', n.id, $event.target.checked));
                // @ts-ignore
                [namedNpcs, requires, requires,];
            } },
        type: "checkbox",
        checked: (node.value.allies?.includes(n.id)),
    });
    (n.name);
    // @ts-ignore
    [node,];
}
if (node.value.allies?.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (['outskirts', 'dungeon', 'side'].includes(where.value) ? ' ⭐ 旁邊' : where.value === 'npc' || where.value === 'road' ? '這裡' : '設施上');
}
if (node.value.kind === 'check' && node.value.check) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (node.value.check.attr),
    });
    const __VLS_18 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
    for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (a),
            value: (a),
        });
        (__VLS_unwrap(attrName, {})(a));
        // @ts-ignore
        [node, node, node, node, where, where, where, ATTR_IDS, attrName,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "1",
        max: "40",
        ...{ class: "num" },
    });
    (node.value.check.dc);
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    const __VLS_19 = OutcomeEditor;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
        // @ts-ignore
        modelValue: (node.value.success), label: "成功",
    }));
    const __VLS_21 = __VLS_20({
        modelValue: (node.value.success),
        label: "成功",
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
    const __VLS_24 = OutcomeEditor;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
        // @ts-ignore
        modelValue: (node.value.fail), label: "失敗", optional: true,
    }));
    const __VLS_26 = __VLS_25({
        modelValue: (node.value.fail),
        label: "失敗",
        optional: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
else if (node.value.kind === 'combat') {
    const __VLS_29 = __VLS_tryAsConstant((node.value.enemies ?? []));
    for (const [g, i] of __VLS_vFor(__VLS_nonNull(__VLS_29))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "row small" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (g[0]),
            ...{ class: "grow" },
        });
        /** @type {__VLS_StyleScopedClasses['grow']} */ ;
        const __VLS_30 = __VLS_tryAsConstant((__VLS_unwrap(enemyList, {})));
        for (const [e] of __VLS_vFor(__VLS_nonNull(__VLS_30))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (e.id),
                value: (e.id),
            });
            (e.name);
            (e.level);
            // @ts-ignore
            [node, node, node, node, node, enemyList,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "6",
            ...{ class: "num" },
        });
        (g[1]);
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(node.value.kind === 'check' && node.value.check))
                        throw 0;
                    if (!(node.value.kind === 'combat'))
                        throw 0;
                    return (node.value.enemies.splice(i, 1));
                    // @ts-ignore
                    [node,];
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
                if (!!(node.value.kind === 'check' && node.value.check))
                    throw 0;
                if (!(node.value.kind === 'combat'))
                    throw 0;
                return ((node.value.enemies ??= []).push(['bandit', 1]));
                // @ts-ignore
                [node,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row checks small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['checks']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    const __VLS_31 = __VLS_tryAsConstant((__VLS_unwrap(namedNpcs, {})));
    for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_31))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (n.id),
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(node.value.kind === 'check' && node.value.check))
                        throw 0;
                    if (!(node.value.kind === 'combat'))
                        throw 0;
                    return (toggleNpc('foes', n.id, $event.target.checked));
                    // @ts-ignore
                    [namedNpcs,];
                } },
            type: "checkbox",
            checked: (node.value.foes?.includes(n.id)),
        });
        (n.name);
        // @ts-ignore
        [node,];
    }
    const __VLS_32 = OutcomeEditor;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
        // @ts-ignore
        modelValue: (node.value.success), label: "勝利",
    }));
    const __VLS_34 = __VLS_33({
        modelValue: (node.value.success),
        label: "勝利",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    const __VLS_37 = OutcomeEditor;
    // @ts-ignore
    const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
        // @ts-ignore
        modelValue: (node.value.fail), label: "落敗或撤退", optional: true,
    }));
    const __VLS_39 = __VLS_38({
        modelValue: (node.value.fail),
        label: "落敗或撤退",
        optional: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_38));
}
else if (node.value.kind === 'choice') {
    const __VLS_42 = __VLS_tryAsConstant((node.value.options ?? []));
    for (const [o, i] of __VLS_vFor(__VLS_nonNull(__VLS_42))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (i),
            ...{ class: "option" },
        });
        /** @type {__VLS_StyleScopedClasses['option']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row small" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "30",
        });
        (o.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "check" },
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(node.value.kind === 'check' && node.value.check))
                        throw 0;
                    if (!!(node.value.kind === 'combat'))
                        throw 0;
                    if (!(node.value.kind === 'choice'))
                        throw 0;
                    return (toggleCheck(o, $event.target.checked));
                    // @ts-ignore
                    [node, node, node, node,];
                } },
            type: "checkbox",
            checked: (!!o.check),
        });
        if (o.check) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (o.check.attr),
            });
            const __VLS_43 = __VLS_tryAsConstant((__VLS_unwrap(ATTR_IDS, {})));
            for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_43))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (a),
                    value: (a),
                });
                (__VLS_unwrap(attrName, {})(a));
                // @ts-ignore
                [ATTR_IDS, attrName,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "number",
                min: "1",
                max: "40",
                ...{ class: "num" },
            });
            (o.check.dc);
            /** @type {__VLS_StyleScopedClasses['num']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(node.value.kind === 'check' && node.value.check))
                        throw 0;
                    if (!!(node.value.kind === 'combat'))
                        throw 0;
                    if (!(node.value.kind === 'choice'))
                        throw 0;
                    return (node.value.options.splice(i, 1));
                    // @ts-ignore
                    [node,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_44 = OutcomeEditor;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent1(__VLS_44, new __VLS_44({
            // @ts-ignore
            modelValue: (o.success), label: (o.check ? '成功' : '結果'),
        }));
        const __VLS_46 = __VLS_45({
            modelValue: (o.success),
            label: (o.check ? '成功' : '結果'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        if (o.check) {
            const __VLS_49 = OutcomeEditor;
            // @ts-ignore
            const __VLS_50 = __VLS_asFunctionalComponent1(__VLS_49, new __VLS_49({
                // @ts-ignore
                modelValue: (o.fail), label: "失敗", optional: true,
            }));
            const __VLS_51 = __VLS_50({
                modelValue: (o.fail),
                label: "失敗",
                optional: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_50));
        }
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (addOption) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
else {
    const __VLS_54 = OutcomeEditor;
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent1(__VLS_54, new __VLS_54({
        // @ts-ignore
        modelValue: (node.value.success), label: "結果",
    }));
    const __VLS_56 = __VLS_55({
        modelValue: (node.value.success),
        label: "結果",
    }, ...__VLS_functionalComponentArgsRest(__VLS_55));
}
// @ts-ignore
[node,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
