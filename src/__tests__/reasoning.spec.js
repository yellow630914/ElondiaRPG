import { describe, expect, it } from 'vitest';
import { anthropicThinking, cacheMarkFor, geminiThinking, guessReasoningFormat, openAIReasoningBody, } from '@/narrator/providerInfo';
import { openAIMessages } from '@/narrator/providers';
const cfg = (patch) => ({ apiKey: 'k', model: 'm', ...patch });
describe('reasoning parameters', () => {
    it('guesses the thinking format of OpenAI-compatible services from the base URL', () => {
        expect(guessReasoningFormat('https://open.bigmodel.cn/api/paas/v4')).toBe('thinking');
        expect(guessReasoningFormat('https://api.z.ai/api/paas/v4')).toBe('thinking');
        expect(guessReasoningFormat('https://openrouter.ai/api/v1')).toBe('openrouter');
        expect(guessReasoningFormat('https://dashscope.aliyuncs.com/compatible-mode/v1')).toBe('enable_thinking');
        expect(guessReasoningFormat('http://localhost:11434/v1')).toBe('reasoning_effort');
    });
    it('builds the request fields for GLM, OpenRouter and custom JSON', () => {
        const glm = cfg({ baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4.6' });
        expect(openAIReasoningBody('openai_compatible', glm)).toEqual({});
        expect(openAIReasoningBody('openai_compatible', { ...glm, reasoning: 'high' })).toEqual({ thinking: { type: 'enabled' } });
        expect(openAIReasoningBody('openai_compatible', { ...glm, reasoning: 'off' })).toEqual({ thinking: { type: 'disabled' } });
        const or = cfg({ baseURL: 'https://openrouter.ai/api/v1' });
        expect(openAIReasoningBody('openai_compatible', { ...or, reasoning: 'medium' })).toEqual({ reasoning: { effort: 'medium' } });
        expect(openAIReasoningBody('openai_compatible', { ...or, reasoning: 'off' })).toEqual({ reasoning: { enabled: false } });
        // 指定格式，加上自訂參數
        expect(openAIReasoningBody('openai_compatible', { ...or, reasoningFormat: 'reasoning_effort', reasoning: 'low', extraBody: '{"top_k": 20}' }))
            .toEqual({ reasoning_effort: 'low', top_k: 20 });
        expect(() => openAIReasoningBody('openai_compatible', { ...or, extraBody: '{oops' })).toThrow('JSON');
        expect(openAIReasoningBody('openai', cfg({ reasoning: 'high' }))).toEqual({ reasoning_effort: 'high' });
    });
    it('uses adaptive thinking with summaries on new Claude models and budgets on old ones', () => {
        expect(anthropicThinking(cfg({ model: 'claude-opus-5-5' }))).toEqual({ thinking: { type: 'adaptive', display: 'summarized' } });
        expect(anthropicThinking(cfg({ model: 'claude-opus-5-5', reasoning: 'high', showThinking: false })))
            .toEqual({ thinking: { type: 'adaptive', display: 'omitted' }, output_config: { effort: 'high' } });
        // Opus 5.5 不能關閉思考：不送 disabled
        expect(anthropicThinking(cfg({ model: 'claude-opus-5-5', reasoning: 'off' }))).toEqual({});
        expect(anthropicThinking(cfg({ model: 'claude-sonnet-5-5', reasoning: 'off' }))).toEqual({ thinking: { type: 'disabled' } });
        expect(anthropicThinking(cfg({ model: 'claude-opus-4-7' }))).toEqual({});
        expect(anthropicThinking(cfg({ model: 'claude-sonnet-4-5', reasoning: 'medium' }))).toEqual({ thinking: { type: 'enabled', budget_tokens: 8192 } });
    });
    it('asks Gemini for thought summaries and a budget or level', () => {
        expect(geminiThinking(cfg({ model: 'gemini-flash-latest' }))).toEqual({ includeThoughts: true });
        expect(geminiThinking(cfg({ model: 'gemini-2.5-flash', reasoning: 'off' }))).toEqual({ thinkingBudget: 0 });
        expect(geminiThinking(cfg({ model: 'gemini-3-pro', reasoning: 'high', showThinking: false }))).toEqual({ thinkingLevel: 'high' });
    });
});
describe('prompt cache marks', () => {
    const prompt = { system: '規則與常駐世界書', user: '這次的事件' };
    const or = (model, cacheMark) => ({ apiKey: 'k', model, baseURL: 'https://openrouter.ai/api/v1', ...(cacheMark ? { cacheMark } : {}) });
    it('marks Gemini and Claude on OpenAI-compatible services automatically, not DeepSeek', () => {
        expect(cacheMarkFor('openai_compatible', or('google/gemini-2.5-flash'))).toEqual({});
        expect(cacheMarkFor('openai_compatible', or('anthropic/claude-sonnet-5-5'))).toEqual({});
        expect(cacheMarkFor('openai_compatible', or('deepseek/deepseek-chat'))).toBeNull();
        expect(cacheMarkFor('openai_compatible', { apiKey: 'k', model: 'qwen-plus', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' })).toEqual({});
        // 手動設定蓋過自動判斷；OpenAI 與其他格式不標
        expect(cacheMarkFor('openai_compatible', or('deepseek/deepseek-chat', 'on'))).toEqual({});
        expect(cacheMarkFor('openai_compatible', or('google/gemini-2.5-pro', 'off'))).toBeNull();
        expect(cacheMarkFor('openai_compatible', or('anthropic/claude-opus-5', 'on_1h'))).toEqual({ ttl: '1h' });
        expect(cacheMarkFor('openai', { apiKey: 'k', model: 'gpt-5', cacheMark: 'on' })).toBeNull();
    });
    it('puts the breakpoint at the end of the system message', () => {
        const marked = openAIMessages('openai_compatible', or('google/gemini-2.5-flash'), prompt);
        expect(marked[0]).toEqual({ role: 'system', content: [{ type: 'text', text: '規則與常駐世界書', cache_control: { type: 'ephemeral' } }] });
        expect(marked[1]).toEqual({ role: 'user', content: '這次的事件' });
        const plain = openAIMessages('openai_compatible', or('deepseek/deepseek-chat'), prompt);
        expect(plain[0]).toEqual({ role: 'system', content: '規則與常駐世界書' });
        const hour = openAIMessages('openai_compatible', or('anthropic/claude-opus-5', 'on_1h'), prompt);
        expect(hour[0].content[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
    });
});
