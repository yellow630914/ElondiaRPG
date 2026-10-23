<script setup lang="ts">
import { computed, ref } from 'vue'
import WorldBar from './WorldBar.vue'
import { abilities, className, contractDef, describeStatus, enemies, itemDef, itemRules, landmarks, landmarkTypes, locationById, npcs as namedNpcs, perkDef, perkRules, shopRules, slaveryRules, specialMaps, statuses, stories, type ShopType } from '@/engine/data'
import { newShop, newShopId, shopAsCustom } from '@/engine/shopMods'
import { builtinLandmark, newLandmark, newLandmarkId } from '@/engine/landmarkMods'
import { builtinSpecialMap, newSpecialMap, newSpecialMapId } from '@/engine/specialMapMods'
import { newMark, newTattooTemplate } from '@/engine/tattooMods'
import { oathText, placeName, tattooRules } from '@/engine/tattoos'
import { perkPower } from '@/engine/perks'
import { gearRules } from '@/engine/gear'
import {
  ABILITY_TYPES, abilityClasses, builtinAbility, builtinBase, builtinEnemy, builtinMaterial, builtinNpc, builtinPerk, ENEMY_KINDS, enemyPlaceIndex, enemyPlaceOptions,
  ITEM_SOURCE_NAME, itemSourceIndex, newAbility, newBase, newEnemy, newItem, newMaterial, newModId, newNpc, newPerk, builtinStatus, newStatus,
  builtinMark, builtinTattoo,
} from '@/engine/mods'
import { formatMoney } from '@/engine/money'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'
import { dateStamp, download } from './download'
import AbilityEditor from './content/AbilityEditor.vue'
import EnemyEditor from './content/EnemyEditor.vue'
import GearEditor from './content/GearEditor.vue'
import ItemEditor from './content/ItemEditor.vue'
import NpcEditor from './content/NpcEditor.vue'
import PerkEditor from './content/PerkEditor.vue'
import StatusEditor from './content/StatusEditor.vue'
import StoryEditor from './content/StoryEditor.vue'
import TattooEditor from './content/TattooEditor.vue'
import ShopEditor from './content/ShopEditor.vue'
import LandmarkEditor from './content/LandmarkEditor.vue'
import SpecialMapEditor from './content/SpecialMapEditor.vue'
import MarkEditor from './content/MarkEditor.vue'
import MarkRulesEditor from './content/MarkRulesEditor.vue'
import { builtinStory, copyStory, newStory, START_KINDS } from '@/engine/storyMods'

// 自訂內容：新增、修改怪物與物品（包括裝備的底材與材料）。內建項目可以修改、恢復預設，不能刪除；自建項目可以刪除。
type Sub = 'enemies' | 'items' | 'bases' | 'materials' | 'abilities' | 'statuses' | 'perks' | 'tattoos' | 'landmarks' | 'specialMaps' | 'shops' | 'npcs' | 'stories'
const SUBS: { id: Sub; label: string }[] = [
  { id: 'enemies', label: '👹 怪物' },
  { id: 'items', label: '🎒 物品' },
  { id: 'bases', label: '🗡️ 裝備底材' },
  { id: 'materials', label: '💎 材料' },
  { id: 'abilities', label: '✨ 技能' },
  { id: 'statuses', label: '🌀 狀態' },
  { id: 'perks', label: '🌟 特質' },
  { id: 'tattoos', label: '🖋️ 刺青' },
  { id: 'landmarks', label: '🏛️ 地標' },
  { id: 'specialMaps', label: '🗺️ 特殊地圖' },
  { id: 'shops', label: '🏪 商店' },
  { id: 'npcs', label: '🧑 固定 NPC' },
  { id: 'stories', label: '⭐ 特殊任務' },
]
const content = useContent()
const game = useGame()
const sub = ref<Sub>('enemies')
const search = ref('')
const filter = ref<'all' | 'custom' | 'edited'>('all')
const category = ref('')
// 怪物：種類、出現地點、等級；物品：取得方式
const enemyKind = ref('')
const enemyPlace = ref('')
const enemyLevel = ref('')
const itemSource = ref('')
const LEVEL_BANDS: Record<string, [number, number]> = { '1-2': [1, 2], '3-4': [3, 4], '5-6': [5, 6], '7-8': [7, 8], '9-10': [9, 10], '11+': [11, 99] }
const placeOptions = enemyPlaceOptions()
const places = computed(() => {
  void content.version
  return enemyPlaceIndex()
})
const sources = computed(() => {
  void content.version
  return itemSourceIndex()
})
function resetFilters() {
  category.value = ''
  enemyKind.value = ''
  enemyPlace.value = ''
  enemyLevel.value = ''
  itemSource.value = ''
  abilityType.value = ''
  abilityClass.value = ''
  statusKind.value = ''
  tattooKind.value = ''
}
const selected = ref<Record<Sub, string>>({ enemies: '', items: '', bases: '', materials: '', abilities: '', statuses: '', perks: '', tattoos: '', landmarks: '', specialMaps: '', shops: '', npcs: '', stories: '' })
// 刺青：普通刺青、誓約印記、奴隸印記（列表的 key：t:<圖樣>、m:<印記>、rules 是印記設定）
const tattooKind = ref('')
// 狀態：增益、減益
const statusKind = ref('')
/** 清單上的效果簡述：第一項效果，太長就截斷（完整的在編輯畫面） */
function shortStatus(s: Parameters<typeof describeStatus>[0]): string {
  const parts = describeStatus(s).split('；')
  const first = parts[0]!
  return first.length > 12 ? `${first.slice(0, 11)}…` : parts.length > 1 ? `${first}…` : first
}
// 技能：種類、職業
const abilityType = ref('')
const abilityClass = ref('')

const KINDS: Record<string, string> = { metal: '金屬', leather: '皮革', cloth: '布料', wood: '木材', jewel: '寶石' }

type Status = 'custom' | 'edited' | ''
interface Row { key: string; name: string; note: string; status: Status; sort?: number }
const st = (has: boolean, custom: boolean): Status => (has ? (custom ? 'custom' : 'edited') : '')

const rows = computed<Row[]>(() => {
  void content.version
  const m = content.mods
  const q = search.value.trim()
  let list: Row[] = []
  if (sub.value === 'enemies') {
    const band = LEVEL_BANDS[enemyLevel.value]
    list = Object.values(enemies)
      .filter((e) => !enemyKind.value || (e.kind ?? '') === enemyKind.value)
      .filter((e) => !band || (e.level >= band[0] && e.level <= band[1]))
      .filter((e) => !enemyPlace.value || (enemyPlace.value === 'none' ? !places.value.get(e.id)?.size : !!places.value.get(e.id)?.has(enemyPlace.value)))
      .sort((a, b) => (m.enemies[a.id]?.custom ? -1 : 0) - (m.enemies[b.id]?.custom ? -1 : 0) || a.level - b.level)
      .map((e) => ({ key: e.id, name: e.name, note: `${e.level} 級・${ENEMY_KINDS[e.kind ?? ''] ?? ''}`, status: st(!!m.enemies[e.id], !builtinEnemy(e.id)) }))
  } else if (sub.value === 'items') {
    list = itemRules.items
      .filter((i) => !category.value || i.category === category.value)
      .filter((i) => !itemSource.value || !!sources.value.get(i.name)?.has(itemSource.value))
      .map((i) => ({ key: i.name, name: i.name, note: `${itemRules.categories[i.category]}・${formatMoney(i.price_cc)}`, status: st(!!m.items[i.name], !!m.items[i.name]?.custom) }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0))
  } else if (sub.value === 'abilities') {
    list = Object.values(abilities)
      .filter((a) => !abilityType.value || a.type === abilityType.value)
      .filter((a) => !abilityClass.value || a.classes.includes(abilityClass.value))
      .map((a) => ({
        key: a.id, name: a.name,
        note: `${ABILITY_TYPES[a.type]}${a.type === 'skill' ? ` ${a.unlock ?? 1} 級` : a.type === 'spell' ? ` ${a.circle ?? 1} 環` : ''}`,
        status: st(!!m.abilities[a.id], !builtinAbility(a.id)),
        sort: a.type === 'skill' ? a.unlock ?? 1 : a.type === 'spell' ? 20 + (a.circle ?? 1) : 0,
      }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort)
  } else if (sub.value === 'statuses') {
    list = Object.entries(statuses)
      .filter(([, s]) => !statusKind.value || s.kind === statusKind.value)
      .map(([id, s]) => ({ key: id, name: `${s.kind === 'buff' ? '🟢' : '🔴'} ${s.name}`, note: shortStatus(s), status: st(!!m.statuses?.[id], !builtinStatus(id)), sort: s.kind === 'buff' ? 0 : 1 }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort)
  } else if (sub.value === 'perks') {
    list = perkRules.perks
      .map((p) => ({ key: p.id, name: p.name, note: p.race ? '種族' : `強度 ${perkPower(p)}${p.train ? '・可受訓' : ''}`, status: st(!!m.perks[p.id], !builtinPerk(p.id)), sort: p.race ? 1 : 0 }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort)
  } else if (sub.value === 'tattoos') {
    const k = tattooKind.value
    const tats = Object.entries(tattooRules.templates)
      .filter(([, t]) => !k || t.kind === k)
      .map(([id, t]) => ({ key: `t:${id}`, name: `${t.kind === 'oath' ? '📜' : '🖋️'} ${t.name}`, note: t.kind === 'oath' ? oathText(t.attrs ?? {}) : (t.places ?? []).map(placeName).slice(0, 3).join('、'), status: st(!!m.tattoos?.[id], !builtinTattoo(id)), sort: t.kind === 'oath' ? 1 : 0 }))
    const marks = !k || k === 'slave'
      ? Object.keys(slaveryRules.contracts).map((id) => ({ key: `m:${id}`, name: `⛓️ ${contractDef(id).name}`, note: placeName(contractDef(id).place), status: st(!!m.marks?.[id], !builtinMark(id)), sort: 2 }))
      : []
    const rules = !k || k === 'slave' ? [{ key: 'rules', name: '⚙️ 印記設定', note: '用途、輕重順序、權重', status: st(!!m.markRules?.rules, false), sort: 3 }] : []
    list = [...tats, ...marks, ...rules].sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort)
  } else if (sub.value === 'landmarks') {
    list = Object.values(landmarks)
      .map((l) => ({ key: l.id, name: `${l.emoji} ${l.name}`, note: `${locationById(l.location).name}・${l.types.map((t) => landmarkTypes[t]?.name).join('、')}`, status: st(!!m.landmarks?.[l.id], !builtinLandmark(l.id)) }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0))
  } else if (sub.value === 'specialMaps') {
    list = Object.values(specialMaps)
      .map((d) => ({ key: d.id, name: `🗺️ ${d.name}`, note: `${locationById(d.location).name}・${d.grid?.length ? '固定' : '隨機'}${d.refresh ? '・會刷新' : ''}`, status: st(!!m.specialMaps?.[d.id], !builtinSpecialMap(d.id)) }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0))
  } else if (sub.value === 'shops') {
    list = Object.entries(shopRules.types)
      .map(([id, d]) => ({ key: id, name: `${d.emoji} ${d.name}`, note: d.custom ? `${m.shops?.[id]?.places?.length ?? 0} 處・${d.keeper.title}` : d.keeper.title, status: st(!!m.shops?.[id], !!d.custom) }))
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
  return { enemies: n(m.enemies), items: n(m.items), bases: n(m.bases), materials: n(m.materials), abilities: n(m.abilities), statuses: n(m.statuses ?? {}), perks: n(m.perks), tattoos: n({ ...(m.tattoos ?? {}), ...(m.marks ?? {}) }), landmarks: n(m.landmarks ?? {}), specialMaps: n(m.specialMaps ?? {}), shops: n(m.shops ?? {}), npcs: n(m.npcs), stories: n(m.stories) }
})

const current = computed(() => {
  void content.version
  const key = selected.value[sub.value]
  if (!key) return ''
  const exists = sub.value === 'enemies' ? !!enemies[key] : sub.value === 'items' ? !!itemDef(key) : sub.value === 'bases' ? !!gearRules.bases[key]
    : sub.value === 'npcs' ? namedNpcs.some((n) => n.id === key) : sub.value === 'stories' ? stories.some((d) => d.id === key)
    : sub.value === 'abilities' ? !!abilities[key] : sub.value === 'statuses' ? !!statuses[key] : sub.value === 'perks' ? !!perkDef(key)
    : sub.value === 'shops' ? !!shopRules.types[key as ShopType]
    : sub.value === 'landmarks' ? !!landmarks[key]
    : sub.value === 'specialMaps' ? !!specialMaps[key]
    : sub.value === 'tattoos' ? key === 'rules' || (key.startsWith('t:') ? !!tattooRules.templates[key.slice(2)] : !!slaveryRules.contracts[key.slice(2)])
    : !!gearRules.materials[key]
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
      for (let i = 2; itemDef(name) || game.state?.customItems?.[name]; i++) name = `新的物品${i}`
      content.saveItem(name, newItem(name))
      select(name)
    } else if (sub.value === 'npcs') {
      const id = newModId('npc')
      content.saveNpc(id, newNpc(id))
      select(id)
    } else if (sub.value === 'abilities') {
      const id = newModId('ability')
      content.saveAbility(id, newAbility(id))
      select(id)
    } else if (sub.value === 'statuses') {
      const id = newModId('status')
      content.saveStatus(id, newStatus(statusKind.value === 'debuff' ? 'debuff' : 'buff'))
      select(id)
    } else if (sub.value === 'perks') {
      const id = newModId('perk')
      content.savePerk(id, newPerk(id))
      select(id)
    } else if (sub.value === 'tattoos') {
      if (tattooKind.value === 'slave') {
        const id = newModId('mark')
        content.saveMark(id, newMark())
        select(`m:${id}`)
      } else {
        const id = newModId('tattoo')
        content.saveTattoo(id, newTattooTemplate(tattooKind.value === 'oath' ? 'oath' : 'plain'))
        select(`t:${id}`)
      }
    } else if (sub.value === 'landmarks') {
      const id = newLandmarkId()
      content.saveLandmark(id, newLandmark(id, game.state && locationById(game.state.location).type !== 'dungeon' ? game.state.location : undefined))
      select(id)
    } else if (sub.value === 'specialMaps') {
      const id = newSpecialMapId()
      content.saveSpecialMap(id, newSpecialMap(id, game.state?.location))
      select(id)
    } else if (sub.value === 'shops') {
      const id = newShopId()
      content.saveShop(id, newShop())
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
      for (let i = 2; itemDef(name) || game.state?.customItems?.[name]; i++) name = `${key.slice(0, 15)}（複製${i}）`
      content.saveItem(name, { ...JSON.parse(JSON.stringify(itemDef(key))), custom: true })
      select(name)
    } else if (sub.value === 'landmarks') {
      // 複製：同一個聚落另一格空地
      const id = newLandmarkId()
      const src = landmarks[key]!
      content.saveLandmark(id, { ...JSON.parse(JSON.stringify(src)), ...newLandmark(id, src.location), name: `${src.name}2`.slice(0, 12), emoji: src.emoji, desc: src.desc, types: [...src.types], ...(src.scene ? { scene: src.scene } : {}) })
      select(id)
    } else if (sub.value === 'specialMaps') {
      // 複製：通道不帶走（另一頭還接著原本的地圖）
      const id = newSpecialMapId()
      const src = JSON.parse(JSON.stringify(specialMaps[key]))
      delete src.connections
      content.saveSpecialMap(id, { ...src, id, name: `${src.name}2`.slice(0, 16), custom: true })
      select(id)
    } else if (sub.value === 'shops') {
      // 複製內建的店不會帶走專屬功能與位置
      const id = newShopId()
      content.saveShop(id, shopAsCustom(key))
      select(id)
    } else if (sub.value === 'stories') {
      const id = newModId('story')
      // 開頭旗標換成新任務自己的（和原本的重複算錯誤）
      content.saveStory(id, copyStory(content.mods.stories[key] ?? stories.find((d) => d.id === key)!, id))
      select(id)
    } else if (sub.value === 'perks') {
      // 複製種族特質會變成一般的特質
      const id = newModId('perk')
      const src = JSON.parse(JSON.stringify(content.mods.perks[key] ?? perkDef(key)))
      delete src.race
      content.savePerk(id, { ...src, name: `${src.name}2`.slice(0, 12), custom: true })
      select(id)
    } else if (sub.value === 'tattoos') {
      if (key === 'rules') return
      const raw = key.slice(2)
      if (key.startsWith('t:')) {
        const id = newModId('tattoo')
        const src = JSON.parse(JSON.stringify(content.mods.tattoos?.[raw] ?? tattooRules.templates[raw]))
        content.saveTattoo(id, { ...src, name: `${src.name}2`.slice(0, 12), custom: true })
        select(`t:${id}`)
      } else {
        const id = newModId('mark')
        const src = JSON.parse(JSON.stringify(content.mods.marks?.[raw] ?? slaveryRules.contracts[raw]))
        content.saveMark(id, { ...src, name: `${src.name}2`.slice(0, 12), custom: true })
        select(`m:${id}`)
      }
    } else if (sub.value === 'statuses') {
      const id = newModId('status')
      const src = JSON.parse(JSON.stringify(content.mods.statuses[key] ?? statuses[key]))
      content.saveStatus(id, { ...src, name: `${src.name}2`.slice(0, 10), custom: true })
      select(id)
    } else if (sub.value === 'abilities') {
      const id = newModId('ability')
      const src = JSON.parse(JSON.stringify(content.mods.abilities[key] ?? abilities[key]))
      content.saveAbility(id, { ...src, name: `${src.name}2`.slice(0, 16), custom: true })
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

const NEW_LABEL: Record<Sub, string> = { enemies: '＋ 新增怪物', items: '＋ 新增物品', bases: '＋ 新增底材', materials: '＋ 新增材料', abilities: '＋ 新增技能', statuses: '＋ 新增狀態', perks: '＋ 新增特質', tattoos: '＋ 新增刺青', landmarks: '＋ 新增地標', specialMaps: '＋ 新增地圖', shops: '＋ 新增商店', npcs: '＋ 新增角色', stories: '＋ 新增任務' }

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
  if (confirm('刪除所有自建的內容，並把修改過的內建項目全部恢復預設？')) content.resetAll()
}
</script>

<template>
  <div class="content-view">
    <WorldBar />
    <nav class="subs row">
      <button v-for="t in SUBS" :key="t.id" :class="{ active: sub === t.id }" @click="sub = t.id; resetFilters()">{{ t.label }}</button>
      <span class="spacer" />
      <span class="small muted">{{ counts[sub] }}</span>
    </nav>
    <p class="small muted note">
      在這裡新增或修改怪物、物品、裝備底材、材料、技能、狀態（BUFF／DEBUFF）、特質、刺青（圖樣與奴隸印記）、固定 NPC 與特殊任務。內建的項目可以修改（隨時「恢復預設」），不能刪除；自建的項目沒有被用到時可以刪除。
      修改存在目前的世界裡（用這個世界的存檔都會受影響），儲存後立刻生效（已經生成的地圖、商店清單要等下次重新生成）。
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
        <div v-if="sub === 'items'" class="row">
          <select v-model="category" class="grow">
            <option value="">所有類別</option>
            <option v-for="(n, k) in itemRules.categories" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="itemSource" class="grow">
            <option value="">所有取得方式</option>
            <option v-for="(n, k) in ITEM_SOURCE_NAME" :key="k" :value="k">{{ n }}</option>
          </select>
        </div>
        <div v-if="sub === 'enemies'" class="row">
          <select v-model="enemyKind" class="grow">
            <option value="">所有種類</option>
            <option v-for="(n, k) in ENEMY_KINDS" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="enemyLevel">
            <option value="">所有等級</option>
            <option v-for="(_, k) in LEVEL_BANDS" :key="k" :value="k">{{ k }} 級</option>
          </select>
          <select v-model="enemyPlace" class="grow">
            <option value="">所有出現地點</option>
            <option v-for="p in placeOptions" :key="p.key" :value="p.key">{{ p.label }}</option>
            <option value="none">沒有出現地點</option>
          </select>
        </div>
        <div v-if="sub === 'statuses'" class="row">
          <select v-model="statusKind" class="grow">
            <option value="">增益與減益</option>
            <option value="buff">🟢 增益（BUFF）</option>
            <option value="debuff">🔴 減益（DEBUFF）</option>
          </select>
        </div>
        <div v-if="sub === 'tattoos'" class="row">
          <select v-model="tattooKind" class="grow">
            <option value="">所有刺青與印記</option>
            <option value="plain">🖋️ 普通刺青</option>
            <option value="oath">📜 誓約印記</option>
            <option value="slave">⛓️ 奴隸印記與印記設定</option>
          </select>
        </div>
        <div v-if="sub === 'abilities'" class="row">
          <select v-model="abilityType" class="grow">
            <option value="">所有種類</option>
            <option v-for="(n, k) in ABILITY_TYPES" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="abilityClass" class="grow">
            <option value="">所有職業</option>
            <option v-for="c in abilityClasses()" :key="c" :value="c">{{ c === 'monster' ? '怪物' : className(c) }}</option>
          </select>
        </div>
        <p v-if="sub === 'enemies' || sub === 'items' || sub === 'abilities' || sub === 'statuses'" class="small muted count">符合 {{ rows.length }} 項</p>
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
        <AbilityEditor v-else-if="sub === 'abilities'" :id="current" :key="`a-${current}`" @deleted="select('')" />
        <StatusEditor v-else-if="sub === 'statuses'" :id="current" :key="`s-${current}`" @deleted="select('')" />
        <PerkEditor v-else-if="sub === 'perks'" :id="current" :key="`p-${current}`" @deleted="select('')" />
        <ShopEditor v-else-if="sub === 'shops'" :id="current" :key="`shop-${current}`" @deleted="select('')" />
        <LandmarkEditor v-else-if="sub === 'landmarks'" :id="current" :key="`lm-${current}`" @deleted="select('')" />
        <SpecialMapEditor v-else-if="sub === 'specialMaps'" :id="current" :key="`sm-${current}`" @deleted="select('')" />
        <template v-else-if="sub === 'tattoos'">
          <MarkRulesEditor v-if="current === 'rules'" key="rules" />
          <TattooEditor v-else-if="current.startsWith('t:')" :id="current.slice(2)" :key="current" @deleted="select('')" />
          <MarkEditor v-else :id="current.slice(2)" :key="current" @deleted="select('')" />
        </template>
        <NpcEditor v-else-if="sub === 'npcs'" :id="current" :key="`n-${current}`" @deleted="select('')" />
        <StoryEditor v-else-if="sub === 'stories'" :id="current" :key="`s-${current}`" @deleted="select('')" @open="select" />
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
.count { margin: 0; }
.rows { max-height: 70vh; overflow: auto; margin: 0; padding: 0; list-style: none; }
.rows li { display: flex; gap: 6px; align-items: center; padding: 3px 6px; border-radius: var(--radius); cursor: pointer; }
.rows li:hover { background: var(--panel-2); }
.rows li.active { background: var(--panel-2); outline: 1px solid var(--accent); }
.rows .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-r { white-space: nowrap; }
.footer { border-top: 1px solid var(--border); padding-top: 8px; }
</style>
