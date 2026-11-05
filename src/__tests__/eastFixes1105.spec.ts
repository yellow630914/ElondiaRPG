import { describe, expect, it } from 'vitest'
import storiesJson from '@data/rules/stories.json'
import travelJson from '@data/rules/travel_events.json'
import { restrainPc } from '@/engine/forcedGear'
import { enterLocation } from '@/engine/grid'
import { equipItem, putOn, unequipItem } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { roadEventFits, travelEvents } from '@/engine/road'
import { addItem, newGame } from '@/engine/state'
import { canStart, storyWearUnfit } from '@/engine/story'
import { baseReport } from '@/engine/town'
import type { GameState } from '@/engine/types'
import { portraitSubject } from '@/narrator/imageInfo'

type Story = { id: string; tags?: string[]; start: { min_level?: number; requires?: Record<string, unknown> }; nodes: { id: string; at?: Record<string, unknown>; options?: { tags?: string[]; requires?: unknown }[] }[] }
const stories = (storiesJson as unknown as { stories: Story[] }).stories
const by = (id: string) => stories.find((s) => s.id === id)!

function game(race: string): GameState {
  const s = newGame({ name: '測試者', race, classId: 'fighter', seed: 3, birthplace: 'quanzhou' })
  enterLocation(s)
  return s
}

// 炎華之地實測（2026-11-05）的修正
describe('炎華之地：人馬族與限定穿著', () => {
  it('不發限定穿著有主角種族穿不了的任務（打工線要腳鍊、網襪、丁字褲）', () => {
    const centaur = game('centaur')
    const human = game('human')
    const work = ['dance_bazaar', 'dance_chief', 'dance_night', 'expo_parade', 'bath_scrub', 'bath_vip', 'bath_deep', 'mate_paint', 'mate_chase', 'mate_bonfire', 'brine_bride', 'brine_parade', 'brine_spring']
    for (const id of work) {
      const def = by(id) as never
      expect(storyWearUnfit(centaur, def).length, id).toBeGreaterThan(0)
      expect(storyWearUnfit(human, def), id).toEqual([])
      expect(canStart(centaur, def), id).toBe(false)
    }
    // 全部任務裡，人馬族穿不了的就是這 13 條
    const unfit = stories.filter((s) => storyWearUnfit(centaur, s as never).length).map((s) => s.id)
    expect(unfit.sort()).toEqual([...work].sort())
  })

  it('穿不了的原因照種族寫，日誌的欄位照種族叫', () => {
    const s = game('centaur')
    const pc = pcOf(s)
    expect(() => putOn(pc, '皮靴', { base: 'boots', material: 'leather' })).toThrow(/人馬族穿不了一般的鞋子，只能穿人馬族的蹄鐵、蹄靴/)
    expect(() => putOn(pc, '綁帶內褲', { base: 'panties', material: 'cotton' })).toThrow(/人馬族沒有穿內褲的地方（那一格是後蹄/)
    delete pc.gear!.feet
    delete pc.gear!.underwear_bottom
    addItem(s.inventory, '鐵蹄鐵', 2)
    s.customItems = { ...(s.customItems ?? {}), 鐵蹄鐵: { gear: { base: 'horseshoe', material: 'iron' } } as never }
    expect(equipItem(s, '鐵蹄鐵', pc.id, 'underwear_bottom').outcome.summary).toContain('在後蹄裝上了鐵蹄鐵')
    unequipItem(s, pc.id, 'underwear_bottom')
    expect(() => unequipItem(s, pc.id, 'underwear_bottom')).toThrow('後蹄沒有裝備')
  })

  it('步鍊：人馬族戴不上', () => {
    const s = game('centaur')
    expect(restrainPc(s, baseReport(s, 'event', 0), '步鍊')).toBe('人馬族戴不上步鍊')
  })

  it('形象圖把人馬族的後蹄當鞋子：不算穿在裡面、不拉成腰部的構圖', () => {
    const s = game('centaur')
    const pc = pcOf(s)
    pc.gear = { body: pc.gear!.body!, underwear_bottom: { name: '蹄靴', spec: { base: 'hoof_boots', material: 'leather' } } }
    const p = portraitSubject(s, pc.id)!
    expect(p.gear).toContain('蹄靴')
    expect(p.gear.join()).not.toContain('穿在裡面')
    expect(p.composition).toBe('upper body')
  })
})

describe('炎華之地：任務與事件資料', () => {
  it('繡娘的手：工單照陸青禾在哪就在哪交', () => {
    expect(by('yhw_seamstress').nodes.find((n) => n.id === 'give')!.at).toEqual({ where: 'npc', npc: 'npc_yh_lu_qinghe' })
  })

  it('那達慕之後的夜：非人馬族另一條、整條標 NTR', () => {
    const pure = by('tdwn_after_naadam')
    const other = by('tdwn_after_naadam_other')
    expect(pure.start.requires).toEqual({ flags: ['tdwn_1_done'], pc_races: ['centaur'] })
    expect(other.start.requires).toEqual({ flags: ['tdwn_1_done'], pc_races_none: ['centaur'] })
    expect(pure.tags).toEqual(['adult'])
    expect(other.tags).toEqual(['adult', 'ntr'])
    expect(other.nodes.find((n) => n.id === 'want')!.options!.length).toBe(1)
  })

  it('五席的夜宴：等級照立憲（Lv.15）', () => {
    expect(by('yg_five_seats').start.min_level).toBe(15)
  })

  it('遠洋事件去程回程都會遇到；受傷的旅人只在陸路', () => {
    const s = game('human')
    const tpl = (id: string) => travelEvents.templates.find((t) => t.id === id)!
    // 瑔州港 → 潮汐港：要去的是東海群島，出發的是炎華南域
    expect(roadEventFits(s, tpl('yhe_whales'), 'sea', ['east_sea', 'yanhua_south'])).toBe(true)
    expect(roadEventFits(s, tpl('yhe_whales'), 'sea', ['yanhua_south', 'east_sea'])).toBe(true)
    // 潮汐港 ↔ 珊瑚灣不會遇到
    expect(roadEventFits(s, tpl('yhe_whales'), 'sea', ['east_sea', 'east_sea'])).toBe(false)
    expect(roadEventFits(s, tpl('wounded_traveler'), 'sea', 'central')).toBe(false)
    expect(roadEventFits(s, tpl('wounded_traveler'), 'road', 'central')).toBe(true)
    const stow = (travelJson as unknown as { templates: { id: string; text: string }[] }).templates.find((t) => t.id === 'yhe_stowaway')!
    expect(stow.text).toContain('瑔州港')
  })
})
