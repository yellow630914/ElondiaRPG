import { afterEach, describe, expect, it } from 'vitest'
import { setAdultContent } from '@/engine/content'
import { itemRules, stories, type StoryDef } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { npcRecord } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { newGame } from '@/engine/state'
import { playNode, startStory } from '@/engine/story'
import { setFlag } from '@/engine/storyFlags'
import { sanitizeOutcome, storyCheck, STORY_SCENE_CHARS } from '@/engine/storyMods'
import type { Report } from '@/engine/types'

afterEach(() => setAdultContent(false))

const story = (id: string) => stories.find((s) => s.id === id)!
const outcomes = (s: StoryDef) => s.nodes.flatMap((n) => [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])]).filter(Boolean)

describe('intimate scenes in special quests', () => {
  it('keep the scene through the sanitizer, clipped, and only in adult quests', () => {
    expect(sanitizeOutcome({ text: 'a', scene: '  兩人在床上  ' })).toEqual({ text: 'a', scene: '兩人在床上' })
    expect(sanitizeOutcome({ scene: 'x'.repeat(400) })!.scene!.length).toBe(STORY_SCENE_CHARS)
    const s = structuredClone(story('ren_tide_home'))
    s.tags = []
    expect(storyCheck(s).errors.some((e) => e.includes('親密場景'))).toBe(true)
  })

  it('give every lovers finale of an adult character line a scene in every branch', () => {
    // 成人向角色線的最後一個任務（「三」）：結局的每個選項都有親密場景
    const finals = ['lilian_graduation', 'isadora_elope', 'aya_last_confession', 'serena_sea', 'amelia_ring', 'lab_guild_return', 'lena_lighter_love',
      'valerie_hearing', 'eve_master', 'luc_eighth_exam', 'cas_queen_kneels', 'twin_same_person', 'noel_getting_serious', 'zero_definition',
      'kar_arena_trophy', 'oboro_shadow_heart', 'belv_not_a_toy', 'pru_swamp_wedding', 'ila_hundred_years', 'mimi_opening_day',
      'stella_star_confession', 'noir_song_for_whom', 'pom_guard_contract', 'marg_masked_ball', 'liese_harvest_festival', 'clara_last_chapter', 'ren_tide_home']
    for (const id of finals) {
      const last = story(id).nodes.at(-1)!
      for (const o of last.options!) expect(o.success?.scene, `${id} ${o.label}`).toBeTruthy()
    }
    // 艾琳的新婚之夜在夢裡
    const dream = story('eil_hundred_year_wedding').nodes.find((n) => n.id === 'dream')!
    expect([dream.success?.scene, dream.fail?.scene].every(Boolean)).toBe(true)
    // 每個有場景的任務都是成人向
    for (const s of stories) if (outcomes(s).some((o) => o!.scene)) expect(s.tags, s.id).toContain('adult')
  })

  it('give the romance fourths of the non-adult lines a scene on the night', () => {
    const fourths = stories.filter((s) => s.nodes.some((n) => n.id === 'night') && s.summary.includes('・四）'))
    expect(fourths.length).toBeGreaterThanOrEqual(23)
    for (const s of fourths) for (const o of s.nodes.find((n) => n.id === 'night')!.options!) expect(o.success?.scene, s.id).toBeTruthy()
  })

  it('hand the scene to the narration as an adult scene when adult content is on', () => {
    // 成人向關閉時這類任務整個暫停，不會走到這裡
    const play = () => {
      setAdultContent(true)
      const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3 })
      enterLocation(state)
      startStory(state, 'ren_tide_home')
      const def = story('ren_tide_home')
      const sea = def.nodes.find((n) => n.id === 'sea')!
      for (const f of sea.requires?.flags ?? []) setFlag(state, f)
      joinParty(state, npcRecord(state, 'npc_ren')!, 'guest')
      return playNode(state, 'ren_tide_home:sea', 0) as Report
    }
    expect(play().narration?.adult_scene).toBe(story('ren_tide_home').nodes.find((n) => n.id === 'sea')!.options![0]!.success!.scene)
  })
})

describe('work quest lines', () => {
  const LINES = {
    inn: ['inn_skirt', 'inn_cellar', 'inn_feast', '看板娘的圍裙'],
    odd: ['odd_measure', 'odd_trial', 'odd_exchange', '實驗用的魔導項圈'],
    dice: ['dice_dealer', 'dice_luck', 'dice_jackpot', '黃金骰子的兔女郎裝'],
    dance: ['dance_bazaar', 'dance_chief', 'dance_night', '夜之舞孃的腳鍊'],
    maid: ['maid_skirt', 'maid_bath', 'maid_night', '伯爵府的女僕裝'],
  }

  it('run three stages in order, only for feminine and androgynous heroes, and end with the line gear in every branch', () => {
    for (const [pre, [a, b, c, gear]] of Object.entries(LINES)) {
      const [s1, s2, s3] = [a!, b!, c!].map(story)
      for (const s of [s1, s2, s3]) {
        expect(s!.tags, s!.id).toContain('adult')
        expect(s!.start.pc_body, s!.id).toEqual(['fem', 'andro'])
      }
      expect(s1!.start.requires).toBeUndefined()
      expect(s2!.start.requires?.flags).toEqual([`${pre}_1_done`])
      expect(s3!.start.requires?.flags).toEqual([`${pre}_2_done`])
      const last = s3!.nodes.at(-1)!
      for (const o of last.options!) {
        expect(o.success!.effects, `${c} ${o.label}`).toContainEqual({ type: 'item', name: gear, qty: 1 })
        expect(o.success!.scene, `${c} ${o.label}`).toBeTruthy()
      }
      expect(itemRules.items.find((i) => i.name === gear)).toMatchObject({ adult: true, tags: ['unique'] })
    }
  })
})
