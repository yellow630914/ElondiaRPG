// 套裝（engine/gearSets.ts）：存、預覽、換上、跳過換不了的
import { describe, expect, it } from 'vitest'
import { applyGearSet, deleteGearSet, GEAR_SET_MAX, overwriteGearSet, planGearSet, renameGearSet, saveGearSet, setGearSetSlot, wornGearSet } from '@/engine/gearSets'
import { gearName } from '@/engine/gear'
import { equipItem } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { newGame } from '@/engine/state'
import type { GameState, GearSpec } from '@/engine/types'

const LONG: GearSpec = { base: 'longsword', material: 'steel' }
const MACE: GearSpec = { base: 'mace', material: 'iron' }
const CHAIN: GearSpec = { base: 'chain', material: 'iron' }
const RING_A: GearSpec = { base: 'ring_precision', material: 'silver' }
const RING_B: GearSpec = { base: 'ring_guard', material: 'silver' }

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 5 })
  const pc = pcOf(state)
  pc.gear = { main_hand: { name: gearName(LONG), spec: LONG } }
  for (const s of [MACE, CHAIN, RING_A, RING_B]) state.inventory.push({ name: gearName(s), qty: 1 })
  return state
}
const qty = (state: GameState, name: string) => state.inventory.find((i) => i.name === name)?.qty ?? 0

describe('套裝', () => {
  it('存成套裝、換上別的、再換回來；行囊跟著加減', () => {
    const state = game()
    const pc = pcOf(state)
    expect(saveGearSet(state, pc.id, '平常')).toBe(0)
    equipItem(state, gearName(MACE), pc.id, 'main_hand')
    equipItem(state, gearName(CHAIN), pc.id, 'body')
    saveGearSet(state, pc.id, '戰鬥')
    expect(wornGearSet(pc)).toBe(1)
    // 「平常」只寫了主手：身體不動
    expect(planGearSet(state, pc.id, 0)).toEqual([{ slot: 'main_hand', label: expect.any(String), now: gearName(MACE), want: gearName(LONG), status: 'put' }])
    const r = applyGearSet(state, pc.id, 0)
    expect(pc.gear!.main_hand!.name).toBe(gearName(LONG))
    expect(pc.gear!.body!.name).toBe(gearName(CHAIN))
    expect(qty(state, gearName(MACE))).toBe(1)
    expect(qty(state, gearName(LONG))).toBe(0)
    expect(r.outcome.summary).toContain('換上了「平常」')
    expect(r.time.end.minute! - (r.time.start.minute ?? 0) + 60 * ((r.time.end.hour ?? 0) - (r.time.start.hour ?? 0))).toBe(15)
    applyGearSet(state, pc.id, 1)
    expect(pc.gear!.main_hand!.name).toBe(gearName(MACE))
    expect(wornGearSet(pc)).toBe(1)
  })

  it('這一格脫掉；不動的格子保持原樣；改名、覆蓋、刪除、最多五套', () => {
    const state = game()
    const pc = pcOf(state)
    equipItem(state, gearName(CHAIN), pc.id, 'body')
    saveGearSet(state, pc.id)
    expect(pc.gearSets![0]!.name).toBe('套裝 1')
    setGearSetSlot(state, pc.id, 0, 'body', 'off')
    setGearSetSlot(state, pc.id, 0, 'main_hand', 'keep')
    expect(planGearSet(state, pc.id, 0).map((x) => [x.slot, x.status])).toEqual([['body', 'off']])
    applyGearSet(state, pc.id, 0)
    expect(pc.gear!.body).toBeUndefined()
    expect(pc.gear!.main_hand!.name).toBe(gearName(LONG))
    expect(qty(state, gearName(CHAIN))).toBe(1)
    // 改回「換成這件」（記得是哪一件）
    setGearSetSlot(state, pc.id, 0, 'body', 'put')
    expect(pc.gearSets![0]!.slots.body).toEqual({ item: gearName(CHAIN) })
    expect(() => setGearSetSlot(state, pc.id, 0, 'head', 'put')).toThrow('沒有記下')
    renameGearSet(state, pc.id, 0, '  街上  ')
    expect(pc.gearSets![0]!.name).toBe('街上')
    overwriteGearSet(state, pc.id, 0)
    expect(pc.gearSets![0]!.slots).toEqual({ main_hand: { item: gearName(LONG) } })
    for (let i = 1; i < GEAR_SET_MAX; i++) saveGearSet(state, pc.id)
    expect(() => saveGearSet(state, pc.id)).toThrow(`最多 ${GEAR_SET_MAX} 套`)
    deleteGearSet(state, pc.id, 0)
    expect(pc.gearSets!.length).toBe(GEAR_SET_MAX - 1)
  })

  it('戒指在兩格之間交換', () => {
    const state = game()
    const pc = pcOf(state)
    equipItem(state, gearName(RING_A), pc.id, 'ring_1')
    equipItem(state, gearName(RING_B), pc.id, 'ring_2')
    saveGearSet(state, pc.id, 'A')
    pc.gearSets![0]!.slots.ring_1 = { item: gearName(RING_B) }
    pc.gearSets![0]!.slots.ring_2 = { item: gearName(RING_A) }
    expect(planGearSet(state, pc.id, 0).filter((x) => x.status === 'put').map((x) => x.slot)).toEqual(['ring_1', 'ring_2'])
    applyGearSet(state, pc.id, 0)
    expect(pc.gear!.ring_1!.name).toBe(gearName(RING_B))
    expect(pc.gear!.ring_2!.name).toBe(gearName(RING_A))
    expect(qty(state, gearName(RING_A))).toBe(0)
  })

  it('換不了的跳過並寫出原因：鎖住的、在別人身上的、行囊裡沒有的', () => {
    const state = game()
    const pc = pcOf(state)
    const legs: GearSpec = { base: 'leg_binder', material: 'leather' }
    pc.gear!.legs = { name: gearName(legs), spec: legs, lock: 'white', keyHolder: 'discarded' }
    const friend = { ...pc, id: 'buddy', name: '塞拉斯', isPlayer: false, gear: { main_hand: { name: gearName(MACE), spec: MACE } } }
    state.party.push(friend as never)
    state.inventory = state.inventory.filter((i) => i.name !== gearName(MACE))
    pc.gearSets = [{ name: '試', slots: { legs: { off: true }, main_hand: { item: gearName(MACE) }, body: { item: '不存在的盔甲' }, ring_1: { item: gearName(RING_A) } } }]
    state.inventory = state.inventory.filter((i) => i.name !== gearName(RING_A))
    const rows = planGearSet(state, pc.id, 0)
    expect(Object.fromEntries(rows.map((x) => [x.slot, x.reason ?? x.status]))).toEqual({
      main_hand: '在塞拉斯身上', body: '這件裝備已經不存在', legs: `${gearName(legs)}上了鎖，鑰匙已經丟掉了`, ring_1: '行囊裡沒有了',
    })
    const r = applyGearSet(state, pc.id, 0)
    expect(pc.gear!.main_hand!.name).toBe(gearName(LONG))
    expect(pc.gear!.legs).toBeTruthy()
    expect(r.outcome.summary).toContain('沒換：')
    expect(r.outcome.summary).toContain('在塞拉斯身上')
  })

  it('鎖住的原因分開寫：主人強制、詛咒、陷阱、鑰匙在誰身上', () => {
    const state = game()
    const pc = pcOf(state)
    state.party.push({ ...pc, id: 'buddy', name: '塞拉斯', isPlayer: false, gear: {} } as never)
    const wear = (slot: 'head' | 'wrists' | 'leg_accessory' | 'accessory', base: string, extra: object) => {
      const spec = { base, material: 'iron' }
      ;(pc.gear as Record<string, unknown>)[slot] = { name: gearName(spec), spec, ...extra }
      return gearName(spec)
    }
    const head = wear('head', 'blindfold', { lock: 'white', keyHolder: 'buddy' })
    const wrists = wear('wrists', 'manacles', { locked: 'curse:x' })
    const legs = wear('leg_accessory', 'shackles', { locked: 'trap:x' })
    pc.gearSets = [{ name: '試', slots: { head: { off: true }, wrists: { off: true }, leg_accessory: { off: true } } }]
    expect(Object.fromEntries(planGearSet(state, pc.id, 0).map((x) => [x.slot, x.reason]))).toEqual({
      head: `${head}上了鎖，鑰匙在塞拉斯身上`, wrists: `${wrists}被詛咒鎖住`, leg_accessory: `${legs}被陷阱鎖住`,
    })
  })

  it('不動也記得原本那件；預設名字不重複；拿著雙手武器時副手預覽就寫換不了', () => {
    const state = game()
    const pc = pcOf(state)
    saveGearSet(state, pc.id)
    setGearSetSlot(state, pc.id, 0, 'main_hand', 'keep')
    expect(planGearSet(state, pc.id, 0)).toEqual([])
    setGearSetSlot(state, pc.id, 0, 'main_hand', 'put')
    expect(pc.gearSets![0]!.slots.main_hand).toEqual({ item: gearName(LONG) })
    saveGearSet(state, pc.id)
    saveGearSet(state, pc.id)
    deleteGearSet(state, pc.id, 1)
    saveGearSet(state, pc.id)
    expect(pc.gearSets!.map((x) => x.name)).toEqual(['套裝 1', '套裝 3', '套裝 4'])
    // 雙手武器：主手不動、套裝只寫副手
    const GREAT: GearSpec = { base: 'greatsword', material: 'steel' }
    const SHIELD: GearSpec = { base: 'shield', material: 'iron' }
    for (const x of [GREAT, SHIELD]) state.inventory.push({ name: gearName(x), qty: 1 })
    equipItem(state, gearName(SHIELD), pc.id, 'off_hand')
    pc.gearSets = [{ name: '盾', slots: { off_hand: { item: gearName(SHIELD) } } }, { name: '雙手加盾', slots: { main_hand: { item: gearName(GREAT) }, off_hand: { item: gearName(SHIELD) } } }]
    equipItem(state, gearName(GREAT), pc.id, 'main_hand')
    expect(planGearSet(state, pc.id, 0)).toMatchObject([{ slot: 'off_hand', status: 'skip', reason: `${gearName(GREAT)}要用雙手，副手空不出來` }])
    equipItem(state, gearName(LONG), pc.id, 'main_hand')
    expect(planGearSet(state, pc.id, 1).map((x) => x.status)).toEqual(['put', 'skip'])
  })
})
