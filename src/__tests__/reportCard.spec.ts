import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import combatExample from '../../examples/reports/combat-snake-creek.json'
import travelExample from '../../examples/reports/travel-rivervale-snowridge.json'
import type { Report } from '@/engine/types'
import ReportCard from '@/components/ReportCard.vue'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'

const combat = combatExample as unknown as Report
const trip = travelExample as unknown as Report

function setup(aiNarration: boolean) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const settings = useSettings()
  settings.aiNarration = aiNarration
  settings.sources[0]!.configs.anthropic.apiKey = 'sk-ant-test'
  const game = useGame()
  game.narrations[combat.report_id] = { text: '溶洞裡的水聲忽然停了。', status: 'done' }
  return pinia
}

describe('ReportCard', () => {
  beforeEach(() => localStorage.clear())

  it('shows the battle report and no AI controls when AI narration is off', () => {
    const wrapper = mount(ReportCard, { props: { report: combat }, global: { plugins: [setup(false)] } })
    expect(wrapper.find('.battle-report').exists()).toBe(true)
    expect(wrapper.find('.battle-report').text()).toContain('溪蛇魔')
    expect(wrapper.find('.story').exists()).toBe(false)
    expect(wrapper.find('.tools button').attributes('aria-label')).toBe('寫出經過')
  })

  it('shows only the summary for non-combat events when AI narration is off', () => {
    const wrapper = mount(ReportCard, { props: { report: trip }, global: { plugins: [setup(false)] } })
    expect(wrapper.text()).toContain(trip.outcome.summary!)
    expect(wrapper.find('.battle-report').exists()).toBe(false)
    expect(wrapper.find('details').exists()).toBe(true)
  })

  it('shows the narration instead of the battle report when AI narration is on', () => {
    const wrapper = mount(ReportCard, { props: { report: combat }, global: { plugins: [setup(true)] } })
    expect(wrapper.find('.story').text()).toContain('水聲')
    expect(wrapper.find('.battle-report').exists()).toBe(false)
    expect(wrapper.find('.tools button').attributes('aria-label')).toBe('重新寫出經過')
  })

  it('shows which source each token count came from', () => {
    const pinia = setup(true)
    useGame().usage[combat.report_id] = {
      input: 900, output: 200, calls: 1,
      by: [{ feature: 'narration', source: '寫作用', provider: 'openai', model: 'gpt-test', input: 900, output: 200, calls: 1 }],
    }
    const wrapper = mount(ReportCard, { props: { report: combat }, global: { plugins: [pinia] } })
    expect(wrapper.find('.tokens .origin').text()).toContain('敘事正文・寫作用（OpenAI gpt-test）')
  })

  it('folds the thinking of the judge and the narration, and ignores a thinking-only entry', () => {
    const pinia = setup(true)
    const game = useGame()
    game.narrations[trip.report_id] = { text: '', status: 'done', placeholder: true, judgeThinking: '骰值不高，但對方心情好。' }
    let wrapper = mount(ReportCard, { props: { report: trip }, global: { plugins: [pinia] } })
    expect(wrapper.find('.story').exists()).toBe(false)
    expect(wrapper.find('details.thinking').text()).toContain('判定')
    game.narrations[combat.report_id]!.thinking = '先寫水聲，再寫蛇。'
    wrapper = mount(ReportCard, { props: { report: combat }, global: { plugins: [pinia] } })
    expect(wrapper.find('details.thinking').exists()).toBe(true)
    expect(wrapper.find('details.thinking').attributes('open')).toBeUndefined()
    expect(wrapper.find('.thought pre').text()).toContain('先寫水聲')
    expect(wrapper.find('.story').text()).toContain('水聲')
  })
})

describe('settings migration', () => {
  it('turns the old autoNarrate setting into aiNarration', () => {
    localStorage.setItem('elondia.settings', JSON.stringify({ autoNarrate: true }))
    setActivePinia(createPinia())
    expect(useSettings().aiNarration).toBe(true)
    localStorage.clear()
  })
})
