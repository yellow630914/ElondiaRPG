<script setup lang="ts">
import { computed, ref } from 'vue'
import WorldBar from './WorldBar.vue'
import { abilities, className, companionRules, contractDef, describeCondition, describeStatus, enemies, genderName, raceName, tagDef, itemDef, itemRules, landmarks, landmarkTypes, locationById, MASTER_EVENT_POOLS, type MasterEventPool, npcs as namedNpcs, regionById, perkDef, perkRules, shopRules, slaveryRules, specialMaps, statuses, stories, storyCounters, type ShopType } from '@/engine/data'
import { newShop, newShopId, shopAsCustom } from '@/engine/shopMods'
import { builtinLandmark, newLandmark, newLandmarkId } from '@/engine/landmarkMods'
import { builtinSpecialMap, newSpecialMap, newSpecialMapId } from '@/engine/specialMapMods'
import { newMark, newTattooTemplate } from '@/engine/tattooMods'
import { oathText, placeName, tattooRules } from '@/engine/tattoos'
import { perkCategory, perkPower, PERK_CATEGORIES } from '@/engine/perks'
import { baseSlots, gearRules } from '@/engine/gear'
import { CONTENT_TAGS } from '@/engine/content'
import { BODY_NAME } from '@/engine/traits'
import {
  ABILITY_TYPES, abilityClasses, builtinAbility, builtinBase, builtinEnemy, builtinMaterial, builtinNpc, builtinPerk, ENEMY_KINDS, enemyPlaceIndex, enemyPlaceOptions,
  ITEM_SOURCE_NAME, itemSourceIndex, newAbility, newBase, newEnemy, newItem, newMaterial, newModId, newNpc, newPerk, builtinStatus, newStatus, newCondition,
  builtinMark, builtinTattoo, conditionIds,
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
import ConditionEditor from './content/ConditionEditor.vue'
import CountersEditor from './content/CountersEditor.vue'
import StoryEditor from './content/StoryEditor.vue'
import TattooEditor from './content/TattooEditor.vue'
import ShopEditor from './content/ShopEditor.vue'
import LandmarkEditor from './content/LandmarkEditor.vue'
import SpecialMapEditor from './content/SpecialMapEditor.vue'
import MarkEditor from './content/MarkEditor.vue'
import MarkRulesEditor from './content/MarkRulesEditor.vue'
import { builtinStory, copyStory, newStory, START_KINDS } from '@/engine/storyMods'
import TravelEventEditor from './content/TravelEventEditor.vue'
import MasterEventEditor from './content/MasterEventEditor.vue'
import { allMasterEvents, builtinMasterEvent, masterEventById, newMasterEvent, POOL_IDS } from '@/engine/masterEventMods'
import EventRulesEditor from './content/EventRulesEditor.vue'
import BindRulesEditor from './content/BindRulesEditor.vue'
import CategoryIconsEditor from './content/CategoryIconsEditor.vue'
import ItemIcon from './items/ItemIcon.vue'
import ContentIcon from './icons/ContentIcon.vue'
import { travelEvents } from '@/engine/road'
import { MODE_NAME } from '@/engine/travel'
import { builtinTravelEvent, DUNGEON_TRIGGERS, newTravelEvent } from '@/engine/travelEventMods'
import { parasiteRules } from '@/engine/parasites'

// 自訂內容：新增、修改怪物與物品（包括裝備的底材與材料）。內建項目可以修改、恢復預設，不能刪除；自建項目可以刪除。
type Sub = 'enemies' | 'items' | 'bases' | 'materials' | 'abilities' | 'statuses' | 'perks' | 'tattoos' | 'landmarks' | 'specialMaps' | 'shops' | 'events' | 'masterEvents' | 'npcs' | 'stories'
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
  { id: 'events', label: '🎲 事件' },
  { id: 'masterEvents', label: '⛓️ 主奴與娼館' },
  { id: 'npcs', label: '🧑 固定 NPC' },
  { id: 'stories', label: '⭐ 特殊任務' },
]
const content = useContent()
const game = useGame()
const sub = ref<Sub>('enemies')
/** 「類別圖示」分頁：只有一個設定畫面，沒有左邊的列表 */
const iconsTab = ref(false)
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
  pickStatusType.value = false
  tattooKind.value = ''
  eventScope.value = ''
  masterPool.value = ''
  gearSlot.value = ''
  matKind.value = ''
  perkCat.value = ''
  placeFilter.value = ''
  adultFilter.value = ''
  tagFilter.value = ''
  bodyFilter.value = ''
  flagFilter.value = ''
  npcGender.value = ''
  npcRace.value = ''
  npcKind.value = ''
  npcJob.value = ''
  npcTag.value = ''
  storyLevel.value = ''
  storyNpc.value = ''
}
const selected = ref<Record<Sub, string>>({ enemies: '', items: '', bases: '', materials: '', abilities: '', statuses: '', perks: '', tattoos: '', landmarks: '', specialMaps: '', shops: '', events: '', masterEvents: '', npcs: '', stories: '' })
// 刺青：普通刺青、誓約印記、奴隸印記（列表的 key：t:<圖樣>、m:<印記>、rules 是印記設定）
const tattooKind = ref('')
// 狀態：增益、減益、非戰鬥狀態（列表的 key：戰鬥狀態是 id，非戰鬥狀態是 c:<id>）
const statusKind = ref('')
// 事件：旅途、城鎮（列表的 key 是事件 id，rules 是事件設定）
const eventScope = ref('')
// 主奴與娼館：事件庫
const masterPool = ref('')
/** 清單上的效果簡述：第一項效果，太長就截斷（完整的在編輯畫面） */
function shortStatus(s: Parameters<typeof describeStatus>[0]): string {
  const parts = describeStatus(s).split('；')
  const first = parts[0]!
  return first.length > 12 ? `${first.slice(0, 11)}…` : parts.length > 1 ? `${first}…` : first
}
function shortCondition(c: Parameters<typeof describeCondition>[0]): string {
  const parts = describeCondition(c).split('；')
  const first = parts[0]!
  return first.length > 12 ? `${first.slice(0, 11)}…` : parts.length > 1 ? `${first}…` : first
}
// 技能：種類、職業
const abilityType = ref('')
const abilityClass = ref('')

const KINDS: Record<string, string> = { metal: '金屬', leather: '皮革', cloth: '布料', wood: '木材', jewel: '寶石' }
const BASE_SLOTS = baseSlots()

// 底材、裝備：欄位、材料類型；特質：分類
const gearSlot = ref('')
const matKind = ref('')
const perkCat = ref('')
// 地標、事件、固定 NPC、特殊任務共用：地點、成人向、內容標籤、主角形象、旗標
const placeFilter = ref('')
const adultFilter = ref('')
const tagFilter = ref('')
const bodyFilter = ref('')
const flagFilter = ref('')
// 固定 NPC：性別、種族、身分、職業、標籤；特殊任務：建議等級、固定 NPC
const npcGender = ref('')
const npcRace = ref('')
const npcKind = ref('')
const npcJob = ref('')
const npcTag = ref('')
const storyLevel = ref('')
const storyNpc = ref('')
const NPC_KINDS: Record<string, string> = { commoner: '普通人', adventurer: '冒險者' }
const STORY_BANDS: Record<string, [number, number]> = { '1-4': [1, 4], '5-8': [5, 8], '9-11': [9, 11], '12-15': [12, 15], '16-18': [16, 18], '19-20': [19, 99] }

const FLAG_KEYS = new Set(['flags', 'flags_none', 'flags_any', 'set_flags', 'clear_flags', 'start_flags'])
/** 一個定義裡寫到的所有旗標（條件與設定的旗標，任何深度） */
function flagsIn(o: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(o)) for (const x of o) flagsIn(x, out)
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (FLAG_KEYS.has(k) && Array.isArray(v)) {
        for (const f of v) if (typeof f === 'string') out.add(f)
      } else flagsIn(v, out)
    }
  }
  return out
}
/** 特殊任務裡出現的固定 NPC（開始的角色、任務點的角色、同伴與敵人） */
function npcsIn(o: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(o)) for (const x of o) npcsIn(x, out)
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'npc' && typeof v === 'string') out.add(v)
      else if ((k === 'allies' || k === 'foes') && Array.isArray(v)) {
        for (const x of v) if (typeof x === 'string') out.add(x)
      } else npcsIn(v, out)
    }
  }
  return out
}
const flagMatch = (o: unknown) => {
  const q = flagFilter.value.trim()
  return !q || [...flagsIn(o)].some((f) => f.includes(q))
}
const adultMatch = (adult: boolean) => !adultFilter.value || (adultFilter.value === 'yes') === adult
const bodyMatch = (bodies: string[] | undefined) => !bodyFilter.value || (bodyFilter.value === 'any' ? !bodies?.length : !!bodies?.includes(bodyFilter.value))
const locName = (id: string) => {
  try {
    return locationById(id).name
  } catch {
    return id
  }
}
/** 這一頁的篩選選項：用到的地點、旗標、職業、標籤 */
const options = computed(() => {
  void content.version
  const sorted = (ids: Iterable<string>, name: (id: string) => string = (x) => x) => [...new Set(ids)].map((id) => [id, name(id)] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'))
  const flagsOf = (list: unknown[]) => [...new Set(list.flatMap((x) => [...flagsIn(x)]))].sort()
  if (sub.value === 'landmarks') {
    const list = Object.values(landmarks)
    return { places: sorted(list.map((l) => l.location), locName), flags: flagsOf(list) }
  }
  if (sub.value === 'events') {
    const t = travelEvents.templates
    const regions = sorted(t.flatMap((x) => x.regions ?? []), (id) => {
      try {
        return `地區：${regionById(id).name}`
      } catch {
        return `地區：${id}`
      }
    }).map(([id, n]) => [`r:${id}`, n] as [string, string])
    return { places: [...sorted(t.flatMap((x) => [...(x.locations ?? []), ...(x.dungeons ?? [])]), locName), ...regions], flags: flagsOf(t) }
  }
  if (sub.value === 'npcs') {
    const jobs = [...sorted(namedNpcs.filter((n) => n.class).map((n) => n.class), className).map(([id, n]) => [`c:${id}`, n] as [string, string]),
      ...sorted(namedNpcs.filter((n) => !n.class && n.occupation).map((n) => n.occupation!)).map(([id, n]) => [`o:${id}`, n] as [string, string])]
    return {
      places: sorted(namedNpcs.map((n) => n.location), locName), flags: flagsOf(namedNpcs), jobs,
      genders: sorted(namedNpcs.map((n) => n.gender ?? ''), (g) => genderName(g) || '未設定'),
      races: sorted(namedNpcs.map((n) => n.race), raceName),
      tags: sorted(namedNpcs.flatMap((n) => n.tags ?? []), (t) => tagDef(t)?.name ?? t),
    }
  }
  if (sub.value === 'stories') return { flags: flagsOf(stories), npcNames: [...new Set(namedNpcs.map((n) => n.name))].sort() }
  return {}
})

/** 特殊任務頁的「劇情計數器」那一列 */
const COUNTERS_KEY = '|counters'
/** 裝備底材清單裡的「雙面效應設定」 */
const BIND_RULES_KEY = '|bind_rules'

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
      .filter((i) => category.value !== 'equipment' || ((!gearSlot.value || gearRules.bases[i.gear?.base ?? '']?.slot === gearSlot.value)
        && (!matKind.value || gearRules.materials[i.gear?.material ?? '']?.kind === matKind.value)))
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
    const conds = !statusKind.value || statusKind.value === 'cond'
      ? conditionIds().map((id) => {
        const c = companionRules.conditions[id]!
        return { key: `c:${id}`, name: `🏕️ ${c.name}`, note: shortCondition(c), status: st(!!m.conditions?.[id], !!m.conditions?.[id]?.custom), sort: 2 }
      })
      : []
    list = [...list, ...conds].sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || (a.sort ?? 0) - (b.sort ?? 0))
  } else if (sub.value === 'perks') {
    list = perkRules.perks
      .filter((p) => !perkCat.value || (perkCat.value === 'race' ? !!p.race : !p.race && perkCategory(p) === perkCat.value))
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
      .filter((l) => !placeFilter.value || l.location === placeFilter.value)
      .filter((l) => adultMatch(!!l.open?.adult || !!l.scenes?.some((x) => x.tags?.includes('adult'))))
      .filter((l) => flagMatch(l))
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
  } else if (sub.value === 'events') {
    const k = eventScope.value
    const evs = travelEvents.templates
      .filter((t) => !k || (t.scope ?? 'road') === k)
      .filter((t) => {
        const p = placeFilter.value
        if (!p) return true
        if (p === 'none') return !t.locations?.length && !t.dungeons?.length && !t.regions?.length
        return p.startsWith('r:') ? !!t.regions?.includes(p.slice(2)) : !!t.locations?.includes(p) || !!t.dungeons?.includes(p)
      })
      .filter((t) => adultMatch(!!t.tags?.includes('adult')))
      .filter((t) => !tagFilter.value || !!t.tags?.includes(tagFilter.value as never))
      .filter((t) => bodyMatch(t.pc_body))
      .filter((t) => flagMatch(t))
      .map((t) => ({
        key: t.id, name: `${t.scope === 'town' ? '🏘️' : t.scope === 'dungeon' ? '⚠️' : t.scope === 'parasite' ? '💗' : t.tier === 'advanced' ? '✨' : '🧭'} ${t.title}`,
        note: t.scope === 'town' ? `城鎮・${t.kind === 'check' ? '檢定' : '選擇'}`
          : t.scope === 'parasite' ? `發作・${parasiteRules.parasites[t.parasite ?? '']?.name ?? t.parasite}${t.stages?.length ? `・${t.stages.map((i) => parasiteRules.stages[i]?.name).join('、')}` : ''}`
          : t.scope === 'dungeon' ? `地下城・${(t.triggers ?? []).map((x) => DUNGEON_TRIGGERS[x]).join('、')}${t.tags?.includes('adult') ? '・成人向' : ''}`
          : `${(t.modes ?? []).map((m) => MODE_NAME[m]).join('、') || '任何路段'}・${t.kind === 'check' ? '檢定' : '選擇'}`,
        status: st(!!m.travelEvents?.[t.id], !builtinTravelEvent(t.id)), sort: t.scope === 'town' ? 1 : t.scope === 'dungeon' ? 2 : t.scope === 'parasite' ? 2.5 : 0,
      }))
    const narrowed = placeFilter.value || adultFilter.value || tagFilter.value || bodyFilter.value || flagFilter.value.trim()
    const rules = narrowed ? [] : [{ key: 'rules', name: '⚙️ 事件設定', note: '機率、權重、冷卻', status: st(!!m.eventRules?.rules, false), sort: 3 }]
    list = [...evs, ...rules].sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort)
  } else if (sub.value === 'masterEvents') {
    list = allMasterEvents()
      .filter((x) => !masterPool.value || x.pool === masterPool.value)
      .filter((x) => adultMatch(!!x.def.adult))
      .map(({ pool, def }) => ({
        key: def.id, name: def.text.replace(/\{master\}/g, '主人').slice(0, 28) || def.id,
        note: `${MASTER_EVENT_POOLS[pool]}${def.adult ? '・成人向' : ''}${def.teaches?.length ? `・技能 ${def.teaches.length}` : ''}`,
        status: st(!!m.masterEvents?.[def.id], !builtinMasterEvent(def.id)), sort: POOL_IDS.indexOf(pool),
      }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0) || a.sort - b.sort)
  } else if (sub.value === 'stories') {
    const counters = { key: COUNTERS_KEY, name: '🔢 劇情計數器', note: `${Object.keys(storyCounters).length} 個`, status: st(Object.keys(m.counters ?? {}).length > 0, false) }
    const band = STORY_BANDS[storyLevel.value]
    const who = storyNpc.value.trim()
    const narrowed = band || who || adultFilter.value || tagFilter.value || bodyFilter.value || flagFilter.value.trim()
    list = [...(narrowed ? [] : [counters]), ...stories
      .filter((d) => !band || ((d.start.min_level ?? 1) >= band[0] && (d.start.min_level ?? 1) <= band[1]))
      .filter((d) => adultMatch(!!d.tags?.includes('adult')))
      .filter((d) => !tagFilter.value || !!d.tags?.includes(tagFilter.value))
      .filter((d) => bodyMatch(d.start.pc_body))
      .filter((d) => flagMatch(d))
      .filter((d) => !who || [...npcsIn(d)].some((id) => (namedNpcs.find((n) => n.id === id)?.name ?? id).includes(who)))
      .map((d) => ({ key: d.id, name: d.title, note: `${START_KINDS[d.start.kind]}・${d.nodes.length} 個任務點`, status: st(!!m.stories[d.id], !builtinStory(d.id)) }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0))]
  } else if (sub.value === 'npcs') {
    const job = npcJob.value
    list = namedNpcs
      .filter((n) => !placeFilter.value || n.location === placeFilter.value)
      .filter((n) => !npcGender.value || (n.gender ?? '') === npcGender.value)
      .filter((n) => !npcRace.value || n.race === npcRace.value)
      .filter((n) => !npcKind.value || (n.kind ?? (n.class ? 'adventurer' : 'commoner')) === npcKind.value)
      .filter((n) => !job || (job.startsWith('c:') ? n.class === job.slice(2) : !n.class && n.occupation === job.slice(2)))
      .filter((n) => !npcTag.value || !!n.tags?.includes(npcTag.value))
      .filter((n) => flagMatch(n))
      .map((n) => ({ key: n.id, name: n.name, note: `${locationById(n.location).name}・${n.class ? className(n.class) : n.occupation ?? '普通人'} Lv.${n.level}`, status: st(!!m.npcs[n.id], !builtinNpc(n.id)) }))
      .sort((a, b) => (a.status === 'custom' ? -1 : 0) - (b.status === 'custom' ? -1 : 0))
  } else if (sub.value === 'bases') {
    list = Object.entries(gearRules.bases)
      .filter(([, b]) => (!gearSlot.value || b.slot === gearSlot.value) && (!matKind.value || b.kind === matKind.value))
      .map(([id, b]) => ({ key: id, name: b.name, note: `${KINDS[b.kind]}・${formatMoney(b.price)}`, status: st(!!m.bases[id], !builtinBase(id)) }))
    // 雙面效應設定（拘束具的減值與戰鬥增益）：不篩選時排在最後
    if (!gearSlot.value && !matKind.value) list.push({ key: BIND_RULES_KEY, name: '⚙️ 雙面效應設定', note: '拘束具的減值、戰鬥增益、鎖', status: st(!!m.bindRules?.rules, false) })
  } else {
    list = Object.entries(gearRules.materials)
      .filter(([, x]) => !matKind.value || x.kind === matKind.value)
      .map(([id, x]) => ({ key: id, name: x.name, note: `${KINDS[x.kind]}・${x.tier} 級`, status: st(!!m.materials[id], !builtinMaterial(id)) }))
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
  return { enemies: n(m.enemies), items: n(m.items), bases: n(m.bases), materials: n(m.materials), abilities: n(m.abilities), statuses: n({ ...(m.statuses ?? {}), ...Object.fromEntries(Object.entries(m.conditions ?? {}).map(([k, v]) => [`c:${k}`, v as { custom?: boolean }])) }), perks: n(m.perks), tattoos: n({ ...(m.tattoos ?? {}), ...(m.marks ?? {}) }), landmarks: n(m.landmarks ?? {}), specialMaps: n(m.specialMaps ?? {}), shops: n(m.shops ?? {}), events: n(m.travelEvents ?? {}), masterEvents: n(m.masterEvents ?? {}), npcs: n(m.npcs), stories: n(m.stories) }
})

const current = computed(() => {
  void content.version
  const key = selected.value[sub.value]
  if (!key) return ''
  const exists = sub.value === 'enemies' ? !!enemies[key] : sub.value === 'items' ? !!itemDef(key) : sub.value === 'bases' ? key === BIND_RULES_KEY || !!gearRules.bases[key]
    : sub.value === 'npcs' ? namedNpcs.some((n) => n.id === key) : sub.value === 'stories' ? key === COUNTERS_KEY || stories.some((d) => d.id === key)
    : sub.value === 'abilities' ? !!abilities[key] : sub.value === 'statuses' ? (key.startsWith('c:') ? conditionIds().includes(key.slice(2)) : !!statuses[key]) : sub.value === 'perks' ? !!perkDef(key)
    : sub.value === 'shops' ? !!shopRules.types[key as ShopType]
    : sub.value === 'landmarks' ? !!landmarks[key]
    : sub.value === 'specialMaps' ? !!specialMaps[key]
    : sub.value === 'events' ? key === 'rules' || travelEvents.templates.some((t) => t.id === key)
    : sub.value === 'masterEvents' ? !!masterEventById(key)
    : sub.value === 'tattoos' ? key === 'rules' || (key.startsWith('t:') ? !!tattooRules.templates[key.slice(2)] : !!slaveryRules.contracts[key.slice(2)])
    : !!gearRules.materials[key]
  return exists ? key : ''
})

function select(key: string) {
  selected.value[sub.value] = key
}

// 新增狀態時選類型（戰鬥狀態：技能與物品在戰鬥中施加；非戰鬥狀態：記在角色身上，事件、食物、地標給予）
const pickStatusType = ref(false)
function createStatus(type: 'combat' | 'cond') {
  pickStatusType.value = false
  try {
    if (type === 'combat') {
      const id = newModId('status')
      content.saveStatus(id, newStatus(statusKind.value === 'debuff' ? 'debuff' : 'buff'))
      if (statusKind.value === 'cond') statusKind.value = ''
      select(id)
    } else {
      const id = newModId('cond')
      content.saveCondition(id, newCondition())
      if (statusKind.value === 'buff' || statusKind.value === 'debuff') statusKind.value = ''
      select(`c:${id}`)
    }
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
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
      // 先選類型：戰鬥狀態或非戰鬥狀態
      pickStatusType.value = !pickStatusType.value
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
    } else if (sub.value === 'events') {
      const id = newModId('event')
      content.saveTravelEvent(id, newTravelEvent(id, eventScope.value === 'town' || eventScope.value === 'dungeon' || eventScope.value === 'parasite' ? eventScope.value : 'road'))
      select(id)
    } else if (sub.value === 'masterEvents') {
      const id = newModId('mevent')
      content.saveMasterEvent(id, newMasterEvent(id, (POOL_IDS as string[]).includes(masterPool.value) ? masterPool.value as MasterEventPool : 'master'))
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
  // 非戰鬥狀態不能自建
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
    } else if (sub.value === 'events') {
      if (key === 'rules') return
      const id = newModId('event')
      const src = JSON.parse(JSON.stringify(content.mods.travelEvents?.[key] ?? travelEvents.templates.find((t) => t.id === key)))
      content.saveTravelEvent(id, { ...src, id, title: `${src.title}2`.slice(0, 20), custom: true })
      select(id)
    } else if (sub.value === 'masterEvents') {
      const id = newModId('mevent')
      const found = masterEventById(key)!
      content.saveMasterEvent(id, { ...JSON.parse(JSON.stringify(content.mods.masterEvents?.[key] ?? found.def)), pool: found.pool, custom: true })
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
    } else if (sub.value === 'statuses' && key.startsWith('c:')) {
      const id = newModId('cond')
      const src = JSON.parse(JSON.stringify(companionRules.conditions[key.slice(2)]))
      content.saveCondition(id, { ...src, name: `${src.name}2`.slice(0, 10), custom: true })
      select(`c:${id}`)
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

const NEW_LABEL: Record<Sub, string> = { enemies: '＋ 新增怪物', items: '＋ 新增物品', bases: '＋ 新增底材', materials: '＋ 新增材料', abilities: '＋ 新增技能', statuses: '＋ 新增狀態', perks: '＋ 新增特質', tattoos: '＋ 新增刺青', landmarks: '＋ 新增地標', specialMaps: '＋ 新增地圖', shops: '＋ 新增商店', events: '＋ 新增事件', masterEvents: '＋ 新增事件', npcs: '＋ 新增角色', stories: '＋ 新增任務' }

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
    <p v-if="content.persistFailed" class="persist-warn small">
      ⚠️ 世界存不進瀏覽器（容量滿了，多半是上傳的圖示太多或太大）：這次的修改只在關掉頁面前有效。請移除一些圖示，或先匯出世界包備份。
    </p>
    <nav class="subs row">
      <button v-for="t in SUBS" :key="t.id" :class="{ active: !iconsTab && sub === t.id }" @click="iconsTab = false; sub = t.id; resetFilters()">{{ t.label }}</button>
      <button :class="{ active: iconsTab }" @click="iconsTab = true">🖼️ 類別圖示</button>
      <span class="spacer" />
      <span class="small muted">{{ iconsTab ? `已自訂 ${Object.keys(content.mods.categoryIcons ?? {}).length} 種類別` : counts[sub] }}</span>
    </nav>
    <p class="small muted note">
      在這裡新增或修改怪物、物品、裝備底材、材料、技能、狀態（BUFF／DEBUFF）、特質、刺青（圖樣與奴隸印記）、固定 NPC 與特殊任務。內建的項目可以修改（隨時「恢復預設」），不能刪除；自建的項目沒有被用到時可以刪除。
      修改存在目前的世界裡（用這個世界的存檔都會受影響），儲存後立刻生效（已經生成的地圖、商店清單要等下次重新生成）。
    </p>
    <p v-if="content.problems.length" class="small warn-text">有些自訂內容沒辦法套用：{{ content.problems.join('；') }}</p>

    <section v-if="iconsTab" class="panel">
      <CategoryIconsEditor />
    </section>
    <div v-else class="layout">
      <section class="panel list-panel">
        <div class="row">
          <button class="small primary" @click="create">{{ NEW_LABEL[sub] }}</button>
          <button class="small" :disabled="!current || current === 'rules' || current.startsWith('|')" title="以選取的項目為範本，建立一個自建項目" @click="duplicate">📄 複製</button>
        </div>
        <div v-if="sub === 'statuses' && pickStatusType" class="pick-type">
          <span class="small muted">新狀態的類型：</span>
          <button class="small" title="技能或物品在戰鬥中施加，持續幾回合" @click="createStatus('combat')">⚔️ 戰鬥狀態（BUFF／DEBUFF）</button>
          <button class="small" title="記在角色身上，事件、特殊任務、地標、食物給予，可以設定長休時解除" @click="createStatus('cond')">🏕️ 非戰鬥狀態</button>
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
        <div v-if="sub === 'items' && category === 'equipment'" class="row">
          <select v-model="gearSlot" class="grow">
            <option value="">所有欄位</option>
            <option v-for="(n, k) in BASE_SLOTS" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="matKind" class="grow">
            <option value="">所有材料類型</option>
            <option v-for="(n, k) in KINDS" :key="k" :value="k">{{ n }}</option>
          </select>
        </div>
        <div v-if="sub === 'bases'" class="row">
          <select v-model="gearSlot" class="grow">
            <option value="">所有欄位</option>
            <option v-for="(n, k) in BASE_SLOTS" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="matKind" class="grow">
            <option value="">所有材料類型</option>
            <option v-for="(n, k) in KINDS" :key="k" :value="k">{{ n }}</option>
          </select>
        </div>
        <div v-if="sub === 'materials'" class="row">
          <select v-model="matKind" class="grow">
            <option value="">所有材料類型</option>
            <option v-for="(n, k) in KINDS" :key="k" :value="k">{{ n }}</option>
          </select>
        </div>
        <div v-if="sub === 'perks'" class="row">
          <select v-model="perkCat" class="grow">
            <option value="">所有分類</option>
            <option v-for="(n, k) in PERK_CATEGORIES" :key="k" :value="k">{{ n }}</option>
            <option value="race">種族天賦</option>
          </select>
        </div>
        <div v-if="sub === 'landmarks'" class="row">
          <select v-model="placeFilter" class="grow">
            <option value="">所有地點</option>
            <option v-for="[k, n] in options.places ?? []" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="adultFilter">
            <option value="">成人向與一般</option>
            <option value="yes">🔞 成人向</option>
            <option value="no">一般</option>
          </select>
          <input v-model="flagFilter" list="cv-flags" placeholder="旗標（條件或設定的）" class="grow" />
          <datalist id="cv-flags"><option v-for="f in options.flags ?? []" :key="f" :value="f" /></datalist>
        </div>
        <div v-if="sub === 'npcs'" class="row">
          <select v-model="placeFilter" class="grow">
            <option value="">所有地點</option>
            <option v-for="[k, n] in options.places ?? []" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="npcGender">
            <option value="">所有性別</option>
            <option v-for="[k, n] in options.genders ?? []" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="npcRace">
            <option value="">所有種族</option>
            <option v-for="[k, n] in options.races ?? []" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="npcKind">
            <option value="">所有身分</option>
            <option v-for="(n, k) in NPC_KINDS" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="npcJob" class="grow">
            <option value="">所有職業</option>
            <option v-for="[k, n] in options.jobs ?? []" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="npcTag" class="grow">
            <option value="">所有標籤</option>
            <option v-for="[k, n] in options.tags ?? []" :key="k" :value="k">{{ n }}</option>
          </select>
          <input v-model="flagFilter" list="cv-flags" placeholder="旗標（條件或設定的）" class="grow" />
          <datalist id="cv-flags"><option v-for="f in options.flags ?? []" :key="f" :value="f" /></datalist>
        </div>
        <div v-if="sub === 'stories'" class="row">
          <select v-model="storyLevel">
            <option value="">所有建議等級</option>
            <option v-for="(_, k) in STORY_BANDS" :key="k" :value="k">Lv.{{ k }}</option>
          </select>
          <select v-model="tagFilter" class="grow">
            <option value="">所有內容標籤</option>
            <option v-for="(t, k) in CONTENT_TAGS" :key="k" :value="k">{{ t.name }}</option>
          </select>
          <select v-model="adultFilter">
            <option value="">成人向與一般</option>
            <option value="yes">🔞 成人向</option>
            <option value="no">一般</option>
          </select>
          <select v-model="bodyFilter">
            <option value="">所有主角形象</option>
            <option value="any">不限形象</option>
            <option v-for="(n, k) in BODY_NAME" :key="k" :value="k">只給{{ n }}</option>
          </select>
          <input v-model="storyNpc" list="cv-npcs" placeholder="固定 NPC 名稱" class="grow" />
          <datalist id="cv-npcs"><option v-for="n in options.npcNames ?? []" :key="n" :value="n" /></datalist>
          <input v-model="flagFilter" list="cv-flags" placeholder="旗標（條件或設定的）" class="grow" />
          <datalist id="cv-flags"><option v-for="f in options.flags ?? []" :key="f" :value="f" /></datalist>
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
            <option value="">所有狀態</option>
            <option value="buff">🟢 增益（BUFF）</option>
            <option value="debuff">🔴 減益（DEBUFF）</option>
            <option value="cond">🏕️ 非戰鬥狀態（用餐、喝酒……）</option>
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
        <div v-if="sub === 'events'" class="row">
          <select v-model="eventScope" class="grow">
            <option value="">所有事件</option>
            <option value="road">🧭 旅途事件</option>
            <option value="town">🏘️ 城鎮事件</option>
            <option value="dungeon">⚠️ 地下城事件</option>
            <option value="parasite">💗 寄生物的發作</option>
          </select>
          <select v-model="placeFilter" class="grow">
            <option value="">所有地點</option>
            <option v-for="[k, n] in options.places ?? []" :key="k" :value="k">{{ n }}</option>
            <option value="none">沒有限制地點</option>
          </select>
          <select v-model="adultFilter">
            <option value="">成人向與一般</option>
            <option value="yes">🔞 成人向</option>
            <option value="no">一般</option>
          </select>
          <select v-model="tagFilter" class="grow">
            <option value="">所有內容標籤</option>
            <option v-for="(t, k) in CONTENT_TAGS" :key="k" :value="k">{{ t.name }}</option>
          </select>
          <select v-model="bodyFilter">
            <option value="">所有主角形象</option>
            <option value="any">不限形象</option>
            <option v-for="(n, k) in BODY_NAME" :key="k" :value="k">只給{{ n }}</option>
          </select>
          <input v-model="flagFilter" list="cv-flags" placeholder="旗標（條件或設定的）" class="grow" />
          <datalist id="cv-flags"><option v-for="f in options.flags ?? []" :key="f" :value="f" /></datalist>
        </div>
        <div v-if="sub === 'masterEvents'" class="row">
          <select v-model="masterPool" class="grow">
            <option value="">所有事件庫</option>
            <option v-for="p in POOL_IDS" :key="p" :value="p">{{ MASTER_EVENT_POOLS[p] }}</option>
          </select>
          <select v-model="adultFilter">
            <option value="">成人向與一般</option>
            <option value="yes">🔞 成人向</option>
            <option value="no">一般</option>
          </select>
        </div>
        <div v-if="sub === 'abilities'" class="row">
          <select v-model="abilityType" class="grow">
            <option value="">所有種類</option>
            <option v-for="(n, k) in ABILITY_TYPES" :key="k" :value="k">{{ n }}</option>
          </select>
          <select v-model="abilityClass" class="grow">
            <option value="">所有職業</option>
            <option v-for="c in abilityClasses()" :key="c" :value="c">{{ c === 'monster' ? '怪物' : c === 'lewd' ? '色情技能（不分職業）' : className(c) }}</option>
          </select>
        </div>
        <p v-if="sub !== 'shops' && sub !== 'specialMaps' && sub !== 'tattoos'" class="small muted count">符合 {{ rows.length }} 項</p>
        <ul class="plain rows">
          <li v-for="r in rows" :key="r.key" :class="{ active: current === r.key }" @click="select(r.key)">
            <ItemIcon v-if="sub === 'items'" :name="r.key" :size="18" class="row-ic" />
            <ItemIcon v-else-if="sub === 'bases' && r.key !== BIND_RULES_KEY" :spec="{ base: r.key, material: '' }" :size="18" class="row-ic" />
            <ContentIcon v-else-if="sub === 'enemies'" kind="monster" :id="r.key" :size="16" class="row-ic" />
            <ContentIcon v-else-if="sub === 'abilities'" kind="ability" :id="r.key" :size="16" class="row-ic" />
            <ContentIcon v-else-if="sub === 'materials'" kind="material" :id="r.key" :size="16" class="row-ic" />
            <ContentIcon v-else-if="sub === 'perks'" kind="perk" :id="r.key" :size="16" class="row-ic" />
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
        <ConditionEditor v-else-if="sub === 'statuses' && current.startsWith('c:')" :id="current.slice(2)" :key="current" @deleted="select('')" />
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
        <template v-else-if="sub === 'events'">
          <EventRulesEditor v-if="current === 'rules'" key="ev-rules" />
          <TravelEventEditor v-else :id="current" :key="`ev-${current}`" @deleted="select('')" />
        </template>
        <MasterEventEditor v-else-if="sub === 'masterEvents'" :id="current" :key="`me-${current}`" @deleted="select('')" />
        <NpcEditor v-else-if="sub === 'npcs'" :id="current" :key="`n-${current}`" @deleted="select('')" />
        <CountersEditor v-else-if="sub === 'stories' && current === COUNTERS_KEY" key="counters" />
        <StoryEditor v-else-if="sub === 'stories'" :id="current" :key="`s-${current}`" @deleted="select('')" @open="select" />
        <BindRulesEditor v-else-if="sub === 'bases' && current === BIND_RULES_KEY" key="bind-rules" />
        <GearEditor v-else-if="sub === 'bases'" :id="current" :key="`b-${current}`" kind="base" @deleted="select('')" />
        <GearEditor v-else :id="current" :key="`m-${current}`" kind="material" @deleted="select('')" />
      </section>
    </div>

    <div class="row footer small">
      <span class="muted">這些內容屬於世界「{{ content.activeName }}」，用這個世界的存檔共用。</span>
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
.pick-type { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px; border: 1px dashed var(--border); border-radius: var(--radius); }
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
.row-ic { color: var(--accent); }
.persist-warn { margin: 0; padding: 6px 10px; border: 1px solid var(--danger); border-radius: var(--radius); color: var(--danger); }
.footer { border-top: 1px solid var(--border); padding-top: 8px; }
</style>
