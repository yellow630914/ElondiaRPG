import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { landmarks, npcs, specialMaps, stories, type StoryDef } from '@/engine/data'
import { activeNodes, nodeIsHere, placeText, startStory } from '@/engine/story'
import { sourcesOf } from '@/engine/sources'
import { currentArea, currentCell, enterLocation, getArea, position, standOn, type CellKind } from '@/engine/grid'
import { enterLandmark, landmarkHere } from '@/engine/landmarks'
import { leaveSpecial } from '@/engine/specialMaps'
import { newGame } from '@/engine/state'
import { setFlag } from '@/engine/storyFlags'
import type { GameState } from '@/engine/types'
import { enterUnderworld, underworldAskBlocked, underworldEntryBlocked, underworldKnown, underworldLandmarks, underworldOf } from '@/engine/underworld'
import { worldFacts } from '@/narrator/worldFacts'

function inTavern(location: string, seed = 5): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'rogue', seed, birthplace: location })
  enterLocation(state)
  expect(standOn(state, 'tavern')).toBe(true)
  return state
}

function ask(state: GameState, natural: number) {
  prepareAction(state, { kind: 'black_market', text: '' })
  state.pendingAction!.natural = natural
  resolveAction(state, null)
}

describe('地下街', () => {
  it('只在有灰色產業的城：黑市或淫鬥場，至少一個', () => {
    const maps = Object.values(specialMaps).filter((m) => m.underworld)
    expect(maps.length).toBe(13)
    for (const m of maps) {
      expect(m.grid?.length, m.id).toBeGreaterThan(0)
      expect(m.peaceful, m.id).toBe(true)
      const inside = underworldLandmarks(m)
      expect(inside.some((l) => l.black_market || l.arena), m.id).toBe(true)
    }
    expect(underworldOf('rhineburg')).toBeUndefined()
    expect(underworldOf('albena')?.id).toBe('sm_uw_albena')
  })

  it('黑檀之夜、榮譽洞、月下拍賣會搬進地下街；黃金骰子賭場留在街上', () => {
    expect(landmarks.lm_ebony_night!.at.area).toBe('sm/sm_uw_soriel')
    expect(landmarks.lm_honor_hole!.at.area).toBe('sm/sm_uw_albena')
    expect(landmarks.lm_auction_house!.at.area).toBe('sm/sm_uw_albena')
    expect(landmarks.lm_golden_dice!.at.area).toBe('albena/market')
  })

  it('在酒館打聽：失敗不知道入口；成功之後從酒館走進去，出口回到酒館', () => {
    const state = inTavern('albena')
    expect(underworldEntryBlocked(state)).toContain('不知道')
    ask(state, 2)
    expect(underworldKnown(state)).toBe(false)
    ask(state, 20)
    expect(underworldKnown(state)).toBe(true)
    expect(underworldAskBlocked(state)).toContain('已經知道')
    const tavern = { ...position(state) }
    enterUnderworld(state)
    expect(currentArea(state).key).toBe('sm/sm_uw_albena')
    expect(state.location).toBe('albena')
    // 黑市、淫鬥場、拍賣會在地圖上；榮譽洞要等伊蓮娜線
    const kinds = currentArea(state).cells.map((c) => c.kind)
    expect(kinds).toEqual(expect.arrayContaining(['lm_uw_black_albena', 'lm_uw_arena_albena', 'lm_auction_house']))
    expect(kinds).not.toContain('lm_honor_hole')
    leaveSpecial(state)
    expect(position(state)).toEqual(tavern)
    expect(currentCell(state).kind).toBe('tavern')
  })

  it('沒有地下街的城不能打聽；不在酒館也不行', () => {
    expect(underworldAskBlocked(inTavern('rhineburg'))).toContain('沒有地下街')
    const state = inTavern('albena')
    standOn(state, 'gate')
    expect(underworldAskBlocked(state)).toContain('酒館')
    expect(() => prepareAction(state, { kind: 'black_market', text: '' })).toThrow('酒館')
  })

  it('舊存檔打聽到黑市的旗標也算知道；劇情開放了裡面的地標也算', () => {
    const old = inTavern('soriel')
    old.flags['black_market:soriel'] = true
    expect(underworldKnown(old)).toBe(true)
    const aya = inTavern('soriel')
    expect(underworldKnown(aya)).toBe(false)
    setFlag(aya, 'aya_club')
    expect(underworldKnown(aya)).toBe(true)
  })

  it('從地下街的俱樂部走進內部，出來時回到俱樂部門口，再從出口回到酒館', () => {
    const state = inTavern('soriel')
    setFlag(state, 'aya_club')
    state.time.hour = 21
    const tavern = { ...position(state) }
    enterUnderworld(state)
    expect(standOn(state, 'lm_ebony_night' as CellKind)).toBe(true)
    const door = { ...position(state) }
    expect(landmarkHere(state)?.id).toBe('lm_ebony_night')
    enterLandmark(state)
    expect(currentArea(state).key).toBe('sm/sm_ebony_night')
    leaveSpecial(state)
    expect(position(state)).toEqual(door)
    expect(state.special?.inner).toBeUndefined()
    leaveSpecial(state)
    expect(position(state)).toEqual(tavern)
  })

  it('還沒開放的地標在地下街裡是空地', () => {
    const state = inTavern('soriel')
    const area = getArea(state, 'sm/sm_uw_soriel')
    const at = landmarks.lm_ebony_night!.at
    expect(area.cells[at.y * area.width + at.x]!.kind).toBe('floor')
    setFlag(state, 'aya_club')
    expect(getArea(state, 'sm/sm_uw_soriel').cells[at.y * area.width + at.x]!.kind).toBe('lm_ebony_night')
  })

  it('交給 AI 的這一帶的事實：知道地下街之前不列裡面的地標', () => {
    const state = inTavern('albena')
    expect(worldFacts(state)).not.toContain('自由集市地下拍賣')
    state.flags['underworld:albena'] = true
    expect(worldFacts(state)).toContain('自由集市地下拍賣（聯邦市集的地下）')
  })

  it('AI 的世界資訊不列還沒開放的地標（黑檀之夜要阿雅線、榮譽洞要伊蓮娜線）', () => {
    const soriel = inTavern('soriel')
    soriel.flags['underworld:soriel'] = true
    expect(worldFacts(soriel)).toContain('外環的地下奴隸販子')
    expect(worldFacts(soriel)).not.toContain('黑檀之夜')
    setFlag(soriel, 'aya_club')
    expect(worldFacts(soriel)).toContain('黑檀之夜（港區的地下）')
    const albena = inTavern('albena')
    albena.flags['underworld:albena'] = true
    expect(worldFacts(albena)).not.toContain('榮譽洞')
  })

  it('任務點可以放在地下街的地標上：站上去就算到了；還不知道地下街時地點提醒先打聽', () => {
    const state = inTavern('albena')
    const def = {
      id: 'zz_uw_node', title: '地下的交易', summary: '', tags: [], start: { kind: 'guild' },
      nodes: [{ id: 'a', title: '交貨', kind: 'story', text: '', at: { where: 'cell', location: 'albena', cell: 'lm_uw_black_albena' }, requires: {}, success: { complete: true } }],
    } as unknown as StoryDef
    ;(stories as StoryDef[]).push(def)
    try {
      startStory(state, def.id)
      const node = () => activeNodes(state).find((n) => n.def.id === def.id)!
      expect(placeText(node().node, state)).toContain('先到酒館打聽地下街')
      ask(state, 20)
      expect(placeText(node().node, state)).toBe('阿爾貝納的自由集市地下拍賣（在聯邦市集的地下裡）')
      enterUnderworld(state)
      expect(nodeIsHere(state, node())).toBe(false)
      expect(standOn(state, 'lm_uw_black_albena' as CellKind)).toBe(true)
      expect(currentArea(state).kind).toBe('special')
      expect(nodeIsHere(state, node())).toBe(true)
    } finally {
      ;(stories as StoryDef[]).splice((stories as StoryDef[]).indexOf(def), 1)
    }
  })

  it('打聽成功的文字、老師的來源寫明在地下街', () => {
    const state = inTavern('soriel')
    ask(state, 20)
    expect(state.reports.at(-1)!.outcome.summary).toContain('打聽到了進港區的地下的路')
    expect(sourcesOf('perk', npcs.find((n) => n.id === 'npc_mentor_bondage')!.mentor!.perks[0]!).join()).toContain('阿爾貝納地下街的月下拍賣會，在酒館打聽')
  })
})
