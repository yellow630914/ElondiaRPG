import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { finishCombat, startCombat } from '@/engine/combat'
import { slaveryRules } from '@/engine/data'
import { enterLocation, goOutskirts } from '@/engine/grid'
import { currentMasterHome, householdOf } from '@/engine/masterHome'
import { npcIdentity, npcTitle } from '@/engine/npcs'
import { isBound, isNoncombatant, leaderOf } from '@/engine/party'
import { shortRest } from '@/engine/rest'
import { answerMasterEvent, masterSpecIdentity, masterTagIds, startAsSlave, startMasterEvent, type MasterSpec } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { contractOf } from '@/engine/tattoos'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function start(spec: Partial<MasterSpec>, seed = 3): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: 'rhineburg' })
  enterLocation(state)
  const r = startAsSlave(state, { master: { type: 'custom', spec: { name: '維克多', level: 5, ...spec } }, mark: 'labor' })
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return state
}

const masterOf = (state: GameState) => state.npcs![contractOf(state.party[0]!)!.master]!

describe('a custom master from character creation', () => {
  it('keeps only master tags, at most three, and an occupation only for commoners', () => {
    expect(masterSpecIdentity({ kind: 'commoner', tags: ['merchant', 'slave', 'nope', 'merchant'], occupation: '  酒館老闆  ' }))
      .toEqual({ kind: 'commoner', tags: ['merchant'], occupation: '酒館老闆' })
    expect(masterSpecIdentity({ tags: ['noble', 'villain', 'merchant', 'priest'], occupation: '酒館老闆' }))
      .toEqual({ kind: 'adventurer', tags: ['noble', 'villain', 'merchant'] })
    expect(masterTagIds()).not.toContain('slave')
  })

  it('an adventurer master gets the chosen tags', () => {
    const state = start({ tags: ['noble', 'villain'] })
    const m = masterOf(state)
    expect(m.kind).toBe('adventurer')
    expect(m.tags).toEqual(['noble', 'villain'])
    expect(leaderOf(state)?.id).toBe(m.id)
  })

  for (const tags of [[], ...masterTagIds().map((t) => [t])]) {
    it(`a commoner master${tags.length ? `（${tags[0]}）` : ''} works through a whole day`, () => {
      const state = start({ kind: 'commoner', tags, occupation: '布商', class: 'wizard' })
      const m = masterOf(state)
      expect(m.kind).toBe('commoner')
      expect(m.class).toBe('')
      expect(npcTitle(m)).toBe('布商')
      expect(npcIdentity(m)).toContain('普通人')
      expect(isBound(state)).toBe(true)
      const member = state.party.find((x) => x.id === m.id)!
      expect(isNoncombatant(member)).toBe(true)
      // 主人的家與家裡的人
      const home = currentMasterHome(state)
      expect(home).toBeTruthy()
      householdOf(state, home!)
      // 主人的突發事件：每一個選項都產生合法的報告
      for (const e of slaveryRules.master_events.events.slice(0, 6)) {
        const s = start({ kind: 'commoner', tags, occupation: '布商' })
        s.money_cc = 500
        startMasterEvent(s, e)
        const r = answerMasterEvent(s, 0)
        expect(validate(r), `${e.id} ${JSON.stringify(validate.errors)}`).toBe(true)
      }
      // 請求出城、出城、戰鬥（主人不參戰）、戰敗、休息
      prepareAction(state, { kind: 'master_permit', text: '' })
      state.pendingAction!.natural = 20
      expect(validate(resolveAction(state, null))).toBe(true)
      goOutskirts(state)
      startCombat(state)
      expect(state.combat!.combatants.some((c) => c.id === m.id)).toBe(false)
      state.combat!.status = 'defeat'
      expect(validate(finishCombat(state))).toBe(true)
      const rest = shortRest(state)
      if (!('combatants' in rest)) expect(validate(rest)).toBe(true)
    })
  }
})

describe("the player's body and look", () => {
  it('lists options by body type, race and gender', async () => {
    const { lookOptions, describeLook } = await import('@/engine/traits')
    expect(lookOptions('chest', 'masc', 'human')).toContain('胸膛寬厚')
    expect(lookOptions('chest', 'masc', 'human')).not.toContain('胸部豐滿')
    expect(lookOptions('chest', 'fem', 'human')).toContain('胸部豐滿')
    // 偽娘沒有胸部；矮人的身高只用種族的
    expect(lookOptions('chest', 'fem', 'human', 'femboy')).toEqual([])
    expect(lookOptions('height', 'masc', 'dwarf').some((t) => t.includes('高大'))).toBe(false)
    expect(describeLook({ height: '身材高挑', build: '勻稱結實', hair_color: '銀白', hair_style: '短髮' })).toBe('身材高挑、勻稱結實；一頭銀白的短髮。')
  })

  it('writes the chosen look in front of the appearance and keeps the body type', async () => {
    const { characterBody } = await import('@/engine/look')
    const state = newGame({
      name: '艾倫', race: 'human', classId: 'fighter', seed: 1, gender: '女', body: 'fem',
      look: { height: '身材高挑', chest: '胸膛寬厚', hips: '髖部寬闊' }, appearance: '左眉有一道舊疤。',
    })
    const pc = state.party[0]!
    // 陽剛的詞條（胸膛寬厚）不收
    expect(pc.appearance).toBe('身材高挑；髖部寬闊。左眉有一道舊疤。')
    expect(pc.body).toBe('fem')
    expect(characterBody(pc)).toBe('fem')
    // 沒選體型時依性別文字
    expect(characterBody({ race: 'human', gender: '男' })).toBe('masc')
    expect(characterBody({ race: 'yulin', gender: '男' })).toBe('fem')
  })
})

describe('character creation catalogs', () => {
  it('prices every starting gear option: basics free at tier 1, other slots cost their tier', async () => {
    const { creationCatalog, creationCost } = await import('@/engine/gear')
    const cat = creationCatalog('fighter', 'human')
    const main = cat.find((s) => s.slot === 'main_hand')!
    expect(main.template).toBe(true)
    expect(main.options.filter((o) => o.tier === 1).every((o) => o.cost === 0)).toBe(true)
    const ring = cat.find((s) => s.slot === 'ring_1')!
    expect(ring.options.every((o) => o.cost === o.tier)).toBe(true)
    for (const s of cat) for (const o of s.options) expect(creationCost('fighter', { [s.slot]: { base: o.base, tier: o.tier } })).toBe(o.cost)
  })

  it('every built-in perk has a category, and the guess agrees for most of them', async () => {
    const { perkRules } = await import('@/engine/data')
    const { perkCategory, PERK_CATEGORIES } = await import('@/engine/perks')
    const list = perkRules.perks.filter((p) => !p.race)
    for (const p of list) expect(PERK_CATEGORIES[p.category ?? '']).toBeTruthy()
    const agree = list.filter((p) => perkCategory({ effects: p.effects }) === p.category).length
    expect(agree / list.length).toBeGreaterThan(0.7)
  })
})
