// 金額一律以銅幣 (CC) 整數儲存，顯示時才換算。

const UNITS = [
  { name: '白金幣', short: '白金', value: 1000 },
  { name: '金幣', short: '金', value: 100 },
  { name: '銀幣', short: '銀', value: 10 },
  { name: '銅幣', short: '銅', value: 1 },
] as const

/** 1234 → "1 白金 2 金 3 銀 4 銅" */
export function formatMoney(cc: number): string {
  if (cc === 0) return '0 銅'
  const sign = cc < 0 ? '-' : ''
  let rest = Math.abs(Math.round(cc))
  const parts: string[] = []
  for (const unit of UNITS) {
    const n = Math.floor(rest / unit.value)
    rest -= n * unit.value
    if (n > 0) parts.push(`${n} ${unit.short}`)
  }
  return sign + parts.join(' ')
}
