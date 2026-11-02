import { describe, expect, it } from 'vitest'
import { neighborRegions } from '@/engine/charm'
import { marketStock } from '@/engine/companions'
import { enterLocation } from '@/engine/grid'
import { lewdDaily } from '@/engine/lewd'
import { masterEventWarnings, newMasterEvent } from '@/engine/masterEventMods'
import { npcRecord } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { twoFaceCombat } from '@/engine/schools'
import { newGame } from '@/engine/state'
import { gearName } from '@/engine/gear'
import type { Character } from '@/engine/types'

describe('曝露名聲傳到相鄰地區', () => {
  it('來源地區一直維持 80，20 天後鄰區追到 20 以上', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    const pc = pcOf(state)
    const src = 'south'
    const n = neighborRegions(src)
    expect(n.length).toBeGreaterThan(0)
    for (let d = 0; d < 20; d++) {
      state.exposure = { ...state.exposure, [pc.id]: { ...(state.exposure?.[pc.id] ?? {}), [src]: 80 } }
      lewdDaily(state, d, d + 1)
    }
    for (const r of n) expect(state.exposure![pc.id]![r]).toBeGreaterThanOrEqual(20)
  })
})

describe('奴隸市場', () => {
  it('市場的奴隸帶奴隸標籤', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 3, birthplace: 'albena' })
    enterLocation(state)
    const stock = marketStock(state, 'public')
    expect(stock.length).toBeGreaterThan(0)
    for (const l of stock) expect(npcRecord(state, l.npc)?.tags).toContain('slave')
  })
})

describe('雙面效應的免疫', () => {
  it('程度 1 的腕鐐不免疫繳械，程度 3 的單手套才免疫', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    const pc = pcOf(state)
    pc.perks = ['school_bondage']
    const put = (base: string, material: string) => {
      const spec = { base, material }
      ;(pc.gear ??= {} as Character['gear'])!.wrists = { name: gearName(spec), spec, lock: 'white' }
    }
    put('manacles', 'iron')
    expect(twoFaceCombat(pc).active).toHaveLength(1)
    expect(twoFaceCombat(pc).immune).toEqual([])
    put('armbinder', 'leather')
    expect(twoFaceCombat(pc).immune).toEqual(['disarmed'])
  })
})

describe('主奴與娼館的編輯器警告', () => {
  it('調教、娼館事件不再有 S5 警告；調教事件沒有課程時警告', () => {
    const w = newMasterEvent('mod_mevent_t', 'brothel_work')
    w.text = '接客'
    expect(masterEventWarnings(w).join()).not.toContain('S5')
    const o = newMasterEvent('mod_mevent_o', 'owner')
    o.text = '調教'
    expect(masterEventWarnings(o)).toContain('調教事件沒有選課程：不會被抽到')
    o.course = 'nope'
    expect(masterEventWarnings(o).join()).toContain('沒有「nope」這個課程')
    o.course = 'serve'
    expect(masterEventWarnings(o).join()).not.toContain('課程')
  })
})
