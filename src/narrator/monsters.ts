// 交給 AI 的「登場的怪物」（<monsters>）：每種怪物的外觀與習性（怪物資料的 desc）。
// 設定「魔物娘」打開、而且這段經過的主角符合設定時，換成魔物娘的名字與外觀（怪物資料的 girl）；
// 報告、戰鬥紀錄裡仍然是原本的名字，所以列成「原本的名字 → 魔物娘的名字」。見 docs/MONSTERS.md 的「魔物娘」。
// 「魔物娘出現機率」不到 100% 時，每種怪物每天擲一次（固定亂數：存檔、日子、怪物），
// 同一天的敘事、重寫、戰敗事件與插圖看到的都一樣，同一場的同一種怪物一起是或一起不是。

import { monsterGirlChance, monsterGirlsFor } from '@/engine/content'
import { enemies } from '@/engine/data'
import { characterBody } from '@/engine/look'
import { hashString } from '@/engine/npcs'
import type { GameState, Report } from '@/engine/types'

/** 報告裡登場的怪物（怪物資料的 id，不重複） */
export function reportMonsters(report: Report): string[] {
  return [...new Set((report.others ?? []).map((o) => o.monster).filter((m): m is string => !!m && !!enemies[m]))]
}

/**
 * 這段經過的怪物要不要以魔物娘的樣子交給 AI：看設定與這段經過的主角
 * （戰敗事件被圍住的隊友、親密場景的主角是隊友時是那位隊友，其他時候是主角）
 */
export function monsterGirlsIn(state: GameState | null, who?: string): boolean {
  if (!state) return false
  const m = (who && state.party.find((x) => x.id === who)) || state.party.find((x) => x.isPlayer)
  return !!m && monsterGirlsFor(characterBody(m))
}

/** 日誌的敘事：這則報告的主角是誰（被圍住的隊友、親密場景的主角） */
export function reportFocus(report: Report): string | undefined {
  return report.narration?.defeat_victim ?? report.narration?.adult_actor
}

/** 擲魔物娘的固定亂數種子：同一個存檔、同一天 */
export function girlSeed(state: GameState | null, day: number): string {
  return `${state?.seed ?? 0}:${day}`
}

/** 報告的那一天（擲魔物娘用）：戰敗事件的回應照那場戰鬥的日子（narration.girl_day） */
export function reportGirlSeed(state: GameState | null, report: Report): string {
  return girlSeed(state, report.narration?.girl_day ?? report.time.start.day)
}

/** 這種怪物這次以魔物娘出現嗎（設定與主角已經符合時才問）：怪物自己的機率，沒寫時照設定 */
export function girlRolled(id: string, seed: string): boolean {
  const girl = enemies[id]?.girl
  if (!girl) return false
  const chance = girl.chance ?? monsterGirlChance()
  if (chance >= 100) return true
  if (chance <= 0) return false
  return hashString(`${seed}:${id}:girl`) % 100 < chance
}

export interface MonsterLineOptions {
  /** 擲魔物娘的種子（girlSeed）；不給時機率不到 100% 的一律不換 */
  seed?: string
  /** 附上魔物娘的性情與習性（敘事用；插圖的分鏡只要外觀） */
  traits?: boolean
}

/** 一行一種怪物；girls：設定與主角符合時，擲中的換成魔物娘 */
export function monsterLines(ids: string[], girls: boolean, o: MonsterLineOptions = {}): string[] {
  return ids.flatMap((id) => {
    const def = enemies[id]
    if (!def) return []
    const g = def.girl
    if (girls && g && girlRolled(id, o.seed ?? '')) {
      const extra = o.traits ? [g.personality && `性情：${g.personality}`, g.habits && `習性：${g.habits}`].filter(Boolean) : []
      return [`- ${def.name} → ${g.name}：${[g.desc, ...extra].join('　')}`]
    }
    return def.desc ? [`- ${def.name}：${def.desc}`] : []
  })
}

/**
 * 魔物娘的寫法（有魔物娘登場時接在 <monsters> 的說明後面）：不寫回動物的稱呼；
 * 戰利品是她們身上帶著或掉下來的，不寫剝皮、拔牙這類處理身體的動作；被打倒的是逃跑，不是被殺死
 */
export const GIRL_RULES = [
  '魔物娘的寫法：',
  '- 正文一律用 → 右邊的稱呼（例如「鼠娘」），不要寫回原本動物的稱呼（例如「巨鼠」「巨大老鼠」）。',
  '- 從魔物娘那裡得到的東西（報告的戰利品）寫成她們身上帶著或掉下來的：腰包、散落的皮料、斷掉的牙、遺落的飾品……；不要寫剝皮、拔牙、割取這類處理她們身體的動作。',
  '- 戰利品是心臟、眼睛、血、毒囊、腺體這類器官時，那是「原種魔物」（沒有化成人形、還是野獸模樣的同類）的東西：寫成她們隨身帶著的獵物、收藏，或巢穴附近原種魔物留下的；不要寫成從她們身上取下來的。',
  '- 被打倒的魔物娘是受傷倒地、狼狽逃跑，不是被殺死；不要寫她們死去、屍體或血腥的場面。',
].join('\n')

/** 這段經過裡以魔物娘出現的怪物（怪物資料的 id） */
export function girlMonsterIds(ids: string[], girls: boolean, seed?: string): Set<string> {
  if (!girls) return new Set()
  return new Set(ids.filter((id) => !!enemies[id]?.girl && girlRolled(id, seed ?? '')))
}

/**
 * 交給 AI 的報告：以魔物娘出現、被打倒的怪物，狀態從「死亡」改成「倒下」（其他人與戰鬥紀錄都改），
 * 免得和「被打倒的魔物娘不是被殺死」互相矛盾。畫面上的戰報不變。沒有要改的時候回傳原本的報告
 */
export function girlsDownNotDead(report: Report, girlIds: Set<string>): Report {
  if (!girlIds.size) return report
  const down = new Set((report.others ?? []).filter((o) => o.monster && girlIds.has(o.monster) && o.status?.includes('死亡')).map((o) => o.id))
  if (!down.size) return report
  return {
    ...report,
    others: report.others!.map((o) => (down.has(o.id) ? { ...o, status: o.status!.map((x) => (x === '死亡' ? '倒下' : x)) } : o)),
    ...(report.timeline ? { timeline: report.timeline.map((t) => (t.effects?.some((e) => e.type === 'status_add' && e.status === '死亡' && !!e.target && down.has(e.target))
      ? { ...t, effects: t.effects.map((e) => (e.type === 'status_add' && e.status === '死亡' && !!e.target && down.has(e.target) ? { ...e, status: '倒下' } : e)) }
      : t)) } : {}),
  }
}

/** <monsters> 區塊（敘事、戰敗事件用：魔物娘附上性情與習性）；沒有怪物（或都沒有描述）時是空字串 */
export function monstersText(ids: string[], girls: boolean, seed?: string): string {
  const lines = monsterLines(ids, girls, { seed, traits: true })
  if (!lines.length) return ''
  const anyGirl = lines.some((l) => l.includes(' → '))
  const head = anyGirl
    ? `登場的怪物。標了「→」的以魔物娘的樣子出現：成年女性的身體，保留原本種族的特徵（耳朵、尾巴、鱗片、翅膀、觸手……）。報告與戰鬥紀錄用的是原本的名字（→ 左邊），正文照右邊的稱呼與外觀寫；招式的名稱照舊，動作改成符合她們身體的寫法。沒有標「→」的照原本的樣子寫。\n${GIRL_RULES}`
    : '登場的怪物（外觀與習性）：'
  return `<monsters>\n${head}\n${lines.join('\n')}\n</monsters>`
}
