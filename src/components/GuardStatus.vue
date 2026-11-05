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
const charmGate = computed(() => props.canPay && charmGateOpen(s.value) && s.value.gatePass?.[loc.value.id] !== s.value.time.day)

// 城裡犯法的後果（玩家回饋：不知道當街攻擊別人會怎樣）；數字照 security.json
const crime = securityRules as unknown as {
  steal: { fail: { alert: number; reputation: number }; fumble: { alert: number; reputation: number } }
  attack: { alert_here: number; reputation_here: number; alert_haunts: number; reputation_haunts: number }
  fines: { alert_days: number; wanted_days: number }
}
const crimeRules = computed(() => {
  const a = securityRules.alert
  return [
    `偷竊被發現：這裡的衛兵警戒 +${crime.steal.fail.alert}、勢力聲望 ${crime.steal.fail.reputation}（大失敗 +${crime.steal.fumble.alert}、${crime.steal.fumble.reputation}），對方的親密度也會下降。`,
    `偷襲（當街攻擊）被人看到：這裡的警戒 +${crime.attack.alert_here}、聲望 ${crime.attack.reputation_here}；對方常去的每座聚落警戒 +${crime.attack.alert_haunts}、所屬勢力聲望 ${crime.attack.reputation_haunts}，對方從此敵對。`,
    '打贏之後處置被制伏的人：奴役、處決、劫財、劫色會提高聚落裡的警戒、降低聲望（你先動手時比較重，對方先攔路時比較輕）。',
    `衛兵警戒 1～${a.max - 1}：出入城門要通過盤查（靈巧或魅力，DC ${a.gate_dc_base}＋${a.gate_dc_per_level}×警戒），沒過要繳罰金或折返。`,
    `警戒 ${a.max}：被這個勢力通緝，城門不能檢定、一定要繳通緝罰金，也不能進貴族區與王城。`,
    `罰金：警戒罰金是一般人 ${crime.fines.alert_days} 天的生活費 × 警戒等級，通緝罰金是 ${crime.fines.wanted_days} 天的生活費；聲望越低罰得越重。在城門繳清就清空警戒、解除通緝。`,
    `警戒每 ${gameRule(game.state, 'alertDecayDays')} 天自己降 1。`,
  ].join('\n')
})
</script>

<template>
  <div class="guard small">
    <p v-if="loc.faction" class="muted">
      <GameIcon name="flag" :size="13" /> {{ factionName(loc.faction) }}的聲望 {{ rep }}<template v-if="band.buy || band.sell">：買入 {{ pct(band.buy) }}、賣出 {{ pct(band.sell) }}</template>
      <Hint :text="`犯法的後果\n${crimeRules}`" />
    </p>
    <p v-else class="muted"><GameIcon name="siren" :size="13" /> 這裡沒有所屬的勢力 <Hint :text="`犯法的後果（這裡沒有勢力：不會被通緝，聲望也不變）\n${crimeRules}`" /></p>
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
