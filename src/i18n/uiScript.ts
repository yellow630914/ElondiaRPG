// 介面語言（docs/I18N.md）：遊戲的文字都是繁體中文寫的；介面選簡體中文時，畫面上的文字在顯示時轉成簡體。
// 用 OpenCC 逐字轉（台灣字形 → 大陸簡體），再換一小張介面用語表（儲存→保存、匯出→导出、圖示→图标）。
// 不用 OpenCC 的台灣用語詞典（twp）：那是給資訊類文章的，會把奇幻的文字與音譯的名字改壞
// （哥布林→哥布尔、熔岩核心→熔岩内核、傳送卷軸→发送卷轴、傑佛瑞→杰福雷、地平線上→地平在线）。
//
// 只改「畫面上看到的」：文字節點與 title、placeholder、aria-label、alt 屬性，以及 alert／confirm／prompt 的訊息。
// 資料、存檔、送給 AI 的提示詞、AI 寫的正文、輸入框與文字框裡的值都不動（玩家輸入什麼就存什麼；正文的語言由「AI 的輸出語言」決定）。
// 切回繁體時，還在畫面上、沒有被程式改過的文字換回原文。

import { ConverterFactory, Locale } from 'opencc-js/t2cn'

export type UiLanguage = 'zh-Hant' | 'zh-Hans'

/**
 * 介面用語（轉成簡體之後再換）：只放介面與說明才用得到、不會出現在名字與故事裡的詞。
 * 要保留原樣的寫法放在同一個詞旁邊（詞典取最長的比對：档案室 不會被換成 文件室）。
 * 「设定」不換成「设置」：世界書與提示詞裡的「世界观设定」「角色设定」是設定集的意思。
 */
const UI_TERMS: [string, string][] = [
  ['储存', '保存'],
  ['汇入', '导入'],
  ['汇出', '导出'],
  ['选单', '菜单'],
  ['图示', '图标'],
  ['介面', '界面'],
  ['内建', '内置'],
  ['档案', '文件'],
  ['档案室', '档案室'],
  ['档案馆', '档案馆'],
  ['档案库', '档案库'],
  ['档名', '文件名'],
  ['资料夹', '文件夹'],
  ['程式码', '代码'],
  ['程式', '程序'],
  ['视窗', '窗口'],
  ['伺服器', '服务器'],
  ['使用者', '用户'],
  ['快取', '缓存'],
  ['载入', '加载'],
  ['载入史册', '载入史册'],
  ['字型', '字体'],
  ['字串', '字符串'],
  ['物件', '对象'],
  ['函式', '函数'],
  ['重新整理', '刷新'],
  ['专案', '项目'],
  ['模组', '模块'],
  ['资讯', '信息'],
  ['预设值', '默认值'],
  ['机率', '概率'],
  ['建立角色', '创建角色'],
  ['支援', '支持'],
  ['滑鼠', '鼠标'],
  ['卷动', '滚动'],
  ['网路', '网络'],
  ['点选', '点击'],
  ['贴上', '粘贴'],
]
const toHans = ConverterFactory(Locale.from.tw!, Locale.to.cn!, [UI_TERMS])
/** 一段文字轉成簡體（沒有中文時原樣傳回，省得每次都轉） */
export function toSimplifiedUi(text: string): string {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(text) ? toHans(text) : text
}

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'] as const
/** 不轉的地方：玩家輸入的值、提示詞與原始資料（pre）、AI 寫的正文（data-no-convert）、程式碼 */
const SKIP = 'textarea, pre, script, style, code, [contenteditable], [data-no-convert]'

/** 轉過的文字節點與屬性：記下原文與轉換後的文字，切回繁體時換回去 */
const textOriginal = new WeakMap<Text, { orig: string; conv: string }>()
const attrOriginal = new WeakMap<Element, Record<string, { orig: string; conv: string }>>()
const tracked = new Set<WeakRef<Node>>()

let observer: MutationObserver | null = null
let pending = new Set<Node>()
let scheduled = false
/** 開始轉換前的 alert／confirm／prompt（停止時換回去） */
let nativeDialogs = { alert: window.alert, confirm: window.confirm, prompt: window.prompt }

/** 記下轉過的節點（切回繁體時用）；不在畫面上的定期清掉 */
function track(n: Node) {
  tracked.add(new WeakRef(n))
  if (tracked.size > 20000) for (const r of tracked) if (!r.deref()?.isConnected) tracked.delete(r)
}

function skipped(el: Element | null): boolean {
  return !!el?.closest(SKIP)
}

function convertText(node: Text) {
  if (skipped(node.parentElement)) return
  const now = node.nodeValue ?? ''
  const seen = textOriginal.get(node)
  // 自己轉出來的結果：不用再轉
  if (seen && seen.conv === now) return
  const conv = toSimplifiedUi(now)
  if (conv === now) return
  textOriginal.set(node, { orig: now, conv })
  if (!seen) track(node)
  node.nodeValue = conv
}

function convertAttrs(el: Element) {
  if (skipped(el) && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  for (const a of ATTRS) {
    const now = el.getAttribute(a)
    if (!now) continue
    const map = attrOriginal.get(el) ?? {}
    if (map[a]?.conv === now) continue
    const conv = toSimplifiedUi(now)
    if (conv === now) continue
    if (!attrOriginal.has(el)) track(el)
    map[a] = { orig: now, conv }
    attrOriginal.set(el, map)
    el.setAttribute(a, conv)
  }
}

function convertTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return convertText(root as Text)
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return
  if (root.nodeType === Node.ELEMENT_NODE) convertAttrs(root as Element)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) convertText(n as Text)
    else convertAttrs(n as Element)
  }
}

/** 一個畫格內的變動一起處理（串流的敘事一秒會更新很多次） */
function flush() {
  scheduled = false
  const nodes = pending
  pending = new Set()
  for (const n of nodes) if (n.isConnected) convertTree(n)
}

function queue(n: Node) {
  pending.add(n)
  if (!scheduled) {
    scheduled = true
    requestAnimationFrame(flush)
  }
}

function start() {
  if (observer) return
  convertTree(document.body)
  document.title = toSimplifiedUi(document.title)
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') queue(r.target)
      else if (r.type === 'attributes') queue(r.target)
      else r.addedNodes.forEach(queue)
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
  nativeDialogs = { alert: window.alert, confirm: window.confirm, prompt: window.prompt }
  window.alert = (msg?: unknown) => nativeDialogs.alert.call(window, toSimplifiedUi(String(msg ?? '')))
  window.confirm = (msg?: string) => nativeDialogs.confirm.call(window, toSimplifiedUi(String(msg ?? '')))
  window.prompt = (msg?: string, def?: string) => nativeDialogs.prompt.call(window, toSimplifiedUi(String(msg ?? '')), def)
}

function stop() {
  if (!observer) return
  observer.disconnect()
  observer = null
  pending = new Set()
  Object.assign(window, nativeDialogs)
  // 還在畫面上、而且還是轉換後樣子的，換回原文（被程式改過的就是新的原文，不用動）
  for (const ref of tracked) {
    const n = ref.deref()
    if (!n) continue
    if (n.nodeType === Node.TEXT_NODE) {
      const t = textOriginal.get(n as Text)
      if (t && n.nodeValue === t.conv) n.nodeValue = t.orig
    } else {
      const el = n as Element
      for (const [a, v] of Object.entries(attrOriginal.get(el) ?? {})) if (el.getAttribute(a) === v.conv) el.setAttribute(a, v.orig)
    }
  }
  tracked.clear()
}

/** 套用介面語言：設定 html 的 lang（字型依它挑字形），簡體時開始轉換 */
export function applyUiLanguage(lang: UiLanguage) {
  document.documentElement.lang = lang
  if (lang === 'zh-Hans') start()
  else stop()
}

/** 立刻處理還在排隊的變動（測試用） */
export function flushUiConversion() {
  flush()
}
