import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { locationById } from '@/engine/data';
import { formatMoney } from '@/engine/money';
import { formatTime } from '@/engine/state';
import { alertLevel, factionName } from '@/engine/security';
import { useGame } from '@/stores/game';
import { useSettings } from '@/stores/settings';
import { useContent } from '@/stores/content';
import HomeView from '@/components/HomeView.vue';
import ActionPanel from '@/components/ActionPanel.vue';
import AppDialog from '@/components/AppDialog.vue';
import NotebookView from '@/components/NotebookView.vue';
import CraftDialog from '@/components/CraftDialog.vue';
import { canTurnIn } from '@/engine/materialQuests';
import RoadPanel from '@/components/RoadPanel.vue';
import CombatView from '@/components/CombatView.vue';
import IntentPanel from '@/components/IntentPanel.vue';
import LogView from '@/components/LogView.vue';
import MapPanel from '@/components/MapPanel.vue';
import NewGameView from '@/components/NewGameView.vue';
import PartyView from '@/components/PartyView.vue';
import InventoryView from '@/components/items/InventoryView.vue';
import PeoplePanel from '@/components/PeoplePanel.vue';
import PlacePanel from '@/components/PlacePanel.vue';
import RelationsView from '@/components/RelationsView.vue';
import RestPanel from '@/components/RestPanel.vue';
import SaveDialog from '@/components/SaveDialog.vue';
import SettingsView from '@/components/SettingsView.vue';
import EventCenter from '@/components/events/EventCenter.vue';
import { activeEvents, eventDialogOpen, pendingEvents } from '@/components/events/eventQueue';
// 提示詞頁籤會載入整本世界書，切過去時才載入
const PromptsView = defineAsyncComponent(() => import('@/components/PromptsView.vue'));
const ContentView = defineAsyncComponent(() => import('@/components/ContentView.vue'));
const game = useGame();
// 成人向開關變更時重畫遊戲畫面（娼館／按摩店等名稱）
const settings = useSettings();
const inCombat = computed(() => !!game.state?.combat);
const pendingSkills = computed(() => game.state?.party.some((m) => m.pendingAbilityChoices?.length || m.attrPoints > 0) ?? false);
const suggestionCount = computed(() => game.state?.suggestions?.length ?? 0);
// 需要回應的事件（事件視窗關著時在上方提醒）
const eventCount = computed(() => pendingEvents(game.state).length);
const blockingEvent = computed(() => activeEvents(game.state).some((e) => e.blocking));
// 通緝與這裡的衛兵警戒
const crime = computed(() => {
    const s = game.state;
    if (!s)
        return null;
    const wanted = Object.keys(s.wanted ?? {});
    if (wanted.length)
        return { text: '⛔ 通緝中', title: `被${wanted.map(factionName).join('、')}通緝` };
    const level = alertLevel(s);
    return level ? { text: `🚨 警戒 ${level}`, title: `${locationById(s.location).name}的衛兵警戒 ${level}` } : null;
});
const TABS = [
    { id: 'adventure', label: '🗺️ 冒險' },
    { id: 'prompts', label: '🧩 提示詞' },
    { id: 'content', label: '🛠️ 內容' },
];
const tab = ref('adventure');
const screen = ref('home');
const content = useContent();
// 進入遊戲時切到冒險頁；回到首頁時從首頁開始
watch(() => !!game.state, (inGame) => {
    if (inGame) {
        tab.value = 'adventure';
        showSaves.value = false;
    }
    else
        screen.value = 'home';
});
async function goHome() {
    closeDialogs();
    await game.toHome();
}
function closeDialogs() {
    showParty.value = showInventory.value = showRelations.value = showNotebook.value = showCraft.value = showSaves.value = showSettings.value = false;
}
const showSettings = ref(false);
const showParty = ref(false);
const showInventory = ref(false);
const showRelations = ref(false);
const showNotebook = ref(false);
const showCraft = ref(false);
/** 可以回公會交付的委託 */
const readyQuests = computed(() => (game.state ? game.state.quests.filter((q) => canTurnIn(game.state, q)).length : 0));
const showSaves = ref(false);
function askQuickLoad() {
    if (!game.state || confirm('讀取快速存檔？目前的進度會先自動存一份。'))
        void game.quickLoad();
}
// 快捷鍵：F8 / Ctrl+S 快速存檔，F9 快速讀檔
function onKey(e) {
    const typing = e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        if (game.state)
            void game.quickSave();
    }
    else if (e.key === 'F9' && !typing && game.state) {
        e.preventDefault();
        askQuickLoad();
    }
}
// 自動保存失敗時，離開頁面前提醒一下
function onLeave(e) {
    if (!game.saveWarning)
        return;
    e.preventDefault();
    e.returnValue = '';
}
onMounted(() => {
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onLeave);
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(tab, {});
// @ts-ignore
__VLS_withDotValue(screen, {});
// @ts-ignore
__VLS_withDotValue(crime, {});
// @ts-ignore
__VLS_withDotValue(eventCount, {});
// @ts-ignore
__VLS_withDotValue(eventDialogOpen, {});
// @ts-ignore
__VLS_withDotValue(showSaves, {});
// @ts-ignore
__VLS_withDotValue(showSettings, {});
// @ts-ignore
__VLS_withDotValue(content, {});
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(inCombat, {});
// @ts-ignore
__VLS_withDotValue(showParty, {});
// @ts-ignore
__VLS_withDotValue(pendingSkills, {});
// @ts-ignore
__VLS_withDotValue(showInventory, {});
// @ts-ignore
__VLS_withDotValue(showRelations, {});
// @ts-ignore
__VLS_withDotValue(suggestionCount, {});
// @ts-ignore
__VLS_withDotValue(showNotebook, {});
// @ts-ignore
__VLS_withDotValue(readyQuests, {});
// @ts-ignore
__VLS_withDotValue(showCraft, {});
void {};
/** @type {__VLS_StyleScopedClasses['top']} */ ;
/** @type {__VLS_StyleScopedClasses['events']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['game']} */ ;
/** @type {__VLS_StyleScopedClasses['quick']} */ ;
/** @type {__VLS_StyleScopedClasses['hot']} */ ;
/** @type {__VLS_StyleScopedClasses['game']} */ ;
/** @type {__VLS_StyleScopedClasses['game']} */ ;
/** @type {__VLS_StyleScopedClasses['combat']} */ ;
/** @type {__VLS_StyleScopedClasses['game']} */ ;
/** @type {__VLS_StyleScopedClasses['game']} */ ;
/** @type {__VLS_StyleScopedClasses['combat']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "top" },
});
/** @type {__VLS_StyleScopedClasses['top']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({});
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
        ...{ class: "row tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabs']} */ ;
    const __VLS_0 = __VLS_tryAsConstant((__VLS_unwrap(TABS, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(game.value.state))
                        throw 0;
                    return (tab.value = t.id);
                    // @ts-ignore
                    [game, TABS, tab,];
                } },
            key: (t.id),
            ...{ class: ({ active: tab.value === t.id }) },
        });
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (t.label);
        // @ts-ignore
        [tab,];
    }
}
else if (screen.value !== 'home') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
        ...{ class: "row tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!!(game.value.state))
                    throw 0;
                if (!(screen.value !== 'home'))
                    throw 0;
                return (screen.value = 'home');
                // @ts-ignore
                [screen, screen,];
            } },
    });
}
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row status small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['status']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_unwrap(formatTime, {})(game.value.state.time));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_unwrap(locationById, {})(game.value.state.location).name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_unwrap(formatMoney, {})(game.value.state.money_cc));
    if (crime.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "crime" },
            title: (crime.value.title),
        });
        /** @type {__VLS_StyleScopedClasses['crime']} */ ;
        (crime.value.text);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row top-buttons" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['top-buttons']} */ ;
if (eventCount.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                __VLS_withDotValue(eventDialogOpen, {});
                if (!(eventCount.value))
                    throw 0;
                return (eventDialogOpen.value = true);
                // @ts-ignore
                [game, game, game, game, formatTime, locationById, formatMoney, crime, crime, crime, eventCount, eventDialogOpen,];
            } },
        ...{ class: "small events" },
        ...{ class: ({ hot: __VLS_unwrap(blockingEvent, {}) }) },
        title: "需要你處理的事",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['events']} */ ;
    /** @type {__VLS_StyleScopedClasses['hot']} */ ;
    (eventCount.value);
}
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (game.value.quickSave());
                // @ts-ignore
                [game, game, eventCount, blockingEvent,];
            } },
        ...{ class: "small" },
        title: "快速存檔（F8 / Ctrl+S）",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (askQuickLoad) },
        ...{ class: "small" },
        title: "快速讀檔（F9）",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (showSaves.value = true);
                // @ts-ignore
                [game, game, showSaves,];
            } },
        title: "存檔與讀檔",
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (showSettings.value = true);
            // @ts-ignore
            [showSettings,];
        } },
    title: "設定",
});
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (goHome) },
        title: "存好進度，回到首頁",
    });
}
let __VLS_1;
/** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
Transition;
// @ts-ignore
const __VLS_2 = __VLS_asFunctionalComponent1(__VLS_1, new __VLS_1({
    // @ts-ignore
    name: "fade",
}));
const __VLS_3 = __VLS_2({
    name: "fade",
}, ...__VLS_functionalComponentArgsRest(__VLS_2));
const { default: __VLS_6 } = __VLS_nonNull(__VLS_4.slots);
if (game.value.notice) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "notice" },
    });
    /** @type {__VLS_StyleScopedClasses['notice']} */ ;
    (game.value.notice);
}
// @ts-ignore
[game, game, game,];
var __VLS_4;
if (game.value.saveWarning) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "error row save-warning" },
    });
    /** @type {__VLS_StyleScopedClasses['error']} */ ;
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['save-warning']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (game.value.saveWarning);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.saveWarning))
                    throw 0;
                return (showSaves.value = true);
                // @ts-ignore
                [game, game, showSaves,];
            } },
        ...{ class: "small" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
if (game.value.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "error row" },
    });
    /** @type {__VLS_StyleScopedClasses['error']} */ ;
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (game.value.error);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.error))
                    throw 0;
                return (game.value.error = null);
                // @ts-ignore
                [game, game, game,];
            } },
        ...{ class: "small" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
}
if (!game.value.state) {
    if (screen.value === 'home') {
        const __VLS_7 = HomeView;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
            // @ts-ignore
            ...{ 'onNew': {} }, ...{ 'onLoad': {} }, ...{ 'onWorlds': {} }, ...{ 'onPrompts': {} }, ...{ 'onSettings': {} },
        }));
        const __VLS_9 = __VLS_8({
            ...{ 'onNew': {} },
            ...{ 'onLoad': {} },
            ...{ 'onWorlds': {} },
            ...{ 'onPrompts': {} },
            ...{ 'onSettings': {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        let __VLS_12;
        const __VLS_13 = {
            /** @type {typeof __VLS_12.new} */
            onNew: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!game.value.state))
                    throw 0;
                if (!(screen.value === 'home'))
                    throw 0;
                return (screen.value = 'new');
                // @ts-ignore
                [game, screen, screen,];
            },
        };
        void __VLS_13;
        const __VLS_14 = {
            /** @type {typeof __VLS_12.load} */
            onLoad: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!game.value.state))
                    throw 0;
                if (!(screen.value === 'home'))
                    throw 0;
                return (showSaves.value = true);
                // @ts-ignore
                [showSaves,];
            },
        };
        void __VLS_14;
        const __VLS_15 = {
            /** @type {typeof __VLS_12.worlds} */
            onWorlds: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!game.value.state))
                    throw 0;
                if (!(screen.value === 'home'))
                    throw 0;
                return (screen.value = 'worlds');
                // @ts-ignore
                [screen,];
            },
        };
        void __VLS_15;
        const __VLS_16 = {
            /** @type {typeof __VLS_12.prompts} */
            onPrompts: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!game.value.state))
                    throw 0;
                if (!(screen.value === 'home'))
                    throw 0;
                return (screen.value = 'prompts');
                // @ts-ignore
                [screen,];
            },
        };
        void __VLS_16;
        const __VLS_17 = {
            /** @type {typeof __VLS_12.settings} */
            onSettings: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!game.value.state))
                    throw 0;
                if (!(screen.value === 'home'))
                    throw 0;
                return (showSettings.value = true);
                // @ts-ignore
                [showSettings,];
            },
        };
        void __VLS_17;
        var __VLS_10;
        var __VLS_11;
    }
    else if (screen.value === 'new') {
        const __VLS_18 = NewGameView;
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
            // @ts-ignore
            ...{ 'onSettings': {} }, ...{ 'onHome': {} }, key: (content.value.active),
        }));
        const __VLS_20 = __VLS_19({
            ...{ 'onSettings': {} },
            ...{ 'onHome': {} },
            key: (content.value.active),
        }, ...__VLS_functionalComponentArgsRest(__VLS_19));
        let __VLS_23;
        const __VLS_24 = {
            /** @type {typeof __VLS_23.settings} */
            onSettings: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!game.value.state))
                    throw 0;
                if (!!(screen.value === 'home'))
                    throw 0;
                if (!(screen.value === 'new'))
                    throw 0;
                return (showSettings.value = true);
                // @ts-ignore
                [screen, showSettings, content,];
            },
        };
        void __VLS_24;
        const __VLS_25 = {
            /** @type {typeof __VLS_23.home} */
            onHome: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(!game.value.state))
                    throw 0;
                if (!!(screen.value === 'home'))
                    throw 0;
                if (!(screen.value === 'new'))
                    throw 0;
                return (screen.value = 'home');
                // @ts-ignore
                [screen,];
            },
        };
        void __VLS_25;
        var __VLS_21;
        var __VLS_22;
    }
    else if (screen.value === 'worlds') {
        let __VLS_26;
        /** @ts-ignore @type { | typeof __VLS_components.ContentView} */
        ContentView;
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
        // @ts-ignore
        }));
        const __VLS_28 = __VLS_27({}, ...__VLS_functionalComponentArgsRest(__VLS_27));
    }
    else if (screen.value === 'prompts') {
        let __VLS_31;
        /** @ts-ignore @type { | typeof __VLS_components.PromptsView} */
        PromptsView;
        // @ts-ignore
        const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
        // @ts-ignore
        }));
        const __VLS_33 = __VLS_32({}, ...__VLS_functionalComponentArgsRest(__VLS_32));
    }
}
if (game.value.state && tab.value === 'prompts') {
    let __VLS_36;
    /** @ts-ignore @type { | typeof __VLS_components.PromptsView} */
    PromptsView;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
    // @ts-ignore
    }));
    const __VLS_38 = __VLS_37({}, ...__VLS_functionalComponentArgsRest(__VLS_37));
}
if (game.value.state && tab.value === 'content') {
    let __VLS_41;
    /** @ts-ignore @type { | typeof __VLS_components.ContentView} */
    ContentView;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
    // @ts-ignore
    }));
    const __VLS_43 = __VLS_42({}, ...__VLS_functionalComponentArgsRest(__VLS_42));
}
if (game.value.state) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
        key: (settings.value.adult ? 'adult' : 'safe'),
        ...{ class: "game" },
        ...{ class: ({ combat: inCombat.value }) },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(__VLS_nonNull(null), { ...__VLS_directiveBindingRestFields, value: (tab.value === 'adventure'), }, __VLS_nonNull(null), __VLS_nonNull(null));
    /** @type {__VLS_StyleScopedClasses['game']} */ ;
    /** @type {__VLS_StyleScopedClasses['combat']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
        ...{ class: "left" },
    });
    /** @type {__VLS_StyleScopedClasses['left']} */ ;
    const __VLS_46 = MapPanel;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
    // @ts-ignore
    }));
    const __VLS_48 = __VLS_47({}, ...__VLS_functionalComponentArgsRest(__VLS_47));
    if (game.value.state.road && !inCombat.value) {
        const __VLS_51 = RoadPanel;
        // @ts-ignore
        const __VLS_52 = __VLS_asFunctionalComponent1(__VLS_51, new __VLS_51({
        // @ts-ignore
        }));
        const __VLS_53 = __VLS_52({}, ...__VLS_functionalComponentArgsRest(__VLS_52));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel quick" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['quick']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (showParty.value = true);
                // @ts-ignore
                [game, game, game, game, tab, tab, tab, screen, screen, settings, inCombat, inCombat, showParty,];
            } },
    });
    if (pendingSkills.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag hot" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['hot']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (showInventory.value = true);
                // @ts-ignore
                [pendingSkills, showInventory,];
            } },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (showRelations.value = true);
                // @ts-ignore
                [showRelations,];
            } },
    });
    if (suggestionCount.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag hot" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['hot']} */ ;
        (suggestionCount.value);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (showNotebook.value = true);
                // @ts-ignore
                [suggestionCount, suggestionCount, showNotebook,];
            } },
    });
    if (readyQuests.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag hot" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['hot']} */ ;
        (readyQuests.value);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                if (!(game.value.state))
                    throw 0;
                return (showCraft.value = true);
                // @ts-ignore
                [readyQuests, readyQuests, showCraft,];
            } },
    });
    if (!inCombat.value) {
        const __VLS_56 = RestPanel;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
        // @ts-ignore
        }));
        const __VLS_58 = __VLS_57({}, ...__VLS_functionalComponentArgsRest(__VLS_57));
        const __VLS_61 = ActionPanel;
        // @ts-ignore
        const __VLS_62 = __VLS_asFunctionalComponent1(__VLS_61, new __VLS_61({
        // @ts-ignore
        }));
        const __VLS_63 = __VLS_62({}, ...__VLS_functionalComponentArgsRest(__VLS_62));
        const __VLS_66 = IntentPanel;
        // @ts-ignore
        const __VLS_67 = __VLS_asFunctionalComponent1(__VLS_66, new __VLS_66({
        // @ts-ignore
        }));
        const __VLS_68 = __VLS_67({}, ...__VLS_functionalComponentArgsRest(__VLS_67));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "center" },
    });
    /** @type {__VLS_StyleScopedClasses['center']} */ ;
    if (inCombat.value) {
        const __VLS_71 = CombatView;
        // @ts-ignore
        const __VLS_72 = __VLS_asFunctionalComponent1(__VLS_71, new __VLS_71({
        // @ts-ignore
        }));
        const __VLS_73 = __VLS_72({}, ...__VLS_functionalComponentArgsRest(__VLS_72));
    }
    else {
        const __VLS_76 = LogView;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent1(__VLS_76, new __VLS_76({
        // @ts-ignore
        }));
        const __VLS_78 = __VLS_77({}, ...__VLS_functionalComponentArgsRest(__VLS_77));
    }
    if (!inCombat.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
            ...{ class: "right" },
        });
        /** @type {__VLS_StyleScopedClasses['right']} */ ;
        const __VLS_81 = PeoplePanel;
        // @ts-ignore
        const __VLS_82 = __VLS_asFunctionalComponent1(__VLS_81, new __VLS_81({
        // @ts-ignore
        }));
        const __VLS_83 = __VLS_82({}, ...__VLS_functionalComponentArgsRest(__VLS_82));
        const __VLS_86 = PlacePanel;
        // @ts-ignore
        const __VLS_87 = __VLS_asFunctionalComponent1(__VLS_86, new __VLS_86({
        // @ts-ignore
        }));
        const __VLS_88 = __VLS_87({}, ...__VLS_functionalComponentArgsRest(__VLS_87));
    }
}
const __VLS_91 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_92 = __VLS_asFunctionalComponent1(__VLS_91, new __VLS_91({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showParty.value), title: "隊伍", icon: "👥", width: "1200px",
}));
const __VLS_93 = __VLS_92({
    ...{ 'onClose': {} },
    open: (showParty.value),
    title: "隊伍",
    icon: "👥",
    width: "1200px",
}, ...__VLS_functionalComponentArgsRest(__VLS_92));
let __VLS_96;
const __VLS_97 = {
    /** @type {typeof __VLS_96.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showParty.value = false);
        // @ts-ignore
        [inCombat, inCombat, inCombat, showParty, showParty,];
    },
};
void __VLS_97;
const { default: __VLS_98 } = __VLS_nonNull(__VLS_94.slots);
const __VLS_99 = PartyView;
// @ts-ignore
const __VLS_100 = __VLS_asFunctionalComponent1(__VLS_99, new __VLS_99({
// @ts-ignore
}));
const __VLS_101 = __VLS_100({}, ...__VLS_functionalComponentArgsRest(__VLS_100));
// @ts-ignore
[];
var __VLS_94;
var __VLS_95;
const __VLS_104 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent1(__VLS_104, new __VLS_104({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showInventory.value), title: "行囊", icon: "🎒", width: "1000px",
}));
const __VLS_106 = __VLS_105({
    ...{ 'onClose': {} },
    open: (showInventory.value),
    title: "行囊",
    icon: "🎒",
    width: "1000px",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
let __VLS_109;
const __VLS_110 = {
    /** @type {typeof __VLS_109.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showInventory.value = false);
        // @ts-ignore
        [showInventory, showInventory,];
    },
};
void __VLS_110;
const { default: __VLS_111 } = __VLS_nonNull(__VLS_107.slots);
const __VLS_112 = InventoryView;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent1(__VLS_112, new __VLS_112({
// @ts-ignore
}));
const __VLS_114 = __VLS_113({}, ...__VLS_functionalComponentArgsRest(__VLS_113));
// @ts-ignore
[];
var __VLS_107;
var __VLS_108;
const __VLS_117 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_118 = __VLS_asFunctionalComponent1(__VLS_117, new __VLS_117({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showRelations.value), title: "人際關係與冒險記憶", icon: "💞", width: "1200px",
}));
const __VLS_119 = __VLS_118({
    ...{ 'onClose': {} },
    open: (showRelations.value),
    title: "人際關係與冒險記憶",
    icon: "💞",
    width: "1200px",
}, ...__VLS_functionalComponentArgsRest(__VLS_118));
let __VLS_122;
const __VLS_123 = {
    /** @type {typeof __VLS_122.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showRelations.value = false);
        // @ts-ignore
        [showRelations, showRelations,];
    },
};
void __VLS_123;
const { default: __VLS_124 } = __VLS_nonNull(__VLS_120.slots);
const __VLS_125 = RelationsView;
// @ts-ignore
const __VLS_126 = __VLS_asFunctionalComponent1(__VLS_125, new __VLS_125({
// @ts-ignore
}));
const __VLS_127 = __VLS_126({}, ...__VLS_functionalComponentArgsRest(__VLS_126));
// @ts-ignore
[];
var __VLS_120;
var __VLS_121;
const __VLS_130 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_131 = __VLS_asFunctionalComponent1(__VLS_130, new __VLS_130({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showNotebook.value), title: "冒險筆記", icon: "📒", width: "900px",
}));
const __VLS_132 = __VLS_131({
    ...{ 'onClose': {} },
    open: (showNotebook.value),
    title: "冒險筆記",
    icon: "📒",
    width: "900px",
}, ...__VLS_functionalComponentArgsRest(__VLS_131));
let __VLS_135;
const __VLS_136 = {
    /** @type {typeof __VLS_135.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showNotebook.value = false);
        // @ts-ignore
        [showNotebook, showNotebook,];
    },
};
void __VLS_136;
const { default: __VLS_137 } = __VLS_nonNull(__VLS_133.slots);
const __VLS_138 = NotebookView;
// @ts-ignore
const __VLS_139 = __VLS_asFunctionalComponent1(__VLS_138, new __VLS_138({
// @ts-ignore
}));
const __VLS_140 = __VLS_139({}, ...__VLS_functionalComponentArgsRest(__VLS_139));
// @ts-ignore
[];
var __VLS_133;
var __VLS_134;
const __VLS_143 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_144 = __VLS_asFunctionalComponent1(__VLS_143, new __VLS_143({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showCraft.value), title: "工藝", icon: "🛠️", width: "760px",
}));
const __VLS_145 = __VLS_144({
    ...{ 'onClose': {} },
    open: (showCraft.value),
    title: "工藝",
    icon: "🛠️",
    width: "760px",
}, ...__VLS_functionalComponentArgsRest(__VLS_144));
let __VLS_148;
const __VLS_149 = {
    /** @type {typeof __VLS_148.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showCraft.value = false);
        // @ts-ignore
        [showCraft, showCraft,];
    },
};
void __VLS_149;
const { default: __VLS_150 } = __VLS_nonNull(__VLS_146.slots);
const __VLS_151 = CraftDialog;
// @ts-ignore
const __VLS_152 = __VLS_asFunctionalComponent1(__VLS_151, new __VLS_151({
    // @ts-ignore
    ...{ 'onClose': {} },
}));
const __VLS_153 = __VLS_152({
    ...{ 'onClose': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_152));
let __VLS_156;
const __VLS_157 = {
    /** @type {typeof __VLS_156.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showCraft.value = false);
        // @ts-ignore
        [showCraft,];
    },
};
void __VLS_157;
var __VLS_154;
var __VLS_155;
// @ts-ignore
[];
var __VLS_146;
var __VLS_147;
const __VLS_158 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_159 = __VLS_asFunctionalComponent1(__VLS_158, new __VLS_158({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showSaves.value), title: "存檔與讀檔", icon: "💾", width: "860px",
}));
const __VLS_160 = __VLS_159({
    ...{ 'onClose': {} },
    open: (showSaves.value),
    title: "存檔與讀檔",
    icon: "💾",
    width: "860px",
}, ...__VLS_functionalComponentArgsRest(__VLS_159));
let __VLS_163;
const __VLS_164 = {
    /** @type {typeof __VLS_163.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showSaves.value = false);
        // @ts-ignore
        [showSaves, showSaves,];
    },
};
void __VLS_164;
const { default: __VLS_165 } = __VLS_nonNull(__VLS_161.slots);
const __VLS_166 = SaveDialog;
// @ts-ignore
const __VLS_167 = __VLS_asFunctionalComponent1(__VLS_166, new __VLS_166({
    // @ts-ignore
    ...{ 'onLoaded': {} },
}));
const __VLS_168 = __VLS_167({
    ...{ 'onLoaded': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_167));
let __VLS_171;
const __VLS_172 = {
    /** @type {typeof __VLS_171.loaded} */
    onLoaded: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showSaves.value = false);
        // @ts-ignore
        [showSaves,];
    },
};
void __VLS_172;
var __VLS_169;
var __VLS_170;
// @ts-ignore
[];
var __VLS_161;
var __VLS_162;
const __VLS_173 = AppDialog || AppDialog;
// @ts-ignore
const __VLS_174 = __VLS_asFunctionalComponent1(__VLS_173, new __VLS_173({
    // @ts-ignore
    ...{ 'onClose': {} }, open: (showSettings.value), title: "設定", icon: "⚙️", width: "760px",
}));
const __VLS_175 = __VLS_174({
    ...{ 'onClose': {} },
    open: (showSettings.value),
    title: "設定",
    icon: "⚙️",
    width: "760px",
}, ...__VLS_functionalComponentArgsRest(__VLS_174));
let __VLS_178;
const __VLS_179 = {
    /** @type {typeof __VLS_178.close} */
    onClose: // @ts-ignore
    (...[$event]) => {
        void $event;
        return (showSettings.value = false);
        // @ts-ignore
        [showSettings, showSettings,];
    },
};
void __VLS_179;
const { default: __VLS_180 } = __VLS_nonNull(__VLS_176.slots);
const __VLS_181 = SettingsView;
// @ts-ignore
const __VLS_182 = __VLS_asFunctionalComponent1(__VLS_181, new __VLS_181({
// @ts-ignore
}));
const __VLS_183 = __VLS_182({}, ...__VLS_functionalComponentArgsRest(__VLS_182));
// @ts-ignore
[];
var __VLS_176;
var __VLS_177;
if (game.value.state) {
    const __VLS_186 = EventCenter;
    // @ts-ignore
    const __VLS_187 = __VLS_asFunctionalComponent1(__VLS_186, new __VLS_186({
        // @ts-ignore
        ...{ 'onOpenParty': {} }, ...{ 'onOpenRelations': {} },
    }));
    const __VLS_188 = __VLS_187({
        ...{ 'onOpenParty': {} },
        ...{ 'onOpenRelations': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_187));
    let __VLS_191;
    const __VLS_192 = {
        /** @type {typeof __VLS_191.openParty} */
        onOpenParty: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!(game.value.state))
                throw 0;
            tab.value = 'adventure';
            showParty.value = true;
            // @ts-ignore
            [game, tab, showParty,];
        },
    };
    void __VLS_192;
    const __VLS_193 = {
        /** @type {typeof __VLS_191.openRelations} */
        onOpenRelations: // @ts-ignore
        (...[$event]) => {
            void $event;
            if (!(game.value.state))
                throw 0;
            tab.value = 'adventure';
            showRelations.value = true;
            // @ts-ignore
            [tab, showRelations,];
        },
    };
    void __VLS_193;
    var __VLS_189;
    var __VLS_190;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
