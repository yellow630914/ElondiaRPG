// 勾選清單（CheckList.vue）的選項：內容標籤與主角形象，各個編輯器與篩選共用同一組名稱
import { CONTENT_TAG_IDS, CONTENT_TAGS } from '@/engine/content'
import { BODIES } from '@/engine/traits'

/** [值, 名稱, 滑鼠移上去的說明] */
export type CheckOption = readonly [string, string, string?]

export const CONTENT_TAG_OPTIONS: CheckOption[] = CONTENT_TAG_IDS.map((t) => [t, CONTENT_TAGS[t].name, CONTENT_TAGS[t].desc])

/** 主角的形象（建角時的體態；沒選時依種族與性別） */
export const BODY_LABEL: Record<(typeof BODIES)[number], string> = { masc: '男性形象', fem: '女性形象', andro: '中性' }
export const BODY_OPTIONS: CheckOption[] = BODIES.map((b) => [b, BODY_LABEL[b]])

/** 勾或取消一項：沒有勾任何一項時是 undefined（存檔時不寫這個欄位） */
export function toggled<T extends string>(list: readonly T[] | undefined, v: T, on: boolean): T[] | undefined {
  const next = on ? [...new Set([...(list ?? []), v])] : (list ?? []).filter((x) => x !== v)
  return next.length ? next : undefined
}
