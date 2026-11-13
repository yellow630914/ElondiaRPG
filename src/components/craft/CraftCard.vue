<script setup lang="ts">
import type { Degree } from '@/engine/data'
import type { IconName } from '../ui/iconPaths'
import { formatMoney } from '@/engine/money'
import AbilityPicker from '../AbilityPicker.vue'
import GameIcon from '../ui/GameIcon.vue'
import Hint from '../ui/Hint.vue'

// 工藝的成品卡（打造裝備、委託打造、依配方製作、自創配方共用；docs/CRAFTING.md 2.1 節）：
// 標題列（名字與標籤）→ 左「成品」（數值、各成功程度的結果）→ 右「需求」（✓ △ ✗ 清單與材料）→ 底下的結帳列（件數、時間、花費、按鈕）
export interface CardTag { text: string; hot?: boolean }
export interface CardReq { state: 'ok' | 'warn' | 'no'; label: string; text: string }
export interface CardOutcome { degree: Degree; text: string }

const props = withDefaults(defineProps<{
  title: string
  icon?: IconName
  tags?: CardTag[]
  outcomes?: CardOutcome[]
  check?: string
  reqs?: CardReq[]
  /** 件數或批數：沒給就不顯示按鈕列 */
  countLabel?: string
  countMax?: number
  countHint?: string
  hours?: number
  /** 花費明細（0 的不寫） */
  costs?: [string, number][]
  blockers?: string[]
  action?: string
  actionIcon?: IconName
  busy?: boolean
  wishPlaceholder?: string
}>(), { icon: 'tools', tags: () => [], outcomes: () => [], reqs: () => [], countMax: 0, costs: () => [], blockers: () => [], action: '', actionIcon: 'tools', wishPlaceholder: '' })
const count = defineModel<number>('count', { default: 1 })
const wish = defineModel<string>('wish', { default: '' })
const use = defineModel<string>('use', { default: '' })
const emit = defineEmits<{ go: [] }>()

const DEGREE_NAME: Record<Degree, string> = { critical: '大成功', success: '成功', partial: '部分成功', fail: '失敗', fumble: '大失敗' }
const MARK = { ok: '✓', warn: '△', no: '✗' } as const
const shownCosts = () => props.costs.filter(([, v]) => v > 0)
const total = () => props.costs.reduce((s, [, v]) => s + v, 0)
</script>

<template>
  <section class="card">
    <header class="head">
      <div class="icon"><slot name="icon"><GameIcon :name="icon" :size="24" /></slot></div>
      <div class="title">
        <b>{{ title }}</b>
        <div v-if="tags.length" class="tags"><span v-for="t in tags" :key="t.text" class="tag" :class="{ hot: t.hot }">{{ t.text }}</span></div>
      </div>
      <slot name="head-extra" />
    </header>
    <div class="body">
      <div class="col">
        <h4>成品</h4>
        <slot name="result" />
        <ul v-if="outcomes.length" class="outcomes">
          <li v-for="o in outcomes" :key="o.degree" :class="`d-${o.degree}`"><i /><b>{{ DEGREE_NAME[o.degree] }}</b><span>{{ o.text }}</span></li>
        </ul>
        <p v-if="check" class="muted check">檢定：{{ check }}</p>
        <slot name="result-after" />
      </div>
      <div class="col">
        <h4>需求</h4>
        <slot name="needs-before" />
        <ul v-if="reqs.length" class="reqs">
          <li v-for="r in reqs" :key="r.label" :class="r.state"><span class="mk">{{ MARK[r.state] }}</span><span class="k">{{ r.label }}</span><span class="v">{{ r.text }}</span></li>
        </ul>
        <slot name="needs" />
      </div>
    </div>
    <footer class="foot">
      <slot name="foot">
        <div class="row">
          <div v-if="countMax > 1" class="stepper">
            {{ countLabel }}
            <button v-for="n in countMax" :key="n" class="small" :class="{ primary: count === n }" @click="count = n">{{ n }}</button>
            <Hint v-if="countHint" :text="countHint" />
          </div>
          <div class="sum">
            <span v-if="hours">時間 <b>約 {{ hours }} 小時</b></span>
            <template v-if="shownCosts().length > 1"><span v-for="[k, v] in shownCosts()" :key="k" class="muted">{{ k }} {{ formatMoney(v) }}</span></template>
            <span v-if="total()">{{ shownCosts().length > 1 ? '合計' : shownCosts()[0]![0] }} <b>{{ formatMoney(total()) }}</b></span>
          </div>
        </div>
        <ul v-if="blockers.length" class="blockers"><li v-for="b in blockers" :key="b"><GameIcon name="warning" :size="13" /> {{ b }}</li></ul>
        <div class="row go-row">
          <details class="more">
            <summary>想要的樣子・使用技能（選填）</summary>
            <div class="more-body">
              <input v-model="wish" :placeholder="wishPlaceholder" />
              <AbilityPicker v-model="use" />
            </div>
          </details>
          <button class="primary go" :disabled="!!blockers.length || busy" @click="emit('go')"><GameIcon :name="actionIcon" :size="14" /> {{ action }}</button>
        </div>
      </slot>
    </footer>
  </section>
</template>

<style scoped>
.card { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--accent) 3%, transparent); }
.head { display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.icon { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 6px; background: color-mix(in srgb, currentColor 4%, transparent); }
.title { min-width: 0; flex: 1; }
.title b { font-size: 1.08rem; }
.tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.tag { font-size: var(--fs-xs); border: 1px solid var(--border); border-radius: 10px; padding: 0 7px; color: var(--muted); }
.tag.hot { color: var(--accent); border-color: var(--accent); }
.body { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); }
.col { padding: 10px 12px; display: grid; gap: 8px; align-content: start; min-width: 0; }
.col + .col { border-left: 1px solid var(--border); }
h4 { margin: 0; font-size: var(--fs-xs); letter-spacing: 2px; color: var(--muted); font-weight: 600; }
.outcomes { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
.outcomes li { display: grid; grid-template-columns: 10px 64px minmax(0, 1fr); gap: 6px; align-items: baseline; }
.outcomes i { width: 9px; height: 9px; border-radius: 2px; align-self: center; background: var(--c); }
.d-critical { --c: var(--accent); }
.d-success { --c: var(--good); }
.d-partial { --c: color-mix(in srgb, var(--good) 45%, var(--muted)); }
.d-fail { --c: var(--muted); }
.d-fumble { --c: var(--danger); }
.check { margin: 0; font-size: var(--fs-xs); }
.reqs { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
.reqs li { display: grid; grid-template-columns: 16px 40px minmax(0, 1fr); gap: 4px; align-items: baseline; }
.reqs .mk { font-weight: 700; color: var(--good); }
.reqs .k { color: var(--muted); }
.reqs .warn .mk, .reqs .warn .v { color: color-mix(in srgb, var(--accent) 60%, #b7862a); }
.reqs .no .mk, .reqs .no .v { color: var(--danger); }
.foot { border-top: 1px solid var(--border); background: color-mix(in srgb, var(--accent) 6%, transparent); padding: 8px 12px; display: grid; gap: 6px; }
.row { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; }
.stepper { display: flex; gap: 4px; align-items: center; }
.stepper button { min-width: 28px; }
.sum { display: flex; flex-wrap: wrap; gap: 2px 14px; align-items: baseline; font-variant-numeric: tabular-nums; }
.go-row { justify-content: space-between; }
.more { flex: 1; min-width: 200px; }
.more summary { cursor: pointer; color: var(--muted); font-size: var(--fs-xs); }
.more-body { display: grid; gap: 6px; margin-top: 6px; }
.more-body input { width: 100%; }
.go { margin-left: auto; }
.blockers { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; color: var(--danger); }
.blockers li { display: flex; gap: 4px; align-items: baseline; }
@media (max-width: 640px) {
  .body { grid-template-columns: minmax(0, 1fr); }
  .col + .col { border-left: none; border-top: 1px solid var(--border); }
}
</style>
