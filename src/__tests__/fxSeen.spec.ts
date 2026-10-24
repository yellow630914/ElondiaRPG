import { describe, expect, it } from 'vitest'
import { freshKeys, isFreshReport, lastSeen, stateKey } from '@/fx/seen'
import type { GameState } from '@/engine/types'

describe('特效只在剛發生時播', () => {
  it('lastSeen 第一次沒有舊值，之後回傳上一次的值', () => {
    expect(lastSeen('t:a', 1)).toBeUndefined()
    expect(lastSeen('t:a', 2)).toBe(1)
  })

  it('freshKeys 第一次全部算看過，之後只回傳新出現的', () => {
    expect([...freshKeys('t:list', ['a', 'b'])]).toEqual([])
    expect([...freshKeys('t:list', ['a', 'b', 'c'])]).toEqual(['c'])
    expect([...freshKeys('t:list', ['a', 'c'])]).toEqual([])
  })

  it('讀檔時已有的日誌不算新的，新的日誌只算一次', () => {
    const state = { reports: [{ report_id: 'r1' }] } as unknown as GameState
    expect(isFreshReport(state, 'r1')).toBe(false)
    expect(isFreshReport(state, 'r2')).toBe(true)
    expect(isFreshReport(state, 'r2')).toBe(false)
  })

  it('每個載入的遊戲狀態有自己的編號', () => {
    const a = {} as GameState
    const b = {} as GameState
    expect(stateKey(a)).toBe(stateKey(a))
    expect(stateKey(a)).not.toBe(stateKey(b))
  })
})
