import { describe, expect, it } from 'vitest'
import { canonicalName, toSimplifiedText } from '@/engine/script'
import { assemble } from '@/narrator/prompt'
import { loadScriptConverters, toOutputScript } from '@/narrator/script'

const prompt = () => assemble([
  { key: 'rules', title: '規則', part: 'system', text: '使用繁體中文。萊茵堡的哥布林' },
  { key: 'lore_constant', title: '世界書', part: 'system', text: '圣环教廷的骑士团' },
  { key: 'report', title: '報告', part: 'user', text: '{"item":"治療藥水"}' },
])

describe('prompt script for the output language', () => {
  it('converts the whole prompt to Simplified, character by character', () => {
    const p = toOutputScript(prompt(), 'zh-Hans')
    expect(p.system).toBe('使用繁体中文。莱茵堡的哥布林\n\n圣环教廷的骑士团')
    expect(p.user).toBe('{"item":"治疗药水"}')
  })

  it('converts only the worldbook to Traditional', async () => {
    await loadScriptConverters('zh-Hant')
    const p = toOutputScript(prompt(), 'zh-Hant')
    expect(p.sections!.find((s) => s.key === 'lore_constant')!.text).toBe('聖環教廷的騎士團')
    expect(p.sections!.find((s) => s.key === 'rules')!.text).toBe('使用繁體中文。萊茵堡的哥布林')
  })

  it('matches names regardless of script', () => {
    expect(toSimplifiedText('治療藥水')).toBe('治疗药水')
    expect(canonicalName('治疗药水', ['乾糧', '治療藥水'])).toBe('治療藥水')
    expect(canonicalName('治療藥水', ['治療藥水'])).toBe('治療藥水')
    expect(canonicalName('龙鳞', ['治療藥水'])).toBe('龙鳞')
  })
})
