import { describe, expect, it } from 'vitest'
import { lewdRules, namedNpcById, npcs as namedNpcs } from '@/engine/data'
import { npcLewd } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { newGame } from '@/engine/state'
import { baseReport } from '@/engine/town'
import {
  applySexUpdates, editSexRecord, experienceLewdness, intimateReport, markSexLogged, npcSexSeed, sexCandidates, sexLogged, sexRecordItems, sexRecordOf, sexRecordsNote, virginWord,
} from '@/engine/sexRecord'
import { buildSexLogPrompt } from '@/narrator/sexLog'
import type { GameState, Report } from '@/engine/types'

function game(experience?: { experienced: boolean; note?: string }) {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', gender: '女', seed: 5, ...(experience ? { experience } : {}) })
  return { state, pc: pcOf(state) }
}

function intimate(state: GameState, others: Report['others'] = []): Report {
  const r = baseReport(state, 'action', 1)
  r.narration = { adult_scene: '在旅店的房間裡共度一夜' }
  r.others = others
  state.reports.push(r)
  return r
}

describe('性經歷：初始值', () => {
  it('主角照建角時選的：沒勾是處女；勾了有一個人一次與初體驗', () => {
    expect(sexRecordOf(game().state, 'pc')).toMatchObject({ virgin: true, partners: 0, times: 0 })
    const { state } = game({ experienced: true, note: '十七歲，和青梅竹馬' })
    expect(sexRecordOf(state, 'pc')).toMatchObject({ virgin: false, partners: 1, times: 1, first: { note: '十七歲，和青梅竹馬' } })
    expect(sexRecordItems(game().state, 'pc')[0]).toEqual({ label: '經驗', value: '處女' })
  })

  it('舊存檔的主角沒有記錄：有過親密場景的算有經驗', () => {
    const { state, pc } = game()
    delete state.sexRecords
    expect(sexRecordOf(state, 'pc').virgin).toBe(true)
    pc.lewd = { ...lewdRules.defaults, lastScene: 3 }
    expect(sexRecordOf(state, 'pc').virgin).toBe(false)
  })

  it('NPC 依標籤與 id 固定地擲：娼妓一定有經驗；固定 NPC 寫了的優先', () => {
    const a = npcSexSeed({ id: 'npc_x', tags: ['prostitute'] })
    expect(npcSexSeed({ id: 'npc_x', tags: ['prostitute'] })).toEqual(a)
    expect(a.virgin).toBe(false)
    expect(a.partners).toBeGreaterThanOrEqual(40)
    expect(a.times).toBeGreaterThanOrEqual(a.partners)
    expect(npcSexSeed({ id: 'npc_x', sex: { virgin: true } }).virgin).toBe(true)
    // 寫了人數就算有經驗
    expect(npcSexSeed({ id: 'npc_y', sex: { partners: 3 } })).toMatchObject({ virgin: false, partners: 3 })
    // 神官大多沒有經驗
    const priests = Array.from({ length: 200 }, (_, i) => npcSexSeed({ id: `npc_p${i}`, tags: ['priest'] }))
    expect(priests.filter((r) => r.virgin).length).toBeGreaterThan(130)
  })

  it('初始淫亂照經歷調整：處子打折，經驗多的加一點；標籤定了範圍的不加', () => {
    expect(experienceLewdness(30, npcSexSeed({ id: 'a', sex: { virgin: true } }), false)).toBe(Math.round(30 * lewdRules.experience.lewdness.virgin_mult))
    expect(experienceLewdness(30, npcSexSeed({ id: 'a', sex: { partners: 40 } }), false)).toBe(50)
    expect(experienceLewdness(30, npcSexSeed({ id: 'a', sex: { partners: 40 } }), true)).toBe(30)
    // 同一組亂數：處子的淫亂一定不比有經驗的高
    for (let i = 0; i < 50; i++) {
      const v = npcLewd({ id: `npc_v${i}`, sex: { virgin: true } }).lewdness
      const e = npcLewd({ id: `npc_v${i}`, sex: { partners: 2 } }).lewdness
      expect(v).toBeLessThan(e)
    }
  })

  it('內建的固定 NPC：設定是處女的人，淫亂不會比人妻高', () => {
    const lewd = (id: string) => npcLewd(namedNpcById(id)!).lewdness
    const virgins = ['npc_lucia', 'npc_isadora', 'npc_eve', 'npc_aya']
    const wives = ['npc_clara', 'npc_lieselotte', 'npc_amelia']
    for (const v of virgins) {
      expect(namedNpcById(v)!.sex?.virgin).toBe(true)
      for (const w of wives) expect(lewd(v)).toBeLessThan(lewd(w))
    }
    // 寫了 sex 的都是成人向角色或有成人向外貌的人，欄位合法
    for (const n of namedNpcs.filter((x) => x.sex)) {
      expect(npcSexSeed(n).partners).toBeGreaterThanOrEqual(0)
      if (n.sex!.virgin) expect(npcSexSeed(n).partners).toBe(0)
    }
  })

  it('處女、處男、處子', () => {
    expect(virginWord('female')).toBe('處女')
    expect(virginWord('male')).toBe('處男')
    expect(virginWord('男')).toBe('處男')
    expect(virginWord('')).toBe('處子')
  })
})

describe('性經歷：AI 的記錄', () => {
  it('只有帶親密場景、不是只有挑逗的日誌才記', () => {
    const { state } = game()
    const r = intimate(state)
    expect(intimateReport(r)).toBe(true)
    r.narration!.tease = r.narration!.adult_scene
    expect(intimateReport(r)).toBe(false)
    delete r.narration
    expect(intimateReport(r)).toBe(false)
  })

  it('候選：主角與報告裡的 NPC（怪物除外）', () => {
    const { state } = game()
    const r = intimate(state, [{ id: 'npc_lina', name: '莉娜' }, { id: 'goblin_1', name: '哥布林', monster: 'goblin' }])
    expect(sexCandidates(state, r)).toEqual(['pc', 'npc_lina'])
  })

  it('套用：初體驗、人數只算新的對象、次數累加、最近三次、非自願；不在名單上的不收', () => {
    const { state, pc } = game()
    const before = pc.lewd?.lewdness ?? lewdRules.defaults.lewdness
    const r1 = intimate(state, [{ id: 'npc_lina', name: '莉娜' }])
    const ctx = { report: r1, candidates: sexCandidates(state, r1) }
    const updated = applySexUpdates(state, [
      { id: 'pc', sex: 2, service: 1, with: [{ name: '莉娜', id: 'npc_lina' }], summary: '在旅店的房間裡', first_time: '和莉娜，在旅店', favorite: '莉娜' },
      { id: 'npc_lina', sex: 2, with: [{ name: '莉雅', id: 'pc' }], summary: '主動的那一方' },
      { id: 'npc_nobody', sex: 5 },
    ], ctx)
    expect(updated).toEqual(['pc', 'npc_lina'])
    const rec = sexRecordOf(state, 'pc')
    expect(rec).toMatchObject({ virgin: false, partners: 1, times: 2, servicePartners: 1, serviceTimes: 1, favorite: '莉娜' })
    expect(rec.first).toMatchObject({ day: r1.time.end.day, with: '莉娜', note: '和莉娜，在旅店' })
    // 初體驗的成長
    expect(pc.lewd!.lewdness).toBe(before + lewdRules.experience.first_time.lewdness!)
    // 莉娜的記錄從她擲出來的初始值接著加
    const linaSeed = npcSexSeed({ id: 'npc_lina', tags: ['traveler'] })
    expect(sexRecordOf(state, 'npc_lina').times).toBe(linaSeed.times + 2)

    // 同一個對象不再算人數；新的對象算；沒寫對象的算一個
    for (const [i, w] of [[{ name: '莉娜', id: 'npc_lina' }], [{ name: '酒館的客人' }], []].entries()) {
      const r = intimate(state)
      applySexUpdates(state, [{ id: 'pc', sex: 1, with: w, forced: i === 1, summary: `第 ${i} 次` }], { report: r, candidates: ['pc'] })
    }
    const after = sexRecordOf(state, 'pc')
    expect(after.partners).toBe(3)
    expect(after.times).toBe(5)
    expect(after.forced).toBe(1)
    expect(after.recent.map((e) => e.summary)).toEqual(['第 2 次', '第 1 次', '第 0 次'])
    expect(sexRecordItems(state, 'pc').find((x) => x.label === '最近一次的對象')?.value).toBe('不明的對象')
    // 第一次以後不再改初體驗
    expect(after.first?.with).toBe('莉娜')
  })

  it('次數、對象有上限；只有性侍奉不算失去處子', () => {
    const { state } = game()
    const r = intimate(state)
    applySexUpdates(state, [{ id: 'pc', sex: 0, service: 999, with: Array.from({ length: 20 }, (_, i) => ({ name: `客人${i}` })) }], { report: r, candidates: ['pc'] })
    const rec = sexRecordOf(state, 'pc')
    expect(rec.virgin).toBe(true)
    expect(rec.serviceTimes).toBe(lewdRules.experience.caps.times)
    expect(rec.servicePartners).toBe(lewdRules.experience.caps.partners)
  })

  it('記過的日誌不再記；玩家可以修改或回到初始值', () => {
    const { state } = game()
    const r = intimate(state)
    expect(sexLogged(state, r.report_id)).toBe(false)
    markSexLogged(state, r.report_id)
    expect(sexLogged(state, r.report_id)).toBe(true)
    editSexRecord(state, 'pc', { virgin: false, partners: 4, times: 9, notes: '喜歡被蒙住眼睛' })
    expect(sexRecordOf(state, 'pc')).toMatchObject({ virgin: false, partners: 4, times: 9, notes: '喜歡被蒙住眼睛' })
    editSexRecord(state, 'pc', null)
    expect(sexRecordOf(state, 'pc').virgin).toBe(true)
  })

  it('提示詞：列出候選與目前的記錄，附上正文；成人場景附上每人一行', () => {
    const { state } = game()
    const r = intimate(state, [{ id: 'npc_lina', name: '莉娜' }])
    const built = buildSexLogPrompt(state, r, '兩人在旅店的房間裡……')!
    expect(built.candidates).toEqual(['pc', 'npc_lina'])
    expect(built.prompt.user).toContain('id: npc_lina')
    expect(built.prompt.user).toContain('<narrative>')
    expect(built.prompt.system).toContain('"records"')
    expect(sexRecordsNote(state, ['npc_lina'])).toContain('莉雅的性經歷：經驗：處女')
    expect(sexRecordsNote(state, ['npc_lina'])).toContain('莉娜的性經歷')
  })
})
