import { describe, expect, it } from 'vitest'
import { stories } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { pcWords, pcWordSide } from '@/engine/pcWords'
import { newGame } from '@/engine/state'

// 特殊任務的固定文字依主角性別換詞：{男|女} / {男|女|其他}
describe('pcWords', () => {
  const game = (gender: string) => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1 })
    enterLocation(state)
    pcOf(state).gender = gender
    return state
  }

  it('picks the word by the PC gender', () => {
    expect(pcWords(game('男'), '謝謝你，『{哥哥|姊姊}』。')).toBe('謝謝你，『哥哥』。')
    expect(pcWords(game('女'), '謝謝你，『{哥哥|姊姊}』。')).toBe('謝謝你，『姊姊』。')
    expect(pcWords(game('偽娘'), '{哥哥|姊姊}')).toBe('哥哥')
    expect(pcWords(game('扶她'), '{哥哥|姊姊}')).toBe('姊姊')
    expect(pcWords(game('不告訴你'), '{哥哥|姊姊|客人}')).toBe('客人')
    expect(pcWords(game('不告訴你'), '{哥哥|姊姊}')).toBe('哥哥')
    expect(pcWordSide(undefined)).toBe(2)
  })

  it('leaves other braces alone', () => {
    expect(pcWords(game('女'), '{cast}和{a他}')).toBe('{cast}和{a他}')
  })

  it('built-in stories only use well-formed {男|女} words', () => {
    const bad: string[] = []
    const walk = (o: unknown, where: string) => {
      if (typeof o === 'string') {
        const rest = o.replace(/\{[^{}|]*\|[^{}|]*(?:\|[^{}|]*)?\}/g, '')
        if (/\{[^{}]*\|/.test(rest)) bad.push(`${where}：${o.slice(0, 40)}`)
      } else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${where}/${i}`))
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${where}/${k}`)
    }
    for (const s of stories) walk(s, s.id)
    expect(bad).toEqual([])
    const noel = stories.find((s) => s.id === 'noel_pretty_clerk')!
    const text = noel.nodes.find((n) => n.id === 'flowers')!.success!.text!
    expect(pcWords(game('女'), text)).toContain('『姊姊』')
  })
})
