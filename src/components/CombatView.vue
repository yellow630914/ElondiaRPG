<script setup lang="ts">
import { useSummary } from '@/engine/inventory'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  abilityApCost, combatItems, currentActor, isActive, itemNeedsTarget, itemTargets, multLabel, threatMultOf, threatShares, unusableReason, validTargets,
  type Combatant,
} from '@/engine/combat'
import { luckyThreshold } from '@/engine/character'
import { safeText } from '@/engine/content'
import { abilityDef, combatRules, damageTypeName, describeStatus, monsterTraits, statusDef, type AbilityDef } from '@/engine/data'
import { describeCombatLine } from '@/narrator/describe'
import { useGame } from '@/stores/game'
import NameTag from './NameTag.vue'
import GameIcon from './ui/GameIcon.vue'
import ContentIcon from './icons/ContentIcon.vue'

const emit = defineEmits<{ finished: [] }>()
const game = useGame()
const combat = computed(() => game.state!.combat!)
// 仇恨值：敵人選目標的機率（不是絕對的）
const shares = computed(() => threatShares(combat.value))
const actor = computed(() => currentActor(combat.value))
const party = computed(() => combat.value.combatants.filter((c) => c.side === 'party'))
const foes = computed(() => combat.value.combatants.filter((c) => c.side === 'enemy'))
const names = computed(() => Object.fromEntries(combat.value.combatants.map((c) => [c.id, c.name])))
const log = ref<HTMLElement | null>(null)
const costs = combatRules.action_costs

/** 已選擇、等待指定目標的行動 */
const pending = ref<{ kind: 'attack' } | { kind: 'ability'; ability: AbilityDef } | { kind: 'item'; item: string } | null>(null)

const targets = computed(() => {
  if (!actor.value || !pending.value) return []
  if (pending.value.kind === 'item') return itemTargets(combat.value, pending.value.item)
  return validTargets(combat.value, actor.value.id, pending.value.kind === 'ability' ? pending.value.ability : undefined)
})

// 道具：行囊裡可以在戰鬥中使用的東西
const items = computed(() => combatItems(game.state!))
function itemEffect(name: string): string {
  return useSummary(items.value.find((i) => i.name === name)?.def.use).replace('・戰鬥中', '')
}

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

function chooseItem(name: string) {
  if (itemNeedsTarget(name)) { pending.value = { kind: 'item', item: name }; return }
  // 全體範圍與逃脫道具：不用選目標
  const list = itemTargets(combat.value, name)
  const target = list.find((t) => t.id === actor.value?.id) ?? list[0]
  if (target) send({ type: 'item', item: name, target: target.id })
}

const isTarget = (c: Combatant) => targets.value.some((t) => t.id === c.id)

// Esc 取消選目標
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && pending.value) {
    e.preventDefault()
    pending.value = null
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/** 倒下、撤離、已逃走 */
function downText(c: Combatant): string {
  if (c.fled) return c.side === 'enemy' ? '已逃走' : '撤離'
  return c.hp === 0 ? '倒下' : ''
}

const pct = (v: number, max: number) => `${max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%`

/** 戰鬥紀錄依回合分組 */
const rounds = computed(() => {
  const out: { round: number; lines: ReturnType<typeof describeCombatLine>[] ; key: number }[] = []
  for (const t of combat.value.timeline) {
    const r = t.round ?? 0
    let g = out.at(-1)
    if (!g || g.round !== r) out.push((g = { round: r, lines: [], key: t.seq }))
    g.lines.push(describeCombatLine(t, names.value))
  }
  return out
})

function chooseTarget(id: string) {
  const p = pending.value
  if (!p) return
  if (p.kind === 'item') send({ type: 'item', item: p.item, target: id })
  else send(p.kind === 'attack' ? { type: 'attack', target: id } : { type: 'ability', ability: p.ability.id, target: id })
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
/** 精簡版：「環 2/2・1/1」 */
function slotsShort(c: Combatant): string {
  return c.slotMax.map((max, i) => `${c.slots[i] ?? 0}/${max}`).join('・')
}

function statusTitle(id: string): string {
  const def = statusDef(id)
  return `${def.kind === 'buff' ? '增益' : '減益'}：${def.name}（${describeStatus(def)}）`
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
  <section class="panel field" :class="{ picking: !!pending }">
    <div class="row field-head">
      <h2 class="title"><GameIcon name="sword" :size="20" />戰鬥・{{ combat.scene ?? '' }}</h2>
      <span v-if="pending" class="pick-hint">點選發亮的卡片當目標（Esc 取消）</span>
      <span class="tag round">第 {{ combat.round }} 回合</span>
    </div>

    <div class="sides">
      <div>
        <h3 class="title side"><GameIcon name="shield" :size="16" />隊伍</h3>
        <div class="cards">
          <div
            v-for="c in party"
            :key="c.id"
            class="fighter"
            :class="{ current: actor?.id === c.id, down: !isActive(c), targetable: pending && isTarget(c), dim: pending && !isTarget(c) }"
            @click="pending && isTarget(c) && chooseTarget(c.id)"
          >
            <div class="l1">
              <NameTag :id="c.id" class="fname" />
              <span class="small muted">Lv.{{ c.level }}・幸運 {{ luckyThreshold(c.attrs) }}+</span>
              <span v-if="downText(c)" class="tag bad state">{{ downText(c) }}</span>
            </div>
            <div class="l2">
              <span class="hpbar" :title="`HP ${c.hp}/${c.maxHp}${c.tempHp ? `（臨時 HP ${c.tempHp}）` : ''}`">
                <span class="bar hp"><span :style="{ width: pct(c.hp, c.maxHp) }" /></span>
                <span class="num">{{ c.hp }}/{{ c.maxHp }}<template v-if="c.tempHp">+{{ c.tempHp }}</template></span>
              </span>
              <span class="ap" :title="`行動點 ${c.ap}/${c.apMax}（每回合 +${c.apRegen}）`">
                <span class="pips"><i v-for="n in c.apMax" :key="n" :class="{ on: n <= c.ap }" /></span>
              </span>
              <span v-if="c.slotMax.length" class="slots small muted" :title="slotsText(c)">環 {{ slotsShort(c) }}</span>
            </div>
            <div class="l3 small">
              <span v-if="isActive(c)" class="threat muted" :title="`仇恨值 ${Math.round(c.threat ?? 0)}・累積倍率 ×${threatMultOf(c).toFixed(2)}（職業、裝備、天賦與狀態）。敵人依仇恨加權選目標，不是絕對的。`">
                <GameIcon name="target" :size="12" />{{ Math.round((shares[c.id] ?? 0) * 100) }}%
                <span class="bar"><i :style="{ width: `${Math.round((shares[c.id] ?? 0) * 100)}%` }" /></span>
              </span>
              <span v-for="st in c.statuses" :key="st.id" class="tag" :class="statusDef(st.id).kind" :title="statusTitle(st.id)">
                {{ statusDef(st.id).name }}{{ st.turns < 99 ? ` ${st.turns}` : '' }}
              </span>
              <span v-if="c.concentration" class="tag">專注：{{ abilityDef(c.concentration).name }}</span>
            </div>
          </div>
        </div>
      </div>
      <div>
        <h3 class="title side foe"><GameIcon name="skull" :size="16" />敵人</h3>
        <div class="cards">
          <div
            v-for="c in foes"
            :key="c.id"
            class="fighter"
            :class="{ current: actor?.id === c.id, down: !isActive(c), targetable: pending && isTarget(c), dim: pending && !isTarget(c), headliner: c.headliner }"
            @click="pending && isTarget(c) && chooseTarget(c.id)"
          >
            <div class="l1">
              <span v-if="c.headliner" class="crown" title="以 BOSS 出場"><GameIcon name="crown" :size="14" /></span>
              <strong class="fname foe-name"><ContentIcon v-if="c.defId" kind="monster" :id="c.defId" :size="22" />{{ c.name }}</strong>
              <span class="small muted">Lv.{{ c.level }}</span>
              <span v-if="downText(c)" class="tag bad state">{{ downText(c) }}</span>
            </div>
            <div class="l2">
              <span class="hpbar" :title="`HP ${c.hp}/${c.maxHp}`">
                <span class="bar hp"><span :style="{ width: pct(c.hp, c.maxHp) }" /></span>
                <span class="num">{{ c.hp }}/{{ c.maxHp }}</span>
              </span>
              <span class="tag">{{ damageTypeName(c.weapon.type) }}攻擊</span>
            </div>
            <div class="l3 small">
              <span v-for="t in affinityTags(c)" :key="t.text" class="tag" :class="t.kind">{{ t.text }}</span>
              <span v-for="t in c.traits ?? []" :key="t" class="tag trait" :title="safeText(monsterTraits.traits[t]?.desc ?? '')">{{ safeText(monsterTraits.traits[t]?.name ?? t) }}</span>
              <span v-for="st in c.statuses" :key="st.id" class="tag" :class="statusDef(st.id).kind" :title="statusTitle(st.id)">
                {{ statusDef(st.id).name }}{{ st.turns < 99 ? ` ${st.turns}` : '' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="panel log-panel">
    <h3 class="title"><GameIcon name="scroll" :size="16" />戰鬥紀錄</h3>
    <div ref="log" class="log small">
      <div v-for="g in rounds" :key="g.key" class="round-group">
        <h4 v-if="g.round" class="round-head">第 {{ g.round }} 回合</h4>
        <div v-for="(l, i) in g.lines" :key="i" class="line" :title="l.detail">
          {{ l.text }}
          <div v-for="(t, k) in l.targets ?? []" :key="k" class="sub" :title="t.detail">{{ t.text }}</div>
        </div>
      </div>
      <div v-if="combat.timeline.length === 0" class="muted">戰鬥開始。</div>
    </div>
  </section>

  <section class="panel actions">
    <template v-if="combat.status === 'ongoing' && actor">
      <div class="row" style="justify-content: space-between">
        <h3 class="title"><GameIcon name="d20" :size="16" />{{ actor.name }} 的行動</h3>
        <span class="tag ap-left">剩餘 <strong>{{ actor.ap }}</strong> AP</span>
      </div>
      <template v-if="pending">
        <p class="small muted">選擇目標：點上方發亮的卡片，或用下面的按鈕（Esc 取消）</p>
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
        <div class="groups">
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
                <span class="an"><ContentIcon kind="ability" :def="a" :size="18" />{{ a.name }}</span>
                <span class="small muted sub2">{{ costText(a) }}</span>
              </button>
            </div>
          </div>
          <div v-if="items.length" class="group">
            <h4 class="small muted"><GameIcon name="potion" :size="13" /> 道具（{{ costs.item }} AP）</h4>
            <div class="row">
              <button
                v-for="i in items"
                :key="i.name"
                class="ability"
                :disabled="actor.ap < costs.item"
                :title="`${i.def.desc ?? ''}${i.def.desc ? '\n' : ''}${itemEffect(i.name)}${actor.ap < costs.item ? '\n（行動點不足）' : ''}`"
                @click="chooseItem(i.name)"
              >
                <span class="an">{{ i.name }} ×{{ i.qty }}</span>
                <span class="small muted sub2">{{ itemEffect(i.name) }}</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </template>
    <template v-else>
      <h3>{{ resultText[combat.status] }}</h3>
      <button class="primary" @click="finish">結束戰鬥並產生戰報</button>
    </template>
  </section>
</template>

<style scoped>
.field-head { justify-content: space-between; flex-wrap: nowrap; }
.field-head h2 { margin: 0; }
.pick-hint { margin-left: auto; margin-right: 8px; color: var(--gold-hi); font-size: var(--fs-sm); }
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 6px; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
.side { margin: 0 0 6px; }
.side.foe, .side.foe :deep(.game-icon) { color: var(--danger); }
.round { color: var(--gold-hi); border-color: var(--gold-lo); }
.ap-left strong { color: var(--gold-hi); }
/* 精簡卡片：名字列、HP／AP／法術環、仇恨與狀態 */
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px; }
.fighter {
  border: 1px solid #ffffff14; border-radius: 3px; padding: 5px 8px; background: #0004; display: grid; gap: 3px; align-content: start;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s; min-width: 0;
}
.fighter.current { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 0 10px #f0d08333; }
.fighter.down { opacity: 0.4; }
.fighter.dim { opacity: 0.35; }
/* 以 BOSS 出場的怪物：金色邊框 */
.fighter.headliner {
  border: 2px solid #e2b04a; padding: 4px 7px;
  background: linear-gradient(180deg, #e2b04a1f, #0004 60%);
  box-shadow: 0 0 0 1px #6d5128, 0 0 12px #f0d08355, inset 0 0 0 1px #f0d08333;
}
.fighter.headliner.current { box-shadow: 0 0 0 1px var(--accent), 0 0 16px #f0d083aa; }
.fighter.headliner .fname { color: var(--gold-hi); }
.crown { display: inline-flex; color: var(--gold-hi); flex: none; }
.fighter.targetable { cursor: pointer; border-color: var(--gold-hi); border-style: dashed; box-shadow: 0 0 8px #f0d08355; opacity: 1; }
.fighter.targetable:hover { box-shadow: 0 0 0 1px var(--gold-hi), 0 0 14px #f0d08399; }
.l1, .l2 { display: flex; align-items: center; gap: 6px; min-width: 0; }
.l1 .fname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.l1 > .small { white-space: nowrap; }
.state { margin-left: auto; padding: 0 5px; }
.l3 { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; min-height: 0; }
.l3:empty { display: none; }
.l3 .tag, .l2 .tag { margin: 0; }
.hpbar { flex: 1; display: flex; align-items: center; gap: 6px; min-width: 70px; }
.hpbar .bar { flex: 1; height: 8px; }
.num { font-size: var(--fs-xs); color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.pips { display: inline-flex; gap: 2px; }
.pips i { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--accent); display: inline-block; }
.pips i.on { background: var(--accent); }
.slots { white-space: nowrap; }
.tag.buff { border-color: var(--good); color: var(--good); }
.tag.debuff, .tag.bad { border-color: var(--danger); color: var(--danger); }
.tag.weak { border-color: var(--good); color: var(--good); }
.tag.resist { border-color: var(--muted); }
.tag.immune { border-color: var(--danger); color: var(--danger); }
.threat { display: inline-flex; gap: 4px; align-items: center; }
.threat .bar { width: 40px; height: 4px; background: var(--border); border: none; box-shadow: none; border-radius: 2px; overflow: hidden; }
.threat .bar i { display: block; height: 100%; background: var(--danger); }
.trait { border-color: var(--accent-2); color: var(--accent-2); }
.foe-name { display: inline-flex; align-items: center; gap: 4px; }

/* 戰鬥紀錄：依回合分組，自己捲動 */
.log-panel h3 { margin: 0 0 4px; }
.log { max-height: 190px; overflow-y: auto; display: grid; gap: 0; padding-left: 8px; border-left: 2px solid #c8483a66; }
.round-head { margin: 4px 0 2px; font-size: var(--fs-xs); font-weight: normal; color: var(--accent-2); letter-spacing: 0.1em; }
.round-group:first-child .round-head { margin-top: 0; }
.line { padding: 2px 0 2px 6px; border-bottom: 1px dotted #ffffff10; }
.line[title] { cursor: help; }
.line .sub { padding-left: 1.2em; color: var(--muted); }
.round-group:last-child .line:last-child { color: var(--text); border-bottom: none; }

/* 行動面板固定在視窗底部，捲到哪裡都點得到 */
.actions { position: sticky; bottom: 0; z-index: 5; box-shadow: 0 -10px 24px #000c; margin-bottom: 0; background-color: var(--bg); }
.actions h3 { margin: 0; }
.basics { margin: 6px 0 4px; }
.groups { max-height: 30vh; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 0 18px; align-items: flex-start; }
.group { min-width: 0; }
.group .row { gap: 4px; }
.group h4 { margin: 4px 0 3px; font-weight: normal; color: var(--accent-2); display: flex; align-items: center; gap: 4px; }
/* 技能與道具按鈕固定兩行高：不能用的原因放在滑鼠提示 */
.ability { display: inline-grid; grid-template-rows: auto auto; text-align: left; line-height: 1.3; min-width: 120px; max-width: 220px; }
.ability .an { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ability .sub2 { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 720px) {
  .sides { grid-template-columns: 1fr; }
}
</style>
