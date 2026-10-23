// 世界包（worldgen/README.md、docs/CONTENT_EDITOR.md 第 0 節）：一個檔案帶著一個世界的自訂內容與提示詞組（文風、其他提示詞、世界書的修改）。
// 匯入時建立新的世界與新的提示詞組，並把兩者綁在一起：切換到這個世界時，提示詞組跟著切換。
// 內容檔（自訂內容的匯出，type: elondia-content）也認得：只有內容、沒有提示詞。

import type { ContentMods } from './mods'

export const WORLD_PACKAGE_TYPE = 'elondia-world'
export const CONTENT_FILE_TYPE = 'elondia-content'

export interface WorldPackage {
  type: typeof WORLD_PACKAGE_TYPE
  version: 1
  /** 世界的名稱（匯入時同名會加上數字） */
  name: string
  /** 給玩家看的說明 */
  desc?: string
  /** 自訂內容（和內容檔相同的格式，不含 type） */
  content: Partial<ContentMods>
  /** 提示詞組的設定（提示詞頁的「匯出設定」格式）；沒有時沿用目前的提示詞組 */
  prompts?: unknown
}

export interface ParsedWorldFile {
  kind: 'package' | 'content'
  name?: string
  desc?: string
  content: Partial<ContentMods>
  prompts?: unknown
}

/** 讀世界包或內容檔（其他格式丟錯） */
export function parseWorldFile(raw: unknown): ParsedWorldFile {
  if (!raw || typeof raw !== 'object') throw new Error('不是世界包或內容檔')
  const r = raw as Record<string, unknown>
  if (r.type === WORLD_PACKAGE_TYPE) {
    if (!r.content || typeof r.content !== 'object') throw new Error('世界包裡沒有內容（content）')
    return {
      kind: 'package',
      name: typeof r.name === 'string' ? r.name.trim().slice(0, 30) : undefined,
      desc: typeof r.desc === 'string' ? r.desc.trim().slice(0, 500) : undefined,
      content: r.content as Partial<ContentMods>,
      prompts: r.prompts && typeof r.prompts === 'object' ? r.prompts : undefined,
    }
  }
  // 內容檔：自訂內容的匯出（type 可有可無）
  const { type: _type, ...content } = r
  return { kind: 'content', content: content as Partial<ContentMods> }
}

export function makeWorldPackage(name: string, content: ContentMods, prompts?: unknown, desc?: string): WorldPackage {
  return { type: WORLD_PACKAGE_TYPE, version: 1, name, ...(desc ? { desc } : {}), content, ...(prompts ? { prompts } : {}) }
}
