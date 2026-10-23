import { computed, ref } from 'vue';
import { CACHE_MARKS, guessCacheMark, guessReasoningFormat, parseExtraBody, providerInfo, PROVIDERS, REASONING_FORMATS, REASONING_LEVELS, } from '@/narrator/providerInfo';
import { AI_FEATURES, useSettings } from '@/stores/settings';
const { defineProps, } = {};
const props = defineProps();
const settings = useSettings();
const source = computed(() => settings.sources[props.index]);
const info = computed(() => providerInfo(source.value.provider));
const cfg = computed(() => source.value.configs[source.value.provider]);
const used = computed(() => AI_FEATURES.filter((f) => settings.routes[f.id] === props.index).map((f) => f.name));
// 載入的模型清單依服務分開保存，切換服務再切回來不必重新載入
const loaded = ref({});
const models = computed(() => loaded.value[source.value.provider] ?? []);
const hints = computed(() => info.value.modelHints.filter((m) => !models.value.includes(m)));
const known = computed(() => [...hints.value, ...models.value]);
const loading = ref(false);
const message = ref('');
const showKey = ref(false);
async function loadModels() {
    loading.value = true;
    message.value = '';
    try {
        const { listModels } = await import('@/narrator/providers');
        const provider = source.value.provider;
        loaded.value[provider] = await listModels(provider, cfg.value);
        message.value = `連線成功，共 ${loaded.value[provider].length} 個模型，可以從下拉選單選擇。`;
    }
    catch (e) {
        message.value = `連線失敗：${e instanceof Error ? e.message : String(e)}`;
    }
    finally {
        loading.value = false;
    }
}
function pickModel(e) {
    const v = e.target.value;
    if (v)
        cfg.value.model = v;
}
function onMaxTokens(e) {
    const v = Number(e.target.value);
    cfg.value.maxTokens = v > 0 ? v : undefined;
}
// ---- 思考（推理） ----
const reasoning = computed({
    get: () => cfg.value.reasoning ?? '',
    set: (v) => {
        if (v)
            cfg.value.reasoning = v;
        else
            delete cfg.value.reasoning;
    },
});
const showThinking = computed({
    get: () => cfg.value.showThinking !== false,
    set: (v) => {
        if (v)
            delete cfg.value.showThinking;
        else
            cfg.value.showThinking = false;
    },
});
const guessed = computed(() => REASONING_FORMATS.find((f) => f.id === guessReasoningFormat(cfg.value.baseURL))?.name ?? '');
// 快取標記：自動時依模型判斷
const cacheGuess = computed(() => (guessCacheMark(cfg.value) ? '標記（這個模型要手動標記才會快取）' : '不標記（這個模型會自動快取，或不支援）'));
const extraError = computed(() => {
    try {
        parseExtraBody(cfg.value.extraBody);
        return '';
    }
    catch (e) {
        return e instanceof Error ? e.message : String(e);
    }
});
const REASONING_NOTE = {
    anthropic: 'Claude 5 系列與 4.6 之後的模型用自適應思考（強度是 effort）；舊模型用思考預算。Opus 5.5 不能關閉思考。',
    openai: 'reasoning_effort（推理模型才有效；關閉對應 minimal）。OpenAI 不回傳思考內容。',
    gemini: 'thinkingBudget（Gemini 3 用 thinkingLevel）；部分 Pro 模型不能關閉思考。',
    openai_compatible: '各家的參數不同，依下方的「參數格式」送出；服務要求的其他參數可以寫在「自訂請求參數」。',
};
function copyFrom(e) {
    const from = Number(e.target.value);
    e.target.value = '';
    if (Number.isInteger(from) && confirm(`用「${settings.sources[from].name}」的設定（服務、key、模型）覆蓋「${source.value.name}」？`)) {
        settings.copySource(from, props.index);
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(source, {});
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(message, {});
// @ts-ignore
__VLS_withDotValue(info, {});
// @ts-ignore
__VLS_withDotValue(cfg, {});
// @ts-ignore
__VLS_withDotValue(showKey, {});
// @ts-ignore
__VLS_withDotValue(known, {});
// @ts-ignore
__VLS_withDotValue(hints, {});
// @ts-ignore
__VLS_withDotValue(models, {});
// @ts-ignore
__VLS_withDotValue(loading, {});
// @ts-ignore
__VLS_withDotValue(REASONING_NOTE, {});
// @ts-ignore
__VLS_withDotValue(extraError, {});
// @ts-ignore
__VLS_withDotValue(used, {});
void {};
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['reasoning']} */ ;
/** @type {__VLS_StyleScopedClasses['reasoning']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form" },
});
/** @type {__VLS_StyleScopedClasses['form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "grow" },
});
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    maxlength: "20",
});
(source.value.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (copyFrom) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
const __VLS_0 = __VLS_tryAsConstant((settings.value.sources));
for (const [s, i] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.template)({
        key: (i),
    });
    if (i !== __VLS_ctx.index) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: (i),
        });
        (s.name);
    }
    // @ts-ignore
    [source, settings, index,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (message.value = '');
            // @ts-ignore
            [message,];
        } },
    value: (source.value.provider),
});
const __VLS_1 = __VLS_tryAsConstant((__VLS_unwrap(PROVIDERS, {})));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (p.id),
        value: (p.id),
    });
    (p.name);
    // @ts-ignore
    [source, PROVIDERS,];
}
if (info.value.needsBaseURL) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "https://.../v1",
    });
    (cfg.value.baseURL);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    const __VLS_2 = __VLS_tryAsConstant((info.value.presets));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(info.value.needsBaseURL))
                        throw 0;
                    return (cfg.value.baseURL = p.baseURL);
                    // @ts-ignore
                    [info, info, cfg, cfg,];
                } },
            key: (p.name),
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (p.name);
        // @ts-ignore
        [];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
(info.value.keyOptional ? '（選填）' : '');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: (showKey.value ? 'text' : 'password'),
    placeholder: (info.value.keyHint),
    autocomplete: "off",
    ...{ style: {} },
});
(cfg.value.apiKey);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (showKey.value = !showKey.value);
            // @ts-ignore
            [info, info, cfg, showKey, showKey, showKey,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(showKey.value ? '隱藏' : '顯示');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "field" },
});
/** @type {__VLS_StyleScopedClasses['field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (pickModel) },
    value: (known.value.includes(cfg.value.model) ? cfg.value.model : ''),
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
    disabled: true,
});
(cfg.value.model ? `自訂：${cfg.value.model}` : '選擇模型');
if (hints.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
        label: "常用",
    });
    const __VLS_3 = __VLS_tryAsConstant((hints.value));
    for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (m),
            value: (m),
        });
        (m);
        // @ts-ignore
        [cfg, cfg, cfg, cfg, showKey, known, hints, hints,];
    }
}
if (models.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
        label: (`服務提供的模型（${models.value.length}）`),
    });
    const __VLS_4 = __VLS_tryAsConstant((models.value));
    for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (m),
            value: (m),
        });
        (m);
        // @ts-ignore
        [models, models, models,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (loadModels) },
    ...{ class: "small" },
    disabled: (loading.value || (!cfg.value.apiKey && !info.value.keyOptional)),
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(loading.value ? '載入中…' : '載入模型清單');
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "或直接輸入模型名稱",
    'aria-label': "模型名稱",
});
(cfg.value.model);
if (message.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (message.value);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onInput: (onMaxTokens) },
    type: "number",
    min: "0",
    value: (cfg.value.maxTokens ?? ''),
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.fieldset, __VLS_intrinsics.fieldset)({
    ...{ class: "reasoning" },
});
/** @type {__VLS_StyleScopedClasses['reasoning']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.legend, __VLS_intrinsics.legend)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(reasoning, {})),
});
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(REASONING_LEVELS, {})));
for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (r.id),
        value: (r.id),
    });
    (r.name);
    // @ts-ignore
    [message, message, info, cfg, cfg, cfg, loading, loading, reasoning, REASONING_LEVELS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(REASONING_NOTE.value[source.value.provider]);
if (source.value.provider === 'openai_compatible') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (cfg.value.reasoningFormat),
    });
    const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(REASONING_FORMATS, {})));
    for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (f.id),
            value: (f.id === 'auto' ? undefined : f.id),
        });
        (f.name);
        // @ts-ignore
        [source, source, cfg, REASONING_NOTE, REASONING_FORMATS,];
    }
    if (!cfg.value.reasoningFormat || cfg.value.reasoningFormat === 'auto') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(guessed, {}));
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_unwrap(showThinking, {}));
if (source.value.provider === 'openai_compatible') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (cfg.value.extraBody),
        rows: "2",
        spellcheck: "false",
        placeholder: '{"reasoning": {"enabled": true}}',
    });
    if (extraError.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (extraError.value);
    }
}
if (source.value.provider === 'openai_compatible') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (cfg.value.cacheMark),
    });
    const __VLS_7 = __VLS_tryAsConstant((__VLS_unwrap(CACHE_MARKS, {})));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (c.id),
            value: (c.id === 'auto' ? undefined : c.id),
        });
        (c.name);
        // @ts-ignore
        [source, source, cfg, cfg, cfg, cfg, guessed, showThinking, extraError, extraError, CACHE_MARKS,];
    }
    if (!cfg.value.cacheMark || cfg.value.cacheMark === 'auto') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(cacheGuess, {}));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small" },
    ...{ style: ({ color: settings.value.sourceReady(__VLS_ctx.index) ? 'var(--good)' : 'var(--muted)' }) },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(settings.value.sourceReady(__VLS_ctx.index) ? '✓ 設定完成' : '尚未完成設定');
(used.value.length ? `用於：${used.value.join('、')}` : '目前沒有功能使用這個來源');
// @ts-ignore
[settings, settings, index, index, cfg, cfg, cacheGuess, used, used,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
