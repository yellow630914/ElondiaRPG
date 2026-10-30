import { describe, expect, it } from 'vitest'
import { setContentFilters, tagsAllowed } from '@/engine/content'
import { dungeonTemplates, resolvePcOption } from '@/engine/dungeonEvents'
import { enterLocation } from '@/engine/grid'
import { equipItem } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { stuckRestraint } from '@/engine/restraints'
import { addItem, newGame } from '@/engine/state'
import { condMet } from '@/engine/storyFlags'
import { baseReport } from '@/engine/town'
import type { GearSlot } from '@/engine/types'

const S9 = ['dg_trap_cuffs', 'dg_trap_rope_suit', 'dg_trap_hood', 'dg_trap_gag', 'dg_chest_key_shackle', 'dg_chest_diary', 'dg_chest_chain_mimic',
  'dg_tide_anemone', 'dg_tide_mermaid', 'dg_sand_altar', 'dg_mummy_wrap', 'dg_ice_warmth', 'dg_giant_toy', 'dg_ember_brand', 'dg_blood_altar',
  'dg_crypt_wedding', 'dg_abbey_confession', 'dg_adv_lust_altar', 'dg_adv_succubus_trial', 'dg_adv_prisoner', 'dg_wear_bells', 'dg_wear_key_goblin',
  'dg_lewd_spring', 'dg_erotic_book']

describe('S9-3 地下城事件', () => {
  const all = dungeonTemplates()
  const mine = all.filter((t) => S9.includes(t.id))

  it('24 件都在，每個地區的地下城至少 2 件專屬', () => {
    expect(mine).toHaveLength(24)
    const groups: Record<string, string[]> = {
      東海: ['tidefall_cave', 'skull_isle'], 西部: ['quicksand_temple', 'echo_canyon'], 北境: ['redemption_pit', 'echo_rift', 'giants_spine'],
      南境: ['ember_rift', 'bloodrock_cave', 'hell_greenhouse'], 墓穴: ['whisper_crypt', 'mist_abbey'],
    }
    for (const [name, ids] of Object.entries(groups)) {
      expect(mine.filter((t) => t.dungeons?.some((d) => ids.includes(d))).length, name).toBeGreaterThanOrEqual(2)
    }
    for (const id of ['dg_adv_lust_altar', 'dg_adv_succubus_trial', 'dg_adv_prisoner']) expect(mine.find((t) => t.id === id)!.layers).toEqual([3, 4])
  })

  it('關掉「主角非自願」時，地下城還有至少 8 件成人向事件', () => {
    setContentFilters({ pc_unwilling: false })
    try {
      expect(mine.filter((t) => tagsAllowed(t.tags)).length).toBeGreaterThanOrEqual(8)
      expect(all.filter((t) => tagsAllowed(t.tags)).length).toBeGreaterThanOrEqual(12)
    } finally {
      setContentFilters({ pc_unwilling: true })
    }
  })

  it('拘束陷阱把拘束具鎖在主角身上', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 4, birthplace: 'rhineburg' })
    enterLocation(state)
    const t = all.find((x) => x.id === 'dg_trap_cuffs')!
    resolvePcOption(state, baseReport(state, 'event', 0), t, t.options![2]!, '地下城事件')
    const pc = pcOf(state)
    const slot = (Object.keys(pc.gear!) as GearSlot[]).find((s) => pc.gear![s]?.name === '皮手銬')!
    expect(stuckRestraint(pc, slot)?.trap).toBe(true)
  })

  it('戴著拘束具、被鎖住時才有的事件', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 4, birthplace: 'rhineburg' })
    enterLocation(state)
    const bells = all.find((x) => x.id === 'dg_wear_bells')!
    const key = all.find((x) => x.id === 'dg_wear_key_goblin')!
    expect(condMet(state, bells.requires)).toBe(false)
    addItem(state.inventory, '腳踝鈴鍊', 1)
    equipItem(state, '腳踝鈴鍊', pcOf(state).id)
    expect(condMet(state, bells.requires)).toBe(true)
    expect(condMet(state, key.requires)).toBe(false)
  })
})
