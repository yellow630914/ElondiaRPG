// 自訂裝備的鍵：顯示的名字＋看不見的屬性雜湊（docs/ITEMS.md 第 3.3 節）。
// 行囊、存放、商店、拍賣都用物品的名字當鍵；同名但附魔不同的裝備靠雜湊分開，屬性完全一樣的雜湊相同、自然疊在一起。
// 雜湊用零寬字元寫，畫面上看不見，不用每個顯示名字的地方都另外處理；送給 AI 的提示詞與複製出去的文字才拿掉（stripItemKeys）。

/** 雜湊的開頭（U+2063 隱形分隔符） */
const MARK = '⁣'
/** 雜湊的四個「數字」：零寬空格、零寬不連字、文字連接符、隱形加號（都不佔寬度、不會被 trim 掉） */
const DIGITS = ['​', '‌', '⁠', '⁤'] as const
const KEY_RE = /⁣[​‌⁠⁤]+/g
/** 24 位元 = 12 個四進位數字 */
const LENGTH = 12

/** 物品顯示的名字（拿掉雜湊）；沒有雜湊的名字原樣回傳 */
export function itemLabel(name: string): string {
  return name.includes(MARK) ? name.replace(KEY_RE, '') : name
}

/** 文字裡所有物品名字的雜湊都拿掉（提示詞、複製出去的日誌） */
export const stripItemKeys = itemLabel

/** 名字帶著雜湊（自訂裝備的鍵） */
export function hasItemKey(name: string): boolean {
  return name.includes(MARK)
}

/** 鍵的順序固定的 JSON（屬性一樣、寫的順序不同時雜湊也一樣）；undefined 與空物件不算 */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined && !(x && typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/** FNV-1a 32 位元 */
function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 屬性的雜湊（看不見的字元）；salt 是雜湊撞到時換一個 */
export function specHash(spec: unknown, salt = 0): string {
  let h = fnv1a(`${canonical(spec)}${salt ? `#${salt}` : ''}`) & 0xffffff
  let out = ''
  for (let i = 0; i < LENGTH; i++) {
    out = DIGITS[h & 3]! + out
    h >>>= 2
  }
  return `${MARK}${out}`
}

/** 名字（拿掉原本的雜湊）＋屬性的雜湊 */
export function itemKey(label: string, spec: unknown, salt = 0): string {
  return `${itemLabel(label)}${specHash(spec, salt)}`
}

/** 兩件裝備的屬性一樣（不看鍵寫的順序） */
export function sameShape(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}
