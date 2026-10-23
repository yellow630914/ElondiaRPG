import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useGame } from '@/stores/game';
import { useSettings } from '@/stores/settings';
import { formatTokens } from '@/narrator/describe';
import { ARCHIVE_USAGE, OTHER_USAGE, usageFeatureName, usageSourceLabel } from '@/stores/game';
import { formatTime } from '@/engine/state';
import ReportCard from './ReportCard.vue';
// 冒險頁中間的日誌：舊的在上、新的在下，有新紀錄時捲到最下面。
const PAGE = 30;
const game = useGame();
const settings = useSettings();
const hideTrade = ref(true);
const shown = ref(PAGE);
const feed = ref(null);
// token 用量分三份：目前的日誌、已封存的日誌、不屬於任何日誌的呼叫（酒館候選人、商店清單、談判方式等）
const usageSplit = computed(() => {
    const sum = (keys) => Object.entries(game.usage).filter(([k]) => keys(k)).reduce((t, [, e]) => t + e.input + e.output, 0);
    return {
        log: sum((k) => k !== OTHER_USAGE && k !== ARCHIVE_USAGE),
        archive: sum((k) => k === ARCHIVE_USAGE),
        other: sum((k) => k === OTHER_USAGE),
    };
});
// 用量明細預設收起；展開與否記在這個瀏覽器（和 FoldSection 共用 elondia.folds）
const FOLDS = 'elondia.folds';
function readFolds() {
    try {
        return JSON.parse(localStorage.getItem(FOLDS) ?? '{}');
    }
    catch {
        return {};
    }
}
const usageOpen = ref(readFolds()['log.usage'] === false);
function onUsageToggle(e) {
    usageOpen.value = e.target.open;
    try {
        const folds = readFolds();
        if (usageOpen.value)
            folds['log.usage'] = false;
        else
            delete folds['log.usage'];
        localStorage.setItem(FOLDS, JSON.stringify(folds));
    }
    catch {
        // 記不住也沒關係
    }
}
// 封存的舊日誌（只留簡述與 AI 寫的經過）：載入完目前的日誌之後才能展開
const archive = computed(() => (game.state?.logArchive ?? []).filter((e) => !(hideTrade.value && e.kind === 'trade')));
const showArchive = ref(false);
const archiveShown = ref(PAGE);
const archived = computed(() => archive.value.slice(-archiveShown.value));
const all = computed(() => (game.state?.reports ?? []).filter((r) => !(hideTrade.value && r.kind === 'trade')));
const reports = computed(() => all.value.slice(-shown.value));
const latest = computed(() => game.state?.reports.at(-1)?.report_id);
const streamingText = computed(() => (latest.value ? game.narrations[latest.value]?.text.length ?? 0 : 0));
function nearBottom() {
    const el = feed.value;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 160;
}
async function toBottom(force = false) {
    if (!force && !nearBottom())
        return;
    await nextTick();
    feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: force ? 'auto' : 'smooth' });
}
watch(latest, () => toBottom(true));
// 串流敘事時，若玩家正在看最新的內容就跟著捲動
watch(streamingText, () => toBottom());
onMounted(() => toBottom(true));
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(usageSplit, {});
// @ts-ignore
__VLS_withDotValue(usageFeatureName, {});
// @ts-ignore
__VLS_withDotValue(all, {});
// @ts-ignore
__VLS_withDotValue(reports, {});
// @ts-ignore
__VLS_withDotValue(shown, {});
// @ts-ignore
__VLS_withDotValue(archive, {});
// @ts-ignore
__VLS_withDotValue(showArchive, {});
// @ts-ignore
__VLS_withDotValue(archived, {});
// @ts-ignore
__VLS_withDotValue(archiveShown, {});
void {};
/** @type {__VLS_StyleScopedClasses['log-head']} */ ;
/** @type {__VLS_StyleScopedClasses['usage']} */ ;
/** @type {__VLS_StyleScopedClasses['usage']} */ ;
/** @type {__VLS_StyleScopedClasses['feed']} */ ;
/** @type {__VLS_StyleScopedClasses['archived']} */ ;
/** @type {__VLS_StyleScopedClasses['feed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel log" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['log']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "row log-head" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['log-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(settings.value.aiNarration);
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(__VLS_unwrap(hideTrade, {}));
if (game.value.totalUsage.calls) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ onToggle: (onUsageToggle) },
        ...{ class: "small muted usage" },
        open: (__VLS_unwrap(usageOpen, {})),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['usage']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
    (__VLS_unwrap(formatTokens, {})(game.value.totalUsage.input + game.value.totalUsage.output));
    (game.value.totalUsage.calls);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "detail" },
    });
    /** @type {__VLS_StyleScopedClasses['detail']} */ ;
    (__VLS_unwrap(formatTokens, {})(game.value.totalUsage.input));
    if (game.value.totalUsage.cached) {
        (__VLS_unwrap(formatTokens, {})(game.value.totalUsage.cached));
    }
    (__VLS_unwrap(formatTokens, {})(game.value.totalUsage.output));
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    (__VLS_unwrap(formatTokens, {})(usageSplit.value.log));
    if (usageSplit.value.archive) {
        (__VLS_unwrap(formatTokens, {})(usageSplit.value.archive));
    }
    if (usageSplit.value.other) {
        (__VLS_unwrap(formatTokens, {})(usageSplit.value.other));
    }
    if (game.value.usageBySource.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "sources" },
            title: "依模型來源（服務與模型）分開的用量",
        });
        /** @type {__VLS_StyleScopedClasses['sources']} */ ;
        const __VLS_0 = __VLS_tryAsConstant((game.value.usageBySource));
        for (const [u, i] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (i),
            });
            (__VLS_unwrap(usageSourceLabel, {})(u));
            (__VLS_unwrap(formatTokens, {})(u.input + u.output));
            (__VLS_unwrap(formatTokens, {})(u.input));
            if (u.cached) {
                (__VLS_unwrap(formatTokens, {})(u.cached));
            }
            (__VLS_unwrap(formatTokens, {})(u.output));
            (u.calls);
            if (u.features.length) {
                (u.features.map(usageFeatureName.value).join('、'));
            }
            // @ts-ignore
            [settings, hideTrade, game, game, game, game, game, game, game, game, game, game, usageOpen, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, formatTokens, usageSplit, usageSplit, usageSplit, usageSplit, usageSplit, usageSourceLabel, usageFeatureName,];
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "feed",
    ...{ class: "feed" },
});
/** @type {__VLS_StyleScopedClasses['feed']} */ ;
if (all.value.length > reports.value.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(all.value.length > reports.value.length))
                    throw 0;
                return (shown.value += __VLS_unwrap(PAGE, {}));
                // @ts-ignore
                [all, reports, shown, PAGE,];
            } },
        ...{ class: "small more" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['more']} */ ;
    (all.value.length - reports.value.length);
}
else if (archive.value.length) {
    if (!showArchive.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(all.value.length > reports.value.length))
                        throw 0;
                    if (!(archive.value.length))
                        throw 0;
                    if (!(!showArchive.value))
                        throw 0;
                    return (showArchive.value = true);
                    // @ts-ignore
                    [all, reports, archive, showArchive, showArchive,];
                } },
            ...{ class: "small more" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['more']} */ ;
        (archive.value.length);
    }
    else {
        if (archive.value.length > archived.value.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(all.value.length > reports.value.length))
                            throw 0;
                        if (!(archive.value.length))
                            throw 0;
                        if (!!(!showArchive.value))
                            throw 0;
                        if (!(archive.value.length > archived.value.length))
                            throw 0;
                        return (archiveShown.value += __VLS_unwrap(PAGE, {}));
                        // @ts-ignore
                        [PAGE, archive, archive, archived, archiveShown,];
                    } },
                ...{ class: "small more" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['more']} */ ;
            (archive.value.length - archived.value.length);
        }
        const __VLS_1 = __VLS_tryAsConstant((archived.value));
        for (const [e] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
                key: (e.id),
                ...{ class: "archived small" },
            });
            /** @type {__VLS_StyleScopedClasses['archived']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(formatTime, {})(e.time));
            if (e.scene) {
                (e.scene);
            }
            if (e.tokens) {
                (__VLS_unwrap(formatTokens, {})(e.tokens));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            (e.summary);
            if (e.story) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "story" },
                });
                /** @type {__VLS_StyleScopedClasses['story']} */ ;
                (e.story);
            }
            // @ts-ignore
            [formatTokens, archive, archived, archived, formatTime,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(all.value.length > reports.value.length))
                        throw 0;
                    if (!(archive.value.length))
                        throw 0;
                    if (!!(!showArchive.value))
                        throw 0;
                    return (showArchive.value = false);
                    // @ts-ignore
                    [showArchive,];
                } },
            ...{ class: "small more" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['more']} */ ;
    }
}
if (reports.value.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted empty" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    /** @type {__VLS_StyleScopedClasses['empty']} */ ;
}
const __VLS_2 = __VLS_tryAsConstant((reports.value));
for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
    const __VLS_3 = ReportCard;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent1(__VLS_3, new __VLS_3({
        // @ts-ignore
        key: (r.report_id), report: (r),
    }));
    const __VLS_5 = __VLS_4({
        key: (r.report_id),
        report: (r),
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    // @ts-ignore
    [reports, reports,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
