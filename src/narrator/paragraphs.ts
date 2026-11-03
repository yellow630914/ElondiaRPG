// 日誌正文的段落：畫面上依空行分段（ReportCard），分段插圖也照同一個切法標位置。

import { visibleNarration } from './judge'

/** 正文的段落（拿掉附在最後的人際關係更新；依空行分段，空的段落不算） */
export function narrationParagraphs(text: string): string[] {
  return visibleNarration(text).split(/\n[ \t　]*\n+/).map((x) => x.replace(/^\n+|\n+$/g, '')).filter((x) => !!x.trim())
}

/** 段落的指紋：開頭的 24 個字（不算空白）。插圖記著它，正文改過、段落對不上時就知道那張是舊的 */
export function paragraphAnchor(p: string): string {
  return p.replace(/\s+/g, '').slice(0, 24)
}

/** 插在第 after 段之後的插圖，現在的正文還對得上嗎 */
export function anchorMatches(paragraphs: string[], after: number, anchor: string): boolean {
  const p = paragraphs[after]
  return p !== undefined && paragraphAnchor(p) === anchor
}
