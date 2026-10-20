import { afterEach, describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { finishCombat, startCombat } from '@/engine/combat'
import { setAdultContent } from '@/engine/content'
import { combatRules, slaveryRules } from '@/engine/data'
import { afterCombat, enterLocation, goOutskirts, standOn } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { ensureRoster } from '@/engine/population'
import { answerMasterEvent, masterCandidates, startAsSlave, startMasterEvent } from '@/engine/slavery'
import { newGame, withRng } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'
import { composeJudge, composeNarration } from '@/narrator/compose'
import { loreItems, type Worldbook } from '@/narrator/lore'
import { defaultPromptConfig } from '@/narrator/promptConfig'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const defeatDc = combatRules.defeat_event.check.dc

afterEach(() => {
  setAdultContent(false)
  combatRules.defeat_event.check.dc = defeatDc
})

function options(adult = true) {
  return { config: defaultPromptConfig(), lore: loreItems(worldbook as unknown as Worldbook, {}, []), adult, budgetChars: 20000, language: 'zh-Hant' as const }
}

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' })
  enterLocation(state)
  ensureRoster(state, 'soriel')
  return state
}

function act(state: GameState, input: Parameters<typeof prepareAction>[1], natural: number, judgment: unknown = null) {
  prepareAction(state, input)
  state.pendingAction!.natural = natural
  const r = resolveAction(state, judgment ? sanitizeJudgment(state, state.pendingAction!, judgment) : null)
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return r
}

function slave(): GameState {
  const state = game()
  const [rec] = masterCandidates('soriel', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  return state
}

function answer(state: GameState, event: string, option: number): Report {
  startMasterEvent(state, slaveryRules.master_events.events.find((e) => e.id === event)!)
  const r = answerMasterEvent(state, option)
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return r
}

describe('adult scenes', () => {
  it('asks the narrator to describe a brothel visit in detail', () => {
    setAdultContent(true)
    const state = game()
    standOn(state, 'brothel')
    state.money_cc = 100
    const r = act(state, { kind: 'patron', text: '' }, 20)
    expect(r.narration?.adult_scene).toContain('娼館')
    expect(r.narration?.length).toBe('medium')
    const prompt = composeNarration(state, r, options()).prompt
    expect(prompt.system).toContain('<adult_scene>')
    expect(prompt.user).toContain('成人場景：在娼館')
    expect(prompt.user).toContain('約 500～900 字')
    // 之後關閉成人向，重新生成時不附上
    const off = composeNarration(state, r, options(false)).prompt
    expect(off.system).not.toContain('<adult_scene>')
    expect(off.user).not.toContain('成人場景')
  })

  it('marks brothel work but not other jobs, and nothing with the adult setting off', () => {
    setAdultContent(true)
    const state = game()
    standOn(state, 'brothel')
    expect(act(state, { kind: 'work', target: '4', text: '' }, 15).narration?.adult_scene).toContain('接客')
    standOn(state, 'tavern')
    expect(act(state, { kind: 'work', target: '4', text: '' }, 15).narration?.adult_scene).toBeUndefined()
    setAdultContent(false)
    standOn(state, 'brothel')
    expect(act(state, { kind: 'work', target: '4', text: '' }, 15).narration?.adult_scene).toBeUndefined()
  })

  it('follows the answer to the master: accepting the proposition or failing to refuse the brothel', () => {
    setAdultContent(true)
    const yes = answer(slave(), 'proposition', 0)
    expect(yes.narration?.adult_scene).toMatch(/^陪.+過夜$/)
    expect(composeNarration(null, yes, options()).prompt.system).toContain('<adult_scene>')
    // 拒絕的回應：不論成敗都沒有場景
    expect(answer(slave(), 'proposition', 2).narration?.adult_scene).toBeUndefined()
    // 哀求主人：失敗時還是被推進娼館
    const plea = answer(slave(), 'brothel_forced', 1)
    expect(plea.narration?.adult_scene === undefined).toBe(plea.outcome.result === 'success')
    expect(answer(slave(), 'brothel_forced', 0).narration?.adult_scene).toContain('娼館接客')
  })

  it('lets the AI judge flag a scene in a free response or action, only with the adult setting on', () => {
    setAdultContent(true)
    const state = slave()
    startMasterEvent(state, slaveryRules.master_events.events.find((e) => e.id === 'proposition')!)
    prepareAction(state, { kind: 'master_event', text: '紅著臉點頭' })
    const judge = composeJudge(state, state.pendingAction!, options()).prompt
    expect(judge.system).toContain('adult_scene')
    expect(judge.system).toContain('<adult_scene>')
    expect(judge.user).toContain('依主角的回應與你的判定決定是否進入')
    const r = resolveAction(state, sanitizeJudgment(state, state.pendingAction!, { degree: 'success', attr: 'cha', dc: 12, adult_scene: '答應了主人，陪他過夜' }))
    expect(r.narration?.adult_scene).toBe('答應了主人，陪他過夜')

    const free = game()
    expect(act(free, { kind: 'free', text: '在河邊散步' }, 12, { degree: 'success', attr: 'cha', dc: 12 }).narration?.adult_scene).toBeUndefined()
    setAdultContent(false)
    expect(composeJudge(free, prepareAction(free, { kind: 'free', text: '散步' }), options(false)).prompt.system).not.toContain('adult_scene')
    expect(sanitizeJudgment(free, free.pendingAction!, { degree: 'success', attr: 'cha', dc: 12, adult_scene: '親密場景' }).adult_scene).toBeUndefined()
  })

  it('describes the defeat event in detail only when the hero fails to get away', () => {
    setAdultContent(true)
    combatRules.defeat_event.check.dc = -100
    const respond = (natural: number) => {
      const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 7 })
      goOutskirts(state)
      const rec = withRng(state, (rng) => generateNpc(state, rng, { tags: ['villain'], level: 1, location: state.location }))
      startCombat(state, [], { npcs: [rec.id] })
      for (const c of state.combat!.combatants) if (c.side === 'party') c.hp = 0
      state.combat!.status = 'defeat'
      const report = finishCombat(state)
      afterCombat(state, report)
      // 前半段停在動手前：還沒有場景
      expect(report.narration?.adult_scene).toBeUndefined()
      return act(state, { kind: 'defeat_event', target: 'opt:0', text: '' }, natural)
    }
    const caught = respond(1)
    expect(caught.check?.degree).toBe('fumble')
    expect(caught.narration?.adult_scene).toContain('手中')
    expect(composeNarration(null, caught, options()).prompt.system).toContain('<adult_scene>')
    const away = respond(20)
    expect(away.check?.degree).toBe('critical')
    expect(away.narration?.adult_scene).toBeUndefined()
  })
})
