<script setup lang="ts">
import { computed, ref } from 'vue'
import { ROSTER_LABEL, rosterBlocked, rosterDc, rosterMaster, type RosterKind } from '@/engine/masterRoster'
import type { Character } from '@/engine/types'
import { useGame } from '@/stores/game'

// 主人帶著主角時，向主人提議安排這位隊員（engine/masterRoster.ts；docs/COMPANIONS.md 第 2.4 節）：
// 請主人讓他離隊、留在酒館、留在家裡。魅力檢定，失敗今天不再提這個人
const props = defineProps<{ member: Character }>()
const game = useGame()
const s = computed(() => game.state!)
const master = computed(() => rosterMaster(s.value))
const KINDS: RosterKind[] = ['dismiss', 'lodge', 'home']
const options = computed(() => {
  void s.value.time.minute
  return KINDS.map((k) => ({ kind: k, label: ROSTER_LABEL[k].replace('他', props.member.name), why: rosterBlocked(s.value, k, props.member.id) }))
})
const open = computed(() => options.value.filter((o) => !o.why))
const pick = ref<RosterKind | ''>('')
const kind = computed<RosterKind | undefined>(() => (open.value.some((o) => o.kind === pick.value) ? (pick.value as RosterKind) : open.value[0]?.kind))
const text = ref('')
/** 全都不行時寫出原因（重複的只寫一次） */
const why = computed(() => (open.value.length ? '' : [...new Set(options.value.map((o) => o.why))].join('；')))
async function go() {
  if (!kind.value) return
  await game.perform({ kind: 'propose', target: `${kind.value}:${props.member.id}`, text: text.value })
  text.value = ''
}
</script>

<template>
  <div v-if="master" class="roster">
    <template v-if="open.length">
      <select :value="kind" :aria-label="`向${master.name}提議怎麼安排${member.name}`" @change="pick = ($event.target as HTMLSelectElement).value as RosterKind">
        <option v-for="o in options" :key="o.kind" :value="o.kind" :disabled="!!o.why">{{ o.label }}{{ o.why ? `（${o.why}）` : '' }}</option>
      </select>
      <input v-model="text" class="say" placeholder="怎麼說服主人（選填）" :aria-label="`怎麼說服${master.name}`" />
      <button class="small" :disabled="game.judging || !!s.combat" :title="`魅力檢定，參考 DC ${kind ? rosterDc(s, kind) : '—'}；失敗今天不能再提這個人`" @click="go">向主人提議（DC {{ kind ? rosterDc(s, kind) : '—' }}）</button>
    </template>
    <span v-else class="small muted">{{ why }}</span>
  </div>
</template>

<style scoped>
.roster { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: flex-end; }
.roster select { font-size: var(--fs-xs); max-width: 100%; }
.say { flex: 1 1 10em; min-width: 8em; font-size: var(--fs-xs); }
</style>
