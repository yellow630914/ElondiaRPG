import { describe, expect, it } from 'vitest'
import { abilityDamage, checkWorld, diceAvg } from './worldCheck'
import { abilities } from '@/engine/data'

// 世界檢查工具本身（不跑戰鬥模擬：內容裡沒有怪物）
describe('world check tool', () => {
  it('reports fields changed by sanitizing, broken stories and worldbook entries that never fire', () => {
    const r = checkWorld({
      type: 'elondia-world', version: 1, name: '測試',
      content: {
        npcs: { mod_npc_t: { id: 'mod_npc_t', name: '測試爵士', race: 'human', class: 'fighter', level: 5, location: 'soriel', hire_cc: 0, personality: '', custom: true, bogus: 1 } },
        stories: { mod_story_t: { title: '壞掉的任務', summary: '', start: { kind: 'manual' }, nodes: [], custom: true } },
      },
      prompts: { customLore: [{ uid: 100000, comment: '條目', content: 'x', mode: 'keyword', keys: [] }] },
    })
    const text = r.findings.map((f) => `${f.level}:${f.text}`).join('\n')
    expect(text).toContain('error:特殊任務「壞掉的任務」有錯誤')
    expect(text).toMatch(/warn:固定 NPC「mod_npc_t」整理時改了：.*bogus/)
    expect(text).toContain('沒有寫性格')
    expect(text).toContain('永遠不會注入')
    // 整理時補上的預設值不算
    expect(text).not.toContain('`kind`')
  })

  it('estimates dice and ability damage', () => {
    expect(diceAvg('2d6+1')).toBe(8)
    expect(diceAvg('1d8')).toBe(4.5)
    const fireball = Object.values(abilities).find((a) => a.type === 'spell' && a.target === 'all_enemies' && a.damage?.length)!
    expect(abilityDamage(fireball)).toBeGreaterThan(0)
  })
})
