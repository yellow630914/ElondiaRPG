import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { bestiaryLevel, habitats } from '@/engine/bestiary'
import { finishCombat, startCombat } from '@/engine/combat'
import { enemies } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { nearbyPlaces } from '@/engine/intel'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { buildActionPrompt } from '@/narrator/judge'
import { buildPrompt } from '@/narrator/prompt'
import { wantsWorldFacts, worldFacts } from '@/narrator/worldFacts'

// 打聽與傳聞：findings 寫進正文、<world_facts> 不讓判定編地名、rumor 記在情報頁、怪物圖鑑
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
  enterLocation(state)
  return state
}

/** 附近一座地下城的某一層，和那裡真的會出現的一種怪物 */
function realLair(state: GameState) {
  const place = nearbyPlaces(state.location).find((p) => p.layer && p.table.length)!
  return { location: place.location, layer: place.layer!, monster: place.table[0]![0]![0] }
}

function ask(state: GameState, text = '向路人打聽魔獸皮的傳聞') {
  return prepareAction(state, { kind: 'free', text })
}

describe('findings', () => {
  it('keeps what was learned in the report, and tells the writer to say it', () => {
    const state = game()
    const p = ask(state)
    const j = sanitizeJudgment(state, p, { degree: 'success', attr: 'cha', dc: 12, summary: '問到了門路', findings: '- 北邊的皮貨商收好皮\n- 要提老闆的名字', effects: [] })
    expect(j.findings).toContain('皮貨商')
    const report = resolveAction(state, j)
    expect(report.check?.findings).toContain('皮貨商')
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true)
    const prompt = buildPrompt(report, [], { playerName: '測試者', language: 'zh-Hant' })
    expect(prompt.user).toContain('check.findings 是主角這次得知的具體內容')
    expect(prompt.user).toContain('北邊的皮貨商')
  })

  it('asks the judge for findings and lists the rumor effect for free actions', () => {
    const state = game()
    const prompt = buildActionPrompt(state, ask(state), '')
    expect(prompt.system).toContain('findings 寫主角這次真的得知的具體內容')
    expect(prompt.user).toContain('"type":"rumor"')
  })
})

describe('world facts', () => {
  it('is only sent with actions that seek information', () => {
    expect(wantsWorldFacts({ kind: 'free', text: '向老闆打聽附近的魔獸' })).toBe(true)
    expect(wantsWorldFacts({ kind: 'free', text: '向老板打听附近的魔兽' })).toBe(true)
    expect(wantsWorldFacts({ kind: 'free', text: '買一個麵包' })).toBe(false)
    expect(wantsWorldFacts({ kind: 'chat', text: '' })).toBe(true)
    let state = game()
    expect(buildActionPrompt(state, ask(state), '').user).toContain('<world_facts>\n這一帶真的存在')
    state = game()
    expect(buildActionPrompt(state, ask(state, '買一個麵包'), '').user).not.toContain('<world_facts>\n')
  })

  it('lists real nearby places and monsters with their ids and weaknesses', () => {
    const state = game()
    const lair = realLair(state)
    const facts = worldFacts(state)
    expect(facts).toContain(`[${lair.location}]`)
    expect(facts).toContain(`${enemies[lair.monster]!.name} [${lair.monster}]`)
    expect(facts).toContain('不要編造新的地名')
  })
})

describe('rumors', () => {
  it('drops made-up places and monsters, keeping the rumor as text', () => {
    const state = game()
    const p = ask(state)
    const j = sanitizeJudgment(state, p, {
      degree: 'critical', attr: 'cha', dc: 12, summary: '問到了',
      effects: [{ type: 'rumor', title: '赤褐裂谷的巨蜥', text: '裂谷深處有岩甲巨蜥', location: 'red_rift', monster: 'rock_lizard_king' }],
    })
    const rumor = j.effects.find((e) => e.type === 'rumor')!
    expect(rumor).toMatchObject({ type: 'rumor', title: '赤褐裂谷的巨蜥' })
    expect('location' in rumor && rumor.location).toBeFalsy()
    expect('monster' in rumor && rumor.monster).toBeFalsy()
    resolveAction(state, j)
    expect(state.intel?.at(-1)).toMatchObject({ kind: 'rumor', title: '赤褐裂谷的巨蜥' })
    expect(state.bestiary ?? {}).toEqual({})
  })

  it('turns a successful rumor about a real lair into a map point and lights up the bestiary', () => {
    const state = game()
    const lair = realLair(state)
    const p = ask(state)
    const j = sanitizeJudgment(state, p, {
      degree: 'success', attr: 'cha', dc: 12, summary: '問到了',
      effects: [
        { type: 'rumor', title: '巢穴', text: '那裡有一群', ...lair },
        { type: 'rumor', title: '第二則不收', text: '……' },
      ],
    })
    expect(j.effects.filter((e) => e.type === 'rumor')).toHaveLength(1)
    const report = resolveAction(state, j)
    const it = state.intel!.at(-1)!
    expect(it.kind).toBe('point')
    expect(it.location).toBe(lair.location)
    expect(it.group?.some(([m]) => m === lair.monster)).toBe(true)
    expect(bestiaryLevel(state.bestiary?.[lair.monster])).toBe('heard')
    expect(report.outcome.summary ?? '').toBeTruthy()
  })

  it('keeps a partial success as a plain rumor, but still lights up the monster', () => {
    const state = game()
    const lair = realLair(state)
    const j = sanitizeJudgment(state, ask(state), { degree: 'partial', attr: 'cha', dc: 12, summary: '只問到一點', effects: [{ type: 'rumor', title: '聽說', text: '好像有', ...lair }] })
    resolveAction(state, j)
    expect(state.intel!.at(-1)!.kind).toBe('rumor')
    expect(state.intel!.at(-1)!.monster).toBe(lair.monster)
    expect(bestiaryLevel(state.bestiary?.[lair.monster])).toBe('heard')
  })
})

describe('bestiary', () => {
  it('records the monsters of a fight, counting the defeated ones', () => {
    const state = game()
    startCombat(state, [['goblin', 2]])
    const foes = state.combat!.combatants.filter((c) => c.side === 'enemy')
    foes[0]!.hp = 0
    state.combat!.status = 'victory'
    const report = finishCombat(state)
    expect(bestiaryLevel(state.bestiary?.goblin)).toBe('defeated')
    expect(state.bestiary?.goblin?.defeated).toBe(1)
    expect(report.outcome.summary).toContain(`圖鑑新增：${enemies.goblin!.name}`)
  })

  it('knows where a monster lives from the encounter tables', () => {
    const state = game()
    const lair = realLair(state)
    expect(habitats(lair.monster).length).toBeGreaterThan(0)
  })
})
