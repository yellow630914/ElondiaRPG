import { afterEach, describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import schema from '../../schemas/report.schema.json'
import { buildActionPrompt } from '@/narrator/judge'
import { prepareAction, resolveAction } from '@/engine/actions'
import { act, currentActor, finishCombat, startCombat } from '@/engine/combat'
import { combatRules } from '@/engine/data'
import { climaxDcCut, defeatEventFoes, skipDefeatEvent, villainOf } from '@/engine/defeat'
import { lewdOf } from '@/engine/lewd'
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

    const options = { config: defaultPromptConfig(), lore: loreItems(worldbook as unknown as Worldbook, {}, []), budgetChars: 20000, language: 'zh-Hant' as const }
    const prompt = composeNarration(state, report, options).prompt
    expect(prompt.system).toContain('<defeat_event>')
    expect(prompt.user).toContain('戰敗事件的前半段')

    const money = state.money_cc
    prepareAction(state, { kind: 'defeat_event', target: 'opt:1', text: rules.options[1]!.label })
    // 判定請求：戰敗事件規則放在 system 的最後（常駐世界書、前段提示詞之後），前面可以共用快取
    const judge = buildActionPrompt(state, state.pendingAction!, '', { narrative: true, lore: { constant: [{ comment: '常駐', content: '世界觀' }], triggered: [] } as never })
    const system = judge.sections!.filter((x) => x.part === 'system').map((x) => x.key)
    expect(system.indexOf('defeat')).toBeGreaterThan(system.indexOf('lore_constant'))
    expect(system.slice(-2)).toEqual(['defeat', 'scene'])
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

  it('needs a matching enemy and a passed charisma check', () => {
    rules.check.dc = -100
    const plain = game()
    lose(plain, ['merchant'])
    expect(plain.pendingDefeat).toBeUndefined()

    rules.check.dc = 999
    const unlucky = game()
    const r = lose(unlucky)
    expect(unlucky.pendingDefeat).toBeUndefined()
    expect(r.timeline!.at(-1)!.action).toContain('沒有起意')
  })

  it('triggers more often the more charismatic the hero is', () => {
    const count = (cha: number) => {
      let n = 0
      for (let seed = 1; seed <= 60; seed++) {
        const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed })
        goOutskirts(state)
        state.party[0]!.attrs.cha = cha
        lose(state)
        if (state.pendingDefeat) n++
      }
      return n
    }
    const plain = count(6)
    const charming = count(20)
    expect(charming).toBeGreaterThan(plain)
    expect(charming).toBeGreaterThan(30)
    expect(plain).toBeLessThan(30)
  })

  it('counts monsters in rut but never young ones', () => {
    const state = game()
    const foe = (traits: string[]) => ({ name: '哥布林', traits, hp: 5, side: 'enemy' })
    expect(defeatEventFoes(state, [foe(['rut'])])).toHaveLength(1)
    expect(defeatEventFoes(state, [foe(['rut', 'young'])])).toHaveLength(0)
    expect(defeatEventFoes(state, [foe(['huge'])])).toHaveLength(0)
    expect(defeatEventFoes(state, [{ ...foe(['rut']), hp: 0 }])).toHaveLength(0)
  })

  it('can be skipped when the settings no longer allow it', () => {
    rules.check.dc = -100
    const state = game()
    lose(state)
    expect(state.pendingDefeat).toBeDefined()
    skipDefeatEvent(state)
    expect(state.pendingDefeat).toBeUndefined()
    expect(currentArea(state).kind).toBe('settlement')
  })
})

describe('戰敗事件的連動（S8）', () => {
  it('敵人的類型依標籤與職業；怪物沒有類型', () => {
    const state = game()
    const npc = (tags: string[], cls: string) => withRng(state, (rng) => generateNpc(state, rng, { tags, level: 3, location: state.location, class: cls }))
    expect(villainOf(state, [{ npcId: npc(['villain', 'merchant'], 'fighter').id }])).toBe('merchant')
    expect(villainOf(state, [{ npcId: npc(['villain'], 'wizard').id }])).toBe('knowledge')
    expect(villainOf(state, [{ npcId: npc(['villain'], 'cleric').id }])).toBe('religious')
    expect(villainOf(state, [{ npcId: npc(['villain'], 'fighter').id }])).toBe('martial')
    expect(villainOf(state, [{}])).toBeUndefined()
  })

  it('我方高潮得越多越容易起意（最多 −4）', () => {
    expect(climaxDcCut(0)).toBe(0)
    expect(climaxDcCut(2)).toBe(2)
    expect(climaxDcCut(9)).toBe(4)
  })

  it('沒能脫身時改五項指標，敵人的類型另外加上結果', () => {
    rules.check.dc = -100
    const state = game()
    lose(state)
    state.pendingDefeat!.villain = 'religious'
    const pc = state.party[0]!
    const before = lewdOf(pc)
    const p = prepareAction(state, { kind: 'defeat_event', target: 'opt:2', text: '' })
    expect(p.scene).toContain('宗教型')
    p.natural = 1
    resolveAction(state, null)
    // 親密場景本身也會讓淫亂成長
    expect(lewdOf(pc).lewdness).toBeGreaterThanOrEqual(before.lewdness + 2)
    expect(lewdOf(pc).submission).toBeGreaterThanOrEqual(before.submission + 3)
    expect(pc.status).toContain('dazed')
  })
})

describe('voluntary defeat (不幸／主動)', () => {
  /** 和一個惡人開打，輪到隊員時按「戰敗」 */
  function surrender(willing: boolean) {
    const state = game()
    const rec = withRng(state, (rng) => generateNpc(state, rng, { tags: ['villain'], level: 1, location: state.location }))
    startCombat(state, [], { npcs: [rec.id] })
    for (const c of state.combat!.combatants) if (c.side === 'party') c.hp = c.maxHp = 500
    for (let i = 0; i < 20 && currentActor(state.combat!)?.side !== 'party'; i++) act(state, { type: 'end_turn' })
    act(state, { type: 'surrender', willing })
    expect(state.combat!.status).toBe('defeat')
    const report = finishCombat(state)
    afterCombat(state, report)
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true)
    return { state, report }
  }

  it('ends the fight as a normal defeat; the choice only changes the text', () => {
    const { report: unlucky } = surrender(false)
    expect(unlucky.outcome.result).toBe('defeat')
    expect(unlucky.party.find((p) => p.id === 'pc')!.hp![1]).toBe(1)
    expect(unlucky.outcome.tags).not.toContain('主動認輸')
    expect(unlucky.narration?.focus?.join()).toContain('不是主角願意的')

    const { report: willing } = surrender(true)
    expect(willing.outcome.result).toBe('defeat')
    expect(willing.party.find((p) => p.id === 'pc')!.hp![1]).toBe(1)
    expect(willing.outcome.tags).toContain('主動認輸')
    expect(willing.narration?.focus?.join()).toContain('主動放棄抵抗')
    expect(willing.timeline?.some((t) => t.action.startsWith('主動認輸'))).toBe(true)
  })

  it('tells the defeat event that the protagonist gave in', () => {
    rules.check.dc = -100
    const { state, report } = surrender(true)
    expect(state.pendingDefeat?.willing).toBe(true)
    expect(report.narration?.focus?.join()).toContain('放棄抵抗的主角')
    prepareAction(state, { kind: 'defeat_event', target: 'opt:0', text: rules.options[0]!.label })
    expect(buildActionPrompt(state, state.pendingAction!, '').user).toContain('主動認輸')
  })
})
