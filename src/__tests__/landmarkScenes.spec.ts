import { afterEach, describe, expect, it } from 'vitest'
import { landmarks, stories } from '@/engine/data'
import { setAdultContent, setContentFilters } from '@/engine/content'
import { enterLocation, getArea, standOn } from '@/engine/grid'
import { sanitizeLandmarkMod, sanitizeScene } from '@/engine/landmarkMods'
import { landmarkHere, playLandmarkScene, sceneBlocked, sceneText, scenesHere } from '@/engine/landmarks'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { newGame } from '@/engine/state'
import { setFlag } from '@/engine/storyFlags'
import type { GameState } from '@/engine/types'

afterEach(() => {
  setAdultContent(false)
  setContentFilters({ ntr: true })
  applyContent(emptyMods())
})

const AREAS = ['lm_wives_salon', 'lm_maid_cafe', 'lm_ebony_night', 'lm_succubus_banquet', 'lm_idol_backstage', 'lm_honor_hole']

function at(id: string, flags: string[], body?: 'masc' | 'fem' | 'andro'): GameState {
  setAdultContent(true)
  const l = landmarks[id]!
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4, birthplace: l.location, ...(body ? { body } : {}) })
  for (const f of flags) setFlag(state, f)
  state.time.hour = 21
  enterLocation(state)
  expect(standOn(state, id as never), id).toBe(true)
  return state
}
const titles = (state: GameState) => scenesHere(state).map((x) => x.scene.title)
const index = (state: GameState, title: string) => scenesHere(state).find((x) => x.scene.title === title)!.index

describe('special areas unlocked by the storylines', () => {
  it('are adult landmarks that stay a plain road until their quest flags are set', () => {
    for (const id of AREAS) {
      const l = landmarks[id]!
      expect(l.open?.hidden, id).toBe(true)
      expect(l.open?.adult, id).toBe(true)
      expect(l.open?.flags?.length, id).toBeGreaterThan(0)
      expect(l.scenes?.length, id).toBeGreaterThan(0)
      setAdultContent(true)
      const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4, birthplace: l.location })
      enterLocation(state)
      const cell = () => getArea(state, l.at.area).cells[l.at.y * getArea(state, l.at.area).width + l.at.x]!.kind
      expect(cell(), id).toBe('floor')
      for (const f of l.open!.flags!) setFlag(state, f)
      expect(cell(), id).toBe(id)
      // 成人向關著時不出現
      setAdultContent(false)
      expect(cell(), id).toBe('floor')
    }
  })

  it('opens the tea parlour with Mimi and Eve; Ren and the closed-shop scene need her back on land', () => {
    const state = at('lm_maid_cafe', ['mimi_lover', 'eve_lover'])
    expect(titles(state)).toEqual(['在前廳喝茶', '和米米去小房間', '和伊芙去小房間'])
    const tea = landmarks.lm_maid_cafe!.scenes!.find((s) => s.title === '在前廳喝茶')!
    expect(sceneText(state, tea)).toContain('米米、伊芙')
    expect(sceneText(state, tea)).not.toContain('漣')
    setFlag(state, 'ren_lover')
    setFlag(state, 'ren_sea')
    expect(titles(state)).not.toContain('和漣去小房間')
    const land = at('lm_maid_cafe', ['mimi_lover', 'eve_lover', 'ren_lover', 'ren_land'])
    expect(titles(land)).toEqual(['在前廳喝茶', '和米米去小房間', '和伊芙去小房間', '和漣去小房間', '暫時關店，和三個人一起'])
  })

  it('lets you come back every three days, while tea at the front stays daily', () => {
    const state = at('lm_maid_cafe', ['mimi_lover', 'eve_lover'])
    state.time.hour = 10
    state.money_cc = 500
    const r = playLandmarkScene(state, index(state, '和米米去小房間'))
    expect(r.narration?.adult_scene).toContain('米米')
    expect(r.changes.affinity?.some((a) => a.npc === 'npc_mimi' && a.delta === 3)).toBe(true)
    expect(sceneBlocked(state, index(state, '和伊芙去小房間'))).toBe('3 天後才能再來')
    expect(sceneBlocked(state, index(state, '在前廳喝茶'))).toBeUndefined()
    const tea = playLandmarkScene(state, index(state, '在前廳喝茶'))
    expect(tea.narration?.adult_scene).toBeUndefined()
    expect(state.money_cc).toBe(470)
    expect(sceneBlocked(state, index(state, '在前廳喝茶'))).toBe('1 天後才能再來')
    state.time.day += 3
    expect(sceneBlocked(state, index(state, '和伊芙去小房間'))).toBeUndefined()
  })

  it('brings the twins, Lucia and Noel to the banquet only as lovers, and other succubi otherwise', () => {
    const collared = at('lm_succubus_banquet', ['cas_lover', 'cas_collared'])
    expect(titles(collared)).toEqual(['戴著項圈的女王'])
    const sc = landmarks.lm_succubus_banquet!.scenes![0]!
    expect(sceneText(collared, sc)).toContain('卡珊卓、其他不知名的魅魔')
    setFlag(collared, 'twin_lovers')
    setFlag(collared, 'luc_lover')
    setFlag(collared, 'noel_lover')
    expect(sceneText(collared, sc)).toContain('卡珊卓、蘿娜、菈娜、露西菈、諾艾爾')
    expect(sceneText(collared, sc)).not.toContain('不知名')
    const free = at('lm_succubus_banquet', ['cas_lover', 'cas_free'])
    expect(titles(free)).toEqual(['被女王們玩弄', '被女王們服侍'])
  })

  it('lets only a feminine or androgynous hero join Aya, and hides the club with NTR turned off', () => {
    expect(titles(at('lm_ebony_night', ['aya_club'], 'masc'))).toEqual(['看阿雅和水手們'])
    expect(titles(at('lm_ebony_night', ['aya_club'], 'fem'))).toEqual(['看阿雅和水手們', '和阿雅一起侍奉水手們'])
    const andro = at('lm_ebony_night', ['aya_club'], 'andro')
    expect(titles(andro)).toHaveLength(2)
    setContentFilters({ ntr: false })
    expect(titles(andro)).toEqual([])
  })

  it('opens the honor hole after Elena tells you about it in her first quest', () => {
    expect(landmarks.lm_honor_hole!.open?.flags).toEqual(['wl_1_done'])
    const first = stories.find((s) => s.id === 'lab_medium')!
    expect(JSON.stringify(first)).toContain('榮譽洞')
    expect(JSON.stringify(first)).toContain('精液或愛液')
    const state = at('lm_honor_hole', ['wl_1_done'])
    expect(titles(state)).toEqual(['當服務的一方', '當被服務的一方'])
    expect(landmarkHere(state)?.id).toBe('lm_honor_hole')
  })

  it('needs the wives and the idols all there, and is gone with adult content off', () => {
    const tea = at('lm_wives_salon', ['group_wives_done'])
    expect(sceneText(tea, landmarks.lm_wives_salon!.scenes![0]!)).toContain('瑪格麗特・馮・艾森、莉澤洛特、克拉拉')
    const idols = at('lm_idol_backstage', ['group_idols_done'])
    expect(titles(idols)).toEqual(['演出後替三人「充電」'])
    setAdultContent(false)
    expect(titles(idols)).toEqual([])
    expect(() => playLandmarkScene(idols, 0)).toThrow()
  })
})

describe('landmark scenes in the content editor', () => {
  it('keeps the fields that make sense and drops the rest', () => {
    const sc = sanitizeScene({
      title: '測試', scene: '{cast}在這裡', tags: ['adult', 'bogus'], pc_body: ['fem', 'masc', 'andro'],
      cast: [{ npc: 'npc_mimi', flags: ['x'] }, { npc: 'nobody' }, { npc: 'npc_mimi' }], cooldown_days: 3, affinity: 99, own_cooldown: true,
      requires: { flags: ['a'], flags_none: [] },
    })!
    expect(sc).toEqual({ title: '測試', scene: '{cast}在這裡', tags: ['adult'], cast: [{ npc: 'npc_mimi', flags: ['x'] }], hours: 2, affinity: 30, own_cooldown: true, requires: { flags: ['a'] } })
    expect(sanitizeScene({ title: '沒有經過', scene: '' })).toBeUndefined()
  })

  it('saves a landmark with its scenes and the adult switch', () => {
    const l = JSON.parse(JSON.stringify(landmarks.lm_maid_cafe)) as never
    const m = sanitizeLandmarkMod('lm_maid_cafe', l)
    expect(m.open?.adult).toBe(true)
    expect(m.scenes).toEqual(landmarks.lm_maid_cafe!.scenes)
    applyContent(normalizeMods({ ...emptyMods(), landmarks: { lm_maid_cafe: { ...m, scenes: m.scenes!.slice(0, 1) } } }))
    expect(landmarks.lm_maid_cafe!.scenes).toHaveLength(1)
  })
})

describe('characters moved by their story stage', () => {
  it('are not rewritten each time they are looked up, so the map does not keep redrawing', async () => {
    const { npcRecord } = await import('@/engine/npcs')
    setAdultContent(true)
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4, birthplace: 'dawnlight' })
    setFlag(state, 'eve_lover')
    const first = npcRecord(state, 'npc_eve')!
    expect(first.stage).toBeDefined()
    const haunts = first.haunts
    const again = npcRecord(state, 'npc_eve')!
    expect(again).toBe(first)
    expect(again.haunts).toBe(haunts)
  })
})
