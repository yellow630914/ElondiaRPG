import { describe, expect, it } from 'vitest'
import { auctionBlocked, auctionLots, consign, consignable, placeBid } from '@/engine/auction'
import { lewdRules } from '@/engine/data'
import { travelEvents } from '@/engine/road'
import { enterLocation, getArea, placeAt, standOn } from '@/engine/grid'
import { equipItem } from '@/engine/inventory'
import { lewdOf } from '@/engine/lewd'
import { orderOutfit, outfitOrder, outfitTailorHere } from '@/engine/outfitTailor'
import { pcOf } from '@/engine/party'
import { adultOutfitPieces, outfitCombat, outfitModifiers } from '@/engine/schools'
import { addItem, newGame } from '@/engine/state'
import { hasFlag } from '@/engine/storyFlags'
import { townCandidates } from '@/engine/townEvents'
import type { GameState } from '@/engine/types'

function game(location = 'albena'): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 5, birthplace: location })
  enterLocation(state)
  state.money_cc = 100000
  return state
}

describe('淫服的雙面效應', () => {
  it('平常和貴族、神職打交道比較難（每件 -1，最多 -2，忍耐減輕）；戰鬥中縱欲派每件加魅惑傷害', () => {
    const state = game()
    const pc = pcOf(state)
    addItem(state.inventory, '亞麻兔女郎裝', 1)
    addItem(state.inventory, '絲綢網襪', 1)
    equipItem(state, '亞麻兔女郎裝', pc.id)
    expect(adultOutfitPieces(pc)).toBe(1)
    const ctx = { context: 'action' as const, kind: 'chat' as const, attr: 'cha' as const, vsTags: ['noble'] }
    expect(outfitModifiers(pc, ctx)).toEqual([{ label: '淫服（1 件）', value: -1 }])
    expect(outfitModifiers(pc, { ...ctx, vsTags: ['commoner'] })).toEqual([])
    pc.lewd = { ...lewdOf(pc), endurance: 40 }
    expect(outfitModifiers(pc, ctx)).toEqual([])
    expect(outfitCombat(pc).lustBonus).toBe(0)
    pc.perks = [...(pc.perks ?? []), 'school_indulgence']
    expect(outfitCombat(pc).lustBonus).toBe(1)
  })
})

describe('淫服裁縫鋪', () => {
  it('魅氣濃的城鎮的裁縫店可以訂做帶指標加成的淫服', () => {
    const state = game()
    standOn(state, 'tailor')
    expect(outfitTailorHere(state)).toBe(true)
    const o = outfitOrder('bunny_suit', 'moonsilk', 'lewdness')
    expect(o.bonus).toBe(8)
    const money = state.money_cc
    orderOutfit(state, 'bunny_suit', 'moonsilk', 'lewdness')
    expect(state.money_cc).toBe(money - o.price)
    const name = Object.keys(state.customItems ?? {}).find((n) => n.startsWith('訂做的'))!
    expect(state.customItems![name]!.gear?.lewd).toEqual({ lewdness: 8 })
    const other = game('rhineburg')
    standOn(other, 'tailor')
    expect(outfitTailorHere(other)).toBe(false)
  })
})

describe('拍賣會', () => {
  function atAuction() {
    const state = game()
    placeAt(state, getArea(state, 'albena/market'), 7, 1)
    return state
  }
  it('每天固定的拍品；出價不夠被別人標走，夠了就得標、付對手的最高價多一口', () => {
    const state = atAuction()
    expect(auctionBlocked(state)).toBeUndefined()
    const lots = auctionLots(state)
    expect(lots).toHaveLength(lewdRules.auction.lots)
    expect(auctionLots(state)).toEqual(lots)
    placeBid(state, 0, lots[0]!.start)
    expect(state.auction!.lots[0]!.lost || state.auction!.lots[0]!.won !== undefined).toBe(true)
    const money = state.money_cc
    placeBid(state, 1, 99999)
    const won = state.auction!.lots[1]!.won!
    expect(won).toBeGreaterThan(state.auction!.lots[1]!.rival)
    expect(state.money_cc).toBe(money - won)
    expect(state.inventory.some((i) => i.name === lots[1]!.name)).toBe(true)
    expect(() => placeBid(state, 1, 99999)).toThrow('出過價')
  })

  it('寄賣成人向的物品與色情技能書；得標後可能被盯上（城鎮事件）', () => {
    const state = atAuction()
    addItem(state.inventory, '《媚術入門》', 1)
    expect(consignable(state)).toContain('《媚術入門》')
    const money = state.money_cc
    consign(state, '《媚術入門》')
    expect(state.money_cc).toBeGreaterThan(money)
    state.flags['story:auction_watched'] = true
    expect(hasFlag(state, 'auction_watched')).toBe(true)
    standOn(state, 'gate')
    expect(townCandidates(state, getArea(state, state.position!.area), 'gate').map((t) => t.id)).toContain('town_auction_watched')
  })
})

describe('園區的事件與寶箱', () => {
  it('每個園區有專屬的地下城事件，寶箱有成人向服裝', () => {
    for (const park of ['park_beast', 'park_insect', 'park_aquarium', 'park_garden', 'park_theater']) {
      expect(travelEvents.templates.some((t) => t.scope === 'dungeon' && t.dungeons?.includes(park)), park).toBe(true)
    }
    const names = lewdRules.park.chest_items.map(([n]) => n)
    expect(names).toEqual(expect.arrayContaining(['牧場的乳牛裝', '劇場的舞孃薄紗']))
  })
})
