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

/** 報告的那一天（擲魔物娘用） */
export function reportGirlSeed(state: GameState | null, report: Report): string {
  return girlSeed(state, report.time.start.day)
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

/** <monsters> 區塊（敘事、戰敗事件用：魔物娘附上性情與習性）；沒有怪物（或都沒有描述）時是空字串 */
export function monstersText(ids: string[], girls: boolean, seed?: string): string {
  const lines = monsterLines(ids, girls, { seed, traits: true })
  if (!lines.length) return ''
  const anyGirl = lines.some((l) => l.includes(' → '))
  const head = anyGirl
    ? '登場的怪物。標了「→」的以魔物娘的樣子出現：成年女性的身體，保留原本種族的特徵（耳朵、尾巴、鱗片、翅膀、觸手……）。報告與戰鬥紀錄用的是原本的名字（→ 左邊），正文照右邊的稱呼與外觀寫；招式的名稱照舊，動作改成符合她們身體的寫法。沒有標「→」的照原本的樣子寫。'
    : '登場的怪物（外觀與習性）：'
  return `<monsters>\n${head}\n${lines.join('\n')}\n</monsters>`
}
