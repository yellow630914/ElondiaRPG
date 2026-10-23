import { computed, reactive, ref } from 'vue';
import { abilityQuality, apMaxFor, apRegenFor, attrSources, attrsOf, castingAttr, evadeFloor, gearAffinities, guildRankFor, luckyThreshold, mod, proficiency, rerollsLeft, slotMaxFor, weaponFor, xpToNext, } from '@/engine/character';
import { abilityApCost } from '@/engine/combat';
import { playerRank } from '@/engine/guild';
import { abilityDef, armorDef, attributeRules, attrName, className, classDef, companionRules, conditionName, damageTypeName, genderName, locationById, raceName, slaveryRules, } from '@/engine/data';
import { isBound, isNoncombatant, leaderOf } from '@/engine/party';
import { perksOf } from '@/engine/perks';
import { contractTerms } from '@/engine/slavery';
import { gearSummary, SLOTS, slotName } from '@/engine/gear';
import { hitDiceLeft, hitDie } from '@/engine/rest';
import { lockedGear } from '@/engine/inventory';
import { useGame } from '@/stores/game';
import { useSettings } from '@/stores/settings';
import StatBar from './StatBar.vue';
import NameTag from './NameTag.vue';
import PortraitBox from './PortraitBox.vue';
import FoldSection from './FoldSection.vue';
import { contractOf, oathText, placeName, TATTOO_PLACES, tattooAt, tattooDesc, tattooKindName, tattooName, tattoosOf } from '@/engine/tattoos';
const QUALITY_NAME = {
    common: '普通', uncommon: '優良', rare: '稀有', epic: '史詩', legendary: '傳說', mythic: '神話',
};
const TYPE_NAME = { skill: '技能', spell: '法術', cantrip: '戲法' };
const game = useGame();
const settings = useSettings();
const s = computed(() => game.state);
const inCombat = computed(() => !!s.value.combat);
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);
const leader = computed(() => leaderOf(s.value));
// ---- 主角設定 ----
const editingProfile = ref(false);
const profile = reactive({ gender: '', appearance: '', background: '' });
function startProfile(m) {
    profile.gender = m.gender ?? '';
    profile.appearance = m.appearance ?? '';
    profile.background = m.background ?? '';
    editingProfile.value = true;
}
function saveProfile() {
    game.editProfile({ ...profile });
    editingProfile.value = false;
}
const bound = computed(() => isBound(s.value));
function contractFor(m) {
    const c = contractOf(m);
    return c ? { ...c, def: contractTerms(c) } : null;
}
function grouped(m) {
    const list = m.abilities.map(abilityDef);
    return ['skill', 'spell', 'cantrip']
        .map((t) => ({
        type: t,
        items: list.filter((a) => a.type === t).sort((a, b) => (a.circle ?? a.unlock ?? 0) - (b.circle ?? b.unlock ?? 0)),
    }))
        .filter((g) => g.items.length > 0);
}
function abilityMeta(a) {
    const parts = [];
    if (a.type === 'spell')
        parts.push(`${a.circle} 環`);
    parts.push(a.type === 'cantrip' ? '0 AP' : `${abilityApCost(a)} AP`);
    if (a.attr)
        parts.push(a.attr === 'casting' ? '施法屬性' : attrName(a.attr));
    if (a.concentration)
        parts.push('專注');
    return parts.join('・');
}
function slotsText(m) {
    const max = slotMaxFor(m.class, m.level, attrsOf(m));
    if (!max.length)
        return '無';
    return max.map((n, i) => `${i + 1}環 ${Math.max(0, n - (m.slotsUsed[i] ?? 0))}/${n}`).join('、');
}
/** 屬性的來源說明：基礎值與每一項加減（沒有加減時為空） */
function attrNote(m, a) {
    const parts = attrSources(m).filter((s) => s.attrs[a]).map((s) => `${s.label} ${signed(s.attrs[a])}`);
    return parts.length ? `基礎 ${m.attrs[a]}・${parts.join('・')}` : '';
}
function affinityText(m) {
    const gear = gearAffinities(m);
    const entries = Object.entries(gear.resist).filter(([, v]) => v);
    if (!entries.length)
        return '無';
    return entries.map(([k, v]) => `${damageTypeName(k)} ×${Math.max(0, 1 + (v ?? 0))}`).join('、');
}
const __VLS_ctx = {};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
void __VLS_ctx, __VLS_components, __VLS_intrinsics, __VLS_directives;
// @ts-ignore
__VLS_withDotValue(s, {});
// @ts-ignore
__VLS_withDotValue(companionRules, {});
// @ts-ignore
__VLS_withDotValue(slaveryRules, {});
// @ts-ignore
__VLS_withDotValue(game, {});
// @ts-ignore
__VLS_withDotValue(attributeRules, {});
// @ts-ignore
__VLS_withDotValue(SLOTS, {});
// @ts-ignore
__VLS_withDotValue(inCombat, {});
// @ts-ignore
__VLS_withDotValue(editingProfile, {});
// @ts-ignore
__VLS_withDotValue(profile, {});
// @ts-ignore
__VLS_withDotValue(settings, {});
// @ts-ignore
__VLS_withDotValue(TYPE_NAME, {});
// @ts-ignore
__VLS_withDotValue(QUALITY_NAME, {});
// @ts-ignore
__VLS_withDotValue(leader, {});
// @ts-ignore
__VLS_withDotValue(bound, {});
void {};
/** @type {__VLS_StyleScopedClasses['gear']} */ ;
/** @type {__VLS_StyleScopedClasses['attrs']} */ ;
/** @type {__VLS_StyleScopedClasses['attrs']} */ ;
/** @type {__VLS_StyleScopedClasses['tattoos']} */ ;
/** @type {__VLS_StyleScopedClasses['slot']} */ ;
/** @type {__VLS_StyleScopedClasses['tattoos']} */ ;
/** @type {__VLS_StyleScopedClasses['tattoos']} */ ;
/** @type {__VLS_StyleScopedClasses['tattoos']} */ ;
/** @type {__VLS_StyleScopedClasses['tattoos']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tattoos']} */ ;
/** @type {__VLS_StyleScopedClasses['oath-attrs']} */ ;
/** @type {__VLS_StyleScopedClasses['attrs']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['slave']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-edit']} */ ;
/** @type {__VLS_StyleScopedClasses['profile-edit']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
const __VLS_0 = __VLS_tryAsConstant((s.value.party));
for (const [m] of __VLS_vFor(__VLS_nonNull(__VLS_0))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        key: (m.id),
        ...{ class: "panel member" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    /** @type {__VLS_StyleScopedClasses['member']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    const __VLS_1 = NameTag;
    // @ts-ignore
    const __VLS_2 = __VLS_asFunctionalComponent1(__VLS_1, new __VLS_1({
        // @ts-ignore
        id: (m.id),
    }));
    const __VLS_3 = __VLS_2({
        id: (m.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_2));
    if (m.isPlayer) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag pc" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['pc']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tag" },
        title: (m.isPlayer ? '冒險者公會的階級（功績與晉升考核）' : '依等級換算的階級'),
    });
    /** @type {__VLS_StyleScopedClasses['tag']} */ ;
    (m.isPlayer ? __VLS_unwrap(playerRank, {})(s.value) : __VLS_unwrap(guildRankFor, {})(m.level));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    if (m.gender) {
        (__VLS_unwrap(genderName, {})(m.gender));
    }
    (__VLS_unwrap(raceName, {})(m.race));
    (__VLS_unwrap(className, {})(m.class));
    (m.level);
    (m.xp);
    (__VLS_unwrap(xpToNext, {})(m.level));
    const __VLS_6 = PortraitBox;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        // @ts-ignore
        id: (m.id),
    }));
    const __VLS_8 = __VLS_7({
        id: (m.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "row small" },
    });
    /** @type {__VLS_StyleScopedClasses['row']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    if (m.bond) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
            ...{ class: (m.bond) },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (companionRules.value.bonds[m.bond]);
    }
    if (m.group && m.bond !== 'leader') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tag" },
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        (s.value.party.find((x) => x.id === m.group)?.name);
    }
    const __VLS_11 = __VLS_tryAsConstant((m.status));
    for (const [c] of __VLS_vFor(__VLS_nonNull(__VLS_11))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (c),
            ...{ class: "tag warn" },
            title: (companionRules.value.conditions[c]?.desc),
        });
        /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        /** @type {__VLS_StyleScopedClasses['warn']} */ ;
        (__VLS_unwrap(conditionName, {})(c));
        // @ts-ignore
        [s, s, s, playerRank, guildRankFor, genderName, raceName, className, xpToNext, companionRules, companionRules, conditionName,];
    }
    const __VLS_12 = StatBar;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        // @ts-ignore
        kind: "hp", value: (m.hp), max: (m.maxHp),
    }));
    const __VLS_14 = __VLS_13({
        kind: "hp",
        value: (m.hp),
        max: (m.maxHp),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "small muted" },
    });
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    (__VLS_unwrap(hitDie, {})(m));
    (__VLS_unwrap(hitDiceLeft, {})(m));
    (m.level);
    if (contractFor(m)) {
        const __VLS_17 = FoldSection || FoldSection;
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
            // @ts-ignore
            id: "party.contract", title: (`⛓️ ${contractFor(m).def.name}`),
        }));
        const __VLS_19 = __VLS_18({
            id: "party.contract",
            title: (`⛓️ ${contractFor(m).def.name}`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_18));
        const { default: __VLS_22 } = __VLS_nonNull(__VLS_20.slots);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "contract small" },
        });
        /** @type {__VLS_StyleScopedClasses['contract']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (contractFor(m).masterName || '無主');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (contractFor(m).def.mark);
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        const __VLS_23 = __VLS_tryAsConstant((contractFor(m).def.functions));
        for (const [f] of __VLS_vFor(__VLS_nonNull(__VLS_23))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (f),
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (slaveryRules.value.functions[f]);
            // @ts-ignore
            [hitDie, hitDiceLeft, slaveryRules,];
        }
        const __VLS_24 = __VLS_tryAsConstant((contractFor(m).def.side_effects));
        for (const [e] of __VLS_vFor(__VLS_nonNull(__VLS_24))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (e),
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (e);
            // @ts-ignore
            [];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (Math.round(contractFor(m).def.income_share * 100));
        (contractFor(m).def.negotiate_dc);
        (contractFor(m).def.escape_dc);
        (contractFor(m).def.exit_dc);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (contractFor(m).obedience);
        if (__VLS_unwrap(contractOf, {})(m)?.master === 'pc') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(contractFor(m)))
                            throw 0;
                        if (!(__VLS_unwrap(contractOf, {})(m)?.master === 'pc'))
                            throw 0;
                        return (game.value.releaseSlave(m.id));
                        // @ts-ignore
                        [contractOf, game,];
                    } },
                ...{ class: "small" },
                disabled: (inCombat.value),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        // @ts-ignore
        [inCombat,];
        var __VLS_20;
    }
    if (m.attrPoints > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (m.attrPoints);
    }
    const __VLS_25 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
        // @ts-ignore
        id: "party.stats", title: "📊 屬性與戰鬥數值",
    }));
    const __VLS_27 = __VLS_26({
        id: "party.stats",
        title: "📊 屬性與戰鬥數值",
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    const { default: __VLS_30 } = __VLS_nonNull(__VLS_28.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "attrs small" },
    });
    /** @type {__VLS_StyleScopedClasses['attrs']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_31 = __VLS_tryAsConstant((attributeRules.value.attributes));
    for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_31))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (a.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            title: (a.desc),
        });
        (a.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "num" },
            ...{ class: ({ changed: attrNote(m, a.id) }) },
            title: (attrNote(m, a.id)),
        });
        /** @type {__VLS_StyleScopedClasses['num']} */ ;
        /** @type {__VLS_StyleScopedClasses['changed']} */ ;
        (__VLS_unwrap(attrsOf, {})(m)[a.id]);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (__VLS_unwrap(signed, {})(__VLS_unwrap(mod, {})(__VLS_unwrap(attrsOf, {})(m)[a.id])));
        if (attrNote(m, a.id)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (m.attrs[a.id]);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (m.attrPoints > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(m.attrPoints > 0))
                            throw 0;
                        return (game.value.spendAttr(m.id, a.id));
                        // @ts-ignore
                        [game, attributeRules, attrsOf, attrsOf, signed, mod,];
                    } },
                ...{ class: "small" },
                disabled: (inCombat.value),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
        // @ts-ignore
        [inCombat,];
    }
    if (__VLS_unwrap(isNoncombatant, {})(m)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain small stats" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['stats']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        (__VLS_unwrap(apMaxFor, {})(m.level, __VLS_unwrap(attrsOf, {})(m)));
        (__VLS_unwrap(apRegenFor, {})(m.level));
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        (slotsText(m));
        if (__VLS_unwrap(classDef, {})(m.class).caster !== 'none') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
            (__VLS_unwrap(attrName, {})(__VLS_unwrap(castingAttr, {})(m.class)));
            (__VLS_unwrap(proficiency, {})(m.level));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        (__VLS_unwrap(luckyThreshold, {})(__VLS_unwrap(attrsOf, {})(m), __VLS_unwrap(gearAffinities, {})(m).mods.crit ?? 0));
        (__VLS_unwrap(evadeFloor, {})(__VLS_unwrap(attrsOf, {})(m)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        (__VLS_unwrap(weaponFor, {})(m).name);
        (__VLS_unwrap(weaponFor, {})(m).dice);
        (__VLS_unwrap(damageTypeName, {})(__VLS_unwrap(weaponFor, {})(m).type));
        (__VLS_unwrap(attrName, {})(__VLS_unwrap(weaponFor, {})(m).attr));
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        (__VLS_unwrap(armorDef, {})(m.armor).name);
        (__VLS_unwrap(signed, {})(__VLS_unwrap(armorDef, {})(m.armor).evade));
        (__VLS_unwrap(armorDef, {})(m.armor).dr);
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({});
        (affinityText(m));
    }
    // @ts-ignore
    [attrsOf, attrsOf, attrsOf, signed, isNoncombatant, apMaxFor, apRegenFor, classDef, attrName, attrName, castingAttr, proficiency, luckyThreshold, gearAffinities, evadeFloor, weaponFor, weaponFor, weaponFor, weaponFor, damageTypeName, armorDef, armorDef, armorDef,];
    var __VLS_28;
    const __VLS_32 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
        // @ts-ignore
        id: "party.perks", title: "🌟 特質", count: (__VLS_unwrap(perksOf, {})(m).length),
    }));
    const __VLS_34 = __VLS_33({
        id: "party.perks",
        title: "🌟 特質",
        count: (__VLS_unwrap(perksOf, {})(m).length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    const { default: __VLS_37 } = __VLS_nonNull(__VLS_35.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain small" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_38 = __VLS_tryAsConstant((__VLS_unwrap(perksOf, {})(m)));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_38))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (p.id),
        });
        if (p.race) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        }
        if (p.flaw) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
        }
        (p.name);
        (p.desc);
        if (p.custom) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        // @ts-ignore
        [perksOf, perksOf,];
    }
    if (!__VLS_unwrap(perksOf, {})(m).length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    if (m.perkOffers?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "muted" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (m.perkOffers.length);
    }
    // @ts-ignore
    [perksOf,];
    var __VLS_35;
    if (!__VLS_unwrap(isNoncombatant, {})(m) || m.gear) {
        const __VLS_39 = FoldSection || FoldSection;
        // @ts-ignore
        const __VLS_40 = __VLS_asFunctionalComponent1(__VLS_39, new __VLS_39({
            // @ts-ignore
            id: "party.gear", title: "🛡️ 裝備", count: (SLOTS.value.filter((x) => m.gear?.[x]).length),
        }));
        const __VLS_41 = __VLS_40({
            id: "party.gear",
            title: "🛡️ 裝備",
            count: (SLOTS.value.filter((x) => m.gear?.[x]).length),
        }, ...__VLS_functionalComponentArgsRest(__VLS_40));
        const { default: __VLS_44 } = __VLS_nonNull(__VLS_42.slots);
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "plain gear small" },
        });
        /** @type {__VLS_StyleScopedClasses['plain']} */ ;
        /** @type {__VLS_StyleScopedClasses['gear']} */ ;
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        const __VLS_45 = __VLS_tryAsConstant((SLOTS.value));
        for (const [slot] of __VLS_vFor(__VLS_nonNull(__VLS_45))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (slot),
                ...{ class: "row" },
            });
            /** @type {__VLS_StyleScopedClasses['row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted slot" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            /** @type {__VLS_StyleScopedClasses['slot']} */ ;
            (__VLS_unwrap(slotName, {})(slot));
            if (m.gear?.[slot]) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    title: (__VLS_unwrap(gearSummary, {})(m.gear[slot].spec)),
                });
                (__VLS_unwrap(lockedGear, {})(m, slot) ? '🔒 ' : '');
                (m.gear[slot].name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (__VLS_unwrap(gearSummary, {})(m.gear[slot].spec));
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(!__VLS_unwrap(isNoncombatant, {})(m) || m.gear))
                                throw 0;
                            if (!(m.gear?.[slot]))
                                throw 0;
                            return (game.value.unequipItem(m.id, slot));
                            // @ts-ignore
                            [game, isNoncombatant, SLOTS, SLOTS, slotName, gearSummary, gearSummary, lockedGear,];
                        } },
                    ...{ class: "small" },
                    disabled: (inCombat.value || !!__VLS_unwrap(lockedGear, {})(m, slot)),
                    title: (__VLS_unwrap(lockedGear, {})(m, slot) ? '主人強制戴上的，契約還在時不能拿下' : ''),
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            }
            // @ts-ignore
            [inCombat, lockedGear, lockedGear,];
        }
        // @ts-ignore
        [];
        var __VLS_42;
    }
    const __VLS_46 = FoldSection || FoldSection;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        // @ts-ignore
        id: "party.tattoos", title: "🖋️ 刺青", count: (__VLS_unwrap(tattoosOf, {})(m).length),
    }));
    const __VLS_48 = __VLS_47({
        id: "party.tattoos",
        title: "🖋️ 刺青",
        count: (__VLS_unwrap(tattoosOf, {})(m).length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    const { default: __VLS_51 } = __VLS_nonNull(__VLS_49.slots);
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "plain gear tattoos small" },
    });
    /** @type {__VLS_StyleScopedClasses['plain']} */ ;
    /** @type {__VLS_StyleScopedClasses['gear']} */ ;
    /** @type {__VLS_StyleScopedClasses['tattoos']} */ ;
    /** @type {__VLS_StyleScopedClasses['small']} */ ;
    const __VLS_52 = __VLS_tryAsConstant((__VLS_unwrap(TATTOO_PLACES, {})));
    for (const [p] of __VLS_vFor(__VLS_nonNull(__VLS_52))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (p),
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "muted slot" },
        });
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['slot']} */ ;
        (__VLS_unwrap(placeName, {})(p));
        if (__VLS_unwrap(tattooAt, {})(m, p)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tag" },
                ...{ class: (__VLS_unwrap(tattooAt, {})(m, p).kind) },
            });
            /** @type {__VLS_StyleScopedClasses['tag']} */ ;
            (__VLS_unwrap(tattooKindName, {})(__VLS_unwrap(tattooAt, {})(m, p).kind));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                title: (__VLS_unwrap(tattooDesc, {})(__VLS_unwrap(tattooAt, {})(m, p))),
            });
            (__VLS_unwrap(tattooName, {})(__VLS_unwrap(tattooAt, {})(m, p)));
            if (__VLS_unwrap(tattooAt, {})(m, p).kind === 'oath' && __VLS_unwrap(tattooAt, {})(m, p).attrs) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "oath-attrs" },
                });
                /** @type {__VLS_StyleScopedClasses['oath-attrs']} */ ;
                (__VLS_unwrap(oathText, {})(__VLS_unwrap(tattooAt, {})(m, p).attrs));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted desc" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            /** @type {__VLS_StyleScopedClasses['desc']} */ ;
            (__VLS_unwrap(tattooDesc, {})(__VLS_unwrap(tattooAt, {})(m, p)));
            if (__VLS_unwrap(tattooAt, {})(m, p).by) {
                (__VLS_unwrap(tattooAt, {})(m, p).by);
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        }
        // @ts-ignore
        [tattoosOf, TATTOO_PLACES, placeName, tattooAt, tattooAt, tattooAt, tattooAt, tattooAt, tattooAt, tattooAt, tattooAt, tattooAt, tattooAt, tattooAt, tattooKindName, tattooDesc, tattooDesc, tattooName, oathText,];
    }
    if (m.isPlayer) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
    }
    // @ts-ignore
    [];
    var __VLS_49;
    if (m.personality || m.isPlayer) {
        const __VLS_53 = FoldSection || FoldSection;
        // @ts-ignore
        const __VLS_54 = __VLS_asFunctionalComponent1(__VLS_53, new __VLS_53({
            // @ts-ignore
            id: "party.profile", title: "📝 角色設定", closed: true,
        }));
        const __VLS_55 = __VLS_54({
            id: "party.profile",
            title: "📝 角色設定",
            closed: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_54));
        const { default: __VLS_58 } = __VLS_nonNull(__VLS_56.slots);
        if (m.personality) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (m.personality);
        }
        if (m.isPlayer) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "small profile" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['profile']} */ ;
            if (!editingProfile.value) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (m.gender || '—');
                if (m.birthplace) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "muted" },
                    });
                    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                    (__VLS_unwrap(locationById, {})(m.birthplace).name);
                }
                if (m.appearance) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "muted" },
                    });
                    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                    (m.appearance);
                }
                if (m.background) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "muted" },
                    });
                    /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                    (m.background);
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(m.personality || m.isPlayer))
                                throw 0;
                            if (!(m.isPlayer))
                                throw 0;
                            if (!(!editingProfile.value))
                                throw 0;
                            return (startProfile(m));
                            // @ts-ignore
                            [editingProfile, locationById,];
                        } },
                    ...{ class: "small" },
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
                    ...{ onSubmit: (saveProfile) },
                    ...{ class: "profile-edit" },
                });
                /** @type {__VLS_StyleScopedClasses['profile-edit']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    maxlength: "20",
                });
                (profile.value.gender);
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
                    value: (profile.value.appearance),
                    rows: "3",
                    maxlength: "400",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
                    value: (profile.value.background),
                    rows: "4",
                    maxlength: "800",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "row" },
                });
                /** @type {__VLS_StyleScopedClasses['row']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ class: "small primary" },
                    type: "submit",
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
                /** @type {__VLS_StyleScopedClasses['primary']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: // @ts-ignore
                        (...[$event]) => {
                            void $event;
                            if (!(m.personality || m.isPlayer))
                                throw 0;
                            if (!(m.isPlayer))
                                throw 0;
                            if (!!(!editingProfile.value))
                                throw 0;
                            return (editingProfile.value = false);
                            // @ts-ignore
                            [editingProfile, profile, profile, profile,];
                        } },
                    ...{ class: "small" },
                    type: "button",
                });
                /** @type {__VLS_StyleScopedClasses['small']} */ ;
            }
        }
        // @ts-ignore
        [];
        var __VLS_56;
    }
    if (m.pendingAbilityChoices?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "choose" },
        });
        /** @type {__VLS_StyleScopedClasses['choose']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
            ...{ class: "small" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(m.pendingAbilityChoices?.length))
                        throw 0;
                    return (game.value.rerollAbility(m.id));
                    // @ts-ignore
                    [game,];
                } },
            ...{ class: "small" },
            disabled: (inCombat.value || __VLS_unwrap(rerollsLeft, {})(m, settings.value.rerollLimit()) <= 0),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        (__VLS_unwrap(rerollsLeft, {})(m, settings.value.rerollLimit()));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "options" },
        });
        /** @type {__VLS_StyleScopedClasses['options']} */ ;
        const __VLS_59 = __VLS_tryAsConstant((m.pendingAbilityChoices[0]));
        for (const [id] of __VLS_vFor(__VLS_nonNull(__VLS_59))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(m.pendingAbilityChoices?.length))
                            throw 0;
                        return (game.value.chooseAbility(m.id, id));
                        // @ts-ignore
                        [game, inCombat, rerollsLeft, rerollsLeft, settings, settings,];
                    } },
                key: (id),
                ...{ class: "small option" },
                disabled: (inCombat.value),
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            /** @type {__VLS_StyleScopedClasses['option']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
            (__VLS_unwrap(abilityDef, {})(id).name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "muted" },
            });
            /** @type {__VLS_StyleScopedClasses['muted']} */ ;
            (TYPE_NAME.value[__VLS_unwrap(abilityDef, {})(id).type]);
            (QUALITY_NAME.value[__VLS_unwrap(abilityQuality, {})(__VLS_unwrap(abilityDef, {})(id))]);
            (abilityMeta(__VLS_unwrap(abilityDef, {})(id)));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_unwrap(abilityDef, {})(id).desc);
            // @ts-ignore
            [inCombat, abilityDef, abilityDef, abilityDef, abilityDef, abilityDef, TYPE_NAME, QUALITY_NAME, abilityQuality,];
        }
    }
    if (!__VLS_unwrap(isNoncombatant, {})(m) && m.abilities.length) {
        const __VLS_60 = FoldSection || FoldSection;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
            // @ts-ignore
            id: "party.abilities", title: "✨ 能力", count: (m.abilities.length), closed: true,
        }));
        const __VLS_62 = __VLS_61({
            id: "party.abilities",
            title: "✨ 能力",
            count: (m.abilities.length),
            closed: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
        const { default: __VLS_65 } = __VLS_nonNull(__VLS_63.slots);
        const __VLS_66 = __VLS_tryAsConstant((grouped(m)));
        for (const [g] of __VLS_vFor(__VLS_nonNull(__VLS_66))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (g.type),
                ...{ class: "abilities" },
            });
            /** @type {__VLS_StyleScopedClasses['abilities']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            (TYPE_NAME.value[g.type]);
            __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
                ...{ class: "plain small" },
            });
            /** @type {__VLS_StyleScopedClasses['plain']} */ ;
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
            const __VLS_67 = __VLS_tryAsConstant((g.items));
            for (const [a] of __VLS_vFor(__VLS_nonNull(__VLS_67))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                    key: (a.id),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
                (a.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (QUALITY_NAME.value[__VLS_unwrap(abilityQuality, {})(a)]);
                (abilityMeta(a));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "muted" },
                });
                /** @type {__VLS_StyleScopedClasses['muted']} */ ;
                (a.desc);
                // @ts-ignore
                [isNoncombatant, TYPE_NAME, QUALITY_NAME, abilityQuality,];
            }
            // @ts-ignore
            [];
        }
        // @ts-ignore
        [];
        var __VLS_63;
    }
    if (!m.isPlayer && !m.group && m.bond !== 'slave' && m.bond !== 'guest') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(!m.isPlayer && !m.group && m.bond !== 'slave' && m.bond !== 'guest'))
                        throw 0;
                    return (game.value.dismiss(m.id));
                    // @ts-ignore
                    [game,];
                } },
            ...{ class: "small danger" },
            ...{ style: {} },
            disabled: (inCombat.value),
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
    }
    // @ts-ignore
    [inCombat,];
}
if (leader.value) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "panel" },
    });
    /** @type {__VLS_StyleScopedClasses['panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    (leader.value.name);
    if (bound.value) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        (leader.value.name);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "small muted" },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['muted']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "row" },
        });
        /** @type {__VLS_StyleScopedClasses['row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(leader.value))
                        throw 0;
                    if (!!(bound.value))
                        throw 0;
                    return (game.value.requestLeave('formal'));
                    // @ts-ignore
                    [game, leader, leader, leader, bound,];
                } },
            ...{ class: "small" },
            ...{ class: ({ primary: s.value.pendingLeave?.mode === 'formal' }) },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: // @ts-ignore
                (...[$event]) => {
                    void $event;
                    if (!(leader.value))
                        throw 0;
                    if (!!(bound.value))
                        throw 0;
                    return (game.value.requestLeave('sneak'));
                    // @ts-ignore
                    [s, game,];
                } },
            ...{ class: "small" },
            ...{ class: ({ primary: s.value.pendingLeave?.mode === 'sneak' }) },
        });
        /** @type {__VLS_StyleScopedClasses['small']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        if (s.value.pendingLeave) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: // @ts-ignore
                    (...[$event]) => {
                        void $event;
                        if (!(leader.value))
                            throw 0;
                        if (!!(bound.value))
                            throw 0;
                        if (!(s.value.pendingLeave))
                            throw 0;
                        return (game.value.requestLeave(null));
                        // @ts-ignore
                        [s, s, game,];
                    } },
                ...{ class: "small" },
            });
            /** @type {__VLS_StyleScopedClasses['small']} */ ;
        }
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
