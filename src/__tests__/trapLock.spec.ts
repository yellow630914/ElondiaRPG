import { afterEach, describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { applyBindRules, builtinBindRules, currentBindRules, restoreBindRules, sanitizeBindRules } from '@/engine/bindRulesMods'
import { setContentFilters } from '@/engine/content'
import { lewdRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { forceEquip, restrainPc } from '@/engine/forcedGear'
import { enterLocation, standOn } from '@/engine/grid'
import { equipItem, unequipItem, useKey } from '@/engine/inventory'
import { lewdOf } from '@/engine/lewd'
import { sanitizeCond, sanitizeGearSpecLoose } from '@/engine/mods'
import { freePlayer, pcOf } from '@/engine/party'
import { cutLock, cutLockFee, stuckRestraint } from '@/engine/restraints'
import { bindModifiers, bindsOf } from '@/engine/schools'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { addItem, newGame } from '@/engine/state'
import { condMet } from '@/engine/storyFlags'
import { sanitizeEffects } from '@/engine/storyMods'
import { baseReport } from '@/engine/town'
import type { GameState, GearSlot } from '@/engine/types'
import { buildActionPrompt } from '@/narrator/judge'

function game(birthplace = 'rhineburg'): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 6, birthplace })
  enterLocation(state)
  state.money_cc = 10000
  return state
}
const slotOf = (state: GameState, name: string) => (Object.keys(pcOf(state).gear!) as GearSlot[]).find((s) => pcOf(state).gear![s]?.name === name)!

afterEach(() => restoreBindRules())

describe('陷阱鎖', () => {
  it('事件的 restrain 把拘束具鎖在主角身上：不用契約也拿不下來', () => {
    const state = game()
    const pc = pcOf(state)
    const notes = applyEffects(state, baseReport(state, 'event', 0), [{ type: 'restrain', item: '單手套', lock: 'blue' }])
    expect(notes[0]).toContain('單手套')
    const slot = slotOf(state, '單手套')
    expect(stuckRestraint(pc, slot)).toMatchObject({ name: '單手套', lock: 'blue', trap: true })
    expect(() => unequipItem(state, pc.id, slot)).toThrow('鐵匠剪鎖')
    // 雙面效應照算：鎖是藍鋼
    expect(bindsOf(pc).find((b) => b.slot === slot)).toMatchObject({ kind: 'hands', lock: 'blue' })
    // 契約解除不影響陷阱鎖（本來就沒有契約）
    freePlayer(state)
    expect(stuckRestraint(pc, slot)).toBeDefined()
  })

  it('內容篩選關掉「主角非自願」、不是拘束具時不生效', () => {
    const state = game()
    const r = baseReport(state, 'event', 0)
    expect(restrainPc(state, r, '鐵長劍')).toBe('')
    setContentFilters({ pc_unwilling: false })
    try {
      expect(restrainPc(state, r, '單手套')).toBe('')
    } finally {
      setContentFilters({ pc_unwilling: true })
    }
    expect(pcOf(state).gear?.wrists?.name).not.toBe('單手套')
  })

  it('可以脫縛：成功時鎖被弄壞；身邊沒有主人，失敗沒有懲罰', () => {
    const state = game()
    const pc = pcOf(state)
    restrainPc(state, baseReport(state, 'event', 0), '皮眼罩')
    const slot = slotOf(state, '皮眼罩')
    const fail = prepareAction(state, { kind: 'unbind', target: `${pc.id}:${slot}`, text: '' })
    fail.natural = 2
    const hp = pc.hp
    resolveAction(state, null)
    expect(stuckRestraint(pc, slot)).toBeDefined()
    expect(pc.hp).toBe(hp)
    const ok = prepareAction(state, { kind: 'unbind', target: `${pc.id}:${slot}`, text: '' })
    ok.natural = 20
    resolveAction(state, null)
    expect(stuckRestraint(pc, slot)).toBeUndefined()
    unequipItem(state, pc.id, slot)
    expect(state.inventory.find((i) => i.name === '皮眼罩')?.qty).toBe(1)
  })

  it('鑰匙打得開陷阱鎖，鎖歸自己', () => {
    const state = game()
    const pc = pcOf(state)
    restrainPc(state, baseReport(state, 'event', 0), '單手套', 'blue')
    const slot = slotOf(state, '單手套')
    addItem(state.inventory, '藍鋼鑰匙', 1)
    useKey(state, pc.id, slot, '藍鋼鑰匙')
    expect(stuckRestraint(pc, slot)).toBeUndefined()
    expect(state.inventory.find((i) => i.name === '藍鋼鎖')?.qty).toBe(1)
  })

  it('物品自帶比較好的鎖時用自帶的（符文枷不會變成白鐵鎖）', () => {
    const state = game()
    const pc = pcOf(state)
    restrainPc(state, baseReport(state, 'event', 0), '囚徒的符文枷')
    const slot = slotOf(state, '囚徒的符文枷')
    expect(stuckRestraint(pc, slot)).toMatchObject({ lock: 'rune', trap: true })
    expect(cutLockFee(pc, slot)).toBe(lewdRules.unbind.cut.fee_cc.rune)
    // 事件寫的鎖比較好時照事件的
    restrainPc(state, baseReport(state, 'event', 0), '獵奴人的鎖鏈', 'gold')
    expect(stuckRestraint(pc, slotOf(state, '獵奴人的鎖鏈'))?.lock).toBe('gold')
  })

  it('鐵匠剪鎖：只剪陷阱鎖，依鎖的等級收錢', () => {
    const state = game()
    const pc = pcOf(state)
    restrainPc(state, baseReport(state, 'event', 0), '單手套', 'rune')
    const slot = slotOf(state, '單手套')
    expect(() => cutLock(state, pc.id, slot)).toThrow('鐵匠鋪')
    standOn(state, 'smithy')
    const fee = cutLockFee(pc, slot)!
    expect(fee).toBe(lewdRules.unbind.cut.fee_cc.rune)
    cutLock(state, pc.id, slot)
    expect(state.money_cc).toBe(10000 - fee)
    expect(stuckRestraint(pc, slot)).toBeUndefined()
    expect(state.inventory.some((i) => i.name === '符文鎖')).toBe(false)
  })

  it('AI 判定的提示詞列出拿不下來的拘束具，註明是陷阱還是主人', () => {
    const state = game()
    restrainPc(state, baseReport(state, 'event', 0), '皮手銬', 'blue')
    const q = buildActionPrompt(state, prepareAction(state, { kind: 'free', text: '把手銬扯下來' }), '')
    expect(q.system + q.user).toContain('皮手銬（手腕・陷阱鎖住・藍鋼鎖）')
    const slave = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(slave, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    forceEquip(slave, baseReport(slave, 'event', 0), rec!.id, '腕鐐')
    const q2 = buildActionPrompt(slave, prepareAction(slave, { kind: 'free', text: '試試看' }), '')
    expect(q2.system + q2.user).toMatch(/腕鐐（手腕・主人強制戴上/)
  })

  it('主人鎖上的不能剪', () => {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    forceEquip(state, baseReport(state, 'event', 0), rec!.id, '腕鐐')
    standOn(state, 'smithy')
    const slot = slotOf(state, '腕鐐')
    expect(cutLockFee(pcOf(state), slot)).toBeUndefined()
    expect(() => cutLock(state, pcOf(state).id, slot)).toThrow('主人')
  })
})

describe('事件條件：魅氣濃度與戴著什麼', () => {
  it('魅氣濃度看所在地', () => {
    expect(condMet(game('albena'), { charm: { min: 3 } })).toBe(true)
    expect(condMet(game('rhineburg'), { charm: { min: 3 } })).toBe(false)
    expect(condMet(game('rhineburg'), { charm: { max: 2 } })).toBe(true)
  })

  it('戴著拘束具、別人鎖上的、種類、沒戴', () => {
    const state = game()
    expect(condMet(state, { wearing: { bind: false } })).toBe(true)
    expect(condMet(state, { wearing: { bind: true } })).toBe(false)
    addItem(state.inventory, '皮眼罩', 1)
    equipItem(state, '皮眼罩', pcOf(state).id)
    expect(condMet(state, { wearing: { bind: true, locked: false, bind_kind: 'eyes' } })).toBe(true)
    expect(condMet(state, { wearing: { bind_kind: 'hands' } })).toBe(false)
    restrainPc(state, baseReport(state, 'event', 0), '單手套')
    expect(condMet(state, { wearing: { locked: true, bind_kind: 'hands', mark: false } })).toBe(true)
  })

  it('內容編輯器的整理保留新的條件與效果', () => {
    expect(sanitizeCond({ charm: { min: 7, max: 0 }, wearing: { bind: true, bind_kind: 'nope', mark: 'x' } } as never)).toEqual({ charm: { min: 4, max: 1 }, wearing: { bind: true } })
    expect(sanitizeEffects([{ type: 'restrain', item: '單手套', lock: 'rune' }, { type: 'restrain', item: '單手套', lock: 'white' }, { type: 'restrain', item: '' }])).toEqual([
      { type: 'restrain', item: '單手套', lock: 'rune' }, { type: 'restrain', item: '單手套' },
    ])
  })
})

describe('拘束程度與雙面效應設定', () => {
  it('物品自己的拘束程度蓋過底材的', () => {
    const state = game()
    const pc = pcOf(state)
    addItem(state.inventory, '皮眼罩', 1)
    equipItem(state, '皮眼罩', pc.id)
    const slot = slotOf(state, '皮眼罩')
    pc.lewd = { ...lewdOf(pc), endurance: 0 }
    const before = bindModifiers(pc, { context: 'action', attr: 'int' })[0]!.value
    pc.gear![slot]!.spec = { ...pc.gear![slot]!.spec, bind: 3 }
    expect(bindsOf(pc)[0]!.bind).toBe(3)
    expect(bindModifiers(pc, { context: 'action', attr: 'int' })[0]!.value).toBe(-lewdRules.two_face.kinds.eyes.penalty[2]!)
    expect(before).toBe(-lewdRules.two_face.kinds.eyes.penalty[1]!)
    // 整理：和底材一樣時不寫，範圍 1～3
    const spec = pc.gear![slot]!.spec
    expect(sanitizeGearSpecLoose({ ...spec, bind: 9 })?.bind).toBe(3)
    expect(sanitizeGearSpecLoose({ ...spec, bind: 2 })?.bind).toBeUndefined()
    expect(sanitizeGearSpecLoose({ base: 'longsword', material: 'iron', bind: 2 })?.bind).toBeUndefined()
  })

  it('改了設定，減值與鎖的倍率跟著變；恢復預設還原', () => {
    const state = game()
    const pc = pcOf(state)
    addItem(state.inventory, '皮眼罩', 1)
    equipItem(state, '皮眼罩', pc.id)
    pc.lewd = { ...lewdOf(pc), endurance: 0 }
    const draft = currentBindRules()
    draft.kinds.eyes.penalty = [1, 5, 6]
    draft.kinds.eyes.checks = [{ attrs: ['cha'] }]
    draft.locks.gold.mult = 2
    applyBindRules(sanitizeBindRules(draft))
    expect(bindModifiers(pc, { context: 'action', attr: 'int' })).toEqual([])
    expect(bindModifiers(pc, { context: 'action', attr: 'cha' })[0]!.value).toBe(-5)
    expect(lewdRules.locks.grades.gold.mult).toBe(2)
    restoreBindRules()
    expect(currentBindRules()).toEqual(builtinBindRules())
  })

  it('整理：數字夾在範圍內，不存在的狀態與情境拿掉', () => {
    const raw = currentBindRules()
    raw.kinds.hands.penalty = [99, -1, 2]
    raw.kinds.hands.immune = ['disarmed', 'nope']
    raw.kinds.hands.checks = [{ attrs: ['str'], contexts: ['bogus' as never] }, { attrs: ['str'] }]
    raw.kinds.hands.combat = [{ dr: 50 }, {}, { initiative: 3, threat: 2 } as never]
    raw.fit = -3
    const r = sanitizeBindRules(raw)
    expect(r.kinds.hands.penalty).toEqual([10, 0, 2])
    expect(r.kinds.hands.immune).toEqual(['disarmed'])
    expect(r.kinds.hands.checks).toEqual([{ attrs: ['str'] }])
    expect(r.kinds.hands.combat).toEqual([{ dr: 10 }, {}, { initiative: 3 }])
    expect(r.fit).toBe(0)
  })
})
