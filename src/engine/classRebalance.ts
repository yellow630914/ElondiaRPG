// 新職業的一次性調整（docs/NPC_SYSTEM.md 第 1 節）：武夫、仙術師是後來才加的職業，之前的存檔在炎華之地已經生成的
// 冒險者裡一個都沒有。讀檔時檢查炎華之地的比例，比照新規則少很多時，在事件視窗問玩家要不要把一批人改成這兩個職業。
// 不論玩家答應或拒絕都只問一次（state.classRebalance.done）；新遊戲一開始就記成不用問。
//
// 只改「還沒打過交道」的生成冒險者：不是隊友、沒有招募過、沒有人際關係與共同記憶、沒有建立過角色資料（認識、跟過、
// 在乎的人）、沒有留守、沒有敵對或死亡、不是神職。他們的角色資料是依職業即時算的，改了 class 就跟著變（能力、裝備）。
// 武夫從近戰的職業挑，仙術師從施法的職業挑，原本的形象比較說得通。

import { classes, findLocation, npcClassWeight } from './data'
import { npcKind } from './npcs'
import { withRng } from './state'
import type { GameState, NpcRecord } from './types'

/** 東大陸（炎華之地）的地區 */
export const EAST_REGIONS = ['yanhua_south', 'yanhua_north']
/** 要調整的新職業，與改成它時可以挑的原本職業 */
export const NEW_CLASS_SOURCES: Record<string, string[]> = {
  wufu: ['fighter', 'barbarian', 'monk', 'paladin', 'ranger', 'rogue'],
  xianshi: ['wizard', 'bard', 'cleric', 'druid'],
}
/** 冒險者少於這個數字時先不判斷（樣本太少），之後讀檔再看 */
const MIN_ADVENTURERS = 12
/** 神職：職業和身分綁在一起，不改 */
const KEEP_TAGS = ['priest', 'bishop']

export interface ClassRebalanceState {
  /** 已經處理過（不再問）：converted 改了、declined 玩家拒絕、skipped 比例正常或新遊戲 */
  done?: 'converted' | 'declined' | 'skipped'
  /** 等玩家回答的提議：各職業預計改幾位、炎華之地目前的冒險者人數與各職業人數 */
  offer?: { total: number; current: Record<string, number>; plan: Record<string, number> }
  /** 實際改了幾位 */
  converted?: number
}

const isEast = (rec: NpcRecord) => EAST_REGIONS.includes(findLocation(rec.location)?.region ?? '')

/** 炎華之地的生成冒險者（還活著的） */
function eastAdventurers(state: GameState): NpcRecord[] {
  return Object.values(state.npcs ?? {}).filter((r) => r.generated && !r.dead && npcKind(r) === 'adventurer' && !!r.class && isEast(r))
}

/** 這個人可以改職業嗎（還沒打過交道的生成冒險者） */
function convertible(state: GameState, rec: NpcRecord, known: Set<string>): boolean {
  return !rec.character && !rec.hostile && !rec.staying && !known.has(rec.id) && !(rec.tags ?? []).some((t) => KEEP_TAGS.includes(t))
}

/** 打過交道的人：隊伍、招募過、人際關係、共同記憶、等著入隊或戰後處置的人 */
function knownIds(state: GameState): Set<string> {
  return new Set([
    ...state.party.map((m) => m.id),
    ...(state.recruited ?? []),
    ...Object.keys(state.relationships ?? {}),
    ...(state.memories ?? []).flatMap((m) => m.participants),
    ...(state.pendingJoins ?? []).flatMap((j) => j.npcs),
    ...(state.captives?.npcs ?? []),
  ])
}

/**
 * 算出要改幾位：每個新職業照目前的權重（含地區職業倍率）算應有的人數（權重 0 的不算），
 * 實際人數不到一半、而且差兩位以上時才改，改到應有的人數（能改的人不夠時改少一點）
 */
export function planClassRebalance(state: GameState): ClassRebalanceState['offer'] | null {
  const list = eastAdventurers(state)
  if (list.length < MIN_ADVENTURERS) return null
  const known = knownIds(state)
  const total = list.length
  // 每位冒險者照他所在地區的權重（含地區職業倍率）算抽到這個職業的機率，加起來是應有的人數
  const regionOf = (r: NpcRecord) => findLocation(r.location)?.region ?? ''
  const sums = new Map<string, number>()
  const sumIn = (region: string) => {
    if (!sums.has(region)) sums.set(region, Object.keys(classes).reduce((a, id) => a + npcClassWeight(id, region), 0))
    return sums.get(region)!
  }
  const current: Record<string, number> = {}
  const plan: Record<string, number> = {}
  for (const [cls, sources] of Object.entries(NEW_CLASS_SOURCES)) {
    current[cls] = list.filter((r) => r.class === cls).length
    if (!classes[cls] || !npcClassWeight(cls)) continue
    const target = Math.round(list.reduce((a, r) => {
      const region = regionOf(r)
      const sum = sumIn(region)
      return a + (sum ? npcClassWeight(cls, region) / sum : 0)
    }, 0))
    const need = target - current[cls]!
    if (current[cls]! >= target / 2 || need < 2) continue
    const pool = list.filter((r) => sources.includes(r.class) && convertible(state, r, known)).length
    if (pool) plan[cls] = Math.min(need, pool)
  }
  return Object.keys(plan).length ? { total, current, plan } : null
}

/** 讀檔時：還沒處理過的存檔，比例不對時記下提議（事件視窗會問），比例正常時記成不用問 */
export function checkClassRebalance(state: GameState) {
  if (state.classRebalance?.done) return
  const offer = planClassRebalance(state)
  if (offer) state.classRebalance = { offer }
  else if (eastAdventurers(state).length >= MIN_ADVENTURERS) state.classRebalance = { done: 'skipped' }
  else delete state.classRebalance
}

/** 玩家答應：照提議隨機挑人改職業（重新算一次，存檔可能變了）；回傳給玩家看的說明 */
export function applyClassRebalance(state: GameState): string {
  if (state.classRebalance?.done || !state.classRebalance?.offer) throw new Error('沒有要調整的職業')
  const offer = planClassRebalance(state)
  const known = knownIds(state)
  const list = eastAdventurers(state)
  const done: string[] = []
  let n = 0
  withRng(state, (rng) => {
    for (const [cls, count] of Object.entries(offer?.plan ?? {})) {
      const pool = list.filter((r) => NEW_CLASS_SOURCES[cls]!.includes(r.class) && convertible(state, r, known))
      let k = 0
      while (k < count && pool.length) {
        const rec = pool.splice(rng.int(0, pool.length - 1), 1)[0]!
        rec.class = cls
        k++
      }
      if (k) done.push(`${classes[cls]?.name ?? cls} ${k} 位`)
      n += k
    }
  })
  state.classRebalance = { done: 'converted', converted: n }
  return n ? `炎華之地有 ${n} 位冒險者改成了新的職業（${done.join('、')}）。` : '沒有可以改職業的人（都已經打過交道了），職業沒有變。'
}

/** 玩家拒絕：之後不再問 */
export function declineClassRebalance(state: GameState) {
  state.classRebalance = { done: 'declined' }
}
