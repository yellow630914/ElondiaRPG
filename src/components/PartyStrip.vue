<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { floatText, pillar } from '@/fx/fx'
import { lastSeen, stateKey } from '@/fx/seen'
import { className, companionRules, conditionName, conditionTone, describeStatus, genderDef, raceName, statusDef } from '@/engine/data'
import { isActive } from '@/engine/combat'
import { partyMax } from '@/engine/party'
import { useGame } from '@/stores/game'
import Avatar from './ui/Avatar.vue'
import GameIcon from './ui/GameIcon.vue'
import type { IconName } from './ui/iconPaths'

// 地圖下方的迷你隊伍卡：頭像、名字、HP、狀態；快捷鈕打開隊伍對話框
export type PartySection = 'stats' | 'perks' | 'gear' | 'abilities'
const emit = defineEmits<{ open: [member: string, section: PartySection] }>()
const game = useGame()
const party = computed(() => game.state?.party ?? [])
// 任務同行的夥伴不佔位子；跟著別人的隊伍時上限放寬（party.ts 的 partyMax）
const guests = computed(() => party.value.filter((m) => m.bond === 'guest').length)
const max = computed(() => (game.state ? partyMax(game.state) : 0))
const SECTIONS: { id: PartySection; icon: IconName; label: string }[] = [
  { id: 'stats', icon: 'sliders', label: '屬性與戰鬥數值' },
  { id: 'perks', icon: 'star', label: '特質' },
  { id: 'gear', icon: 'shield', label: '裝備' },
  { id: 'abilities', icon: 'sparkles', label: '能力' },
]
// 戰鬥中改顯示戰鬥裡的即時 HP 與狀態（沒參戰的人用原本的數字）
const fighter = (id: string) => game.state?.combat?.combatants.find((c) => c.side === 'party' && c.id === id)
const hpOf = (m: { id: string; hp: number; maxHp: number }) => {
  const c = fighter(m.id)
  return c ? { hp: c.hp, max: c.maxHp, down: !isActive(c), fled: !!c.fled, statuses: c.statuses } : { hp: m.hp, max: m.maxHp, down: false, fled: false, statuses: [] }
}
// 升級：那位隊員的小卡升起金色光柱、飄出「升級！」（讀檔、換存檔時不播）
const cards = new Map<string, Element>()
function cardRef(id: string, el: unknown) {
  if (el instanceof Element) cards.set(id, el)
  else cards.delete(id)
}
watch(() => party.value.map((m) => `${m.id}:${m.level}`).join(','), async () => {
  const save = stateKey(game.state)
  const ups = party.value.filter((m) => {
    const prev = lastSeen(`level:${save}:${m.id}`, m.level)
    return prev !== undefined && m.level > prev
  })
  if (!ups.length) return
  await nextTick()
  for (const m of ups) {
    const el = cards.get(m.id)
    pillar(el)
    floatText(el, `升級！Lv.${m.level}`, { color: '#ffd34d', top: true, delay: 150 })
  }
}, { immediate: true })
const pct = (v: number, max: number) => `${max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%`
</script>

<template>
  <section class="panel party-strip">
    <h3 class="head"><GameIcon name="users" :size="16" />隊伍 <span class="muted count" :title="guests ? `另有 ${guests} 位任務同行的夥伴（不佔位子）` : ''">{{ party.length - guests }} / {{ max }}</span></h3>
    <div v-for="m in party" :key="m.id" :ref="(el) => cardRef(m.id, el)" class="mini" :class="{ down: hpOf(m).down }">
      <span v-if="m.pendingAbilityChoices?.length || m.attrPoints > 0" class="lvup">可升級</span>
      <Avatar :id="m.id" :size="44" />
      <div class="info">
        <div class="name">
          <b :style="{ color: genderDef(m.gender)?.color }">{{ m.name }}</b>
          <small>{{ raceName(m.race) }}・{{ className(m.class) }} Lv.<span :key="m.level" class="lv">{{ m.level }}</span></small>
          <span v-if="hpOf(m).down" class="tag bad state">{{ hpOf(m).fled ? '撤離' : '倒下' }}</span>
        </div>
        <div class="hp" :title="`HP ${hpOf(m).hp} / ${hpOf(m).max}`">
          <div class="bar hp"><span :style="{ width: pct(hpOf(m).hp, hpOf(m).max) }" /></div>
          <span class="num">{{ hpOf(m).hp }}/{{ hpOf(m).max }}</span>
        </div>
        <div v-if="m.status.length || hpOf(m).statuses.length" class="conds">
          <span v-for="c in m.status" :key="c" class="tag" :class="conditionTone(c)" :title="companionRules.conditions[c]?.desc">{{ conditionName(c) }}</span>
          <span v-for="st in hpOf(m).statuses" :key="st.id" class="tag" :class="statusDef(st.id).kind === 'buff' ? 'good' : 'bad'" :title="describeStatus(statusDef(st.id))">{{ statusDef(st.id).name }}</span>
        </div>
      </div>
      <div class="acts">
        <button v-for="sec in SECTIONS" :key="sec.id" class="ghost" :title="sec.label" :aria-label="`${m.name}的${sec.label}`" @click="emit('open', m.id, sec.id)">
          <GameIcon :name="sec.icon" :size="14" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.party-strip { display: grid; gap: 6px; padding: 12px 14px; }
.head { display: flex; align-items: center; gap: 6px; margin: 0 0 2px; }
.head :deep(.game-icon) { color: var(--accent); }
.count { font-size: var(--fs-xs); font-weight: normal; }
.mini {
  position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; align-items: center;
  padding: 6px 8px; background: #0005; border: 1px solid #ffffff10; border-radius: 3px;
}
.mini:hover { border-color: var(--gold-lo); }
.mini.down > :deep(.avatar), .mini.down .hp { opacity: 0.45; filter: grayscale(1); }
.state { margin-left: auto; padding: 0 5px; font-size: var(--fs-xs); flex-shrink: 0; }
.tag.bad { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 55%, transparent); }
.lvup {
  position: absolute; top: -7px; left: 26px; z-index: 1; font-size: var(--fs-xs); line-height: 16px; padding: 0 5px; border-radius: 2px;
  background: var(--accent); color: #1a1008; font-weight: 700; box-shadow: 0 0 8px #f0d08399;
  animation: badge-hop 0.5s steps(5, end);
}
/* 「可升級」出現時跳一下；等級數字翻動一次 */
@keyframes badge-hop { 0% { transform: translateY(6px) scale(0.6); opacity: 0; } 50% { transform: translateY(-4px) scale(1.1); opacity: 1; } }
.lv { display: inline-block; animation: lv-flip 0.4s steps(4, end); }
@keyframes lv-flip { from { transform: rotateX(90deg); color: var(--gold-hi); } }
.name { display: flex; gap: 6px; align-items: baseline; min-width: 0; }
.name b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; min-width: 3em; }
.name small { color: var(--muted); font-size: var(--fs-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex-shrink: 100; }
.hp { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.hp .bar { flex: 1; height: 8px; }
.num { font-size: var(--fs-xs); color: var(--muted); font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; }
.conds { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px; }
.conds .tag.bad { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 55%, transparent); }
.conds .tag.good { color: var(--good); border-color: color-mix(in srgb, var(--good) 50%, transparent); }
.acts { display: grid; grid-template-columns: repeat(2, 26px); gap: 3px; }
.acts button { width: 26px; height: 26px; padding: 0; display: grid; place-items: center; background: #2a1f15; border-color: #4a3a28; color: var(--muted); }
.acts button:hover:not(:disabled) { color: var(--gold-hi); border-color: var(--accent); }
</style>
