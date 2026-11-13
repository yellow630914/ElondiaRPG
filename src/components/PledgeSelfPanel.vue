<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BOND_STYLES, slaveryRules, type BondStyle } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import { pledgeBlocked, pledgeBlockedAll, pledgeCandidates } from '@/engine/selfPledge'
import type { MarkChoice } from '@/engine/slavery'
import { useGame } from '@/stores/game'
import MarkPicker from './MarkPicker.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 主動認主（docs/COMPANIONS.md 2.3.2 節）：自願為奴的反向。自由身的主角在刻印師那裡，請信任自己的同伴或身邊認識的人收下自己；
// 選好要刻的印記與兩人說好的主僕關係，答應之後產生一則日誌，關掉對話框看經過
const emit = defineEmits<{ done: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const r = slaveryRules.voluntary
const bonds = slaveryRules.bond_styles
const BOND_LABEL: Record<string, string> = { voluntary: '自願同行', hired: '雇傭', leader: '帶著你的隊長' }
const all = computed(() => pledgeBlockedAll(s.value))
const list = computed(() => pledgeCandidates(s.value).map((x) => ({ ...x, blocked: pledgeBlocked(s.value, x.id) })))
const pick = ref(list.value.find((x) => !x.blocked)?.id ?? list.value[0]?.id ?? '')
const chosen = computed(() => list.value.find((x) => x.id === pick.value))
const mark = ref<MarkChoice>(slaveryRules.roles.default)
const style = ref<BondStyle>('strict')
watch(pick, () => { style.value = 'strict' })
const BOND_HINT = `名義上是主人與奴隸，實際上兩人怎麼相處。之後親密度掉到 ${bonds.keep_affinity} 以下時暫時退回名實相符，回到 ${bonds.keep_affinity} 以上恢復；也可以在「🔒 契約」重新談。不管哪一種關係，人物的言行都照各自的性格。`
const HINT = `可以問自願同行、雇傭的同伴，帶著你的隊長，或身邊認識的人；親密度 ${r.min_affinity} 以上才會答應。答應之後刻上你選的印記（模板或自訂），對方成為你的主人、以隊長身分帶著你，你原本的同伴照舊同行；之後就照奴隸的規矩（出門、出城要主人同意、收益歸屬……）。刻印費 ${formatMoney(r.fee_cc)}，花 ${r.hours} 小時。身上已經有印記、自己擁有奴隸時不能。`
function go() {
  if (!chosen.value || chosen.value.blocked) return
  if (!confirm(`請${chosen.value.name}收下你，成為${chosen.value.name}的奴隸？之後要談判或逃離才能解除契約。`)) return
  void game.pledgeSelf(chosen.value.id, mark.value, style.value)
  emit('done')
}
</script>

<template>
  <div class="pledge small">
    <p class="muted">把自己交給信任你的人。 <Hint :text="HINT" /></p>
    <p v-if="all && !list.length" class="warn">{{ all }}</p>
    <p v-else-if="!list.length" class="muted">身邊沒有可以問的人（同伴，或站在旁邊、你認識的人）。</p>
    <template v-else>
      <div class="who">
        <label v-for="x in list" :key="x.id" class="cand" :class="{ on: pick === x.id, off: !!x.blocked }" :title="x.blocked ?? ''">
          <input v-model="pick" type="radio" :value="x.id" />
          <b>{{ x.name }}</b>
          <span class="aff" :class="x.affinity >= r.min_affinity ? 'ok' : 'no'"><GameIcon name="heart" :size="12" /> {{ x.affinity }}</span>
          <span class="muted">{{ x.bond ? BOND_LABEL[x.bond] ?? '同伴' : '身邊的人' }}</span>
        </label>
      </div>
      <p v-if="chosen?.blocked" class="warn">{{ chosen.blocked }}</p>
      <template v-else-if="chosen">
        <h4>要刻的印記</h4>
        <MarkPicker v-model="mark" allow-custom />
        <h4>兩人說好的關係 <Hint :text="BOND_HINT" /></h4>
        <div class="bonds">
          <button v-for="id in BOND_STYLES" :key="id" class="bond" :class="{ on: style === id }" @click="style = id">
            <span class="t">{{ bonds.styles[id].name }}</span>
            <span class="d muted">{{ bonds.styles[id].desc }}</span>
          </button>
        </div>
        <div class="row">
          <span>刻印費 <b>{{ formatMoney(r.fee_cc) }}</b></span>
          <button class="primary" :disabled="game.judging" @click="go">請{{ chosen.name }}收下你</button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.pledge { display: grid; gap: 8px; }
.pledge p { margin: 0; }
h4 { margin: 6px 0 0; font-size: 0.95rem; display: flex; gap: 6px; align-items: center; }
.who { display: grid; gap: 4px; }
.cand { display: flex; gap: 8px; align-items: center; padding: 4px 6px; border: 1px solid var(--border); border-radius: 2px; cursor: pointer; }
.cand.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.cand.off { opacity: .6; }
.aff { display: inline-flex; gap: 2px; align-items: center; }
.aff.ok { color: var(--good); }
.aff.no { color: var(--danger); }
.bonds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.bond { display: grid; gap: 2px; text-align: left; white-space: normal; padding: 6px 8px; height: auto; }
.bond .t { font-weight: 800; }
.bond .d { font-size: var(--fs-xs); line-height: 1.5; }
.bond.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.row { display: flex; gap: 12px; align-items: center; justify-content: flex-end; }
.warn { color: var(--danger); }
@media (max-width: 560px) { .bonds { grid-template-columns: minmax(0, 1fr); } }
</style>
