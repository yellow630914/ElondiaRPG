// 歡愉的惡作劇：玩家在人際關係改隨機 NPC 的性別（固定 NPC 不開放：他們的劇情、世界書與成人向外貌都寫死了性別）。
// 存檔的 NPC 紀錄與隊伍成員一起改；外貌照新的性別重新組一份、預設內衣照新的體型換掉；
// 記下改過（genderSwap），交給 AI 時附上一句說明，以前的記憶照新的性別理解。

import { genderName, GENDER_IDS, namedNpcById, npcPool } from './data'
import { gearRules, UNDERWEAR_SLOTS, wearDefaultUnderwear } from './gear'
import { hashString, npcKind, occupationFor } from './npcs'
import { Rng } from './rng'
import { commitReport } from './state'
import { baseReport } from './town'
import { bodyOf, rollLook } from './traits'
import type { Character, GameState, NpcRecord, Report } from './types'

/** 這個人能不能改性別：不能時回傳原因 */
export function genderSwapBlock(state: GameState, id: string): string | null {
  if (namedNpcById(id)) return '固定 NPC 不能改性別（劇情與設定都照原本的性別寫）'
  if (state.party.some((m) => m.id === id && m.isPlayer)) return '主角的性別在建角時決定'
  if (!state.npcs?.[id]) return '找不到這個人'
  if (!state.relationships?.[id]) return '只能改認識的人'
  return null
}

/** 交給 AI 的說明：改過性別的人 */
export function genderSwapNote(rec: Pick<NpcRecord, 'gender' | 'genderSwap'> | undefined): string {
  if (!rec?.genderSwap || !rec.gender) return ''
  return `這個角色的性別因為歡愉的惡作劇，已經改成${genderName(rec.gender)}，以前的記憶以這個為準`
}

/** 外貌最後的服裝那一句（生成時接在外貌後面）：照原樣留下 */
function outfitOf(appearance: string): string {
  const all = [...npcPool.outfits, ...Object.values(npcPool.commoner_outfits).flat()]
  return all.find((o) => appearance.endsWith(`${o}。`)) ?? ''
}

/** 照新的性別重新組一份外貌（同一個種族、血統，服裝那一句照舊） */
function newAppearance(rec: NpcRecord, gender: string): string {
  const outfit = outfitOf(rec.appearance ?? '')
  const rng = new Rng(hashString(`${rec.id}:${gender}`))
  let look = rollLook(rng, { race: rec.race, gender, kind: npcKind(rec), location: rec.location ?? '', used: new Set(), outfit })
  // 血統要和原本的一樣（血統會帶特徵）：多擲幾次
  for (let i = 0; i < 30 && rec.lineage && look.lineage !== rec.lineage; i++) {
    look = rollLook(rng, { race: rec.race, gender, kind: npcKind(rec), location: rec.location ?? '', used: new Set(), outfit })
  }
  return look.appearance
}

/** 預設內衣照新的體型換掉（原本穿的是舊體型的預設內衣時；自己換過的、鎖住的不動） */
function swapUnderwear(c: Character, from: string, to: string) {
  const before = gearRules.underwear_defaults?.[bodyOf(c.race, from)] ?? {}
  for (const slot of UNDERWEAR_SLOTS) {
    const g = c.gear?.[slot]
    if (g && !g.locked && g.spec?.base === before[slot]) delete c.gear![slot]
  }
  wearDefaultUnderwear(c, bodyOf(c.race, to))
}

/** 歡愉的惡作劇：把一個隨機 NPC 的性別改成 gender，寫成一則日誌 */
export function swapNpcGender(state: GameState, id: string, gender: string): Report {
  const block = genderSwapBlock(state, id)
  if (block) throw new Error(block)
  if (!GENDER_IDS.includes(gender)) throw new Error('沒有這種性別')
  const rec = state.npcs![id]!
  const from = rec.gender ?? ''
  if (from === gender) throw new Error(`${rec.name}已經是${genderName(gender)}了`)

  const appearance = newAppearance(rec, gender)
  rec.gender = gender
  rec.appearance = appearance
  rec.genderSwap = { from, day: state.time.day }
  if (rec.generated && rec.occupation) rec.occupation = occupationFor(rec.occupation, gender)
  const rel = state.relationships![id]!
  rel.appearance = appearance
  // 角色資料：不在隊伍時存在紀錄裡，在隊伍時是隊伍成員（兩份都改）
  for (const c of [rec.character, state.party.find((m) => m.id === id)]) {
    if (!c) continue
    c.gender = gender
    c.appearance = appearance
    swapUnderwear(c, from, gender)
  }

  const report = baseReport(state, 'event', 0)
  const was = genderName(from) || '原本的樣子'
  report.outcome.summary = `歡愉的惡作劇：${rec.name}一覺醒來，發現自己從${was}變成了${genderName(gender)}。`
  report.outcome.tags = ['歡愉的惡作劇', '性別改變']
  if (!state.party.some((m) => m.id === id)) report.others = [{ id: rec.id, name: rec.name, race: rec.race, class: rec.class, level: rec.level, personality: rec.personality }]
  report.narration = {
    pov: 'second_person', length: 'short',
    focus: [`${rec.name}發現自己的身體變成了${genderName(gender)}（新的外貌：${appearance}）`, '歡愉之龍的惡作劇，沒有人說得清是怎麼發生的', `${rec.name}對這個變化的反應`],
  }
  return commitReport(state, report)
}
