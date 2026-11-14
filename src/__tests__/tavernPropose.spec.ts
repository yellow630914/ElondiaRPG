// 奴隸在酒館向主人提議雇人：打開提議時畫面不能一直重畫（玩家回報：直接卡死）
import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import TavernPanel from '@/components/TavernPanel.vue'
import { enterLocation, standOn } from '@/engine/grid'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import { useGame } from '@/stores/game'

it('身為奴隸打開「向主人提議」：參考 DC 不會讓畫面一直重畫', async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  standOn(state, 'tavern')
  const game = useGame()
  game.state = state
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const err = vi.spyOn(console, 'error').mockImplementation(() => {})
  const w = mount(TavernPanel, { attachTo: document.body })
  const recruit = w.findAll('button').find((b) => b.text().includes('向主人提議雇人'))!
  await recruit.trigger('click'); await flushPromises()
  const btn = document.querySelectorAll('button')
  const toggle = [...btn].find((b) => b.textContent?.trim() === '向主人提議') as HTMLButtonElement
  expect(toggle).toBeTruthy()
  toggle.click(); await nextTick(); await flushPromises()
  const msgs = [...warn.mock.calls, ...err.mock.calls].map((c) => String(c[0]))
  expect(msgs.some((m) => m.includes('Maximum recursive updates'))).toBe(false)
  expect(document.body.textContent).toContain('向主人提議雇用（魅力檢定）')
  warn.mockRestore()
  err.mockRestore()
  w.unmount()
})
