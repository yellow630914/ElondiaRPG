<script setup lang="ts">
import { computed, ref } from 'vue'
import { className, enemies, itemDef, itemRules, locationById, npcs as namedNpcs, stories } from '@/engine/data'
import { gearRules } from '@/engine/gear'
import { builtinBase, builtinEnemy, builtinMaterial, builtinNpc, ENEMY_KINDS, newBase, newEnemy, newItem, newMaterial, newModId, newNpc } from '@/engine/mods'
import { formatMoney } from '@/engine/money'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import { dateStamp, download } from './download'
import EnemyEditor from './content/EnemyEditor.vue'
import GearEditor from './content/GearEditor.vue'
import ItemEditor from './content/ItemEditor.vue'
import NpcEditor from './content/NpcEditor.vue'
import StoryEditor from './content/StoryEditor.vue'
import { builtinStory, newStory, START_KINDS } from '@/engine/storyMods'

// 自訂內容：新增、修改怪物與物品（包括裝備的底材與材料）。內建項目可以修改、恢復預設，不能刪除；自建項目可以刪除。
type Sub = 'enemies' | 'items' | 'bases' | 'materials' | 'npcs' | 'stories'
const SUBS: { id: Sub; label: string }[] = [
  { id: 'enemies', label: '👹 怪物' },
  { id: 'items', label: '🎒 物品' },
  { id: 'bases', label: '🗡️ 裝備底材' },
  { id: 'materials', label: '💎 材料' },
  { id: 'npcs', label: '🧑 固定 NPC' },
  { id: 'stories', label: '⭐ 特殊任務' },
]
const content = useContent()
const game = useGame()
const sub = ref<Sub>('enemies')
const search = ref('')
const filter = ref<'all' | 'custom' | 'edited'>('all')
const category = ref('')
const selected = ref<Record<Sub, string>>({ enemies: '', items: '', bases: '', materials: '', npcs: '', stories: '' })

const KINDS: Record<string, string> = { metal: '金屬', leather: '皮革', cloth: '布料', wood: '木材', jewel: '寶石' }

type Status = 'custom' | 'edited' | ''
interface Row { key: string; name: string; note: string; status: Status }
const st = (has: boolean, custom: boolean): Status => (has ? (custom ? 'custom' : 'edited') : '')

const rows = computed<Row[]>(() => {
  void content.version
  const m = content.mods
  const q = search.value.trim()
  let list: Row[] = []
  if (sub.value === 'enemies') {
    list = Object.values(enemies)
      .sort((a, b) => (m.enemies[a.id]?.custom ? -1 : 0) - (m.enemies[b.id]?.custom ? -1 : 0) || a.level - b.level)
      .map((e) => ({ key: e.id, name: e.name, note: `${e.level} 級・${ENEMY_KINDS[e.kind ?? ''] ?? ''}`, status: st(!!m.enemies[e.id], !builtinEnemy(e.id)) }))
  } else if (sub.value === 'items') {
    list = itemRules.items
      .filter((i) => !category.value || i.category === category.value)
      .map((i) => ({ key: i.name, name: i.name, note: `${itemRules.categories[i.category]}・${formatMoney(i.price_cc)}`, status: st(!!m.items[i.name], !!m.items[i.name]?.custom) }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0))
  } else if (sub.value === 'stories') {
    list = stories
      .map((d) => ({ key: d.id, name: d.title, note: `${START_KINDS[d.start.kind]}・${d.nodes.length} 個任務點`, status: st(!!m.stories[d.id], !builtinStory(d.id)) }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0))
  } else if (sub.value === 'npcs') {
    list = namedNpcs
      .map((n) => ({ key: n.id, name: n.name, note: `${locationById(n.location).name}・${n.class ? className(n.class) : n.occupation ?? '普通人'} Lv.${n.level}`, status: st(!!m.npcs[n.id], !builtinNpc(n.id)) }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0))
  } else if (sub.value === 'bases') {
    list = Object.entries(gearRules.bases).map(([id, b]) => ({ key: id, name: b.name, note: `${KINDS[b.kind]}・${formatMoney(b.price)}`, status: st(!!m.bases[id], !builtinBase(id)) }))
  } else {
    list = Object.entries(gearRules.materials).map(([id, x]) => ({ key: id, name: x.name, note: `${KINDS[x.kind]}・${x.tier} 級`, status: st(!!m.materials[id], !builtinMaterial(id)) }))
  }
  return list
    .filter((r) => !q || r.name.includes(q) || r.key.includes(q))
    .filter((r) => filter.value === 'all' || r.status === filter.value)
})

const counts = computed(() => {
  const m = content.mods
  const n = (o: Record<string, { custom?: boolean }>) => {
    const v = Object.values(o)
    return `自建 ${v.filter((x) => x.custom).length}・修改 ${v.filter((x) => !x.custom).length}`
  }
  return { enemies: n(m.enemies), items: n(m.items), bases: n(m.bases), materials: n(m.materials), npcs: n(m.npcs), stories: n(m.stories) }
})

const current = computed(() => {
  void content.version
  const key = selected.value[sub.value]
  if (!key) return ''
  const exists = sub.value === 'enemies' ? !!enemies[key] : sub.value === 'items' ? !!itemDef(key) : sub.value === 'bases' ? !!gearRules.bases[key]
    : sub.value === 'npcs' ? namedNpcs.some((n) => n.id === key) : sub.value === 'stories' ? stories.some((d) => d.id === key) : !!gearRules.materials[key]
  return exists ? key : ''
})

function select(key: string) {
  selected.value[sub.value] = key
}

function create() {
  try {
    if (sub.value === 'enemies') {
      const id = newModId('enemy')
      content.saveEnemy(id, newEnemy(id))
      select(id)
    } else if (sub.value === 'items') {
      let name = '新的物品'
      for (let i = 2; itemDef(name); i++) name = `新的物品${i}`
      content.saveItem(name, newItem(name))
      select(name)
    } else if (sub.value === 'npcs') {
      const id = newModId('npc')
      content.saveNpc(id, newNpc(id))
      select(id)
    } else if (sub.value === 'stories') {
      const id = newModId('story')
      content.saveStory(id, newStory(id))
      select(id)
    } else if (sub.value === 'bases') {
      const id = newModId('base')
      content.saveBase(id, newBase(), true)
      select(id)
    } else {
      const id = newModId('mat')
      content.saveMaterial(id, newMaterial(), true)
      select(id)
    }
    filter.value = 'all'
    search.value = ''
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}

/** 以目前選的項目為範本複製一份自建項目 */
function duplicate() {
  const key = current.value
  if (!key) return
  try {
    if (sub.value === 'enemies') {
      const id = newModId('enemy')
      const src = JSON.parse(JSON.stringify(content.mods.enemies[key] ?? enemies[key]))
      delete src.spawns
      delete src.exclude
      content.saveEnemy(id, { ...src, name: `${src.name}（複製）`, custom: true })
      select(id)
    } else if (sub.value === 'items') {
      let name = `${key}（複製）`.slice(0, 20)
      for (let i = 2; itemDef(name); i++) name = `${key.slice(0, 15)}（複製${i}）`
      content.saveItem(name, { ...JSON.parse(JSON.stringify(itemDef(key))), custom: true })
      select(name)
    } else if (sub.value === 'stories') {
      const id = newModId('story')
      const src = JSON.parse(JSON.stringify(content.mods.stories[key] ?? stories.find((d) => d.id === key)))
      content.saveStory(id, { ...src, title: `${src.title}（複製）`.slice(0, 30), custom: true })
      select(id)
    } else if (sub.value === 'npcs') {
      const id = newModId('npc')
      const src = JSON.parse(JSON.stringify(content.mods.npcs[key] ?? namedNpcs.find((n) => n.id === key)))
      content.saveNpc(id, { ...src, name: `${src.name}2`.slice(0, 12), custom: true })
      select(id)
    } else if (sub.value === 'bases') {
      const id = newModId('base')
      const src = JSON.parse(JSON.stringify(content.mods.bases[key] ?? gearRules.bases[key]))
      content.saveBase(id, { ...src, name: `${src.name}2` }, true)
      select(id)
    } else {
      const id = newModId('mat')
      const src = JSON.parse(JSON.stringify(content.mods.materials[key] ?? gearRules.materials[key]))
      content.saveMaterial(id, { ...src, name: `${src.name}2` }, true)
      select(id)
    }
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}

const NEW_LABEL: Record<Sub, string> = { enemies: '＋ 新增怪物', items: '＋ 新增物品', bases: '＋ 新增底材', materials: '＋ 新增材料', npcs: '＋ 新增角色', stories: '＋ 新增任務' }

// ---- 匯出、匯入、重設 ----
const fileInput = ref<HTMLInputElement | null>(null)
function exportAll() {
  download(`elondia-content-${dateStamp()}.json`, content.exportMods())
}
async function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (!confirm('匯入會取代目前所有的自訂內容，確定嗎？')) return
  try {
    content.importMods(await f.text())
    game.flash('已匯入自訂內容')
  } catch (err) {
    game.error = `匯入失敗：${err instanceof Error ? err.message : String(err)}`
  }
}
function resetAll() {
  if (confirm('刪除所有自建的怪物、物品、底材與材料，並把修改過的內建項目全部恢復預設？')) content.resetAll()
}
</script>

<template>
  <div class="content-view">
    <nav class="subs row">
      <button v-for="t in SUBS" :key="t.id" :class="{ active: sub === t.id }" @click="sub = t.id; category = ''">{{ t.label }}</button>
      <span class="spacer" />
      <span class="small muted">{{ counts[sub] }}</span>
    </nav>
    <p class="small muted note">
      在這裡新增或修改怪物、物品、裝備底材、材料、固定 NPC 與特殊任務。內建的項目可以修改（隨時「恢復預設」），不能刪除；自建的項目可以刪除。
      修改存在這個瀏覽器，所有存檔共用，儲存後立刻生效（已經生成的地圖、商店清單要等下次重新生成）。
    </p>
    <p v-if="content.problems.length" class="small warn-text">有些自訂內容沒辦法套用：{{ content.problems.join('；') }}</p>

    <div class="layout">
      <section class="panel list-panel">
        <div class="row">
          <button class="small primary" @click="create">{{ NEW_LABEL[sub] }}</button>
          <button class="small" :disabled="!current" title="以選取的項目為範本，建立一個自建項目" @click="duplicate">📄 複製</button>
        </div>
        <div class="row">
          <input v-model="search" placeholder="搜尋名稱" class="grow" />
          <select v-model="filter">
            <option value="all">全部</option>
            <option value="custom">自建</option>
            <option value="edited">修改過的內建</option>
          </select>
        </div>
        <select v-if="sub === 'items'" v-model="category">
          <option value="">所有類別</option>
          <option v-for="(n, k) in itemRules.categories" :key="k" :value="k">{{ n }}</option>
        </select>
        <ul class="plain rows">
          <li v-for="r in rows" :key="r.key" :class="{ active: current === r.key }" @click="select(r.key)">
            <span class="name">{{ r.name }}</span>
            <span v-if="r.status === 'custom'" class="tag">自建</span>
            <span v-else-if="r.status === 'edited'" class="tag">已修改</span>
            <span class="small muted note-r">{{ r.note }}</span>
          </li>
          <li v-if="!rows.length" class="muted small">沒有符合的項目。</li>
        </ul>
      </section>

      <section class="panel">
        <p v-if="!current" class="muted">從左邊選一個項目，或新增一個。</p>
        <EnemyEditor v-else-if="sub === 'enemies'" :id="current" :key="`e-${current}`" @deleted="select('')" />
        <ItemEditor v-else-if="sub === 'items'" :key="`i-${current}`" :name="current" @renamed="select" @deleted="select('')" />
        <NpcEditor v-else-if="sub === 'npcs'" :id="current" :key="`n-${current}`" @deleted="select('')" />
        <StoryEditor v-else-if="sub === 'stories'" :id="current" :key="`s-${current}`" @deleted="select('')" />
        <GearEditor v-else-if="sub === 'bases'" :id="current" :key="`b-${current}`" kind="base" @deleted="select('')" />
        <GearEditor v-else :id="current" :key="`m-${current}`" kind="material" @deleted="select('')" />
      </section>
    </div>

    <div class="row footer small">
      <span class="muted">自訂內容存在這個瀏覽器，所有存檔共用。</span>
      <span class="spacer" />
      <button class="small" @click="exportAll">📤 匯出自訂內容</button>
      <button class="small" title="會取代目前所有的自訂內容" @click="fileInput?.click()">📥 匯入自訂內容</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImport" />
      <button class="small danger" @click="resetAll">全部恢復預設</button>
    </div>
  </div>
</template>

<style scoped>
.content-view { display: grid; gap: 10px; max-width: 1400px; margin: 0 auto; }
.subs { gap: 6px; }
.subs button.active { border-color: var(--accent); color: var(--accent); }
.spacer { flex: 1; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.note { margin: 0; line-height: 1.7; }
.warn-text { color: var(--danger); }
.layout { display: grid; grid-template-columns: minmax(240px, 320px) 1fr; gap: 10px; align-items: start; }
@media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
.list-panel { display: grid; gap: 6px; position: sticky; top: 8px; }
.grow { flex: 1; min-width: 100px; }
.rows { max-height: 70vh; overflow: auto; margin: 0; padding: 0; list-style: none; }
.rows li { display: flex; gap: 6px; align-items: center; padding: 3px 6px; border-radius: var(--radius); cursor: pointer; }
.rows li:hover { background: var(--panel-2); }
.rows li.active { background: var(--panel-2); outline: 1px solid var(--accent); }
.rows .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-r { white-space: nowrap; }
.footer { border-top: 1px solid var(--border); padding-top: 8px; }
</style>
