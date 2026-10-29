<script setup lang="ts">
import { computed } from 'vue'
import { locationById } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { alertLevel, factionName, fineDue, isWanted, reputationBand, reputationOf, securityRules } from '@/engine/security'
import { useGame } from '@/stores/game'
import { gameRule } from '@/engine/gameRules'
import { charmGateOpen, charmLevel, charmName } from '@/engine/charm'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 城門：衛兵警戒、通緝、聲望對價格的影響，以及繳罰金（見 docs/NPC_SYSTEM.md 第 9 節）
const props = defineProps<{ canPay?: boolean }>()
const game = useGame()
const s = computed(() => game.state!)
const loc = computed(() => locationById(s.value.location))
const alert = computed(() => alertLevel(s.value))
const wanted = computed(() => isWanted(s.value, loc.value.faction))
const due = computed(() => fineDue(s.value))
const rep = computed(() => reputationOf(s.value, loc.value.faction))
const band = computed(() => reputationBand(s.value))
const pct = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 100)}%`
const blockedToday = computed(() => s.value.gateBlock?.[loc.value.id] === s.value.time.day)
// 魅氣濃度 4 的城門：照規矩戴上拘束具進城（docs/LEWD_STATS.md 第 12 節）
const charmGate = computed(() => props.canPay && !wanted.value && charmGateOpen(s.value) && s.value.gatePass?.[loc.value.id] !== s.value.time.day)
</script>

<template>
  <div class="guard small">
    <p v-if="loc.faction" class="muted">
      <GameIcon name="flag" :size="13" /> {{ factionName(loc.faction) }}的聲望 {{ rep }}<template v-if="band.buy || band.sell">：買入 {{ pct(band.buy) }}、賣出 {{ pct(band.sell) }}</template>
    </p>
    <p v-if="wanted" class="bad"><GameIcon name="siren" :size="13" /> 你被{{ factionName(loc.faction!) }}通緝：城門不能檢定，必須繳交罰金（賄賂）才能通過，也不能進入貴族區與王城。</p>
    <p v-else-if="alert" class="warn">
      <GameIcon name="siren" :size="13" /> 衛兵警戒 {{ alert }} / {{ securityRules.alert.max }}：出入城門要通過盤查（DC {{ securityRules.alert.gate_dc_base + securityRules.alert.gate_dc_per_level * alert }}）<template v-if="blockedToday">；今天已經被攔下，要繳罰金才能通過</template>。<Hint :text="`警戒每 ${gameRule(game.state, 'alertDecayDays')} 天降 1。`" />
    </p>
    <div v-if="charmGate" class="row">
      <button class="small" :disabled="game.judging" title="戲內是當地的規矩，戲外是你自己的選擇：戴上的拘束具用白鐵鎖鎖上（之後可以自己打開，拘束具和鎖都歸你）" @click="game.charmGatePass()">
        照規矩戴上拘束具（今天自由出入城門）
      </button>
      <span class="muted">{{ charmName(charmLevel(loc.id)) }}的城：外地人戴上拘束具就不用盤查</span>
    </div>
    <div v-if="due.amount && props.canPay" class="row">
      <button class="small" :class="{ primary: wanted || blockedToday }" :disabled="s.money_cc < due.amount" @click="game.payFine()">
        繳交{{ due.wanted ? '通緝' : '警戒' }}罰金 {{ formatMoney(due.amount) }}
      </button>
      <span v-if="s.money_cc < due.amount" class="muted">錢不夠</span>
    </div>
  </div>
</template>

<style scoped>
.guard p { margin: 2px 0; }
.guard :deep(.game-icon) { vertical-align: -2px; }
.bad { color: var(--danger); }
.warn { color: var(--accent); }
</style>
