// 玩家可以調整的提示詞設定：文風條目、其他提示詞條目、世界書覆寫。
// 跟著瀏覽器走（所有存檔共用），存在 localStorage（見 src/stores/prompts.ts）。

import type { LoreItem, LoreOverride } from './lore'

/**
 * 條目要套用到哪種請求：
 *   narration 敘事（AI 細節描述）
 *   adult     成人場景的敘事（報告帶 adult_scene，而且成人向開啟時，取代 narration）
 *   judge     判定（AI 判定主動行動，narrative 欄位）
 */
export type PromptTarget = 'narration' | 'adult' | 'judge'
export const PROMPT_TARGETS: PromptTarget[] = ['narration', 'adult', 'judge']
/**
 * 條目放的位置：
 *   system 前段：和規則、常駐世界書放在一起，不太變動，可以被快取
 *   end    後段：放在每次請求的最後（本次要求之前），適合「每次都提醒一次」的指示，但不會被快取
 */
export type PromptPosition = 'system' | 'end'

export interface PromptEntry {
  id: string
  name: string
  content: string
  enabled: boolean
  targets: PromptTarget[]
  /** 只有「其他提示詞」可以選；文風一律放在前段 */
  position?: PromptPosition
  /** 成人向：只在設定開啟成人向時送出 */
  adult?: boolean
  /** 內建預設條目的 id（可以恢復原文） */
  preset?: string
}

export interface PromptConfig {
  /** 2：加入「成人場景」的套用對象 */
  version: 2
  styles: PromptEntry[]
  custom: PromptEntry[]
  /** 內建世界書條目的覆寫（key = uid） */
  lore: Record<string, LoreOverride>
  /** 玩家新增的世界書條目 */
  customLore: LoreItem[]
  /** 判定請求也注入世界書（常駐條目放前段、觸發條目放後段） */
  loreInJudge: boolean
  /** 玩家修改過的敘事規則；沒有時用預設（DEFAULT_NARRATION_RULES） */
  narrationRules?: string
  /** 玩家修改過的戰敗事件規則；沒有時用預設（DEFAULT_DEFEAT_RULES） */
  defeatRules?: string
  /** 玩家修改過的成人場景規則；沒有時用預設（DEFAULT_SCENE_RULES） */
  sceneRules?: string
}

export const TARGET_NAME: Record<PromptTarget, string> = { narration: '敘事', adult: '成人場景', judge: '判定' }

export const PRESET_STYLES: PromptEntry[] = [
  {
    id: 'style-elondia',
    preset: 'style-elondia',
    name: '埃隆迪亞・史詩奇幻',
    enabled: true,
    targets: ['narration', 'adult', 'judge'],
    content: `- 中世紀奇幻的筆調：沉穩、有畫面感，像一本冒險小說，不像遊戲紀錄或攻略。
- 用感官細節帶出場景：光線、聲音、氣味、溫度、觸感；地名、種族與勢力的特色要寫出來（例如矮人的鍛爐、精靈的古樹、魔族的荒原）。
- 角色依性格與態度說話，對白要口語、有個人特色；用動作與表情表現情緒，少用「他很生氣」這類直接說明。
- 戰鬥寫出節奏與招式的畫面，受傷與疲憊要有實感；不寫血量、骰值等數字。
- 避免現代用語、網路流行語與遊戲術語（例如「HP」「技能冷卻」「NPC」）。
- 段落長短交錯，結尾留一點餘韻，不要總結或說教。`,
  },
  {
    id: 'style-light-novel',
    preset: 'style-light-novel',
    name: '輕小說',
    enabled: false,
    targets: ['narration', 'adult', 'judge'],
    content: `- 輕快明亮的輕小說筆調，節奏快、對白多，短句與短段落為主。
- 角色的反應可以誇張一點，適度加入吐槽與內心獨白（主角的內心話用括號或另起一段）。
- 日常與冒險交錯，緊張的場面也保留一點幽默感。`,
  },
  {
    id: 'style-grimdark',
    preset: 'style-grimdark',
    name: '黑暗寫實',
    enabled: false,
    targets: ['narration', 'adult', 'judge'],
    content: `- 冷峻寫實的黑暗奇幻筆調：世界不公平，勝利也有代價。
- 戰鬥殘酷而短促，傷口、泥濘、恐懼與疲憊都要寫出來；不浪漫化暴力。
- 角色的動機複雜，善惡模糊；對白簡短、克制。`,
  },
  {
    id: 'style-comedy',
    preset: 'style-comedy',
    name: '詼諧冒險',
    enabled: false,
    targets: ['narration', 'adult', 'judge'],
    content: `- 詼諧的冒險喜劇筆調：讓失誤與巧合變成笑點，旁白可以帶一點調侃。
- 角色之間的鬥嘴與默契是重點；危機中也可以有荒謬的小插曲。
- 不改變報告的結果，只在描寫上找樂趣。`,
  },
]

export const PRESET_CUSTOM: PromptEntry[] = [
  {
    id: 'custom-example',
    preset: 'custom-example',
    name: '範例：額外提醒',
    enabled: false,
    targets: ['narration', 'adult'],
    position: 'end',
    content: '這次多寫一點同伴之間的互動與對白。',
  },
]

export function defaultPromptConfig(): PromptConfig {
  return {
    version: 2,
    styles: PRESET_STYLES.map((e) => ({ ...e, targets: [...e.targets] })),
    custom: PRESET_CUSTOM.map((e) => ({ ...e, targets: [...e.targets] })),
    lore: {},
    customLore: [],
    loreInJudge: false,
  }
}

/** version 1 的條目沒有「成人場景」：原本套用到敘事的，成人場景也照舊套用 */
function cleanEntry(e: Partial<PromptEntry>, i: number, prefix: string, version = 2): PromptEntry {
  let targets = (Array.isArray(e.targets) ? e.targets : ['narration', 'adult', 'judge']).filter((t): t is PromptTarget => PROMPT_TARGETS.includes(t as PromptTarget))
  if (version < 2 && targets.includes('narration') && !targets.includes('adult')) targets = [...targets, 'adult']
  targets = PROMPT_TARGETS.filter((t) => targets.includes(t))
  return {
    id: typeof e.id === 'string' && e.id ? e.id : `${prefix}-${Date.now().toString(36)}-${i}`,
    name: typeof e.name === 'string' ? e.name : '未命名',
    content: typeof e.content === 'string' ? e.content : '',
    enabled: e.enabled !== false,
    targets,
    ...(e.position === 'end' || e.position === 'system' ? { position: e.position } : {}),
    ...(e.adult ? { adult: true } : {}),
    ...(typeof e.preset === 'string' ? { preset: e.preset } : {}),
  }
}

/** 讀取保存的設定（或匯入的檔案），補上缺少的欄位 */
export function normalizeConfig(raw: unknown): PromptConfig {
  const base = defaultPromptConfig()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Omit<Partial<PromptConfig>, 'version'> & { version?: number }
  const v = typeof r.version === 'number' ? r.version : 1
  return {
    version: 2,
    styles: Array.isArray(r.styles) ? r.styles.map((e, i) => cleanEntry(e, i, 'style', v)) : base.styles,
    custom: Array.isArray(r.custom) ? r.custom.map((e, i) => cleanEntry({ position: 'system', ...e }, i, 'custom', v)) : base.custom,
    lore: r.lore && typeof r.lore === 'object' ? r.lore : {},
    customLore: Array.isArray(r.customLore) ? r.customLore.filter((e) => e && typeof e.uid === 'number') : [],
    loreInJudge: !!r.loreInJudge,
    ...(typeof r.narrationRules === 'string' && r.narrationRules.trim() ? { narrationRules: r.narrationRules } : {}),
    ...(typeof r.defeatRules === 'string' && r.defeatRules.trim() ? { defeatRules: r.defeatRules } : {}),
    ...(typeof r.sceneRules === 'string' && r.sceneRules.trim() ? { sceneRules: r.sceneRules } : {}),
  }
}

/** 套用到某種請求、某個位置的已開啟條目（成人向的條目只在 adult 開啟時），把 {{player}} 換成主角名 */
export function activeEntries(list: PromptEntry[], target: PromptTarget, playerName: string, opts: { position?: PromptPosition; adult: boolean }): PromptEntry[] {
  const { position, adult } = opts
  return list
    .filter((e) => e.enabled && e.content.trim() && e.targets.includes(target) && (adult || !e.adult))
    .filter((e) => position === undefined || (e.position ?? 'system') === position)
    .map((e) => ({ ...e, content: e.content.split('{{player}}').join(playerName) }))
}

/** 粗估 token 數：中日韓文字約 1 字 1 token，其他字元約 4 字 1 token */
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[　-鿿豈-﫿＀-￯]/g) ?? []).length
  return Math.round(cjk + (text.length - cjk) / 4)
}

// ---- 文風、其他提示詞的匯出與匯入 ----

export type EntryFileKind = 'styles' | 'custom'

const FILE_TYPE: Record<EntryFileKind, string> = { styles: 'elondia-styles', custom: 'elondia-prompts' }

export function exportEntries(kind: EntryFileKind, entries: PromptEntry[]): object {
  return {
    type: FILE_TYPE[kind],
    version: 2,
    entries: entries.map(({ preset: _preset, ...e }) => e),
  }
}

/**
 * 讀取匯入的條目檔案：
 * - 本遊戲匯出的 JSON（{type, entries}）、條目陣列，或整份提示詞設定（取對應的清單）
 * - 純文字或 Markdown：整份當作一個條目，檔名當名稱
 */
export function parseEntryFile(kind: EntryFileKind, text: string, fileName = ''): PromptEntry[] {
  const base = fileName.replace(/\.[^.]+$/, '') || (kind === 'styles' ? '匯入的文風' : '匯入的提示詞')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    if (!text.trim()) throw new Error('檔案是空的')
    return [cleanEntry({ name: base, content: text.trim(), ...(kind === 'custom' ? { position: 'system' } : {}) }, 0, kind === 'styles' ? 'style' : 'custom')]
  }
  const r = raw as { entries?: unknown; styles?: unknown; custom?: unknown; version?: unknown }
  // 舊的檔案（version 1 或條目陣列）沒有「成人場景」
  const version = typeof r?.version === 'number' ? r.version : 1
  const list = Array.isArray(raw) ? raw : Array.isArray(r?.entries) ? r.entries : Array.isArray(r?.[kind]) ? r[kind] : null
  if (!list) throw new Error(kind === 'styles' ? '這不是文風檔案' : '這不是提示詞檔案')
  return (list as Partial<PromptEntry>[])
    .filter((e) => e && typeof e === 'object' && typeof e.content === 'string')
    .map((e, i) => {
      const { preset: _preset, id: _id, ...rest } = e
      return cleanEntry(kind === 'custom' ? { position: 'system', ...rest } : { ...rest, position: undefined }, i, kind === 'styles' ? 'style' : 'custom', version)
    })
}
