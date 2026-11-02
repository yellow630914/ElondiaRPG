<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DUNGEON_LAYER_IDS, DUNGEON_LAYER_NAME, enemies, geography, itemRules, landmarks, locationById, shopRules, specialMapLegend, specialMaps, type EncounterGroup, type ShopType, type SpecialConnection } from '@/engine/data'
import { CELL_ICON, cellName, settlementArea, type CellKind } from '@/engine/grid'
import { builtinSpecialMap, LIGHTINGS, MAP_CHARS, mapSize, SPECIAL_MAP_LIMITS, specialMapUsage, type SpecialMapMod } from '@/engine/specialMapMods'
import { PARK_LINK } from '@/engine/park'
import type { CellRef } from '@/engine/shopMods'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import CellPicker from './CellPicker.vue'
import UsageNote from './UsageNote.vue'
import Hint from '../ui/Hint.vue'
import EditorHeader from './EditorHeader.vue'
import RequiresEditor from './RequiresEditor.vue'
import FoldSet from './FoldSet.vue'
import CellGrid from './CellGrid.vue'
import MonsterPick from './MonsterPick.vue'
import HelpText from './HelpText.vue'

// 特殊地圖的編輯表單：基本資料（所屬地點、給 AI 的描述、光線、刷新）、版面（畫格子或隨機挖）、
// 額外的隨機內容、遭遇表與採集物、通道（接到城鎮區塊的牆或別張特殊地圖）。內建的不能刪除
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ deleted: [] }>()
const content = useContent()
const game = useGame()
const L = SPECIAL_MAP_LIMITS

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
type Conn = SpecialConnection & { flagsText: string; flagsNoneText: string }
type Draft = SpecialMapMod & { mode: 'fixed' | 'random'; conns: Conn[] }
function current(): Draft {
  void content.version
  const d = clone(specialMaps[props.id]!) as SpecialMapMod
  return {
    ...d,
    mode: d.grid?.length ? 'fixed' : 'random',
    conns: (d.connections ?? []).map((c) => ({ ...c, flagsText: (c.requires?.flags ?? []).join('、'), flagsNoneText: (c.requires?.flags_none ?? []).join('、') })),
  }
}
const draft = ref<Draft>(current())
const saved = ref(JSON.stringify(draft.value))
function reset() {
  draft.value = current()
  saved.value = JSON.stringify(draft.value)
  tool.value = '#'
}
watch(() => props.id, reset)
const dirty = computed(() => JSON.stringify(draft.value) !== saved.value)
const builtin = computed(() => !!builtinSpecialMap(props.id))
// 這張地圖是哪些地標的內部：裡面的事件是地標的場景（在地標頁編輯），列出來免得以為地圖是空的
const asInterior = computed(() => Object.values(landmarks).filter((l) => l.interior === props.id))
const edited = computed(() => builtin.value && !!content.mods.specialMaps?.[props.id])
const usage = computed(() => {
  void content.version
  return specialMapUsage(props.id)
})

// ---- 版面 ----
const legend = specialMapLegend as Record<string, CellKind>
// BOSS 格在特殊地圖叫「BOSS」（地下城的同一種格子是層主）
const paletteName = (k: CellKind) => (k === 'boss' ? 'BOSS' : cellName(k))
const palette = MAP_CHARS.map((ch) => ({ ch, kind: legend[ch]!, name: paletteName(legend[ch]!), icon: CELL_ICON[legend[ch]!] ?? '' }))
/** 畫筆：一種格子、設定入口，或設定第幾個通道的位置 */
const tool = ref<string>('#')
const painting = ref(false)
const size = computed(() => mapSize(draft.value))
function setMode(mode: 'fixed' | 'random') {
  draft.value.mode = mode
  if (mode === 'fixed' && !draft.value.grid?.length) {
    const [w, h] = draft.value.size ?? [9, 7]
    draft.value.grid = Array.from({ length: h }, (_, y) => (y === 0 || y === h - 1 ? '#'.repeat(w) : `#${'.'.repeat(w - 2)}#`))
    draft.value.grid[h - 1] = `${'#'.repeat(Math.floor(w / 2))}E${'#'.repeat(w - Math.floor(w / 2) - 1)}`
  }
  if (mode === 'random') draft.value.size ??= [size.value[0], size.value[1]]
}
function resize(w: number, h: number) {
  w = Math.max(L.size[0], Math.min(L.size[1], Math.round(w) || 3))
  h = Math.max(L.size[0], Math.min(L.size[1], Math.round(h) || 3))
  if (draft.value.mode === 'random') {
    draft.value.size = [w, h]
    return
  }
  const old = draft.value.grid ?? []
  draft.value.grid = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => old[y]?.[x] ?? '#').join(''))
}
function charAt(x: number, y: number) {
  return draft.value.grid?.[y]?.[x] ?? '#'
}
/** 畫筆用的格子種類（一排一排攤平） */
const paintKinds = computed(() => Array.from({ length: size.value[0] * size.value[1] }, (_, i) => legend[charAt(i % size.value[0], Math.floor(i / size.value[0]))]))
/** 另一張地圖的格子（通道的另一頭）：每一排可能不一樣長，照最長的攤平 */
const gridWidth = (rows: string[]) => Math.max(...rows.map((r) => r.length))
const gridKinds = (rows: string[]) => rows.flatMap((r) => [...r.padEnd(gridWidth(rows), '#')].map((ch) => legend[ch]))
function paint(x: number, y: number) {
  const t = tool.value
  if (t === 'entry') {
    draft.value.entry = { x, y }
    return
  }
  if (t.startsWith('conn:')) {
    const c = draft.value.conns[Number(t.slice(5))]
    if (c) c.at = { x, y }
    tool.value = '#'
    return
  }
  if (t.startsWith('shop:')) {
    const s = draft.value.shops?.[Number(t.slice(5))]
    if (s) Object.assign(s, { x, y })
    tool.value = '#'
    return
  }
  const row = [...(draft.value.grid?.[y] ?? '')]
  row[x] = t
  draft.value.grid![y] = row.join('')
}
function down(x: number, y: number) {
  painting.value = !tool.value.startsWith('conn:') && !tool.value.startsWith('shop:') && tool.value !== 'entry'
  paint(x, y)
}
function enter(x: number, y: number) {
  if (painting.value) paint(x, y)
}
function markerAt(x: number, y: number): string {
  const i = draft.value.conns.findIndex((c) => c.at.x === x && c.at.y === y)
  if (i >= 0) return `🔗${i + 1}`
  const s = draft.value.shops?.find((sh) => sh.x === x && sh.y === y)
  if (s) return shopRules.types[s.shop as ShopType]?.emoji ?? '🏪'
  if (draft.value.entry && draft.value.entry.x === x && draft.value.entry.y === y) return '📍'
  if (legend[charAt(x, y)] === 'boss') return `👑${bossCells.value.findIndex((b) => b.x === x && b.y === y) + 1}`
  return ''
}

// ---- 遭遇表與採集物 ----
const monsterList = computed(() => {
  void content.version
  return Object.values(enemies).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
})
function addGroup() {
  ;(draft.value.table ??= []).push([[monsterList.value[0]!.id, 1]])
}
function removeGroup(i: number) {
  draft.value.table!.splice(i, 1)
  if (!draft.value.table!.length) delete draft.value.table
}
// ---- BOSS 格：地圖上每一格 B 各自的怪物與名字 ----
const bossCells = computed(() => {
  if (draft.value.mode !== 'fixed') return []
  const out: { x: number; y: number }[] = []
  ;(draft.value.grid ?? []).forEach((row, y) => [...row].forEach((ch, x) => { if (legend[ch] === 'boss') out.push({ x, y }) }))
  return out
})
function bossAt(x: number, y: number) {
  return draft.value.bosses?.find((b) => b.x === x && b.y === y)
}
function editBoss(x: number, y: number) {
  const list = (draft.value.bosses ??= [])
  let b = list.find((v) => v.x === x && v.y === y)
  if (!b) {
    b = { x, y, group: [[monsterList.value[0]!.id, 1]] }
    list.push(b)
  }
  return b
}
function addBossMonster(x: number, y: number) {
  const b = bossAt(x, y)
  if (!b) editBoss(x, y)
  else if (b.group.length < L.group_types) b.group.push([monsterList.value[0]!.id, 1])
}
function removeBossMonster(x: number, y: number, i: number) {
  const b = bossAt(x, y)
  if (!b) return
  b.group.splice(i, 1)
  if (!b.group.length && !b.name) draft.value.bosses = draft.value.bosses!.filter((v) => v !== b)
}
function setBossName(x: number, y: number, name: string) {
  let b = bossAt(x, y)
  if (!b) {
    b = { x, y, group: [] }
    ;(draft.value.bosses ??= []).push(b)
  }
  if (name.trim()) b.name = name
  else delete b.name
}
function addMonster(g: EncounterGroup) {
  if (g.length < L.group_types) g.push([monsterList.value[0]!.id, 1])
}
const itemNames = computed(() => {
  void content.version
  return itemRules.items.map((i) => i.name)
})
const pickItem = ref('')
function addItem() {
  const n = pickItem.value.trim()
  if (!n || !itemNames.value.includes(n)) return
  const list = (draft.value.resource_items ??= [])
  if (!list.includes(n) && list.length < L.items) list.push(n)
  pickItem.value = ''
}
function rangeOf(k: 'encounters' | 'traps' | 'resources' | 'chests', i: 0 | 1): number {
  return draft.value[k]?.[i] ?? 0
}
function setRange(k: 'encounters' | 'traps' | 'resources' | 'chests', i: 0 | 1, v: number) {
  const r: [number, number] = [...(draft.value[k] ?? [0, 0])] as [number, number]
  r[i] = Math.max(0, Math.round(v) || 0)
  if (r[0] || r[1]) draft.value[k] = r
  else delete draft.value[k]
}

// ---- 商店 ----
const shopList = computed(() => {
  void content.version
  return Object.entries(shopRules.types).filter(([id]) => id !== 'wanderer').map(([id, t]) => ({ id, name: `${t.emoji} ${t.name}` }))
})
function addShop() {
  const list = (draft.value.shops ??= [])
  if (list.length >= L.shops) return
  list.push({ shop: 'general', x: 0, y: 0 })
  tool.value = `shop:${list.length - 1}`
}
function removeShop(i: number) {
  draft.value.shops!.splice(i, 1)
  if (!draft.value.shops!.length) delete draft.value.shops
  tool.value = '#'
}

// ---- 通道 ----
const otherMaps = computed(() => {
  void content.version
  return Object.values(specialMaps).filter((m) => m.id !== props.id)
})
function addConn() {
  if (draft.value.conns.length >= L.connections) return
  draft.value.conns.push({ at: { x: 0, y: 0 }, to: { area: '', x: 0, y: 0 }, flagsText: '', flagsNoneText: '' })
  tool.value = `conn:${draft.value.conns.length - 1}`
}
/** 以這張地圖為入口廣場的園區（主題地下城，geography 的 park） */
const parks = computed(() => geography.locations.filter((l) => l.park === props.id))
function connKind(c: Conn): 'town' | 'map' | 'park' {
  return c.to.area.startsWith('sm/') ? 'map' : c.to.area.startsWith(PARK_LINK) ? 'park' : 'town'
}
function setConnKind(c: Conn, kind: 'town' | 'map' | 'park') {
  c.to = kind === 'map' ? { area: otherMaps.value[0] ? `sm/${otherMaps.value[0].id}` : '', x: 0, y: 0 }
    : kind === 'park' ? { area: parks.value[0] ? `${PARK_LINK}${parks.value[0].id}` : '', x: 0, y: 0 } : { area: '', x: 0, y: 0 }
}
function townRef(c: Conn): CellRef | null {
  return c.to.area && !c.to.area.startsWith('sm/') ? { area: c.to.area, x: c.to.x, y: c.to.y } : null
}
function pickTown(c: Conn, r: CellRef | null) {
  if (r) c.to = { area: r.area, x: r.x, y: r.y }
}
function targetGrid(c: Conn): string[] {
  return specialMaps[c.to.area.slice(3)]?.grid ?? []
}
function townText(c: Conn) {
  const a = settlementArea(c.to.area, false)
  return a ? `${locationById(a.location).name}・${a.name}（${c.to.x}, ${c.to.y}）` : '還沒選'
}
const splitFlags = (t: string) => t.split(/[、,，\s]+/).map((x) => x.trim()).filter(Boolean)

function save() {
  try {
    const { mode, conns, ...m } = draft.value
    if (mode === 'random') {
      delete m.grid
      m.size ??= [9, 7]
    } else delete m.size
    // BOSS 格：只留還畫在地圖上的
    if (m.bosses) {
      m.bosses = m.bosses.filter((b) => bossCells.value.some((c) => c.x === b.x && c.y === b.y))
      if (!m.bosses.length) delete m.bosses
    }
    m.connections = conns.filter((c) => c.to.area).map((c) => ({
      at: c.at, to: c.to,
      ...(splitFlags(c.flagsText).length || splitFlags(c.flagsNoneText).length ? { requires: { flags: splitFlags(c.flagsText), flags_none: splitFlags(c.flagsNoneText) } } : {}),
    }))
    const want = m.connections.length
    content.saveSpecialMap(props.id, m)
    const got = specialMaps[props.id]?.connections?.length ?? 0
    reset()
    game.flash(got < want ? `已儲存，但有 ${want - got} 個通道不合規則被拿掉（城鎮那一頭要是牆或水、座標要在地圖裡、只有固定地圖可以設通道）` : `已儲存「${specialMaps[props.id]?.name}」`)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
function restore() {
  if (!confirm(`把「${draft.value.name}」恢復成內建的樣子？`)) return
  content.restoreSpecialMap(props.id)
  reset()
}
function remove() {
  if (!confirm(`刪除自建的特殊地圖「${draft.value.name}」？存檔裡的這張地圖也會作廢。`)) return
  try {
    content.deleteSpecialMap(props.id)
    emit('deleted')
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <div class="editor" @mouseup="painting = false" @mouseleave="painting = false">
    <EditorHeader
      :title="`🗺️ ${draft.name}`" :kind="builtin ? 'builtin' : 'custom'" :edited="edited" :dirty="dirty" :usage="usage"
      @save="save" @discard="reset" @restore="restore" @remove="remove"
    />
    <p class="small muted">
      id：{{ id }}。特殊地圖可以被特殊任務的事件傳送進來、放任務點，或用通道接到城鎮區塊的牆、別張特殊地圖。
      裡面只能在安全點（或旅店格）長休，不能直接出發旅行；從出口離開回到進來前的地方，倒下時被送回所屬地點。改了版面或內容的設定，存檔裡的這張地圖會重新生成。
    </p>
    <UsageNote :usage="usage" :deletable="!builtin" />

    <FoldSet>
      <template #legend>基本</template>
      <div class="grid">
        <label>名稱 <input v-model="draft.name" :maxlength="L.name_chars" /></label>
        <label>所屬地點
          <select v-model="draft.location">
            <option v-for="l in geography.locations" :key="l.id" :value="l.id">{{ l.name }}</option>
          </select>
        </label>
        <label>光線
          <select v-model="draft.lighting"><option v-for="(n, k) in LIGHTINGS" :key="k" :value="k">{{ n }}</option></select>
        </label>
        <label>陷阱、寶箱比照
          <select v-model="draft.layer"><option v-for="l in DUNGEON_LAYER_IDS" :key="l" :value="l">地下城{{ DUNGEON_LAYER_NAME[l] }}</option></select>
        </label>
      </div>
      <label class="block"><span>給 AI 的描述 <Hint text="外觀、氣氛、危險；在裡面的每一則日誌都會帶上。" /></span><textarea v-model="draft.desc" rows="3" :maxlength="L.desc_chars" /></label>
      <label class="check small"><input v-model="draft.refresh" type="checkbox" /> 會刷新：離開這片特殊地圖之後再進來，遭遇、資源與寶箱全部重來 <Hint text="沒勾時打過、採過的一直保持。" /></label>
      <label class="check small"><input v-model="draft.peaceful" type="checkbox" /> 安全的室內：休息不會被襲擊 <Hint text="例如地標的內部（咖啡廳、宴會廳）。" /></label>
      <div v-for="l in asInterior" :key="l.id" class="small interior-note">
        <b>{{ l.emoji }} {{ l.name }}的內部</b>：裡面的事件是那個地標的場景（在「地標」頁編輯，條件成立時出現，預設每 3 天一次）。
        <ul v-if="l.scenes?.length">
          <li v-for="sc in l.scenes" :key="sc.title">{{ sc.title }}<template v-if="sc.spot">（{{ sc.spot_name || `${sc.spot.x}, ${sc.spot.y}` }}）</template><template v-else>（在外面的地標格上）</template></li>
        </ul>
        <span v-else class="muted">還沒有任何場景。</span>
      </div>
    </FoldSet>

    <FoldSet>
      <template #legend>版面</template>
      <div class="row small">
        <label class="check"><input type="radio" :checked="draft.mode === 'fixed'" @change="setMode('fixed')" /> 固定地圖（自己畫）</label>
        <label class="check"><input type="radio" :checked="draft.mode === 'random'" @change="setMode('random')" /> 隨機地圖 <Hint text="從下方中央的出口挖出通道。" /></label>
        <label>寬 <input type="number" :value="size[0]" :min="L.size[0]" :max="L.size[1]" @change="resize(Number(($event.target as HTMLInputElement).value), size[1])" /></label>
        <label>高 <input type="number" :value="size[1]" :min="L.size[0]" :max="L.size[1]" @change="resize(size[0], Number(($event.target as HTMLInputElement).value))" /></label>
        <label v-if="draft.mode === 'random'">挖幾步 <input v-model.number="draft.carve_steps" type="number" :min="L.carve[0]" :max="L.carve[1]" :placeholder="String(size[0] * size[1])" /></label>
      </div>
      <template v-if="draft.mode === 'fixed'">
        <div class="row small palette">
          <button v-for="p in palette" :key="p.ch" class="small" :class="{ primary: tool === p.ch }" :title="p.name" @click="tool = p.ch">{{ p.icon || p.ch }} {{ p.name }}</button>
          <button class="small" :class="{ primary: tool === 'entry' }" title="被事件傳送進來時站的位置" @click="tool = 'entry'">📍 入口</button>
        </div>
        <p v-if="tool.startsWith('conn:')" class="small tip">點地圖上的一格，當作通道 {{ Number(tool.slice(5)) + 1 }} 在這張地圖的位置。</p>
        <p v-if="tool.startsWith('shop:')" class="small tip">點地圖上的一格擺這家店。</p>
        <CellGrid
          :kinds="paintKinds" :width="size[0]" :size="24" paint
          :icon="(i) => markerAt(i % size[0], Math.floor(i / size[0])) || undefined"
          :title-of="(i) => `(${i % size[0]}, ${Math.floor(i / size[0])}) ${cellName(paintKinds[i] ?? 'wall')}`"
          @down="(i) => down(i % size[0], Math.floor(i / size[0]))" @enter="(i) => enter(i % size[0], Math.floor(i / size[0]))"
        />
        <HelpText text="選上面的格子種類，在地圖上點或拖曳來畫。遭遇、強敵、資源、寶箱、陷阱畫在地圖上是固定位置（內容在生成時擲）；BOSS 格的怪物在下方「BOSS 格」指定；沒有出口時只能從通道進出。" />
      </template>
    </FoldSet>

    <FoldSet>
      <template #legend>額外的隨機內容（最少～最多） <Hint text="撒在空地上。" /></template>
      <div class="grid">
        <label v-for="[k, n] in ([['encounters', '遭遇'], ['traps', '陷阱'], ['resources', '資源'], ['chests', '寶箱']] as const)" :key="k">{{ n }}
          <span class="row">
            <input type="number" min="0" :max="L.count[1]" :value="rangeOf(k, 0)" @change="setRange(k, 0, Number(($event.target as HTMLInputElement).value))" />～
            <input type="number" min="0" :max="L.count[1]" :value="rangeOf(k, 1)" @change="setRange(k, 1, Number(($event.target as HTMLInputElement).value))" />
          </span>
        </label>
        <label>強敵 <input v-model.number="draft.elites" type="number" min="0" :max="L.elites[1]" /></label>
      </div>
    </FoldSet>

    <FoldSet>
      <template #legend>遭遇表（選填）</template>
      <HelpText text="空白時：所屬地點是地下城就用「陷阱、寶箱比照」那一層的遭遇，其他用地區的城郊遭遇表。強敵是最強的一組再多一隻。" />
      <div v-for="(g, gi) in draft.table ?? []" :key="gi" class="row small">
        <span>第 {{ gi + 1 }} 組：</span>
        <MonsterPick v-for="(m, mi) in g" :key="mi" :entry="m" :min="L.group_count[0]" :max="L.group_count[1]" @remove="g.splice(mi, 1); if (!g.length) removeGroup(gi)" />
        <button class="small" :disabled="g.length >= L.group_types" @click="addMonster(g)">＋ 怪物</button>
        <button class="small" title="刪除這一組" @click="removeGroup(gi)">✕ 這一組</button>
      </div>
      <button class="small" :disabled="(draft.table?.length ?? 0) >= L.table" @click="addGroup">＋ 新增一組</button>
    </FoldSet>

    <FoldSet v-if="draft.mode === 'fixed'">
      <template #legend>BOSS 格 <Hint text="在版面用「BOSS」畫上的格子，每一格各自指定守在那裡的怪物（一組，最多 4 種）與名字。名字顯示在地圖與戰鬥的場景；沒指定怪物時照強敵的規則（遭遇表最大的一組再多一隻）。打倒之後不再出現（會刷新的地圖再進來時重來）。" /></template>
      <p v-if="!bossCells.length" class="small muted">版面上還沒有 BOSS 格。選上面的「👑 BOSS」在地圖上畫一格。</p>
      <div v-for="(c, bi) in bossCells" :key="`${c.x},${c.y}`" class="row small boss">
        <strong>👑{{ bi + 1 }}</strong>
        <span class="muted">（{{ c.x }}, {{ c.y }}）</span>
        <input :value="bossAt(c.x, c.y)?.name ?? ''" :maxlength="L.boss_name_chars" placeholder="名字（選填，例如 下水道之王）" style="width: 13em" @change="setBossName(c.x, c.y, ($event.target as HTMLInputElement).value)" />
        <template v-if="bossAt(c.x, c.y)?.group.length">
          <MonsterPick v-for="(m, mi) in bossAt(c.x, c.y)!.group" :key="mi" :entry="m" :min="L.group_count[0]" :max="L.group_count[1]" @remove="removeBossMonster(c.x, c.y, mi)" />
        </template>
        <span v-else class="tip">沒指定怪物：照強敵的規則</span>
        <button class="small" :disabled="(bossAt(c.x, c.y)?.group.length ?? 0) >= L.group_types" @click="addBossMonster(c.x, c.y)">＋ 怪物</button>
      </div>
    </FoldSet>

    <FoldSet>
      <template #legend>採集物（選填）</template>
      <div class="chips">
        <span v-for="(n, i) in draft.resource_items ?? []" :key="n" class="tag chip">{{ n }} <button class="x" @click="draft.resource_items!.splice(i, 1)" title="移除">✕</button></span>
        <span v-if="!draft.resource_items?.length" class="small muted">（沒有時用地下城的採集表）</span>
      </div>
      <div class="row">
        <input v-model="pickItem" list="cv-item-names" placeholder="物品名稱" @keydown.enter="addItem" />
        <button class="small" @click="addItem">＋ 加入</button>
      </div>
    </FoldSet>

    <FoldSet>
      <template #legend>商店</template>
      <p v-if="draft.mode !== 'fixed'" class="small muted">只有固定地圖可以擺商店。</p>
      <template v-else>
        <p class="small muted">擺在這張地圖上的店（內建店種或自建的店），站上去就能交易；物價與貨色照所屬地點。</p>
        <div v-for="(s, si) in draft.shops ?? []" :key="si" class="row small">
          <select v-model="s.shop"><option v-for="o in shopList" :key="o.id" :value="o.id">{{ o.name }}</option></select>
          <span>在（{{ s.x }}, {{ s.y }}）</span>
          <button class="small" :class="{ primary: tool === `shop:${si}` }" @click="tool = `shop:${si}`">在地圖上選</button>
          <button class="small warn" @click="removeShop(si)" title="刪除這一項">✕</button>
        </div>
        <button class="small" :disabled="(draft.shops?.length ?? 0) >= L.shops" @click="addShop">＋ 擺一家店</button>
      </template>
    </FoldSet>

    <FoldSet>
      <template #legend>通道</template>
      <p v-if="draft.mode !== 'fixed'" class="small muted">只有固定地圖可以設定通道；隨機地圖只能由事件傳送進來。</p>
      <template v-else>
        <HelpText text="通道把這張地圖的一格和另一張地圖（城鎮區塊的牆或水、或別張特殊地圖的任一格）接起來，打開時兩頭都變成通道、互相走得過去。寫了旗標的話，旗標成立才打開。" />
        <div v-for="(c, ci) in draft.conns" :key="ci" class="conn">
          <div class="row small">
            <strong>通道 {{ ci + 1 }}</strong>
            <span>這張地圖的（{{ c.at.x }}, {{ c.at.y }}）</span>
            <button class="small" :class="{ primary: tool === `conn:${ci}` }" @click="tool = `conn:${ci}`">在地圖上選</button>
            <span>接到</span>
            <label class="check"><input type="radio" :checked="connKind(c) === 'town'" @change="setConnKind(c, 'town')" /> 城鎮區塊</label>
            <label class="check"><input type="radio" :checked="connKind(c) === 'map'" :disabled="!otherMaps.length" @change="setConnKind(c, 'map')" /> 特殊地圖</label>
            <label v-if="parks.length" class="check" title="以這張地圖為入口廣場的園區（主題地下城）：走上去等於從入口進那座地下城"><input type="radio" :checked="connKind(c) === 'park'" @change="setConnKind(c, 'park')" /> 園區</label>
            <span class="spacer" />
            <button class="small warn" @click="draft.conns.splice(ci, 1); tool = '#'" title="刪除這一項">✕</button>
          </div>
          <template v-if="connKind(c) === 'town'">
            <p class="small">城鎮那一頭：{{ townText(c) }}</p>
            <CellPicker :model-value="townRef(c)" :location="draft.location" marker="🔗" walls @update:model-value="pickTown(c, $event)" />
          </template>
          <label v-else-if="connKind(c) === 'park'" class="small">園區
            <select v-model="c.to.area"><option v-for="l in parks" :key="l.id" :value="`${PARK_LINK}${l.id}`">{{ l.name }}</option></select>
          </label>
          <template v-else>
            <label class="small">地圖
              <select v-model="c.to.area"><option v-for="m in otherMaps" :key="m.id" :value="`sm/${m.id}`">{{ m.name }}</option></select>
            </label>
            <CellGrid
              v-if="targetGrid(c).length" :kinds="gridKinds(targetGrid(c))" :width="gridWidth(targetGrid(c))" :size="18" marker="🔗"
              :picked="c.to.y * gridWidth(targetGrid(c)) + c.to.x" @pick="(i) => { c.to.x = i % gridWidth(targetGrid(c)); c.to.y = Math.floor(i / gridWidth(targetGrid(c))) }"
            />
            <p v-else class="small muted">那張是隨機地圖，沒辦法接通道。</p>
          </template>
          <RequiresEditor
            :model-value="{ flags: splitFlags(c.flagsText), flags_none: splitFlags(c.flagsNoneText) }" label="通道打開的條件" placeholder="可以不填" :extras="false"
            @update:model-value="(v) => { c.flagsText = (v.flags ?? []).join('、'); c.flagsNoneText = (v.flags_none ?? []).join('、') }"
          />
        </div>
        <button class="small" :disabled="draft.conns.length >= L.connections" @click="addConn">＋ 新增通道</button>
      </template>
    </FoldSet>
  </div>
</template>

<style scoped src="./editor.css"></style>
<style scoped>
.interior-note { border-left: 3px solid var(--accent); padding-left: 8px; margin-top: 4px; }
.interior-note ul { margin: 2px 0 0; padding-left: 18px; }
.palette { flex-wrap: wrap; gap: 4px; }
.conn { border-top: 1px dashed var(--border); padding-top: 6px; margin-top: 6px; display: grid; gap: 6px; }
.tip { color: var(--accent); }
.boss { flex-wrap: wrap; align-items: center; gap: 4px 6px; border-top: 1px dashed var(--border); padding-top: 4px; }
</style>
