<script setup lang="ts">
import { computed, watch } from 'vue'
import { geography, regionById, type Haunt } from '@/engine/data'
import { blockKeys, CELL_ICON, cellName, settlementArea, ZONES, type Zone } from '@/engine/grid'

// 固定 NPC 出沒的地方：所屬地點，加上活躍地點或固定在聚落的一格（預設的設定與「依劇情旗標改變出沒」共用）
export interface Placement { location: string; haunts?: Haunt[]; fixed?: { area: string; x: number; y: number } }
const target = defineModel<Placement>({ required: true })

const ZONE_NAME: Record<Zone, string> = { town: '城區', noble: '貴族區', palace: '王城', temple: '神殿', brothel: '娼館', outskirts: '近郊', dungeon: '地下城' }
const settlements = geography.locations.filter((l) => l.type !== 'dungeon')
const places = geography.locations

const mode = computed({
  get: () => (target.value.fixed ? 'fixed' : 'haunts'),
  set: (v: string) => {
    if (v === 'fixed') setBlock(blockKeys(target.value.location)[0]!)
    else delete target.value.fixed
  },
})
const blocks = computed(() => blockKeys(target.value.location).map((k) => ({ key: k, area: settlementArea(k)! })).filter((b) => b.area))
const block = computed(() => (target.value.fixed ? settlementArea(target.value.fixed.area) : undefined))
function pickCell(i: number) {
  const a = block.value
  if (!a || !target.value.fixed) return
  const kind = a.cells[i]!.kind
  if (kind === 'wall' || kind === 'water') return
  target.value.fixed = { area: a.key, x: i % a.width, y: Math.floor(i / a.width) }
}
function setBlock(key: string) {
  target.value.fixed = { area: key, x: 0, y: 0 }
  const a = settlementArea(key)
  const i = a?.cells.findIndex((c) => c.kind !== 'wall' && c.kind !== 'water') ?? -1
  if (a && i >= 0) target.value.fixed = { area: key, x: i % a.width, y: Math.floor(i / a.width) }
}
// 換了所屬地點：固定的格子跟著換到那裡的第一個區塊，在原本地點的活躍地點也一起搬過去
watch(() => target.value.location, (loc, old) => {
  if (target.value.fixed && !blockKeys(loc).includes(target.value.fixed.area)) setBlock(blockKeys(loc)[0]!)
  for (const h of target.value.haunts ?? []) if (h.location === old) h.location = loc
})
function addHaunt() {
  ;(target.value.haunts ??= []).push({ location: target.value.location, zone: 'town', weight: 1 })
}
const picked = computed(() => (target.value.fixed && block.value ? target.value.fixed.y * block.value.width + target.value.fixed.x : -1))
</script>

<template>
  <div class="placement">
    <div class="grid">
      <label>所屬地點
        <select v-model="target.location">
          <option v-for="l in settlements" :key="l.id" :value="l.id">{{ l.name }}（{{ regionById(l.region).name }}）</option>
        </select>
      </label>
      <label>出現的方式
        <select v-model="mode">
          <option value="haunts">活躍地點（每天依權重決定在哪裡）</option>
          <option value="fixed">固定在聚落的一格</option>
        </select>
      </label>
    </div>
    <template v-if="mode === 'haunts'">
      <div v-for="(h, i) in target.haunts ?? []" :key="i" class="row">
        <select v-model="h.location" class="grow">
          <option v-for="l in places" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
        <select v-model="h.zone">
          <option v-for="z in ZONES" :key="z" :value="z">{{ ZONE_NAME[z] }}</option>
        </select>
        <label class="small">權重 <input v-model.number="h.weight" class="num" type="number" min="0.01" step="0.1" /></label>
        <button class="small" @click="target.haunts!.splice(i, 1)">移除</button>
      </div>
      <button class="small" @click="addHaunt">＋ 活躍地點</button>
      <p v-if="!target.haunts?.length" class="small muted">沒有活躍地點時，要認識之後才找得到（在所屬地點的城區）。</p>
    </template>
    <template v-else-if="target.fixed">
      <label class="small">區塊
        <select :value="target.fixed.area" @change="setBlock(($event.target as HTMLSelectElement).value)">
          <option v-for="b in blocks" :key="b.key" :value="b.key">{{ b.area.name }}</option>
        </select>
      </label>
      <p class="small muted">點一格決定站的位置（{{ target.fixed.x }}, {{ target.fixed.y }}：{{ block && picked >= 0 ? cellName(block.cells[picked]!.kind) : '' }}）。</p>
      <div v-if="block" class="cells" :style="{ gridTemplateColumns: `repeat(${block.width}, 22px)` }">
        <button
          v-for="(c, i) in block.cells" :key="i" class="cell" :class="[c.kind, { picked: i === picked }]"
          :title="cellName(c.kind)" @click="pickCell(i)"
        >{{ i === picked ? '🧍' : CELL_ICON[c.kind] ?? '' }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.placement { display: grid; gap: 6px; }
.cells { display: grid; gap: 1px; width: max-content; max-width: 100%; overflow: auto; }
.cell { width: 22px; height: 22px; padding: 0; font-size: 12px; line-height: 1; border-radius: 2px; background: var(--panel-2); border: 1px solid var(--border); }
.cell.wall { background: var(--border); cursor: default; }
.cell.water { background: #2a4a6a; cursor: default; }
.cell.picked { outline: 2px solid var(--accent); }
</style>
