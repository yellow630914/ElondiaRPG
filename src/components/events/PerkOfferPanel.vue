<script setup lang="ts">
import { computed, ref } from 'vue'
import { attrName, perkDef, perkRules } from '@/engine/data'
import { perkPower } from '@/engine/perks'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'

// 取得特質的機會（升級、事件、特殊任務、訓練、物品）：從提供的特質選一個，
// 或寫一段說法擲骰交給 AI 判斷（只在開啟 AI 判定時；每次機會一次）
const props = defineProps<{ refid: string }>()
const game = useGame()
const settings = useSettings()
const memberId = computed(() => props.refid.split(':')[0]!)
const offerId = computed(() => props.refid.split(':')[1]!)
const m = computed(() => game.state?.party.find((x) => x.id === memberId.value))
const offer = computed(() => m.value?.perkOffers?.find((o) => o.id === offerId.value))
const options = computed(() => (offer.value?.options ?? []).map((id) => perkDef(id)).filter((d) => !!d))
const aiOn = computed(() => settings.aiJudge && settings.ready('judge'))
const canPitch = computed(() => !!offer.value?.pitch && !offer.value.pitched)
const text = ref('')
const p = perkRules.pitch

function pitch() {
  if (!text.value.trim()) return
  void game.pitchPerk(memberId.value, offerId.value, text.value)
  text.value = ''
}
function decline() {
  if (confirm('放棄這次學特質的機會？')) game.declinePerk(memberId.value, offerId.value)
}
</script>

<template>
  <section v-if="m && offer" class="panel perk-offer small">
    <h3>🌟 {{ m.name }}有機會學會特質</h3>
    <p class="muted">來源：{{ offer.source }}。特質一直生效，影響檢定與戰鬥。</p>
    <ul class="plain options">
      <li v-for="d in options" :key="d!.id" class="row">
        <div class="grow">
          <b>{{ d!.name }}</b> <span class="muted">（強度 {{ perkPower(d!) }}）</span>
          <div class="muted">{{ d!.desc }}</div>
        </div>
        <button class="small primary" :disabled="game.judging || !!game.state?.pendingAction" @click="game.learnPerk(memberId, offerId, d!.id)">學會</button>
      </li>
      <li v-if="!options.length" class="muted">沒有提供的特質。</li>
    </ul>
    <div v-if="canPitch" class="pitch">
      <template v-if="aiOn">
        <p class="muted">
          或者寫一段說法，爭取別的特質（{{ attrName(p.attr) }}檢定，參考 DC {{ p.dc }}）：AI 依說法合不合理判定，大成功可以比提供的稍強、成功一樣強、部分成功弱一點；失敗就只能從上面選。每次機會只能試一次。
        </p>
        <textarea v-model="text" rows="3" maxlength="400" :placeholder="`例如「這幾年跟著商隊跑遍各地，${m.name}比起打架，更懂得怎麼跟人討價還價」`" />
        <button class="small" :disabled="!text.trim() || game.judging || !!game.state?.pendingAction" @click="pitch">🗣️ 爭取</button>
      </template>
      <p v-else class="muted">開啟 AI 判定後，可以寫一段說法爭取別的特質。</p>
    </div>
    <p v-else-if="offer.pitched" class="muted">說法已經試過了，只能從提供的特質選。</p>
    <div class="row"><button class="small" @click="decline">放棄這次機會</button></div>
  </section>
</template>

<style scoped>
.perk-offer { display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr); }
.perk-offer h3, .perk-offer p { margin: 0; }
.options { display: grid; gap: 4px; margin: 0; padding-bottom: 2px; max-height: none; overflow: visible; }
.options li { gap: 8px; align-items: center; padding: 4px 6px; border: 1px solid var(--border); border-radius: 6px; }
.grow { flex: 1; }
.pitch { display: grid; gap: 4px; }
.pitch textarea { width: 100%; }
</style>
