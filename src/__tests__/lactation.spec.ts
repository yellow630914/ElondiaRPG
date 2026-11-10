import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, setContentFilters } from '@/engine/content'
import { itemDef } from '@/engine/data'
import { equipItem, useItem } from '@/engine/inventory'
import {
  consentDc, isLactating, lactationCombat, lactationLine, lactationSources, lactationUseBlock,
} from '@/engine/lactation'
import { lewdOf } from '@/engine/lewd'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { answerBirth, familyPrompt, familyTick } from '@/engine/pregnancy'
import { canLactate } from '@/engine/pregMarks'
import { addItem, newGame, withRng } from '@/engine/state'
import { templateBlock } from '@/engine/tattooShop'
import type { Character, GameState } from '@/engine/types'

function game(gender = '女', body?: Character['body']) {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', gender, seed: 11 })
  if (body) pcOf(state).body = body
  return { state, pc: pcOf(state) }
}

/** 一位女性夥伴入隊（bond 決定要不要先答應） */
function mate(state: GameState, bond: Character['bond']): Character {
  const rec = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, gender: 'female' })))
  const c = { ...JSON.parse(JSON.stringify(pcOf(state))), id: rec.id, name: rec.name, isPlayer: false, gender: 'female', status: [], bond } as Character
  state.party.push(c)
  return c
}

beforeEach(() => setContentFilters({ ...DEFAULT_FILTERS, pregnancy: true, lactation: true }))
afterEach(() => setContentFilters({ ...DEFAULT_FILTERS }))

describe('泌乳：誰、開關', () => {
  it('內容篩選「泌乳」預設關閉；關著時道具不能用、不生效', () => {
    expect(DEFAULT_FILTERS.lactation).toBe(false)
    const { state, pc } = game()
    addItem(state.inventory, '催乳茶', 1)
    useItem(state, '催乳茶', pc.id)
    expect(isLactating(state, pc)).toBe(true)
    setContentFilters({ ...DEFAULT_FILTERS })
    expect(isLactating(state, pc)).toBe(false)
    expect(lactationUseBlock(pc)).toContain('泌乳')
  })

  it('女性、扶她、TS 能泌乳；男性不行；陽剛體型的主角不能用泌乳道具、不能刺淫紋・乳泉', () => {
    expect(canLactate({ race: 'human', gender: 'female', isPlayer: false })).toBe(true)
    expect(canLactate({ race: 'human', gender: 'ts', isPlayer: false })).toBe(true)
    expect(canLactate({ race: 'human', gender: 'male', isPlayer: false })).toBe(false)
    const { state, pc } = game('女', 'masc')
    expect(canLactate(pc)).toBe(false)
    addItem(state.inventory, '催乳茶', 1)
    expect(() => useItem(state, '催乳茶', pc.id)).toThrow('不會泌乳')
    expect(templateBlock(state, 'lewd_spring')).toContain('不會泌乳')
    expect(templateBlock(game().state, 'lewd_spring')).toBeUndefined()
    setContentFilters({ ...DEFAULT_FILTERS })
    expect(templateBlock(game().state, 'lewd_spring')).toContain('篩選')
  })
})

describe('泌乳：道具與效果', () => {
  it('催乳茶 3 天：敏感 +5、角色詳情寫到哪一天；到期就沒了', () => {
    const { state, pc } = game()
    const before = lewdOf(pc).sensitivity
    addItem(state.inventory, '催乳茶', 1)
    const r = useItem(state, '催乳茶', pc.id)
    expect(r.changes.items_lost).toEqual([{ name: '催乳茶', qty: 1 }])
    expect(lewdOf(pc).sensitivity).toBe(before + 5)
    expect(lactationLine(state, pc)).toContain(`催乳茶（到第 ${state.time.day + 2} 天）`)
    state.time = { ...state.time, day: state.time.day + 3 }
    familyTick(state)
    expect(isLactating(state, pc)).toBe(false)
    expect(lewdOf(pc).sensitivity).toBe(before)
  })

  it('斷乳藥拿掉道具的泌乳；沒有時不能用', () => {
    const { state, pc } = game()
    addItem(state.inventory, '斷乳藥', 2)
    expect(() => useItem(state, '斷乳藥', pc.id)).toThrow('沒有道具或事件造成的泌乳')
    addItem(state.inventory, '催乳藥劑', 1)
    useItem(state, '催乳藥劑', pc.id)
    expect(lactationSources(state, 'pc')[0]).toMatchObject({ kind: 'item', ref: '催乳藥劑', until: state.time.day + 13 })
    useItem(state, '斷乳藥', pc.id)
    expect(isLactating(state, pc)).toBe(false)
  })

  it('泌乳之環戴著就泌乳（不存來源），卸下就沒了', () => {
    const { state, pc } = game()
    expect(itemDef('泌乳之環')?.lactation).toBe(true)
    addItem(state.inventory, '泌乳之環', 1)
    equipItem(state, '泌乳之環', pc.id)
    expect(isLactating(state, pc)).toBe(true)
    expect(lactationSources(state, 'pc')).toEqual([])
    expect(lactationLine(state, pc)).toContain('泌乳之環（戴著的時候）')
  })

  it('給自由的夥伴用要先答應：DC 看淫亂與親密度；不肯時道具不會用掉、親密度 -2；奴隸不用問', () => {
    const { state } = game()
    const free = mate(state, 'voluntary')
    expect(consentDc(state, free)).toBe(14)
    let refused = false
    for (let i = 0; i < 40 && !refused; i++) {
      addItem(state.inventory, '魔乳果', 1)
      const r = useItem(state, '魔乳果', free.id)
      if (!r.changes.items_lost) refused = true
    }
    expect(refused).toBe(true)
    const slave = mate(state, 'slave')
    addItem(state.inventory, '魔乳果', 1)
    const r = useItem(state, '魔乳果', slave.id)
    expect(r.changes.items_lost).toEqual([{ name: '魔乳果', qty: 1 }])
    expect(isLactating(state, slave)).toBe(true)
  })

  it('戰鬥：修了流派才有效果（慾望上限、受到的慾望 +10%），肉體派 ×1.2', () => {
    const { state, pc } = game()
    addItem(state.inventory, '催乳茶', 1)
    useItem(state, '催乳茶', pc.id)
    expect(lactationCombat(state, pc)).toEqual({ max: 0, taken: 0 })
    pc.perks = [...(pc.perks ?? []), 'school_bondage']
    expect(lactationCombat(state, pc)).toEqual({ max: 0.1, taken: 0.1 })
    pc.perks = [...pc.perks, 'school_flesh']
    expect(lactationCombat(state, pc)).toEqual({ max: 0.12, taken: 0.12 })
  })
})

describe('泌乳：懷孕', () => {
  it('懷孕後期開始泌乳，生產後再 30 天；成人向的提示詞寫泌乳、一般的不寫', () => {
    const { state, pc } = game()
    const day = state.time.day
    state.pregnancies = { pc: { conceived: day, due: day + 40, known: true } }
    state.time = { ...state.time, day: day + 31 }
    familyTick(state)
    expect(lactationSources(state, 'pc')).toEqual([{ kind: 'pregnancy' }])
    expect(isLactating(state, pc)).toBe(true)
    expect(familyPrompt(state, true)).toContain('正在泌乳')
    expect(familyPrompt(state, false)).not.toContain('泌乳')
    state.time = { ...state.time, day: day + 40 }
    familyTick(state)
    answerBirth(state, 'self', '小莉', 'temple')
    expect(lactationSources(state, 'pc')).toEqual([{ kind: 'pregnancy', until: state.time.day + 30 }])
    // 成人場景的提示詞有泌乳、沒有孩子
    expect(familyPrompt(state, true)).not.toContain('小莉')
  })
})
