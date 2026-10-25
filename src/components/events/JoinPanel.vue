<script setup lang="ts">
import { computed } from 'vue'
import { pendingPeople, pendingRoom } from '@/engine/away'
import { combatRules } from '@/engine/data'
import { partyMax } from '@/engine/party'
import { useGame } from '@/stores/game'
import NameTag from '../NameTag.vue'
import RoomMembers from '../party/RoomMembers.vue'
import GameIcon from '../ui/GameIcon.vue'

// 事件或 AI 讓人入隊時隊伍滿了：騰出位子後讓他們加入，或放棄（見 engine/away.ts）
const props = defineProps<{ id: string }>()
const game = useGame()
const s = computed(() => game.state!)
const p = computed(() => s.value.pendingJoins?.find((x) => x.id === props.id))
const people = computed(() => (p.value ? pendingPeople(s.value, p.value) : []))
const room = computed(() => (p.value ? pendingRoom(s.value, p.value) : 0))
const left = computed(() => Math.max(0, people.value.length - room.value))
const max = computed(() => (p.value?.kind === 'follow' ? Math.max(combatRules.party_max, combatRules.party_max_following ?? combatRules.party_max) : partyMax(s.value)))
const MODE: Record<string, string> = { voluntary: '自願同行', hired: '受雇同行', slave: '成為你的奴隸' }
</script>

<template>
  <section v-if="p" class="panel join">
    <h3 class="title"><GameIcon name="users" :size="16" />
      <template v-if="p.kind === 'follow'"><NameTag :id="p.npcs[0]" /> 邀請你跟著他們的隊伍</template>
      <template v-else>想加入隊伍</template>
    </h3>
    <p v-if="p.source" class="small muted">{{ p.source }}</p>
    <ul class="plain who">
      <li v-for="r in people" :key="r.id"><NameTag :id="r.id" /> <span class="small muted">Lv.{{ r.level }}<template v-if="p.kind === 'join'">・{{ MODE[p.mode ?? 'voluntary'] }}</template><template v-else>・{{ r.id === p.npcs[0] ? '隊長' : '隊員' }}</template></span></li>
    </ul>
    <p class="small">
      要 {{ people.length }} 個位子<template v-if="p.squad">（小隊整隊一起，不會只來一部分）</template>，隊伍（上限 {{ max }} 人）現在剩 {{ Math.max(0, room) }} 個。
      <b :class="left ? 'warn' : 'ok'">{{ left ? `還要騰出 ${left} 個位子` : '位子夠了' }}</b>
    </p>
    <RoomMembers v-if="left" />
    <div class="row">
      <button class="small primary" :disabled="left > 0" @click="game.acceptPendingJoin(p.id)"><GameIcon name="check" :size="13" /> {{ p.kind === 'follow' ? '跟他們走' : '讓他們加入' }}</button>
      <button class="small" @click="game.declinePendingJoin(p.id)"><GameIcon name="close" :size="13" /> 放棄</button>
    </div>
  </section>
</template>

<style scoped>
.join { display: grid; gap: 8px; }
.join h3, .join p { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.title :deep(.game-icon) { color: var(--accent); }
.who { display: grid; gap: 2px; margin: 0; }
.warn { color: var(--danger); }
.ok { color: var(--good); }
.row { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
