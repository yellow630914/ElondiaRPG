// 正文正則：AI 寫的日誌正文在顯示、存檔、送回給 AI 之前，照玩家的規則尋找與取代。
// 用途是清掉自訂破限預設帶來的雜訊，例如模型在正文裡輸出的 <think_nya>…</think_nya> 思考區塊。
//
// 效能：規則只在內容改動時編譯一次（以規則的內容當快取的 key）；串流中只套在畫面上的文字、而且有節流（ReportCard），
// 收完整段才完整套用一次並寫回存檔，之後顯示與送回給 AI 都用處理過的文字，不再重跑。

export type RegexScope = 'narration' | 'judge'

export const REGEX_SCOPE_NAME: Record<RegexScope, string> = {
  narration: '日誌正文（敘事、續寫）',
  judge: 'AI 判定時寫的經過',
}
export const REGEX_SCOPES: RegexScope[] = ['narration', 'judge']

export interface RegexRule {
  id: string
  name: string
  enabled: boolean
  /** 正規表示式本體（不含前後的斜線） */
  find: string
  /** 旗標：g、i、m、s、u（其他的略過） */
  flags: string
  /** 取代成（可用 $1、$&、$<name>） */
  replace: string
  scopes: RegexScope[]
  /** 內建規則的 id（可以關掉、改內容，也能恢復原本的） */
  builtin?: string
}

/** 內建：刪掉正文裡的思考區塊（<think>、<thinking>、<think_nya> 這類，標籤名稱以 think 開頭的都算） */
export const BUILTIN_THINK_RULE: RegexRule = {
  id: 'regex-think',
  name: '刪掉思考區塊（<think…>…</think…>）',
  enabled: true,
  find: '<(think[\\w-]*)\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>\\s*',
  flags: 'gi',
  replace: '',
  scopes: ['narration', 'judge'],
  builtin: 'think',
}

export const BUILTIN_REGEX: RegexRule[] = [BUILTIN_THINK_RULE]

export function defaultRegexRules(): RegexRule[] {
  return BUILTIN_REGEX.map((r) => ({ ...r, scopes: [...r.scopes] }))
}

const FLAG_SET = new Set(['g', 'i', 'm', 's', 'u'])
export function cleanFlags(flags: unknown): string {
  return [...new Set(String(flags ?? '').split('').filter((c) => FLAG_SET.has(c)))].join('')
}

/** 讀取保存的規則（或匯入的檔案），補上缺少的欄位 */
export function normalizeRegexRules(raw: unknown): RegexRule[] {
  if (!Array.isArray(raw)) return defaultRegexRules()
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r, i) => {
      const scopes = (Array.isArray(r.scopes) ? r.scopes : REGEX_SCOPES).filter((s): s is RegexScope => REGEX_SCOPES.includes(s as RegexScope))
      return {
        id: typeof r.id === 'string' && r.id ? r.id : `regex-${Date.now().toString(36)}-${i}`,
        name: typeof r.name === 'string' && r.name.trim() ? r.name.slice(0, 60) : '未命名',
        enabled: r.enabled !== false,
        find: typeof r.find === 'string' ? r.find : '',
        flags: cleanFlags(r.flags ?? 'g'),
        replace: typeof r.replace === 'string' ? r.replace : '',
        scopes: scopes.length ? scopes : [...REGEX_SCOPES],
        ...(typeof r.builtin === 'string' ? { builtin: r.builtin } : {}),
      }
    })
}

/** 這條規則的語法錯誤（沒有錯時是空字串） */
export function regexError(rule: Pick<RegexRule, 'find' | 'flags'>): string {
  if (!rule.find) return '還沒有填尋找的內容'
  try {
    new RegExp(rule.find, cleanFlags(rule.flags))
    return ''
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

interface Compiled {
  re: RegExp
  replace: string
  scopes: RegexScope[]
  builtin?: string
}

// 以規則的內容當 key：內容沒變就不重新編譯（規則通常只有幾條，快取留最近幾份就夠）
const cache = new Map<string, Compiled[]>()
export function compileRules(rules: readonly RegexRule[]): Compiled[] {
  const key = JSON.stringify(rules.filter((r) => r.enabled).map((r) => [r.find, r.flags, r.replace, r.scopes, r.builtin]))
  const hit = cache.get(key)
  if (hit) return hit
  const out: Compiled[] = []
  for (const r of rules) {
    if (!r.enabled || regexError(r)) continue
    out.push({ re: new RegExp(r.find, cleanFlags(r.flags)), replace: r.replace, scopes: r.scopes, ...(r.builtin ? { builtin: r.builtin } : {}) })
  }
  if (cache.size > 8) cache.clear()
  cache.set(key, out)
  return out
}

/** 照順序套用這個範圍的規則；處理完把開頭多出來的空行拿掉 */
export function applyRegex(text: string, rules: readonly RegexRule[], scope: RegexScope): string {
  if (!text) return text
  const list = compileRules(rules).filter((c) => c.scopes.includes(scope))
  if (!list.length) return text
  let out = text
  for (const c of list) {
    c.re.lastIndex = 0
    out = out.replace(c.re, c.replace)
  }
  return out.replace(/^\s*\n/, '')
}

const OPEN_THINK = /<(think[\w-]*)\b[^>]*>/i

/**
 * 串流中畫面上的文字：完整的區塊照規則處理；內建的思考區塊規則開著時，還沒寫完的 <think…> 從開頭標籤起先藏起來
 * （標籤寫到一半、只有「<thi」時也藏）
 */
export function streamingView(text: string, rules: readonly RegexRule[], scope: RegexScope): string {
  let out = applyRegex(text, rules, scope)
  const hideOpen = compileRules(rules).some((c) => c.builtin === 'think' && c.scopes.includes(scope))
  if (!hideOpen) return out
  const m = OPEN_THINK.exec(out)
  if (m) {
    const close = new RegExp(`</${m[1]}\\s*>`, 'i')
    if (!close.test(out.slice(m.index))) out = out.slice(0, m.index)
  }
  // 結尾是寫到一半的開頭標籤（「<thi」「<think_nya cl」）
  const tail = /<([\w-]*)[^<>]*$/.exec(out)
  const tag = tail?.[1]?.toLowerCase() ?? ''
  if (tail && ('think'.startsWith(tag) || tag.startsWith('think'))) out = out.slice(0, tail.index)
  return out.trimEnd()
}

// ---- 匯入 SillyTavern 的 regex 腳本 ----

export interface TavernImport {
  rules: RegexRule[]
  /** 略過的腳本與原因 */
  skipped: { name: string; why: string }[]
  /** 轉換時拿掉、沒有對應功能的設定 */
  notes: string[]
}

/** 酒館的 findRegex 是「/本體/旗標」的字串；不是斜線格式時當作純文字比對 */
export function parseTavernFind(find: string): { find: string; flags: string } {
  const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(find)
  if (m) return { find: m[1]!, flags: cleanFlags(m[2]) }
  return { find: find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags: 'g' }
}

/** 一份檔案裡的腳本：單一腳本、腳本陣列、預設或角色卡的 extensions.regex_scripts */
function tavernScripts(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  if (!raw || typeof raw !== 'object') return []
  const o = raw as Record<string, unknown>
  if (typeof o.findRegex === 'string') return [o]
  const ext = (o.extensions ?? (o.data as Record<string, unknown> | undefined)?.extensions) as Record<string, unknown> | undefined
  if (ext && Array.isArray(ext.regex_scripts)) return tavernScripts(ext.regex_scripts)
  if (Array.isArray(o.regex_scripts)) return tavernScripts(o.regex_scripts)
  return []
}

/** 這份 JSON 裡有沒有酒館的 regex 腳本 */
export function hasTavernRegex(raw: unknown): boolean {
  return tavernScripts(raw).length > 0
}

/**
 * 轉成我們的格式：只收套用在「AI 輸出」（placement 有 2）的腳本；
 * {{match}} 換成 $&；trimStrings 轉成額外的刪除規則；沒有對應功能的設定列在 notes。
 */
export function importTavernRegex(raw: unknown): TavernImport {
  const out: TavernImport = { rules: [], skipped: [], notes: [] }
  const notes = new Set<string>()
  for (const [i, s] of tavernScripts(raw).entries()) {
    const name = typeof s.scriptName === 'string' && s.scriptName.trim() ? s.scriptName.trim().slice(0, 60) : `酒館正則 ${i + 1}`
    if (typeof s.findRegex !== 'string' || !s.findRegex) {
      out.skipped.push({ name, why: '沒有尋找的內容' })
      continue
    }
    const placement = Array.isArray(s.placement) ? s.placement.map(Number) : [2]
    if (!placement.includes(2)) {
      out.skipped.push({ name, why: '只套用在玩家輸入、斜線指令或世界書，不是 AI 的輸出' })
      continue
    }
    if (s.promptOnly === true) {
      out.skipped.push({ name, why: '只改送給 AI 的內容（promptOnly），這裡沒有對應的功能' })
      continue
    }
    const { find, flags } = parseTavernFind(s.findRegex)
    const rule: RegexRule = {
      id: `regex-st-${Date.now().toString(36)}-${i}`,
      name,
      enabled: s.disabled !== true,
      find,
      flags,
      replace: (typeof s.replaceString === 'string' ? s.replaceString : '').replaceAll('{{match}}', () => '$&'),
      scopes: [...REGEX_SCOPES],
    }
    const err = regexError(rule)
    if (err) {
      out.skipped.push({ name, why: `語法錯誤：${err}` })
      continue
    }
    out.rules.push(rule)
    const trims = Array.isArray(s.trimStrings) ? s.trimStrings.filter((t): t is string => typeof t === 'string' && !!t) : []
    if (trims.length) {
      out.rules.push({
        ...rule,
        id: `${rule.id}-trim`,
        name: `${name}（刪掉 trimStrings）`,
        find: trims.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
        flags: 'g',
        replace: '',
      })
    }
    if (s.markdownOnly === true) notes.add('「只改顯示」（markdownOnly）：這裡一律改寫存下的正文')
    if (s.runOnEdit === true) notes.add('「編輯時套用」（runOnEdit）')
    if (s.substituteRegex && Number(s.substituteRegex) !== 0) notes.add('「替換尋找內容裡的巨集」（substituteRegex）')
    if (typeof s.minDepth === 'number' || typeof s.maxDepth === 'number') notes.add('「深度範圍」（minDepth、maxDepth）')
  }
  out.notes = [...notes]
  return out
}
