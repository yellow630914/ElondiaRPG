import { describe, expect, it } from 'vitest'
import { enterLocation, move, standOn } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { answerRoadEvent, roadEventFits, startJourney, travelEvents } from '@/engine/road'
import { newGame } from '@/engine/state'
import { condMet } from '@/engine/storyFlags'
import { sanitizeCond } from '@/engine/mods'
import type { GameState } from '@/engine/types'

const S9 = ['rd_slaver_patrol', 'rd_peddler_cart', 'rd_hot_spring', 'rd_lust_shrine', 'rd_bound_caravan', 'rd_rut_pack', 'rd_noble_host', 'rd_priest_confession']
const tpl = (id: string) => travelEvents.templates.find((t) => t.id === id)!

function game(tags: string[] = []): GameState {
  const state = newGame({ name: '艾琳', race: 'human', classId: 'rogue', seed: 4, birthplace: 'rhineburg', gender: '女', body: 'fem' })
  enterLocation(state)
  pcOf(state).tags = tags
  return state
}

describe('S9-5 旅途事件', () => {
  it('8 件，至少 4 件不標「主角非自願」', () => {
    const list = S9.map(tpl)
    expect(list.every(Boolean)).toBe(true)
    expect(list.filter((t) => !t.tags?.includes('pc_unwilling')).length).toBeGreaterThanOrEqual(4)
  })

  it('旅途事件可以限定地區（這一段路要去的地區）', () => {
    const state = game()
    expect(roadEventFits(state, tpl('rd_lust_shrine'), 'road', 'south')).toBe(true)
    expect(roadEventFits(state, tpl('rd_lust_shrine'), 'road', 'central')).toBe(false)
    expect(roadEventFits(state, tpl('rd_slaver_patrol'), 'trail', 'west')).toBe(true)
    expect(roadEventFits(state, tpl('rd_slaver_patrol'), 'sea', 'west')).toBe(false)
  })

  it('主角的身分標籤當條件：貴族才有鄉紳的款待，神官才有路邊的告解', () => {
    expect(roadEventFits(game(), tpl('rd_noble_host'), 'road', 'central')).toBe(false)
    expect(roadEventFits(game(['noble']), tpl('rd_noble_host'), 'road', 'central')).toBe(true)
    expect(roadEventFits(game(['royal']), tpl('rd_noble_host'), 'road', 'central')).toBe(true)
    expect(roadEventFits(game(['priest']), tpl('rd_priest_confession'), 'road', 'central')).toBe(true)
    expect(condMet(game(['merchant']), { pc_tags: ['priest', 'bishop'] })).toBe(false)
    expect(sanitizeCond({ pc_tags: ['noble', 'nope', 'noble'] } as never)).toEqual({ pc_tags: ['noble'] })
  })

  it('選了屈服的選項，經過交給成人場景的寫手', () => {
    const state = game()
    standOn(state, 'gate')
    state.inventory.push({ name: '乾糧', qty: 20 })
    startJourney(state, 'rivervale')
    move(state, 1, 0)
    state.roadEvent = { x: state.position!.x, template: 'rd_hot_spring' }
    const r = answerRoadEvent(state, 2)
    expect(r.narration?.adult_scene).toBe(tpl('rd_hot_spring').scene)
    state.roadEvent = { x: state.position!.x, template: 'rd_hot_spring' }
    expect(answerRoadEvent(state, 1).narration?.adult_scene).toBeUndefined()
  })
})
