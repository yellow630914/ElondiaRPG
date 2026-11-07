// 認識的人今天在哪（人際關係頁；population.ts 的 whereaboutsOf）
import { describe, expect, it } from 'vitest'
import { locationById, specialMaps } from '@/engine/data'
import { areaKeyName, currentArea, enterLocation, layerKey, outskirtsKey } from '@/engine/grid'
import { allNpcs, areaOf, whereaboutsOf } from '@/engine/population'
import { newGame } from '@/engine/state'

function game(birthplace = 'soriel') {
  const s = newGame({ name: '測試', race: 'human', classId: 'fighter', seed: 4, birthplace })
  enterLocation(s)
  return s
}

describe('今天在哪', () => {
  it('names areas without building maps', () => {
    expect(areaKeyName(outskirtsKey('soriel'))).toBe(`${locationById('soriel').name}近郊`)
    const dungeon = Object.values(specialMaps)[0]
    if (dungeon) expect(areaKeyName(`sm/${dungeon.id}`)).toContain(dungeon.name)
    expect(areaKeyName(layerKey('soriel', 0))).toContain(locationById('soriel').name)
  })

  it('follows the same placement as the map, and notes another continent', () => {
    const s = game()
    const east = allNpcs(s).find((r) => r.id.startsWith('npc_yh_') && areaOf(s, r))!
    const text = whereaboutsOf(s, east.id)
    expect(text).toContain('不在這片大陸')
    expect(text).toContain('炎華之地')
    // 同一片大陸的人不註明
    const local = allNpcs(s).find((r) => areaOf(s, r)?.startsWith('soriel/'))!
    expect(whereaboutsOf(s, local.id)).not.toContain('不在這片大陸')
    expect(whereaboutsOf(s, local.id)).toContain(locationById('soriel').name)
  })

  it('says when someone is dead or nowhere to be found', () => {
    const s = game()
    const rec = allNpcs(s).find((r) => areaOf(s, r))!
    s.npcs = { ...(s.npcs ?? {}), [rec.id]: { ...rec, dead: true } }
    expect(whereaboutsOf(s, rec.id)).toBe('已經不在人世')
    expect(whereaboutsOf(s, 'npc_nobody')).toBe('行蹤不明')
  })

  it('says a captive is with you, not on their usual rounds', () => {
    const s = game()
    const rec = allNpcs(s).find((r) => { const a = areaOf(s, r); return !!a && a !== currentArea(s).key })!
    s.captives = { npcs: [rec.id], aggressor: 'party', location: s.location, area: currentArea(s).key, day: s.time.day }
    expect(whereaboutsOf(s, rec.id)).toBe('被你制伏，在身邊')
  })
})
