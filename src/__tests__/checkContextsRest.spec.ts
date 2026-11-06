import { describe, expect, it } from 'vitest'
import { abilities, masterEventPool, npcs as namedNpcs } from '@/engine/data'
import { abilityUsage } from '@/engine/mods'
import { pcOf } from '@/engine/party'
import { checkBonus } from '@/engine/perks'
import { restEventBlock } from '@/engine/rest'
import { roll } from '@/engine/road'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(perks: string[] = []): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
  pcOf(state).perks = perks
  return state
}

// 力量檢定：城鎮事件沒寫分類時照屬性推成「勞動」，野外求生（求生、察覺）不算
const total = (state: GameState, scope: 'road' | 'town') => roll(state, { attr: 'str', dc: 30 }, 10, scope).entry.roll?.value ?? NaN

describe('旅途事件也算 travel 情境（B15）', () => {
  it('只寫 travel 的加減在旅途事件生效，城鎮事件不算', () => {
    const base = total(game(), 'road')
    expect(total(game(['survivor']), 'road')).toBe(base + 1)
    expect(total(game(['survivor']), 'town')).toBe(total(game(), 'town'))
  })

  it('同一個條件寫了 travel 與 road 只算一次', () => {
    const pc = pcOf(game(['pathfinder']))
    expect(checkBonus(pc, { context: 'road', also: ['travel'] })).toBe(checkBonus(pc, { context: 'road' }))
    expect(total(game(['pathfinder']), 'road')).toBe(total(game(), 'road') + 2)
  })
})

describe('等待中的旅途、城鎮事件擋住休息（B16）', () => {
  it('townEvent、roadEvent 都擋', () => {
    const state = game()
    expect(restEventBlock(state)).toBeNull()
    state.townEvent = { template: 'x' }
    expect(restEventBlock(state)).toBeTruthy()
    delete state.townEvent
    state.roadEvent = { x: 1, template: 'x' }
    expect(restEventBlock(state)).toBeTruthy()
  })
})

describe('被教的技能列進引用（B17）', () => {
  it('固定 NPC 的 teaches', () => {
    // 內建的娼婦都用預設清單，借一位 NPC 暫時掛上
    const npc = namedNpcs[0]!
    const id = Object.values(abilities).find((a) => a.classes.includes('lewd') && !npc.abilities?.includes(a.id))!.id
    const before = npc.teaches
    npc.teaches = [id]
    try {
      expect(abilityUsage(id)).toContain(`固定 NPC「${npc.name}」（光顧時會教）`)
    } finally {
      if (before) npc.teaches = before
      else delete npc.teaches
    }
  })

  it('主奴與娼館的事件掛的技能', () => {
    const ev = masterEventPool('brothel_train').find((e) => e.teaches?.length)!
    const id = ev.teaches![0]!
    expect(abilities[id]).toBeTruthy()
    // 寫成「事件庫「id：開頭幾個字…」（會教）」
    expect(abilityUsage(id).some((u) => u.includes(`「${ev.id}：`) && u.endsWith('（會教）'))).toBe(true)
  })
})
