import { computed, ref } from 'vue';
import { combatRules, craftRules, homeRules, itemDef } from '@/engine/data';
import { currentArea, currentCell } from '@/engine/grid';
import { comfortOf, describeHome, furnitureIn, hasBed, homeOfArea, lotHere, lotPrice, ownHomeOfArea, PLACE_NAME, placeOf, residents, stayRefusal, } from '@/engine/homes';
import { cropStatus, plotPlace, seedsFor } from '@/engine/garden';
import { formatMoney } from '@/engine/money';
import { useGame } from '@/stores/game';
import FoldSection from './FoldSection.vue';
import NameTag from './NameTag.vue';
// 房子（docs/HOMES.md）：站在待售的空地上可以買；在自己的房子裡擺家具、讓夥伴留守或帶上
const game = useGame();
const s = computed(() => game.state);
const area = computed(() => currentArea(s.value));
const cell = computed(() => currentCell(s.value));
// ---- 待售的空地 ----
const lot = computed(() => lotHere(s.value, area.value, cell.value));
const lotDef = computed(() => (lot.value ? homeRules.districts[lot.value.district] : undefined));
const price = computed(() => (lot.value ? lotPrice(s.value, lot.value) : 0));
const newName = ref('');
function buy() {
    if (!lot.value || !confirm(`用 ${formatMoney(price.value)} 買下這棟${lotDef.value.name}？`))
        return;
    game.buyHome(lot.value.id, newName.value);
    newName.value = '';
}
// ---- 主人的家（主角是奴隸時，見 docs/COMPANIONS.md 第 3.4 節） ----
const masterHome = computed(() => {
    const h = homeOfArea(s.value, area.value);
    return h?.master ? h : undefined;
});
// ---- 自己的房子 ----
const home = computed(() => ownHomeOfArea(s.value, area.value));
const place = computed(() => placeOf(area.value, cell.value));
const choices = computed(() => s.value.inventory.filter((i) => {
    const f = itemDef(i.name)?.furniture;
    return i.qty > 0 && !!f && !!place.value && f.places.includes(place.value);
}));
const pick = ref('');
const all = computed(() => (home.value ? furnitureIn(home.value) : []));
const comfort = computed(() => (home.value ? comfortOf(home.value) : 0));
const benches = computed(() => all.value.filter((f) => itemDef(f.name)?.furniture?.function === 'workbench').map((f) => `${f.name}（${craftRules.skills[itemDef(f.name).furniture.craft].name}）`));
const staying = computed(() => (home.value ? residents(s.value, home.value.id) : []));
const companions = computed(() => s.value.party.filter((m) => !m.isPlayer));
const partyFull = computed(() => s.value.party.filter((m) => m.bond !== 'guest').length >= combatRules.party_max);
const floorName = (key) => home.value?.areas[key]?.name.split('・').at(-1) ?? '';
// 苗圃：播種、收成、拔掉
const plot = computed(() => (home.value ? plotPlace(area.value, cell.value) : undefined));
const crop = computed(() => cropStatus(s.value, cell.value));
const seeds = computed(() => seedsFor(s.value, area.value, cell.value));
const seedPick = ref('');
const plots = computed(() => {
    if (!home.value)
        return { total: 0, ripe: 0 };
    const cells = Object.values(home.value.areas).flatMap((a) => a.cells.filter((c) => plotPlace(a, c)));
    return { total: cells.length, ripe: cells.filter((c) => cropStatus(s.value, c)?.ready).length };
});
const waitText = (h) => (h >= 24 ? `約 ${Math.ceil(h / 24)} 天` : `${h} 小時`);
function plantIt() {
    if (!seedPick.value)
        return;
    game.plant(seedPick.value);
    seedPick.value = '';
}
function uprootIt() {
    if (crop.value && confirm(`拔掉還沒成熟的${crop.value.seed}？種子不會退回。`))
        game.uproot();
}
function placeIt() {
    if (!pick.value)
        return;
    game.placeFurniture(pick.value);
    pick.value = '';
}
function rename() {
    const n = prompt('房子的名字', home.value?.name);
    if (n && home.value)
        game.renameHome(home.value.id, n);
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(lot, {});
// @ts-ignore
__VLS_withDotValue(lotDef, {});
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(masterHome, {});
// @ts-ignore
__VLS_withDotValue(area, {});
// @ts-ignore
__VLS_withDotValue(home, {});
// @ts-ignore
__VLS_withDotValue(homeRules, {});
// @ts-ignore
__VLS_withDotValue(benches, {});
// @ts-ignore
__VLS_withDotValue(plots, {});
// @ts-ignore
__VLS_withDotValue(cell, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(place, {});
// @ts-ignore
__VLS_withDotValue(PLACE_NAME, {});
// @ts-ignore
__VLS_withDotValue(choices, {});
// @ts-ignore
__VLS_withDotValue(pick, {});
// @ts-ignore
__VLS_withDotValue(plot, {});
// @ts-ignore
__VLS_withDotValue(crop, {});
// @ts-ignore
__VLS_withDotValue(seeds, {});
// @ts-ignore
__VLS_withDotValue(seedPick, {});
// @ts-ignore
__VLS_withDotValue(staying, {});
// @ts-ignore
__VLS_withDotValue(partyFull, {});
// @ts-ignore
__VLS_withDotValue(combatRules, {});
// @ts-ignore
__VLS_withDotValue(companions, {});
// @ts-ignore
__VLS_withDotValue(all, {});
void {};
/** @type {__VLS_StyleScopedClasses['home']} */ ;
/** @type {__VLS_StyleScopedClasses['head']} */ ;
/** @type {__VLS_StyleScopedClasses['home']} */ ;
/** @type {__VLS_StyleScopedClasses['home']} */ ;
if (lot.value && lotDef.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel home small" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['home']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (lotDef.value.name);
    (__VLS_unwrap(describeHome, {})(lot.value));
    (lotDef.value.size[0] - 2);
    (lotDef.value.size[1] - 2);
    (lotDef.value.rooms[0]);
    (lotDef.value.rooms[1]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        maxlength: "16",
        placeholder: "房子的名字（選填）",
    });
    (__VLS_unwrap(newName, {}));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (buy) },
        ...{ class: "primary small" },
        disabled: (s.value.money_cc < __VLS_unwrap(price, {})),
    });
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    (__VLS_unwrap(formatMoney, {})(__VLS_unwrap(price, {})));
}
else if (masterHome.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel home small" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['home']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (masterHome.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (area.value.name.split('・').at(-1));
    (__VLS_unwrap(describeHome, {})(masterHome.value));
}
else if (home.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel home small" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['home']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row head" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
    (home.value.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (rename) },
        ...{ class: "small" },
        title: "改名",
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (area.value.name.split('・').at(-1));
    (__VLS_unwrap(comfort, {}));
    (homeRules.value.comfort_rested);
    if (__VLS_unwrap(comfort, {}) >= homeRules.value.comfort_rested) {
    }
    (__VLS_unwrap(hasBed, {})(home.value) ? '有床，可以在家長休' : '還沒有床');
    if (benches.value.length) {
        (benches.value.join('、'));
    }
    if (plots.value.total) {
        (plots.value.total);
        if (plots.value.ripe) {
            (plots.value.ripe);
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "spot" },
    });
    /** @type {__VLS_StyleScopedClasses['spot']} */ ;
    if (cell.value.furniture) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_unwrap(itemDef, {})(cell.value.furniture)?.furniture?.icon ?? '🪑');
        (cell.value.furniture);
        if (!cell.value.crop) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(lot.value && lotDef.value))
                            throw 0;
                        if (!!(masterHome.value))
                            throw 0;
                        if (!(home.value))
                            throw 0;
                        if (!(cell.value.furniture))
                            throw 0;
                        if (!(!cell.value.crop))
                            throw 0;
                        return (game.value.takeFurniture());
                        // @ts-ignore
                        [lot, lot, lotDef, lotDef, lotDef, lotDef, lotDef, lotDef, describeHome, describeHome, newName, s, price, price, formatMoney, masterHome, masterHome, masterHome, area, area, home, home, home, comfort, comfort, homeRules, homeRules, hasBed, benches, benches, plots, plots, plots, plots, cell, cell, cell, cell, itemDef, game,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
    }
    else if (place.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (PLACE_NAME.value[place.value]);
        if (choices.value.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (pick.value),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            const __VLS_0 = __VLS_tryAsConstant((choices.value));
            for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (c.name),
                    value: (c.name),
                });
                (__VLS_unwrap(itemDef, {})(c.name)?.furniture?.icon);
                (c.name);
                (c.qty);
                // @ts-ignore
                [itemDef, place, place, PLACE_NAME, choices, choices, pick,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (placeIt) },
                ...{ class: "small" },
                disabled: (!pick.value),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (PLACE_NAME.value[place.value]);
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    if (plot.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "spot" },
        });
        /** @type {__VLS_StyleScopedClasses['spot']} */ ;
        if (crop.value) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (crop.value.ready ? '🌾' : '🌿');
            (crop.value.seed);
            (crop.value.spec.yields.join('或'));
            (crop.value.ready ? '可以收成了' : `還要${__VLS_unwrap(waitText, {})(crop.value.hoursLeft)}`);
            if (crop.value.ready) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!!(lot.value && lotDef.value))
                                throw 0;
                            if (!!(masterHome.value))
                                throw 0;
                            if (!(home.value))
                                throw 0;
                            if (!(plot.value))
                                throw 0;
                            if (!(crop.value))
                                throw 0;
                            if (!(crop.value.ready))
                                throw 0;
                            return (game.value.harvest());
                            // @ts-ignore
                            [game, place, PLACE_NAME, pick, plot, crop, crop, crop, crop, crop, crop, crop, waitText,];
                        } },
                    ...{ class: "primary small" },
                });
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (uprootIt) },
                    ...{ class: "small" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
        }
        else if (seeds.value.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                value: (seedPick.value),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            const __VLS_1 = __VLS_tryAsConstant((seeds.value));
            for (const [sd] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (sd.name),
                    value: (sd.name),
                });
                (sd.name);
                (sd.qty);
                // @ts-ignore
                [seeds, seeds, seedPick,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (plantIt) },
                ...{ class: "small" },
                disabled: (!seedPick.value),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (PLACE_NAME.value[plot.value]);
        }
    }
    const __VLS_2 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent1(__VLS_2, new __VLS_2({
        // @ts-ignore
        id: "home.people", title: "👥 看家的夥伴", count: (staying.value.length),
    }));
    const __VLS_4 = __VLS_3({
        id: "home.people",
        title: "👥 看家的夥伴",
        count: (staying.value.length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    const { default: __VLS_7 } = __VLS_nonNull(__VLS_5.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_8 = __VLS_tryAsConstant((staying.value));
    for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_8))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (m.id),
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        const __VLS_9 = NameTag;
        // @ts-ignore
        const __VLS_10 = __VLS_asFunctionalComponent1(__VLS_9, new __VLS_9({
            // @ts-ignore
            id: (m.id),
        }));
        const __VLS_11 = __VLS_10({
            id: (m.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_10));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!!(lot.value && lotDef.value))
                        throw 0;
                    if (!!(masterHome.value))
                        throw 0;
                    if (!(home.value))
                        throw 0;
                    return (game.value.takeResident(m.id));
                    // @ts-ignore
                    [game, PLACE_NAME, plot, seedPick, staying, staying,];
                } },
            ...{ class: "small" },
            disabled: (partyFull.value),
            title: (partyFull.value ? `隊伍最多 ${combatRules.value.party_max} 人` : ''),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        // @ts-ignore
        [partyFull, partyFull, combatRules,];
    }
    if (!staying.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    if (companions.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        const __VLS_14 = __VLS_tryAsConstant((companions.value));
        for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (m.id),
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            const __VLS_15 = NameTag;
            // @ts-ignore
            const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
                // @ts-ignore
                id: (m.id),
            }));
            const __VLS_17 = __VLS_16({
                id: (m.id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_16));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!!(lot.value && lotDef.value))
                            throw 0;
                        if (!!(masterHome.value))
                            throw 0;
                        if (!(home.value))
                            throw 0;
                        if (!(companions.value.length))
                            throw 0;
                        return (game.value.stayHome(m.id));
                        // @ts-ignore
                        [game, staying, companions, companions,];
                    } },
                ...{ class: "small" },
                disabled: (!!__VLS_unwrap(stayRefusal, {})(m)),
                title: (__VLS_unwrap(stayRefusal, {})(m)),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            // @ts-ignore
            [stayRefusal, stayRefusal,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    // @ts-ignore
    [];
    var __VLS_5;
    const __VLS_20 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
        // @ts-ignore
        id: "home.furniture", title: "🛋️ 家具", count: (all.value.length),
    }));
    const __VLS_22 = __VLS_21({
        id: "home.furniture",
        title: "🛋️ 家具",
        count: (all.value.length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    const { default: __VLS_25 } = __VLS_nonNull(__VLS_23.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    const __VLS_26 = __VLS_tryAsConstant((all.value));
    for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_26))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (`${f.area}:${f.x},${f.y}`),
        });
        (__VLS_unwrap(itemDef, {})(f.name)?.furniture?.icon);
        (f.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(floorName, {})(f.area));
        // @ts-ignore
        [itemDef, all, all, floorName,];
    }
    if (!all.value.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    // @ts-ignore
    [all,];
    var __VLS_23;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
