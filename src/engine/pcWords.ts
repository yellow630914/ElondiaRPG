// 固定文字（特殊任務的事件描述、選項、結果）裡依主角性別換的詞：
// {哥哥|姊姊} 男性寫前面、女性寫後面；{哥哥|姊姊|客人} 第三個給不分男女的主角（性別寫了別的、或「未知」）。
// 性別照 npc_pool.json 的 genders 對應名字的男女（偽娘照男性、TS 與扶她照女性），對應不到的用第三個（沒有時用第一個）。

import { genderDef } from './data'
import { pcOf } from './party'
import type { GameState } from './types'

const PATTERN = /\{([^{}|]*)\|([^{}|]*)(?:\|([^{}|]*))?\}/g

/** 主角在 {男|女|其他} 裡用哪一個：0 男、1 女、2 其他 */
export function pcWordSide(gender: string | undefined): 0 | 1 | 2 {
  const names = genderDef(gender)?.names
  return names === 'm' ? 0 : names === 'f' ? 1 : 2
}

/** 把文字裡的 {男|女} / {男|女|其他} 換成主角適用的詞 */
export function pcWords(state: GameState | undefined, text: string): string
export function pcWords(state: GameState | undefined, text: string | undefined): string | undefined
export function pcWords(state: GameState | undefined, text: string | undefined): string | undefined {
  if (!text || !text.includes('|')) return text
  const side = state ? pcWordSide(pcOf(state).gender) : 0
  return text.replace(PATTERN, (_, m: string, f: string, other?: string) => (side === 0 ? m : side === 1 ? f : other ?? m))
}
