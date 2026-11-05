import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GuardStatus from '@/components/GuardStatus.vue'
import Hint from '@/components/ui/Hint.vue'
import { enterLocation } from '@/engine/grid'
import { securityRules } from '@/engine/security'
import { newGame } from '@/engine/state'
import { useGame } from '@/stores/game'

describe('遊戲內的規則說明', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('explains what crimes in town lead to, with the numbers from security.json', () => {
    const game = useGame()
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
    enterLocation(state)
    game.state = state
    const w = mount(GuardStatus, { props: { canPay: true } })
    const text = w.findAllComponents(Hint).map((h) => String(h.props('text'))).find((t) => t.startsWith('犯法的後果'))
    expect(text).toBeDefined()
    const raw = securityRules as unknown as { attack: { alert_here: number }; fines: { wanted_days: number } }
    expect(text).toContain(`偷襲（當街攻擊）被人看到：這裡的警戒 +${raw.attack.alert_here}`)
    expect(text).toContain(`通緝罰金是 ${raw.fines.wanted_days} 天的生活費`)
    expect(text).toContain(`DC ${securityRules.alert.gate_dc_base}`)
  })
})
