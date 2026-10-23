import { ref } from 'vue';
import { DEFEAT_LOOT_NAME, defeatLootRule } from '@/engine/expedition';
import { companionRules } from '@/engine/data';
import { gearRules } from '@/engine/gear';
import { useGame } from '@/stores/game';
import { AI_FEATURES, NARRATE_KINDS, useSettings } from '@/stores/settings';
import ImageSettings from './ImageSettings.vue';
import ModelSourceEditor from './ModelSourceEditor.vue';
const settings = useSettings();
const game = useGame();
const source = ref(0);
// 設定分成幾個頁籤（記住上次看的那一頁）
const PAGES = [
    { id: 'models', label: '🤖 模型' },
    { id: 'images', label: '🖼️ 圖像' },
    { id: 'narration', label: '✨ 敘事與判定' },
    { id: 'rules', label: '🎮 遊戲規則' },
    { id: 'save', label: '💾 存檔' },
];
const PAGE_KEY = 'elondia.settingsPage';
function savedPage() {
    try {
        const v = localStorage.getItem(PAGE_KEY);
        return PAGES.some((p) => p.id === v) ? v : 'models';
    }
    catch {
        return 'models';
    }
}
const page = ref(savedPage());
function openPage(id) {
    page.value = id;
    try {
        localStorage.setItem(PAGE_KEY, id);
    }
    catch {
        // 無法記住時下次從第一頁開始
    }
}
function doReset() {
    if (confirm('確定要刪除目前的存檔？此動作無法復原。'))
        game.reset();
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(page, {});
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(source, {});
// @ts-ignore
__VLS_withDotValue(AI_FEATURES, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(companionRules, {});
// @ts-ignore
__VLS_withDotValue(gearRules, {});
void {};
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['routes']} */ ;
/** @type {__VLS_StyleScopedClasses['routes']} */ ;
/** @type {__VLS_StyleScopedClasses['kinds']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "row tabs pages" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['pages']} */ ;
const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(PAGES, {})));
for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (openPage(p.id));
                // @ts-ignore
                [PAGES,];
            } },
        key: (p.id),
        ...{ class: ({ active: page.value === p.id }) },
    });
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    (p.label);
    // @ts-ignore
    [page,];
}
if (page.value === 'models') {
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
    __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
        ...{ class: "row tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabs']} */ ;
    const __VLS_1 = __VLS_tryAsConstant((settings.value.sources));
    for (const [s, i] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(page.value === 'models'))
                        throw 0;
                    return (source.value = i);
                    // @ts-ignore
                    [page, settings, source,];
                } },
            key: (i),
            ...{ class: ({ active: source.value === i }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (settings.value.sourceReady(i) ? '🟢' : '⚪');
        (s.name);
        // @ts-ignore
        [settings, source,];
    }
    const __VLS_2 = ModelSourceEditor;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent1(__VLS_2, new __VLS_2({
        // @ts-ignore
        key: (source.value), index: (source.value),
    }));
    const __VLS_4 = __VLS_3({
        key: (source.value),
        index: (source.value),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
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
    (settings.value.adult ? '與「成人場景正文」' : '');
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "routes small" },
    });
    /** @type {__VLS_StyleScopedClasses['routes']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    const __VLS_7 = __VLS_tryAsConstant((AI_FEATURES.value.filter((x) => x.id !== 'adult' || settings.value.adult)));
    for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (f.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "name" },
        });
        /** @type {__VLS_StyleScopedClasses['name']} */ ;
        (f.prose ? '✍️' : '🧮');
        (f.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (settings.value.routes[f.id]),
        });
        const __VLS_8 = __VLS_tryAsConstant((settings.value.sources));
        for (const [s, i] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (i),
                value: (i),
            });
            (s.name);
            (settings.value.sourceReady(i) ? '' : '（未設定）');
            // @ts-ignore
            [settings, settings, settings, settings, settings, source, source, AI_FEATURES,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (f.desc);
        // @ts-ignore
        [];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check small" },
        ...{ class: ({ muted: settings.value.sourceIndex('judge') !== settings.value.sourceIndex('narration') }) },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        disabled: (settings.value.sourceIndex('judge') !== settings.value.sourceIndex('narration')),
    });
    (settings.value.judgeWritesNarrative);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small note" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['note']} */ ;
    if (settings.value.splitJudgeNarrative()) {
        (settings.value.sourceFor('judge').name);
        (settings.value.sourceFor('narration').name);
    }
    else {
        (settings.value.sourceFor('judge').name);
    }
}
if (page.value === 'images') {
    const __VLS_9 = ImageSettings;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent1(__VLS_9, new __VLS_9({
    // @ts-ignore
    }));
    const __VLS_11 = __VLS_10({}, ...__VLS_functionalComponentArgsRest(__VLS_10));
}
if (page.value === 'narration') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form" },
    });
    /** @type {__VLS_StyleScopedClasses['form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (settings.value.aiNarration);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "kinds" },
    });
    /** @type {__VLS_StyleScopedClasses['kinds']} */ ;
    const __VLS_14 = __VLS_tryAsConstant((__VLS_unwrap(NARRATE_KINDS, {})));
    for (const [k] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (k.id),
            ...{ class: "check small" },
            title: (k.desc),
        });
        /** @type {__VLS_StyleScopedClasses['check']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
        });
        (settings.value.narrateKinds[k.id]);
        (k.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (k.desc);
        // @ts-ignore
        [page, page, settings, settings, settings, settings, settings, settings, settings, settings, settings, settings, settings, NARRATE_KINDS,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
    });
    (settings.value.aiJudge);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (settings.value.language),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "zh-Hant",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "zh-Hans",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
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
    if (settings.value.adult) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
}
if (page.value === 'rules') {
    if (game.value.state) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "panel" },
        });
        /** @type {__VLS_StyleScopedClasses['panel']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "form" },
        });
        /** @type {__VLS_StyleScopedClasses['form']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ onChange: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(page.value === 'rules'))
                        throw 0;
                    if (!(game.value.state))
                        throw 0;
                    return (game.value.setDefeatLoot($event.target.value));
                    // @ts-ignore
                    [page, settings, settings, settings, settings, settings, game, game,];
                } },
            value: (__VLS_unwrap(defeatLootRule, {})(game.value.state)),
        });
        const __VLS_15 = __VLS_tryAsConstant((__VLS_unwrap(DEFEAT_LOOT_NAME, {})));
        for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (k),
                value: (k),
            });
            (n);
            // @ts-ignore
            [game, defeatLootRule, DEFEAT_LOOT_NAME,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form" },
    });
    /** @type {__VLS_StyleScopedClasses['form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "99",
        ...{ style: {} },
    });
    (settings.value.abilityRerolls);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: "24",
        ...{ style: {} },
    });
    (settings.value.longRestGap);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (companionRules.value.rest.long_rest_gap_hours);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "0",
        max: (gearRules.value.creation.max_budget),
        ...{ style: {} },
    });
    (settings.value.creationGearBudget);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (gearRules.value.creation.max_budget);
    (gearRules.value.creation.default_budget);
    (gearRules.value.creation.max_tier);
}
if (page.value === 'save') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    if (!game.value.state) {
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
    if (game.value.state) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (doReset) },
            ...{ class: "danger" },
        });
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "form" },
    });
    /** @type {__VLS_StyleScopedClasses['form']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        min: "50",
        max: "5000",
        step: "50",
        ...{ style: {} },
    });
    (settings.value.logKeep);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    if (game.value.state) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (game.value.state.reports.length);
        (game.value.state.logArchive?.length ?? 0);
    }
}
// @ts-ignore
[page, settings, settings, settings, settings, game, game, game, game, game, companionRules, gearRules, gearRules, gearRules, gearRules,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
