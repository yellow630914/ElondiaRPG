<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { StoryDef } from '@/engine/data'
import { placeText } from '@/engine/story'
import { NODE_KINDS, START_KINDS } from '@/engine/storyMods'
import { layoutGraph, storyGraph, type EdgeKind, type GraphNode } from '@/engine/storyGraph'
import { CONTENT_TAGS } from '@/engine/content'
import { measureEdges } from './graphEdges'
import { vMarquee } from '../marquee'

// 特殊任務的流程圖（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E3）：左到右分層，任務點是卡片、每個結果是一個出口，
// 結果設定的旗標連到需要它的任務點。點任務點送出 open（編輯器在下面打開它）。
// 只讀草稿，不另外存東西；有存檔進度時，完成過的任務點打勾、現在解鎖的發亮。
const props = defineProps<{ def: StoryDef; selected?: number | null; done?: string[]; unlocked?: string[]; names?: Record<string, string> }>()
const emit = defineEmits<{ open: [number] }>()

const KIND_ICON: Record<string, string> = { story: '📜', check: '🎲', combat: '⚔️', choice: '🔀' }
const SOURCE: Record<string, string> = { story: '其他任務', ai: 'AI 判定', park: '園區印章', none: '沒有人設定' }
const graph = computed(() => storyGraph(props.def, undefined, props.names))
const cols = computed(() => layoutGraph(graph.value))
const nodeById = computed(() => new Map(graph.value.nodes.map((n) => [n.id, n])))
const extById = computed(() => new Map(graph.value.externals.map((x) => [x.id, x])))
const showFlags = ref(false)
/** 「不能有」與「清除」的線：平常只在滑過相關的卡片時畫（不然同一欄的卡片之間繞來繞去很亂） */
const showMinor = ref(false)
const hover = ref<string | null>(null)

// ---- 邊：量 DOM 的位置畫在底下的 SVG ----
const root = ref<HTMLElement | null>(null)
const els = new Map<string, HTMLElement>()
const setEl = (id: string) => (el: unknown) => {
  if (el instanceof HTMLElement) els.set(id, el)
  else els.delete(id)
}
interface Drawn { d: string; kind: EdgeKind; to: string; from: string; flag?: string; x: number; y: number; ok?: boolean }
const paths = shallowRef<Drawn[]>([])
const size = ref({ w: 0, h: 0 })
function measure() {
  if (!root.value) return
  size.value = { w: root.value.scrollWidth, h: root.value.scrollHeight }
  // 自己清除自己需要的旗標：出口繞回卡片上方的小圈
  paths.value = measureEdges(root.value, els, graph.value.edges, (e) => e.from.startsWith(`${e.to}#`))
    .map(({ edge: e, d, x, y }) => ({ d, kind: e.kind, to: e.to, from: e.from, flag: e.flag, x, y, ok: e.to === 'complete' }))
}
let ro: ResizeObserver | undefined
onMounted(() => {
  void nextTick(measure)
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    ro = new ResizeObserver(() => measure())
    ro.observe(root.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())
watch([graph, showFlags, () => props.selected], () => void nextTick(measure), { deep: true })

/** 滑過一個卡片或出口時，連到它的邊發亮 */
const lit = (p: Drawn) => !!hover.value && (p.to === hover.value || p.from === hover.value || p.from.startsWith(`${hover.value}#`))
const nodeTitle = (n: GraphNode) => `${n.title}（${NODE_KINDS[n.kind]}）`
const tagName = (t: string) => CONTENT_TAGS[t as keyof typeof CONTENT_TAGS]?.name ?? t
</script>

<template>
  <div class="graph-wrap">
    <div class="row small graph-bar">
      <label class="check"><input v-model="showFlags" type="checkbox" /> 在線上顯示旗標名稱</label>
      <label class="check" title="平常只在滑過相關的卡片時畫"><input v-model="showMinor" type="checkbox" /> 一直顯示「不能有」與「清除」的線</label>
      <span class="legend"><i class="ln unlock" />需要 <i class="ln any" />任一 <i class="ln block" />不能有 <i class="ln clear" />清除</span>
      <span v-if="graph.reach.unreachable.length || graph.reach.stuck.length || !graph.reach.canComplete" class="warn-text">⚠ 標紅的是「檢查任務鏈」的提醒</span>
    </div>
    <div class="scroll">
      <div ref="root" class="graph">
        <svg class="edges" :width="size.w" :height="size.h" aria-hidden="true">
          <defs>
            <marker id="sg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke" /></marker>
            <marker id="sg-bar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M7,0 L7,8" stroke="context-stroke" stroke-width="2" /></marker>
          </defs>
          <g v-for="(p, i) in paths" v-show="showMinor || (p.kind !== 'block' && p.kind !== 'clear') || lit(p)" :key="i" :class="[p.kind, { lit: lit(p), ok: p.ok }]">
            <path :d="p.d" :marker-end="p.kind === 'block' ? 'url(#sg-bar)' : 'url(#sg-arrow)'" />
            <text v-if="showFlags && p.flag" :x="p.x" :y="p.y - 3" text-anchor="middle">{{ p.kind === 'block' ? '⊣' : p.kind === 'clear' ? '✕' : '' }}🚩{{ p.flag }}</text>
          </g>
        </svg>
        <div v-for="(col, c) in cols" :key="c" class="col">
          <template v-for="id in col" :key="id">
            <!-- 開頭 -->
            <div v-if="id === 'start'" :ref="setEl('start')" class="card start" @mouseenter="hover = 'start'" @mouseleave="hover = null">
              <b>▶ 開頭</b>
              <div v-marquee class="marquee small muted"><span>{{ START_KINDS[def.start.kind] }}{{ def.start.min_level ? `・Lv.${def.start.min_level}` : '' }}</span></div>
              <div v-if="def.start_flags?.length" v-marquee class="marquee small"><span>→ {{ def.start_flags.map((f) => `🚩${f}`).join('、') }}</span></div>
            </div>
            <!-- 任務外面的旗標 -->
            <div v-else-if="extById.get(id)" :ref="setEl(id)" class="card ext" :class="extById.get(id)!.source" @mouseenter="hover = id" @mouseleave="hover = null">
              <div v-marquee class="marquee small"><span>☁ 🚩{{ extById.get(id)!.flag }}</span></div>
              <div v-marquee class="marquee small muted"><span>{{ SOURCE[extById.get(id)!.source] }}{{ extById.get(id)!.stories.length ? `：${extById.get(id)!.stories.map((s) => s.title).slice(0, 2).join('、')}` : '' }}</span></div>
            </div>
            <!-- 完成、失敗 -->
            <div v-else-if="id === 'complete' || id === 'fail'" :ref="setEl(id)" class="card end" :class="id">{{ id === 'complete' ? '✅ 完成任務' : '❌ 任務失敗' }}</div>
            <!-- 任務點 -->
            <div
              v-else-if="nodeById.get(id)" :ref="setEl(id)" class="card node"
              :class="{ sel: selected === nodeById.get(id)!.index, bad: nodeById.get(id)!.unreachable, done: done?.includes(id), now: unlocked?.includes(id) }"
              :title="nodeById.get(id)!.unreachable ? '不會解鎖：需要的旗標在這個任務裡怎麼走都設定不到' : '點一下在下面編輯'"
              @click="emit('open', nodeById.get(id)!.index)" @mouseenter="hover = id" @mouseleave="hover = null"
            >
              <div class="n-head">
                <span>{{ KIND_ICON[nodeById.get(id)!.kind] }}</span>
                <b v-marquee class="marquee" :title="nodeTitle(nodeById.get(id)!)"><span>{{ nodeById.get(id)!.title }}</span></b>
                <span v-if="done?.includes(id)" title="目前的存檔完成過">✔</span>
                <span v-else-if="unlocked?.includes(id)" title="目前的存檔現在解鎖">●</span>
                <span v-if="nodeById.get(id)!.urgent" class="tag" title="緊急：走到時一定要先處理">緊急</span>
              </div>
              <div v-marquee class="marquee small muted"><span>{{ placeText(def.nodes[nodeById.get(id)!.index]!) }}</span></div>
              <div v-if="nodeById.get(id)!.conds.length" v-marquee class="marquee small conds"><span>{{ nodeById.get(id)!.conds.join('；') }}</span></div>
              <div
                v-for="p in nodeById.get(id)!.ports" :key="p.id" :ref="setEl(p.id)" class="port small"
                :class="{ fail: p.fail, stuck: p.stuck }" :title="p.stuck ? '選了之後可能沒有任務點可以進行' : ''"
                @mouseenter.stop="hover = p.id" @mouseleave="hover = id"
              >
                <span v-marquee class="marquee"><span class="line">
                  <span class="p-label">{{ p.label }}</span>
                  <span v-for="t in p.tags" :key="t" class="tag">{{ tagName(t) }}</span>
                  <span v-if="p.sets.length" class="sets">→ {{ p.sets.map((f) => `🚩${f}`).join(' ') }}</span>
                  <span v-if="p.clears.length" class="muted">清除 {{ p.clears.map((f) => `🚩${f}`).join(' ') }}</span>
                  <span v-if="p.end === 'retry'" title="這個任務點不結束，之後可以再來">↻</span>
                  <span v-if="p.end === 'complete'">✅</span>
                  <span v-if="p.end === 'fail'">❌</span>
                </span></span>
                <span v-if="p.notes.length" v-marquee class="marquee muted"><span>{{ p.notes.join('、') }}</span></span>
              </div>
              <div v-if="nodeById.get(id)!.retryOnFail" class="port small muted">失敗：可以再試 ↻</div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <p v-if="!def.nodes.length" class="small muted">還沒有任務點。</p>
  </div>
</template>

<style scoped>
.graph-wrap { display: grid; gap: 6px; min-width: 0; max-width: 100%; }
.graph-bar { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; }
.check { display: inline-flex; gap: 4px; align-items: center; }
.legend { display: inline-flex; gap: 4px; align-items: center; color: var(--muted); }
.legend .ln { display: inline-block; width: 18px; height: 0; border-top: 2px solid var(--accent); margin-left: 6px; }
.legend .ln.any { border-top-style: dashed; }
.legend .ln.block { border-color: var(--danger); }
.legend .ln.clear { border-top-style: dotted; border-color: var(--muted); }
.scroll { overflow: auto; max-height: 70vh; border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel-2); }
.graph { position: relative; display: flex; gap: 80px; padding: 16px 20px 40px; width: max-content; align-items: flex-start; }
.edges { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.edges path { fill: none; stroke: var(--accent); stroke-width: 1.5; opacity: 0.7; }
.edges .any path { stroke-dasharray: 6 4; }
.edges .block path { stroke: var(--danger); }
.edges .clear path { stroke: var(--muted); stroke-dasharray: 2 3; }
.edges .start path { stroke: var(--muted); }
.edges .end path { stroke: var(--danger); }
.edges .end.ok path { stroke: #6fbf73; }
.edges .lit path { stroke-width: 3; opacity: 1; }
.edges text { font-size: 10px; fill: var(--text, currentColor); paint-order: stroke; stroke: var(--panel); stroke-width: 3px; }
.col { display: flex; flex-direction: column; gap: 18px; position: relative; z-index: 1; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 8px; max-width: 260px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
.card.start { border-color: var(--gold-lo); }
.card.ext { border-style: dashed; max-width: 200px; }
.card.ext.none { border-color: var(--danger); }
.card.end { font-weight: bold; }
.card.end.fail { color: var(--danger); }
.node { cursor: pointer; min-width: 180px; }
.node:hover { border-color: var(--accent); }
.node.sel { outline: 2px solid var(--accent); }
.node.bad { border-color: var(--danger); }
.node.done { opacity: 0.75; }
.node.now { box-shadow: 0 0 0 2px var(--gold-hi, var(--accent)), 0 0 12px #f0d08366; }
.n-head { display: flex; gap: 4px; align-items: center; }
.n-head { min-width: 0; }
.n-head b { flex: 0 1 auto; }
.conds { color: var(--accent); }
.port { display: grid; grid-template-columns: minmax(0, 1fr); border-top: 1px dashed var(--border); padding-top: 2px; }
.port .line > * + * { margin-left: 6px; }
.port .p-label { font-weight: bold; }
.port.fail .p-label { color: var(--danger); }
.port.stuck { background: color-mix(in srgb, var(--danger) 15%, transparent); }
.sets { color: var(--accent); }
.warn-text { color: var(--danger); }
.tag { font-size: 0.8em; }
</style>
