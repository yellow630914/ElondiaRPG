import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, setContentFilters, setMascBodyContent } from '@/engine/content'
import { landmarks, specialMaps } from '@/engine/data'
import { currentArea, currentCell } from '@/engine/grid'
import { equipItem } from '@/engine/inventory'
import { isLactating } from '@/engine/lactation'
import { sanitizeLandmarkMod, sanitizeRole } from '@/engine/landmarkMods'
import { enterLandmark, interiorBlocked, landmarkHere, playLandmarkScene, roleMembers, sceneBlocked, sceneText, scenesHere } from '@/engine/landmarks'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { parasiteOf } from '@/engine/parasites'
import { pcOf } from '@/engine/party'
import { enterSpecial, leaveSpecial } from '@/engine/specialMaps'
import { addItem, newGame, withRng } from '@/engine/state'
import type { Character, GameState } from '@/engine/types'

// 緋夢樂園的主題體驗區（docs/LUST_PARK.md 第 9 節）與場景的身分（docs/LANDMARKS.md 第 6.1 節）

const HALLS = ['lm_park_exp_ranch', 'lm_park_exp_greenhouse', 'lm_park_exp_aquarium', 'lm_park_exp_aquarium_care', 'lm_park_exp_garden', 'lm_park_exp_theater']

beforeEach(() => setContentFilters({ ...DEFAULT_FILTERS }))
afterEach(() => {
  setContentFilters({ ...DEFAULT_FILTERS })
  setMascBodyContent(false)
})

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', gender: '女', seed: 7, birthplace: 'bloodplume' })
  state.money_cc = 5000
  return state
}

/** 一位女性夥伴入隊 */
function mate(state: GameState): Character {
  const rec = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, gender: 'female' })))
  const c = { ...JSON.parse(JSON.stringify(pcOf(state))), id: rec.id, name: rec.name, isPlayer: false, gender: 'female', status: [], bond: 'slave' } as Character
  state.party.push(c)
  return c
}

function wear(state: GameState, who: Character, names: string[]) {
  for (const n of names) {
    addItem(state.inventory, n, 1)
    equipItem(state, n, who.id)
  }
}

/** 從入口廣場走進體驗區，再走進某一館 */
function into(state: GameState, hall?: string) {
  enterSpecial(state, 'sm_lust_park')
  const gate = landmarks.lm_park_experience!
  state.position = { area: gate.at.area, x: gate.at.x, y: gate.at.y }
  enterLandmark(state)
  expect(currentArea(state).special).toBe('sm_park_experience')
  if (!hall) return undefined
  const l = landmarks[hall]!
  state.position = { area: l.at.area, x: l.at.x, y: l.at.y }
  return enterLandmark(state)
}

/** 走到這個場景所在的格子，回傳它的 index */
function at(state: GameState, title: string): number {
  const sc = landmarkHere(state)!.scenes!.find((x) => x.title === title)!
  state.position = { ...state.position!, x: sc.spot!.x, y: sc.spot!.y }
  const i = scenesHere(state).find((x) => x.scene.title === title)?.index
  expect(i, title).toBeDefined()
  return i!
}

const COW = ['亞麻乳牛比基尼', '亞麻牛角頭飾', '銅製牛鈴項圈', '亞麻牛尾腰飾']

describe('主題體驗區的地圖與地標', () => {
  it('入口廣場的閘門通往體驗區，體驗區的六座館各有內部；離開時一層一層回去', () => {
    const state = game()
    into(state)
    for (const id of HALLS) {
      const l = landmarks[id]!
      expect(l.open?.adult, id).toBe(true)
      expect(l.at.area).toBe('sm/sm_park_experience')
      expect(specialMaps[l.interior!]?.peaceful, id).toBe(true)
      expect(l.scenes!.length, id).toBeLessThanOrEqual(12)
      // 每個場景都在館裡的一格，走得到（不是牆或水）
      const grid = specialMaps[l.interior!]!.grid!
      for (const sc of l.scenes!) {
        expect(sc.spot, `${id} ${sc.title}`).toBeDefined()
        expect('.'.includes(grid[sc.spot!.y]![sc.spot!.x]!), `${id} ${sc.title}`).toBe(true)
        expect(sc.tags).toContain('adult')
      }
      // 內建資料已經是整理過的樣子
      expect(sanitizeLandmarkMod(id, JSON.parse(JSON.stringify(l)))).toEqual(JSON.parse(JSON.stringify(l)))
    }
    const ranch = landmarks.lm_park_exp_ranch!
    state.position = { area: ranch.at.area, x: ranch.at.x, y: ranch.at.y }
    enterLandmark(state)
    expect(currentArea(state).special).toBe('sm_park_exp_ranch')
    leaveSpecial(state)
    expect(currentArea(state).special).toBe('sm_park_experience')
    expect(currentCell(state).kind).toBe('lm_park_exp_ranch')
    leaveSpecial(state)
    expect(currentArea(state).special).toBe('sm_lust_park')
    expect(currentCell(state).kind).toBe('lm_park_experience')
  })
})

describe('身分：穿著那一館的服裝的人才能當', () => {
  it('精牛乳牛：主角沒穿、夥伴穿了時由夥伴當，工錢照人數、狀態給夥伴', () => {
    const state = game()
    into(state, 'lm_park_exp_ranch')
    const i = at(state, '在草地上招待遊客')
    expect(sceneBlocked(state, i)).toContain('牛尾腰飾')
    const c = mate(state)
    wear(state, c, COW)
    expect(roleMembers(state, landmarkHere(state)!.scenes![i]!.role!).map((m) => m.id)).toEqual([c.id])
    expect(sceneBlocked(state, i)).toBeUndefined()
    expect(sceneText(state, landmarkHere(state)!.scenes![i]!)).toContain(c.name)
    const money = state.money_cc
    const report = playLandmarkScene(state, i)
    expect(state.money_cc).toBe(money + 80)
    expect(c.status).toContain('aroused')
    expect(pcOf(state).status).not.toContain('aroused')
    expect(report.narration?.adult_scene).toContain(c.name)
    // 主角也穿上：兩個人一起，工錢兩份
    wear(state, pcOf(state), COW)
    state.time.day += 1
    const before = state.money_cc
    playLandmarkScene(state, i)
    expect(state.money_cc).toBe(before + 160)
  })

  it('催乳的牧草奶讓精牛乳牛泌乳，之後才能上榨乳台（內容篩選「泌乳」要開）', () => {
    const state = game()
    into(state, 'lm_park_exp_ranch')
    wear(state, pcOf(state), COW)
    // 篩選關著時，泌乳的場景不出現
    const barn = landmarks.lm_park_exp_ranch!.scenes!.find((x) => x.title === '喝下催乳的牧草奶')!
    state.position = { ...state.position!, x: barn.spot!.x, y: barn.spot!.y }
    expect(scenesHere(state).map((x) => x.scene.title)).not.toContain('喝下催乳的牧草奶')
    setContentFilters({ ...DEFAULT_FILTERS, lactation: true })
    const milk = at(state, '上榨乳台')
    expect(sceneBlocked(state, milk)).toContain('正在泌乳')
    playLandmarkScene(state, at(state, '喝下催乳的牧草奶'))
    expect(isLactating(state, pcOf(state))).toBe(true)
    expect(sceneBlocked(state, at(state, '上榨乳台'))).toBeUndefined()
    const report = playLandmarkScene(state, at(state, '上榨乳台'))
    expect(report.changes.items_gained?.some((x) => x.name === '母乳')).toBe(true)
  })

  it('上榨精台不用泌乳', () => {
    const state = game()
    into(state, 'lm_park_exp_ranch')
    wear(state, pcOf(state), COW)
    // 篩選「泌乳」關著：同一格只剩榨精台與參觀
    expect(sceneBlocked(state, at(state, '上榨精台'))).toBeUndefined()
    expect(scenesHere(state).map((x) => x.scene.title)).toEqual(['參觀榨精榨乳', '上榨精台'])
  })

  it('展示品的場景只給陰柔、中性體型的人（看參加的人自己），參觀的場景不限', () => {
    const state = game()
    into(state, 'lm_park_exp_ranch')
    const c = mate(state)
    c.gender = '男'
    c.body = 'masc'
    wear(state, c, COW)
    const i = at(state, '在草地上招待遊客')
    expect(sceneBlocked(state, i)).toContain('陰柔或中性體型')
    expect(sceneBlocked(state, at(state, '參觀淫犬配種'))).toBeUndefined()
    // 設定「陽剛體型也能遇到」打開時一樣能當
    setMascBodyContent(true)
    expect(sceneBlocked(state, at(state, '在草地上招待遊客'))).toBeUndefined()
  })

  it('遊客的場景不用換衣服，付門票', () => {
    const state = game()
    into(state, 'lm_park_exp_theater')
    const i = at(state, '看魅魔劇團的演出')
    expect(sceneBlocked(state, i)).toBeUndefined()
    const money = state.money_cc
    playLandmarkScene(state, i)
    expect(state.money_cc).toBe(money - 60)
    const staff = at(state, '參與魅魔劇團的演出')
    expect(sceneBlocked(state, staff)).toContain('魅魔裝')
    wear(state, pcOf(state), ['皮革魅魔裝', '銅製魅魔角頭飾'])
    expect(sceneBlocked(state, staff)).toBeUndefined()
  })

  it('苗床：著床只給主角，效果是真的苗床；身上有苗床才能當科普的教材', () => {
    setContentFilters({ ...DEFAULT_FILTERS, monster_brood: true })
    const state = game()
    into(state, 'lm_park_exp_greenhouse')
    const c = mate(state)
    wear(state, c, ['亞麻透視薄紗睡衣'])
    const slug = at(state, '讓蛞蝓著床')
    expect(sceneBlocked(state, slug)).toContain('主角要')
    expect(sceneBlocked(state, at(state, '當科普的教材'))).toContain('苗床')
    wear(state, pcOf(state), ['亞麻透視薄紗睡衣'])
    playLandmarkScene(state, at(state, '讓蛞蝓著床'))
    expect(parasiteOf(pcOf(state), 'brood_slug')).toBeTruthy()
    // 同一種最多一個
    state.time.day += 5
    expect(sceneBlocked(state, at(state, '讓蛞蝓著床'))).toContain('已經有了')
    expect(sceneBlocked(state, at(state, '當科普的教材'))).toBeUndefined()
    // 篩選關掉時著床的場景不出現
    setContentFilters({ ...DEFAULT_FILTERS })
    state.position = { ...state.position!, ...landmarks.lm_park_exp_greenhouse!.scenes!.find((x) => x.title === '讓巨蛛著床')!.spot! }
    expect(scenesHere(state).map((x) => x.scene.title)).toEqual(['參觀巨蛛著床'])
  })

  it('淫植花園：要有人穿得夠少才進得去，進去的人沾上花粉', () => {
    const state = game()
    into(state)
    const l = landmarks.lm_park_exp_garden!
    state.position = { area: l.at.area, x: l.at.x, y: l.at.y }
    expect(interiorBlocked(state)).toContain('曝露度 3')
    const c = mate(state)
    c.gear = {}
    expect(interiorBlocked(state)).toBeUndefined()
    const report = enterLandmark(state)!
    expect(currentArea(state).special).toBe('sm_park_exp_garden')
    expect(report.outcome.summary).toContain(c.name)
    expect(c.status).toEqual(expect.arrayContaining(['aroused', 'sensitive']))
    expect(pcOf(state).status).not.toContain('aroused')
    const i = at(state, '和蓮花妖泡溫泉')
    expect(sceneBlocked(state, i)).toBeUndefined()
    expect(sceneText(state, l.scenes![i]!)).toContain(c.name)
  })
})

describe('身分的整理（內容編輯器）', () => {
  it('留下有意義的欄位', () => {
    expect(sanitizeRole({ name: '' })).toBeUndefined()
    expect(sanitizeRole({ name: '乳牛乳牛乳牛乳牛乳牛', wear: ['cow_bikini', 'cow_bikini', ''], exposure: 9, lactating: true, can_lactate: true, body: ['fem', 'andro', 'bogus' as never], effects: [{ type: 'money', amount: 50 }, { type: 'enslave_player' } as never] }))
      .toEqual({ name: '乳牛乳牛乳牛乳牛', wear: ['cow_bikini'], exposure: 3, lactating: true, body: ['fem', 'andro'], effects: [{ type: 'money', amount: 50 }] })
    // 三種體型都勾＝不限
    expect(sanitizeRole({ name: '乳牛', body: ['masc', 'fem', 'andro'] })).toEqual({ name: '乳牛' })
  })
})
