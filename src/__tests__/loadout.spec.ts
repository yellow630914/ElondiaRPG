import { describe, expect, it } from 'vitest'
import { carriedAbilities, carryLearned, countsForLoadout, loadoutUsage, setCarried } from '@/engine/character'
import { startCombat } from '@/engine/combat'
import { abilities, classAbilities, classDef } from '@/engine/data'
import { gameRule, RULE_DEFS } from '@/engine/gameRules'
import { pcOf } from '@/engine/party'
import { newGame } from '@/engine/state'
import { chooseAbility, setAbilityCarried } from '@/engine/town'

/** 法師：技能與法術夠多，可以超過上限 */
function wizard(extra: number) {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'wizard', seed: 7 })
  const pc = pcOf(state)
  const pool = classAbilities('wizard').filter((a) => a.type !== 'cantrip' && !pc.abilities.includes(a.id))
  const counted = pc.abilities.filter(countsForLoadout).length
  pc.abilities.push(...pool.slice(0, Math.max(0, extra - counted)).map((a) => a.id))
  return { state, pc, pool }
}

describe('技能攜帶上限', () => {
  it('預設 12 個，0 表示不限', () => {
    expect(RULE_DEFS.skillLoadout.default).toBe(12)
    expect(gameRule({ options: { defeatLoot: 'keep' } }, 'skillLoadout')).toBe(12)
  })

  it('沒選過時先帶職業的起始能力，其他帶最近學會的；戲法不算、一直帶著', () => {
    const { pc } = wizard(15)
    const counted = pc.abilities.filter(countsForLoadout)
    expect(counted.length).toBe(15)
    const core = classDef('wizard').start.filter(countsForLoadout)
    const others = counted.filter((id) => !core.includes(id))
    const carried = carriedAbilities(pc, 12)
    expect(carried.filter(countsForLoadout)).toEqual(counted.filter((id) => core.includes(id) || others.slice(-(12 - core.length)).includes(id)))
    for (const id of pc.abilities.filter((id) => abilities[id]!.type === 'cantrip')) expect(carried).toContain(id)
    expect(loadoutUsage(pc, 12)).toEqual({ carried: 12, library: 3 })
    // 不限：全部帶上
    expect(carriedAbilities(pc, 0)).toEqual(pc.abilities)
  })

  it('學會新的：沒滿就帶上，滿了留在技能庫，不擠掉原本帶的', () => {
    const { pc, pool } = wizard(11)
    const a = pool[20]!.id
    const b = pool[21]!.id
    pc.abilities.push(a)
    expect(carryLearned(pc, a, 12)).toBe(true)
    expect(carriedAbilities(pc, 12)).toContain(a)
    const before = carriedAbilities(pc, 12)
    pc.abilities.push(b)
    expect(carryLearned(pc, b, 12)).toBe(false)
    expect(carriedAbilities(pc, 12)).toEqual(before)
    expect(loadoutUsage(pc, 12)).toEqual({ carried: 12, library: 1 })
  })

  it('換技能：放回一個再帶上另一個；帶滿時不能再帶', () => {
    const { pc } = wizard(14)
    const library = pc.abilities.filter((id) => countsForLoadout(id) && !carriedAbilities(pc, 12).includes(id))
    expect(() => setCarried(pc, library[0]!, true, 12)).toThrow('帶滿')
    const out = carriedAbilities(pc, 12).find(countsForLoadout)!
    setCarried(pc, out, false, 12)
    setCarried(pc, library[0]!, true, 12)
    const carried = carriedAbilities(pc, 12)
    expect(carried).toContain(library[0])
    expect(carried).not.toContain(out)
    expect(loadoutUsage(pc, 12).carried).toBe(12)
    // 上限調低：留最近選的
    expect(loadoutUsage(pc, 6).carried).toBe(6)
  })

  it('戰鬥只帶攜帶中的；戰鬥中不能換', () => {
    const { state, pc } = wizard(15)
    state.options = { ...state.options!, skillLoadout: 10 }
    const combat = startCombat(state, [['goblin', 1]])
    const me = combat.combatants.find((x) => x.id === pc.id)!
    expect(me.abilities).toEqual(carriedAbilities(pc, 10))
    expect(me.abilities.filter(countsForLoadout).length).toBe(10)
    expect(() => setAbilityCarried(state, pc.id, pc.abilities.find(countsForLoadout)!, false)).toThrow('戰鬥中')
  })

  it('升級選能力時帶滿會提示', () => {
    const { state, pc, pool } = wizard(12)
    const id = pool.find((a) => !pc.abilities.includes(a.id))!.id
    pc.pendingAbilityChoices = [[id]]
    const report = chooseAbility(state, pc.id, id)
    expect(report.outcome.summary).toContain('技能庫')
    expect(carriedAbilities(pc, 12)).not.toContain(id)
  })
})
