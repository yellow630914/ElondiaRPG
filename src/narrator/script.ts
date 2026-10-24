// 送出前把提示詞轉成「AI 的輸出語言」的寫法（見 docs/I18N.md 第 4 節），只逐字轉換、不換用語：
// - 輸出簡體：整份提示詞轉成簡體，AI 看到的全是同一種寫法，名字也會照著寫。
// - 輸出繁體：只把世界書（內建的是簡體）轉成繁體；其他本來就是繁體。
// 簡轉繁的字典很大，第一次用到時才載入（loadScriptConverters）；還沒載入時世界書維持原樣。

import { toSimplifiedText } from '@/engine/script'
import { assemble, type Prompt } from './prompt'

export type OutputLanguage = 'zh-Hant' | 'zh-Hans'

let toHant: ((text: string) => string) | null = null

/** 輸出繁體時載入簡轉繁的字典（組提示詞之前呼叫） */
export async function loadScriptConverters(lang: OutputLanguage): Promise<void> {
  if (lang !== 'zh-Hant' || toHant) return
  const { Converter } = await import('opencc-js/cn2t')
  toHant = Converter({ from: 'cn', to: 'tw' })
}

/** 世界書的區塊 */
const LORE_KEYS = new Set(['lore_constant', 'lore_triggered'])

/** 依輸出語言轉換提示詞的各個區塊，再重新組起來 */
export function toOutputScript(prompt: Prompt, lang: OutputLanguage): Prompt {
  if (!prompt.sections) return prompt
  if (lang === 'zh-Hans') return assemble(prompt.sections.map((s) => ({ ...s, text: toSimplifiedText(s.text) })))
  const hant = toHant
  if (!hant) return prompt
  return assemble(prompt.sections.map((s) => (LORE_KEYS.has(s.key) ? { ...s, text: hant(s.text) } : s)))
}
