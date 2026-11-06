import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { actionRules, perkRules, SKILL_IDS, skillOfAction, type PerkDef } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { checkModifiers, checkSkills, describeEffects, matches, perkCategory, perkPower, sanitizePerk, checkBonus } from '@/engine/perks'
import { gateCheck, raiseAlert } from '@/engine/security'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { buildActionPrompt } from '@/narrator/judge'
import { pcOf } from '@/engine/party'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3 })
  enterLocation(state)
  return state
}
const perk = (id: string, effects: PerkDef['effects']): PerkDef => ({ id, name: id, desc: '', effects, custom: true })

describe('檢定分類（R20 C1）', () => {
  it('maps actions and contexts to known categories', () => {
    for (const [k, v] of Object.entries(actionRules.kinds)) if (v.skill) expect(SKILL_IDS, k).toContain(v.skill)
    for (const [c, s] of Object.entries(actionRules.context_skills)) {
      expect(perkRules.contexts, c).toHaveProperty(c)
      expect(SKILL_IDS).toContain(s)
    }
    expect(skillOfAction('bluff')).toBe('deceive')
    expect(skillOfAction('steal')).toBe('sleight')
    expect(skillOfAction(undefined, 'travel')).toBe('survival')
    expect(skillOfAction('free')).toBeUndefined()
  })

  it('matches filters written on categories, and keeps the old ones working', () => {
    expect(matches({ skills: ['deceive'] }, { context: 'action', kind: 'bluff' })).toBe(true)
    expect(matches({ skills: ['deceive'] }, { context: 'action', kind: 'chat' })).toBe(false)
    expect(matches({ skills: ['stealth'] }, { context: 'stealth' })).toBe(true)
    expect(matches({ skills: ['survival'] }, { context: 'road', also: ['travel'] })).toBe(true)
    expect(matches({ skills: ['persuade'] }, { context: 'action', kind: 'free', skill: 'persuade' })).toBe(true)
    // 不同欄位是「且」
    expect(matches({ skills: ['persuade'], vs_tags: ['noble'] }, { context: 'action', kind: 'chat' })).toBe(false)
    // 舊的寫法照舊
    expect(matches({ kinds: ['bluff'] }, { context: 'action', kind: 'bluff' })).toBe(true)
    expect([...checkSkills({ context: 'action', kind: 'chat', skill: 'deceive' })].sort()).toEqual(['deceive', 'persuade'])
  })

  it('counts a category as 1 for power, describes it, and sorts the perk', () => {
    const p = perk('x', [{ check: { skills: ['deceive'] }, bonus: 2 }])
    expect(perkPower(p)).toBe(2)
    expect(describeEffects(p.effects)).toBe('欺瞞檢定 +2。')
    expect(perkCategory(p)).toBe('social')
    expect(perkCategory(perk('y', [{ check: { skills: ['survival'] }, bonus: 1 }]))).toBe('explore')
    // 整理時保留認得的分類、拿掉不認得的
    const clean = sanitizePerk({ name: '試', effects: [{ check: { skills: ['deceive', 'nope'] }, bonus: 2 }] }, 'c-x', undefined, false)
    expect(clean?.effects).toEqual([{ check: { skills: ['deceive'] }, bonus: 2 }])
  })

  it('applies category bonuses to fixed actions', () => {
    const s = game()
    const pc = s.party[0]!
    pc.customPerks = [perk('liar2', [{ check: { skills: ['deceive'] }, bonus: 2 }])]
    expect(checkModifiers(pc, { context: 'action', kind: 'bluff', attr: 'cha' }).map((x) => x.value)).toContain(2)
    expect(checkModifiers(pc, { context: 'action', kind: 'chat', attr: 'cha' }).some((x) => x.value === 2)).toBe(false)
  })

  it('lets the AI pick the category of a free action, and adds that category only', () => {
    const s = game()
    standOn(s, 'tavern')
    const pc = s.party[0]!
    pc.customPerks = [perk('liar2', [{ check: { skills: ['deceive'] }, bonus: 2 }])]
    const p = prepareAction(s, { kind: 'free', text: '騙酒保說我是公會派來的' })
    expect(p.skill).toBeUndefined()
    expect(p.skillMods?.deceive).toEqual([{ label: '特質【liar2】', value: 2 }])
    expect(p.situational.some((x) => x.label === '特質【liar2】')).toBe(false)
    // 提示詞列出分類與多出來的修正
    const prompt = buildActionPrompt(s, p, '')
    const user = prompt.user ?? JSON.stringify(prompt)
    expect(user).toContain('deceive（欺瞞')
    expect(user).toContain('選這一類時另外 特質【liar2】 +2')
    const j = sanitizeJudgment(s, p, { degree: 'success', attr: 'cha', skill: 'deceive', effects: [] })
    expect(j.skill).toBe('deceive')
    const r = resolveAction(s, j)
    expect(r.check?.skill).toBe('deceive')
    expect(r.check?.situational).toEqual(expect.arrayContaining([{ label: '特質【liar2】', value: 2 }]))
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  })

  it('ignores an unknown category, and records the category of fixed actions', () => {
    const s = game()
    standOn(s, 'tavern')
    const p = prepareAction(s, { kind: 'free', text: '試試看' })
    expect(sanitizeJudgment(s, p, { degree: 'fail', skill: 'flying', effects: [] }).skill).toBeUndefined()
  })

  it('handles the gate with the best way, and the palace guard as persuasion', () => {
    const s = game()
    standOn(s, 'gate')
    s.party[0]!.customPerks = [perk('liar9', [{ check: { skills: ['deceive'] }, bonus: 5 }])]
    raiseAlert(s, 'soriel', 1)
    const g = gateCheck(s)
    expect(g.report?.timeline?.[0]?.action).toContain('欺瞞檢定')
    // 說服王城的衛兵（persuadePalaceGuard）用 palace_gate 這種行動的情境：寫在說服上的加成算進來
    const pc2 = game().party[0]!
    pc2.customPerks = [perk('talk', [{ check: { skills: ['persuade'] }, bonus: 1 }])]
    expect(checkModifiers(pc2, { context: 'gate', kind: 'palace_gate', attr: 'cha' })).toEqual([{ label: '特質【talk】', value: 1 }])
  })
})

describe('檢定分類：任務選項可以寫，沒寫時照屬性推', () => {
  it('defaults by attribute, but not for free actions or training', () => {
    expect([...checkSkills({ context: 'action', attr: 'cha' })]).toEqual(['persuade'])
    expect([...checkSkills({ context: 'action', attr: 'cha', skill: 'deceive' })]).toEqual(['deceive'])
    expect([...checkSkills({ context: 'action', kind: 'free', attr: 'cha' })]).toEqual([])
    expect([...checkSkills({ context: 'action', kind: 'train', attr: 'cha' })]).toEqual([])
    const s = game()
    pcOf(s).perks = ['silver_tongue']
    expect(checkBonus(pcOf(s), { context: 'action', attr: 'cha' })).toBe(2)
  })
})
