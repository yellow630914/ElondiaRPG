import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import PromptSetBar from './PromptSetBar.vue';
import { LORE_STATUS_NAME } from '@/narrator/lore';
import { estimateTokens } from '@/narrator/promptConfig';
import { DEFAULT_DEFEAT_RULES, DEFAULT_NARRATION_RULES, DEFAULT_SCENE_RULES } from '@/narrator/prompt';
import { useGame } from '@/stores/game';
import { usePrompts } from '@/stores/prompts';
import { useSettings } from '@/stores/settings';
import PromptEntryList from './PromptEntryList.vue';
import { dateStamp, download } from './download';
const SUBS = [
    { id: 'rules', label: '📜 敘事規則' },
    { id: 'styles', label: '🎨 文風' },
    { id: 'lore', label: '📚 世界書' },
    { id: 'custom', label: '🧩 其他提示詞' },
    { id: 'data', label: '🔍 注入資料' },
    { id: 'preview', label: '👁️ 預覽' },
];
const MODES = [
    { id: 'constant', label: '常駐' },
    { id: 'keyword', label: '關鍵字觸發' },
    { id: 'travel', label: '旅行報告' },
    { id: 'off', label: '停用' },
];
const game = useGame();
const prompts = usePrompts();
const settings = useSettings();
const sub = ref('rules');
// ---- 預覽依據：哪一則日誌（敘事）、等待中的行動或範例行動（判定） ----
const reports = computed(() => [...(game.state?.reports ?? [])].reverse().slice(0, 30));
const reportId = ref('');
watch(reports, (list) => {
    if (!list.some((r) => r.report_id === reportId.value))
        reportId.value = list[0]?.report_id ?? '';
}, { immediate: true });
const report = computed(() => reports.value.find((r) => r.report_id === reportId.value));
const narration = shallowRef(null);
const judge = shallowRef(null);
const loading = ref(true);
let seq = 0;
async function refresh() {
    const n = ++seq;
    await prompts.ensureLoaded();
    const r = report.value;
    const [a, b] = await Promise.all([r ? game.composeFor(r) : Promise.resolve(null), game.composeJudgePreview()]);
    if (n !== seq)
        return;
    narration.value = a;
    judge.value = b;
    loading.value = false;
}
onMounted(refresh);
let timer;
watch(() => [JSON.stringify(prompts.config), settings.adult, settings.loreBudget, settings.language, reportId.value, game.state?.reports.length, game.state?.pendingAction?.id, game.state?.relationships, game.state?.memories], () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 250);
}, { deep: true });
// ---- 敘事規則 ----
// 沒有修改時存成 undefined（跟著預設走，之後更新遊戲時會拿到新的預設）
const rulesText = computed({
    get: () => prompts.config.narrationRules ?? DEFAULT_NARRATION_RULES,
    set: (v) => {
        // 清空時暫時保留空白（方便整段重寫），送出時用預設；重新載入後恢復成預設
        if (v === DEFAULT_NARRATION_RULES)
            delete prompts.config.narrationRules;
        else
            prompts.config.narrationRules = v;
    },
});
const rulesEdited = computed(() => prompts.config.narrationRules !== undefined);
// 戰敗事件規則（成人向）：同樣可以修改、恢復預設
const defeatText = computed({
    get: () => prompts.config.defeatRules ?? DEFAULT_DEFEAT_RULES,
    set: (v) => {
        if (v === DEFAULT_DEFEAT_RULES)
            delete prompts.config.defeatRules;
        else
            prompts.config.defeatRules = v;
    },
});
const defeatEdited = computed(() => prompts.config.defeatRules !== undefined);
function restoreDefeat() {
    if (confirm('把戰敗事件規則恢復成預設？你的修改會消失。'))
        delete prompts.config.defeatRules;
}
// 成人場景規則：娼館、主人的邀約、戰敗事件的遭遇等親密場景，要求在正文詳細描寫
const sceneText = computed({
    get: () => prompts.config.sceneRules ?? DEFAULT_SCENE_RULES,
    set: (v) => {
        if (v === DEFAULT_SCENE_RULES)
            delete prompts.config.sceneRules;
        else
            prompts.config.sceneRules = v;
    },
});
const sceneEdited = computed(() => prompts.config.sceneRules !== undefined);
function restoreScene() {
    if (confirm('把成人場景規則恢復成預設？你的修改會消失。'))
        delete prompts.config.sceneRules;
}
function restoreRules() {
    if (confirm('把敘事規則恢復成預設？你的修改會消失。'))
        delete prompts.config.narrationRules;
}
// ---- 世界書 ----
const loreBasis = ref('narration');
const selection = computed(() => (loreBasis.value === 'judge' ? judge.value?.lore : narration.value?.lore));
const loreFilter = ref('all');
const loreSort = ref('position');
const loreSearch = ref('');
const openLore = ref(null);
const loreRows = computed(() => {
    const states = selection.value?.states ?? {};
    const q = loreSearch.value.trim();
    const rows = prompts.items
        .map((it) => ({ it, st: states[it.uid] }))
        .filter(({ it, st }) => {
        if (q && !it.comment.includes(q) && !it.keys.some((k) => k.includes(q)) && !it.content.includes(q))
            return false;
        if (loreFilter.value === 'injected')
            return !!st?.position;
        if (loreFilter.value === 'off')
            return it.mode === 'off';
        return true;
    });
    if (loreSort.value === 'position') {
        rows.sort((a, b) => (a.st?.position ?? 9999) - (b.st?.position ?? 9999) || a.it.order - b.it.order || a.it.uid - b.it.uid);
    }
    return rows;
});
const loreSummary = computed(() => {
    const s = selection.value;
    if (!s)
        return '';
    const sum = (l) => l.reduce((t, e) => t + e.content.length, 0);
    return `常駐 ${s.constant.length} 條（${sum(s.constant)} 字，放在前段）・觸發 ${s.triggered.length} 條（${sum(s.triggered)} 字，放在後段）・合計 ${s.chars} / ${settings.loreBudget} 字`;
});
function keysText(it) {
    return it.keys.join('、');
}
function setKeys(it, text) {
    prompts.updateLore(it.uid, { keys: text.split(/[,，、\s]+/).map((k) => k.trim()).filter(Boolean) });
}
function inputValue(e) {
    return e.target.value;
}
const loreInput = ref(null);
async function exportLore() {
    download(`elondia-worldbook-${dateStamp()}.json`, await prompts.exportLore());
}
async function onImportLore(e) {
    const input = e.target;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const total = { added: 0, updated: 0, skipped: 0 };
    try {
        for (const f of files) {
            const r = await prompts.importLore(await f.text());
            total.added += r.added;
            total.updated += r.updated;
            total.skipped += r.skipped;
        }
        game.flash(`世界書：新增 ${total.added} 條、更新 ${total.updated} 條${total.skipped ? `、略過 ${total.skipped} 條（已存在）` : ''}`);
    }
    catch (err) {
        game.error = `匯入世界書失敗：${err instanceof Error ? err.message : String(err)}`;
    }
}
function addLore() {
    openLore.value = prompts.addLore().uid;
    loreFilter.value = 'all';
    loreSearch.value = '';
}
function removeLore(it) {
    if (confirm(`刪除「${it.comment}」？`))
        prompts.removeLore(it.uid);
}
// ---- 注入資料與預覽 ----
function section(c, key) {
    return c?.prompt.sections?.find((s) => s.key === key);
}
const injected = computed(() => [
    { title: '🧝 主角設定', note: '敘事請求', s: section(narration.value, 'protagonist') },
    { title: '🧝 主角（判定用）', note: '判定請求：含屬性、技能、金錢、契約', s: section(judge.value, 'actor') },
    { title: '👥 隊伍狀態', note: '判定請求；敘事請求的隊伍狀態在報告裡', s: section(judge.value, 'party') },
    { title: '🎒 行囊', note: '判定請求：用到行囊裡的道具時，AI 可以當成助力', s: section(judge.value, 'inventory') },
    { title: '💞 人際關係與冒險記憶（敘事）', note: '依這則日誌的參與人、地點與時間檢索', s: section(narration.value, 'context') },
    { title: '💞 人際關係與冒險記憶（判定）', note: '隊伍全員與行動對象，加上目前地點', s: section(judge.value, 'context') },
]);
const previewKind = ref('narration');
const preview = computed(() => (previewKind.value === 'narration' ? narration.value : judge.value));
const previewSections = computed(() => preview.value?.prompt.sections ?? []);
const totals = computed(() => {
    const t = { system: 0, user: 0, systemChars: 0, userChars: 0 };
    for (const s of previewSections.value) {
        t[s.part] += estimateTokens(s.text);
        t[s.part === 'system' ? 'systemChars' : 'userChars'] += s.text.length;
    }
    return t;
});
const expanded = ref({});
async function copyPreview() {
    const p = preview.value?.prompt;
    if (!p)
        return;
    try {
        await navigator.clipboard.writeText(`[system]\n${p.system}\n\n[user]\n${p.user}`);
        game.flash('已複製提示詞');
    }
    catch {
        game.flash('瀏覽器不允許複製');
    }
}
// ---- 匯出、匯入、重設 ----
const fileInput = ref(null);
function exportConfig() {
    download(`elondia-prompts-${dateStamp()}.json`, prompts.exportConfig());
}
async function onImport(e) {
    const input = e.target;
    const f = input.files?.[0];
    input.value = '';
    if (!f)
        return;
    try {
        prompts.importConfig(await f.text());
        game.flash('已匯入全部提示詞設定');
    }
    catch (err) {
        game.error = `匯入失敗：${err instanceof Error ? err.message : String(err)}`;
    }
}
function resetAll() {
    if (confirm('把敘事規則、戰敗事件規則、文風、其他提示詞與世界書的修改全部恢復成預設值？'))
        prompts.resetAll();
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(sub, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(rulesEdited, {});
// @ts-ignore
__VLS_withDotValue(rulesText, {});
// @ts-ignore
__VLS_withDotValue(defeatEdited, {});
// @ts-ignore
__VLS_withDotValue(sceneEdited, {});
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(prompts, {});
// @ts-ignore
__VLS_withDotValue(loreInput, {});
// @ts-ignore
__VLS_withDotValue(judge, {});
// @ts-ignore
__VLS_withDotValue(loreSummary, {});
// @ts-ignore
__VLS_withDotValue(LORE_STATUS_NAME, {});
// @ts-ignore
__VLS_withDotValue(openLore, {});
// @ts-ignore
__VLS_withDotValue(preview, {});
// @ts-ignore
__VLS_withDotValue(loading, {});
// @ts-ignore
__VLS_withDotValue(previewKind, {});
// @ts-ignore
__VLS_withDotValue(narration, {});
// @ts-ignore
__VLS_withDotValue(report, {});
// @ts-ignore
__VLS_withDotValue(totals, {});
// @ts-ignore
__VLS_withDotValue(expanded, {});
// @ts-ignore
__VLS_withDotValue(fileInput, {});
void {};
/** @type {__VLS_StyleScopedClasses['subs']} */ ;
/** @type {__VLS_StyleScopedClasses['basis']} */ ;
/** @type {__VLS_StyleScopedClasses['lore']} */ ;
/** @type {__VLS_StyleScopedClasses['lore']} */ ;
/** @type {__VLS_StyleScopedClasses['name']} */ ;
/** @type {__VLS_StyleScopedClasses['status']} */ ;
/** @type {__VLS_StyleScopedClasses['status']} */ ;
/** @type {__VLS_StyleScopedClasses['status']} */ ;
/** @type {__VLS_StyleScopedClasses['off']} */ ;
/** @type {__VLS_StyleScopedClasses['status']} */ ;
/** @type {__VLS_StyleScopedClasses['status']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['check']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['defeat-head']} */ ;
/** @type {__VLS_StyleScopedClasses['sections']} */ ;
/** @type {__VLS_StyleScopedClasses['sections']} */ ;
/** @type {__VLS_StyleScopedClasses['sections']} */ ;
/** @type {__VLS_StyleScopedClasses['sections']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['system']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "prompts" },
});
/** @type {__VLS_StyleScopedClasses['prompts']} */ ;
const __VLS_0 = PromptSetBar;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
// @ts-ignore
}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "subs row" },
});
/** @type {__VLS_StyleScopedClasses['subs']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
const __VLS_5 = __VLS_tryAsConstant((__VLS_unwrap(SUBS, {})));
for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (sub.value = t.id);
                // @ts-ignore
                [SUBS, sub,];
            } },
        key: (t.id),
        ...{ class: ({ active: sub.value === t.id }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    (t.label);
    // @ts-ignore
    [sub,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "small basis" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['basis']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(reportId, {})),
    });
    const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(reports, {})));
    for (const [r] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (r.report_id),
            value: (r.report_id),
        });
        (r.time.start.day);
        (r.outcome.summary?.slice(0, 24) || r.kind);
        // @ts-ignore
        [game, reportId, reports,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted order-note" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['order-note']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
if (sub.value === 'rules') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    if (rulesEdited.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "spacer" },
    });
    /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (restoreRules) },
        ...{ class: "small" },
        disabled: (!rulesEdited.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (rulesText.value),
        ...{ class: "rules" },
        rows: "22",
        spellcheck: "false",
    });
    /** @type {__VLS_StyleScopedClasses['rules']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (rulesText.value.length);
    (__VLS_unwrap(estimateTokens, {})(rulesText.value));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row defeat-head" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['defeat-head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    if (defeatEdited.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "spacer" },
    });
    /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (restoreDefeat) },
        ...{ class: "small" },
        disabled: (!defeatEdited.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (__VLS_unwrap(defeatText, {})),
        ...{ class: "rules" },
        rows: "9",
        spellcheck: "false",
    });
    /** @type {__VLS_StyleScopedClasses['rules']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row defeat-head" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['defeat-head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    if (sceneEdited.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "spacer" },
    });
    /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (restoreScene) },
        ...{ class: "small" },
        disabled: (!sceneEdited.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (__VLS_unwrap(sceneText, {})),
        ...{ class: "rules" },
        rows: "9",
        spellcheck: "false",
    });
    /** @type {__VLS_StyleScopedClasses['rules']} */ ;
}
else if (sub.value === 'styles') {
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
    const __VLS_7 = PromptEntryList;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        // @ts-ignore
        list: "styles",
    }));
    const __VLS_9 = __VLS_8({
        list: "styles",
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
}
else if (sub.value === 'custom') {
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    const __VLS_12 = PromptEntryList;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        // @ts-ignore
        list: "custom",
    }));
    const __VLS_14 = __VLS_13({
        list: "custom",
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
}
else if (sub.value === 'lore') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row settings small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['settings']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "2000",
        step: "1000",
        ...{ style: {} },
    });
    (settings.value.loreBudget);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (settings.value.adult);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (prompts.value.config.loreInJudge);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (addLore) },
        ...{ class: "small primary" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (exportLore) },
        ...{ class: "small" },
        title: "SillyTavern 世界書格式，含修改與新增的條目",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(sub.value === 'rules'))
                    throw 0;
                if (!!(sub.value === 'styles'))
                    throw 0;
                if (!!(sub.value === 'custom'))
                    throw 0;
                if (!(sub.value === 'lore'))
                    throw 0;
                return (loreInput.value?.click());
                // @ts-ignore
                [sub, sub, sub, sub, rulesEdited, rulesEdited, rulesText, rulesText, rulesText, estimateTokens, defeatEdited, defeatEdited, defeatText, sceneEdited, sceneEdited, sceneText, settings, settings, prompts, loreInput,];
            } },
        ...{ class: "small" },
        title: "SillyTavern 世界書，或本遊戲匯出的世界書",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: (onImportLore) },
        ref: "loreInput",
        type: "file",
        accept: ".json,application/json",
        multiple: true,
        hidden: true,
    });
    if (settings.value.adult) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: "narration",
    });
    (__VLS_unwrap(loreBasis, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: "judge",
        disabled: (!prompts.value.config.loreInJudge),
    });
    (__VLS_unwrap(loreBasis, {}));
    (judge.value?.sample ? '範例行動' : '等待中的行動');
    if (!game.value.state) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (loreSummary.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (loreSummary.value);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        placeholder: "搜尋名稱、關鍵字或內容",
        ...{ style: {} },
    });
    (__VLS_unwrap(loreSearch, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(loreFilter, {})),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "all",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "injected",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "off",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_unwrap(loreSort, {})),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "position",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "order",
    });
    if (!prompts.value.items.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain lore" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    /** @type {__VLS_StyleScopedClasses['lore']} */ ;
    const __VLS_17 = __VLS_tryAsConstant((__VLS_unwrap(loreRows, {})));
    for (const [{ it, st }] of __VLS_vFor(__VLS_nonNull(__VLS_17))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (it.uid),
            ...{ class: ({ off: it.mode === 'off' }) },
        });
        /** @type {__VLS_StyleScopedClasses['off']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row head" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        /** @type {__VLS_StyleScopedClasses['head']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "pos small" },
        });
        /** @type {__VLS_StyleScopedClasses['pos']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (st?.position ? `#${st.position}` : '—');
        if (st) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag status" },
                ...{ class: (st.status) },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            /** @type {__VLS_StyleScopedClasses['status']} */ ;
            (LORE_STATUS_NAME.value[st.status]);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(sub.value === 'rules'))
                        throw 0;
                    if (!!(sub.value === 'styles'))
                        throw 0;
                    if (!!(sub.value === 'custom'))
                        throw 0;
                    if (!(sub.value === 'lore'))
                        throw 0;
                    return (openLore.value = openLore.value === it.uid ? null : it.uid);
                    // @ts-ignore
                    [game, settings, prompts, prompts, loreBasis, loreBasis, judge, loreSummary, loreSummary, loreSearch, loreFilter, loreSort, loreRows, LORE_STATUS_NAME, openLore, openLore,];
                } },
            ...{ class: "name" },
        });
        /** @type {__VLS_StyleScopedClasses['name']} */ ;
        (it.comment);
        if (st?.hit) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (st.hit);
        }
        if (!it.builtin) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        }
        else if (it.edited) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        }
        if (it.adult) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "spacer" },
        });
        /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(sub.value === 'rules'))
                        throw 0;
                    if (!!(sub.value === 'styles'))
                        throw 0;
                    if (!!(sub.value === 'custom'))
                        throw 0;
                    if (!(sub.value === 'lore'))
                        throw 0;
                    return (prompts.value.updateLore(it.uid, { mode: inputValue($event) }));
                    // @ts-ignore
                    [prompts,];
                } },
            ...{ class: "small" },
            value: (it.mode),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_18 = __VLS_tryAsConstant((__VLS_unwrap(MODES, {})));
        for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_18))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (m.id),
                value: (m.id),
            });
            (m.label);
            // @ts-ignore
            [MODES,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "small" },
            title: "注入順序，越小越前面",
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(sub.value === 'rules'))
                        throw 0;
                    if (!!(sub.value === 'styles'))
                        throw 0;
                    if (!!(sub.value === 'custom'))
                        throw 0;
                    if (!(sub.value === 'lore'))
                        throw 0;
                    return (prompts.value.updateLore(it.uid, { order: Number(inputValue($event)) || 0 }));
                    // @ts-ignore
                    [prompts,];
                } },
            ...{ class: "num" },
            type: "number",
            value: (it.order),
        });
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "small muted chars" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['chars']} */ ;
        (it.content.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(sub.value === 'rules'))
                        throw 0;
                    if (!!(sub.value === 'styles'))
                        throw 0;
                    if (!!(sub.value === 'custom'))
                        throw 0;
                    if (!(sub.value === 'lore'))
                        throw 0;
                    return (openLore.value = openLore.value === it.uid ? null : it.uid);
                    // @ts-ignore
                    [openLore, openLore,];
                } },
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (openLore.value === it.uid ? '收起' : '✏️');
        if (it.note && openLore.value !== it.uid) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted note" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            /** @type {__VLS_StyleScopedClasses['note']} */ ;
            (it.note);
        }
        if (openLore.value === it.uid) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "editor" },
            });
            /** @type {__VLS_StyleScopedClasses['editor']} */ ;
            if (it.note) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "small muted" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (it.note);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(sub.value === 'rules'))
                            throw 0;
                        if (!!(sub.value === 'styles'))
                            throw 0;
                        if (!!(sub.value === 'custom'))
                            throw 0;
                        if (!(sub.value === 'lore'))
                            throw 0;
                        if (!(openLore.value === it.uid))
                            throw 0;
                        return (prompts.value.updateLore(it.uid, { comment: inputValue($event) }));
                        // @ts-ignore
                        [prompts, openLore, openLore, openLore,];
                    } },
                value: (it.comment),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(sub.value === 'rules'))
                            throw 0;
                        if (!!(sub.value === 'styles'))
                            throw 0;
                        if (!!(sub.value === 'custom'))
                            throw 0;
                        if (!(sub.value === 'lore'))
                            throw 0;
                        if (!(openLore.value === it.uid))
                            throw 0;
                        return (setKeys(it, inputValue($event)));
                        // @ts-ignore
                        [];
                    } },
                value: (keysText(it)),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "check" },
            });
            /** @type {__VLS_StyleScopedClasses['check']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(sub.value === 'rules'))
                            throw 0;
                        if (!!(sub.value === 'styles'))
                            throw 0;
                        if (!!(sub.value === 'custom'))
                            throw 0;
                        if (!(sub.value === 'lore'))
                            throw 0;
                        if (!(openLore.value === it.uid))
                            throw 0;
                        return (prompts.value.updateLore(it.uid, { adult: $event.target.checked }));
                        // @ts-ignore
                        [prompts,];
                    } },
                type: "checkbox",
                checked: (it.adult),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
                ...{ onChange: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(sub.value === 'rules'))
                            throw 0;
                        if (!!(sub.value === 'styles'))
                            throw 0;
                        if (!!(sub.value === 'custom'))
                            throw 0;
                        if (!(sub.value === 'lore'))
                            throw 0;
                        if (!(openLore.value === it.uid))
                            throw 0;
                        return (prompts.value.updateLore(it.uid, { content: inputValue($event) }));
                        // @ts-ignore
                        [prompts,];
                    } },
                value: (it.content),
                rows: "10",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "spacer" },
            });
            /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
            if (it.builtin) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!!(sub.value === 'rules'))
                                throw 0;
                            if (!!(sub.value === 'styles'))
                                throw 0;
                            if (!!(sub.value === 'custom'))
                                throw 0;
                            if (!(sub.value === 'lore'))
                                throw 0;
                            if (!(openLore.value === it.uid))
                                throw 0;
                            if (!(it.builtin))
                                throw 0;
                            return (prompts.value.resetLore(it.uid));
                            // @ts-ignore
                            [prompts,];
                        } },
                    ...{ class: "small" },
                    disabled: (!it.edited),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!!(sub.value === 'rules'))
                                throw 0;
                            if (!!(sub.value === 'styles'))
                                throw 0;
                            if (!!(sub.value === 'custom'))
                                throw 0;
                            if (!(sub.value === 'lore'))
                                throw 0;
                            if (!(openLore.value === it.uid))
                                throw 0;
                            if (!!(it.builtin))
                                throw 0;
                            return (removeLore(it));
                            // @ts-ignore
                            [];
                        } },
                    ...{ class: "small danger" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['danger']} */ ;
            }
        }
        // @ts-ignore
        [];
    }
}
else if (sub.value === 'data') {
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
    if (!game.value.state) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else {
        const __VLS_19 = __VLS_tryAsConstant((__VLS_unwrap(injected, {})));
        for (const [d] of __VLS_vFor(__VLS_nonNull(__VLS_19))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (d.title),
                ...{ class: "data" },
            });
            /** @type {__VLS_StyleScopedClasses['data']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
            (d.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (d.note);
            (d.s ? `・${d.s.text.length} 字・約 ${__VLS_unwrap(estimateTokens, {})(d.s.text)} tokens` : '');
            if (d.s) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
                (d.s.text);
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "small muted" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            }
            // @ts-ignore
            [sub, game, estimateTokens, injected,];
        }
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: "narration",
    });
    (previewKind.value);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: "judge",
    });
    (previewKind.value);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: "spacer" },
    });
    /** @type {__VLS_StyleScopedClasses['spacer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (copyPreview) },
        ...{ class: "small" },
        disabled: (!preview.value),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (!game.value.state) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (loading.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (previewKind.value === 'narration' && !narration.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (previewKind.value === 'judge' && !judge.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else if (preview.value) {
        if (previewKind.value === 'judge' && judge.value?.sample) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        if (previewKind.value === 'narration') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            if (report.value && settings.value.narrationFeature(report.value) === 'adult') {
                (settings.value.sourceFor('adult').name);
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "sections small" },
        });
        /** @type {__VLS_StyleScopedClasses['sections']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        const __VLS_20 = __VLS_tryAsConstant((__VLS_unwrap(previewSections, {})));
        for (const [s, i] of __VLS_vFor(__VLS_nonNull(__VLS_20))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (s.key),
                ...{ class: (s.part) },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (i + 1);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (s.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (s.part === 'system' ? '前段・可快取' : '後段');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (s.text.length);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (__VLS_unwrap(estimateTokens, {})(s.text));
            // @ts-ignore
            [game, estimateTokens, settings, settings, judge, judge, previewKind, previewKind, previewKind, previewKind, previewKind, previewKind, preview, preview, loading, narration, report, report, previewSections,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.tfoot, __VLS_intrinsics.tfoot)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (totals.value.systemChars);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (totals.value.system);
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (totals.value.userChars);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        (totals.value.user);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        const __VLS_21 = __VLS_tryAsConstant((__VLS_unwrap(previewSections, {})));
        for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_21))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (s.key),
                ...{ class: "block" },
                ...{ class: (s.part) },
            });
            /** @type {__VLS_StyleScopedClasses['block']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(sub.value === 'rules'))
                            throw 0;
                        if (!!(sub.value === 'styles'))
                            throw 0;
                        if (!!(sub.value === 'custom'))
                            throw 0;
                        if (!!(sub.value === 'lore'))
                            throw 0;
                        if (!!(sub.value === 'data'))
                            throw 0;
                        if (!!(!game.value.state))
                            throw 0;
                        if (!!(loading.value))
                            throw 0;
                        if (!!(previewKind.value === 'narration' && !narration.value))
                            throw 0;
                        if (!!(previewKind.value === 'judge' && !judge.value))
                            throw 0;
                        if (!(preview.value))
                            throw 0;
                        return (expanded.value[s.key] = !expanded.value[s.key]);
                        // @ts-ignore
                        [previewSections, totals, totals, totals, totals, expanded, expanded,];
                    } },
                ...{ class: "row block-head" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            /** @type {__VLS_StyleScopedClasses['block-head']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (expanded.value[s.key] ? '▾' : '▸');
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (s.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            (s.part === 'system' ? 'system・前段' : 'user・後段');
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "small muted" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (s.text.length);
            if (expanded.value[s.key]) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({});
                (s.text);
            }
            // @ts-ignore
            [expanded, expanded,];
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row footer small" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['footer']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "spacer" },
});
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (exportConfig) },
    ...{ class: "small" },
    title: "敘事規則、文風、其他提示詞、世界書的修改與判定設定，一次全部",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (fileInput.value?.click());
            // @ts-ignore
            [fileInput,];
        } },
    ...{ class: "small" },
    title: "會取代目前所有的提示詞設定",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (onImport) },
    ref: "fileInput",
    type: "file",
    accept: ".json,application/json",
    hidden: true,
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (resetAll) },
    ...{ class: "small danger" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
