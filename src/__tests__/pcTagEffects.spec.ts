import { describe, expect, it } from 'vitest'
import { protagonistText } from '@/engine/character'
import { startCombat, defenseMult } from '@/engine/combat'
import { enterLocation, standOn } from '@/engine/grid'
import { addLewd } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { checkModifiers } from '@/engine/perks'
import { pcTagEffectLines, pcTagMult } from '@/engine/pcTags'
import { newGame } from '@/engine/state'
import { dealMoney, sellPrice, shopKey, shopState } from '@/engine/trade'
import type { GameState } from '@/engine/types'

function game(tags: string[]): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg', tags })
  enterLocation(state)
  return state
}

describe('主角身分標籤的效果（I10）', () => {
  it('檢定：貴族和貴族打交道比較容易，惡人威嚇比較有力、和好人處不來', () => {
    const noble = pcOf(game(['noble']))
    expect(checkModifiers(noble, { context: 'action', kind: 'chat', attr: 'cha', vsTags: ['noble'] })).toContainEqual({ label: '身分【貴族】', value: 2 })
    expect(checkModifiers(noble, { context: 'action', kind: 'chat', attr: 'cha', vsTags: ['commoner'] }).some((m) => m.label.startsWith('身分'))).toBe(false)
    const villain = pcOf(game(['villain']))
    expect(checkModifiers(villain, { context: 'action', kind: 'intimidate', attr: 'str' })).toContainEqual({ label: '身分【惡人】', value: 2 })
    expect(checkModifiers(villain, { context: 'action', kind: 'gift', attr: 'cha', vsTags: ['good'] })).toContainEqual({ label: '身分【惡人】', value: -2 })
    expect(checkModifiers(pcOf(game(['traveler'])), { context: 'road', attr: 'int' })).toContainEqual({ label: '身分【旅人】', value: 2 })
  })

  it('價格：商人買得便宜、賣得貴；貴族被喊高價；神官的神殿服務打折', () => {
    const price = (tags: string[], type: 'general' | 'temple') => {
      const state = game(tags)
      standOn(state, type === 'general' ? 'shop' : 'temple')
      const money = (d: { gives: { type: string; amount?: number }[] }) => d.gives.find((g) => g.type === 'money')?.amount ?? 0
      const deal = [...shopState(state, type).deals].sort((x, y) => money(y) - money(x))[0]!
      return { buy: dealMoney(state, shopKey(state, type), deal), state }
    }
    const plain = price([], 'general').buy
    expect(price(['merchant'], 'general').buy).toBeLessThan(plain)
    expect(price(['noble'], 'general').buy).toBeGreaterThan(plain)
    expect(price(['priest'], 'temple').buy).toBeLessThan(price([], 'temple').buy)
    const a = game([])
    const m = game(['merchant'])
    for (const s of [a, m]) standOn(s, 'shop')
    expect(sellPrice(m, shopKey(m, 'general'), '乾糧')!).toBeGreaterThanOrEqual(sellPrice(a, shopKey(a, 'general'), '乾糧')!)
  })

  it('成人向：貴族的曝露名聲累積得快、平民慢；神職的人比較不受魅惑；被賣時的身價', () => {
    const noble = game(['noble'])
    expect(addLewd(noble, pcOf(noble), 'exposure', 2)).toBe(3)
    const commoner = game(['commoner'])
    let sum = 0
    for (let i = 0; i < 4; i++) sum += addLewd(commoner, pcOf(commoner), 'exposure', 1)
    expect(sum).toBe(3)
    const bishop = game(['bishop'])
    const me = startCombat(bishop, [['goblin', 1]]).combatants.find((c) => c.id === pcOf(bishop).id)!
    const plain = game([])
    const me2 = startCombat(plain, [['goblin', 1]]).combatants.find((c) => c.id === pcOf(plain).id)!
    expect(defenseMult(me, 'lust')).toBeLessThan(defenseMult(me2, 'lust'))
    expect(pcTagMult(pcOf(game(['royal'])), 'slave_price_mult')).toBe(2)
  })

  it('交給 AI 的主角資料寫出身分；建角時看得到效果', () => {
    expect(protagonistText(pcOf(game(['noble', 'merchant'])))).toContain('身分：貴族（')
    expect(pcTagEffectLines('merchant').join('、')).toContain('商店買價 −5%')
    expect(pcTagEffectLines('royal')[0]).toContain('不必聲望')
  })
})
