// 自訂內容之間的關聯（contentRefs.ts）：選了一項一定帶上它用到的東西
import { describe, expect, it } from 'vitest'
import { buildRefs, closure, fingerprint, refKey, rewriteRefs, usersOf } from '@/engine/contentRefs'
import { emptyMods, type ContentMods } from '@/engine/mods'

/** 一個小世界：鐘樓的兩個任務、一位 NPC、一件鑰匙、掉鑰匙的怪物、地標、兩張接在一起的特殊地圖、計數器 */
function world(): ContentMods {
  const m = emptyMods() as unknown as Record<string, Record<string, unknown>>
  m.statuses = { mod_status_echo: { name: '迴響', custom: true } }
  m.abilities = { mod_ability_gaze: { name: '凝視', statuses: [{ id: 'mod_status_echo', to: 'target' }], custom: true } }
  m.npcs = {
    mod_npc_edwin: { name: '艾德溫', abilities: ['mod_ability_gaze'], landmark: 'lm_bell_tower', relations: { mod_npc_friend: '朋友' }, custom: true },
    mod_npc_friend: { name: '朋友', custom: true },
    mod_npc_other: { name: '無關的人', custom: true },
  }
  m.items = { 鐘樓的鑰匙: { name: '鐘樓的鑰匙', category: 'misc', custom: true } }
  m.enemies = { mod_enemy_gargoyle: { name: '石像鬼', loot: [{ item: '鐘樓的鑰匙', chance: 0.5 }], custom: true } }
  m.landmarks = { lm_bell_tower: { id: 'lm_bell_tower', name: '鐘樓', custom: true } }
  m.specialMaps = {
    sm_bell_cellar: { id: 'sm_bell_cellar', name: '鐘樓地窖', connections: [{ at: { x: 1, y: 1 }, to: { area: 'sm/sm_crypt', x: 0, y: 0 } }], custom: true },
    sm_crypt: { id: 'sm_crypt', name: '地下墓穴', custom: true },
  }
  m.counters = { bell_mood: { name: '鐘聲', custom: true } }
  m.stories = {
    mod_story_bell1: {
      id: 'mod_story_bell1', title: '鐘樓的幽靈', start: { kind: 'npc', npc: 'mod_npc_edwin' }, start_flags: ['bell_started'],
      nodes: [{ id: 'a', requires: { flags: ['bell_started'] }, success: { set_flags: ['bell_open'], counters: { bell_mood: 1 }, effects: [{ type: 'item', name: '鐘樓的鑰匙' }], complete: true } }],
      custom: true,
    },
    mod_story_bell2: {
      id: 'mod_story_bell2', title: '鐘樓的幽靈・二', start: { kind: 'guild', location: 'soriel', requires: { flags: ['bell_open'], counters: { bell_mood: { min: 1 } } } },
      nodes: [{ id: 'b', at: { where: 'special', special_map: 'sm_bell_cellar' }, requires: { flags: ['ai:ghost_seen'] }, success: { complete: true } }],
      custom: true,
    },
  }
  return m as unknown as ContentMods
}

describe('content refs', () => {
  it('brings everything a story uses, through ids, drops, flags and counters', () => {
    const g = buildRefs(world())
    const got = closure(g, [refKey('stories', 'mod_story_bell2')])
    expect([...got].sort()).toEqual([
      'abilities:mod_ability_gaze', // 艾德溫會的技能
      'counters:bell_mood', // 讀到的計數器
      'enemies:mod_enemy_gargoyle', // 掉落鑰匙的怪物
      'items:鐘樓的鑰匙', // 一的報酬
      'landmarks:lm_bell_tower', // 艾德溫待的地標
      'npcs:mod_npc_edwin', // 一的開頭
      'npcs:mod_npc_friend', // 艾德溫的人際關係
      'specialMaps:sm_bell_cellar', // 任務點的地圖
      'specialMaps:sm_crypt', // 通道接過去的地圖（sm/ 開頭）
      'statuses:mod_status_echo', // 技能施加的狀態
      'stories:mod_story_bell1', // 寫 bell_open 與鐘聲的任務
      'stories:mod_story_bell2',
    ].sort())
    // 反方向不帶：選 NPC 不會帶上用到他的任務，但列得出來
    expect(closure(g, [refKey('npcs', 'mod_npc_edwin')]).has(refKey('stories', 'mod_story_bell1'))).toBe(false)
    expect(usersOf(g, refKey('npcs', 'mod_npc_edwin'))).toEqual([refKey('stories', 'mod_story_bell1')])
    // 沒有人寫的旗標（ai: 由 AI 判定寫）只提示
    expect(g.external.get(refKey('stories', 'mod_story_bell2'))).toEqual(['ai:ghost_seen'])
  })

  it('fingerprints content and renames ids everywhere they are written', () => {
    const m = world()
    expect(fingerprint(m.npcs.mod_npc_edwin)).toMatch(/^[0-9a-f]{8}$/)
    expect(fingerprint(m.npcs.mod_npc_edwin)).toBe(fingerprint(JSON.parse(JSON.stringify(m.npcs.mod_npc_edwin))))
    expect(fingerprint(m.npcs.mod_npc_edwin)).not.toBe(fingerprint(m.npcs.mod_npc_friend))
    const renamed = rewriteRefs(m.npcs.mod_npc_edwin, new Map([['mod_npc_friend', 'mod_npc_friend_1234abcd'], ['lm_bell_tower', 'lm_bell_tower_1234abcd']]))
    expect(renamed).toMatchObject({ landmark: 'lm_bell_tower_1234abcd', relations: { mod_npc_friend_1234abcd: '朋友' } })
    const map = rewriteRefs(m.specialMaps.sm_bell_cellar, new Map([['sm_crypt', 'sm_crypt_2']])) as { connections: { to: { area: string } }[] }
    expect(map.connections[0]!.to.area).toBe('sm/sm_crypt_2')
  })
})
