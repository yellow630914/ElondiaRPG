// 特殊任務生成器的格式說明與目錄（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E4a）：說明和程式一致
import { describe, expect, it } from 'vitest'
import { npcs } from '@/engine/data'
import { defaultGenInput } from '@/engine/questGen'
import { NODE_KINDS, sanitizeStory, START_KINDS, STORY_EFFECTS, WHERE_NAME } from '@/engine/storyMods'
import { designerSystem, fixPrompt, fullPrompt, GEN_EFFECTS, outlinePrompt, outlineText } from '@/narrator/questGenSpec'
import { questCatalog } from '@/narrator/questCatalog'

const input = { ...defaultGenInput(), prompt: '測試', tags: ['adult'], enslave: true }

describe('designer spec', () => {
  it('only documents effects that stories accept', () => {
    for (const k of Object.keys(GEN_EFFECTS)) expect(STORY_EFFECTS, k).toHaveProperty(k)
  })

  it('lists the enums from the program constants', () => {
    const sys = designerSystem(input)
    for (const k of [...Object.keys(START_KINDS), ...Object.keys(WHERE_NAME), ...Object.keys(NODE_KINDS)]) expect(sys).toContain(k)
  })

  it('leaves out what is not allowed', () => {
    const sys = designerSystem({ ...defaultGenInput(), prompt: '' })
    expect(sys).not.toContain('enslave_player')
    expect(sys).not.toContain('scene（')
    expect(designerSystem(input)).toContain('enslave_player')
  })

  it('every story field it documents survives sanitizeStory', () => {
    // 照說明寫一個用到每個欄位的任務：整理之後每個欄位都還在
    const npc = npcs[0]!.id
    const raw = {
      title: '測試', summary: '簡介', tags: ['adult'], time_limit: 10,
      start: { kind: 'guild', location: 'soriel', min_level: 3, text: '開頭', requires: { flags: ['x'] } },
      start_flags: ['a'],
      nodes: [
        {
          id: 'n1', title: '判定', text: '描述', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, requires: { flags: ['a'], flags_none: ['b'], flags_any: ['c'], affinity: { [npc]: 5 } },
          kind: 'check', check: { attr: 'dex', dc: 14 }, allies: [npc], urgent: true,
          success: { text: '成功', set_flags: ['d'], clear_flags: ['a'], effects: [{ type: 'xp', amount: 10 }], join: npc, scene: '場景' },
          fail: { leave: npc, deaths: [npc], retry: true, travel_to: 'rhineburg' },
        },
        { id: 'n2', title: '戰鬥', text: '', at: { where: 'dungeon', location: 'whisper_crypt', layer: 'middle' }, kind: 'combat', enemies: [['goblin', 2]], success: { complete: true }, fail: { fail_quest: true } },
        { id: 'n3', title: '選擇', text: '', at: { where: 'npc', npc }, kind: 'choice', options: [{ label: '甲', tags: ['adult'], requires: { flags: ['d'] }, check: { attr: 'cha', dc: 12 }, success: { complete: true }, fail: { text: '失敗' } }] },
      ],
    }
    const s = sanitizeStory('mod_story_t', raw as never, true)
    expect(s).toMatchObject({ title: '測試', summary: '簡介', tags: ['adult'], time_limit: 10, start_flags: ['a'] })
    expect(s.start).toMatchObject({ kind: 'guild', location: 'soriel', min_level: 3, text: '開頭', requires: { flags: ['x'] } })
    const [n1, n2, n3] = s.nodes
    expect(n1).toMatchObject({ id: 'n1', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, kind: 'check', check: { attr: 'dex', dc: 14 }, allies: [npc], urgent: true })
    expect(n1!.requires).toEqual(raw.nodes[0]!.requires)
    expect(n1!.success).toMatchObject({ text: '成功', set_flags: ['d'], clear_flags: ['a'], effects: [{ type: 'xp', amount: 10 }], join: npc, scene: '場景' })
    expect(n1!.fail).toMatchObject({ leave: npc, deaths: [npc], retry: true, travel_to: 'rhineburg' })
    expect(n2).toMatchObject({ at: { where: 'dungeon', layer: 'middle' }, enemies: [['goblin', 2]], success: { complete: true }, fail: { fail_quest: true } })
    expect(n3!.at).toEqual({ where: 'npc', npc })
    expect(n3!.options![0]).toMatchObject({ label: '甲', tags: ['adult'], requires: { flags: ['d'] }, check: { attr: 'cha', dc: 12 }, success: { complete: true }, fail: { text: '失敗' } })
  })

  it('builds the three prompts on the same system prompt', () => {
    const cat = questCatalog(input)
    const a = outlinePrompt(input, cat)
    const b = fullPrompt(input, cat, '大綱')
    const c = fixPrompt(input, cat, '{}', ['錯誤一'])
    expect(a.system).toBe(b.system)
    expect(b.system).toBe(c.system)
    expect(b.user).toContain('大綱')
    expect(c.user).toContain('錯誤一')
  })

  it('formats an outline as editable text', () => {
    const t = outlineText({ title: '燈塔', premise: '前提', start: '公會', nodes: [{ id: 'n1', title: '打聽', kind: 'story', where: '酒館', branches: ['接 n2'] }], new: [{ ref: '$npc1', kind: 'npcs', name: '格倫', why: '守夜人' }] })
    expect(t).toContain('# 燈塔')
    expect(t).toContain('- n1【story】打聽（酒館）')
    expect(t).toContain('  - 接 n2')
    expect(t).toContain('$npc1（固定 NPC）格倫')
  })
})

describe('quest catalog', () => {
  it('lists pinned and mentioned npcs and stays within size', () => {
    const n = npcs.find((x) => x.location === 'soriel')!
    const cat = questCatalog({ ...defaultGenInput(), prompt: `${n.name}的委託`, location: 'soriel' })
    expect(cat).toContain(n.id)
    expect(cat).toContain('soriel 索里耶爾')
    expect(cat.length).toBeLessThan(30000)
  })
})
