// 材料與討伐委託（系統生成的一般委託，data/rules/town_quests.json 的 material_quests）：
// - gather_wild：近郊採集點的材料（F 級）；gather_dungeon：地下城周邊採集點的材料（E 級）
// - drop_wild：近郊怪物掉落的材料（F～E 級）；drop_dungeon：地下城怪物掉落的材料（F～B 級，依怪物等級）
// - boss_hunt：討伐地下城的層主（F～B 級，依層主等級）
// 材料委託在公會交付行囊裡的材料，可以過量交付到 max 份；討伐委託記錄打倒的次數，最多算到 max 次。
// 帶著委託進入近郊或地下城的那一層時，grid.ts 會確保有足量的採集點或戰鬥點（questTargets）。

import { guildRankFor } from './character'
import {
  dungeonEncounters, economy, enemies, itemDef, locationById, materialQuestRules, wildEncounters,
  type DungeonLayerId, type EncounterGroup, type MaterialQuestKind,
} from './data'
import type { Rng } from './rng'
import type { GameState, GuildRank, Quest } from './types'
import mapsJson from '@data/world/maps.json'

export const RANK_ORDER: GuildRank[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S']
export const MATERIAL_KINDS: MaterialQuestKind[] = ['gather_wild', 'gather_dungeon', 'drop_wild', 'drop_dungeon', 'boss_hunt']
export const LAYER_IDS: DungeonLayerId[] = ['outskirts', 'shallow', 'middle', 'deep']
const LAYER_NAME: Record<DungeonLayerId, string> = { outskirts: '周邊', shallow: '淺層', middle: '中層', deep: '深層' }

const maps = mapsJson as unknown as { generation: { wild: { resource_items: string[] }; dungeon: { resource_items: string[] } } }

export function isMaterialQuest(q: Pick<Quest, 'kind'>): boolean {
  return (MATERIAL_KINDS as string[]).includes(q.kind)
}

/** 要交材料的委託（採集、掉落） */
export function isCollectQuest(q: Pick<Quest, 'kind'>): boolean {
  return q.kind === 'gather_wild' || q.kind === 'gather_dungeon' || q.kind === 'drop_wild' || q.kind === 'drop_dungeon'
}

export function rewardRange(rank: GuildRank): [number, number] {
  const table = economy.quest_rewards_cc
  const entry = table[rank] ?? table[`${rank}_solo`]
  return entry?.range ?? [30, 50]
}

/** 怪物等級對應的公會等級，夾在範圍內 */
export function rankForLevel(level: number, [lo, hi]: [GuildRank, GuildRank]): GuildRank {
  const i = RANK_ORDER.indexOf(guildRankFor(level))
  return RANK_ORDER[Math.max(RANK_ORDER.indexOf(lo), Math.min(RANK_ORDER.indexOf(hi), i))]!
}

/** 清剿委託的最低階級 */
export const CLEAR_MIN_RANK: GuildRank = 'E'

/**
 * 地下城某一層的階級：這一層遭遇表裡一般怪物（不含層主）的最高等級，用和討伐、掉落委託相同的換算，
 * 最低 E 級。地下城沒有整座的階級（docs/DUNGEON_DESIGN.md）。這一層沒有怪物時回傳 undefined。
 */
export function layerRank(dungeon: string, layer: DungeonLayerId): GuildRank | undefined {
  const levels = monstersIn(dungeonEncounters[dungeon]?.[layer] ?? []).map((id) => enemies[id]!.level)
  if (!levels.length) return undefined
  return rankForLevel(Math.max(...levels), [CLEAR_MIN_RANK, 'S'])
}

/** 地下城每一層（周邊除外）的階級，給地圖與考核用 */
export function layerRanks(dungeon: string): { layer: 'shallow' | 'middle' | 'deep'; rank: GuildRank }[] {
  return (['shallow', 'middle', 'deep'] as const)
    .map((layer) => ({ layer, rank: layerRank(dungeon, layer) }))
    .filter((r): r is { layer: 'shallow' | 'middle' | 'deep'; rank: GuildRank } => !!r.rank)
}

/** 這場勝利算不算這個清剿委託：指定那一層或更深；舊存檔沒記層數的，哪一層都算 */
export function clearCounts(q: Pick<Quest, 'layer'>, layer: DungeonLayerId | undefined): boolean {
  if (!q.layer) return true
  return layer !== undefined && LAYER_IDS.indexOf(layer) >= LAYER_IDS.indexOf(q.layer)
}

/** 行囊裡有幾份這個委託要的材料 */
export function questHave(state: GameState, q: Quest): number {
  return q.item ? state.inventory.find((i) => i.name === q.item)?.qty ?? 0 : 0
}

/** 最多交付（或討伐）的數量 */
export function questMax(q: Quest): number {
  return q.max ?? q.goal
}

/** 現在能交付多少：材料委託是持有的份數，討伐委託是打倒的次數（都不超過上限）；不到 goal 時為 0 */
export function deliverable(state: GameState, q: Quest): number {
  const n = isCollectQuest(q) ? questHave(state, q) : q.progress
  return n >= q.goal ? Math.min(n, questMax(q)) : 0
}

/** 可以回公會交付了嗎 */
export function canTurnIn(state: GameState, q: Quest): boolean {
  if (q.status === 'ready') return true
  return q.status === 'accepted' && isMaterialQuest(q) && deliverable(state, q) > 0
}

/** 交付 count 份的報酬：基本報酬依比例增加 */
export function rewardFor(q: Quest, count: number): number {
  return Math.round((q.reward_cc * count) / Math.max(1, q.goal))
}

function materialLoot(id: string) {
  return (enemies[id]?.loot ?? []).filter((l) => itemDef(l.item)?.category === 'material')
}

function monstersIn(groups: EncounterGroup[]): string[] {
  return [...new Set(groups.flat().map(([id]) => id))].filter((id) => !!enemies[id])
}

function gatherItems(place: 'wild' | 'dungeon'): string[] {
  return maps.generation[place].resource_items.filter((n) => itemDef(n)?.category === 'material')
}

function qtyFor(rng: Rng, [lo, hi]: [number, number]): number {
  return rng.int(lo, hi)
}

function reward(rng: Rng, rank: GuildRank, item: string | undefined, goal: number, mult = 1): number {
  const [lo, hi] = rewardRange(rank)
  const value = item ? (itemDef(item)?.price_cc ?? 0) * goal * materialQuestRules.item_value_mult : 0
  return Math.round((rng.int(lo, hi) + value) * mult)
}

function base(state: GameState, kind: MaterialQuestKind, target: string, goal: number): Omit<Quest, 'id' | 'title' | 'rank' | 'reward_cc'> {
  return {
    kind, area: locationById(target).type === 'dungeon' ? 'dungeon' : 'outskirts',
    giver: state.location, target, goal, progress: 0, max: goal * materialQuestRules.max_multiplier, status: 'available',
  }
}

/** 近郊的材料委託：採集與怪物掉落各 per_town 個 */
export function postWildQuests(state: GameState, rng: Rng): Quest[] {
  const r = materialQuestRules
  const loc = locationById(state.location)
  const out: Quest[] = []
  const tag = `${state.location}-${state.time.day}`
  const items = gatherItems('wild')
  for (let i = 0; i < r.per_town && items.length; i++) {
    const item = items.splice(rng.int(0, items.length - 1), 1)[0]!
    const goal = qtyFor(rng, r.gather_wild.qty)
    const rank = r.gather_wild.rank ?? 'F'
    out.push({
      ...base(state, 'gather_wild', state.location, goal), id: `q-${tag}-gw-${item}`,
      title: `採集${loc.name}近郊的${item}（${goal} 份）`, rank, item, reward_cc: reward(rng, rank, item, goal),
    })
  }
  const pairs = monstersIn(wildEncounters(loc.region)).flatMap((m) => materialLoot(m).map((l) => ({ m, item: l.item })))
  for (let i = 0; i < r.per_town && pairs.length; i++) {
    const { m, item } = pairs.splice(rng.int(0, pairs.length - 1), 1)[0]!
    const goal = qtyFor(rng, r.drop_wild.qty)
    const rank = rankForLevel(enemies[m]!.level, r.drop_wild.ranks ?? ['F', 'E'])
    out.push({
      ...base(state, 'drop_wild', state.location, goal), id: `q-${tag}-dw-${m}`,
      title: `收集${loc.name}近郊${enemies[m]!.name}的${item}（${goal} 份）`, rank, item, monster: m, reward_cc: reward(rng, rank, item, goal),
    })
  }
  return out
}

/** 附近的地下城隨機挑幾座，各發一個採集、掉落或討伐層主的委託 */
export function postDungeonQuests(state: GameState, rng: Rng, targets: string[]): Quest[] {
  const r = materialQuestRules
  const pool = [...targets]
  const out: Quest[] = []
  for (let i = 0; i < r.dungeon_quests && pool.length; i++) {
    const target = pool.splice(rng.int(0, pool.length - 1), 1)[0]!
    const kinds = (Object.entries(r.dungeon_kinds) as [MaterialQuestKind, number][]).filter(([, w]) => w > 0)
    // 依權重挑種類；這座地下城做不出來時換下一種
    const order: MaterialQuestKind[] = []
    while (kinds.length) {
      let roll = rng.next() * kinds.reduce((s, [, w]) => s + w, 0)
      const idx = kinds.findIndex(([, w]) => (roll -= w) < 0)
      order.push(kinds.splice(idx < 0 ? kinds.length - 1 : idx, 1)[0]![0])
    }
    for (const kind of order) {
      const q = dungeonQuest(state, rng, kind, target)
      if (q) {
        out.push(q)
        break
      }
    }
  }
  return out
}

function dungeonQuest(state: GameState, rng: Rng, kind: MaterialQuestKind, target: string): Quest | undefined {
  const r = materialQuestRules
  const enc = dungeonEncounters[target]
  const dname = locationById(target).name
  const tag = `${state.location}-${state.time.day}-${target}`
  if (!enc) return undefined
  if (kind === 'gather_dungeon') {
    const items = gatherItems('dungeon')
    if (!items.length) return undefined
    const item = rng.pick(items)
    const goal = qtyFor(rng, r.gather_dungeon.qty)
    const rank = r.gather_dungeon.rank ?? 'E'
    const layer = r.gather_dungeon.layer ?? 'outskirts'
    return {
      ...base(state, kind, target, goal), id: `q-${tag}-gd`, layer,
      title: `採集${dname}${LAYER_NAME[layer]}的${item}（${goal} 份）`, rank, item, reward_cc: reward(rng, rank, item, goal),
    }
  }
  if (kind === 'drop_dungeon') {
    // 不含層主：各層遭遇表裡會掉材料的怪物，記下牠最淺出現的那一層
    const pairs = LAYER_IDS.flatMap((layer) => monstersIn(enc[layer] ?? []).flatMap((m) => materialLoot(m).map((l) => ({ m, item: l.item, layer }))))
    const seen = new Set<string>()
    const unique = pairs.filter((p) => !seen.has(`${p.m}:${p.item}`) && seen.add(`${p.m}:${p.item}`))
    if (!unique.length) return undefined
    const { m, item, layer } = rng.pick(unique)
    const goal = qtyFor(rng, r.drop_dungeon.qty)
    const rank = rankForLevel(enemies[m]!.level, r.drop_dungeon.ranks ?? ['F', 'B'])
    return {
      ...base(state, kind, target, goal), id: `q-${tag}-dd`, layer, monster: m,
      title: `收集${dname}${LAYER_NAME[layer]}${enemies[m]!.name}的${item}（${goal} 份）`, rank, item, reward_cc: reward(rng, rank, item, goal),
    }
  }
  if (kind === 'boss_hunt') {
    const bosses = (['shallow', 'middle', 'deep'] as const)
      .map((layer) => ({ layer, id: (enc.bosses?.[layer] ?? (layer === 'deep' ? enc.boss : undefined))?.[0]?.[0] }))
      .filter((b): b is { layer: 'shallow' | 'middle' | 'deep'; id: string } => !!b.id && !!enemies[b.id])
    if (!bosses.length) return undefined
    const { layer, id } = rng.pick(bosses)
    const goal = qtyFor(rng, r.boss_hunt.qty)
    const rank = rankForLevel(enemies[id]!.level, r.boss_hunt.ranks ?? ['F', 'B'])
    return {
      ...base(state, kind, target, goal), id: `q-${tag}-bh`, layer, monster: id,
      title: `討伐${dname}${LAYER_NAME[layer]}的層主${enemies[id]!.name}${goal > 1 ? `（${goal} 次）` : ''}`, rank,
      reward_cc: reward(rng, rank, undefined, goal, r.boss_hunt.reward_mult ?? 1),
    }
  }
  return undefined
}

export function layerName(id: DungeonLayerId): string {
  return LAYER_NAME[id]
}

/** 進度的文字：材料委託是持有的份數，討伐委託是打倒的次數，其他是完成次數 */
export function questProgressText(state: GameState, q: Quest): string {
  if (isCollectQuest(q)) return `持有 ${questHave(state, q)}/${q.goal} 份${questMax(q) > q.goal ? `（最多交 ${questMax(q)} 份）` : ''}`
  if (q.kind === 'boss_hunt') return `討伐 ${q.progress}/${q.goal} 次${questMax(q) > q.goal ? `（最多算 ${questMax(q)} 次）` : ''}`
  return `${q.progress}/${q.goal}`
}

/** 戰鬥勝利時：打倒的怪物裡有討伐委託的層主，記一次（最多記到 max 次） */
export function advanceBossHunts(state: GameState, location: string, defeated: string[]): Quest[] {
  const hit: Quest[] = []
  for (const q of state.quests) {
    if (q.kind !== 'boss_hunt' || q.target !== location || !q.monster || !defeated.includes(q.monster)) continue
    if ((q.status !== 'accepted' && q.status !== 'ready') || q.progress >= questMax(q)) continue
    q.progress += 1
    if (q.progress >= q.goal) q.status = 'ready'
    hit.push(q)
  }
  return hit
}

/** 這一區（近郊或地下城的某一層）要確保的目標：採集點的材料、要遇到的怪物 */
export interface QuestTarget {
  quest: string
  /** 採集點：要放的材料、份數 */
  item?: string
  /** 戰鬥點：要遇到的怪物、要幾格 */
  monster?: string
  cells: number
}

export function questTargets(state: GameState, location: string, layer?: DungeonLayerId): QuestTarget[] {
  const r = materialQuestRules
  const out: QuestTarget[] = []
  for (const q of state.quests) {
    if (q.target !== location || q.status !== 'accepted' || !isCollectQuest(q) || !q.item) continue
    // 地下城的委託只在指定的那一層；近郊的委託只在近郊
    if (layer ? q.layer !== layer : q.area !== 'outskirts') continue
    const have = questHave(state, q)
    if (have >= questMax(q)) continue
    const need = Math.max(1, q.goal - have)
    if (q.kind === 'gather_wild' || q.kind === 'gather_dungeon') {
      out.push({ quest: q.id, item: q.item, cells: Math.min(r.max_cells, need) })
    } else if (q.monster) {
      // 掉落：依掉落機率估算要打幾隻
      const loot = enemies[q.monster]?.loot?.find((l) => l.item === q.item)
      const per = (loot?.chance ?? 0.5) * (loot?.qty ?? 1)
      out.push({ quest: q.id, monster: q.monster, cells: Math.min(r.max_cells, Math.max(1, Math.ceil(need / Math.max(0.1, per)))) })
    }
  }
  return out
}
