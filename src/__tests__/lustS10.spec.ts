import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { startCombat } from '@/engine/combat'
import { itemDef, landmarkDef, lewdRules, npcs } from '@/engine/data'
import { enterLocation, landmarkHidden, standOn } from '@/engine/grid'
import { useItem } from '@/engine/inventory'
import { sanitizeItem, sanitizeNpc } from '@/engine/mods'
import { lewdOf, lewdTitles } from '@/engine/lewd'
import { attachParasite, changeCorruption, parasiteTwoFace, tameParasite } from '@/engine/parasites'
import { pcOf } from '@/engine/party'
import { trainOptions } from '@/engine/perkActions'
import { grantPerk } from '@/engine/perks'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { sourcesOf } from '@/engine/sources'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(birthplace = 'albena'): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11, birthplace })
  enterLocation(state)
  state.money_cc = 100000
  return state
}
const ROPE = 'npc_mentor_bondage'

describe('S10-1 流派的老師', () => {
  it('八個流派各有一位老師，待在有地標的地方，教入門與進階', () => {
    const mentors = npcs.filter((n) => n.mentor)
    expect(mentors).toHaveLength(8)
    for (const s of Object.values(lewdRules.schools).filter((x) => x.entry)) {
      const m = mentors.find((n) => n.mentor!.perks.includes(s.entry))
      expect(m?.mentor?.perks).toEqual([s.entry, s.advanced])
      expect(m?.landmark).toBeTruthy()
      expect(sourcesOf('perk', s.entry).some((x) => x.startsWith(`老師：${m!.name}`))).toBe(true)
    }
  })

  it('站在老師身邊：好感不夠時列出原因，夠了才能學；學費打折、比較好學；進階要先入門', () => {
    const state = game()
    expect(standOn(state, 'lm_auction_house' as never)).toBe(true)
    const rope = () => trainOptions(state).find((o) => o.def.id === 'school_bondage')!
    expect(rope().mentor?.id).toBe(ROPE)
    expect(rope().blocked).toContain('好感要 10')
    ensureRelationship(state, npcs.find((n) => n.id === ROPE)!)
    setAffinity(state, ROPE, 10)
    expect(rope().blocked).toBeUndefined()
    expect(rope().train.price_cc).toBe(Math.round(400 * 0.8))
    expect(rope().train.dc).toBe(12 - 2)
    expect(trainOptions(state).some((o) => o.def.id === 'rope_strength')).toBe(false)

    const p = prepareAction(state, { kind: 'train', target: 'school_bondage', text: '' })
    p.natural = 20
    resolveAction(state, null)
    expect(pcOf(state).perkOffers?.some((o) => o.options.includes('school_bondage'))).toBe(true)
    expect(state.money_cc).toBe(100000 - Math.round(320 / 2))

    grantPerk(pcOf(state), 'school_bondage')
    expect(trainOptions(state).find((o) => o.def.id === 'rope_strength')?.mentor?.id).toBe(ROPE)
  })

  it('內容編輯器整理時保留老師與秘法書的資料', () => {
    for (const n of npcs.filter((x) => x.mentor)) {
      const out = sanitizeNpc(n.id, JSON.parse(JSON.stringify(n)), false)
      expect(out).toMatchObject({ mentor: n.mentor, perks: n.perks, landmark: n.landmark, lewd: n.lewd })
    }
    expect(sanitizeNpc('x', { ...npcs[0]!, mentor: { perks: ['school_bondage', 'flaw_greedy', 'race_elf', 'nope'], affinity: 500, price_mult: 9 } }, true).mentor)
      .toEqual({ perks: ['school_bondage'], affinity: 100, price_mult: 3 })
    const tome = itemDef('《結繩圖譜》')!
    expect(sanitizeItem(tome.name, JSON.parse(JSON.stringify(tome)), false)).toMatchObject({ use: tome.use, charm_min: 3, tags: tome.tags })
  })

  it('老師待的地標一開始就在地圖上（只有場景、場景還沒解鎖的也一樣）', () => {
    for (const n of npcs.filter((x) => x.mentor)) {
      const l = landmarkDef(n.landmark!)!
      const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11, birthplace: l.location })
      enterLocation(state)
      expect(landmarkHidden(state, l), n.name).toBe(false)
      expect(standOn(state, l.id as never), n.name).toBe(true)
      expect(trainOptions(state).some((o) => o.mentor?.id === n.id), n.name).toBe(true)
    }
  })

  it('老師不在身邊就學不到', () => {
    const state = game('rhineburg')
    setAffinity(state, ROPE, 50)
    expect(trainOptions(state).some((o) => o.mentor?.id === ROPE)).toBe(false)
    expect(() => prepareAction(state, { kind: 'train', target: 'school_bondage', text: '' })).toThrow()
  })
})

describe('S10-1 秘法書', () => {
  it('入門前只給入門，入門後給進階；全部學會、或和身上的流派互斥時讀不了', () => {
    const state = game()
    const pc = pcOf(state)
    addItem(state.inventory, '《結繩圖譜》', 3)
    useItem(state, '《結繩圖譜》', pc.id)
    expect(pc.perkOffers?.at(-1)?.options).toEqual(['school_bondage'])
    grantPerk(pc, 'school_bondage')
    useItem(state, '《結繩圖譜》', pc.id)
    expect(pc.perkOffers?.at(-1)?.options).toEqual(['rope_strength'])
    grantPerk(pc, 'rope_strength')
    expect(() => useItem(state, '《結繩圖譜》', pc.id)).toThrow('已經學會')

    grantPerk(pc, 'school_indulgence')
    addItem(state.inventory, '《清規》', 1)
    expect(() => useItem(state, '《清規》', pc.id)).toThrow('學不了')
  })

  it('八本都有，來源有商店、拍賣會、園區寶箱', () => {
    const tomes = ['《侍奉之書》', '《鞭痕錄》', '《結繩圖譜》', '《魅魔的枕邊書》', '《肉身鍛鍊法》', '《寄生生物考》', '《清規》', '《模特兒守則》']
    for (const t of tomes) {
      expect(itemDef(t)?.use?.perks).toHaveLength(2)
      const src = sourcesOf('item', t)
      expect(src.some((x) => x.startsWith('商店'))).toBe(true)
      expect(src).toEqual(expect.arrayContaining(['拍賣會', '緋夢樂園的寶箱']))
    }
  })
})

describe('S10-2 寄生類的雙面效應', () => {
  it('沒修流派沒有；修了流派依階段給；獸蟲派 ×1.5；馴服之後沒有', () => {
    const state = game()
    const pc = pcOf(state)
    attachParasite(pc, 'succubus_mark', state.time)
    changeCorruption(pc, 'succubus_mark', 65)
    expect(parasiteTwoFace(pc).active).toEqual([])
    pc.perks = [...(pc.perks ?? []), 'school_bondage']
    expect(parasiteTwoFace(pc)).toMatchObject({ mods: { save: 1 }, lustBonus: 1, active: [{ name: '魅魔的契紋', stage: '共生', mult: 1 }] })
    const plain = startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pc.id)!
    pc.perks = [...pc.perks, 'school_beast']
    expect(parasiteTwoFace(pc)).toMatchObject({ mods: { save: 2 }, lustBonus: 2 })
    state.combat = undefined
    const beast = startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pc.id)!
    expect(beast.lustMods!.bonus - plain.lustMods!.bonus).toBe(1)
    tameParasite(pc, 'succubus_mark')
    expect(parasiteTwoFace(pc).active).toEqual([])
  })

  it('潛伏階段沒有加成', () => {
    const state = game()
    const pc = pcOf(state)
    pc.perks = ['school_beast']
    attachParasite(pc, 'hungry_lingerie', state.time)
    expect(parasiteTwoFace(pc).active).toEqual([])
    changeCorruption(pc, 'hungry_lingerie', 35)
    expect(parasiteTwoFace(pc).mods).toEqual({ dr: 2 })
  })
})

describe('S10-3 慾望稱號', () => {
  it('依指標、曝露名聲、身分標籤、聲望，由上往下最多兩個', () => {
    const state = game()
    const pc = pcOf(state)
    pc.lewd = { ...lewdOf(pc), lewdness: 5 }
    expect(lewdTitles(state, pc).map((t) => t.id)).toEqual(['chaste'])
    pc.lewd = { ...lewdOf(pc), lewdness: 85, endurance: 75 }
    expect(lewdTitles(state, pc).map((t) => t.id)).toEqual(['tireless', 'pleasure_seeker'])
    pc.tags = ['noble']
    state.exposure = { [pc.id]: { central: 45 } }
    expect(lewdTitles(state, pc)[0]!.name).toBe('放蕩的貴族')
    // 聲望交叉：這一帶敬重你、也都聽過你的事
    state.exposure = { [pc.id]: { central: 55 } }
    pc.tags = []
    state.reputation = { aude_federation: 12 }
    expect(lewdTitles(state, pc)[0]!.name).toBe('表裡不一的英雄')
  })
})
