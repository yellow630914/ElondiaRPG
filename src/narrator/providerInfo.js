// AI 服務的基本資料（不含 SDK，讓設定畫面不必載入各家 SDK）。
export const CACHE_MARKS = [
    { id: 'auto', name: '自動（依模型判斷）' },
    { id: 'on', name: '標記（cache_control，約 5 分鐘）' },
    { id: 'on_1h', name: '標記，保留 1 小時（只有 Claude 支援）' },
    { id: 'off', name: '不標記（服務會自動快取時）' },
];
/** 自動判斷：Gemini、Claude（例如 OpenRouter 的 google/gemini-…、anthropic/claude-…），或百煉上的千問 */
export function guessCacheMark(config) {
    const model = config.model.toLowerCase();
    if (/gemini|claude|anthropic/.test(model))
        return true;
    return /dashscope|aliyuncs/.test(config.baseURL ?? '') && /qwen/.test(model);
}
/** 這次請求要不要標快取斷點、保留多久（只用在 OpenAI 相容格式） */
export function cacheMarkFor(provider, config) {
    if (provider !== 'openai_compatible')
        return null;
    const mark = config.cacheMark ?? 'auto';
    if (mark === 'off' || (mark === 'auto' && !guessCacheMark(config)))
        return null;
    return mark === 'on_1h' ? { ttl: '1h' } : {};
}
export const REASONING_LEVELS = [
    { id: '', name: '預設（不指定）' },
    { id: 'off', name: '關閉思考' },
    { id: 'low', name: '低' },
    { id: 'medium', name: '中' },
    { id: 'high', name: '高' },
];
export const REASONING_FORMATS = [
    { id: 'auto', name: '自動（依 Base URL 判斷）' },
    { id: 'reasoning_effort', name: 'reasoning_effort（OpenAI 寫法）' },
    { id: 'thinking', name: 'thinking.type（智譜 GLM、Kimi）' },
    { id: 'openrouter', name: 'reasoning.effort（OpenRouter）' },
    { id: 'enable_thinking', name: 'enable_thinking（通義千問）' },
    { id: 'none', name: '不送思考參數' },
];
export const PROVIDERS = [
    {
        id: 'anthropic',
        name: 'Anthropic（Claude）',
        defaultModel: 'claude-opus-5-5',
        modelHints: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
        keyHint: 'sk-ant-...',
        needsBaseURL: false,
    },
    {
        id: 'openai',
        name: 'OpenAI',
        defaultModel: '',
        modelHints: [],
        keyHint: 'sk-...',
        needsBaseURL: false,
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        defaultModel: 'gemini-flash-latest',
        modelHints: ['gemini-flash-latest', 'gemini-pro-latest'],
        keyHint: 'AIza...',
        needsBaseURL: false,
    },
    {
        id: 'openai_compatible',
        name: 'OpenAI 相容格式',
        defaultModel: '',
        modelHints: [],
        keyHint: '依服務而定；本機服務可留空',
        needsBaseURL: true,
        keyOptional: true,
        presets: [
            { name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1' },
            { name: 'DeepSeek', baseURL: 'https://api.deepseek.com' },
            { name: '智譜 GLM（BigModel）', baseURL: 'https://open.bigmodel.cn/api/paas/v4' },
            { name: '智譜 GLM（Z.ai 國際）', baseURL: 'https://api.z.ai/api/paas/v4' },
            { name: '通義千問（DashScope）', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
            { name: 'Moonshot（Kimi）', baseURL: 'https://api.moonshot.cn/v1' },
            { name: 'Ollama（本機）', baseURL: 'http://localhost:11434/v1' },
            { name: 'LM Studio（本機）', baseURL: 'http://localhost:1234/v1' },
        ],
    },
];
export function providerInfo(id) {
    return PROVIDERS.find((p) => p.id === id);
}
// ---- 思考參數（各家的寫法） ----
/** OpenAI 相容格式：依 Base URL 猜思考參數的寫法 */
export function guessReasoningFormat(baseURL = '') {
    const u = baseURL.toLowerCase();
    if (u.includes('openrouter.ai'))
        return 'openrouter';
    if (u.includes('bigmodel.cn') || u.includes('z.ai') || u.includes('moonshot'))
        return 'thinking';
    if (u.includes('dashscope'))
        return 'enable_thinking';
    if (u.includes('deepseek'))
        return 'none';
    return 'reasoning_effort';
}
/** 自訂參數（JSON 物件）；格式不對時丟出錯誤 */
export function parseExtraBody(text) {
    if (!text?.trim())
        return {};
    let v;
    try {
        v = JSON.parse(text);
    }
    catch {
        throw new Error('自訂請求參數不是有效的 JSON');
    }
    if (!v || typeof v !== 'object' || Array.isArray(v))
        throw new Error('自訂請求參數要是 JSON 物件，例如 {"thinking": {"type": "enabled"}}');
    return v;
}
/** OpenAI 與相容格式：加進請求的思考參數（加上自訂參數） */
export function openAIReasoningBody(provider, config) {
    const level = config.reasoning;
    const show = config.showThinking !== false;
    let body = {};
    if (provider === 'openai') {
        // OpenAI 的 Chat Completions 不回傳思考內容，只能調強度
        if (level)
            body = { reasoning_effort: level === 'off' ? 'minimal' : level };
        return body;
    }
    const format = !config.reasoningFormat || config.reasoningFormat === 'auto' ? guessReasoningFormat(config.baseURL) : config.reasoningFormat;
    switch (format) {
        case 'reasoning_effort':
            if (level && level !== 'off')
                body = { reasoning_effort: level };
            break;
        case 'thinking':
            if (level)
                body = { thinking: { type: level === 'off' ? 'disabled' : 'enabled' } };
            break;
        case 'openrouter':
            if (level === 'off')
                body = { reasoning: { enabled: false } };
            else if (level)
                body = { reasoning: { effort: level, ...(show ? {} : { exclude: true }) } };
            else if (!show)
                body = { reasoning: { exclude: true } };
            break;
        case 'enable_thinking':
            if (level)
                body = { enable_thinking: level !== 'off' };
            break;
    }
    return { ...body, ...parseExtraBody(config.extraBody) };
}
/** Claude：自適應思考的模型（Claude 5 系列、4.6 之後） */
const CLAUDE_ADAPTIVE = /claude-(opus|sonnet|haiku|fable|mythos)-(5|4-[6-9])/;
/** 預設就會思考的模型（Claude 5 系列） */
const CLAUDE_THINKS_BY_DEFAULT = /claude-(opus|sonnet|haiku|fable|mythos)-5/;
/** 不能關閉思考的模型 */
const CLAUDE_ALWAYS_THINKS = /claude-(opus-5-5|fable|mythos)/;
const CLAUDE_BUDGET = { low: 2048, medium: 8192, high: 16384 };
/** Claude：思考的參數（thinking、output_config.effort）；回傳空物件時不送 */
export function anthropicThinking(config) {
    const level = config.reasoning;
    const show = config.showThinking !== false;
    const model = config.model;
    if (CLAUDE_ADAPTIVE.test(model)) {
        if (level === 'off')
            return CLAUDE_ALWAYS_THINKS.test(model) ? {} : { thinking: { type: 'disabled' } };
        // 思考內容預設不回傳（display: omitted），要顯示時要求摘要
        const thinking = level || CLAUDE_THINKS_BY_DEFAULT.test(model) ? { thinking: { type: 'adaptive', display: show ? 'summarized' : 'omitted' } } : {};
        return { ...thinking, ...(level ? { output_config: { effort: level } } : {}) };
    }
    // 舊的模型：指定思考的預算（要小於 max_tokens）
    if (!level || level === 'off')
        return {};
    return { thinking: { type: 'enabled', budget_tokens: CLAUDE_BUDGET[level] } };
}
const GEMINI_BUDGET = { off: 0, low: 1024, medium: 8192, high: 24576 };
/** Gemini：thinkingConfig（includeThoughts 回傳思考摘要；Gemini 3 用 thinkingLevel） */
export function geminiThinking(config) {
    const level = config.reasoning;
    const show = config.showThinking !== false;
    if (!level && !show)
        return undefined;
    const out = {};
    if (show && level !== 'off')
        out.includeThoughts = true;
    if (level) {
        if (/gemini-3/.test(config.model))
            out.thinkingLevel = level === 'high' || level === 'medium' ? 'high' : 'low';
        else
            out.thinkingBudget = GEMINI_BUDGET[level];
    }
    return Object.keys(out).length ? out : undefined;
}
