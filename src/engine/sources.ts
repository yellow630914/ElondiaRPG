// 內容「怎麼拿到」的來源索引（docs/CONTENT_DEPENDENCIES.md 第 2.1 節）：物品、特質、狀態、怪物在遊戲裡從哪裡來。
//
// 和 usage.ts 的「哪裡用到」不同：這裡只是說明，不擋刪除（例如商店依標籤上架、怪物掉落）。
// 一次掃過全部資料建成索引，之後查詢不再掃描；內容套用（applyContent）後作廢，下次查詢時重建。

import { familyRules } from './pregMarks'
import mapsJson from '@data/world/maps.json'
import securityJson from '@data/rules/security.json'
import {
  abilities, attributeRules, DUNGEON_LAYER_NAME, geography, craftRules, dungeonEncounters, enemies, itemRules, landmarks, lewdRules, MASTER_EVENT_POOLS, masterEventPool,
  npcs, npcTags, perkRules, shopRules, specialMaps, statuses, stories, townQuestTemplates, wildEncounterTables, type EncounterGroup, type MasterEventPool,
} from './data'
import { forgeItemsFor, gearName, gearRules, MATERIAL_KINDS, monsterLootItems } from './gear'
import { parasiteRules } from './parasites'
import { travelEvents } from './road'
import { notForSale } from './trade'

/** 城鎮委託的標題裡的 {town}、{landmark} 是接委託時才填的：說明裡換成一般的說法 */
function questTitle(t: string): string {
  return t.replaceAll('{town}', '某座城').replaceAll('{landmark}', '某個地標')
}

export type SourceKind = 'item' | 'perk' | 'status' | 'enemy'

/** 物品的取得方式（內容清單的篩選）；lose 是「交出」：列在「跟誰有關」，但不算拿得到 */
export const ITEM_SOURCE_NAME = {
  shop: '商店', craft: '製作與種植', gear: '隨機生成的制式裝備', chest: '寶箱', gather: '資源格', drop: '怪物掉落',
  quest: '特殊任務與委託', event: '事件與地標', venue: '拍賣會與淫鬥場', steal: '偷竊', forced: '強制裝上、寄生物', none: '沒有取得方式',
} as const
export type ItemSourceKind = keyof typeof ITEM_SOURCE_NAME | 'lose'

type Index = Record<SourceKind, Map<string, string[]>> & { itemKinds: Map<string, Set<ItemSourceKind>> }
let cache: Index | undefined

/** 內容改了：下次查詢時重建索引 */
export function invalidateSources() {
  cache = undefined
}

/** 這一項在遊戲裡怎麼拿到（物品、特質）、怎麼出現（狀態、怪物）；沒有任何來源時是空的 */
export function sourcesOf(kind: SourceKind, key: string): string[] {
  return (cache ??= build())[kind].get(key) ?? []
}

/** 這件物品拿得到嗎（「交出」不算） */
export function itemObtainable(name: string): boolean {
  return [...((cache ??= build()).itemKinds.get(name) ?? [])].some((k) => k !== 'lose')
}

/** 每件物品的取得方式（ITEM_SOURCE_NAME 的 key；一個都沒有的是 none） */
export function itemSourceIndex(): Map<string, Set<ItemSourceKind>> {
  const idx = (cache ??= build()).itemKinds
  const out = new Map<string, Set<ItemSourceKind>>()
  for (const i of itemRules.items) {
    const set = new Set([...(idx.get(i.name) ?? [])].filter((k) => k !== 'lose'))
    if (!set.size) set.add('none')
    out.set(i.name, set)
  }
  return out
}

const LAYER_NAME: Record<string, string> = DUNGEON_LAYER_NAME
const KIND_NAME: Record<string, string> = {
  beast: '野獸', humanoid: '人形', undead: '不死', spirit: '靈體', construct: '構裝', plant: '植物', demon: '魔族', elemental: '元素', fey: '妖精',
}
const EVENT_SCOPE: Record<string, string> = { town: '城鎮事件', dungeon: '地下城事件', parasite: '寄生物的發作' }
/** 引擎直接施加的狀態（不在任何資料裡） */
const SYSTEM_STATUS: Record<string, string> = {
  defending: '戰鬥中選「防禦」',
  climax: '慾望滿了高潮（慾望戰鬥）',
  afterglow_combat: '高潮之後（慾望戰鬥）',
  spent: '用了引爆類的能力之後脫力',
}
/** 一個欄位列出的名稱太多時只列前幾個 */
const LIST_MAX = 4

const maps = mapsJson as unknown as { generation: { wild: { resource_items: string[] }; dungeon: { resource_items: string[] } } }

function build(): Index {
  const idx: Index = { item: new Map(), perk: new Map(), status: new Map(), enemy: new Map(), itemKinds: new Map() }
  /** cat：物品的取得方式（篩選用） */
  const add = (kind: SourceKind, key: string | undefined, label: string, cat?: ItemSourceKind) => {
    if (!key) return
    if (kind === 'item' && cat) {
      const k = idx.itemKinds.get(key)
      if (!k) idx.itemKinds.set(key, new Set([cat]))
      else k.add(cat)
    }
    if (!label) return
    const list = idx[kind].get(key)
    if (!list) idx[kind].set(key, [label])
    else if (!list.includes(label)) list.push(label)
  }
  /** 同一種來源的許多地方合成一行：「怪物掉落：甲、乙、丙 等 5 種」 */
  const grouped = new Map<string, Map<string, string[]>>()
  const group = (kind: SourceKind, key: string | undefined, head: string, name: string, cat?: ItemSourceKind) => {
    if (!key) return
    if (kind === 'item' && cat) add('item', key, '', cat)
    const id = `${kind}\u0000${key}`
    let g = grouped.get(id)
    if (!g) grouped.set(id, (g = new Map()))
    const names = g.get(head) ?? []
    if (!names.includes(name)) names.push(name)
    g.set(head, names)
  }

  // ---- 事件與任務的效果（任何深度）：給物品、戴上拘束具、學特質 ----
  const scanEffects = (node: unknown, label: string, cat: ItemSourceKind) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const x of node) scanEffects(x, label, cat)
      return
    }
    const o = node as Record<string, unknown>
    // 數量是負的：交出這件物品（列出來，但不算拿得到）
    if (o.type === 'item' && typeof o.name === 'string') {
      if (typeof o.qty === 'number' && o.qty < 0) add('item', o.name, `${label}（交出）`, 'lose')
      else add('item', o.name, label, cat)
    }
    if (o.type === 'restrain' && typeof o.item === 'string') add('item', o.item, `${label}（強制戴上）`, 'forced')
    if (o.type === 'perk') {
      if (typeof o.perk === 'string') add('perk', o.perk, label)
      if (Array.isArray(o.options)) for (const p of o.options) if (typeof p === 'string') add('perk', p, `${label}（選一個）`)
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') scanEffects(v, label, cat)
  }
  for (const s of stories) {
    scanEffects([s.rewards, s.nodes], `特殊任務「${s.title}」`, 'quest')
    for (const n of s.start.items ?? []) add('item', n, `接下特殊任務「${s.title}」時拿到`, 'quest')
  }
  for (const t of travelEvents.templates) scanEffects([t.success, t.fail, t.options], `${EVENT_SCOPE[t.scope ?? ''] ?? '旅途事件'}「${t.title}」`, 'event')
  for (const l of Object.values(landmarks)) scanEffects(l, `地標「${l.name}」`, 'event')
  for (const [pool, name] of Object.entries(MASTER_EVENT_POOLS) as [MasterEventPool, string][]) {
    for (const e of masterEventPool(pool)) scanEffects(e.options, `${name}「${e.id}」`, 'event')
  }
  scanEffects(lewdRules.brothel.train.review, '娼館受訓的結業', 'event')
  for (const t of Object.values(townQuestTemplates)) scanEffects(t.rewards, `城鎮委託「${questTitle(t.title)}」的報酬`, 'quest')

  // ---- 物品 ----
  const shopTypes = Object.values(shopRules.types)
  for (const i of itemRules.items) {
    const sold = notForSale(i) ? [] : shopTypes.filter((t) => i.tags.includes(t.catalog_tag)).map((t) => t.name)
    if (sold.length) add('item', i.name, `商店：${[...new Set(sold)].join('、')}${i.charm_min ? `（魅氣 ${i.charm_min} 以上的聚落）` : ''}`, 'shop')
    for (const t of shopTypes) if (t.fixed?.some((f) => f.item === i.name)) add('item', i.name, `商店「${t.name}」的固定清單`, 'shop')
    if (i.recipe) add('item', i.name, `製作：${craftRules.skills[i.recipe.craft]?.name ?? i.recipe.craft} ${i.recipe.level} 級`, 'craft')
    for (const y of i.seed?.yields ?? []) add('item', y, `種「${i.name}」收成`, 'craft')
    if (i.black_market && i.gear?.unique) add('item', i.name, '黑市每天的珍品', 'shop')
    if (i.black_market && i.use?.lure?.length) add('item', i.name, '黑市每天的寄生物引子（存檔規則「黑市賣寄生物的引子」）', 'shop')
    if (i.master_force) add('item', i.name, `主人強制裝上${i.master_force.tags?.length ? `（${i.master_force.tags.map((t) => npcTags.tags[t]?.name ?? t).join('、')}的主人）` : ''}`, 'forced')
    if (i.event) add('item', i.name, '主動行動的報酬（AI 判定時可能給）', 'event')
    // 制式裝備：寶箱、人形怪物的掉落、流浪商人依等級隨機生成，也可以打造
    if (i.gear && !i.gear.attrs && !i.gear.unique && !i.gear.enchants && !i.gear.rarity && gearName(i.gear) === i.name) {
      add('item', i.name, '依等級隨機生成的裝備（寶箱、人形怪物的掉落、流浪商人）與打造', 'gear')
    }
    if (i.category === 'consumable' && !i.use?.perks?.length && !i.use?.abilities?.length && !i.use?.lure?.length) {
      const randomShops = shopTypes.filter((t) => t.random?.consumables).map((t) => t.name)
      if (randomShops.length) add('item', i.name, `${randomShops.join('、')}每天隨機上架`, 'shop')
    }
    if (i.category === 'material' && i.price_cc >= 5) {
      const randomShops = shopTypes.filter((t) => t.random?.materials && i.price_cc <= Math.max(...(t.random.max_material_price ?? [300])))
      if (randomShops.length) add('item', i.name, `${randomShops.map((t) => t.name).join('、')}每天隨機上架的材料`, 'shop')
    }
  }
  for (const e of Object.values(enemies)) for (const l of e.loot ?? []) group('item', l.item, '怪物掉落', e.name, 'drop')
  const loot = monsterLootItems()
  const chestSeries = [undefined, ...new Set(geography.locations.map((l) => l.material_series).filter((x): x is string => !!x))]
  for (const [layer, c] of Object.entries(gearRules.chests)) {
    if (!Array.isArray(c?.items)) continue
    for (const [n] of c.items) group('item', n, '地下城的寶箱', LAYER_NAME[layer] ?? layer, 'chest')
    // 打造材料：那一級的通用材料，加上當地怪物會掉的（gear.ts 的 chestForgeCandidates）
    for (const [tier] of c.forge ?? []) for (const k of MATERIAL_KINDS) for (const series of chestSeries) {
      for (const n of forgeItemsFor(k, tier, series)) {
        group('item', n, loot.has(n) ? '地下城的寶箱（打造材料，這種怪物出沒的地方）' : '地下城的寶箱（打造材料）', LAYER_NAME[layer] ?? layer, 'chest')
      }
    }
  }
  // 高等地下城（Lv.13～20）寶箱的打造材料（gear.json 的 chest_forge_high）
  for (const band of gearRules.chest_forge_high?.bands ?? []) {
    for (const [layer, list] of Object.entries(band)) {
      if (!Array.isArray(list)) continue
      for (const [tier] of list) for (const k of MATERIAL_KINDS) for (const series of chestSeries) {
        for (const n of forgeItemsFor(k, tier, series)) group('item', n, '地下城的寶箱（打造材料）', `${LAYER_NAME[layer] ?? layer}（Lv.${band.min_level} 以上）`, 'chest')
      }
    }
  }
  for (const [n] of lewdRules.park.chest_items) add('item', n, '緋夢樂園的寶箱', 'chest')
  // 偷竊（security.json 的 steal.items）：池子直接寫名字的物品；照分類、商店挑的本來就買得到
  const steal = (securityJson as unknown as { steal: { items: { pools: Record<string, { names?: string[] }>; tags: Record<string, string[]> } } }).steal.items
  for (const [pool, def] of Object.entries(steal.pools)) {
    const who = Object.entries(steal.tags).filter(([, ps]) => ps.includes(pool)).map(([t]) => npcTags.tags[t]?.name ?? t)
    for (const n of def.names ?? []) add('item', n, `偷竊${who.length ? `（${who.slice(0, LIST_MAX).join('、')}${who.length > LIST_MAX ? ' 等' : ''}身上）` : ''}`, 'steal')
  }
  for (const [n] of lewdRules.auction.pool) add('item', n, '拍賣會', 'venue')
  const arena = lewdRules.arena
  for (const n of arena.items) add('item', n, '淫鬥場的獎品', 'venue')
  for (const n of arena.books) add('item', n, '淫鬥場的獎品（技能書）', 'venue')
  for (const r of Object.values(arena.rings)) for (const n of r.rare?.items ?? []) add('item', n, `淫鬥場「${r.name}」的稀有獎品`, 'venue')
  for (const [kind, n] of Object.entries(lewdRules.conquest.kinds)) group('item', n, '慾望勝利的征服掉落', KIND_NAME[kind] ?? kind, 'drop')
  add('item', lewdRules.charm.gate.item, '魅氣濃的城門（強制戴上）', 'forced')
  for (const n of maps.generation.wild.resource_items) add('item', n, '近郊的資源格', 'gather')
  for (const n of maps.generation.dungeon.resource_items) add('item', n, '地下城的資源格', 'gather')
  for (const m of Object.values(specialMaps)) for (const n of m.resource_items ?? []) add('item', n, `特殊地圖「${m.name}」的資源格`, 'gather')
  for (const [pid, p] of Object.entries(parasiteRules.parasites)) {
    add('item', p.item, `寄生物「${p.name ?? pid}」`, 'forced')
    add('item', p.tamed?.item, `寄生物「${p.name ?? pid}」（馴服之後）`, 'forced')
    add('item', p.masc?.item, `寄生物「${p.name ?? pid}」（陽剛體型）`, 'forced')
    add('item', p.masc?.tamed_item, `寄生物「${p.name ?? pid}」（陽剛體型，馴服之後）`, 'forced')
    for (const y of p.brood?.yields ?? []) add('item', y.item, `苗床「${p.name ?? pid}」產下`, 'event')
    add('item', p.brood?.offspring?.pet, `苗床「${p.name ?? pid}」產下時留一隻當蟲寵（獸蟲派）`, 'event')
  }
  {
    const milk = (familyRules.lactation as { milk?: { item: string } } | undefined)?.milk
    if (milk) add('item', milk.item, '泌乳的時候擠奶', 'event')
  }
  for (const m of itemRules.meals?.menu ?? []) add('item', m.name, '用餐', 'shop')

  // ---- 特質 ----
  const levels = perkRules.levelup.levels
  for (const p of perkRules.perks) {
    if (p.race) {
      add('perk', p.id, `種族「${attributeRules.races[p.race]?.name ?? p.race}」天生`)
      continue
    }
    if (p.flaw) add('perk', p.id, '建立角色時選的缺陷')
    else if (!p.school) {
      add('perk', p.id, '建立角色時選')
      add('perk', p.id, `升級時的三選一（${levels.join('、')} 級）`)
    }
    if (p.train && !p.flaw) {
      const where = p.train.cells.map((c) => landmarks[c] ? `地標「${landmarks[c]!.name}」` : (shopRules.types as Record<string, { name: string } | undefined>)[c]?.name ?? CELL_NAME[c] ?? c)
      add('perk', p.id, `受訓：${where.join('、')}`)
    }
    if (p.npc?.weight) add('perk', p.id, `隨機的 NPC 可能有${p.flaw ? '這個缺陷' : ''}`)
  }
  for (const i of itemRules.items) for (const p of i.use?.perks ?? []) add('perk', p, `書籍「${i.name}」`)
  for (const p of Object.values(parasiteRules.parasites)) if (p.brood?.symbiosis) add('perk', p.brood.symbiosis, `苗床「${p.name}」產下時選共生`)
  // 2026-11-13 以前寄生的苗床一律共生成這個特質，學過的人照舊留著
  add('perk', 'brood_symbiote', '舊版的苗床共生（2026-11-13 以前學會的）')
  for (const n of npcs) {
    for (const p of n.mentor?.perks ?? []) add('perk', p, `老師：${n.name}（${mentorPlace(n.location, n.landmark)}）`)
  }
  for (const [tag, t] of Object.entries(lewdRules.npc_schools.tags)) for (const p of t.schools) add('perk', p, `${npcTags.tags[tag]?.name ?? tag}身分的 NPC 可能有`)

  // ---- 狀態 ----
  for (const a of Object.values(abilities)) {
    for (const x of a.apply ?? []) group('status', x.status, '能力', a.name)
    if (a.gamble?.status) group('status', a.gamble.status, '能力', a.name)
    if (a.lust_transfer?.dump) group('status', 'tide_bride', '能力', a.name)
  }
  for (const s of Object.values(statuses)) if (s.on_hit?.status) add('status', s.on_hit.status, `狀態「${s.name}」的命中附加`)
  for (const i of itemRules.items) {
    if (i.use?.status?.id) add('status', i.use.status.id, `物品「${i.name}」（使用時得到）`)
    if (i.use?.apply?.status) add('status', i.use.apply.status, `物品「${i.name}」（對目標施加）`)
  }
  for (const [id, label] of Object.entries(SYSTEM_STATUS)) add('status', id, label)

  // ---- 怪物 ----
  const groupIds = (g: EncounterGroup | undefined) => (g ?? []).map(([e]) => e)
  for (const [region, table] of Object.entries(wildEncounterTables)) {
    if (!region.startsWith('$') && Array.isArray(table)) for (const g of table) for (const e of groupIds(g)) group('enemy', e, '城郊遭遇', regionName(region))
  }
  for (const [loc, d] of Object.entries(dungeonEncounters)) {
    const name = locName(loc)
    for (const [layer, v] of Object.entries(d)) {
      if (layer === 'boss') for (const e of groupIds(v as EncounterGroup)) add('enemy', e, `地下城「${name}」的層主`)
      else if (layer === 'bosses') for (const [l, g] of Object.entries(v as Record<string, EncounterGroup>)) for (const e of groupIds(g)) add('enemy', e, `地下城「${name}」${LAYER_NAME[l] ?? l}的層主`)
      else if (Array.isArray(v)) for (const g of v as EncounterGroup[]) for (const e of groupIds(g)) group('enemy', e, `地下城「${name}」`, LAYER_NAME[layer] ?? layer)
    }
  }
  for (const m of Object.values(specialMaps)) {
    for (const g of m.table ?? []) for (const e of groupIds(g)) add('enemy', e, `特殊地圖「${m.name}」`)
    for (const b of m.bosses ?? []) for (const e of groupIds(b.group)) add('enemy', e, `特殊地圖「${m.name}」的 BOSS 格`)
  }
  for (const s of stories) for (const n of s.nodes) for (const e of groupIds(n.enemies)) add('enemy', e, `特殊任務「${s.title}」`)
  for (const r of Object.values(arena.rings)) for (const g of r.tiers) for (const e of groupIds(g)) add('enemy', e, `淫鬥場「${r.name}」`)
  for (const t of Object.values(townQuestTemplates)) for (const e of groupIds(t.encounter)) add('enemy', e, `城鎮委託「${questTitle(t.title)}」`)
  for (const [layer, e] of Object.entries(lewdRules.park.mimics)) add('enemy', e, `緋夢樂園的擬態寶箱（第 ${layer} 層）`)
  // 個別園區自己的擬態寶箱（禁斷花園、悅樂宮……）
  for (const [loc, byLayer] of Object.entries(lewdRules.park.mimics_at ?? {})) {
    const place = geography.locations.find((l) => l.id === loc)?.name ?? loc
    for (const [layer, e] of Object.entries(byLayer)) add('enemy', e, `${place}的擬態寶箱（第 ${layer} 層）`)
  }

  for (const [id, heads] of grouped) {
    const [kind, key] = id.split('\u0000') as [SourceKind, string]
    for (const [head, names] of heads) {
      add(kind, key, `${head}：${names.slice(0, LIST_MAX).join('、')}${names.length > LIST_MAX ? ` 等 ${names.length} 種` : ''}`)
    }
  }
  return idx
}

const CELL_NAME: Record<string, string> = {
  inn: '旅店', guild: '冒險者公會', tavern: '酒館', shop: '雜貨店', temple: '神殿', smithy: '鐵匠鋪', tailor: '裁縫店', jeweler: '珠寶店',
  magic: '魔法物品店', informant: '情報商', tattoo: '刺青店', carver: '刻印師', brothel: '娼館',
}

const locName = (id: string) => geography.locations.find((l) => l.id === id)?.name ?? id
const regionName = (id: string) => geography.regions.find((r) => r.id === id)?.name ?? (id === 'default' ? '其他地區' : id)

/** 老師待的地方：地標在地下街裡時寫明，並提醒先到酒館打聽 */
function mentorPlace(location: string, landmark?: string): string {
  const l = landmark ? landmarks[landmark] : undefined
  if (!l) return locName(location)
  const map = l.at.area.startsWith('sm/') ? specialMaps[l.at.area.slice(3)] : undefined
  if (map?.underworld) return `${locName(location)}地下街的${l.name}，在酒館打聽`
  return `${locName(location)}的${l.name}`
}
