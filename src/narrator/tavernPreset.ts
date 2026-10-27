// 匯入 SillyTavern（酒館）的預設：把預設裡的提示詞條目列出來，讓玩家挑幾個加到文風或其他提示詞（docs/PROMPTS.md）。
// 支援對話補全預設（prompts + prompt_order）、舊版的 main_prompt / nsfw_prompt / jailbreak_prompt、系統提示詞預設（name + content）。

/** 預設裡的一個條目 */
export interface TavernPromptItem {
  /** 酒館的 identifier */
  id: string
  name: string
  role: 'system' | 'user' | 'assistant'
  /** 換掉巨集之後的內容 */
  content: string
  /** 預設裡有沒有開啟 */
  enabled: boolean
  /** 放在聊天紀錄之後（或插在聊天中的某個深度）：通常是每次都要提醒的指示，對應「其他提示詞」的後段 */
  late: boolean
  /** 換不掉、會原樣送出的酒館巨集 */
  macros: string[]
}

export interface TavernPreset {
  name: string
  items: TavernPromptItem[]
}

interface RawPrompt {
  identifier?: unknown
  name?: unknown
  role?: unknown
  content?: unknown
  marker?: unknown
  enabled?: unknown
  injection_position?: unknown
  system_prompt?: unknown
}

// 舊版預設（1.10 以前）直接寫在頂層的提示詞
const LEGACY_KEYS: { key: string; name: string; late?: boolean }[] = [
  { key: 'main_prompt', name: '主要提示詞' },
  { key: 'nsfw_prompt', name: 'NSFW 提示詞' },
  { key: 'jailbreak_prompt', name: '越獄提示詞', late: true },
  { key: 'impersonation_prompt', name: '代寫提示詞' },
]

/**
 * 換掉酒館的巨集：註解 {{// …}}、{{trim}}、{{noop}} 拿掉，{{newline}} 換行，{{user}}（<USER>）換成本遊戲的 {{player}}。
 * 其他巨集（{{char}}、{{setvar::…}}、{{random::…}}……）留著，列在 macros 裡讓玩家自己改。
 */
export function cleanTavernText(text: string): { content: string; macros: string[] } {
  const content = text
    .replace(/\{\{\/\/[\s\S]*?\}\}/g, '')
    .replace(/\{\{(trim|noop)\}\}/gi, '')
    .replace(/\{\{newline\}\}/gi, '\n')
    .replace(/\{\{user\}\}|<USER>/gi, '{{player}}')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const macros = [...new Set((content.match(/\{\{[^{}]*\}\}/g) ?? []).filter((m) => m !== '{{player}}').map((m) => m.replace(/::[\s\S]*$/, '}}')))]
  return { content, macros }
}

function item(id: string, name: string, role: unknown, text: string, enabled: boolean, late: boolean): TavernPromptItem | null {
  const { content, macros } = cleanTavernText(text)
  if (!content) return null
  return { id, name: name.trim() || id, role: role === 'user' || role === 'assistant' ? role : 'system', content, enabled, late, macros }
}

/** 對話補全預設的條目順序：全域的（character_id 100001），沒有時用預設的（100000）或第一份 */
function promptOrder(raw: unknown): { identifier: string; enabled: boolean }[] {
  if (!Array.isArray(raw)) return []
  const lists = raw.filter((x): x is { character_id?: number; order: unknown[] } => !!x && typeof x === 'object' && Array.isArray((x as { order?: unknown }).order))
  const pick = lists.find((x) => x.character_id === 100001) ?? lists.find((x) => x.character_id === 100000) ?? lists[0]
  return (pick?.order ?? [])
    .filter((o): o is { identifier: string; enabled?: unknown } => !!o && typeof o === 'object' && typeof (o as { identifier?: unknown }).identifier === 'string')
    .map((o) => ({ identifier: o.identifier, enabled: o.enabled !== false }))
}

/** 讀取酒館的預設檔案；看不出是酒館的預設時丟出錯誤 */
export function parseTavernPreset(text: string, fileName = ''): TavernPreset {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('不是 JSON 檔案')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('看不出是酒館的預設')
  const r = raw as Record<string, unknown>
  const name = (typeof r.name === 'string' && r.name.trim()) || fileName.replace(/\.[^.]+$/, '') || '酒館預設'
  const items: TavernPromptItem[] = []

  if (Array.isArray(r.prompts)) {
    // 對話補全預設：依 prompt_order 排，沒排進去的放最後（預設沒開）
    const prompts = (r.prompts as RawPrompt[]).filter((p) => p && typeof p === 'object' && typeof p.identifier === 'string')
    const order = promptOrder(r.prompt_order)
    const byId = new Map(prompts.map((p) => [p.identifier as string, p]))
    const seen = new Set<string>()
    let afterHistory = false
    for (const o of order) {
      if (o.identifier === 'chatHistory') afterHistory = true
      const p = byId.get(o.identifier)
      if (!p || p.marker || typeof p.content !== 'string') continue
      seen.add(o.identifier)
      const it = item(o.identifier, String(p.name ?? ''), p.role, p.content, o.enabled, afterHistory || p.injection_position === 1)
      if (it) items.push(it)
    }
    for (const p of prompts) {
      if (seen.has(p.identifier as string) || p.marker || typeof p.content !== 'string') continue
      const it = item(p.identifier as string, String(p.name ?? ''), p.role, p.content, order.length ? false : p.enabled !== false, p.injection_position === 1)
      if (it) items.push(it)
    }
    return { name, items }
  }

  for (const k of LEGACY_KEYS) {
    if (typeof r[k.key] !== 'string') continue
    const it = item(k.key, k.name, 'system', r[k.key] as string, true, !!k.late)
    if (it) items.push(it)
  }
  if (items.length) return { name, items }

  // 系統提示詞預設（Advanced Formatting 的 System Prompt）
  if (typeof r.content === 'string') {
    const it = item('content', name, 'system', r.content, true, false)
    if (it) return { name, items: [it] }
  }
  throw new Error('看不出是酒館的預設（要有 prompts、main_prompt 或 content）')
}
