// 設定的匯出與匯入：把瀏覽器裡的設定（AI 來源與遊戲設定、生圖、提示詞組、角色預設）存成一個檔案，
// 在另一台電腦匯入後接著用。存檔不在這裡（右上角的「存讀檔」有自己的匯出）。
//
// - 各部分原樣搬 localStorage 的內容：各 store 讀取時本來就會整理舊資料，匯入後重新整理頁面就好。
// - API 金鑰（所有名為 apiKey 的欄位，含 Vertex 的服務帳戶 JSON）預設不帶；不帶的檔案匯入時，
//   沿用這台電腦同一個位置原本的金鑰。

export const SETTINGS_FILE_KIND = 'elondia-settings'

export const SETTINGS_PARTS = [
  { id: 'settings', key: 'elondia.settings', name: 'AI 來源與遊戲設定', desc: '模型來源、各功能用哪個來源、敘事與判定、畫面、遊戲規則' },
  { id: 'image', key: 'elondia.image', name: '生圖設定', desc: '生圖服務、ComfyUI 的設定組合、提示詞模板' },
  { id: 'prompts', key: 'elondia.promptSets', name: '提示詞組', desc: '敘事規則、文風、世界書、其他提示詞' },
  { id: 'characters', key: 'elondia.characters', name: '角色預設', desc: '開新遊戲時存下的角色' },
] as const

export type SettingsPartId = (typeof SETTINGS_PARTS)[number]['id']

export interface SettingsFile {
  kind: typeof SETTINGS_FILE_KIND
  version: 1
  /** 匯出時的遊戲版本 */
  app: string
  exported: string
  /** 有沒有帶 API 金鑰 */
  keys: boolean
  parts: Partial<Record<SettingsPartId, unknown>>
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** 深拷貝並清空所有 apiKey 欄位 */
export function stripKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripKeys) as T
  if (!isObj(value)) return value
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'apiKey' && typeof v === 'string' ? '' : stripKeys(v)])) as T
}

/** 有沒有任何非空的 apiKey */
export function hasKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasKeys)
  if (!isObj(value)) return false
  return Object.entries(value).some(([k, v]) => (k === 'apiKey' ? typeof v === 'string' && v.trim() !== '' : hasKeys(v)))
}

/** 匯入的內容裡空的 apiKey，用目前同一個位置的金鑰補上（陣列照索引對應） */
export function fillKeys<T>(incoming: T, current: unknown): T {
  if (Array.isArray(incoming)) return incoming.map((v, i) => fillKeys(v, Array.isArray(current) ? current[i] : undefined)) as T
  if (!isObj(incoming)) return incoming
  const cur = isObj(current) ? current : {}
  return Object.fromEntries(Object.entries(incoming).map(([k, v]) => {
    if (k === 'apiKey' && v === '' && typeof cur[k] === 'string') return [k, cur[k]]
    return [k, fillKeys(v, cur[k])]
  })) as T
}

function readPart(key: string): unknown {
  const raw = localStorage.getItem(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** 做出要匯出的檔案（只放這台電腦上有的部分） */
export function buildSettingsFile(includeKeys: boolean, parts: readonly SettingsPartId[] = SETTINGS_PARTS.map((p) => p.id)): SettingsFile {
  const out: SettingsFile['parts'] = {}
  for (const p of SETTINGS_PARTS) {
    if (!parts.includes(p.id)) continue
    const v = readPart(p.key)
    if (v !== undefined) out[p.id] = includeKeys ? v : stripKeys(v)
  }
  return { kind: SETTINGS_FILE_KIND, version: 1, app: __APP_VERSION__, exported: new Date().toISOString(), keys: includeKeys, parts: out }
}

/** 讀檔案：不是設定檔時丟出錯誤（存檔、世界包放錯地方時說清楚） */
export function parseSettingsFile(text: string): SettingsFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('檔案不是 JSON')
  }
  if (!isObj(data) || data.kind !== SETTINGS_FILE_KIND || !isObj(data.parts)) {
    throw new Error('這不是設定檔（存檔請到右上角的「存讀檔」匯入，世界包請到「世界管理」匯入）')
  }
  const parts: SettingsFile['parts'] = {}
  for (const p of SETTINGS_PARTS) if (data.parts[p.id] !== undefined) parts[p.id] = data.parts[p.id]
  if (!Object.keys(parts).length) throw new Error('檔案裡沒有任何設定')
  return {
    kind: SETTINGS_FILE_KIND, version: 1,
    app: typeof data.app === 'string' ? data.app : '',
    exported: typeof data.exported === 'string' ? data.exported : '',
    keys: data.keys === true,
    parts,
  }
}

/** 寫進瀏覽器（取代這些部分）；呼叫後要重新整理頁面，各 store 才會重新讀取 */
export function applySettingsFile(file: SettingsFile, parts: readonly SettingsPartId[]): SettingsPartId[] {
  const done: SettingsPartId[] = []
  for (const p of SETTINGS_PARTS) {
    if (!parts.includes(p.id) || file.parts[p.id] === undefined) continue
    const value = fillKeys(file.parts[p.id], readPart(p.key))
    localStorage.setItem(p.key, JSON.stringify(value))
    done.push(p.id)
  }
  return done
}
