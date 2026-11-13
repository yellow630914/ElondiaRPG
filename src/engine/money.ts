// 貨幣：全大陸統一使用阿爾貝納發行的白鸛幣，金額一律以整數儲存（欄位名稱的 _cc 沿用舊名）。
// 世界書的價格是舊幣制（銅、銀、金、白金），換算見 data/rules/economy.json。

import economyJson from '@data/rules/economy.json'
import type { Changes } from './types'

export const CURRENCY = economyJson.currency as { id: string; name: string; short: string; issuer: string; legacy: Record<string, number> }

/** 1234 → "1,234 白鸛" */
export function formatMoney(cc: number): string {
  const n = Math.round(cc)
  const sign = n < 0 ? '-' : ''
  return `${sign}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ${CURRENCY.short}`
}

/** 給 AI 的貨幣說明：只有一種貨幣，世界書的舊幣制要換算 */
export function currencyRule(): string {
  const legacy = Object.entries(CURRENCY.legacy).map(([k, v]) => `1 ${k} = ${v}`).join('、')
  return `貨幣只有阿爾貝納發行的${CURRENCY.name}（簡稱${CURRENCY.short}），金額都以${CURRENCY.name}計；不要寫銅幣、銀幣、金幣。世界書裡的舊幣制價格換算成${CURRENCY.name}：${legacy}。大約的物價：1 ${CURRENCY.short}是一塊黑麵包，10 ${CURRENCY.short}是一頓酒館晚餐，精良裝備或魔法物品從 100 ${CURRENCY.short}起跳。`
}

/** 報告的金錢明細要不要分開列：兩筆以上、而且加起來等於合計（主人拿走的那份另外列） */
export function moneyPartsShown(c: Pick<Changes, 'money_cc' | 'money_parts' | 'master_share_cc'>): boolean {
  const parts = c.money_parts ?? []
  return parts.length >= 2 && parts.reduce((s, p) => s + p.amount, 0) === (c.money_cc ?? 0) + (c.master_share_cc ?? 0)
}
