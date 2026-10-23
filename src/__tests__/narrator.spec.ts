import { describe, expect, it } from 'vitest'
import worldbook from '../../data/worldbook/elondia.worldbook.json'
import combatExample from '../../examples/reports/combat-snake-creek.json'
import travelExample from '../../examples/reports/travel-rivervale-snowridge.json'
import type { Report } from '@/engine/types'
import { selectLore, type Worldbook } from '@/narrator/lore'
import { buildPrompt } from '@/narrator/prompt'
import { describeEntry } from '@/narrator/describe'

const book = worldbook as unknown as Worldbook
const combat = combatExample as unknown as Report
const trip = travelExample as unknown as Report
const opts = { adult: false, budgetChars: 20000, playerName: '艾倫' }

function comments(report: Report, o = opts) {
  return selectLore(book, report, o).map((e) => e.comment)
}

describe('selectLore', () => {
  it('always includes the world overview and matches traditional keys against simplified worldbook keys', () => {
    const picked = comments(combat)
    expect(picked).toContain('埃隆迪亚大陆')
    expect(picked).toContain('区域-中央平原与丘陵地带')
    expect(picked).toContain('种族-貓魅族')
  })

  it('never includes chat-format entries handled by the engine', () => {
    const picked = comments(combat)
    expect(picked).not.toContain('核心：格式规范')
    expect(picked).not.toContain('核心：高人指点版COT')
    expect(picked).not.toContain('分阶段亲密值规则')
  })

  it('only includes adult entries when enabled', () => {
    expect(comments(combat)).not.toContain('叙事倾向与事件触发机制')
    expect(comments(combat, { ...opts, adult: true })).toContain('叙事倾向与事件触发机制')
  })

  it('adds relative positions for travel reports and replaces the hardcoded player name', () => {
    expect(comments(trip)).not.toContain('视角和文风条目')
    const lore = selectLore(book, trip, opts, { 5: { mode: 'constant' } })
    expect(lore.map((e) => e.comment)).toContain('区域地理地标相对位置')
    const style = lore.find((e) => e.comment === '视角和文风条目')!
    expect(style.content).not.toContain('沈頤')
    expect(style.content).toContain('艾倫')
  })

  it('respects the character budget', () => {
    const lore = selectLore(book, combat, { ...opts, budgetChars: 5000 })
    const total = lore.reduce((sum, e) => sum + e.content.length, 0)
    expect(total).toBeLessThanOrEqual(5000)
  })
})

describe('buildPrompt', () => {
  it('puts the rules in system and the humanized report in user', () => {
    const p = buildPrompt(combat, selectLore(book, combat, opts), { playerName: '艾倫', language: 'zh-Hant' })
    expect(p.system).toContain('不可更改')
    expect(p.system).toContain('繁體中文')
    expect(p.user).toContain('<report>')
    expect(p.user).toContain('蛇溪洞窟')
    expect(p.user).toContain('遊俠')
    expect(p.user).toContain('優先保護莉娜')
  })
})

describe('combat log lines', () => {
  it('spells out saving throws so the numbers do not read backwards', () => {
    const names = { a: '瑟琳', b: '巨鼠' }
    expect(describeEntry({ seq: 1, actor: 'a', target: 'b', action: '聖焰', roll: { value: 22, dc: 13, save: true }, result: 'fail' }, names))
      .toBe('瑟琳：聖焰 → 巨鼠（豁免 22 / DC 13） 失敗')
    expect(describeEntry({ seq: 2, actor: 'a', target: 'b', action: '戰鎚', roll: { value: 14, dc: 9 }, result: 'success' }, names))
      .toBe('瑟琳：戰鎚 → 巨鼠（14 vs 9） 成功')
  })
})
