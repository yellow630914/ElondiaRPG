import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { combatRelease } from '@/engine/combatRelease'
import { lewdRules } from '@/engine/data'
import { gearName } from '@/engine/gear'
import { enterLocation, standOn } from '@/engine/grid'
import { discardKey, equipItem, giveKey, keyKeepers, lockedGear, lockGear, takeKeyBack, unequipItem, unlockGear, useKey } from '@/engine/inventory'
import { baseLewd, lewdDaily } from '@/engine/lewd'
import { characterFor, npcRecord } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { cutLock, cutLockFee, keysFor, stuckRestraint } from '@/engine/restraints'
import { custodyCaps, keyCustody, twoFaceCombat } from '@/engine/schools'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { addItem, migrate, newGame } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import type { Character, GameState, GearSlot } from '@/engine/types'

// 自己鎖上的拘束具的鑰匙（docs/LEWD_STATS.md 第 7、16 節）

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 6, birthplace: 'rhineburg' })
  enterLocation(state)
  state.money_cc = 10000
  return state
}
const wear = (c: Character, slot: GearSlot, base: string, material = 'leather') => {
  const spec = { base, material }
  ;(c.gear ??= {})[slot] = { name: gearName(spec), spec }
}
const qty = (state: GameState, name: string) => state.inventory.find((i) => i.name === name)?.qty ?? 0
/** 帶一位同伴 */
function withMate(state: GameState): Character {
  const mate = characterFor(state, npcRecord(state, 'npc_park_greeter')!)
  mate.id = 'mate'
  state.party.push(mate)
  return mate
}
/** 主角戴著上了白鐵鎖的眼罩（自己鎖的） */
function locked(state: GameState): GearSlot {
  const pc = pcOf(state)
  wear(pc, 'head', 'blindfold')
  addItem(state.inventory, '白鐵鎖', 1)
  lockGear(state, pc.id, 'head', '白鐵鎖')
  return 'head'
}

describe('自己鎖上的鑰匙', () => {
  it('上鎖時鑰匙在自己身上，打開鎖時鎖放回行囊', () => {
    const state = game()
    const pc = pcOf(state)
    const slot = locked(state)
    expect(pc.gear![slot]).toMatchObject({ lock: 'white', keyHolder: 'self' })
    expect(keyCustody(pc.gear![slot], pc)).toBe('self')
    expect(stuckRestraint(pc, slot)).toBeUndefined()
    expect(lockedGear(pc, slot)).toBeUndefined()
    unlockGear(state, pc.id, slot)
    expect(pc.gear![slot]!.lock).toBeUndefined()
    expect(pc.gear![slot]!.keyHolder).toBeUndefined()
    expect(qty(state, '白鐵鎖')).toBe(1)
  })

  it('鑰匙交給同伴：打不開也卸不下，請同伴還回來之後才行；同伴不在隊伍裡時拿不回來', () => {
    const state = game()
    const pc = pcOf(state)
    const mate = withMate(state)
    const slot = locked(state)
    expect(keyKeepers(state, pc).map((k) => k.id)).toEqual(['mate'])
    giveKey(state, pc.id, slot, 'mate')
    expect(pc.gear![slot]!.keyHolder).toBe('mate')
    expect(keyCustody(pc.gear![slot], pc)).toBe('companion')
    expect(() => unlockGear(state, pc.id, slot)).toThrow(`鑰匙在${mate.name}那裡`)
    expect(() => unequipItem(state, pc.id, slot)).toThrow('鑰匙不在自己身上')
    // 不能在這一格換別的
    addItem(state.inventory, '皮眼罩', 1)
    expect(() => equipItem(state, '皮眼罩', pc.id, slot)).toThrow('上了鎖')
    expect(stuckRestraint(pc, slot)).toMatchObject({ self: true, lock: 'white', master: '' })
    // 同伴離隊：鑰匙跟著走
    mate.status.push('away')
    expect(() => takeKeyBack(state, pc.id, slot)).toThrow('不在隊伍裡')
    mate.status = mate.status.filter((x) => x !== 'away')
    takeKeyBack(state, pc.id, slot)
    expect(pc.gear![slot]!.keyHolder).toBe('self')
    unequipItem(state, pc.id, slot)
    expect(qty(state, '白鐵鎖')).toBe(1)
  })

  it('沒有鑰匙時：一次性的鑰匙打得開，鎖跟著壞掉', () => {
    const state = game()
    const pc = pcOf(state)
    const slot = locked(state)
    discardKey(state, pc.id, slot)
    expect(pc.gear![slot]!.keyHolder).toBe('discarded')
    expect(() => unlockGear(state, pc.id, slot)).toThrow('丟掉')
    addItem(state.inventory, '白鐵鑰匙', 1)
    expect(keysFor(state, pc, slot)).toEqual(['白鐵鑰匙'])
    useKey(state, pc.id, slot, '白鐵鑰匙')
    expect(stuckRestraint(pc, slot)).toBeUndefined()
    expect(pc.gear![slot]!.lock).toBeUndefined()
    expect(pc.gear![slot]!.keyHolder).toBeUndefined()
    expect(qty(state, '白鐵鎖')).toBe(0)
    unequipItem(state, pc.id, slot)
  })

  it('沒有鑰匙時：可以脫縛（沒有主人的懲罰），成功時鎖壞掉', () => {
    const state = game()
    const pc = pcOf(state)
    const slot = locked(state)
    discardKey(state, pc.id, slot)
    const fail = prepareAction(state, { kind: 'unbind', target: `${pc.id}:${slot}`, text: '' })
    fail.natural = 2
    resolveAction(state, null)
    expect(pc.status).not.toContain('punished')
    expect(stuckRestraint(pc, slot)).toBeDefined()
    const ok = prepareAction(state, { kind: 'unbind', target: `${pc.id}:${slot}`, text: '' })
    ok.natural = 20
    resolveAction(state, null)
    expect(stuckRestraint(pc, slot)).toBeUndefined()
    expect(qty(state, '白鐵鎖')).toBe(0)
  })

  it('沒有鑰匙時：鐵匠剪鎖，鎖壞掉', () => {
    const state = game()
    const pc = pcOf(state)
    const mate = withMate(state)
    const slot = locked(state)
    giveKey(state, pc.id, slot, mate.id)
    standOn(state, 'smithy')
    const fee = cutLockFee(pc, slot)!
    expect(fee).toBe(lewdRules.unbind.cut.fee_cc.white)
    cutLock(state, pc.id, slot)
    expect(state.money_cc).toBe(10000 - fee)
    expect(pc.gear![slot]!.lock).toBeUndefined()
    expect(pc.gear![slot]!.keyHolder).toBeUndefined()
    expect(qty(state, '白鐵鎖')).toBe(0)
  })

  it('鑰匙在自己身上時，沒有脫縛、剪鎖這些選項', () => {
    const state = game()
    const pc = pcOf(state)
    const slot = locked(state)
    standOn(state, 'smithy')
    expect(cutLockFee(pc, slot)).toBeUndefined()
    expect(() => prepareAction(state, { kind: 'unbind', target: `${pc.id}:${slot}`, text: '' })).toThrow()
  })
})

describe('鑰匙保管提高雙面效應的上限', () => {
  /** 一身上了金鎖的拘束具：加總遠超過上限 */
  function heavy(state: GameState): Character {
    const pc = pcOf(state)
    pc.perks = [...(pc.perks ?? []), 'school_bondage', 'school_flesh']
    for (const [slot, base] of [['wrists', 'armbinder'], ['accessory', 'collar_chain'], ['legs', 'leg_binder'], ['feet', 'ballet_boots'], ['piercing_1', 'shock_pads'], ['underwear_bottom', 'thrust_dildo']] as const) {
      wear(pc, slot, base)
      pc.gear![slot]!.lock = 'gold'
      pc.gear![slot]!.keyHolder = 'self'
    }
    return pc
  }
  const r = lewdRules.locks.key_custody

  it('自己留著：照存檔規則的上限', () => {
    const state = game()
    const pc = heavy(state)
    const tf = twoFaceCombat(pc, state)
    expect(tf.caps).toEqual({ stat: 3, ap: 1, init: 5 })
    // 加總超過丟掉鑰匙時的上限，上限的差別看得出來
    expect(tf.raw.dr).toBeGreaterThanOrEqual(3 + r.discarded.stat)
    expect(tf.rawInitiative).toBeGreaterThanOrEqual(5 + r.discarded.init)
    expect(tf.mods.dr).toBe(3)
    expect(tf.initiative).toBe(5)
    expect(tf.custody).toBeUndefined()
  })

  it('交給同伴：上限提高；兩件都交出去也只算一次', () => {
    const state = game()
    const pc = heavy(state)
    withMate(state)
    pc.gear!.wrists!.keyHolder = 'mate'
    const one = twoFaceCombat(pc, state)
    expect(one.caps).toEqual({ stat: 3 + r.companion.stat, ap: 1 + r.companion.ap, init: 5 + r.companion.init })
    expect(one.mods.dr).toBe(Math.min(one.raw.dr!, 3 + r.companion.stat))
    expect(one.initiative).toBe(Math.min(one.rawInitiative, 5 + r.companion.init))
    pc.gear!.legs!.keyHolder = 'mate'
    expect(twoFaceCombat(pc, state).caps).toEqual(one.caps)
    // 戰鬥中解放的總表用提高後的上限
    const rel = combatRelease(state, pc)
    expect(rel.rows.find((x) => x.key === 'dr')?.value).toBe(one.mods.dr)
    expect(rel.capNote).toContain('交給同伴保管')
  })

  it('丟掉鑰匙：上限提高更多；取最好的一件', () => {
    const state = game()
    const pc = heavy(state)
    withMate(state)
    pc.gear!.wrists!.keyHolder = 'mate'
    pc.gear!.legs!.keyHolder = 'discarded'
    const tf = twoFaceCombat(pc, state)
    expect(tf.caps).toEqual({ stat: 3 + r.discarded.stat, ap: 1 + r.discarded.ap, init: 5 + r.discarded.init })
    expect(tf.custody?.from?.custody).toBe('discarded')
    expect(tf.mods.dr).toBe(Math.min(tf.raw.dr!, 3 + r.discarded.stat))
  })

  it('存檔規則的上限是 0 時，鑰匙保管也不會打開那幾項', () => {
    const state = game()
    const pc = heavy(state)
    pc.gear!.legs!.keyHolder = 'discarded'
    const tf = twoFaceCombat(pc, { options: { bindCapStat: 0, bindCapAp: 0, bindCapInit: 0 } } as never)
    expect(tf.caps).toEqual({ stat: 0, ap: 0, init: 0 })
    expect(tf.mods.dr ?? 0).toBe(0)
  })

  it('交給主人：主人親密度不夠時不肯還；修了隸從派時上限再提高', () => {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    const pc = pcOf(state)
    const master = contractOf(pc)!.master
    expect(state.party.some((x) => x.id === master)).toBe(true)
    const slot = locked(state)
    const k = keyKeepers(state, pc).find((x) => x.id === master)
    expect(k?.master).toBe(true)
    giveKey(state, pc.id, slot, master)
    expect(keyCustody(pc.gear![slot], pc)).toBe('master')
    expect(custodyCaps(pc)).toMatchObject({ stat: r.master.stat, init: r.master.init })
    pc.perks = [...(pc.perks ?? []), 'school_servitude']
    expect(custodyCaps(pc)).toMatchObject({ stat: r.master.stat + r.servitude_master.stat, from: { custody: 'master', servitude: true } })
    state.relationships![master]!.affinity = r.master_affinity - 1
    expect(() => takeKeyBack(state, pc.id, slot)).toThrow('不肯')
    expect(pc.gear![slot]!.keyHolder).toBe(master)
    state.relationships![master]!.affinity = r.master_affinity
    takeKeyBack(state, pc.id, slot)
    expect(pc.gear![slot]!.keyHolder).toBe('self')
  })

  it('鑰匙交給別人保管時，每天順從照「被鎖上的拘束具」成長', () => {
    const run = (holder: string) => {
      const state = game()
      withMate(state)
      const pc = pcOf(state)
      const slot = locked(state)
      if (holder !== 'self') giveKey(state, pc.id, slot, holder)
      const before = baseLewd(pc).submission
      lewdDaily(state, state.time.day, state.time.day + 1)
      return baseLewd(pc).submission - before
    }
    expect(run('mate') - run('self')).toBe(lewdRules.daily.locked.submission ?? 0)
  })
})

describe('舊存檔', () => {
  it('已經自己鎖上的拘束具：鑰匙算在自己身上；別人鎖上的不動', () => {
    const state = game()
    const pc = pcOf(state)
    wear(pc, 'head', 'blindfold')
    pc.gear!.head!.lock = 'blue'
    wear(pc, 'wrists', 'armbinder')
    pc.gear!.wrists!.lock = 'white'
    pc.gear!.wrists!.locked = 'trap:單手套'
    state.schema = 12
    migrate(state)
    expect(pc.gear!.head!.keyHolder).toBe('self')
    expect(pc.gear!.wrists!.keyHolder).toBeUndefined()
    unlockGear(state, pc.id, 'head')
    expect(qty(state, '藍鋼鎖')).toBe(1)
  })
})
