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
