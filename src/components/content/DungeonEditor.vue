<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BOSS_LAYER_IDS, DUNGEON_LAYER_NAME, enemies, geography, regionById, type BossLayerId, type DungeonLayerId, type EncounterGroup, type StoryCond } from '@/engine/data'
import { DUNGEON_LIMITS, dungeonLayersOf, dungeonUsage, ROUTE_MODES, routeTargets, type DungeonMod } from '@/engine/dungeonMods'
import { autoFillLayers, copyableDungeons, copyLayers, layerPreview, regionLayerLevels, regionMonsters, routePreview } from '@/engine/dungeonPreview'
import { gearRules } from '@/engine/gear'
import { lightingRules, type Lighting } from '@/engine/light'
import { LIGHTINGS } from '@/engine/specialMapMods'
import { MODE_NAME } from '@/engine/travel'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import EditorHeader from './EditorHeader.vue'
import FoldSet from './FoldSet.vue'
import HelpText from './HelpText.vue'
import MonsterPick from './MonsterPick.vue'
import RequiresEditor from './RequiresEditor.vue'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'

// 自建地下城的編輯表單（docs/CONTENT_EDITOR.md 3.96 節）：基本、路線、各層的遭遇與層主、快速開始。
// 遭遇表記在地下城上（怪物編輯器的「出現地點」改的是同一份）。只有自建的，沒有內建的地下城可以在這裡改。
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()
const L = DUNGEON_LIMITS

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
/** 光線的草稿：空字串是「照共用的預設」 */
type Draft = DungeonMod & { lights: (Lighting | '')[] }
function current(): Draft {
  void content.version
  const d = clone(content.mods.dungeons?.[props.id]) as DungeonMod
  for (const layer of dungeonLayersOf(d)) d.layers[layer] ??= []
  return { ...d, lights: dungeonLayersOf({ abyss: true }).map((_, i) => d.lighting?.[i] ?? '') }
}
const draft = ref<Draft>(current())
const saved = ref(JSON.stringify(draft.value))
function reset() {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
}
watch(() => props.id, reset)
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const usage = computed(() => {
  void content.version
  return dungeonUsage(props.id, game.state)
})

// ---- 基本 ----
const requires = computed<StoryCond>({
  get: () => draft.value.requires ?? {},
  set: (v) => {
    if (Object.keys(v).length) draft.value.requires = v
    else delete draft.value.requires
  },
})
const seriesList = computed(() => [...new Set(Object.values(gearRules.materials).map((m) => m.series).filter((s): s is string => !!s))])

// ---- 路線 ----
const targets = computed(() => {
  void content.version
  return routeTargets().map((l) => ({ id: l.id, label: `${l.name}（${regionById(l.region).name}）` }))
})
function addRoute() {
  const used = new Set(draft.value.routes.map((r) => r.to))
  const to = targets.value.find((t) => !used.has(t.id))?.id
  if (to && draft.value.routes.length < L.routes) draft.value.routes.push({ to, days: [1, 1], mode: 'trail' })
}
function setFare(r: DungeonMod['routes'][number], v: string) {
  if (v.trim() === '') delete r.fare
  else r.fare = Math.max(0, Math.round(Number(v)) || 0)
}
const routes = computed(() => {
  void content.version
  return routePreview(draft.value)
})

// ---- 各層 ----
const layers = computed(() => dungeonLayersOf(draft.value))
const preview = computed(() => {
  void content.version
  return layerPreview(draft.value)
})
const previewOf = (layer: DungeonLayerId) => preview.value.find((p) => p.layer === layer)
function setAbyss(on: boolean) {
  if (on) {
    draft.value.abyss = true
    draft.value.layers.abyss ??= []
  } else {
    delete draft.value.abyss
    delete draft.value.layers.abyss
    delete draft.value.bosses?.abyss
  }
}
/** 新加的怪物：這個地區、這一層等級附近的第一隻 */
function defaultMonster(layer: DungeonLayerId): string {
  const ref = regionLayerLevels(draft.value.region)[layer]
  const pool = regionMonsters(draft.value.region).filter((e) => enemies[e])
  const near = ref ? pool.filter((e) => enemies[e]!.level >= ref[0] && enemies[e]!.level <= ref[1]) : pool
  return (near[0] ?? pool[0] ?? Object.keys(enemies)[0])!
}
function addGroup(layer: DungeonLayerId) {
  const list = (draft.value.layers[layer] ??= [])
  if (list.length < L.groups) list.push([[defaultMonster(layer), 1]])
}
function addMonster(layer: DungeonLayerId, g: EncounterGroup) {
  if (g.length < L.group_types) g.push([defaultMonster(layer), 1])
}
function removeMonster(layer: DungeonLayerId, gi: number, mi: number) {
  const list = draft.value.layers[layer]!
  list[gi]!.splice(mi, 1)
  if (!list[gi]!.length) list.splice(gi, 1)
}
const isBossLayer = (layer: DungeonLayerId): layer is BossLayerId => (BOSS_LAYER_IDS as string[]).includes(layer)
function bossOf(layer: DungeonLayerId): EncounterGroup | undefined {
  return isBossLayer(layer) ? draft.value.bosses?.[layer] : undefined
}
function addBossMonster(layer: DungeonLayerId) {
  if (!isBossLayer(layer)) return
  const bosses = (draft.value.bosses ??= {})
  const g = (bosses[layer] ??= [])
  if (g.length < L.boss_types) g.push([defaultMonster(layer), 1])
}
function removeBossMonster(layer: DungeonLayerId, mi: number) {
  const g = bossOf(layer)
  if (!g || !isBossLayer(layer)) return
  g.splice(mi, 1)
  if (!g.length) delete draft.value.bosses![layer]
  if (!Object.keys(draft.value.bosses!).length) delete draft.value.bosses
}
const defaultLight = (i: number) => LIGHTINGS[(lightingRules.dungeon_layers[i] ?? lightingRules.dungeon_layers.at(-1) ?? 'dark') as Lighting]

// ---- 快速開始 ----
const sources = computed(() => copyableDungeons().map((d) => ({ ...d, label: `${d.name}（${regionById(d.region).name}）` })))
const copyFrom = ref(sources.value.find((d) => d.region === draft.value.region)?.id ?? sources.value[0]?.id ?? '')
const hasMonsters = computed(() => Object.values(draft.value.layers).some((g) => g?.length) || !!draft.value.bosses)
function doCopy() {
  if (!copyFrom.value || (hasMonsters.value && !confirm('照內建地下城複製會換掉現在各層的遭遇與層主，確定嗎？'))) return
  const c = copyLayers(copyFrom.value)
  draft.value.layers = c.layers
  if (c.bosses) draft.value.bosses = c.bosses
  else delete draft.value.bosses
  setAbyss(!!c.abyss)
}
/** 依等級自動填：每一層的等級範圍（預設照同一地區的內建地下城） */
const fillRanges = ref<Partial<Record<DungeonLayerId, [number, number]>>>({})
watch(() => [draft.value.region, draft.value.abyss], () => {
  const refs = regionLayerLevels(draft.value.region)
  fillRanges.value = Object.fromEntries(dungeonLayersOf(draft.value).map((l) => [l, [...(refs[l] ?? [1, 2])]]))
}, { immediate: true })
function doFill() {
  if (hasMonsters.value && !confirm('依等級自動填會換掉現在各層的遭遇與層主，確定嗎？')) return
  const f = autoFillLayers(draft.value.region, !!draft.value.abyss, fillRanges.value)
  draft.value.layers = f.layers
  if (f.bosses && Object.keys(f.bosses).length) draft.value.bosses = f.bosses
  else delete draft.value.bosses
}

function save() {
  try {
    const { lights, ...m } = draft.value
    const n = dungeonLayersOf(m).length
    // 光線：有任何一層指定時，沒指定的層照共用的預設補上
    const used = lights.slice(0, n)
    if (used.some((x) => x)) m.lighting = used.map((x, i) => (x || lightingRules.dungeon_layers[i] || 'dark') as Lighting)
    else delete m.lighting
    content.saveDungeon(props.id, m)
    reset()
    game.flash(`已儲存「${content.mods.dungeons[props.id]?.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function remove() {
  if (!confirm(`刪除自建的地下城「${draft.value.name}」？各層的遭遇與層主一起刪掉；其他存檔裡人在裡面的，讀檔時送回聚落。`)) return
  try {
    content.deleteDungeon(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor">
    <EditorHeader :title="`🕳️ ${draft.name}`" kind="custom" :dirty="dirty" :usage="usage" @save="save" @discard="reset" @remove="remove" />
    <p class="small muted">
      id：{{ id }}。自建的地下城是世界上的一個地點，經由旅途到達（路線只能接聚落）；分層、遭遇、層主、寶箱、公會委託、情報都照內建地下城的規則。
      各層的怪物記在這裡，怪物編輯器的「出現地點」改的是同一份。
    </p>
    <UsageNote :usage="usage" deletable />

    <FoldSet>
      <template #legend>基本</template>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" :maxlength="L.name_chars" /></label>
        <label>地區 <Hint text="沒放怪物的層用這個地區的城郊遭遇表；地下城事件的地區篩選、背景圖也照這裡。" />
          <select v-model="draft.region">
            <option v-for="r in geography.regions" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </label>
        <label>寶箱的裝備系列 <Hint text="寶箱與人形怪掉的隨機裝備，同一級有好幾種材料時優先用這一套。" />
          <select v-model="draft.material_series">
            <option :value="undefined">（照預設）</option>
            <option v-for="s in seriesList" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
      </div>
      <label class="block"><span>給 AI 的描述 <Hint text="外觀、氣氛、傳說；在這座地下城裡的每一則日誌都會帶上。" /></span><textarea v-model="draft.desc" rows="3" :maxlength="L.desc_chars" /></label>
      <RequiresEditor v-model="requires" label="出現條件（成立才找得到、才能前往）" placeholder="可以不填：一直都在" />
    </FoldSet>

    <FoldSet :filled="draft.routes.length > 0">
      <template #legend>路線</template>
      <HelpText text="從哪些聚落可以出發到這裡。只能接聚落；地下城不會變成兩座城之間的捷徑（旅行不會穿過地下城）。天數以半天為單位。" />
      <div v-for="(r, ri) in draft.routes" :key="ri" class="row small">
        <select v-model="r.to"><option v-for="t in targets" :key="t.id" :value="t.id" :disabled="t.id !== r.to && draft.routes.some((x) => x.to === t.id)">{{ t.label }}</option></select>
        <span class="pair"><input v-model.number="r.days[0]" type="number" min="0.5" max="30" step="0.5" />～<input v-model.number="r.days[1]" type="number" min="0.5" max="30" step="0.5" /> 天</span>
        <select v-model="r.mode"><option v-for="m in ROUTE_MODES" :key="m" :value="m">{{ MODE_NAME[m] }}</option></select>
        <label>船資 <input class="num" type="number" min="0" :value="r.fare ?? ''" :placeholder="r.mode === 'sea' ? '50' : '0'" @change="setFare(r, ($event.target as HTMLInputElement).value)" /></label>
        <button class="small warn" title="刪除這條路線" @click="draft.routes.splice(ri, 1)">✕</button>
      </div>
      <button class="small" :disabled="draft.routes.length >= L.routes" @click="addRoute">＋ 新增路線</button>
      <p v-if="!draft.routes.length" class="small warn-text">至少要有一條路線，不然到不了。</p>
      <p class="small">會發清剿與材料委託、賣情報的公會（7 天內）：{{ routes.guilds.map((g) => `${g.name}（${g.days} 天）`).join('、') || '（沒有：路線太遠）' }}</p>
      <p class="small">會有冒險者在這裡出沒：{{ routes.neighbors.join('、') || (draft.requires ? '（有出現條件的地下城沒有）' : '（沒有）') }}</p>
    </FoldSet>

    <FoldSet :filled="hasMonsters">
      <template #legend>快速開始</template>
      <div class="row small">
        <select v-model="copyFrom"><option v-for="d in sources" :key="d.id" :value="d.id">{{ d.label }}</option></select>
        <button class="small" @click="doCopy">照這座複製各層</button>
      </div>
      <div class="row small fill">
        <span>依等級自動填：</span>
        <span v-for="l in layers" :key="l" class="pair">{{ DUNGEON_LAYER_NAME[l] }}
          <template v-if="fillRanges[l]"><input v-model.number="fillRanges[l]![0]" type="number" min="1" max="20" />～<input v-model.number="fillRanges[l]![1]" type="number" min="1" max="20" /></template>
        </span>
        <button class="small" @click="doFill">自動填</button>
      </div>
      <HelpText text="預設的等級照同一地區的內建地下城。自動填從這個地區出現過的怪物挑（不夠時放寬到所有內建地下城的怪物），之後可以再自己換。" />
    </FoldSet>

    <label class="check small"><input type="checkbox" :checked="!!draft.abyss" @change="setAbyss(($event.target as HTMLInputElement).checked)" /> 有底層（五層）<Hint text="底層要有怪物才算；深層的層主改成守著往下的階梯，底層的層主是最終層主。" /></label>

    <FoldSet v-for="(layer, li) in layers" :key="layer" :filled="!!draft.layers[layer]?.length || !!bossOf(layer)">
      <template #legend>
        {{ DUNGEON_LAYER_NAME[layer] }}
        <span class="small muted">
          <template v-if="previewOf(layer)?.levels">・{{ previewOf(layer)!.levels![0] }}～{{ previewOf(layer)!.levels![1] }} 級</template>
          <template v-if="previewOf(layer)?.rank">・建議 {{ previewOf(layer)!.rank }} 級</template>
          <template v-if="previewOf(layer)?.chest">・寶箱 {{ previewOf(layer)!.chest }} 級</template>
        </span>
        <span v-if="previewOf(layer)?.warnings.length" class="small warn-text" :title="previewOf(layer)!.warnings.join('\n')">・⚠️ {{ previewOf(layer)!.warnings[0] }}{{ previewOf(layer)!.warnings.length > 1 ? ` 等 ${previewOf(layer)!.warnings.length} 項` : '' }}</span>
      </template>
      <p v-for="w in previewOf(layer)?.warnings ?? []" :key="w" class="small warn-text">⚠️ {{ w }}</p>
      <p v-if="previewOf(layer)?.reference" class="small muted">同一地區內建地下城的這一層：{{ previewOf(layer)!.reference![0] }}～{{ previewOf(layer)!.reference![1] }} 級</p>
      <div v-for="(g, gi) in draft.layers[layer] ?? []" :key="gi" class="row small">
        <span>第 {{ gi + 1 }} 組：</span>
        <MonsterPick v-for="(m, mi) in g" :key="mi" :entry="m" :min="L.group_count[0]" :max="L.group_count[1]" @remove="removeMonster(layer, gi, mi)" />
        <button class="small" :disabled="g.length >= L.group_types" @click="addMonster(layer, g)">＋ 怪物</button>
        <button class="small" title="刪除這一組" @click="draft.layers[layer]!.splice(gi, 1)">✕ 這一組</button>
      </div>
      <button class="small" :disabled="(draft.layers[layer]?.length ?? 0) >= L.groups" @click="addGroup(layer)">＋ 新增一組</button>
      <HelpText text="遭遇時從所有組平均抽一組；要提高某一組的機率就多放幾組。強敵是最強的一組再多一隻。" />
      <div v-if="isBossLayer(layer)" class="row small boss">
        <strong>👑 層主</strong>
        <template v-if="bossOf(layer)?.length">
          <MonsterPick v-for="(m, mi) in bossOf(layer)" :key="mi" :entry="m" :min="L.group_count[0]" :max="L.group_count[1]" @remove="removeBossMonster(layer, mi)" />
        </template>
        <span v-else class="muted">沒設：照強敵的規則</span>
        <button class="small" :disabled="(bossOf(layer)?.length ?? 0) >= L.boss_types" @click="addBossMonster(layer)">{{ bossOf(layer)?.length ? '＋ 護衛' : '＋ 設層主' }}</button>
      </div>
      <label class="small">光線
        <select v-model="draft.lights[li]">
          <option value="">照預設（{{ defaultLight(li) }}）</option>
          <option v-for="(n, k) in LIGHTINGS" :key="k" :value="k">{{ n }}</option>
        </select>
      </label>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.boss { flex-wrap: wrap; align-items: center; gap: 4px 6px; border-top: 1px dashed var(--border); padding-top: 4px; }
.fill .pair input { width: 3.5em; }
</style>
