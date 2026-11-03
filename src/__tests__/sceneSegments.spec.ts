// 分段插圖的分鏡：正文分段、自動挑段落（最多 N 張）或玩家指定的位置（narrator/sceneInfo.ts、paragraphs.ts）
import { describe, expect, it } from 'vitest'
import { newGame } from '@/engine/state'
import type { Report } from '@/engine/types'
import { anchorMatches, narrationParagraphs, paragraphAnchor } from '@/narrator/paragraphs'
import { autoSceneCount, parseScenePlans, sceneCast, scenePrompt, type SceneSegments } from '@/narrator/sceneInfo'

const TEXT = '你推開酒館的門。\n\n莉娜朝你揮手。\n　\n你們聊到深夜。\n\n天亮了，你們一起出發。\n<relationship_updates>[]</relationship_updates>'

function setup() {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' })
  const report = {
    schema_version: '0.1', report_id: 'r1', kind: 'event', time: { start: { day: 1, hour: 20 }, end: { day: 1, hour: 21 } },
    location: { at: state.location }, party: [{ id: state.party[0]!.id, name: '艾倫' }], outcome: { result: 'success', summary: '在酒館聊天' }, changes: {},
  } as unknown as Report
  return { state, report, cast: sceneCast(state, report) }
}

describe('narration paragraphs', () => {
  it('split like the log shows them, without the relationship updates, and anchor by the first characters', () => {
    const ps = narrationParagraphs(TEXT)
    expect(ps).toEqual(['你推開酒館的門。', '莉娜朝你揮手。', '你們聊到深夜。', '天亮了，你們一起出發。'])
    expect(paragraphAnchor(' 你們 聊到\n深夜。')).toBe('你們聊到深夜。')
    expect(anchorMatches(ps, 2, '你們聊到深夜。')).toBe(true)
    // 正文改過：同一個位置的段落不一樣了
    expect(anchorMatches(narrationParagraphs('全新的經過。\n\n第二段。\n\n第三段。'), 2, '你們聊到深夜。')).toBe(false)
    expect(anchorMatches(ps, 9, 'x')).toBe(false)
  })

  it('counts images for the automatic split: one, by length, or at most N, never more than the paragraphs', () => {
    const short = ['一'.repeat(300)]
    const long = Array.from({ length: 8 }, () => '一'.repeat(250))
    expect(autoSceneCount('1', long)).toBe(1)
    expect(autoSceneCount('length', long)).toBe(4)
    expect(autoSceneCount('length', short)).toBe(1)
    expect(autoSceneCount('3', long)).toBe(3)
    expect(autoSceneCount('4', ['a', 'b'])).toBe(2)
  })
})

describe('segment plans', () => {
  it('asks for up to N moments, or one image per position the player picked, with numbered paragraphs', () => {
    const { state, report, cast } = setup()
    const paragraphs = narrationParagraphs(TEXT)
    const auto = scenePrompt(state, report, cast, { multi: false, segments: { paragraphs, count: 3 } })
    expect(auto.system).toContain('挑出 1～3 個畫面差別最大的時刻')
    expect(auto.system).toContain('"images"')
    expect(auto.user).toContain('[1] 你推開酒館的門。')
    expect(auto.user).toContain('[4] 天亮了，你們一起出發。')
    expect(auto.user).not.toContain('relationship_updates')
    const one = scenePrompt(state, report, cast, { multi: false, segments: { paragraphs, count: 1 } })
    expect(one.system).toContain('挑出最能代表這段經過的一刻')
    const manual = scenePrompt(state, report, cast, { multi: false, segments: { paragraphs, after: [1, 3] } })
    expect(manual.system).toContain('第 2 段之後、第 4 段之後')
    expect(manual.system).not.toContain('已經有插圖')
    // 留著的位置也當作分界
    const kept = scenePrompt(state, report, cast, { multi: false, segments: { paragraphs, after: [3], kept: [1] } })
    expect(kept.system).toContain('第 2 段之後已經有插圖')
    // 沒有分段時照舊是一張
    expect(scenePrompt(state, report, cast, { multi: false }).system).not.toContain('"images"')
  })

  it('reads the plans: 1-based positions, only valid and allowed ones, no duplicates, in order, capped', () => {
    const { cast } = setup()
    const paragraphs = narrationParagraphs(TEXT)
    const img = (after: unknown, scene = 'tavern') => ({ after, rating: 'general', scene, characters: [] })
    const auto: SceneSegments = { paragraphs, count: 2 }
    const got = parseScenePlans({ images: [img(4, 'dawn'), img(9), img(1, 'door'), img(1, 'again'), img('x'), { after: 2 }, img(3, 'night')] }, cast, false, auto)
    // 超出正文的、編號不對的、同一段重複的、沒有畫面的略過；照段落順序，最多 2 張
    expect(got.map((g) => [g.after, g.plan.scene])).toEqual([[0, 'door'], [2, 'night']])
    // 手動：只收玩家指定的位置
    const manual: SceneSegments = { paragraphs, after: [1, 3] }
    expect(parseScenePlans({ images: [img(2), img(3), img(4)] }, cast, false, manual).map((g) => g.after)).toEqual([1, 3])
    // 只回了一張（沒有 images）：插在最後一段之後
    expect(parseScenePlans({ rating: 'general', scene: 'tavern', characters: [] }, cast, false, auto).map((g) => g.after)).toEqual([3])
    // 手動只選一個位置：單一物件插在那裡
    expect(parseScenePlans({ rating: 'general', scene: 'tavern', characters: [] }, cast, false, { paragraphs, after: [1] }).map((g) => g.after)).toEqual([1])
    expect(() => parseScenePlans({ images: [img(9)] }, cast, false, auto)).toThrow('scene')
    // 一般日誌的分級一律 general
    expect(parseScenePlans({ images: [{ ...img(1), rating: 'explicit' }] }, cast, false, auto)[0]!.plan.rating).toBe('general')
  })
})
