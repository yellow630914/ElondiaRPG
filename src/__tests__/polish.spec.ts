import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { gainXp, rerollsLeft, snapshot } from '@/engine/character'
import { GENDER_IDS, genderDef, npcPool } from '@/engine/data'
import { clearQuestMarkers, currentArea, enterLocation, goOutskirts, standOn } from '@/engine/grid'
import { generateNpc, presentHere } from '@/engine/npcs'
import { longRest } from '@/engine/rest'
import { newGame, withRng } from '@/engine/state'
import { acceptQuest, chooseAbility, dismiss, guildQuests, recruit, rerollAbility } from '@/engine/town'
import type { GameState, Report } from '@/engine/types'
import { Rng } from '@/engine/rng'

const validate = new Ajv2020({ strict: false }).compile(schema)
function expectValid(report: Report) {
  if (!validate(report)) throw new Error(JSON.stringify(validate.errors, null, 2))
}

function game(seed = 1, classId = 'fighter'): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId, seed })
  enterLocation(state)
  return state
}

describe('quest markers', () => {
  it('removes the ❗ marker once the outskirts quest is no longer in progress', () => {
    const state = game(1)
    standOn(state, 'guild')
    const q = guildQuests(state).find((x) => x.area === 'outskirts')!
    acceptQuest(state, q.id)
    standOn(state, 'gate')
    goOutskirts(state)
    const area = currentArea(state)
    expect(area.cells.some((c) => c.kind === 'quest' && c.questId === q.id)).toBe(true)
    q.status = 'ready'
    clearQuestMarkers(state)
    expect(area.cells.some((c) => c.kind === 'quest')).toBe(false)
  })
})

describe('npc gender', () => {
  it('gives generated NPCs a gender and a name from the matching pool', () => {
    const state = game(2)
    const rng = new Rng(7)
    for (let i = 0; i < 30; i++) {
      const rec = generateNpc(state, rng, { race: 'human' })
      expect(GENDER_IDS).toContain(rec.gender)
      const pool = npcPool.genders[rec.gender!]!.names
      if (pool === 'm') expect(npcPool.names.human!.m.some((n) => rec.name.startsWith(n))).toBe(true)
      if (pool === 'f') expect(npcPool.names.human!.f.some((n) => rec.name.startsWith(n))).toBe(true)
    }
    expect(generateNpc(state, rng, { gender: 'futa' }).gender).toBe('futa')
  })

  it('reports gender to the AI and maps the player free text to a color', () => {
    const state = game(3)
    recruit(state, 'npc_lina')
    const lina = state.party.find((m) => m.id === 'npc_lina')!
    expect(lina.gender).toBe('female')
    expect(snapshot(lina).gender).toBe('女性')
    expect(genderDef('偽娘')?.id).toBe('femboy')
    expect(genderDef('男')?.color).toBe(npcPool.genders.male!.color)
    expect(genderDef('看心情')).toBeUndefined()
  })
})

describe('presence', () => {
  it('only offers people who are actually at the same place', () => {
    const state = game(4)
    standOn(state, 'tavern')
    recruit(state, 'npc_lina')
    dismiss(state, 'npc_lina')
    expect(presentHere(state, 'npc_lina')).toBe(true)
    standOn(state, 'gate')
    expect(presentHere(state, 'npc_lina')).toBe(false)
    expect(() => prepareAction(state, { kind: 'free', target: 'npc_lina', text: '打招呼' })).toThrow('不在這裡')
    goOutskirts(state)
    expect(presentHere(state, 'npc_lina')).toBe(false)
  })
})

describe('long rest interaction', () => {
  it('lets the AI introduce a fellow guest at the inn', () => {
    const state = game(5)
    expect(() => prepareAction(state, { kind: 'rest_talk', text: '聊天' })).toThrow('長休')
    standOn(state, 'inn')
    longRest(state, 'inn')
    const p = prepareAction(state, { kind: 'rest_talk', target: 'guests', text: '在大廳和旅客喝一杯' })
    const judgment = sanitizeJudgment(state, p, {
      degree: 'success', summary: '你和一位吟遊詩人聊到深夜。',
      effects: [
        { type: 'meet', npc: { name: '露希亞', gender: 'female', race: 'elf', class: 'bard', level: 99 }, affinity: 50, to_player: '旅店裡一起喝酒的朋友' },
        { type: 'meet', npc: { name: '第二個人' } },
      ],
    })
    expect(judgment.effects).toHaveLength(1)
    const report = resolveAction(state, judgment)
    expectValid(report)
    const met = Object.values(state.npcs!).find((n) => n.name === '露希亞')!
    expect(met.level).toBe(3)
    expect(met.spot).toBe('inn')
    expect(state.relationships![met.id]).toMatchObject({ affinity: 10, toPlayer: '旅店裡一起喝酒的朋友' })
    expect(presentHere(state, met.id)).toBe(true)
    expect(report.time.start).toEqual(report.time.end)
  })

  it('improves companions by the rules when the AI is off', () => {
    const state = game(6)
    recruit(state, 'npc_lina')
    standOn(state, 'inn')
    longRest(state, 'inn')
    prepareAction(state, { kind: 'rest_talk', text: '一起看星星' })
    state.pendingAction!.natural = 20
    resolveAction(state, null)
    expect(state.relationships!.npc_lina!.affinity).toBe(3)
  })
})

describe('ability reroll', () => {
  it('rerolls the level-up choices a limited number of times', () => {
    const state = game(7, 'wizard')
    const pc = state.party[0]!
    withRng(state, (rng) => gainXp(pc, 1000, rng))
    const first = [...pc.pendingAbilityChoices![0]!]
    expect(rerollsLeft(pc)).toBe(3)
    const next = rerollAbility(state, 'pc')
    expect(next).not.toEqual(first)
    expect(rerollsLeft(pc)).toBe(2)
    rerollAbility(state, 'pc')
    rerollAbility(state, 'pc')
    expect(() => rerollAbility(state, 'pc')).toThrow('不能再重抽')
    chooseAbility(state, 'pc', pc.pendingAbilityChoices![0]![0]!)
    expect(pc.abilityRerollsUsed).toBeUndefined()
  })
})
