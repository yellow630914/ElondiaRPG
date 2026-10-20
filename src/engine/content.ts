// 成人向內容的開關（設定的「成人向」）。
//
// 引擎不讀設定：畫面在設定變更時呼叫 setAdultContent。關閉時，娼館、娼妓等詞依
// data/rules/work.json 的 safe_names 換成按摩店、技師……（顯示與交給 AI 的文字都經過 safeText）。

import workJson from '@data/rules/work.json'

const SAFE_NAMES = workJson.safe_names as [string, string][]

let adult = false

export function setAdultContent(on: boolean) {
  adult = on
}

export function adultContent(): boolean {
  return adult
}

/** 關閉成人向時，把成人向的詞換成一般的說法 */
export function safeText(s: string): string {
  if (adult || !s) return s
  for (const [from, to] of SAFE_NAMES) s = s.split(from).join(to)
  return s
}

/** 主動行動可能進入的親密場景：on 是會進入場景的成功程度（沒有時一律；空陣列時由 AI 判定） */
export interface AdultScene {
  label: string
  on?: ('critical' | 'success' | 'partial' | 'fail' | 'fumble')[]
}

/** 開啟成人向時才回傳場景，給 setup 函式展開：{ ...adultScene('…') } */
export function adultScene(label: string, on?: AdultScene['on']): { adultScene?: AdultScene } {
  return adult ? { adultScene: { label, ...(on ? { on } : {}) } } : {}
}
