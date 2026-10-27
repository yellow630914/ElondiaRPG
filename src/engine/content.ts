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

// ---- 內容標籤與篩選（特殊任務的標籤；設定裡可以關閉 NTR、非處女、主角非自願、男性對象） ----

export type ContentTag = 'adult' | 'ntr' | 'non_virgin' | 'pc_unwilling' | 'male_partner'
export type FilterTag = Exclude<ContentTag, 'adult'>
export const CONTENT_TAGS: Record<ContentTag, { name: string; desc: string }> = {
  adult: { name: '成人向', desc: '有露骨的性描寫；設定沒有開啟成人向時不出現' },
  ntr: { name: 'NTR', desc: '戀人、伴侶被別人奪走（或主角奪走別人的）' },
  non_virgin: { name: '非處女', desc: '角色在故事開始前就有性經驗（人妻、娼妓、過去的遭遇……）' },
  pc_unwilling: { name: '主角非自願', desc: '主角在不情願的情況下被侵犯（灌醉、色情寶箱怪、戰敗……）' },
  male_partner: { name: '男性對象', desc: '親密的對象是傳統的男性角色（不是偽娘、中性的角色）' },
}
export const CONTENT_TAG_IDS = Object.keys(CONTENT_TAGS) as ContentTag[]
export const FILTER_TAGS: FilterTag[] = ['ntr', 'non_virgin', 'pc_unwilling', 'male_partner']

let filters: Record<FilterTag, boolean> = { ntr: true, non_virgin: true, pc_unwilling: true, male_partner: true }

/** 設定的內容篩選：false 的標籤不出現 */
export function setContentFilters(f: Partial<Record<FilterTag, boolean>>) {
  filters = { ...filters, ...f }
}

/** 這些標籤的內容現在可以出現：成人向要開啟成人向，其他標籤要沒有在設定裡關閉 */
export function tagsAllowed(tags: readonly string[] | undefined): boolean {
  return (tags ?? []).every((t) => (t === 'adult' ? adult : filters[t as FilterTag] !== false))
}

/** 戰敗色情事件：全部、男性形象的主角不發生、關閉 */
export type DefeatAdultMode = 'all' | 'not_masc' | 'off'
let defeatMode: DefeatAdultMode = 'all'

export function setDefeatAdult(m: DefeatAdultMode) {
  defeatMode = m
}

/** 這位主角（體型）現在會不會遇到戰敗色情事件：成人向、主角非自願都要開著，再看戰敗事件的設定 */
export function defeatAdultAllowed(body: 'masc' | 'fem' | 'andro'): boolean {
  if (!adult || !tagsAllowed(['pc_unwilling']) || defeatMode === 'off') return false
  return defeatMode !== 'not_masc' || body !== 'masc'
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
