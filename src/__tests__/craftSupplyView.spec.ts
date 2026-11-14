// 委託打造的畫面：不夠的材料由工匠代備，寫出份數、單價與總額
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CraftPanel from '@/components/CraftPanel.vue'
import { craftPlan } from '@/engine/craft'
import { enterLocation, standOn } from '@/engine/grid'
import { formatMoney } from '@/engine/money'
import { newGame } from '@/engine/state'
import { useGame } from '@/stores/game'

describe('委託打造的畫面', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('沒帶材料：寫出工匠代備幾份、每份多少，總額包含材料費', async () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'albena' })
    enterLocation(state)
    standOn(state, 'smithy')
    localStorage.setItem('elondia.craftPick', JSON.stringify({ slot: 'main_hand', base: 'longsword' }))
    useGame().state = state
    const c = mount(CraftPanel, { attachTo: document.body })
    await c.findAll('button').find((b) => b.text().includes('委託打造'))!.trigger('click')
    await flushPromises()
    const plan = craftPlan(state, 'longsword', 'iron')
    expect(plan.supplied).toBeGreaterThan(0)
    const text = document.body.textContent ?? ''
    expect(text).toContain(`缺 ${plan.supplied} 份，工匠代備`)
    expect(text).toContain(formatMoney(plan.supplyUnit))
    expect(text).toContain(formatMoney(plan.fee + plan.supplyCost))
    c.unmount()
  })
})
