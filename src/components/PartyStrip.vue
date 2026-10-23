<script setup lang="ts">
import { computed } from 'vue'
import { className, combatRules, companionRules, conditionName, conditionTone, genderDef, raceName } from '@/engine/data'
import { useGame } from '@/stores/game'
import Avatar from './ui/Avatar.vue'
import GameIcon from './ui/GameIcon.vue'
import type { IconName } from './ui/iconPaths'

// 地圖下方的迷你隊伍卡：頭像、名字、HP、狀態；快捷鈕打開隊伍對話框
export type PartySection = 'stats' | 'perks' | 'gear' | 'abilities'
const emit = defineEmits<{ open: [member: string, section: PartySection] }>()
const game = useGame()
const party = computed(() => game.state?.party ?? [])
const SECTIONS: { id: PartySection; icon: IconName; label: string }[] = [
  { id: 'stats', icon: 'sliders', label: '屬性與戰鬥數值' },
  { id: 'perks', icon: 'star', label: '特質' },
  { id: 'gear', icon: 'shield', label: '裝備' },
  { id: 'abilities', icon: 'sparkles', label: '能力' },
]
const pct = (v: number, max: number) => `${max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0}%`
</script>

<template>
  <section class="panel party-strip">
    <h3 class="head"><GameIcon name="users" :size="16" />隊伍 <span class="muted count">{{ party.length }} / {{ combatRules.party_max }}</span></h3>
    <div v-for="m in party" :key="m.id" class="mini">
      <span v-if="m.pendingAbilityChoices?.length || m.attrPoints > 0" class="lvup">可升級</span>
      <Avatar :id="m.id" :size="44" />
      <div class="info">
        <div class="name">
          <b :style="{ color: genderDef(m.gender)?.color }">{{ m.name }}</b>
          <small>{{ raceName(m.race) }}・{{ className(m.class) }} Lv.{{ m.level }}</small>
        </div>
        <div class="hp" :title="`HP ${m.hp} / ${m.maxHp}`">
          <div class="bar hp"><span :style="{ width: pct(m.hp, m.maxHp) }" /></div>
          <span class="num">{{ m.hp }}/{{ m.maxHp }}</span>
        </div>
        <div v-if="m.status.length" class="conds">
          <span v-for="c in m.status" :key="c" class="tag" :class="conditionTone(c)" :title="companionRules.conditions[c]?.desc">{{ conditionName(c) }}</span>
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
.lvup {
  position: absolute; top: -7px; left: 26px; z-index: 1; font-size: 10px; line-height: 15px; padding: 0 5px; border-radius: 2px;
  background: var(--accent); color: #1a1008; font-weight: 700; box-shadow: 0 0 8px #f0d08399;
}
.name { display: flex; gap: 6px; align-items: baseline; min-width: 0; }
.name b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.name small { color: var(--muted); font-size: var(--fs-xs); white-space: nowrap; }
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
