import { afterEach, describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { finishCombat, startCombat } from '@/engine/combat'
import { combatRules } from '@/engine/data'
import { setDefeatAdult, setDefeatCompanion } from '@/engine/content'
import { defeatEventAllowed, defeatVictim } from '@/engine/defeat'
import { lewdOf } from '@/engine/lewd'
import { afterCombat, currentArea, goOutskirts } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { newGame, withRng } from '@/engine/state'
import type { Character, GameState, Report } from '@/engine/types'
import { buildActionPrompt } from '@/narrator/judge'
import { composeNarration } from '@/narrator/compose'
import { loreItems, type Worldbook } from '@/narrator/lore'
import { defaultPromptConfig } from '@/narrator/promptConfig'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const rules = combatRules.defeat_event
const dc = rules.check.dc

afterEach(() => {
  rules.check.dc = dc
  setDefeatAdult('all')
  setDefeatCompanion('not_masc')
})

/** 男性形象的主角（設定成男性主角不發生），帶著一位隊友 */
function game(mateBody: Character['body'] = 'fem', cha = 16): { state: GameState; mate: Character } {
  setDefeatAdult('not_masc')
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 7 })
  state.party[0]!.body = 'masc'
  goOutskirts(state)
  const mate = recruit(state, mateBody, cha)
  return { state, mate }
}

function recruit(state: GameState, body: Character['body'], cha: number, cls = 'fighter'): Character {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, class: cls }))
  const m = joinParty(state, rec, 'hired')
  m.body = body
  m.attrs = { ...m.attrs, cha }
  return m
}

/** 和一個惡人打輸（敵人還站著） */
function lose(state: GameState): Report {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { tags: ['villain'], level: 1, location: state.location, class: 'fighter' }))
  startCombat(state, [], { npcs: [rec.id] })
  for (const c of state.combat!.combatants) if (c.side === 'party') c.hp = 0
  state.combat!.status = 'defeat'
  const report = finishCombat(state)
  afterCombat(state, report)
  expect(validate(report), JSON.stringify(validate.errors)).toBe(true)
  return report
}

const options = () => ({ config: defaultPromptConfig(), lore: loreItems(worldbook as unknown as Worldbook, {}, []), budgetChars: 20000, language: 'zh-Hant' as const })

describe('companion defeat event', () => {
  it('happens to a companion when the protagonist is excluded, and the player answers for her', () => {
    rules.check.dc = -100
    const { state, mate } = game()
    const report = lose(state)
    expect(state.pendingDefeat?.victim).toBe(mate.id)
    expect(report.narration?.defeat_victim).toBe(mate.id)
    expect(report.narration?.focus?.join()).toContain(mate.name)
    expect(report.outcome.summary).toContain(mate.name)
    // 起意的檢定是隊友擲的
    expect(report.timeline!.at(-1)!.actor).toBe(mate.id)
    const cliff = composeNarration(state, report, options()).prompt
    expect(cliff.system).toContain(`被敵人圍住的是隊友${mate.name}`)

    // 玩家替隊友選「拚盡最後的力氣掙扎」：隊友擲骰
    const p = prepareAction(state, { kind: 'defeat_event', target: 'opt:1', text: rules.options[1]!.label })
    expect(p.actor).toBe(mate.id)
    expect(p.scene).toContain(mate.name)
    const judge = buildActionPrompt(state, p, '', { narrative: true })
    expect(judge.user).toContain('<defeat_victim>')
    expect(judge.system).toContain(`被敵人圍住的是隊友${mate.name}`)

    const pc = state.party[0]!
    const pcLewd = lewdOf(pc)
    const mateLewd = lewdOf(mate)
    p.natural = 1
    const after = resolveAction(state, null)
    expect(validate(after), JSON.stringify(validate.errors)).toBe(true)
    expect(after.check?.degree).toBe('fumble')
    expect(after.timeline![0]!.actor).toBe(mate.id)
    expect(after.narration?.defeat_victim).toBe(mate.id)
    expect(after.narration?.adult_actor).toBe(mate.id)
    // 結果記在隊友身上，主角不受影響
    expect(mate.status).toContain('shaken')
    expect(pc.status).not.toContain('shaken')
    expect(lewdOf(mate).submission).toBeGreaterThan(mateLewd.submission)
    expect(lewdOf(pc)).toEqual(pcLewd)
    // 武鬥型（預設）的「精疲力竭」也給隊友
    expect(mate.status).toContain('drained')
    expect(pc.status).not.toContain('drained')
    expect(state.pendingDefeat).toBeUndefined()
    expect(currentArea(state).kind).toBe('settlement')
    expect(composeNarration(state, after, options()).prompt.user).toContain(`依${mate.name}的反應`)
  })

  it('keeps happening to the protagonist when the protagonist is allowed', () => {
    rules.check.dc = -100
    const { state } = game()
    setDefeatAdult('all')
    lose(state)
    expect(state.pendingDefeat).toBeDefined()
    expect(state.pendingDefeat!.victim).toBeUndefined()
  })

  it('follows its own setting: off, not for masculine companions, or everyone', () => {
    const { state, mate } = game('masc')
    expect(defeatVictim(state)).toBeUndefined()
    setDefeatCompanion('all')
    expect(defeatVictim(state)?.id).toBe(mate.id)
    setDefeatCompanion('off')
    const { state: fem } = game('fem')
    setDefeatCompanion('off')
    expect(defeatVictim(fem)).toBeUndefined()
    rules.check.dc = -100
    lose(fem)
    expect(fem.pendingDefeat).toBeUndefined()
  })

  it('picks the most charismatic companion who is still there', () => {
    const { state, mate } = game('fem', 12)
    const star = recruit(state, 'andro', 18)
    expect(defeatVictim(state)?.id).toBe(star.id)
    star.status.push('away')
    expect(defeatVictim(state)?.id).toBe(mate.id)
  })

  it('can be skipped when the companion setting is turned off while waiting', () => {
    rules.check.dc = -100
    const { state } = game()
    lose(state)
    expect(defeatEventAllowed(state)).toBe(true)
    setDefeatCompanion('off')
    expect(defeatEventAllowed(state)).toBe(false)
  })
})
