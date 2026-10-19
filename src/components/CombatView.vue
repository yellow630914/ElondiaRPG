<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { currentActor, isActive, usableSkills, validTargets, type CombatAction } from '@/engine/combat'
import { locationById, skills, type SkillDef } from '@/engine/data'
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

/** 已選擇、等待指定目標的行動 */
const pending = ref<{ kind: 'attack' } | { kind: 'skill'; skill: SkillDef } | null>(null)

const targets = computed(() => {
  if (!actor.value || !pending.value) return []
  return validTargets(combat.value, actor.value.id, pending.value.kind === 'skill' ? pending.value.skill : undefined)
})

const actorSkills = computed(() => (actor.value ? actor.value.skills.map((id) => skills[id]).filter((s): s is SkillDef => !!s) : []))
const usable = computed(() => new Set(actor.value ? usableSkills(combat.value, actor.value.id).map((s) => s.id) : []))

function send(action: CombatAction) {
  pending.value = null
  game.act(action)
}

function chooseSkill(skill: SkillDef) {
  if (skill.target === 'enemy' || skill.target === 'ally') pending.value = { kind: 'skill', skill }
  else send({ type: 'skill', skill: skill.id })
}

function chooseTarget(id: string) {
  const p = pending.value
  if (!p) return
  send(p.kind === 'attack' ? { type: 'attack', target: id } : { type: 'skill', skill: p.skill.id, target: id })
}

function finish() {
  if (game.finishCombat()) emit('finished')
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
      <h2>戰鬥・{{ locationById(combat.location).name }}</h2>
      <span class="muted">第 {{ combat.round }} 回合</span>
    </div>

    <div class="sides">
      <div>
        <h3>隊伍</h3>
        <div v-for="c in party" :key="c.id" class="fighter" :class="{ current: actor?.id === c.id, down: !isActive(c) }">
          <div class="row" style="justify-content: space-between">
            <strong>{{ c.name }}</strong>
            <span class="small muted">Lv.{{ c.level }} AC {{ c.ac }}</span>
          </div>
          <StatBar kind="hp" :value="c.hp" :max="c.maxHp" />
          <StatBar kind="mp" :value="c.mp" :max="c.maxMp" />
          <div class="small">
            <span v-for="st in c.statuses" :key="st.name" class="tag">{{ st.name }}</span>
          </div>
        </div>
      </div>
      <div>
        <h3>敵人</h3>
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
            <span v-for="st in c.statuses" :key="st.name" class="tag">{{ st.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="panel">
    <template v-if="combat.status === 'ongoing' && actor">
      <h3>{{ actor.name }} 的行動</h3>
      <template v-if="pending">
        <p class="small muted">選擇目標：</p>
        <div class="row">
          <button v-for="t in targets" :key="t.id" @click="chooseTarget(t.id)">{{ t.name }}（{{ t.hp }}/{{ t.maxHp }}）</button>
          <button class="small" @click="pending = null">取消</button>
        </div>
      </template>
      <template v-else>
        <div class="row">
          <button class="primary" @click="pending = { kind: 'attack' }">攻擊</button>
          <button
            v-for="sk in actorSkills"
            :key="sk.id"
            :disabled="!usable.has(sk.id)"
            :title="`消耗 ${sk.mp} MP`"
            @click="chooseSkill(sk)"
          >{{ sk.name }} <span class="small muted">{{ sk.mp }}MP</span></button>
          <button @click="send({ type: 'defend' })">防禦</button>
          <button class="danger" @click="send({ type: 'flee' })">撤退</button>
        </div>
      </template>
    </template>
    <template v-else>
      <h3>{{ resultText[combat.status] }}</h3>
      <button class="primary" @click="finish">結束戰鬥並產生戰報</button>
    </template>
  </section>

  <section class="panel">
    <h3>戰鬥紀錄</h3>
    <div ref="log" class="log small">
      <div v-for="t in combat.timeline" :key="t.seq">{{ describeEntry(t, names) }}</div>
      <div v-if="combat.timeline.length === 0" class="muted">戰鬥開始。</div>
    </div>
  </section>
</template>

<style scoped>
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.fighter { border: 1px solid var(--border); border-radius: 6px; padding: 8px; margin-bottom: 8px; background: var(--panel-2); }
.fighter.current { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.fighter.down { opacity: 0.4; }
.fighter.targetable { cursor: pointer; border-color: var(--danger); }
.log { max-height: 260px; overflow-y: auto; display: grid; gap: 2px; }
@media (max-width: 720px) {
  .sides { grid-template-columns: 1fr; }
}
</style>
