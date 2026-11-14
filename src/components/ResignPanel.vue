<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { slaveryRules } from '@/engine/data'
import { pcOf } from '@/engine/party'
import { RESIGN_FIELDS, resignBlocked, resignDc, resignTerms, termChanges } from '@/engine/resign'
import { contractTerms } from '@/engine/slavery'
import { contractOf, placeName } from '@/engine/tattoos'
import type { MarkTerms } from '@/engine/types'
import { useGame } from '@/stores/game'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 說服主人重簽契約（engine/resign.ts）：親密度夠時提出新的條款，魅力檢定；部位與服從懲罰不能改
const emit = defineEmits<{ done: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const r = slaveryRules.resign
const range = slaveryRules.custom_mark
const contract = computed(() => contractOf(pcOf(s.value))!)
const now = computed(() => contractTerms(contract.value))
const blocked = computed(() => resignBlocked(s.value))
const dc = computed(() => (blocked.value ? null : resignDc(s.value)))

/** 比例的欄位在畫面上用百分比 */
const PCT = new Set(['income_share', 'recapture_chance', 'escape_hp_ratio'])
const LABEL: Record<(typeof RESIGN_FIELDS)[number], [string, string]> = {
  income_share: ['收益歸主人', '工作、交易賺到的錢有多少歸主人'],
  negotiate_dc: ['談判解除 DC', '之後談判解除契約的 DC'],
  escape_dc: ['逃離 DC', '逃離主人的 DC'],
  exit_dc: ['出城 DC', '請求主人讓你出城的 DC'],
  recapture_chance: ['逃亡時被找到', '逃亡時每次休息被主人找到的機率'],
  escape_hp_ratio: ['逃離反噬', '逃離時印記反噬，失去的生命值比例'],
}
const shown = (k: (typeof RESIGN_FIELDS)[number], v: number) => (PCT.has(k) ? Math.round(v * 100) : v)
const draft = reactive<Record<string, number>>(Object.fromEntries(RESIGN_FIELDS.map((k) => [k, shown(k, now.value[k])])))
const name = ref(now.value.name)
const mark = ref(now.value.mark)
const text = ref('')
const lo = (k: (typeof RESIGN_FIELDS)[number]) => shown(k, range[k][0])
const hi = (k: (typeof RESIGN_FIELDS)[number]) => shown(k, range[k][1])

/** 提出的條款（數值換回比例） */
const wanted = computed<Partial<MarkTerms>>(() => ({
  name: name.value, mark: mark.value,
  ...Object.fromEntries(RESIGN_FIELDS.map((k) => [k, PCT.has(k) ? (Number(draft[k]) || 0) / 100 : Number(draft[k]) || 0])),
}))
const changes = computed(() => termChanges(now.value, resignTerms(s.value, wanted.value)))

function propose() {
  if (blocked.value || !changes.value.length) return
  void game.perform({ kind: 'resign', text: text.value, terms: wanted.value })
  text.value = ''
  emit('done')
}
</script>

<template>
  <details class="box">
    <summary>
      <GameIcon name="feather" :size="14" /> 重簽契約
      <span class="muted small">{{ blocked ?? `魅力，參考 DC ${dc}` }}</span>
    </summary>
    <p class="small muted">
      對{{ contract.masterName }}的親密度 {{ r.min_affinity }} 以上時，可以提出新的條款。成功照你提的改，部分成功數值各改一半（名稱與描述不變），失敗今天不能再提{{ r.fumble_affinity ? `，大失敗親密度 ${r.fumble_affinity}` : '' }}。
      <Hint :text="`印記改成自訂印記，刻在原本的${placeName(now.place)}；主人與服從懲罰不變。數值的範圍和自訂印記一樣。DC 是談判解除契約的 DC − ${r.dc_discount}。`" />
    </p>
    <div class="grid small">
      <label>名稱 <input v-model="name" :maxlength="range.name_chars" /></label>
      <label class="wide">印記的樣子 <input v-model="mark" :maxlength="range.mark_chars" /></label>
      <label v-for="k in RESIGN_FIELDS" :key="k" :title="LABEL[k][1]">
        {{ LABEL[k][0] }}
        <span class="num-in">
          <input v-model.number="draft[k]" type="number" :min="lo(k)" :max="hi(k)" :step="PCT.has(k) ? 5 : 1" />{{ PCT.has(k) ? '%' : '' }}
        </span>
        <span class="muted was">現在 {{ shown(k, now[k]) }}{{ PCT.has(k) ? '%' : '' }}</span>
      </label>
    </div>
    <p v-if="changes.length" class="small changes">要改：{{ changes.join('；') }}</p>
    <p v-else class="small muted">還沒有改任何條款。</p>
    <textarea v-model="text" rows="2" placeholder="怎麼說服主人（選填）：例如提醒主人這段時間替他做了多少事" />
    <div class="row actions">
      <button :disabled="!!blocked || !changes.length || game.judging" :title="blocked ?? ''" @click="propose">說服{{ contract.masterName }}重簽（魅力檢定）</button>
    </div>
  </details>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 10px; margin: 6px 0; }
.grid label { display: grid; gap: 2px; }
.grid .wide { grid-column: 1 / -1; }
.grid input { width: 100%; }
.num-in { display: flex; align-items: center; gap: 2px; }
.num-in input { width: 72px; }
.was { font-size: var(--fs-xs); }
.changes { color: var(--accent); }
textarea { width: 100%; }
</style>
