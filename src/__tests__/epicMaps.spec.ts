import { describe, expect, it } from 'vitest'
import { specialMaps, stories } from '@/engine/data'
import { currentArea, enterLocation, getArea } from '@/engine/grid'
import { applyPendingMove } from '@/engine/road'
import { specialDefeat } from '@/engine/specialMaps'
import { newGame } from '@/engine/state'
import { startStory } from '@/engine/story'
import { setFlag } from '@/engine/storyFlags'

// 史詩的大場面（worldgen/design/elondia-storylines.md、docs/SPECIAL_MAPS.md）：頭目戰在專屬的特殊地圖裡
const EPIC: [string, string, string][] = [
  ['pol_peace_bloodhorn', 'duel', 'sm_bone_arena'],
  ['pol_peace_crusade', 'bell', 'sm_soriel_belltower'],
  ['pol_war_h_bloodplume', 'guard', 'sm_bloodplume_stairs'],
  ['pol_war_d_rhineburg', 'guard', 'sm_rhineburg_ramparts'],
  ['pol_acheron_gaze', 'heroes', 'sm_sky_rift'],
  ['drg_kagni', 'dragon', 'sm_kagni_heart'],
  ['drg_sinor', 'dragon', 'sm_sinor_grotto'],
  ['drg_sorian', 'dragon', 'sm_sorian_dream'],
  ['drg_babelin', 'dragon', 'sm_babelin_spire'],
  ['drg_acheron', 'dragon', 'sm_acheron_echo'],
]
const node = (sid: string, nid: string) => stories.find((s) => s.id === sid)!.nodes.find((n) => n.id === nid)!

describe('epic set pieces', () => {
  it('put every epic boss fight on a cell of its own map, in the right town, with a door that opens with the quest', () => {
    for (const [sid, nid, map] of EPIC) {
      const n = node(sid, nid)
      const m = specialMaps[map]!
      expect(n.at.where, sid).toBe('special')
      expect(n.at.special_map, sid).toBe(map)
      expect(m.grid![n.at.y!]![n.at.x!], sid).toBe('.')
      const door = m.connections![0]!
      expect(door.to.area.split('/')[0], sid).toBe(m.location)
      expect(m.grid![door.at.y]![door.at.x], sid).toBe('E')
      // 開門的旗標是這個任務自己的（接任務或前一個任務點設的）
      const def = stories.find((s) => s.id === sid)!
      const own = [...(def.start_flags ?? []), ...def.nodes.flatMap((x) => [x.success, x.fail, ...(x.options ?? []).map((o) => o.success)].flatMap((o) => o?.set_flags ?? []))]
      expect(own, sid).toContain(door.requires!.flags![0])
    }
  })

  it('sends the party straight in after the step before the fight', () => {
    for (const [sid, nid] of [['pol_peace_bloodhorn', 'challenge'], ['pol_acheron_gaze', 'sky'], ['drg_sorian', 'sleep'], ['drg_acheron', 'rift']] as const) {
      const n = node(sid, nid)
      for (const o of [n.success, n.fail]) expect(o?.special_map, `${sid}:${nid}`).toBeTruthy()
    }
  })

  it('brings you back through the town door after a lost duel, with the star still waiting', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4 })
    state.location = 'bone_hills'
    enterLocation(state)
    startStory(state, 'pol_peace_bloodhorn')
    setFlag(state, 'pol_p2_called')
    state.pendingMove = { special_map: 'sm_bone_arena' }
    applyPendingMove(state)
    const arena = currentArea(state)
    expect(arena.key).toBe('sm/sm_bone_arena')
    expect(arena.cells[2 * arena.width + 6]!.storyNode).toBe('pol_peace_bloodhorn:duel')
    specialDefeat(state)
    expect(currentArea(state).location).toBe('bone_hills')
    const town = getArea(state, 'bone_hills/main')
    const door = town.cells[2 * town.width + 8]!
    expect(door.kind).toBe('link')
    expect(door.link?.area).toBe('sm/sm_bone_arena')
  })
})
