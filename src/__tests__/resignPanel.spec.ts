// 「🔒 契約」的重簽契約：親密度不夠時寫原因；改了條款才能按，按下去送出一次判定
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResignPanel from '@/components/ResignPanel.vue'
import { slaveryRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'

function slave(affinity: number) {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'combat' })
  state.relationships![contractOf(pcOf(state))!.master]!.affinity = affinity
  return state
}

describe('重簽契約的畫面', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('親密度不夠：寫出原因，按鈕不能按', () => {
    useGame().state = slave(slaveryRules.resign.min_affinity - 10)
    const w = mount(ResignPanel)
    expect(w.text()).toContain('還不夠信任你')
    expect(w.find('.actions button').attributes('disabled')).toBeDefined()
  })

  it('改了收益才能按；按下去送出重簽的判定', async () => {
    const game = useGame()
    game.state = slave(60)
    expect(useSettings().judgesWithAi()).toBe(false)
    const w = mount(ResignPanel)
    const btn = () => w.find('.actions button')
    expect(btn().attributes('disabled')).toBeDefined()
    await w.findAll('input[type="number"]')[0]!.setValue(40)
    expect(w.text()).toContain('收益歸主人 100% → 40%')
    expect(btn().attributes('disabled')).toBeUndefined()
    await btn().trigger('click')
    await flushPromises()
    const last = game.state!.reports.at(-1)!
    expect(last.check?.action).toContain('說服主人重簽契約')
    expect(w.emitted('done')).toHaveLength(1)
  })
})
