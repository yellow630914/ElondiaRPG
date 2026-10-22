import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { protagonistText } from '@/engine/character'
import { itemDef, locationById } from '@/engine/data'
import { gearRules } from '@/engine/gear'
import { enterLocation, standOn } from '@/engine/grid'
import { equipItem, useItem } from '@/engine/inventory'
import { applyAiOptions, canNegotiate, chooseOption, startNegotiation } from '@/engine/negotiation'
import { setAffinity } from '@/engine/social'
import { newGame } from '@/engine/state'
import { doTownQuest, guildQuests, recruit } from '@/engine/town'
import { applyAiDeals, buyDeal, dealMoney, sellItem, sellPrice, shopKey, shopState } from '@/engine/trade'
import type { GameState, Report } from '@/engine/types'
import { buildPrompt } from '@/narrator/prompt'
import { buildNegotiationPrompt, buildShopPrompt } from '@/narrator/judge'

const ajv = new Ajv2020({ strict: false })
const validate = ajv.compile(schema)
function expectValid(report: Report) {
  if (!validate(report)) throw new Error(JSON.stringify(validate.errors, null, 2))
}

function game(seed = 1): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed })
  enterLocation(state)
  return state
}

describe('shops', () => {
  it('lists catalog goods at location prices and sells them without any check', () => {
    const state = game(1)
    const shop = shopState(state, 'general')
    const rations = shop.deals.find((d) => d.id === 'item:乾糧')!
    // 索里耶爾是王都：價格 ×1.15
    expect(rations.gives[0]).toEqual({ type: 'money', amount: 6 })
    // 裝備改在鐵匠鋪、裁縫店、珠寶店賣
    expect(shop.deals.some((d) => itemDef(d.title)?.gear)).toBe(false)
    const gear = shopState(state, 'smithy').deals.filter((d) => d.id.startsWith('item:') && itemDef(d.title)?.gear)
    expect(gear.length).toBeGreaterThanOrEqual(3)
    for (const d of gear) expect(['metal', 'wood']).toContain(gearRules.bases[itemDef(d.title)!.gear!.base]!.kind)
    const report = buyDeal(state, 'general', 'item:乾糧')
    expectValid(report)
    expect(report.check).toBeUndefined()
    expect(state.money_cc).toBe(494)
    expect(state.inventory.find((i) => i.name === '乾糧')?.qty).toBe(6)
  })

  it('buys several of a catalog item in one trade, but only one special deal at a time', () => {
    const state = game(1)
    const shop = shopState(state, 'general')
    const deal = shop.deals.find((d) => d.id === 'item:乾糧')!
    const stock = deal.stock
    const report = buyDeal(state, 'general', 'item:乾糧', 3)
    expectValid(report)
    expect(state.money_cc).toBe(500 - 6 * 3)
    expect(state.inventory.find((i) => i.name === '乾糧')?.qty).toBe(8)
    expect(deal.stock).toBe(stock - 3)
    expect(report.outcome.summary).toContain('×3')
    expect(() => buyDeal(state, 'general', 'item:乾糧', 999)).toThrow('只剩')
    const special = shop.deals.find((d) => !d.id.startsWith('item:'))
    if (special) expect(() => buyDeal(state, 'general', special.id, 2)).toThrow('一次只能')
  })

  it('applies composite rewards such as buying a round for everyone', () => {
    const state = game(2)
    recruit(state, 'npc_lina')
    const shop = shopState(state, 'tavern')
    buyDeal(state, 'tavern', 'special:round')
    expect(state.relationships!.npc_lina!.affinity).toBe(2)
    expect(state.relationships![shop.keeper]!.affinity).toBe(1)
    expect(() => buyDeal(state, 'tavern', 'special:round')).toThrow('沒有了')
  })

  it('buys materials back at full price and gives a discount to friends', () => {
    const state = game(3)
    state.inventory.push({ name: '藥草', qty: 3 })
    const key = shopKey(state, 'general')
    const shop = shopState(state, 'general')
    expect(sellPrice(state, key, '藥草')).toBe(Math.floor(12 * 1.15))
    expect(sellPrice(state, key, '不存在的東西')).toBeNull()
    sellItem(state, 'general', '藥草', 2)
    expect(state.inventory.find((i) => i.name === '藥草')?.qty).toBe(1)

    const lamp = shop.deals.find((d) => d.id === 'item:油燈')!
    const full = dealMoney(state, key, lamp)
    setAffinity(state, shop.keeper, 50)
    expect(dealMoney(state, key, lamp)).toBe(Math.round(lamp.gives[0]!.amount! * 0.9))
    expect(dealMoney(state, key, lamp)).toBeLessThan(full)
  })

  it('bargains over one deal with a check', () => {
    const state = game(4)
    const shop = shopState(state, 'general')
    const deal = shop.deals.find((d) => d.id === 'item:微弱治療藥劑')!
    const before = deal.gives[0]!.amount!
    prepareAction(state, { kind: 'bargain', target: `general|${deal.id}`, text: '指出瓶子有裂痕' })
    state.pendingAction!.natural = 20
    const report = resolveAction(state, null)
    expectValid(report)
    expect(deal.gives[0]!.amount).toBe(Math.round(before * 0.7))
    expect(deal.haggled).toBe(true)
    expect(() => prepareAction(state, { kind: 'bargain', target: `general|${deal.id}`, text: '' })).toThrow('交涉過')
  })

  it('validates an AI-made list: floors prices, caps effects, keeps the normal goods and specials', () => {
    const state = game(5)
    const normal = shopState(state, 'tavern').deals.map((d) => d.id)
    const n = applyAiDeals(state, 'tavern', {
      deals: [
        { title: '老闆的私藏蜂蜜酒', gives: [{ type: 'money', amount: 1 }], gets: [{ type: 'item', name: '蜂蜜酒', qty: 1, category: 'food', price_cc: 40, desc: '甜而不膩' }, { type: 'affinity', npc: 'keeper', delta: 50 }] },
        { title: '偷偷塞的金幣', gives: [], gets: [{ type: 'money', amount: 99999 }] },
        { title: '替醉漢結帳', gives: [{ type: 'money', amount: 30 }], gets: [{ type: 'companion', mode: 'hired', npc: { name: '醉漢', level: 9 } }] },
        { title: '黑市的人', gives: [{ type: 'money', amount: 10 }], gets: [{ type: 'companion', mode: 'slave', npc: { name: '欠債的少年', race: 'human', class: 'rogue', level: 1 } }] },
      ],
    })
    expect(n).toBe(3)
    const shop = shopState(state, 'tavern')
    expect(shop.source).toBe('ai')
    const mead = shop.deals[0]!
    expect(mead.gives[0]!.amount).toBe(Math.ceil(40 * 1.15 * 0.8))
    expect(mead.gets[1]).toEqual({ type: 'affinity', npc: 'keeper', delta: 3 })
    expect(state.customItems!['蜂蜜酒']).toMatchObject({ category: 'food', price_cc: 40 })
    const drunk = shop.deals[1]!
    expect(drunk.gets[0]).toMatchObject({ type: 'companion', mode: 'hired', npc: { level: 2 } })
    // 索里耶爾有黑市，所以可以有奴隸交易，價格不低於世界書的價格表
    const slave = shop.deals[2]!
    expect(slave.gives[0]!.amount).toBeGreaterThanOrEqual(Math.ceil(800 * 1.15 * 0.8))
    expect(shop.deals.some((d) => d.id === 'special:round')).toBe(true)
    // 平常的商品照賣，AI 的特別商品加在前面
    expect(shop.deals.slice(3).map((d) => d.id)).toEqual(normal)

    state.money_cc = 5000
    buyDeal(state, 'tavern', drunk.id)
    expect(state.party.some((m) => m.name === '醉漢' && m.bond === 'hired')).toBe(true)
    buyDeal(state, 'tavern', mead.id)
    expect(state.inventory.find((i) => i.name === '蜂蜜酒')?.qty).toBe(1)
    expect(sellPrice(state, shopKey(state, 'tavern'), '蜂蜜酒')).toBe(Math.floor(40 * 0.5 * 1.15 * (1 + 0.006 / 2)))
  })

  it('builds the shop prompt from the catalog', () => {
    const state = game(6)
    shopState(state, 'general')
    const p = buildShopPrompt(state, 'general')
    expect(p.user).toContain('乾糧')
    expect(p.system).toContain('"deals"')
  })
})

describe('negotiation', () => {
  function atGuild(seed: number) {
    const state = game(seed)
    standOn(state, 'guild')
    const quest = guildQuests(state).find((q) => q.rank === 'F')!
    return { state, quest }
  }

  it('negotiates a quest reward by choosing an option (rules check)', () => {
    const { state, quest } = atGuild(7)
    const reward = quest.reward_cc
    const n = startNegotiation(state, 'quest_reward', { quest: quest.id })
    expect(n.base_dc).toBe(13)
    expect(n.options).toHaveLength(5)
    const deposit = n.options.find((o) => o.cost_cc)!
    expect(deposit.cost_cc).toBe(Math.round(reward * 0.1))
    // 讓這個選項必定大成功（自然 1 除外）
    n.options[0]!.dc = -50
    const report = chooseOption(state, n.id, n.options[0]!.id)
    expectValid(report)
    expect(report.check?.source).toBe('rules')
    expect(report.check!.natural).not.toBe(1)
    expect(report.check!.degree).toBe('critical')
    expect(quest.reward_cc).toBe(Math.round(reward * 1.35))
    expect(quest.flags?.negotiated).toBe(true)
    expect(canNegotiate(state, 'quest_reward', { quest: quest.id })).toBe('已經談過了')
  })

  it('lets the player describe a free approach that the AI judges, with the same outcome table', () => {
    const { state, quest } = atGuild(8)
    const reward = quest.reward_cc
    const n = startNegotiation(state, 'quest_reward', { quest: quest.id })
    const p = prepareAction(state, { kind: 'negotiation', target: n.id, text: '說起上個月在近郊救過公會職員的事' })
    expect(p.outcomes.success).toBe('報酬 +20%')
    const judgment = sanitizeJudgment(state, p, { degree: 'success', summary: '職員想起了那件事', effects: [] })
    const report = resolveAction(state, judgment)
    expectValid(report)
    expect(quest.reward_cc).toBe(Math.round(reward * 1.2))
    expect(n.status).toBe('done')
  })

  it('keeps the negotiation open after a partial success', () => {
    const { state, quest } = atGuild(9)
    const n = startNegotiation(state, 'quest_reward', { quest: quest.id })
    prepareAction(state, { kind: 'negotiation', target: n.id, text: '再拜託一次' })
    resolveAction(state, sanitizeJudgment(state, state.pendingAction!, { degree: 'partial', effects: [] }))
    expect(n.status).toBe('open')
    expect(n.attempts).toBe(1)
    prepareAction(state, { kind: 'negotiation', target: n.id, text: '最後一次' })
    resolveAction(state, sanitizeJudgment(state, state.pendingAction!, { degree: 'partial', effects: [] }))
    expect(n.status).toBe('done')
  })

  it('no longer offers "asking around for a lead"; a lead from the informant still helps the quest check', () => {
    const state = game(10)
    state.quests.push({
      id: 'q-test', title: '找回錢袋', rank: 'F', kind: 'search', area: 'town', template: 'lost_purse',
      giver: 'soriel', target: 'soriel', goal: 1, progress: 0, reward_cc: 40, status: 'accepted',
    })
    expect(() => startNegotiation(state, 'quest_lead', { quest: 'q-test' })).toThrow('沒有這種談判')
    // 情報商賣的線索（委託旗標 lead）
    const quest = state.quests.find((q) => q.id === 'q-test')!
    quest.flags = { lead: true }
    standOn(state, 'shop')
    const r = doTownQuest(state, 'q-test') as Report
    // 熟練 +2，線索 +5
    expect(r.timeline?.[0]?.roll?.dice).toBe('1d20+7')
  })

  it('asks the AI for options and clamps their DCs', () => {
    const state = game(11)
    shopState(state, 'general')
    const n = startNegotiation(state, 'shop_discount', { shop: 'general' })
    const prompt = buildNegotiationPrompt(state, n)
    expect(prompt.user).toContain('9 折')
    const count = applyAiOptions(state, n.id, { options: [
      { label: '稱讚店裡的擺設', attr: 'cha', dc: 1 },
      { label: '幫忙修好壞掉的秤', attr: 'int', dc: 99, cost_cc: 999999 },
      { label: '亂寫', attr: 'luck', dc: 10 },
    ] })
    expect(count).toBe(2)
    expect(n.options.map((o) => o.dc)).toEqual([n.base_dc - 3, n.base_dc + 3])
    expect(n.options[1]!.cost_cc).toBe(100)
  })

  it('gives a lasting shop discount', () => {
    const state = game(12)
    const key = shopKey(state, 'general')
    shopState(state, 'general')
    const n = startNegotiation(state, 'shop_discount', { shop: 'general' })
    prepareAction(state, { kind: 'negotiation', target: n.id, text: '答應每週都來' })
    resolveAction(state, sanitizeJudgment(state, state.pendingAction!, { degree: 'success', effects: [] }))
    expect(state.flags[`discount:${key}`]).toBe(0.1)
    expect(canNegotiate(state, 'shop_discount', { shop: 'general' })).toBe('已經談過了')
  })
})

describe('items', () => {
  it('uses a potion and equips gear, returning the old gear to the pack', () => {
    const state = game(13)
    const pc = state.party[0]!
    pc.hp = 1
    state.inventory.push({ name: '微弱治療藥劑', qty: 1 }, { name: '鐵板甲', qty: 1 }, { name: '鋼巨斧', qty: 1 })
    useItem(state, '微弱治療藥劑', 'pc')
    expect(pc.hp).toBeGreaterThanOrEqual(5)
    expect(state.inventory.some((i) => i.name === '微弱治療藥劑')).toBe(false)
    // 戰士開局：鐵長劍、鐵盾、鐵鍊甲
    expect(pc.armor).toBe('chain')
    expect(pc.gear?.off_hand?.name).toBe('鐵盾')
    equipItem(state, '鐵板甲', 'pc')
    expect(pc.armor).toBe('plate')
    expect(state.inventory.find((i) => i.name === '鐵鍊甲')?.qty).toBe(1)
    // 雙手武器：副手的盾收回行囊
    equipItem(state, '鋼巨斧', 'pc')
    expect(pc.weapon).toBe('greataxe')
    expect(pc.gear?.off_hand).toBeUndefined()
    expect(state.inventory.find((i) => i.name === '鐵盾')?.qty).toBe(1)
  })
})

describe('character creation', () => {
  it('starts at the chosen birthplace with a profile that reaches the AI', () => {
    const state = newGame({
      name: '希爾凡', race: 'elf', classId: 'wizard', seed: 14, birthplace: 'silvermoon',
      gender: '女', appearance: '銀髮，左耳戴著月牙耳飾', background: '為了追查族人失蹤的真相離開森林',
    })
    enterLocation(state)
    const pc = state.party[0]!
    expect(state.location).toBe('silvermoon')
    expect(pc.faction).toBe('elf_court')
    const text = protagonistText(pc, locationById('silvermoon').name)
    expect(text).toContain('女')
    expect(text).toContain('出身：銀月城')
    expect(text).toContain('背景：為了追查')
    const report = state.reports.at(-1) ?? {
      schema_version: '0.1', report_id: 'r-x', kind: 'event', time: { start: state.time, end: state.time },
      location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
    } as Report
    const prompt = buildPrompt(report, [], { playerName: pc.name, language: 'zh-Hant', protagonist: text })
    expect(prompt.user).toContain('<protagonist>')
    expect(() => newGame({ name: 'x', race: 'human', classId: 'fighter', birthplace: 'snake_creek' })).toThrow('聚落')
  })
})
