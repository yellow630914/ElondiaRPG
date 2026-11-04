import { describe, expect, it } from 'vitest'
import { geography } from '@/engine/data'
import overview from '../../assets/map/world-overview.json'

// 世界總覽圖（MapPanel 的「世界總覽」）：每個內建聚落都要有位置，才畫得出它的圖形
describe('world overview map', () => {
  it('places every built-in settlement inside the picture', () => {
    const places = overview.places as Record<string, number[]>
    const settlements = geography.locations.filter((l) => l.type !== 'dungeon' && !l.requires)
    for (const l of settlements) {
      const p = places[l.id]
      expect(p, `${l.name} 沒有位置`).toBeTruthy()
      expect(p![0]! > 0 && p![0]! < overview.width && p![1]! > 0 && p![1]! < overview.height, l.id).toBe(true)
    }
    for (const id of [...Object.keys(places), ...overview.labeled]) expect(settlements.some((l) => l.id === id), id).toBe(true)
  })
})
