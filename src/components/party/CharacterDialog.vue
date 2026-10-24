<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  abilityQuality, apMaxFor, apRegenFor, attrsOf, castingAttr, evadeFloor, gearAffinities, luckyThreshold, mod, proficiency, rerollsLeft, weaponFor,
} from '@/engine/character'
import { abilityDef, armorDef, attributeRules, attrName, classDef, damageTypeName, locationById, slaveryRules } from '@/engine/data'
import { isNoncombatant } from '@/engine/party'
import { perksOf } from '@/engine/perks'
import { contractOf } from '@/engine/tattoos'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import AppDialog from '../AppDialog.vue'
import ContentIcon from '../icons/ContentIcon.vue'
import PortraitBox from '../PortraitBox.vue'
import Avatar from '../ui/Avatar.vue'
import GameIcon from '../ui/GameIcon.vue'
import Hint from '../ui/Hint.vue'
import StatGrid, { type StatItem } from '../ui/StatGrid.vue'
import PaperDoll from './PaperDoll.vue'
import TattooMap from './TattooMap.vue'
import { abilityMeta, affinityText, attrNote, CHAR_TABS, contractFor, groupedAbilities, QUALITY_NAME, signed, slotsText, TYPE_NAME, type CharTab } from './memberInfo'

// 角色詳情：分頁（屬性與戰鬥、特質、裝備、刺青、角色設定、能力），頂部切換角色
const props = defineProps<{ open: boolean; member: string; tab: CharTab }>()
const emit = defineEmits<{ close: []; 'update:member': [id: string]; 'update:tab': [tab: CharTab] }>()
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const inCombat = computed(() => !!s.value.combat)
const m = computed(() => s.value.party.find((x) => x.id === props.member) ?? s.value.party[0]!)
const tabs = computed(() => CHAR_TABS.filter((t) => !isNoncombatant(m.value) || (t.id !== 'abilities' && (t.id !== 'gear' || !!m.value.gear))))
// 分頁不適用這個角色時（例如非戰鬥人員的能力）回到「屬性與戰鬥」：開啟、換角色、換分頁時都檢查
watch([tabs, () => props.tab, () => props.open], () => {
  if (props.open && !tabs.value.some((t) => t.id === props.tab)) emit('update:tab', 'stats')
}, { immediate: true })

const combat = computed<StatItem[]>(() => {
  const x = m.value
  const w = weaponFor(x)
  const a = armorDef(x.armor)
  return [
    { label: '行動點', value: apMaxFor(x.level, attrsOf(x)), note: `每回合 +${apRegenFor(x.level)}` },
    { label: '法術環', value: slotsText(x) },
    ...(classDef(x.class).caster !== 'none' ? [{ label: '施法屬性', value: attrName(castingAttr(x.class)), note: `熟練 +${proficiency(x.level)}` }] : []),
    { label: '幸運一擊', value: `自然骰 ${luckyThreshold(attrsOf(x), gearAffinities(x).mods.crit ?? 0)} 以上`, hint: '擲出這個數字以上的自然骰時，傷害加倍' },
    { label: '迴避骰下限', value: evadeFloor(attrsOf(x)) },
    { label: '武器', value: w.name, note: `${w.dice} ${damageTypeName(w.type)}・${attrName(w.attr)}` },
    { label: '防具', value: a.name, note: `迴避 ${signed(a.evade)}・物理減傷 ${a.dr}` },
    { label: '傷害倍率', value: affinityText(x) },
  ]
})

// ---- 主角設定 ----
const editingProfile = ref(false)
const profile = reactive({ gender: '', appearance: '', background: '' })
function startProfile() {
  profile.gender = m.value.gender ?? ''
  profile.appearance = m.value.appearance ?? ''
  profile.background = m.value.background ?? ''
  editingProfile.value = true
}
function saveProfile() {
  game.editProfile({ ...profile })
  editingProfile.value = false
}
watch(() => props.member, () => (editingProfile.value = false))
</script>

<template>
  <AppDialog :open="open" title="角色詳情" icon="user" width="1120px" @close="emit('close')">
    <div class="who">
      <button v-for="x in s.party" :key="x.id" :class="{ on: x.id === m.id }" @click="emit('update:member', x.id)">
        <Avatar :id="x.id" :size="26" />{{ x.name }}
      </button>
    </div>
    <nav class="tabs">
      <button v-for="t in tabs" :key="t.id" :class="{ on: t.id === tab }" @click="emit('update:tab', t.id)">
        <GameIcon :name="t.icon" :size="15" />{{ t.label }}
        <span v-if="(t.id === 'abilities' && m.pendingAbilityChoices?.length) || (t.id === 'stats' && m.attrPoints > 0)" class="dot" />
      </button>
    </nav>

    <!-- 屬性與戰鬥 -->
    <section v-if="tab === 'stats'" class="pane two">
      <div>
        <table class="attrs">
          <thead><tr><th>屬性</th><th>數值</th><th>修正</th><th>來源</th><th /></tr></thead>
          <tbody>
            <tr v-for="a in attributeRules.attributes" :key="a.id">
              <td>{{ a.name }} <Hint :text="a.desc" /></td>
              <td class="big" :class="{ changed: attrNote(m, a.id) }">{{ attrsOf(m)[a.id] }}</td>
              <td>{{ signed(mod(attrsOf(m)[a.id])) }}</td>
              <td class="src">{{ attrNote(m, a.id) || '—' }}</td>
              <td><button v-if="m.attrPoints > 0" class="small" :disabled="inCombat" :aria-label="`${a.name} +1`" @click="game.spendAttr(m.id, a.id)">＋</button></td>
            </tr>
          </tbody>
        </table>
        <p v-if="m.attrPoints > 0" class="points">可分配屬性點：<b>{{ m.attrPoints }}</b></p>
      </div>
      <div>
        <p v-if="isNoncombatant(m)" class="small muted">無法戰鬥：同行但不參與戰鬥、不分經驗。戰敗時依親密度救助（搬救兵）或逃跑（在聚落等你）。</p>
        <StatGrid v-else :items="combat" />
      </div>
    </section>

    <!-- 特質 -->
    <section v-else-if="tab === 'perks'" class="pane">
      <div class="perks">
        <article v-for="p in perksOf(m)" :key="p.id" class="perk" :class="{ flaw: p.flaw }">
          <header>
            <ContentIcon kind="perk" :def="p" :size="20" />
            <b>{{ p.name }}</b>
            <span v-if="p.race" class="tag">種族</span><span v-if="p.flaw" class="tag bad">缺陷</span><span v-if="p.custom" class="tag">自訂</span>
          </header>
          <p class="small">{{ p.desc }}</p>
        </article>
      </div>
      <p v-if="!perksOf(m).length" class="muted small">還沒有特質。可以靠升級、事件、特殊任務、受訓與書籍學會。</p>
      <p v-if="m.perkOffers?.length" class="muted small">有 {{ m.perkOffers.length }} 次學特質的機會，在事件視窗（右上角的「待處理」）選擇。</p>
    </section>

    <!-- 裝備 -->
    <section v-else-if="tab === 'gear'" class="pane"><PaperDoll :member="m" /></section>

    <!-- 刺青 -->
    <section v-else-if="tab === 'tattoos'" class="pane"><TattooMap :member="m" /></section>

    <!-- 角色設定 -->
    <section v-else-if="tab === 'profile'" class="pane profile">
      <PortraitBox :id="m.id" />
      <div class="texts">
        <div v-if="contractFor(m)" class="contract small">
          <h4><GameIcon name="lock" :size="14" /> {{ contractFor(m)!.def.name }}</h4>
          <div>主人 {{ contractFor(m)!.masterName || '無主' }}・{{ contractFor(m)!.def.mark }}</div>
          <ul class="plain">
            <li v-for="f in contractFor(m)!.def.functions" :key="f" class="muted">{{ (slaveryRules.functions as Record<string, string>)[f] }}</li>
            <li v-for="e in contractFor(m)!.def.side_effects" :key="e" class="muted">副作用：{{ e }}</li>
          </ul>
          <div class="row">
            <span class="tag">收益歸主人 {{ Math.round(contractFor(m)!.def.income_share * 100) }}%</span>
            <span class="tag">談判 DC {{ contractFor(m)!.def.negotiate_dc }}</span>
            <span class="tag">逃離 DC {{ contractFor(m)!.def.escape_dc }}</span>
            <span class="tag">出城 DC {{ contractFor(m)!.def.exit_dc }}</span>
            <span class="tag">服從懲罰 -{{ contractFor(m)!.obedience }}</span>
          </div>
          <button v-if="contractOf(m)?.master === 'pc'" class="small" :disabled="inCombat" @click="game.releaseSlave(m.id)">解除契約</button>
        </div>
        <template v-if="!editingProfile">
          <dl class="kv">
            <template v-if="m.personality"><dt>個性</dt><dd>{{ m.personality }}</dd></template>
            <template v-if="m.gender"><dt>性別</dt><dd>{{ m.gender }}</dd></template>
            <template v-if="m.birthplace"><dt>出身</dt><dd>{{ locationById(m.birthplace).name }}</dd></template>
            <template v-if="m.appearance"><dt>外貌</dt><dd>{{ m.appearance }}</dd></template>
            <template v-if="m.background"><dt>背景</dt><dd>{{ m.background }}</dd></template>
          </dl>
          <button v-if="m.isPlayer" class="small" @click="startProfile"><GameIcon name="edit" :size="13" /> 編輯設定</button>
        </template>
        <form v-else class="edit" @submit.prevent="saveProfile">
          <label>性別<input v-model="profile.gender" maxlength="20" /></label>
          <label>外貌<textarea v-model="profile.appearance" rows="3" maxlength="600" /></label>
          <label>背景<textarea v-model="profile.background" rows="4" maxlength="800" /></label>
          <div class="row"><button class="small primary" type="submit">儲存</button><button class="small" type="button" @click="editingProfile = false">取消</button></div>
        </form>
      </div>
    </section>

    <!-- 能力 -->
    <section v-else-if="tab === 'abilities'" class="pane">
      <div v-if="m.pendingAbilityChoices?.length" class="choose">
        <div class="row head">
          <b><GameIcon name="sparkles" :size="15" /> 升級！請選擇一項能力</b>
          <button class="small" :disabled="inCombat || rerollsLeft(m, settings.rerollLimit()) <= 0" @click="game.rerollAbility(m.id)">重抽（剩 {{ rerollsLeft(m, settings.rerollLimit()) }} 次）</button>
        </div>
        <div class="options">
          <button v-for="id in m.pendingAbilityChoices[0]" :key="id" class="option" :disabled="inCombat" @click="game.chooseAbility(m.id, id)">
            <b class="ab-name"><ContentIcon kind="ability" :id="id" :size="18" />{{ abilityDef(id).name }}</b>
            <span class="muted small">{{ TYPE_NAME[abilityDef(id).type] }}【{{ QUALITY_NAME[abilityQuality(abilityDef(id))] }}】・{{ abilityMeta(abilityDef(id)) }}</span>
            <span class="small">{{ abilityDef(id).desc }}</span>
          </button>
        </div>
      </div>
      <div v-for="g in groupedAbilities(m)" :key="g.type" class="group">
        <h4>{{ TYPE_NAME[g.type] }}</h4>
        <div class="abilities">
          <article v-for="a in g.items" :key="a.id" class="ability" :class="`q-${abilityQuality(a)}`">
            <header><ContentIcon kind="ability" :def="a" :size="20" /><b>{{ a.name }}</b><span class="tag">{{ QUALITY_NAME[abilityQuality(a)] }}</span></header>
            <div class="meta small muted">{{ abilityMeta(a) }}</div>
            <p class="small">{{ a.desc }}</p>
          </article>
        </div>
      </div>
      <p v-if="!m.abilities.length" class="muted small">還沒有能力。</p>
    </section>
  </AppDialog>
</template>

<style scoped>
.who { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.who button { display: flex; align-items: center; gap: 6px; padding: 3px 12px 3px 3px; }
.who button.on { background: #4b3420; color: var(--parchment); border-color: #2a1a0e; box-shadow: 0 0 0 1px #c99a45; }
.tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 2px solid #4b3420; margin-bottom: 14px; }
.tabs button { position: relative; display: flex; align-items: center; gap: 6px; background: #d9c08c; border: 1px solid #a88a5a; border-bottom: none; border-radius: 3px 3px 0 0; margin-bottom: -2px; color: var(--muted); padding: 6px 16px; }
.tabs button.on { background: #4b3420; color: #f0d083; border-color: #2a1a0e; }
.dot { position: absolute; top: 4px; right: 4px; width: 7px; height: 7px; border-radius: 50%; background: var(--danger); }
.pane.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; }
.attrs { width: 100%; border-collapse: collapse; }
.attrs th { text-align: left; font-weight: 600; padding: 6px 4px; font-size: var(--fs-sm); color: var(--muted); border-bottom: 2px solid #4b3420; }
.attrs td { padding: 7px 4px; border-bottom: 1px dotted var(--border); font-variant-numeric: tabular-nums; }
.attrs .big { font-size: 1.2rem; font-weight: 900; }
.attrs .big.changed { color: #a8452c; }
.attrs .src { font-size: var(--fs-xs); color: var(--muted); }
.points b { color: #a8452c; }
.perks, .abilities { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
.perk, .ability { padding: 8px 10px; background: #fff8e455; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 2px; }
.perk.flaw { border-left-color: var(--danger); }
.perk header, .ability header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.perk p, .ability p { margin: 4px 0 0; }
.ab-name { display: inline-flex; align-items: center; gap: 4px; }
.tag.bad { color: var(--danger); border-color: var(--danger); }
.ability.q-uncommon { border-left-color: #2f7a1e; } .ability.q-rare { border-left-color: #1f5a9a; }
.ability.q-epic { border-left-color: #6a3a9a; } .ability.q-legendary, .ability.q-mythic { border-left-color: #a86a10; }
.group h4 { margin: 12px 0 6px; color: var(--accent-2); letter-spacing: 0.15em; }
.choose { padding: 10px; border: 1px dashed var(--accent); border-radius: 3px; margin-bottom: 8px; background: #fff3cf66; }
.choose .head { justify-content: space-between; }
.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 6px; margin-top: 8px; }
.option { display: grid; text-align: left; gap: 2px; white-space: normal; }
.profile { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 20px; align-items: start; }
.texts { display: grid; gap: 10px; justify-items: start; }
.texts > * { max-width: 100%; }
.texts .kv, .texts .contract, .texts .edit { justify-self: stretch; }
.kv { display: grid; grid-template-columns: 4em minmax(0, 1fr); gap: 6px 10px; margin: 0; }
.kv dt { color: var(--muted); font-size: var(--fs-sm); letter-spacing: 0.15em; }
.kv dd { margin: 0; }
.contract { display: grid; gap: 4px; padding: 8px 10px; border: 1px dashed var(--danger); border-radius: 3px; }
.contract h4 { margin: 0; color: var(--danger); display: flex; align-items: center; gap: 4px; }
.edit { display: grid; gap: 6px; }
.edit label { display: grid; gap: 2px; }
.edit textarea { width: 100%; }
@media (max-width: 900px) { .pane.two, .profile { grid-template-columns: minmax(0, 1fr); } }
</style>
