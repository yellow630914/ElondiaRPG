import { afterEach, describe, expect, it } from 'vitest'
import { itemRules, stories, type StoryDef } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { npcRecord } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { newGame } from '@/engine/state'
import { playNode, startStory } from '@/engine/story'
import { setFlag } from '@/engine/storyFlags'
import { sanitizeOutcome, storyCheck, STORY_SCENE_CHARS } from '@/engine/storyMods'
import type { Report } from '@/engine/types'


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

  it('hand the scene to the narration as an adult scene', () => {
    const play = () => {
      const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3 })
      enterLocation(state)
      startStory(state, 'ren_tide_home')
      const def = story('ren_tide_home')
      const sea = def.nodes.find((n) => n.id === 'sea')!
      for (const f of sea.requires?.flags ?? []) setFlag(state, f)
      joinParty(state, npcRecord(state, 'npc_ren')!, 'guest')
      // 這個任務點只在夜裡（docs/STORY_QUESTS.md「時段」）
      state.time = { ...state.time, hour: 22, minute: 0 }
      return playNode(state, 'ren_tide_home:sea', 0) as Report
    }
    expect(play().narration?.adult_scene).toBe(story('ren_tide_home').nodes.find((n) => n.id === 'sea')!.options![0]!.success!.scene)
  })
})

describe('work quest lines', () => {
  const LINES = {
    inn: ['inn_skirt', 'inn_table', 'inn_feast', '看板娘的圍裙'],
    odd: ['odd_measure', 'odd_trial', 'odd_exchange', '實驗用的魔導項圈'],
    dice: ['dice_dealer', 'dice_luck', 'dice_jackpot', '黃金骰子的兔女郎裝'],
    dance: ['dance_bazaar', 'dance_chief', 'dance_night', '夜之舞孃的腳鍊'],
    maid: ['maid_skirt', 'maid_bath', 'maid_night', '伯爵府的女僕裝'],
    expo: ['expo_stolen', 'expo_field', 'expo_parade', '露出狂的網襪'],
    bath: ['bath_scrub', 'bath_vip', 'bath_deep', '澡堂的珍珠胸鍊'],
    onsen: ['onsen_mixed', 'onsen_rub', 'onsen_dawn', '溫泉旅館的浴衣'],
    massage: ['massage_lesson', 'massage_special', 'massage_last', '按摩師的薄紗手套'],
    paint: ['paint_pose', 'paint_statue', 'paint_brush', '畫家模特兒的絲袍'],
    horn: ['horn_feast', 'horn_winner', 'horn_trophy', '戰利品的獸骨腰帶'],
    court: ['court_demo', 'court_lord', 'court_banquet', '侍寢見習的魅魔絲衣'],
    pyre: ['pyre_cleanse', 'pyre_prelude', 'pyre_offering', '祭品的血紅頸環'],
    conf: ['conf_lattice', 'conf_chapel', 'conf_tithe', 'conf_trial', 'conf_last', '巡禮者的懺悔頭紗'],
    fert: ['fert_chosen', 'fert_dance', 'fert_rite', '豐饒祭的花冠'],
    mate: ['mate_paint', 'mate_chase', 'mate_bonfire', '求偶祭的獸牙項鍊'],
    brine: ['brine_bride', 'brine_parade', 'brine_spring', '潮汐祭的貝殼腰鍊'],
  }

  it('run their stages in order, only for feminine and androgynous heroes, and end with the line gear in every branch', () => {
    for (const [pre, ids] of Object.entries(LINES)) {
      const gear = ids.at(-1)!
      const quests = ids.slice(0, -1).map(story)
      quests.forEach((s, i) => {
        expect(s!.tags, s!.id).toContain('adult')
        // 打工線一律算男性對象（結局有女性一起也一樣）
        expect(s!.tags, s!.id).toContain('male_partner')
        expect(s!.start.pc_body, s!.id).toEqual(['fem', 'andro'])
        if (i === 0) expect(s!.start.requires, s!.id).toBeUndefined()
        else expect(s!.start.requires?.flags, s!.id).toEqual([`${pre}_${i}_done`])
      })
      const last = quests.at(-1)!.nodes.at(-1)!
      for (const o of last.options!) {
        expect(o.success!.effects, `${pre} ${o.label}`).toContainEqual({ type: 'item', name: gear, qty: 1 })
        expect(o.success!.scene, `${pre} ${o.label}`).toBeTruthy()
      }
      expect(itemRules.items.find((i) => i.name === gear)).toMatchObject({ adult: true, tags: ['unique'] })
    }
  })

  it('hand out the work uniform and ask for it on the job', () => {
    // 有制服的線：第一個限定的任務接下時發制服，之後每個非戰鬥的任務點都要穿著；結局的獨特裝備也算
    const dressed = stories.filter((s) => s.start.items?.length)
    expect(dressed.map((s) => s.id).sort()).toEqual(['bath_scrub', 'brine_bride', 'conf_lattice', 'court_demo', 'dance_bazaar', 'dice_dealer', 'expo_parade', 'fert_chosen', 'inn_skirt', 'maid_skirt', 'massage_lesson', 'mate_paint', 'onsen_mixed'])
    for (const s of dressed) {
      const wear = s.nodes.find((n) => n.wear)!.wear!
      for (const name of s.start.items!) expect(itemRules.items.find((i) => i.name === name), `${s.id} ${name}`).toBeTruthy()
      // 發的衣服穿得上限定的每一項
      for (const w of wear) expect(s.start.items!.some((name) => itemRules.items.find((i) => i.name === name)!.gear!.base === w), `${s.id} ${w}`).toBe(true)
      for (const n of s.nodes) if (n.kind !== 'combat') expect(n.wear, `${s.id} ${n.id}`).toEqual(wear)
    }
  })
})
