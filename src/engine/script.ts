// 繁簡不分的名字比對：AI 照簡體的提示詞回傳物品、能力的名稱時，換回資料裡的寫法（見 docs/I18N.md 第 4 節）。
// 只逐字轉換（OpenCC 台灣字形 → 大陸簡體），不換用語。

import { Converter } from 'opencc-js/t2cn'

const toHans = Converter({ from: 'tw', to: 'cn' })

/** 逐字轉成簡體（提示詞與名字比對共用） */
export function toSimplifiedText(text: string): string {
  return /[㐀-鿿豈-﫿]/.test(text) ? toHans(text) : text
}

/** 在候選的名字裡找同一個名字（寫法一樣優先，再來繁簡不分）；找不到時原樣傳回 */
export function canonicalName(name: string, candidates: Iterable<string>): string {
  const list = [...candidates]
  if (list.includes(name)) return name
  const key = toSimplifiedText(name)
  return list.find((c) => toSimplifiedText(c) === key) ?? name
}
