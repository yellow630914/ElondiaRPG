// 成人向內容一律存在；AI 依日誌有沒有親密場景（narration.adult_scene）分流，見 narrator/compose.ts。

// ---- 內容標籤與篩選（特殊任務的標籤；設定裡可以關閉 NTR、非處女、主角非自願、男性對象、懷孕、泌乳） ----

export type ContentTag = 'adult' | 'ntr' | 'non_virgin' | 'pc_unwilling' | 'male_partner' | 'pregnancy' | 'lactation' | 'monster_brood'
export type FilterTag = Exclude<ContentTag, 'adult'>
export const CONTENT_TAGS: Record<ContentTag, { name: string; desc: string }> = {
  adult: { name: '成人向', desc: '有露骨的性描寫' },
  ntr: { name: 'NTR', desc: '戀人、伴侶被別人奪走（或主角奪走別人的）' },
  non_virgin: { name: '非處女', desc: '角色在故事開始前就有性經驗（人妻、娼妓、過去的遭遇……）' },
  pc_unwilling: { name: '主角非自願', desc: '主角在不情願的情況下被侵犯（灌醉、色情寶箱怪、戰敗……）' },
  male_partner: { name: '男性對象', desc: '親密的對象是傳統的男性角色（不是偽娘、中性的角色）' },
  pregnancy: { name: '懷孕', desc: '親密場景之後可能受孕：懷孕、察覺、生產與嬰兒（預設關閉）' },
  lactation: { name: '泌乳', desc: '懷孕後期與催乳的道具讓人泌乳（預設關閉）' },
  monster_brood: { name: '怪物的苗床', desc: '怪物把卵、種或幼蟲留在主角體內，幾天後產下（預設關閉）' },
}
export const CONTENT_TAG_IDS = Object.keys(CONTENT_TAGS) as ContentTag[]
export const FILTER_TAGS: FilterTag[] = ['ntr', 'non_virgin', 'pc_unwilling', 'male_partner', 'pregnancy', 'lactation', 'monster_brood']

/** 內容篩選的預設：懷孕、泌乳、怪物的苗床預設關閉，其他打開 */
export const DEFAULT_FILTERS: Record<FilterTag, boolean> = { ntr: true, non_virgin: true, pc_unwilling: true, male_partner: true, pregnancy: false, lactation: false, monster_brood: false }

let filters: Record<FilterTag, boolean> = { ...DEFAULT_FILTERS }

/** 設定的內容篩選：false 的標籤不出現 */
export function setContentFilters(f: Partial<Record<FilterTag, boolean>>) {
  filters = { ...filters, ...f }
}

/** 這些標籤的內容現在可以出現：沒有在設定裡關閉（成人向一律可以） */
export function tagsAllowed(tags: readonly string[] | undefined): boolean {
  return (tags ?? []).every((t) => t === 'adult' || filters[t as FilterTag] !== false)
}

/** 戰敗色情事件：全部、男性形象的主角不發生、關閉 */
export type DefeatAdultMode = 'all' | 'not_masc' | 'off'
let defeatMode: DefeatAdultMode = 'all'

export function setDefeatAdult(m: DefeatAdultMode) {
  defeatMode = m
}

/** 戰敗色情事件一定發生：不擲「敵人起意」，有會起意的敵人就觸發 */
let defeatAlways = false

export function setDefeatAlways(on: boolean) {
  defeatAlways = on
}

export function defeatAlwaysOn(): boolean {
  return defeatAlways
}

/**
 * 陽剛體型也能遇到「只給陰柔、中性」的成人內容（特殊任務、事件、地標場景的 pc_body）：預設關閉。
 * 這些內容是照陰柔、中性的主角寫的；打開時敘事與判定另外提醒 AI 照主角的身體寫（narrator 的 mascBodyNote）
 */
let mascBodyContent = false

export function setMascBodyContent(on: boolean) {
  mascBodyContent = on
}

export function mascBodyContentOn(): boolean {
  return mascBodyContent
}

/** 限定主角體型的內容（pc_body）現在給不給這位主角：沒有限定、體型在清單裡，或陽剛體型打開了上面的設定 */
export function pcBodyAllowed(list: readonly string[] | undefined, body: 'masc' | 'fem' | 'andro'): boolean {
  return !list?.length || list.includes(body) || (body === 'masc' && mascBodyContent)
}

/**
 * 魔物娘：交給 AI 的怪物換成魔物娘的名字與外觀（怪物資料的 girl；沒有魔物娘形態的照原本的描述）。
 * off 關閉、masc 只在這段經過的主角（被圍住的人、親密場景的主角，沒有時是主角）是陽剛體型時、all 一律。預設關閉；介面上的名字不變
 */
export type MonsterGirlMode = 'off' | 'masc' | 'all'
let monsterGirlMode: MonsterGirlMode = 'off'

export function setMonsterGirl(m: MonsterGirlMode) {
  monsterGirlMode = m
}

/** 魔物娘出現的機率（0～100，預設 100）：設定打開、主角符合時，每種怪物每天擲一次（怪物可以自己寫 girl.chance） */
let monsterGirlChanceValue = 100

export function setMonsterGirlChance(n: number) {
  monsterGirlChanceValue = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 100
}

export function monsterGirlChance(): number {
  return monsterGirlChanceValue
}

/** 這位角色（體型）在場時，怪物要不要以魔物娘的樣子交給 AI */
export function monsterGirlsFor(body: 'masc' | 'fem' | 'andro'): boolean {
  return monsterGirlMode === 'all' || (monsterGirlMode === 'masc' && body === 'masc')
}

/** 隊友的戰敗色情事件（主角不會遇到時，改由隊友遇到）：全部的隊友、男性形象的隊友不發生、關閉 */
let defeatCompanionMode: DefeatAdultMode = 'not_masc'

export function setDefeatCompanion(m: DefeatAdultMode) {
  defeatCompanionMode = m
}

/** 這位隊友（體型）現在會不會遇到戰敗色情事件：只看隊友的設定（「主角非自願」只管主角） */
export function defeatCompanionAllowed(body: 'masc' | 'fem' | 'andro'): boolean {
  if (defeatCompanionMode === 'off') return false
  return defeatCompanionMode !== 'not_masc' || body !== 'masc'
}

/** 這位主角（體型）現在會不會遇到戰敗色情事件：主角非自願要開著，再看戰敗事件的設定 */
export function defeatAdultAllowed(body: 'masc' | 'fem' | 'andro'): boolean {
  if (!tagsAllowed(['pc_unwilling']) || defeatMode === 'off') return false
  return defeatMode !== 'not_masc' || body !== 'masc'
}

/** 主動行動可能進入的親密場景：on 是會進入場景的成功程度（沒有時一律；空陣列時由 AI 判定） */
export interface AdultScene {
  label: string
  on?: ('critical' | 'success' | 'partial' | 'fail' | 'fumble')[]
}

/** 給 setup 函式展開：{ ...adultScene('…') } */
export function adultScene(label: string, on?: AdultScene['on']): { adultScene?: AdultScene } {
  return { adultScene: { label, ...(on ? { on } : {}) } }
}
