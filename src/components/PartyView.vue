<script setup lang="ts">
import { computed } from 'vue'
import {
  abilityQuality, apMaxFor, apRegenFor, castingAttr, evadeFloor, gearAffinities, guildRankFor, luckyThreshold,
  mod, proficiency, slotMaxFor, weaponFor, xpToNext,
} from '@/engine/character'
import { abilityApCost } from '@/engine/combat'
import {
  abilityDef, armorDef, attributeRules, attrName, className, classDef, damageTypeName, raceName,
  type AbilityDef,
} from '@/engine/data'
import type { Character } from '@/engine/types'
import { useGame } from '@/stores/game'
import StatBar from './StatBar.vue'

const QUALITY_NAME: Record<string, string> = {
  common: '普通', uncommon: '優良', rare: '稀有', epic: '史詩', legendary: '傳說', mythic: '神話',
}
const TYPE_NAME = { skill: '技能', spell: '法術', cantrip: '戲法' }

const game = useGame()
const s = computed(() => game.state!)
const inCombat = computed(() => !!s.value.combat)

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

function grouped(m: Character) {
  const list = m.abilities.map(abilityDef)
  return (['skill', 'spell', 'cantrip'] as const)
    .map((t) => ({
      type: t,
      items: list.filter((a) => a.type === t).sort((a, b) => (a.circle ?? a.unlock ?? 0) - (b.circle ?? b.unlock ?? 0)),
    }))
    .filter((g) => g.items.length > 0)
}

function abilityMeta(a: AbilityDef): string {
  const parts: string[] = []
  if (a.type === 'spell') parts.push(`${a.circle} 環`)
  parts.push(a.type === 'cantrip' ? '0 AP' : `${abilityApCost(a)} AP`)
  if (a.attr) parts.push(a.attr === 'casting' ? '施法屬性' : attrName(a.attr))
  if (a.concentration) parts.push('專注')
  return parts.join('・')
}

function slotsText(m: Character): string {
  const max = slotMaxFor(m.class, m.level, m.attrs)
  if (!max.length) return '無'
  return max.map((n, i) => `${i + 1}環 ${Math.max(0, n - (m.slotsUsed[i] ?? 0))}/${n}`).join('、')
}

function affinityText(m: Character): string {
  const gear = gearAffinities(m)
  const entries = Object.entries(gear.resist).filter(([, v]) => v)
  if (!entries.length) return '無'
  return entries.map(([k, v]) => `${damageTypeName(k)} ×${Math.max(0, 1 + (v ?? 0))}`).join('、')
}
</script>

<template>
  <div class="grid">
    <section v-for="m in s.party" :key="m.id" class="panel member">
      <div class="row" style="justify-content: space-between">
        <h2>{{ m.name }}</h2>
        <span class="tag">{{ guildRankFor(m.level) }} 級</span>
      </div>
      <div class="small muted">
        {{ raceName(m.race) }}・{{ className(m.class) }}・Lv.{{ m.level }}（經驗 {{ m.xp }}/{{ xpToNext(m.level) }}）
      </div>
      <StatBar kind="hp" :value="m.hp" :max="m.maxHp" />

      <table class="attrs small">
        <tr v-for="a in attributeRules.attributes" :key="a.id">
          <th :title="a.desc">{{ a.name }}</th>
          <td class="num">{{ m.attrs[a.id] }}</td>
          <td class="muted">({{ signed(mod(m.attrs[a.id])) }})</td>
          <td>
            <button v-if="m.attrPoints > 0" class="small" :disabled="inCombat" @click="game.spendAttr(m.id, a.id)">＋</button>
          </td>
        </tr>
      </table>
      <p v-if="m.attrPoints > 0" class="small" style="color: var(--accent)">可分配屬性點：{{ m.attrPoints }}</p>

      <ul class="plain small stats">
        <li>行動點 {{ apMaxFor(m.level, m.attrs) }}（每回合 +{{ apRegenFor(m.level) }}）</li>
        <li>法術環 {{ slotsText(m) }}</li>
        <li v-if="classDef(m.class).caster !== 'none'">施法屬性 {{ attrName(castingAttr(m.class)) }}・熟練 +{{ proficiency(m.level) }}</li>
        <li>幸運一擊 自然骰 {{ luckyThreshold(m.attrs, gearAffinities(m).mods.crit ?? 0) }} 以上・迴避骰下限 {{ evadeFloor(m.attrs) }}</li>
        <li>武器 {{ weaponFor(m).name }}（{{ weaponFor(m).dice }} {{ damageTypeName(weaponFor(m).type) }}・{{ attrName(weaponFor(m).attr) }}）</li>
        <li>防具 {{ armorDef(m.armor).name }}（迴避 {{ signed(armorDef(m.armor).evade) }}・物理減傷 {{ armorDef(m.armor).dr }}）</li>
        <li>傷害倍率 {{ affinityText(m) }}</li>
        <li>天賦【{{ attributeRules.races[m.race]?.talent.name }}】{{ attributeRules.races[m.race]?.talent.desc }}</li>
      </ul>
      <p v-if="m.personality" class="small">{{ m.personality }}</p>

      <div v-if="m.pendingAbilityChoices?.length" class="choose">
        <strong class="small">升級！請選擇一項能力：</strong>
        <div class="options">
          <button
            v-for="id in m.pendingAbilityChoices[0]"
            :key="id"
            class="small option"
            :disabled="inCombat"
            @click="game.chooseAbility(m.id, id)"
          >
            <strong>{{ abilityDef(id).name }}</strong>
            <span class="muted">{{ TYPE_NAME[abilityDef(id).type] }}【{{ QUALITY_NAME[abilityQuality(abilityDef(id))] }}】・{{ abilityMeta(abilityDef(id)) }}</span>
            <span>{{ abilityDef(id).desc }}</span>
          </button>
        </div>
      </div>

      <div v-for="g in grouped(m)" :key="g.type" class="abilities">
        <h3 class="small">{{ TYPE_NAME[g.type] }}</h3>
        <ul class="plain small">
          <li v-for="a in g.items" :key="a.id">
            <strong>{{ a.name }}</strong>
            <span class="muted">【{{ QUALITY_NAME[abilityQuality(a)] }}】{{ abilityMeta(a) }}</span>
            <div class="muted">{{ a.desc }}</div>
          </li>
        </ul>
      </div>

      <button v-if="!m.isPlayer" class="small danger" style="margin-top: 8px" :disabled="inCombat" @click="game.dismiss(m.id)">
        請離隊伍
      </button>
    </section>
  </div>

  <section class="panel">
    <h2>行囊</h2>
    <p v-if="s.inventory.length === 0" class="muted small">空空如也。</p>
    <div class="row">
      <span v-for="i in s.inventory" :key="i.name" class="tag">{{ i.name }} ×{{ i.qty }}</span>
    </div>
  </section>
</template>

<style scoped>
.member { display: grid; gap: 6px; align-content: start; }
.attrs th { text-align: left; padding-right: 12px; font-weight: normal; cursor: help; }
.attrs td { padding: 1px 6px; }
.attrs .num { font-weight: 600; text-align: right; min-width: 2em; }
.stats li { padding: 2px 0; border: none; }
.choose { padding: 8px; border: 1px dashed var(--accent); border-radius: 6px; }
.options { display: grid; gap: 6px; margin-top: 6px; }
.option { display: grid; text-align: left; gap: 2px; }
.abilities h3 { margin: 6px 0 2px; color: var(--accent-2); }
</style>
