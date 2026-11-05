import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// 只記下橫幅，其他特效照常（happy-dom 裡大多是空操作）
const banners: [string, string][] = []
vi.mock('@/fx/fx', async (orig) => ({
  ...(await orig<typeof import('@/fx/fx')>()),
  fxOn: () => true,
  banner: (text: string, kind: string) => { banners.push([text, kind]) },
}))

import CombatView from '@/components/CombatView.vue'
import { startCombat } from '@/engine/combat'
import { newGame } from '@/engine/state'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'

describe('戰鬥的回合提示', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    banners.length = 0
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  function setup() {
    const game = useGame()
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    startCombat(state, [['goblin', 1]])
    const combat = state.combat!
    combat.turn = combat.order.indexOf('pc')
    for (const e of combat.combatants) if (e.side === 'enemy') e.hp = e.maxHp = 5000
    game.state = state
    return game
  }

  async function endTurn(w: ReturnType<typeof mount>) {
    await w.findAll('button').find((b) => b.text() === '結束回合')!.trigger('click')
    await nextTick()
    await vi.advanceTimersByTimeAsync(8000)
  }

  it('shows the enemy phase, the new round and whose turn it is, one after another', async () => {
    setup()
    const w = mount(CombatView)
    await nextTick()
    await vi.advanceTimersByTimeAsync(3000)
    banners.length = 0
    await endTurn(w)
    const texts = banners.map(([t]) => t)
    expect(texts).toContain('敵方行動')
    expect(texts).toContain('第 2 回合')
    expect(texts.at(-1)).toBe('輪到你了')
    expect(banners.find(([t]) => t === '敵方行動')![1]).toBe('foe')
    expect(banners.find(([t]) => t === '第 2 回合')![1]).toBe('turn')
    w.unmount()
  })

  it('stays quiet when the setting is off', async () => {
    setup()
    useSettings().turnBanner = false
    const w = mount(CombatView)
    await nextTick()
    await vi.advanceTimersByTimeAsync(3000)
    banners.length = 0
    await endTurn(w)
    expect(banners).toEqual([])
    w.unmount()
  })
})
