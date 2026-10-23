/// <reference types="../../../../../root/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../root/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref } from 'vue';
import { locationById } from '@/engine/data';
import { formatTime } from '@/engine/state';
import { actorNames, describeChanges, describeCheck, describeEntry, formatTokens } from '@/narrator/describe';
import { visibleNarration } from '@/narrator/judge';
import { usageFeatureName, usageSourceLabel, useGame } from '@/stores/game';
import { inventedIn } from '@/engine/invention';
import { useSettings } from '@/stores/settings';
const { defineProps, } = {};
const props = defineProps();
const game = useGame();
const settings = useSettings();
const KIND_NAME = {
    travel: '🧳 旅行', combat: '⚔️ 戰鬥', action: '🎲 行動', event: '✨ 事件', quest: '📜 委託', rest: '🛏️ 休息', trade: '🪙 交易', social: '💬 交流',
};
const entry = computed(() => game.narrations[props.report.report_id]);
// 只存了判定的思考過程的空項目不算敘事
const narration = computed(() => (entry.value?.placeholder ? undefined : entry.value));
const thinking = computed(() => [
    ...(entry.value?.judgeThinking ? [{ label: '判定', text: entry.value.judgeThinking }] : []),
    ...(entry.value?.thinking ? [{ label: '敘事', text: entry.value.thinking }] : []),
]);
// 關閉 AI 細節描述時不顯示敘事，改顯示戰報或事件簡述（已生成的敘事仍保留，重新開啟後會再出現）
// AI 判定的主動行動：AI 直接寫出的經過一律顯示
const showStory = computed(() => !!narration.value && (settings.aiNarration || !!narration.value.manual || props.report.check?.source === 'ai'));
const showBattleReport = computed(() => props.report.kind === 'combat' && !showStory.value && !!props.report.timeline?.length);
const names = computed(() => actorNames(props.report));
const changes = computed(() => describeChanges(props.report));
const check = computed(() => describeCheck(props.report));
const tokens = computed(() => game.usage[props.report.report_id]);
// 自創配方做出來的東西：可以改名（AI 取的名字不喜歡時）
const invented = computed(() => (game.state ? inventedIn(game.state, props.report) : undefined));
function renameInvented() {
    const from = invented.value;
    if (!from)
        return;
    const to = prompt('幫自創的物品取個名字（配方也跟著改）', from);
    if (to && to.trim() !== from) {
        const name = game.renameInvention(from, to);
        if (name)
            game.flash(`✏️ 改名為「${name}」`);
    }
}
const showRaw = ref(false);
const copied = ref(false);
async function copyPrompt() {
    const p = await game.promptFor(props.report);
    await navigator.clipboard.writeText(`${p.system}\n\n---\n\n${p.user}`);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
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
__VLS_withDotValue(KIND_NAME, {});
// @ts-ignore
__VLS_withDotValue(invented, {});
// @ts-ignore
__VLS_withDotValue(check, {});
// @ts-ignore
__VLS_withDotValue(thinking, {});
// @ts-ignore
__VLS_withDotValue(narration, {});
// @ts-ignore
__VLS_withDotValue(showStory, {});
// @ts-ignore
__VLS_withDotValue(showBattleReport, {});
// @ts-ignore
__VLS_withDotValue(changes, {});
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(copied, {});
// @ts-ignore
__VLS_withDotValue(showRaw, {});
// @ts-ignore
__VLS_withDotValue(tokens, {});
void {};
/** @type {__VLS_StyleScopedClasses['thinking']} */ ;
/** @type {__VLS_StyleScopedClasses['battle-report']} */ ;
/** @type {__VLS_StyleScopedClasses['timeline']} */ ;
/** @type {__VLS_StyleScopedClasses['tokens']} */ ;
/** @type {__VLS_StyleScopedClasses['tokens']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "row" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "tag" },
});
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
(KIND_NAME.value[__VLS_ctx.report.kind]);
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
(__VLS_unwrap(locationById, {})(__VLS_ctx.report.location.at).name);
if (__VLS_ctx.report.location.to) {
    (__VLS_unwrap(locationById, {})(__VLS_ctx.report.location.to).name);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(formatTime, {})(__VLS_ctx.report.time.start));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
(__VLS_ctx.report.outcome.summary);
if (invented.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (renameInvented) },
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (invented.value);
}
if (check.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small check" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    (check.value);
    if (__VLS_ctx.report.check?.twist) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.report.check.twist);
    }
    if (__VLS_ctx.report.check?.rationale) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_ctx.report.check.rationale);
    }
}
if (thinking.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "thinking small" },
    });
    /** @type {__VLS_StyleScopedClasses['thinking']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    (thinking.value.map((t) => t.label).join('、'));
    if (narration.value?.status === 'streaming' && !narration.value.text) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    const __VLS_0 = __VLS_tryAsConstant((thinking.value));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (t.label),
            ...{ class: "thought" },
        });
        /** @type {__VLS_StyleScopedClasses['thought']} */ ;
        if (thinking.value.length > 1) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
            (t.label);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
        (t.text);
        // @ts-ignore
        [KIND_NAME, report, report, report, report, report, report, report, report, report, report, locationById, locationById, formatTime, invented, invented, check, check, thinking, thinking, thinking, thinking, narration, narration,];
    }
}
if (showStory.value && narration.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "story" },
    });
    /** @type {__VLS_StyleScopedClasses['story']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "narration" },
    });
    /** @type {__VLS_StyleScopedClasses['narration']} */ ;
    (__VLS_unwrap(visibleNarration, {})(narration.value.text));
    if (narration.value.status === 'streaming') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "cursor" },
        });
        /** @type {__VLS_StyleScopedClasses['cursor']} */ ;
    }
    if (narration.value.status === 'error') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (narration.value.error);
    }
}
if (showBattleReport.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "battle-report" },
    });
    /** @type {__VLS_StyleScopedClasses['battle-report']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small timeline" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['timeline']} */ ;
    const __VLS_1 = __VLS_tryAsConstant((__VLS_ctx.report.timeline));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (t.seq),
        });
        (__VLS_unwrap(describeEntry, {})(t, __VLS_unwrap(names, {})));
        // @ts-ignore
        [report, narration, narration, narration, narration, narration, showStory, visibleNarration, showBattleReport, describeEntry, names,];
    }
}
else if (__VLS_ctx.report.timeline?.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_ctx.report.timeline.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small timeline" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['timeline']} */ ;
    const __VLS_2 = __VLS_tryAsConstant((__VLS_ctx.report.timeline));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (t.seq),
        });
        (__VLS_unwrap(describeEntry, {})(t, __VLS_unwrap(names, {})));
        // @ts-ignore
        [report, report, report, describeEntry, names,];
    }
}
if (changes.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small changes" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['changes']} */ ;
    const __VLS_3 = __VLS_tryAsConstant((changes.value));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (c),
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (c);
        // @ts-ignore
        [changes, changes,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row actions" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
if (settings.value.ready('narration')) {
    if (narration.value?.status !== 'streaming') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(settings.value.ready('narration')))
                        throw 0;
                    if (!(narration.value?.status !== 'streaming'))
                        throw 0;
                    return (game.value.narrate(__VLS_ctx.report, { manual: !settings.value.aiNarration }));
                    // @ts-ignore
                    [report, narration, settings, settings, game,];
                } },
            ...{ class: "small" },
            title: "用「敘事正文」的模型寫出這則日誌的經過",
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (showStory.value ? '重新寫出經過' : '寫出經過');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(settings.value.ready('narration')))
                        throw 0;
                    if (!!(narration.value?.status !== 'streaming'))
                        throw 0;
                    return (game.value.cancelNarration(__VLS_ctx.report.report_id));
                    // @ts-ignore
                    [report, showStory, game,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
}
else if (settings.value.aiNarration) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (copyPrompt) },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(copied.value ? '已複製' : '複製提示詞');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (showRaw.value = !showRaw.value);
            // @ts-ignore
            [settings, copied, showRaw, showRaw,];
        } },
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(showRaw.value ? '隱藏' : '顯示');
if (showRaw.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "raw small" },
    });
    /** @type {__VLS_StyleScopedClasses['raw']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (JSON.stringify(__VLS_ctx.report, null, 2));
}
if (tokens.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "small muted tokens" },
        title: "這則日誌的 AI 呼叫（判定、敘事）用掉的 token",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['tokens']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    (__VLS_unwrap(formatTokens, {})(tokens.value.input + tokens.value.output));
    if (tokens.value.calls > 1) {
        (tokens.value.calls);
    }
    (__VLS_unwrap(formatTokens, {})(tokens.value.input));
    if (tokens.value.cached) {
        (__VLS_unwrap(formatTokens, {})(tokens.value.cached));
    }
    (__VLS_unwrap(formatTokens, {})(tokens.value.output));
    const __VLS_4 = __VLS_tryAsConstant((tokens.value.by ?? []));
    for (const [p, i] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.template)({
            key: (i),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "origin" },
        });
        /** @type {__VLS_StyleScopedClasses['origin']} */ ;
        (__VLS_unwrap(usageFeatureName, {})(p.feature));
        (__VLS_unwrap(usageSourceLabel, {})(p));
        (__VLS_unwrap(formatTokens, {})(p.input));
        if (p.cached) {
            (__VLS_unwrap(formatTokens, {})(p.cached));
        }
        (__VLS_unwrap(formatTokens, {})(p.output));
        if (p.calls > 1) {
            (p.calls);
        }
        // @ts-ignore
        [report, showRaw, showRaw, tokens, tokens, tokens, tokens, tokens, tokens, tokens, tokens, tokens, tokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, usageFeatureName, usageSourceLabel,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
