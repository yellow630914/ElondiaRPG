import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { finishCombat } from '@/engine/combat'
import { stories } from '@/engine/data'
import { afterCombat, currentArea, enterLocation, goOutskirts, moveTo, standOn } from '@/engine/grid'
import { addIntel } from '@/engine/intel'
import { newGame } from '@/engine/state'
import { storyIssues } from '@/engine/storyMods'
import { buyDeal, shopState } from '@/engine/trade'
import type { GameState, Report } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const valid = (r: Report) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true)

function game(): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
  enterLocation(state)
  state.money_cc = 20000
  return state
}

/** 站到這一區某一格的旁邊再走進去 */
function stepOnto(state: GameState, i: number) {
  const area = currentArea(state)
  const x = i % area.width
  const y = Math.floor(i / area.width)
  const from = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].find(([fx, fy]) => {
    const c = area.cells[fy! * area.width + fx!]
    return fx! >= 0 && fy! >= 0 && fx! < area.width && fy! < area.height && c && c.kind !== 'wall' && c.kind !== 'water'
  })!
  state.position = { area: area.key, x: from[0]!, y: from[1]! }
  return moveTo(state, x, y)
}

describe('informant intel', () => {
  it('puts a hostile lair in the outskirts that pays a bounty when cleared', () => {
    const state = game()
    const it0 = addIntel(state, { kind: 'point', title: '近郊的狼窩', text: '', location: 'soriel', event: 'combat', group: [['wolf', 2]], level: 2, until: state.time.day + 5 })
    standOn(state, 'gate')
    goOutskirts(state)
    const area = currentArea(state)
    const i = area.cells.findIndex((c) => c.intel === it0.id)
    expect(area.cells[i]?.kind).toBe('elite')
    const r = stepOnto(state, i)
    expect(r.combat).toBeDefined()
    for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
    state.combat!.status = 'victory'
    const money = state.money_cc
    const rep = finishCombat(state)
    valid(rep)
    afterCombat(state, rep)
    expect(rep.outcome.tags).toContain('情報')
    expect(state.money_cc).toBeGreaterThanOrEqual(money + 80)
    expect(it0.status).toBe('done')
  })

  it('puts a treasure in a dungeon layer and a wandering merchant with rare gear', () => {
    const state = game()
    const chest = addIntel(state, { kind: 'point', title: '藏寶處', text: '', location: 'whisper_crypt', layer: 'outskirts', event: 'chest', level: 4, until: state.time.day + 5 })
    const shop = addIntel(state, { kind: 'point', title: '流浪商人', text: '', location: 'whisper_crypt', layer: 'outskirts', event: 'merchant', until: state.time.day + 3 })
    state.location = 'whisper_crypt'
    enterLocation(state)
    const area = currentArea(state)
    const ci = area.cells.findIndex((c) => c.intel === chest.id)
    expect(area.cells[ci]?.kind).toBe('chest')
    const r = stepOnto(state, ci)
    valid(r.report!)
    expect(chest.status).toBe('done')
    const mi = area.cells.findIndex((c) => c.intel === shop.id)
    expect(area.cells[mi]?.kind).toBe('merchant')
    stepOnto(state, mi)
    const deals = shopState(state, 'wanderer').deals
    expect(deals.filter((d) => state.customItems?.[d.title]).length).toBeGreaterThanOrEqual(3)
    // 過期之後重新進入就沒有了
    state.time.day += 10
    enterLocation(state)
    expect(currentArea(state).cells.some((c) => c.intel === shop.id)).toBe(false)
    expect(shop.status).toBe('expired')
  })

  it('sells the news that starts a special quest', () => {
    const state = game()
    const def = stories.find((s) => s.id === 'smuggler_ledger')!
    expect(storyIssues(def)).toEqual([])
    standOn(state, 'informant')
    const deal = shopState(state, 'informant').deals.find((d) => d.id === 'info:story:smuggler_ledger')!
    expect(deal).toBeDefined()
    const r = buyDeal(state, 'informant', deal.id)
    valid(r)
    expect(state.stories?.smuggler_ledger?.status).toBe('active')
    expect(state.intel?.some((it) => it.kind === 'story' && it.story === 'smuggler_ledger')).toBe(true)
    // 買過就不會再賣
    state.time.day += 1
    expect(shopState(state, 'informant').deals.some((d) => d.id === 'info:story:smuggler_ledger')).toBe(false)
  })
})
