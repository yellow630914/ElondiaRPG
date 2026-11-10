// 主動找主人（slavery.ts 的 askableEvents、askMaster；docs/COMPANIONS.md 2.4 節）
import { afterEach, describe, expect, it } from 'vitest'
import { setContentFilters } from '@/engine/content'
import { slaveryRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { npcRecord } from '@/engine/npcs'
import { answerMasterEvent, askableEvents, askMaster, askMasterBlocked, eventChoices, masterCandidates, startAsSlave, startMasterEvent } from '@/engine/slavery'
import { sanitizeMasterEvent } from '@/engine/masterEventMods'
import { setAffinity } from '@/engine/social'
import { newGame } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import { pcOf } from '@/engine/party'
import type { GameState } from '@/engine/types'

afterEach(() => setContentFilters({ pc_unwilling: true }))

function slave(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  return state
}
const masterId = (state: GameState) => contractOf(pcOf(state))!.master!

describe('主動找主人', () => {
  it('列出寫了 ask 的事件：主人的身分不符的不列，親密度不夠的寫原因', () => {
    const state = slave()
    const tags = npcRecord(state, masterId(state))?.tags ?? []
    const list = askableEvents(state)
    expect(list.length).toBeGreaterThan(3)
    const defs = slaveryRules.master_events.events
    for (const o of list) {
      const e = defs.find((x) => x.id === o.id)!
      expect(e.ask).toBeDefined()
      if (e.tags?.length) expect(e.tags.some((t) => tags.includes(t))).toBe(true)
    }
    setAffinity(state, masterId(state), 0)
    const teach = askableEvents(state).find((o) => o.id === 'teach')!
    expect(teach.blocked).toBe('親密度 50 以上（現在 0）')
    setAffinity(state, masterId(state), 60)
    expect(askableEvents(state).find((o) => o.id === 'teach')!.blocked).toBeUndefined()
  })

  it('內容篩選關掉主角非自願時不列成人向的', () => {
    const state = slave()
    setContentFilters({ pc_unwilling: false })
    expect(askableEvents(state).some((o) => o.adult)).toBe(false)
  })

  it('開始那件事件，開頭寫著是你主動去找的；每天一次', () => {
    const state = slave()
    setAffinity(state, masterId(state), 40)
    expect(askMasterBlocked(state)).toBeUndefined()
    const name = contractOf(pcOf(state))!.masterName
    const p = askMaster(state, 'share_meal')
    expect(p.id).toBe('share_meal')
    expect(p.text.startsWith(`你端上飯菜，在${name}身旁候著。`)).toBe(true)
    expect(askMasterBlocked(state)).toBe('現在不能這麼做')
    answerMasterEvent(state, 0)
    expect(state.pendingMasterEvent).toBeUndefined()
    expect(askMasterBlocked(state)).toBe('今天已經主動找過主人了')
    expect(() => askMaster(state, 'errand')).toThrow('今天已經主動找過主人了')
    state.time = { ...state.time, day: state.time.day + 1 }
    expect(askMasterBlocked(state)).toBeUndefined()
  })

  it('做不了的事不能找；沒有被主人帶著時不能找', () => {
    const state = slave()
    setAffinity(state, masterId(state), 0)
    expect(() => askMaster(state, 'teach')).toThrow('親密度 50 以上')
    expect(() => askMaster(state, 'bad_mood')).toThrow('主人現在不會答應這件事')
    const free = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3 })
    expect(askMasterBlocked(free)).toBe('你沒有被主人帶著')
    expect(askableEvents(free)).toEqual([])
  })
})

describe('主動找主人時不列說不通的回應（ask.hide）', () => {
  it('自己開口請主人教，就不會出現「推說累了」；主人的突發事件照常列出', () => {
    const state = slave()
    setAffinity(state, masterId(state), 60)
    askMaster(state, 'teach')
    const labels = eventChoices(state).map((x) => x.option.label)
    expect(labels).not.toContain('推說累了想休息')
    expect(labels).toHaveLength(2)
    const hidden = slaveryRules.master_events.events.find((e) => e.id === 'teach')!.ask!.hide![0]!
    expect(() => answerMasterEvent(state, hidden)).toThrow('沒有這個選項')
    answerMasterEvent(state, eventChoices(state)[0]!.index)
    // 同一件事由主人發起時，所有回應都在
    startMasterEvent(state, slaveryRules.master_events.events.find((e) => e.id === 'teach')!)
    expect(eventChoices(state).map((x) => x.option.label)).toContain('推說累了想休息')
  })

  it('寫了 ask 的事件裡，hide 都指向存在的回應，而且至少留一個', () => {
    for (const e of slaveryRules.master_events.events) {
      if (!e.ask?.hide) continue
      for (const i of e.ask.hide) expect(e.options[i]).toBeDefined()
      expect(e.ask.hide.length).toBeLessThan(e.options.length)
    }
  })

  it('內容編輯器存檔時去掉無效的位置、不能全部藏起來', () => {
    const base = { weight: 1, text: '測試', options: [{ label: 'a', result: '' }, { label: 'b', result: '' }] }
    const ask = { group: 'serve', name: '測試', desc: '', lead: '你去找{master}。' }
    expect(sanitizeMasterEvent('x', { ...base, ask: { ...ask, hide: [1, 5, -1, 1] } } as never, true)?.ask?.hide).toEqual([1])
    expect(sanitizeMasterEvent('x', { ...base, ask: { ...ask, hide: [0, 1] } } as never, true)?.ask?.hide).toBeUndefined()
  })
})
