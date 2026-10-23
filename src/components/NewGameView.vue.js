import { computed, reactive, ref, watch } from 'vue';
import { DEFEAT_LOOT_NAME } from '@/engine/expedition';
import { apMaxFor, apRegenFor, baseAttrs, luckyThreshold, maxHpFor, mod, slotMaxFor } from '@/engine/character';
import { abilities, ATTR_IDS, attributeRules, combatClasses as classes, geography, isSettlement, locationById } from '@/engine/data';
import { GENDER_IDS, genderName, raceName, slaveryRules, tagDef } from '@/engine/data';
import { npcTitle } from '@/engine/npcs';
import { masterCandidates } from '@/engine/slavery';
import { DEFAULT_BIRTHPLACE } from '@/engine/state';
import { useGame } from '@/stores/game';
import { modTotal, useContent, VANILLA, VANILLA_NAME } from '@/stores/content';
import { slotTitle } from '@/stores/saves';
import MarkPicker from './MarkPicker.vue';
import PerkPicker from './PerkPicker.vue';
import { racePerks } from '@/engine/perks';
import NameTag from './NameTag.vue';
import { creationCost, creationPiece, creationSlots, gearRules, gearSummary, slotName } from '@/engine/gear';
import { useSettings } from '@/stores/settings';
const { defineEmits, } = {};
const emit = defineEmits();
const game = useGame();
const content = useContent();
const settings = useSettings();
// 世界：開新遊戲時決定，開始後不能換（換世界會重新整理這個畫面，自訂的種族、能力、NPC 才會跟著變）
function pickWorld(id) {
    try {
        content.switchWorld(id);
    }
    catch (e) {
        game.error = e instanceof Error ? e.message : String(e);
    }
}
const name = ref('');
const race = ref('human');
const classId = ref('fighter');
const bonus = reactive({ str: 0, dex: 0, int: 0, fai: 0, cha: 0 });
const { bonus_points, max_score } = attributeRules.creation;
const birthplace = ref(DEFAULT_BIRTHPLACE.human);
const gender = ref('');
const appearance = ref('');
const background = ref('');
const importText = ref('');
// 特質：清單裡的任選，也可以自訂
const perks = ref([]);
const customPerks = ref([]);
// 出生地：所有聚落，依地區分組；換種族時改成該種族的預設故鄉
const regions = computed(() => geography.regions
    .map((r) => ({ region: r, places: geography.locations.filter((l) => l.region === r.id && isSettlement(l)) }))
    .filter((g) => g.places.length));
const TYPE_NAME = { capital: '王都', city: '城市', port: '港口', town: '城鎮', village: '村莊', outpost: '哨站', fortress: '堡壘' };
const birthplaceInfo = computed(() => {
    const loc = locationById(birthplace.value);
    const faction = geography.factions.find((f) => f.id === loc.faction)?.name;
    return `${geography.regions.find((r) => r.id === loc.region)?.name}・${TYPE_NAME[loc.type] ?? loc.type}${faction ? `・${faction}` : ''}`;
});
watch(race, (r) => (birthplace.value = DEFAULT_BIRTHPLACE[r] ?? birthplace.value));
const importError = ref('');
const base = computed(() => baseAttrs(classId.value, race.value));
const attrs = computed(() => Object.fromEntries(ATTR_IDS.map((a) => [a, base.value[a] + bonus[a]])));
const spent = computed(() => ATTR_IDS.reduce((s, a) => s + bonus[a], 0));
const cls = computed(() => classes[classId.value]);
const racePerk = computed(() => racePerks(race.value)[0]);
watch([race, classId], () => ATTR_IDS.forEach((a) => (bonus[a] = 0)));
function add(a, d) {
    const next = bonus[a] + d;
    if (next < 0 || (d > 0 && (spent.value >= bonus_points || attrs.value[a] >= max_score)))
        return;
    bonus[a] = next;
}
// ---- 起始裝備：職業模板之上，用材料等級點數挑（gear.ts 的 creationGear） ----
const gearSlots = computed(() => creationSlots(classId.value, race.value));
const gearPicks = reactive({});
const maxTier = gearRules.creation.max_tier;
const tiers = Array.from({ length: maxTier }, (_, i) => i + 1);
function resetGear() {
    for (const k of Object.keys(gearPicks))
        delete gearPicks[k];
    const start = gearRules.classes[classId.value]?.start ?? {};
    for (const s of gearSlots.value)
        gearPicks[s.slot] = { base: s.template ? start[s.slot] ?? '' : '', tier: 1 };
}
watch(gearSlots, resetGear, { immediate: true });
const twoHanded = computed(() => !!gearRules.bases[gearPicks.main_hand?.base ?? '']?.two_handed);
const gearChoice = computed(() => {
    const out = {};
    for (const s of gearSlots.value) {
        const p = gearPicks[s.slot];
        if (!p?.base || (s.slot === 'off_hand' && twoHanded.value))
            continue;
        out[s.slot] = { base: p.base, tier: p.tier };
    }
    return out;
});
const gearBudget = computed(() => settings.gearBudget());
const gearSpent = computed(() => creationCost(classId.value, gearChoice.value));
const gearOver = computed(() => gearSpent.value > gearBudget.value);
const slotCost = (slot, template) => {
    const p = gearChoice.value[slot];
    return p ? (template ? p.tier - 1 : p.tier) : 0;
};
const preview = (base, tier) => creationPiece(base, tier);
// ---- 奴隸出身 ----
const slave = ref(false);
const masterMode = ref('candidate');
const masterSeed = ref(Math.floor(Math.random() * 2 ** 31));
const candidates = computed(() => masterCandidates(birthplace.value, masterSeed.value));
const pickedMaster = ref(0);
const customMaster = reactive({ name: '', gender: 'male', race: 'human', class: 'fighter', level: 5, personality: '', appearance: '' });
const mark = ref(slaveryRules.roles.default);
function slaveStart() {
    if (!slave.value)
        return undefined;
    const master = masterMode.value === 'none'
        ? { type: 'none' }
        : masterMode.value === 'custom'
            ? { type: 'custom', spec: { ...customMaster } }
            : { type: 'candidate', rec: candidates.value[pickedMaster.value] };
    return { master, mark: typeof mark.value === 'string' ? mark.value : { ...mark.value } };
}
function start() {
    // 進行中的遊戲會被蓋掉：提醒（會先備份到自動存檔欄位）
    const cur = game.resumeMeta;
    if (cur && !confirm(`進行中的遊戲（${slotTitle(cur)}）會被新的冒險蓋掉。\n它會先備份到自動存檔欄位，之後可以從「讀取存檔」找回。確定開新遊戲？`))
        return;
    if (gearOver.value) {
        game.error = `起始裝備超過預算（${gearSpent.value}／${gearBudget.value} 點）`;
        return;
    }
    const s = slaveStart();
    game.start(name.value.trim() || '旅人', race.value, classId.value, { ...bonus }, {
        birthplace: birthplace.value,
        gender: gender.value,
        appearance: appearance.value,
        background: background.value,
        ...(s ? { slave: s } : {}),
        ...(perks.value.length ? { perks: [...perks.value] } : {}),
        ...(customPerks.value.length ? { customPerks: customPerks.value.map((p) => ({ ...p })) } : {}),
        gear: { ...gearChoice.value },
        gearBudget: gearBudget.value,
        options: { defeatLoot: defeatLoot.value },
    }, content.active);
}
/** 這個存檔的規則：在地下城戰敗時，這趟撿到的東西 */
const defeatLoot = ref('half');
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(content, {});
// @ts-ignore
__VLS_withDotValue(attributeRules, {});
// @ts-ignore
__VLS_withDotValue(racePerk, {});
// @ts-ignore
__VLS_withDotValue(cls, {});
// @ts-ignore
__VLS_withDotValue(abilities, {});
// @ts-ignore
__VLS_withDotValue(attrs, {});
// @ts-ignore
__VLS_withDotValue(bonus, {});
// @ts-ignore
__VLS_withDotValue(classId, {});
// @ts-ignore
__VLS_withDotValue(gearPicks, {});
// @ts-ignore
__VLS_withDotValue(gearRules, {});
// @ts-ignore
__VLS_withDotValue(twoHanded, {});
// @ts-ignore
__VLS_withDotValue(gearOver, {});
// @ts-ignore
__VLS_withDotValue(slave, {});
// @ts-ignore
__VLS_withDotValue(masterMode, {});
// @ts-ignore
__VLS_withDotValue(masterSeed, {});
// @ts-ignore
__VLS_withDotValue(customMaster, {});
void {};
/** @type {__VLS_StyleScopedClasses['world']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['attrs']} */ ;
/** @type {__VLS_StyleScopedClasses['attrs']} */ ;
/** @type {__VLS_StyleScopedClasses['profile']} */ ;
/** @type {__VLS_StyleScopedClasses['profile']} */ ;
/** @type {__VLS_StyleScopedClasses['profile']} */ ;
/** @type {__VLS_StyleScopedClasses['derived']} */ ;
/** @type {__VLS_StyleScopedClasses['gear-pick']} */ ;
/** @type {__VLS_StyleScopedClasses['gear-table']} */ ;
/** @type {__VLS_StyleScopedClasses['gear-table']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['gear-table']} */ ;
/** @type {__VLS_StyleScopedClasses['slave']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-master']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-master']} */ ;
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "panel" },
});
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row world" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
/** @type {__VLS_StyleScopedClasses['world']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (pickWorld($event.target.value));
        } },
    value: (content.value.active),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (__VLS_unwrap(VANILLA, {})),
});
(__VLS_unwrap(VANILLA_NAME, {}));
const __VLS_0 = __VLS_tryAsConstant((content.value.worlds));
for (const [w] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (w.id),
        value: (w.id),
    });
    (w.name);
    (__VLS_unwrap(modTotal, {})(w.mods));
    // @ts-ignore
    [content, content, VANILLA, VANILLA_NAME, modTotal,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "muted small" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "layout" },
});
/** @type {__VLS_StyleScopedClasses['layout']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "form" },
});
/** @type {__VLS_StyleScopedClasses['form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "旅人",
    maxlength: "20",
});
(__VLS_unwrap(name, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    placeholder: "自由填寫，例如：女、男、不明",
    maxlength: "20",
});
(__VLS_unwrap(gender, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(race, {})),
});
const __VLS_1 = __VLS_tryAsConstant((attributeRules.value.races));
for (const [r, id] of __VLS_vFor(__VLS_nonNull(__VLS_1))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (id),
        value: (id),
    });
    (r.name);
    // @ts-ignore
    [name, gender, race, attributeRules,];
}
if (racePerk.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (racePerk.value.name);
    (racePerk.value.desc);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (classId.value),
});
const __VLS_2 = __VLS_tryAsConstant((__VLS_unwrap(classes, {})));
for (const [c, id] of __VLS_vFor(__VLS_nonNull(__VLS_2))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (id),
        value: (id),
    });
    (c.name);
    // @ts-ignore
    [racePerk, racePerk, racePerk, classId, classes,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(cls.value.role);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_3 = __VLS_tryAsConstant((cls.value.start));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_3))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (a),
        ...{ class: "tag" },
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (abilities.value[a]?.name);
    // @ts-ignore
    [cls, cls, abilities,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(birthplace, {})),
});
const __VLS_4 = __VLS_tryAsConstant((__VLS_unwrap(regions, {})));
for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_4))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.optgroup, __VLS_intrinsics.optgroup)({
        key: (g.region.id),
        label: (g.region.name),
    });
    const __VLS_5 = __VLS_tryAsConstant((g.places));
    for (const [l] of __VLS_vFor(__VLS_nonNull(__VLS_5))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (l.id),
            value: (l.id),
        });
        (l.name);
        // @ts-ignore
        [birthplace, regions,];
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(birthplaceInfo, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_unwrap(defeatLoot, {})),
});
const __VLS_6 = __VLS_tryAsConstant((__VLS_unwrap(DEFEAT_LOOT_NAME, {})));
for (const [n, k] of __VLS_vFor(__VLS_nonNull(__VLS_6))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (k),
        value: (k),
    });
    (n);
    // @ts-ignore
    [birthplaceInfo, defeatLoot, DEFEAT_LOOT_NAME,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "small" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
(__VLS_unwrap(bonus_points, {}) - __VLS_unwrap(spent, {}));
(__VLS_unwrap(bonus_points, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "attrs small" },
});
/** @type {__VLS_StyleScopedClasses['attrs']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
const __VLS_7 = __VLS_tryAsConstant((attributeRules.value.attributes));
for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_7))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (a.id),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        title: (a.desc),
    });
    (a.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "num" },
    });
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    (attrs.value[a.id]);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(signed, {})(__VLS_unwrap(mod, {})(attrs.value[a.id])));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (add(a.id, -1));
                // @ts-ignore
                [attributeRules, bonus_points, bonus_points, spent, attrs, attrs, signed, mod,];
            } },
        ...{ class: "small" },
        disabled: (bonus.value[a.id] === 0),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: // @ts-ignore
            (...[$event]) => {
                void $event;
                return (add(a.id, 1));
                // @ts-ignore
                [bonus,];
            } },
        ...{ class: "small" },
        disabled: (__VLS_unwrap(spent, {}) >= __VLS_unwrap(bonus_points, {}) || attrs.value[a.id] >= __VLS_unwrap(max_score, {})),
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    // @ts-ignore
    [bonus_points, spent, attrs, max_score,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "plain small derived" },
});
/** @type {__VLS_StyleScopedClasses['plain']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['derived']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
(__VLS_unwrap(maxHpFor, {})(1, attrs.value));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
(__VLS_unwrap(apMaxFor, {})(1, attrs.value));
(__VLS_unwrap(apRegenFor, {})(1));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
(__VLS_unwrap(slotMaxFor, {})(classId.value, 1, attrs.value).length ? __VLS_unwrap(slotMaxFor, {})(classId.value, 1, attrs.value).map((n, i) => `${i + 1}環×${n}`).join('、') : '無');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
(__VLS_unwrap(luckyThreshold, {})(attrs.value));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "muted" },
});
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "profile" },
});
/** @type {__VLS_StyleScopedClasses['profile']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_unwrap(appearance, {})),
    rows: "3",
    maxlength: "400",
    placeholder: "例如：灰藍色的短髮，左眉有一道舊疤，總是穿著洗到褪色的旅行斗篷。",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_unwrap(background, {})),
    rows: "4",
    maxlength: "800",
    placeholder: "例如：河谷鎮鐵匠的次子，為了尋找失蹤的哥哥而成為冒險者；不太會說謊，對魔族有說不出口的心結。",
});
const __VLS_8 = PerkPicker;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
    // @ts-ignore
    perks: (__VLS_unwrap(perks, {})), custom: (__VLS_unwrap(customPerks, {})), race: (__VLS_unwrap(race, {})), cls: (classId.value),
}));
const __VLS_10 = __VLS_9({
    perks: (__VLS_unwrap(perks, {})),
    custom: (__VLS_unwrap(customPerks, {})),
    race: (__VLS_unwrap(race, {})),
    cls: (classId.value),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
    ...{ class: "gear-pick" },
});
/** @type {__VLS_StyleScopedClasses['gear-pick']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
    ...{ class: ({ over: gearOver.value }) },
});
/** @type {__VLS_StyleScopedClasses['over']} */ ;
(__VLS_unwrap(gearSpent, {}));
(__VLS_unwrap(gearBudget, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "small muted" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
(__VLS_unwrap(maxTier, {}));
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "small gear-table" },
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['gear-table']} */ ;
const __VLS_13 = __VLS_tryAsConstant((__VLS_unwrap(gearSlots, {})));
for (const [s] of __VLS_vFor(__VLS_nonNull(__VLS_13))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (s.slot),
        ...{ class: ({ off: s.slot === 'off_hand' && twoHanded.value }) },
    });
    /** @type {__VLS_StyleScopedClasses['off']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    (__VLS_unwrap(slotName, {})(s.slot));
    if (s.template) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (gearPicks.value[s.slot].base),
        disabled: (s.slot === 'off_hand' && twoHanded.value),
    });
    if (!s.template) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
    }
    const __VLS_14 = __VLS_tryAsConstant((s.bases));
    for (const [b] of __VLS_vFor(__VLS_nonNull(__VLS_14))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (b),
            value: (b),
        });
        (gearRules.value.bases[b]?.name ?? b);
        // @ts-ignore
        [race, classId, classId, classId, attrs, attrs, attrs, attrs, attrs, maxHpFor, apMaxFor, apRegenFor, slotMaxFor, slotMaxFor, luckyThreshold, appearance, background, perks, customPerks, gearOver, gearSpent, gearBudget, maxTier, gearSlots, twoHanded, twoHanded, slotName, gearPicks, gearRules,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (gearPicks.value[s.slot].tier),
        disabled: (!gearPicks.value[s.slot].base || (s.slot === 'off_hand' && twoHanded.value)),
    });
    const __VLS_15 = __VLS_tryAsConstant((__VLS_unwrap(tiers, {})));
    for (const [t] of __VLS_vFor(__VLS_nonNull(__VLS_15))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (t),
            value: (t),
        });
        (t);
        // @ts-ignore
        [twoHanded, gearPicks, gearPicks, tiers,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "muted" },
    });
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    if (s.slot === 'off_hand' && twoHanded.value) {
    }
    else if (gearPicks.value[s.slot].base) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            title: (__VLS_unwrap(gearSummary, {})(__VLS_unwrap(preview, {})(gearPicks.value[s.slot].base, gearPicks.value[s.slot].tier).spec)),
        });
        (__VLS_unwrap(preview, {})(gearPicks.value[s.slot].base, gearPicks.value[s.slot].tier).name);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "num" },
    });
    /** @type {__VLS_StyleScopedClasses['num']} */ ;
    (__VLS_unwrap(slotCost, {})(s.slot, s.template) ? `${__VLS_unwrap(slotCost, {})(s.slot, s.template)} 點` : '');
    // @ts-ignore
    [twoHanded, gearPicks, gearPicks, gearPicks, gearPicks, gearPicks, gearSummary, preview, preview, slotCost, slotCost,];
}
if (gearOver.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small over" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['over']} */ ;
    (__VLS_unwrap(gearSpent, {}) - __VLS_unwrap(gearBudget, {}));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (resetGear) },
    ...{ class: "small" },
    type: "button",
});
/** @type {__VLS_StyleScopedClasses['small']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "slave" },
});
/** @type {__VLS_StyleScopedClasses['slave']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "check" },
});
/** @type {__VLS_StyleScopedClasses['check']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
});
(slave.value);
if (slave.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
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
        value: "candidate",
    });
    (masterMode.value);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: "custom",
    });
    (masterMode.value);
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "check" },
    });
    /** @type {__VLS_StyleScopedClasses['check']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "radio",
        value: "none",
    });
    (masterMode.value);
    if (masterMode.value === 'candidate') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "masters" },
        });
        /** @type {__VLS_StyleScopedClasses['masters']} */ ;
        const __VLS_16 = __VLS_tryAsConstant((__VLS_unwrap(candidates, {})));
        for (const [m, i] of __VLS_vFor(__VLS_nonNull(__VLS_16))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                key: (m.id),
                ...{ class: "master small" },
            });
            /** @type {__VLS_StyleScopedClasses['master']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "radio",
                value: (i),
            });
            (__VLS_unwrap(pickedMaster, {}));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            const __VLS_17 = NameTag;
            // @ts-ignore
            const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
                // @ts-ignore
                name: (m.name), race: (m.race), cls: (m.class), gender: (m.gender),
            }));
            const __VLS_19 = __VLS_18({
                name: (m.name),
                race: (m.race),
                cls: (m.class),
                gender: (m.gender),
            }, ...__VLS_functionalComponentArgsRest(__VLS_18));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (__VLS_unwrap(genderName, {})(m.gender));
            (__VLS_unwrap(raceName, {})(m.race));
            if (m.lineage) {
                (m.lineage);
            }
            (__VLS_unwrap(npcTitle, {})(m));
            (m.level);
            ((m.tags ?? []).map((t) => __VLS_unwrap(tagDef, {})(t)?.name).join('、'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (m.personality);
            __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (m.appearance);
            // @ts-ignore
            [gearOver, gearSpent, gearBudget, slave, slave, masterMode, masterMode, masterMode, masterMode, candidates, pickedMaster, genderName, raceName, npcTitle, tagDef,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(slave.value))
                        throw 0;
                    if (!(masterMode.value === 'candidate'))
                        throw 0;
                    return (masterSeed.value = Math.floor(Math.random() * 2 ** 31));
                    // @ts-ignore
                    [masterSeed,];
                } },
            ...{ class: "small" },
            type: "button",
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
    }
    else if (masterMode.value === 'custom') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "custom-master small" },
        });
        /** @type {__VLS_StyleScopedClasses['custom-master']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "12",
            placeholder: "留空則隨機",
        });
        (customMaster.value.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (customMaster.value.gender),
        });
        const __VLS_22 = __VLS_tryAsConstant((__VLS_unwrap(GENDER_IDS, {})));
        for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_22))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (g),
                value: (g),
            });
            (__VLS_unwrap(genderName, {})(g));
            // @ts-ignore
            [masterMode, genderName, customMaster, customMaster, GENDER_IDS,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (customMaster.value.race),
        });
        const __VLS_23 = __VLS_tryAsConstant((attributeRules.value.races));
        for (const [r, id] of __VLS_vFor(__VLS_nonNull(__VLS_23))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (id),
                value: (id),
            });
            (r.name);
            // @ts-ignore
            [attributeRules, customMaster,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (customMaster.value.class),
        });
        const __VLS_24 = __VLS_tryAsConstant((__VLS_unwrap(classes, {})));
        for (const [c, id] of __VLS_vFor(__VLS_nonNull(__VLS_24))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (id),
                value: (id),
            });
            (c.name);
            // @ts-ignore
            [classes, customMaster,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "number",
            min: "1",
            max: "20",
        });
        (customMaster.value.level);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "wide" },
        });
        /** @type {__VLS_StyleScopedClasses['wide']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "120",
        });
        (customMaster.value.personality);
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "wide" },
        });
        /** @type {__VLS_StyleScopedClasses['wide']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            maxlength: "200",
        });
        (customMaster.value.appearance);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "small" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_25 = MarkPicker;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
        // @ts-ignore
        modelValue: (__VLS_unwrap(mark, {})), allowCustom: true,
    }));
    const __VLS_27 = __VLS_26({
        modelValue: (__VLS_unwrap(mark, {})),
        allowCustom: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "row" },
});
/** @type {__VLS_StyleScopedClasses['row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (start) },
    ...{ class: "primary" },
    disabled: (gearOver.value),
});
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('home'));
            // @ts-ignore
            [gearOver, customMaster, customMaster, customMaster, mark, emit,];
        } },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: // @ts-ignore
        (...[$event]) => {
            void $event;
            return (__VLS_unwrap(emit, {})('settings'));
            // @ts-ignore
            [emit,];
        } },
});
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
