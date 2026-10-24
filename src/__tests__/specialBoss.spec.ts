import { afterEach, describe, expect, it } from 'vitest'
import { enemies, specialMaps, type SpecialMapDef } from '@/engine/data'
import { cellAt, currentArea, getArea, move, placeAt } from '@/engine/grid'
import { enterSpecial } from '@/engine/specialMaps'
import { sanitizeSpecialMapMod } from '@/engine/specialMapMods'
import { newGame } from '@/engine/state'
import { enemyUsage } from '@/engine/usage'

const extra: string[] = []
afterEach(() => {
  for (const id of extra.splice(0)) delete specialMaps[id]
})

const [weak, strong] = Object.values(enemies).sort((a, b) => a.level - b.level).filter((_, i, a) => i === 0 || i === a.length - 1)

const grid = ['#####', '#B.B#', '#...#', '##E##']

describe('special map BOSS cells', () => {
  it('keeps per-cell monsters and names only on cells drawn as B', () => {
    const m = sanitizeSpecialMapMod('sm_test_boss', {
      name: 'BOSS 測試', location: 'rhineburg', grid,
      bosses: [
        { x: 1, y: 1, group: [[strong!.id, 1], ['nope', 2]], name: '  下水道之王  ' },
        { x: 2, y: 1, group: [[weak!.id, 1]] },
        { x: 3, y: 1, group: [], name: '無名的守衛' },
        { x: 3, y: 1, group: [[weak!.id, 9]] },
      ],
    })
    expect(m.bosses).toEqual([
      { x: 1, y: 1, group: [[strong!.id, 1]], name: '下水道之王' },
      { x: 3, y: 1, group: [], name: '無名的守衛' },
    ])
  })

  it('puts the chosen monsters on each BOSS cell and fights them there', () => {
    const def: SpecialMapDef = {
      id: 'sm_test_boss', name: 'BOSS 測試', location: 'rhineburg', desc: '', lighting: 'lit', grid,
      table: [[[weak!.id, 2]]],
      bosses: [{ x: 1, y: 1, group: [[strong!.id, 1]], name: '下水道之王' }],
    }
    specialMaps[def.id] = def
    extra.push(def.id)
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
    enterSpecial(state, def.id)
    const area = currentArea(state)
    expect(cellAt(area, 1, 1)).toMatchObject({ kind: 'boss', group: [[strong!.id, 1]], name: '下水道之王' })
    // 沒設定怪物的 B 格：照強敵（遭遇表最大的一組再多一隻）
    expect(cellAt(area, 3, 1)).toMatchObject({ kind: 'boss', group: [[weak!.id, 3]], name: 'BOSS' })
    placeAt(state, getArea(state, area.key), 1, 2)
    const r = move(state, 0, -1)
    expect(r.combat?.scene).toBe('BOSS 測試・下水道之王')
    expect(enemyUsage(strong!.id)).toContain('特殊地圖「BOSS 測試」的 BOSS 格')
  })
})
