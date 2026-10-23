import { computed } from 'vue';
import { DEFAULT_PORTRAIT_TEMPLATE, DEFAULT_STYLE, IMAGE_SERVICES, imageServiceInfo } from '@/narrator/imageInfo';
import { useImageSettings } from '@/stores/image';
import { useSettings } from '@/stores/settings';
import ComfySettings from './ComfySettings.vue';
// 插圖生成的設定：生圖服務、形象插圖的提示詞、生圖提示詞預處理（內建或自訂的指示）
const image = useImageSettings();
const settings = useSettings();
const info = computed(() => imageServiceInfo(image.service));
const cfg = computed(() => image.configs[image.service]);
const sizeKey = computed({
    get: () => `${cfg.value.width}x${cfg.value.height}`,
    set: (v) => {
        const [w, h] = v.split('x').map(Number);
        if (w && h) {
            cfg.value.width = w;
            cfg.value.height = h;
        }
    },
});
const tagSource = computed(() => settings.sourceFor('tags'));
const tagReady = computed(() => settings.sourceReady(tagSource.value.index));
// 目前服務用的預處理指示；自訂的可以直接修改
const pre = computed(() => image.preprocessorFor());
const custom = computed(() => image.preprocessors.find((p) => p.id === pre.value?.id));
function removePreprocessor() {
    const p = custom.value;
    if (!p)
        return;
    const users = IMAGE_SERVICES.filter((s) => image.preprocess[s.id] === p.id).map((s) => s.name);
    if (confirm(`刪除預處理指示「${p.name}」？${users.length ? `（${users.join('、')} 會改成不預處理）` : ''}`))
        image.removePreprocessor(p.id);
}
function resetService() {
    if (confirm(`把 ${info.value.name} 的參數恢復預設？（API key 會保留）`))
        image.resetService(image.service);
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(image, {});
// @ts-ignore
__VLS_withDotValue(info, {});
// @ts-ignore
__VLS_withDotValue(cfg, {});
// @ts-ignore
__VLS_withDotValue(tagSource, {});
// @ts-ignore
__VLS_withDotValue(pre, {});
// @ts-ignore
__VLS_withDotValue(tagReady, {});
// @ts-ignore
__VLS_withDotValue(custom, {});
// @ts-ignore
__VLS_withDotValue(DEFAULT_STYLE, {});
// @ts-ignore
__VLS_withDotValue(DEFAULT_PORTRAIT_TEMPLATE, {});
void {};
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['pre']} */ ;
/** @type {__VLS_StyleScopedClasses['pre']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form" },
});
/** @type {__VLS_StyleScopedClasses['form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (image.value.service),
});
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(IMAGE_SERVICES, {})));
for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (s.id),
        value: (s.id),
    });
    (s.name);
    // @ts-ignore
    [image, IMAGE_SERVICES,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(info.value.note);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
(info.value.keyOptional ? '（選填，有設驗證時才要）' : '');
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "password",
    autocomplete: "off",
});
(cfg.value.apiKey);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
(cfg.value.baseURL);
if (image.value.service === 'comfyui') {
    const __VLS_1 = ComfySettings;
    // @ts-ignore
    const __VLS_2 = __VLS_asFunctionalComponent1(__VLS_1, new __VLS_1({
    // @ts-ignore
    }));
    const __VLS_3 = __VLS_2({}, ...__VLS_functionalComponentArgsRest(__VLS_2));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
    (cfg.value.model);
}
if (image.value.service !== 'comfyui') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(sizeKey, {})),
    });
    const __VLS_6 = __VLS_tryAsConstant((info.value.sizes));
    for (const [[w, h]] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (`${w}x${h}`),
            value: (`${w}x${h}`),
        });
        (w);
        (h);
        // @ts-ignore
        [image, image, info, info, info, cfg, cfg, cfg, sizeKey,];
    }
    if (!info.value.sizes.some(([w, h]) => w === cfg.value.width && h === cfg.value.height)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (`${cfg.value.width}x${cfg.value.height}`),
        });
        (cfg.value.width);
        (cfg.value.height);
    }
    if (image.value.service !== 'openai') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "64",
            step: "64",
        });
        (cfg.value.width);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "64",
            step: "64",
        });
        (cfg.value.height);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "150",
        });
        (cfg.value.steps);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "0",
            max: "30",
            step: "0.5",
        });
        (cfg.value.scale);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
        (cfg.value.sampler);
    }
}
if (image.value.service === 'novelai') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (cfg.value.negative),
        rows: "2",
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
(image.value.service === 'novelai' ? '合併進 parameters' : '合併進請求');
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (cfg.value.extra),
    rows: "2",
    ...{ class: "mono" },
    spellcheck: "false",
    placeholder: '{"quality": "high"}',
});
/** @type {__VLS_StyleScopedClasses['mono']} */ ;
if (image.value.service !== 'comfyui') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (resetService) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({
    ...{ class: "pre" },
});
/** @type {__VLS_StyleScopedClasses['pre']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(tagSource.value.name);
if (pre.value && !tagReady.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "warn-text" },
    });
    /** @type {__VLS_StyleScopedClasses['warn-text']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
(info.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (image.value.preprocess[image.value.service]),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
    label: "內建",
});
const __VLS_7 = __VLS_tryAsConstant((image.value.allPreprocessors().filter((x) => x.builtin)));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (p.id),
        value: (p.id),
    });
    (p.name);
    // @ts-ignore
    [image, image, image, image, image, image, image, info, info, cfg, cfg, cfg, cfg, cfg, cfg, cfg, cfg, cfg, cfg, cfg, cfg, cfg, tagSource, pre, tagReady,];
}
if (image.value.preprocessors.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
        label: "自訂",
    });
    const __VLS_8 = __VLS_tryAsConstant((image.value.preprocessors));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p.id),
            value: (p.id),
        });
        (p.name);
        // @ts-ignore
        [image, image,];
    }
}
if (custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "30",
    });
    (custom.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (custom.value.output),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "tags",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "text",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (custom.value.instructions),
        rows: "9",
        ...{ class: "mono" },
        spellcheck: "false",
    });
    /** @type {__VLS_StyleScopedClasses['mono']} */ ;
}
else if (pre.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (pre.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (pre.value.instructions),
        rows: "9",
        ...{ class: "mono" },
        readonly: true,
    });
    /** @type {__VLS_StyleScopedClasses['mono']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (pre.value.output === 'tags' ? '整理成標籤' : '原樣送出');
}
if (pre.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
if (pre.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(pre.value))
                    throw 0;
                return (image.value.addPreprocessor(pre.value));
                // @ts-ignore
                [image, pre, pre, pre, pre, pre, pre, pre, custom, custom, custom, custom,];
            } },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (image.value.addPreprocessor());
            // @ts-ignore
            [image,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
if (custom.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (removePreprocessor) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({});
(image.value.style);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            __VLS_withDotValue(DEFAULT_STYLE, {});
            return (image.value.style = DEFAULT_STYLE.value);
            // @ts-ignore
            [image, image, custom, DEFAULT_STYLE,];
        } },
    ...{ class: "small" },
    disabled: (image.value.style === DEFAULT_STYLE.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (image.value.template),
    rows: "9",
    ...{ class: "mono" },
    spellcheck: "false",
});
/** @type {__VLS_StyleScopedClasses['mono']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            __VLS_withDotValue(DEFAULT_PORTRAIT_TEMPLATE, {});
            return (image.value.template = DEFAULT_PORTRAIT_TEMPLATE.value);
            // @ts-ignore
            [image, image, image, DEFAULT_STYLE, DEFAULT_PORTRAIT_TEMPLATE,];
        } },
    ...{ class: "small" },
    disabled: (image.value.template === DEFAULT_PORTRAIT_TEMPLATE.value),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small" },
    ...{ class: (image.value.ready() ? 'ok-text' : 'warn-text') },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(image.value.ready() ? '🟢 可以生成插圖' : image.value.service === 'comfyui' ? '⚪ 還沒設定好（需要網址，以及選好這組設定的模型）' : '⚪ 還沒設定好（需要網址與 API key）');
// @ts-ignore
[image, image, image, image, DEFAULT_PORTRAIT_TEMPLATE,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
