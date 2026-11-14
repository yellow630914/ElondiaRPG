// 繁轉簡：當鏈子用的「鍊」轉成「链」，冶煉、修練的轉成「炼」（engine/chainChar.ts）
import { describe, expect, it } from 'vitest'
import { toSimplifiedText } from '@/engine/script'
import { toSimplifiedUi } from '@/i18n/uiScript'

const CASES: [string, string][] = [
  ['鍊甲', '链甲'], ['鋼鍊甲', '钢链甲'], ['隕鍊甲', '陨链甲'], ['比鍊甲硬', '比链甲硬'], ['舊鍊甲', '旧链甲'],
  ['腳鍊', '脚链'], ['步鍊', '步链'], ['細鍊', '细链'], ['腰鍊', '腰链'], ['胸鍊', '胸链'], ['身體鍊', '身体链'],
  ['腿鍊', '腿链'], ['鈴鍊', '铃链'], ['短鍊', '短链'], ['額鍊', '额链'], ['頸鍊', '颈链'], ['項鍊', '项链'],
  ['鍊子', '链子'], ['鐵鍊', '铁链'], ['拉鍊', '拉链'], ['金鍊甲', '金链甲'], ['項鍊金扣', '项链金扣'],
  ['鍊金術', '炼金术'], ['請鍊金師', '请炼金师'], ['鍛鍊', '锻炼'], ['鍛鍊法', '锻炼法'], ['淬鍊', '淬炼'], ['鍊成', '炼成'],
]

describe('繁轉簡的「鍊」', () => {
  it.each(CASES)('%s → %s', (t, s) => {
    expect(toSimplifiedText(t)).toBe(s)
    expect(toSimplifiedUi(t)).toBe(s)
  })
})
