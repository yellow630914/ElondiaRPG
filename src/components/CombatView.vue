<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  abilityApCost, currentActor, isActive, multLabel, unusableReason, validTargets, type Combatant,
} from '@/engine/combat'
import { luckyThreshold } from '@/engine/character'
import { abilityDef, combatRules, damageTypeName, statusDef, type AbilityDef } from '@/engine/data'
import { describeEntry } from '@/narrator/describe'
import { useGame } from '@/stores/game'
import StatBar from './StatBar.vue'

const emit = defineEmits<{ finished: [] }>()
const game = useGame()
const combat = computed(() => game.state!.combat!)
const actor = computed(() => currentActor(combat.value))
const party = computed(() => combat.value.combatants.filter((c) => c.side === 'party'))
const foes = computed(() => combat.value.combatants.filter((c) => c.side === 'enemy'))
const names = computed(() => Object.fromEntries(combat.value.combatants.map((c) => [c.id, c.name])))
const log = ref<HTMLElement | null>(null)
const costs = combatRules.action_costs

/** 已選擇、等待指定目標的行動 */
const pending = ref<{ kind: 'attack' } | { kind: 'ability'; ability: AbilityDef } | null>(null)

const targets = computed(() => {
  if (!actor.value || !pending.value) return []
  return validTargets(combat.value, actor.value.id, pending.value.kind === 'ability' ? pending.value.ability : undefined)
})

const groups = computed(() => {
  const a = actor.value
  if (!a) return []
  const list = a.abilities.map(abilityDef)
  return [
    { name: '技能', items: list.filter((x) => x.type === 'skill') },
    { name: '法術', items: list.filter((x) => x.type === 'spell').sort((x, y) => (x.circle ?? 0) - (y.circle ?? 0)) },
    { name: '戲法', items: list.filter((x) => x.type === 'cantrip') },
  ].filter((g) => g.items.length > 0)
})

function reason(a: AbilityDef): string | null {
  return actor.value ? unusableReason(combat.value, actor.value, a.id) : '不是你的回合'
}

function costText(a: AbilityDef): string {
  const ap = abilityApCost(a)
  if (a.type === 'cantrip') return '0 AP・每回合一次'
  if (a.type === 'spell') return `${a.circle} 環・${ap} AP`
  const gain = a.ap_gain ? `・+${a.ap_gain} AP` : a.ap_gain_on_hit ? `・命中 +${a.ap_gain_on_hit} AP` : ''
  return `${ap} AP${gain}`
}

function send(action: Parameters<typeof game.act>[0]) {
  pending.value = null
  game.act(action)
}

function choose(a: AbilityDef) {
  if (a.target === 'enemy' || a.target === 'ally' || a.target === 'ally_or_downed') pending.value = { kind: 'ability', ability: a }
  else send({ type: 'ability', ability: a.id })
}

function chooseTarget(id: string) {
  const p = pending.value
  if (!p) return
  send(p.kind === 'attack' ? { type: 'attack', target: id } : { type: 'ability', ability: p.ability.id, target: id })
}

function finish() {
  if (game.finishCombat()) emit('finished')
}

/** 敵人的屬性抗性與弱點，讓玩家能針對弱點選擇攻擊 */
function affinityTags(c: Combatant): { text: string; kind: 'weak' | 'resist' | 'immune' }[] {
  const tags: { text: string; kind: 'weak' | 'resist' | 'immune' }[] = []
  for (const [key, delta] of Object.entries(c.resist)) {
    if (!delta) continue
    const m = Math.max(0, 1 + delta)
    const label = multLabel(m)
    tags.push({
      text: `${damageTypeName(key)} ${label} ×${m}`,
      kind: m === 0 ? 'immune' : m < 1 ? 'resist' : 'weak',
    })
  }
  return tags
}

function slotsText(c: Combatant): string {
  if (!c.slotMax.length) return ''
  return c.slotMax.map((max, i) => `${i + 1}環 ${c.slots[i] ?? 0}/${max}`).join('　')
}

function statusTitle(id: string): string {
  const def = statusDef(id)
  return `${def.kind === 'buff' ? '增益' : '減益'}：${def.name}`
}

watch(
  () => combat.value.timeline.length,
  async () => {
    await nextTick()
    log.value?.scrollTo({ top: log.value.scrollHeight })
  },
)

const resultText = { victory: '勝利！', defeat: '戰敗……', fled: '成功撤退', ongoing: '' }
</script>

<template>
  <section class="panel">
    <div class="row" style="justify-content: space-between">
      <h2>⚔️ 戰鬥・{{ combat.scene ?? '' }}</h2>
      <span class="muted">第 {{ combat.round }} 回合</span>
    </div>

    <div class="sides">
      <div>
        <h3>🛡️ 隊伍</h3>
        <div v-for="c in party" :key="c.id" class="fighter" :class="{ current: actor?.id === c.id, down: !isActive(c) }">
          <div class="row" style="justify-content: space-between">
            <strong>{{ c.name }}</strong>
            <span class="small muted">Lv.{{ c.level }}・幸運 {{ luckyThreshold(c.attrs) }}+</span>
          </div>
          <StatBar kind="hp" :value="c.hp" :max="c.maxHp" />
          <div class="small row ap">
            <span>AP</span>
            <span class="pips"><i v-for="n in c.apMax" :key="n" :class="{ on: n <= c.ap }" /></span>
            <span class="muted">{{ c.ap }}/{{ c.apMax }}（+{{ c.apRegen }}/回合）</span>
            <span v-if="c.tempHp" class="tag">臨時 HP {{ c.tempHp }}</span>
          </div>
          <div v-if="c.slotMax.length" class="small muted">{{ slotsText(c) }}</div>
          <div class="small">
            <span v-for="st in c.statuses" :key="st.id" class="tag" :class="statusDef(st.id).kind" :title="statusTitle(st.id)">
              {{ statusDef(st.id).name }}{{ st.turns < 99 ? ` ${st.turns}` : '' }}
            </span>
            <span v-if="c.concentration" class="tag">專注：{{ abilityDef(c.concentration).name }}</span>
          </div>
        </div>
      </div>
      <div>
        <h3>👹 敵人</h3>
        <div
          v-for="c in foes"
          :key="c.id"
          class="fighter"
          :class="{ current: actor?.id === c.id, down: !isActive(c), targetable: targets.some((t) => t.id === c.id) }"
          @click="targets.some((t) => t.id === c.id) && chooseTarget(c.id)"
        >
          <div class="row" style="justify-content: space-between">
            <strong>{{ c.name }}</strong>
            <span class="small muted">Lv.{{ c.level }}{{ c.fled ? '・已逃走' : c.hp === 0 ? '・倒下' : '' }}</span>
          </div>
          <StatBar kind="hp" :value="c.hp" :max="c.maxHp" />
          <div class="small">
            <span class="tag">{{ damageTypeName(c.weapon.type) }}攻擊</span>
            <span v-for="t in affinityTags(c)" :key="t.text" class="tag" :class="t.kind">{{ t.text }}</span>
          </div>
          <div class="small">
            <span v-for="st in c.statuses" :key="st.id" class="tag" :class="statusDef(st.id).kind">
              {{ statusDef(st.id).name }}{{ st.turns < 99 ? ` ${st.turns}` : '' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="panel">
    <template v-if="combat.status === 'ongoing' && actor">
      <div class="row" style="justify-content: space-between">
        <h3>{{ actor.name }} 的行動</h3>
        <span class="small">剩餘 <strong>{{ actor.ap }}</strong> AP</span>
      </div>
      <template v-if="pending">
        <p class="small muted">選擇目標：</p>
        <div class="row">
          <button v-for="t in targets" :key="t.id" @click="chooseTarget(t.id)">{{ t.name }}（{{ t.hp }}/{{ t.maxHp }}）</button>
          <button class="small" @click="pending = null">取消</button>
        </div>
      </template>
      <template v-else>
        <div class="row basics">
          <button class="primary" :disabled="actor.ap < costs.weapon_attack" @click="pending = { kind: 'attack' }">
            {{ actor.weapon.name }}攻擊 <span class="small">{{ costs.weapon_attack }} AP・{{ damageTypeName(actor.weapon.type) }}</span>
          </button>
          <button :disabled="actor.ap < costs.defend" @click="send({ type: 'defend' })">防禦 <span class="small muted">{{ costs.defend }} AP</span></button>
          <button class="danger" :disabled="actor.ap < costs.flee" @click="send({ type: 'flee' })">撤退 <span class="small">{{ costs.flee }} AP</span></button>
          <button @click="send({ type: 'end_turn' })">結束回合</button>
        </div>
        <div v-for="g in groups" :key="g.name" class="group">
          <h4 class="small muted">{{ g.name }}</h4>
          <div class="row">
            <button
              v-for="a in g.items"
              :key="a.id"
              :disabled="reason(a) !== null"
              :title="`${a.desc}${reason(a) ? `\n（${reason(a)}）` : ''}`"
              class="ability"
              @click="choose(a)"
            >
              {{ a.name }}
              <span class="small muted">{{ costText(a) }}</span>
              <span v-if="reason(a)" class="small why">{{ reason(a) }}</span>
            </button>
          </div>
        </div>
      </template>
    </template>
    <template v-else>
      <h3>{{ resultText[combat.status] }}</h3>
      <button class="primary" @click="finish">結束戰鬥並產生戰報</button>
    </template>
  </section>

  <section class="panel">
    <h3>📜 戰鬥紀錄</h3>
    <div ref="log" class="log small">
      <div v-for="t in combat.timeline" :key="t.seq">{{ describeEntry(t, names) }}</div>
      <div v-if="combat.timeline.length === 0" class="muted">戰鬥開始。</div>
    </div>
  </section>
</template>

<style scoped>
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.fighter { border: 1px solid var(--border); border-radius: 6px; padding: 8px; margin-bottom: 8px; background: var(--panel-2); display: grid; gap: 3px; }
.fighter.current { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.fighter.down { opacity: 0.4; }
.fighter.targetable { cursor: pointer; border-color: var(--danger); }
.ap { gap: 6px; }
.pips { display: inline-flex; gap: 3px; }
.pips i { width: 10px; height: 10px; border-radius: 50%; border: 1px solid var(--accent); display: inline-block; }
.pips i.on { background: var(--accent); }
.tag.buff { border-color: var(--good); color: var(--good); }
.tag.debuff { border-color: var(--danger); color: var(--danger); }
.tag.weak { border-color: var(--good); color: var(--good); }
.tag.resist { border-color: var(--muted); }
.tag.immune { border-color: var(--danger); color: var(--danger); }
.basics { margin-bottom: 8px; }
.group h4 { margin: 8px 0 4px; font-weight: normal; }
.ability { display: inline-grid; text-align: left; line-height: 1.3; }
.ability .why { color: var(--danger); }
.log { max-height: 280px; overflow-y: auto; display: grid; gap: 2px; }
@media (max-width: 720px) {
  .sides { grid-template-columns: 1fr; }
}
</style>
