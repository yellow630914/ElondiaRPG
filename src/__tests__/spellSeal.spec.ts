// 魔力封印：魔導束縛契約不再封印法術；內容編輯器做的有封印的印記，和主人越親近能施放的環數越多
import { describe, expect, it } from 'vitest'
import { attrsOf, maxHpFor, slotMaxFor } from '@/engine/character'
import { combatant, startCombat } from '@/engine/combat'
import { slaveryRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { joinParty, pcOf } from '@/engine/party'
import { masterCandidates, spellCapFor, startAsSlave, termsFromTemplate } from '@/engine/slavery'
import { migrate, newGame, withRng } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import { takeVoluntarySlave } from '@/engine/voluntarySlave'

const step = slaveryRules.spell_seal.affinity_step

function wizardSlave() {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'wizard', seed: 4, birthplace: 'rhineburg' })
  enterLocation(state)
  const pc = pcOf(state)
  pc.level = 9
  pc.maxHp = pc.hp = maxHpFor(9, pc.attrs)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'arcane' })
  return { state, master: contractOf(pc)!.master }
}

/** 內容編輯器做的有封印的印記（內建的都沒有）：直接在條款寫上 1 環 */
function sealed() {
  const r = wizardSlave()
  const t = contractOf(pcOf(r.state))!.terms
  t.spell_cap = 1
  t.functions = [...t.functions, 'spell_seal']
  return r
}

describe('魔導束縛契約', () => {
  it('不再封印法術：9 環都能用', () => {
    const { state, master } = wizardSlave()
    expect(termsFromTemplate('arcane').spell_cap).toBeUndefined()
    expect(termsFromTemplate('arcane').functions).not.toContain('spell_seal')
    state.relationships![master]!.affinity = -50
    expect(spellCapFor(state, pcOf(state))).toBe(9)
    // 法術環照職業與等級全都有（以前封印到只剩 1 環）
    const pc = pcOf(state)
    const full = slotMaxFor(pc.class, pc.level, attrsOf(pc)).length
    expect(full).toBeGreaterThan(1)
    expect(combatant(startCombat(state, [['goblin', 1]]), 'pc').slotMax.length).toBe(full)
  })

  it('舊存檔（格式 13）照模板刻的魔導束縛拿掉封印；自訂印記不動', () => {
    const { state } = sealed()
    const t = contractOf(pcOf(state))!.terms
    t.side_effects = ['法陣抽取魔力，最多只能施放 1 環法術', '主人能感知印記的位置']
    state.schema = 13
    const after = migrate(state)
    const now = contractOf(pcOf(after))!.terms
    expect(now.spell_cap).toBeUndefined()
    expect(now.functions).not.toContain('spell_seal')
    expect(now.side_effects[0]).not.toContain('最多只能施放')
    expect(now.side_effects).toContain('主人能感知印記的位置')
    expect(spellCapFor(after, pcOf(after))).toBe(9)

    const custom = sealed()
    const c = contractOf(pcOf(custom.state))!
    c.kind = 'custom'
    custom.state.schema = 13
    expect(contractOf(pcOf(migrate(custom.state)))!.terms.spell_cap).toBe(1)
  })
})

describe('有封印的印記（內容編輯器）', () => {
  it('親密度 0 以下照印記寫的 1 環；每 20 多 1 環，最多 9 環', () => {
    const { state, master } = sealed()
    const pc = pcOf(state)
    state.relationships![master]!.affinity = -30
    expect(spellCapFor(state, pc)).toBe(1)
    state.relationships![master]!.affinity = step * 2 + 5
    expect(spellCapFor(state, pc)).toBe(3)
    state.relationships![master]!.affinity = 100
    expect(spellCapFor(state, pc)).toBe(1 + Math.floor(100 / step))
  })

  it('戰鬥中的法術環照放寬後的環數', () => {
    const { state, master } = sealed()
    state.relationships![master]!.affinity = 0
    expect(combatant(startCombat(state, [['goblin', 1]]), 'pc').slotMax.length).toBe(1)
    delete state.combat
    state.relationships![master]!.affinity = step * 2
    expect(combatant(startCombat(state, [['goblin', 1]]), 'pc').slotMax.length).toBe(3)
  })

  it('主角的奴隸看他對主角的親密度；沒有封印（包括魔導束縛）是 9 環', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 9, birthplace: 'albena' })
    enterLocation(state)
    state.money_cc = 10_000
    const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', class: 'wizard', level: 5, location: 'albena' }, 'ss'))
    registerNpc(state, rec)
    const m = joinParty(state, rec, 'voluntary')
    expect(spellCapFor(state, m)).toBe(9)
    state.relationships![rec.id]!.affinity = 60
    expect(standOn(state, 'carver')).toBe(true)
    takeVoluntarySlave(state, rec.id, 'arcane')
    expect(spellCapFor(state, m)).toBe(9)
    const t = contractOf(m)!.terms
    t.spell_cap = 1
    expect(spellCapFor(state, m)).toBe(1 + Math.floor(60 / step))
  })
})
