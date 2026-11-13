<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BOND_STYLES, slaveryRules, type BondStyle } from '@/engine/data'
import { formatMoney } from '@/engine/money'
import type { MarkChoice } from '@/engine/slavery'
import { volunteerBlocked, volunteerCandidates } from '@/engine/voluntarySlave'
import { useGame } from '@/stores/game'
import MarkPicker from './MarkPicker.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 自願為奴（docs/COMPANIONS.md 2.3.1 節）：刻印師那裡，問親密度夠高的同伴願不願意成為主角的奴隸；
// 選好印記與兩人說好的主僕關係，答應之後產生一則日誌，關掉對話框看經過
const emit = defineEmits<{ done: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const r = slaveryRules.voluntary
const bonds = slaveryRules.bond_styles
const list = computed(() => volunteerCandidates(s.value).map((m) => ({
  m, affinity: s.value.relationships?.[m.id]?.affinity ?? 0, blocked: volunteerBlocked(s.value, m.id),
})))
const pick = ref(list.value.find((x) => !x.blocked)?.m.id ?? list.value[0]?.m.id ?? '')
const chosen = computed(() => list.value.find((x) => x.m.id === pick.value))
const mark = ref<MarkChoice>(slaveryRules.roles.default)
const style = ref<BondStyle>('strict')
watch(pick, () => { style.value = 'strict' })
const BOND_HINT = `名義上是主人與奴隸，實際上兩人怎麼相處。之後親密度掉到 ${bonds.keep_affinity} 以下時暫時退回名實相符，回到 ${bonds.keep_affinity} 以上恢復；也可以在「我的奴隸」重新談。不管哪一種關係，人物的言行都照各自的性格。`
const HINT = `自願同行或雇傭的同伴，親密度 ${r.min_affinity} 以上才會答應。答應之後刻上你選的印記（模板或自訂），入隊方式改成奴隸，親密度照舊；兩人事先說好的主僕關係只影響故事與主奴事件，契約的數值不變。刻印費 ${formatMoney(r.fee_cc)}，花 ${r.hours} 小時。`
function go() {
  if (!chosen.value || chosen.value.blocked) return
  void game.takeVoluntarySlave(chosen.value.m.id, mark.value, style.value)
  emit('done')
}
</script>

<template>
  <div class="volunteer small">
    <p class="muted">問身邊信任你的同伴，願不願意把自己交給你。 <Hint :text="HINT" /></p>
    <p v-if="!list.length" class="muted">隊伍裡沒有可以問的同伴（要是自願同行或雇傭的）。</p>
    <template v-else>
      <div class="who">
        <label v-for="x in list" :key="x.m.id" class="cand" :class="{ on: pick === x.m.id, off: !!x.blocked }" :title="x.blocked ?? ''">
          <input v-model="pick" type="radio" :value="x.m.id" />
          <b>{{ x.m.name }}</b>
          <span class="aff" :class="x.affinity >= r.min_affinity ? 'ok' : 'no'"><GameIcon name="heart" :size="12" /> {{ x.affinity }}</span>
          <span class="muted">{{ x.m.bond === 'hired' ? '雇傭' : '自願同行' }}</span>
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
          <button class="primary" :disabled="game.judging" @click="go">問{{ chosen.m.name }}</button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.volunteer { display: grid; gap: 8px; }
.volunteer p { margin: 0; }
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
