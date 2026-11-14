// 繁轉簡之前的修正（docs/I18N.md）：資料照台灣習慣把「鏈子」寫成「鍊」（項鍊、腳鍊、鍊甲），
// OpenCC 只認得「項鍊」「鍊子」這些詞，單獨的「鍊」一律轉成「炼」（腳鍊→脚炼、鍊甲→炼甲）。
// 轉換前把當鏈子用的「鍊」換成「鏈」；冶煉、修練的用法（鍊金、鍛鍊、淬鍊、鍊成……）留著，照樣轉成「炼」。

/** 「鍊」前一個字是這些時是冶煉、修練 */
const REFINE_BEFORE = new Set([...'鍛淬精提修冶熔焠錘試磨'])
/** 「鍊」後一個字是這些時是冶煉、修練（鍊金、鍊丹、鍊成、鍊鋼……）；前面已經是鏈子的（鐵鍊、腳鍊）不算 */
const REFINE_AFTER = new Set([...'金丹製成化氣獄鋼藥魂體器術'])
/** 前一個字是這些時一定是鏈子（項鍊金扣、鐵鍊製的……） */
const CHAIN_BEFORE = new Set([...'項頸腳腰胸腿手額鈴鐵金銀鋼細短長步拉珠'])

export function fixChainChar(text: string): string {
  if (!text.includes('鍊')) return text
  return text.replace(/鍊/g, (_, i: number) => {
    const prev = text[i - 1] ?? ''
    const next = text[i + 1] ?? ''
    if (REFINE_BEFORE.has(prev)) return '鍊'
    if (REFINE_AFTER.has(next) && !CHAIN_BEFORE.has(prev)) return '鍊'
    return '鏈'
  })
}
