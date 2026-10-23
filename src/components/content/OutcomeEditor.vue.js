import { computed } from 'vue';
import { geography, npcs as namedNpcs } from '@/engine/data';
import { travelEvents } from '@/engine/road';
import { SIDE_MAPS } from '@/engine/storyMods';
import EffectsEditor from './EffectsEditor.vue';
import FlagInput from './FlagInput.vue';
const { defineProps, defineModel, } = {};
// 任務點的一個結果：文字、劇情旗標、效果、任務同行的夥伴、完成或失敗
const model = defineModel();
const props = defineProps();
const o = computed(() => model.value);
function enable(on) {
    model.value = on ? {} : undefined;
}
const end = computed({
    get: () => (o.value?.complete ? 'complete' : o.value?.fail_quest ? 'fail' : ''),
    set: (v) => {
        if (!o.value)
            return;
        delete o.value.complete;
        delete o.value.fail_quest;
        if (v === 'complete')
            o.value.complete = true;
        if (v === 'fail')
            o.value.fail_quest = true;
    },
});
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
__VLS_withDotValue(o, {});
// @ts-ignore
__VLS_withDotValue(travelEvents, {});
// @ts-ignore
__VLS_withDotValue(geography, {});
void {};
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "outcome" },
});
/** @type {__VLS_StyleScopedClasses['outcome']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check small head" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
if (props.optional) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(props.optional))
                    throw 0;
                return (enable($event.target.checked));
            } },
        type: "checkbox",
        checked: (!!o.value),
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
(__VLS_ctx.label);
if (props.optional && !o.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
if (o.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "block small" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (o.value.text),
        rows: "2",
        maxlength: "400",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_0 = FlagInput;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        // @ts-ignore
        modelValue: (o.value.set_flags),
    }));
    const __VLS_2 = __VLS_1({
        modelValue: (o.value.set_flags),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_5 = FlagInput;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        // @ts-ignore
        modelValue: (o.value.clear_flags),
    }));
    const __VLS_7 = __VLS_6({
        modelValue: (o.value.clear_flags),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (o.value.join),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (undefined),
    });
    const __VLS_10 = __VLS_tryAsConstant((__VLS_unwrap(namedNpcs, {})));
    for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_10))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (n.id),
            value: (n.id),
        });
        (n.name);
        // @ts-ignore
        [o, o, o, o, o, o, o, label, namedNpcs,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (o.value.leave),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (undefined),
    });
    const __VLS_11 = __VLS_tryAsConstant((__VLS_unwrap(namedNpcs, {})));
    for (const [n] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (n.id),
            value: (n.id),
        });
        (n.name);
        // @ts-ignore
        [o, namedNpcs,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (o.value.side_map),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (undefined),
    });
    const __VLS_12 = __VLS_tryAsConstant((__VLS_unwrap(SIDE_MAPS, {})()));
    for (const [k] of __VLS_vFor(__VLS_nonNull(__VLS_12))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (k),
            value: (k),
        });
        (travelEvents.value.side_maps[k].name);
        // @ts-ignore
        [o, SIDE_MAPS, travelEvents,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (o.value.travel_to),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (undefined),
    });
    const __VLS_13 = __VLS_tryAsConstant((geography.value.locations));
    for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (l.id),
            value: (l.id),
        });
        (l.name);
        // @ts-ignore
        [o, geography,];
    }
    const __VLS_14 = EffectsEditor;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
        // @ts-ignore
        modelValue: (o.value.effects),
    }));
    const __VLS_16 = __VLS_15({
        modelValue: (o.value.effects),
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(end, {})),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "complete",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "fail",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (o.value.retry);
}
// @ts-ignore
[o, o, end,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
