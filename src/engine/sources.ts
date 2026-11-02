// 內容「怎麼拿到」的來源索引（docs/CONTENT_DEPENDENCIES.md 第 2.1 節）：物品、特質、狀態、怪物在遊戲裡從哪裡來。
//
// 和 usage.ts 的「哪裡用到」不同：這裡只是說明，不擋刪除（例如商店依標籤上架、怪物掉落）。
// 一次掃過全部資料建成索引，之後查詢不再掃描；內容套用（applyContent）後作廢，下次查詢時重建。

import mapsJson from '@data/world/maps.json'
import {
  abilities, attributeRules, geography, craftRules, dungeonEncounters, enemies, itemRules, landmarks, lewdRules, MASTER_EVENT_POOLS, masterEventPool,
  npcTags, perkRules, shopRules, specialMaps, statuses, stories, townQuestTemplates, wildEncounterTables, type EncounterGroup, type MasterEventPool,
} from './data'
import { forgeItemFor, gearName, gearRules, MATERIAL_KINDS } from './gear'
import { parasiteRules } from './parasites'
import { travelEvents } from './road'
import { notForSale } from './trade'

export type SourceKind = 'item' | 'perk' | 'status' | 'enemy'

type Index = Record<SourceKind, Map<string, string[]>>
let cache: Index | undefined

/** 內容改了：下次查詢時重建索引 */
export function invalidateSources() {
  cache = undefined
}

/** 這一項在遊戲裡怎麼拿到（物品、特質）、怎麼出現（狀態、怪物）；沒有任何來源時是空的 */
export function sourcesOf(kind: SourceKind, key: string): string[] {
  return (cache ??= build())[kind].get(key) ?? []
}

const LAYER_NAME: Record<string, string> = { outskirts: '周邊', shallow: '淺層', middle: '中層', deep: '深層', abyss: '深淵' }
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
  const idx: Index = { item: new Map(), perk: new Map(), status: new Map(), enemy: new Map() }
  const add = (kind: SourceKind, key: string | undefined, label: string) => {
    if (!key) return
    const list = idx[kind].get(key)
    if (!list) idx[kind].set(key, [label])
    else if (!list.includes(label)) list.push(label)
  }
  /** 同一種來源的許多地方合成一行：「怪物掉落：甲、乙、丙 等 5 種」 */
  const grouped = new Map<string, Map<string, string[]>>()
  const group = (kind: SourceKind, key: string | undefined, head: string, name: string) => {
    if (!key) return
    const id = `${kind}\u0000${key}`
    let g = grouped.get(id)
    if (!g) grouped.set(id, (g = new Map()))
    const names = g.get(head) ?? []
    if (!names.includes(name)) names.push(name)
    g.set(head, names)
  }

  // ---- 事件與任務的效果（任何深度）：給物品、戴上拘束具、學特質 ----
  const scanEffects = (node: unknown, label: string) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const x of node) scanEffects(x, label)
      return
    }
    const o = node as Record<string, unknown>
    if (o.type === 'item' && typeof o.name === 'string') add('item', o.name, label)
    if (o.type === 'restrain' && typeof o.item === 'string') add('item', o.item, `${label}（強制戴上）`)
    if (o.type === 'perk') {
      if (typeof o.perk === 'string') add('perk', o.perk, label)
      if (Array.isArray(o.options)) for (const p of o.options) if (typeof p === 'string') add('perk', p, `${label}（選一個）`)
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') scanEffects(v, label)
  }
  for (const s of stories) {
    scanEffects([s.rewards, s.nodes], `特殊任務「${s.title}」`)
    for (const n of s.start.items ?? []) add('item', n, `接下特殊任務「${s.title}」時拿到`)
  }
  for (const t of travelEvents.templates) scanEffects([t.success, t.fail, t.options], `${EVENT_SCOPE[t.scope ?? ''] ?? '旅途事件'}「${t.title}」`)
  for (const l of Object.values(landmarks)) scanEffects(l, `地標「${l.name}」`)
  for (const [pool, name] of Object.entries(MASTER_EVENT_POOLS) as [MasterEventPool, string][]) {
    for (const e of masterEventPool(pool)) scanEffects(e.options, `${name}「${e.id}」`)
  }
  scanEffects(lewdRules.brothel.train.review, '娼館受訓的結業')
  for (const t of Object.values(townQuestTemplates)) scanEffects(t.rewards, `城鎮委託「${t.title}」的報酬`)

  // ---- 物品 ----
  const shopTypes = Object.values(shopRules.types)
  for (const i of itemRules.items) {
    const sold = notForSale(i) ? [] : shopTypes.filter((t) => i.tags.includes(t.catalog_tag)).map((t) => t.name)
    if (sold.length) add('item', i.name, `商店：${[...new Set(sold)].join('、')}${i.charm_min ? `（魅氣 ${i.charm_min} 以上的聚落）` : ''}`)
    for (const t of shopTypes) if (t.fixed?.some((f) => f.item === i.name)) add('item', i.name, `商店「${t.name}」的固定清單`)
    if (i.recipe) add('item', i.name, `製作：${craftRules.skills[i.recipe.craft]?.name ?? i.recipe.craft} ${i.recipe.level} 級`)
    for (const y of i.seed?.yields ?? []) add('item', y, `種「${i.name}」收成`)
    if (i.black_market && i.gear?.unique) add('item', i.name, '黑市每天的珍品')
    if (i.master_force) add('item', i.name, `主人強制裝上${i.master_force.tags?.length ? `（${i.master_force.tags.map((t) => npcTags.tags[t]?.name ?? t).join('、')}的主人）` : ''}`)
    if (i.event) add('item', i.name, '主動行動的報酬（AI 判定時可能給）')
    // 制式裝備：寶箱、人形怪物的掉落、流浪商人依等級隨機生成，也可以打造
    if (i.gear && !i.gear.attrs && !i.gear.unique && !i.gear.enchants && !i.gear.rarity && gearName(i.gear) === i.name) {
      add('item', i.name, '依等級隨機生成的裝備（寶箱、人形怪物的掉落、流浪商人）與打造')
    }
    if (i.category === 'consumable' && !i.use?.perks?.length && !i.use?.abilities?.length) {
      const randomShops = shopTypes.filter((t) => t.random?.consumables).map((t) => t.name)
      if (randomShops.length) add('item', i.name, `${randomShops.join('、')}每天隨機上架`)
    }
    if (i.category === 'material' && i.price_cc >= 5) {
      const randomShops = shopTypes.filter((t) => t.random?.materials && i.price_cc <= Math.max(...(t.random.max_material_price ?? [300])))
      if (randomShops.length) add('item', i.name, `${randomShops.map((t) => t.name).join('、')}每天隨機上架的材料`)
    }
  }
  for (const e of Object.values(enemies)) for (const l of e.loot ?? []) group('item', l.item, '怪物掉落', e.name)
  for (const [layer, c] of Object.entries(gearRules.chests)) {
    if (!Array.isArray(c?.items)) continue
    for (const [n] of c.items) group('item', n, '地下城的寶箱', LAYER_NAME[layer] ?? layer)
    // 打造材料：每一級挑最便宜的那一種（gear.ts 的 forgeItemFor）
    for (const [tier] of c.forge ?? []) for (const k of MATERIAL_KINDS) group('item', forgeItemFor(k, tier), '地下城的寶箱（打造材料）', LAYER_NAME[layer] ?? layer)
  }
  for (const [n] of lewdRules.park.chest_items) add('item', n, '緋夢樂園的寶箱')
  for (const [n] of lewdRules.auction.pool) add('item', n, '拍賣會')
  const arena = lewdRules.arena
  for (const n of arena.items) add('item', n, '淫鬥場的獎品')
  for (const n of arena.books) add('item', n, '淫鬥場的獎品（技能書）')
  for (const r of Object.values(arena.rings)) for (const n of r.rare?.items ?? []) add('item', n, `淫鬥場「${r.name}」的稀有獎品`)
  for (const [kind, n] of Object.entries(lewdRules.conquest.kinds)) group('item', n, '慾望勝利的征服掉落', KIND_NAME[kind] ?? kind)
  add('item', lewdRules.charm.gate.item, '魅氣濃的城門（強制戴上）')
  for (const n of maps.generation.wild.resource_items) add('item', n, '野外採集')
  for (const n of maps.generation.dungeon.resource_items) add('item', n, '地下城採集')
  for (const m of Object.values(specialMaps)) for (const n of m.resource_items ?? []) add('item', n, `特殊地圖「${m.name}」的採集`)
  for (const [pid, p] of Object.entries(parasiteRules.parasites)) {
    add('item', p.item, `寄生物「${p.name ?? pid}」`)
    add('item', p.tamed?.item, `寄生物「${p.name ?? pid}」（馴服之後）`)
  }
  for (const m of itemRules.meals?.menu ?? []) add('item', m.name, '用餐')

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
  for (const t of Object.values(townQuestTemplates)) for (const e of groupIds(t.encounter)) add('enemy', e, `城鎮委託「${t.title}」`)
  for (const [layer, e] of Object.entries(lewdRules.park.mimics)) add('enemy', e, `緋夢樂園的擬態寶箱（第 ${layer} 層）`)

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
