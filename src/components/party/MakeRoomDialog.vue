<script setup lang="ts">
import { computed } from 'vue'
import { followRoom, partyMax, partyRoom } from '@/engine/party'
import { useGame } from '@/stores/game'
import AppDialog from '../AppDialog.vue'
import RoomMembers from './RoomMembers.vue'

// 騰出位子：雇人、邀請、買奴隸、帶人……隊伍放不下時先打開這裡，讓同伴留守、寄放或離隊，位子夠了再繼續
const game = useGame()
const req = computed(() => game.makeRoom)
const room = computed(() => (game.state && req.value ? (req.value.follow ? followRoom(game.state) : partyRoom(game.state)) : 0))
const left = computed(() => Math.max(0, (req.value?.need ?? 0) - room.value))
const max = computed(() => (game.state ? partyMax(game.state) : 0))

function go() {
  const r = req.value
  game.makeRoom = null
  if (r && left.value === 0) r.then()
}
</script>

<template>
  <AppDialog :open="!!req && !!game.state" title="騰出位子" icon="users" width="620px" @close="game.makeRoom = null">
    <div v-if="req" class="make-room">
      <p><b>{{ req.title }}</b>：要 {{ req.need }} 個位子，隊伍（上限 {{ max }} 人）現在{{ room > 0 ? `只剩 ${room} 個` : '已經滿了' }}。</p>
      <p class="small muted">送回房子或寄放在酒館不算離隊，羈絆、契約、親密度都保留，回去就能帶上；請離隊伍就是離隊。</p>
      <RoomMembers />
      <div class="row foot">
        <span class="small" :class="left ? 'warn' : 'ok'">{{ left ? `還要騰出 ${left} 個位子` : '位子夠了' }}</span>
        <button class="small" @click="game.makeRoom = null">取消</button>
        <button class="small primary" :disabled="left > 0" @click="go">繼續</button>
      </div>
    </div>
  </AppDialog>
</template>

<style scoped>
.make-room { display: grid; gap: 10px; }
.make-room p { margin: 0; }
.foot { justify-content: flex-end; align-items: center; gap: 8px; }
.foot span { margin-right: auto; }
.warn { color: var(--danger); }
.ok { color: var(--good); }
</style>
