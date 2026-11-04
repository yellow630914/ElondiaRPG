// 歡愉的惡作劇：改隨機 NPC 的性別（engine/genderSwap.ts）
import { describe, expect, it } from 'vitest'
import { genderSwapBlock, genderSwapNote, swapNpcGender } from '@/engine/genderSwap'
import { generateNpc } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { ensureRelationship } from '@/engine/social'
import { newGame } from '@/engine/state'
import { partyLines } from '@/narrator/judge'

function setup() {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'soriel' })
  const rec = generateNpc(state, new Rng(7), { gender: 'male', race: 'human', kind: 'adventurer' })
  ensureRelationship(state, rec)
  return { state, rec }
}

describe('gender swap prank', () => {
  it('changes a random NPC, rewrites the looks and logs it as an event', () => {
    const { state, rec } = setup()
    const before = rec.appearance
    const report = swapNpcGender(state, rec.id, 'female')
    expect(rec.gender).toBe('female')
    expect(rec.genderSwap).toEqual({ from: 'male', day: state.time.day })
    expect(rec.appearance).not.toBe(before)
    expect(state.relationships![rec.id]!.appearance).toBe(rec.appearance)
    expect(report.outcome.summary).toContain('歡愉的惡作劇')
    expect(report.outcome.summary).toContain('女性')
    expect(state.reports.at(-1)?.report_id).toBe(report.report_id)
    // 記進共同記憶（難忘一點）
    expect(state.memories?.find((m) => m.id === `m-${report.report_id}`)?.importance).toBe(2)
    expect(genderSwapNote(rec)).toBe('這個角色的性別因為歡愉的惡作劇，已經改成女性，以前的記憶以這個為準')
  })

  it('updates the party member too and swaps the default underwear', () => {
    const { state, rec } = setup()
    const m = joinParty(state, rec, 'hired')
    expect(m.gear?.underwear_top?.spec?.base).toBe('undershirt')
    swapNpcGender(state, rec.id, 'female')
    expect(m.gender).toBe('female')
    expect(m.appearance).toBe(rec.appearance)
    expect(m.gear?.underwear_top?.spec?.base).toBe('breast_band')
    expect(m.gear?.underwear_bottom?.spec?.base).toBe('panties')
    expect(partyLines(state)).toContain('歡愉的惡作劇')
  })

  it('refuses fixed NPCs, the player, strangers and the same gender', () => {
    const { state, rec } = setup()
    expect(genderSwapBlock(state, 'npc_selene')).toContain('固定 NPC')
    expect(genderSwapBlock(state, 'pc')).toBeTruthy()
    const stranger = generateNpc(state, new Rng(9), {})
    expect(genderSwapBlock(state, stranger.id)).toContain('認識')
    expect(() => swapNpcGender(state, rec.id, 'male')).toThrow('已經是')
    expect(() => swapNpcGender(state, rec.id, 'dragon')).toThrow('沒有這種性別')
  })
})
