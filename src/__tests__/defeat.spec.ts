import { afterEach, describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { finishCombat, startCombat } from '@/engine/combat'
import { setAdultContent } from '@/engine/content'
import { combatRules } from '@/engine/data'
import { defeatEventFoes, skipDefeatEvent } from '@/engine/defeat'
import { afterCombat, currentArea, goOutskirts } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { newGame, withRng } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'
import { composeNarration } from '@/narrator/compose'
import { loreItems, type Worldbook } from '@/narrator/lore'
import { defaultPromptConfig } from '@/narrator/promptConfig'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const rules = combatRules.defeat_event
const dc = rules.check.dc

afterEach(() => {
  setAdultContent(false)
  rules.check.dc = dc
})

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 7 })
  goOutskirts(state)
  return state
}

/** 和一個惡人打輸（敵人還站著） */
function lose(state: GameState, tags = ['villain']): Report {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { tags, level: 1, location: state.location }))
  startCombat(state, [], { npcs: [rec.id] })
  for (const c of state.combat!.combatants) if (c.side === 'party') c.hp = 0
  state.combat!.status = 'defeat'
  const report = finishCombat(state)
  afterCombat(state, report)
  expect(validate(report), JSON.stringify(validate.errors)).toBe(true)
  return report
}

describe('defeat event', () => {
  it('stops the report right before the villains act and waits for the player', () => {
    setAdultContent(true)
    rules.check.dc = -100
    const state = game()
    const area = currentArea(state).key
    const report = lose(state)
    expect(state.pendingDefeat?.report).toBe(report.report_id)
    expect(report.narration?.mode).toBe('defeat_cliffhanger')
    expect(report.outcome.tags).toContain('戰敗事件')
    // 還沒離開近郊；其他行動要先應付眼前的處境
    expect(currentArea(state).key).toBe(area)
    expect(() => prepareAction(state, { kind: 'free', text: '逃跑' })).toThrow('眼前的處境')

    const options = { config: defaultPromptConfig(), lore: loreItems(worldbook as unknown as Worldbook, {}, []), adult: true, budgetChars: 20000, language: 'zh-Hant' as const }
    const prompt = composeNarration(state, report, options).prompt
    expect(prompt.system).toContain('<defeat_event>')
    expect(prompt.user).toContain('戰敗事件的前半段')

    const money = state.money_cc
    prepareAction(state, { kind: 'defeat_event', target: 'opt:1', text: rules.options[1]!.label })
    state.pendingAction!.natural = 1
    const after = resolveAction(state, null)
    expect(validate(after), JSON.stringify(validate.errors)).toBe(true)
    expect(after.check?.attr).toBe('str')
    expect(after.check?.degree).toBe('fumble')
    expect(after.narration?.mode).toBe('defeat_event')
    expect(state.money_cc).toBe(money - Math.floor(money * rules.money_loss.fumble))
    expect(state.party[0]!.status).toContain('shaken')
    expect(state.pendingDefeat).toBeUndefined()
    // 和一般戰敗一樣：回到城門
    expect(currentArea(state).kind).toBe('settlement')
    expect(composeNarration(state, after, options).prompt.user).toContain('戰敗事件的後半段')
  })

  it('needs the adult setting, a matching enemy and a passed charisma check', () => {
    rules.check.dc = -100
    const off = game()
    lose(off)
    expect(off.pendingDefeat).toBeUndefined()
    expect(currentArea(off).kind).toBe('settlement')

    setAdultContent(true)
    const plain = game()
    lose(plain, ['merchant'])
    expect(plain.pendingDefeat).toBeUndefined()

    rules.check.dc = 999
    const unlucky = game()
    const r = lose(unlucky)
    expect(unlucky.pendingDefeat).toBeUndefined()
    expect(r.timeline!.at(-1)!.action).toContain('魅力')
  })

  it('counts monsters in rut but never young ones', () => {
    const state = game()
    const foe = (traits: string[]) => ({ name: '哥布林', traits, hp: 5, side: 'enemy' })
    expect(defeatEventFoes(state, [foe(['rut'])])).toHaveLength(1)
    expect(defeatEventFoes(state, [foe(['rut', 'young'])])).toHaveLength(0)
    expect(defeatEventFoes(state, [foe(['huge'])])).toHaveLength(0)
    expect(defeatEventFoes(state, [{ ...foe(['rut']), hp: 0 }])).toHaveLength(0)
  })

  it('can be skipped when the adult setting is turned off afterwards', () => {
    setAdultContent(true)
    rules.check.dc = -100
    const state = game()
    lose(state)
    expect(state.pendingDefeat).toBeDefined()
    skipDefeatEvent(state)
    expect(state.pendingDefeat).toBeUndefined()
    expect(currentArea(state).kind).toBe('settlement')
  })
})
