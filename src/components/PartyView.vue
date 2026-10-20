<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  abilityQuality, apMaxFor, apRegenFor, castingAttr, evadeFloor, gearAffinities, guildRankFor, luckyThreshold,
  mod, proficiency, rerollsLeft, slotMaxFor, weaponFor, xpToNext,
} from '@/engine/character'
import { abilityApCost } from '@/engine/combat'
import {
  abilityDef, armorDef, attributeRules, attrName, className, classDef, companionRules, conditionName,
  damageTypeName, genderName, itemRules, locationById, raceName, slaveryRules, type AbilityDef,
} from '@/engine/data'
import { isBound, leaderOf } from '@/engine/party'
import { contractTerms } from '@/engine/slavery'
import { canEquip, canUse } from '@/engine/inventory'
import { itemCategory, itemValue } from '@/engine/trade'
import { formatMoney } from '@/engine/money'
import { hitDiceLeft, hitDie } from '@/engine/rest'
import type { Character } from '@/engine/types'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import StatBar from './StatBar.vue'
import NameTag from './NameTag.vue'

const QUALITY_NAME: Record<string, string> = {
  common: '普通', uncommon: '優良', rare: '稀有', epic: '史詩', legendary: '傳說', mythic: '神話',
}
const TYPE_NAME = { skill: '技能', spell: '法術', cantrip: '戲法' }

const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const inCombat = computed(() => !!s.value.combat)

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const leader = computed(() => leaderOf(s.value))

// ---- 主角設定 ----
const editingProfile = ref(false)
const profile = reactive({ gender: '', appearance: '', background: '' })
function startProfile(m: Character) {
  profile.gender = m.gender ?? ''
  profile.appearance = m.appearance ?? ''
  profile.background = m.background ?? ''
  editingProfile.value = true
}
function saveProfile() {
  game.editProfile({ ...profile })
  editingProfile.value = false
}

// ---- 行囊 ----
const itemTarget = reactive<Record<string, string>>({})
function itemDesc(name: string): string {
  const cat = itemCategory(s.value, name)
  const value = itemValue(s.value, name)
  return [cat ? itemRules.categories[cat] : '', value !== undefined ? `約 ${formatMoney(value)}` : ''].filter(Boolean).join('・')
}
const bound = computed(() => isBound(s.value))

function contractFor(m: Character) {
  return m.contract ? { ...m.contract, def: contractTerms(m.contract) } : null
}

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
        <h2><NameTag :id="m.id" /><span v-if="m.isPlayer" class="tag pc">主角</span></h2>
        <span class="tag">{{ guildRankFor(m.level) }} 級</span>
      </div>
      <div class="small muted">
        <template v-if="m.gender">{{ genderName(m.gender) }}・</template>{{ raceName(m.race) }}・{{ className(m.class) }}・Lv.{{ m.level }}（經驗 {{ m.xp }}/{{ xpToNext(m.level) }}）
      </div>
      <div class="row small">
        <span v-if="m.bond" class="tag" :class="m.bond">{{ companionRules.bonds[m.bond] }}</span>
        <span v-if="m.group && m.bond !== 'leader'" class="tag">{{ s.party.find((x) => x.id === m.group)?.name }}的隊伍</span>
        <span v-for="c in m.status" :key="c" class="tag warn" :title="companionRules.conditions[c]?.desc">{{ conditionName(c) }}</span>
        
      </div>
      <StatBar kind="hp" :value="m.hp" :max="m.maxHp" />
      <div class="small muted">生命骰 d{{ hitDie(m) }} 剩 {{ hitDiceLeft(m) }}/{{ m.level }}</div>
      <div v-if="contractFor(m)" class="contract small">
        <strong>{{ contractFor(m)!.def.name }}</strong>（主人 {{ contractFor(m)!.masterName || '無主' }}）
        <div>{{ contractFor(m)!.def.mark }}</div>
        <ul class="plain">
          <li v-for="f in contractFor(m)!.def.functions" :key="f" class="muted">・{{ (slaveryRules.functions as Record<string, string>)[f] }}</li>
          <li v-for="e in contractFor(m)!.def.side_effects" :key="e" class="muted">・副作用：{{ e }}</li>
        </ul>
        <div class="muted">
          收益歸主人 {{ Math.round(contractFor(m)!.def.income_share * 100) }}%・談判 DC {{ contractFor(m)!.def.negotiate_dc }}・逃離 DC {{ contractFor(m)!.def.escape_dc }}・出城 DC {{ contractFor(m)!.def.exit_dc }}
        </div>
        <div class="muted">目前的服從懲罰：-{{ contractFor(m)!.obedience }}</div>
        <button v-if="m.contract?.master === 'pc'" class="small" :disabled="inCombat" @click="game.releaseSlave(m.id)">解除契約</button>
      </div>

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
      <div v-if="m.isPlayer" class="small profile">
        <template v-if="!editingProfile">
          <div><span class="muted">性別</span> {{ m.gender || '—' }}<template v-if="m.birthplace">・<span class="muted">出身</span> {{ locationById(m.birthplace).name }}</template></div>
          <div v-if="m.appearance"><span class="muted">外貌</span> {{ m.appearance }}</div>
          <div v-if="m.background"><span class="muted">背景</span> {{ m.background }}</div>
          <button class="small" @click="startProfile(m)">編輯設定</button>
        </template>
        <form v-else class="profile-edit" @submit.prevent="saveProfile">
          <label>性別<input v-model="profile.gender" maxlength="20" /></label>
          <label>外貌<textarea v-model="profile.appearance" rows="3" maxlength="400" /></label>
          <label>背景<textarea v-model="profile.background" rows="4" maxlength="800" /></label>
          <div class="row"><button class="small primary" type="submit">儲存</button><button class="small" type="button" @click="editingProfile = false">取消</button></div>
        </form>
      </div>

      <div v-if="m.pendingAbilityChoices?.length" class="choose">
        <div class="row" style="justify-content: space-between">
          <strong class="small">升級！請選擇一項能力：</strong>
          <button class="small" :disabled="inCombat || rerollsLeft(m, settings.rerollLimit()) <= 0" @click="game.rerollAbility(m.id)">🎲 重抽（剩 {{ rerollsLeft(m, settings.rerollLimit()) }} 次）</button>
        </div>
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

      <button
        v-if="!m.isPlayer && !m.group && m.bond !== 'slave'"
        class="small danger"
        style="margin-top: 8px"
        :disabled="inCombat"
        @click="game.dismiss(m.id)"
      >請離隊伍</button>
    </section>
  </div>

  <section v-if="leader" class="panel">
    <h2>🚩 {{ leader.name }}的隊伍</h2>
    <p v-if="bound" class="small muted">你是{{ leader.name }}的奴隸，不能自行離隊；只能在左側的「主動行動」中談判或逃離。</p>
    <template v-else>
      <p class="small muted">你是這支隊伍的隊員。離隊會在下次休息（短休或長休）時進行：正式道別比較體面；偷偷離開要過靈巧檢定，被發現會很尷尬。</p>
      <div class="row">
        <button class="small" :class="{ primary: s.pendingLeave?.mode === 'formal' }" @click="game.requestLeave('formal')">正式道別</button>
        <button class="small" :class="{ primary: s.pendingLeave?.mode === 'sneak' }" @click="game.requestLeave('sneak')">偷偷離開</button>
        <button v-if="s.pendingLeave" class="small" @click="game.requestLeave(null)">打消念頭</button>
      </div>
    </template>
  </section>

  <section class="panel">
    <h2>🎒 行囊</h2>
    <p v-if="s.inventory.length === 0" class="muted small">空空如也。</p>
    <ul class="plain small inventory">
      <li v-for="i in s.inventory" :key="i.name" class="row">
        <strong>{{ i.name }} ×{{ i.qty }}</strong>
        <span class="muted">{{ itemDesc(i.name) }}</span>
        <template v-if="canUse(i.name) || canEquip(i.name)">
          <select v-model="itemTarget[i.name]">
            <option v-for="m in s.party" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
          <button v-if="canUse(i.name)" class="small" :disabled="inCombat" @click="game.useItem(i.name, itemTarget[i.name] ?? 'pc')">使用</button>
          <button v-if="canEquip(i.name)" class="small" :disabled="inCombat" @click="game.equipItem(i.name, itemTarget[i.name] ?? 'pc')">裝備</button>
        </template>
      </li>
    </ul>
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
.tag.slave, .tag.warn { color: var(--danger); border-color: var(--danger); }
.tag.leader { color: var(--accent); border-color: var(--accent); }
.profile { display: grid; gap: 2px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; }
.profile-edit { display: grid; gap: 4px; }
.profile-edit label { display: grid; gap: 2px; }
.profile-edit textarea { width: 100%; }
.inventory li { padding: 3px 0; gap: 8px; }
.tag.pc { margin-left: 8px; vertical-align: middle; }
.contract { padding: 6px 8px; border: 1px dashed var(--danger); border-radius: 6px; display: grid; gap: 2px; }
</style>
