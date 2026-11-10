// 主角擁有的奴隸（ownedSlaves.ts；工具列「奴隸」）
import { describe, expect, it } from 'vitest'
import { sendHome } from '@/engine/away'
import { buySlave, marketStock } from '@/engine/companions'
import { enterLocation, getArea, placeAt } from '@/engine/grid'
import { buyHome, lotsOf } from '@/engine/homes'
import { isOwnSlave, ownedSlaves } from '@/engine/ownedSlaves'
import { ensureRoster, isHostile } from '@/engine/population'
import { pcOf } from '@/engine/party'
import { newGame } from '@/engine/state'

describe('主角擁有的奴隸', () => {
  it('列出隊伍裡的奴隸；送回房子的也列出來，寫在哪裡', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11, birthplace: 'albena' })
    enterLocation(state)
    ensureRoster(state, 'albena')
    expect(ownedSlaves(state)).toEqual([])
    const l = marketStock(state, 'public')[0]!
    state.money_cc = l.price_cc + 10_000_000
    buySlave(state, 'public', l.npc)
    const slave = state.party.find((m) => m.id === l.npc)!
    expect(isOwnSlave(state, slave)).toBe(true)
    expect(isOwnSlave(state, pcOf(state))).toBe(false)
    expect(ownedSlaves(state)).toEqual([{ member: slave, inParty: true }])

    const lot = lotsOf('albena')[0]!
    placeAt(state, getArea(state, lot.area), lot.x, lot.y)
    buyHome(state, lot.id)
    const home = Object.values(state.homes!).find((h) => h.location === 'albena' && !h.master)!
    sendHome(state, home.id, slave.id)
    const list = ownedSlaves(state)
    expect(list).toHaveLength(1)
    expect(list[0]!.inParty).toBe(false)
    expect(list[0]!.member.id).toBe(slave.id)
    expect(list[0]!.where).toContain(home.name)

    // 惡人、以前打過的奴隸送回家：在房子裡（不是聚落）也不顯示敵對，可以照常互動
    const rec = state.npcs![slave.id]!
    rec.tags = [...(rec.tags ?? []), 'villain']
    rec.hostile = true
    expect(isHostile(state, rec, 'home')).toBe(false)
    expect(isHostile(state, rec, 'wild')).toBe(false)
  })
})
