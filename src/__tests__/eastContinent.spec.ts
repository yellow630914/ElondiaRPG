import { describe, expect, it } from 'vitest'
import { enemies, geography, locationById, wildEncounters } from '@/engine/data'
import { ensureRoster } from '@/engine/population'
import { npcRecord } from '@/engine/npcs'
import { perksOf, racePerks } from '@/engine/perks'
import { DEFAULT_BIRTHPLACE, newGame } from '@/engine/state'
import { lineageJobs } from '@/engine/traits'
import { shortestPath } from '@/engine/world'
import { dungeonEncounters } from '@/engine/data'
import { layerRanks } from '@/engine/materialQuests'
import { QUEST_RANGE_DAYS } from '@/engine/town'
import { npcTags, landmarks, specialMaps } from '@/engine/data'
import { standOn } from '@/engine/grid'
import { storyOffersHere } from '@/engine/story'
import { stories, storyCounters } from '@/engine/data'
import { palaceNeedsPersuading } from '@/engine/security'
import { condMet, setFlag } from '@/engine/storyFlags'
import { shopState } from '@/engine/trade'
import { sanitizeItem } from '@/engine/mods'
import { itemDef } from '@/engine/data'
import namedNpcs from '../../data/world/npcs.json'
import mapsData from '../../data/world/maps.json'
import travelEventsData from '../../data/rules/travel_events.json'

// 炎華之地 P1（docs/plan/roadmap/EAST_CONTINENT_PLAN.md）：兩個種族、炎華南域的四座聚落、航線與野外
describe('炎華之地', () => {
  it('births the two races in their home settlements with their race perks', () => {
    expect(DEFAULT_BIRTHPLACE.hualong).toBe('longan')
    expect(DEFAULT_BIRTHPLACE.linghu).toBe('qingqiu')
    expect(racePerks('hualong').map((p) => p.id)).toEqual(['race_hualong'])
    expect(racePerks('linghu').map((p) => p.id)).toEqual(['race_linghu'])
    const s = newGame({ name: '燁測', race: 'hualong', classId: 'wizard', seed: 5, birthplace: 'longan' })
    expect(s.location).toBe('longan')
    expect(locationById(s.location).region).toBe('yanhua_south')
  })

  it('only lets 化龍族 take the 蛇相 flaw', () => {
    const dragon = newGame({ name: '青蘿', race: 'hualong', classId: 'rogue', seed: 1, perks: ['flaw_serpent'] })
    expect(dragon.party[0]!.perks).toContain('flaw_serpent')
    const human = newGame({ name: '路人', race: 'human', classId: 'rogue', seed: 1, perks: ['flaw_serpent'] })
    expect(human.party[0]!.perks ?? []).not.toContain('flaw_serpent')
    expect(perksOf(dragon.party[0]!).map((p) => p.id)).toEqual(expect.arrayContaining(['race_hualong', 'flaw_serpent']))
  })

  it('reaches the east only by the 10-day sea route from 潮汐港', () => {
    const sea = shortestPath('tidehaven', 'quanzhou')!
    expect(sea.days).toEqual([10, 10])
    expect(sea.legs[0]?.fare).toBe(150)
    expect(shortestPath('quanzhou', 'longan')?.days).toEqual([4, 4])
    expect(shortestPath('longan', 'qingqiu')?.days).toEqual([3, 3])
    // 沿海渡口沒有直航：往瑔州港一定經過潮汐港
    expect(shortestPath('coast_ferry', 'quanzhou')?.legs.map((l) => l.to)).toContain('tidehaven')
    // 炎華北原（P6）：從青丘屯或龍安府走過去
    expect(geography.locations.filter((l) => l.region === 'yanhua_north' && l.type !== 'dungeon').map((l) => l.id).sort()).toEqual(['jinzhang', 'yinghe'])
    expect(shortestPath('qingqiu', 'yinghe')?.days).toEqual([3, 3])
    expect(shortestPath('longan', 'yinghe')?.days).toEqual([5, 5])
    expect(shortestPath('yinghe', 'jinzhang')?.days).toEqual([4, 4])
  })

  it('births 人馬族 in 金帳王庭 and fills the northern wild table with level 1-2 monsters', () => {
    expect(DEFAULT_BIRTHPLACE.centaur).toBe('jinzhang')
    expect(racePerks('centaur').map((p) => p.id)).toEqual(['race_centaur'])
    const s = newGame({ name: '其其格', race: 'centaur', classId: 'ranger', seed: 5, birthplace: DEFAULT_BIRTHPLACE.centaur })
    expect(s.location).toBe('jinzhang')
    expect(locationById(s.location).region).toBe('yanhua_north')
    const races = ensureRoster(s, 'jinzhang')!.members.map((m) => npcRecord(s, m)!.race)
    expect(races.filter((r) => r === 'centaur').length).toBeGreaterThan(races.length / 2)
    const ids = new Set(wildEncounters('yanhua_north').flatMap((g) => g.map(([id]) => id)))
    for (const id of ['steppe_wolf_pack', 'horse_bandit', 'snow_leopard', 'steppe_vulture', 'sandstorm_spirit', 'sheep_spirit', 'white_deer_spirit']) {
      expect(ids.has(id), id).toBe(true)
      expect(enemies[id]!.habitats).toEqual(['yanhua_north'])
    }
    for (const id of ids) expect(enemies[id]!.level, id).toBeLessThanOrEqual(2)
  })

  it('fills the southern wild table with level 1-2 monsters, including the new ones', () => {
    const groups = wildEncounters('yanhua_south')
    const ids = new Set(groups.flatMap((g) => g.map(([id]) => id)))
    for (const id of ['jianjing_robber', 'stray_dog_pack', 'bamboo_viper', 'canal_ghost', 'huang_pizi', 'salt_smuggler', 'peony_spirit', 'carp_spirit', 'oilpaper_umbrella']) {
      expect(ids.has(id), id).toBe(true)
      expect(enemies[id]!.habitats).toEqual(['yanhua_south'])
    }
    for (const id of ids) expect(enemies[id]!.level, id).toBeLessThanOrEqual(2)
  })

  it('names 化龍族 surname first and mostly gives them the job of their scale colour', () => {
    const s = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 11, birthplace: 'longan' })
    const recs = ['longan', 'pingjiang', 'quanzhou'].flatMap((id) => ensureRoster(s, id)!.members.map((m) => npcRecord(s, m)!))
    // 只看生成的人物（固定 NPC 的血統是手寫的，例如「天青鱗（點青）」）
    // 娼館的人（老鴇、娼妓、奴隸）由別的流程生成，不照鱗色
    const dragons = recs.filter((r) => r.race === 'hualong' && !r.id.startsWith('npc_') && !(r.tags ?? []).some((t) => t === 'prostitute' || t === 'slave'))
    expect(dragons.length).toBeGreaterThan(20)
    // 一定帶姓、姓在前（沒有「名・姓」的寫法）
    for (const r of dragons) expect(r.name, r.name).not.toContain('・')
    let fit = 0
    for (const r of dragons) {
      const jobs = lineageJobs('hualong', r.lineage)!
      expect(jobs, r.lineage).toBeDefined()
      const ok = r.kind === 'adventurer' ? !!r.class && jobs.classes!.includes(r.class) : (r.tags ?? []).some((t) => jobs.tags!.includes(t))
      if (ok) fit++
    }
    // 鱗色約九成決定身分（亂數抽到的職業本來就可能剛好符合，所以比 90% 再高一點也正常）
    expect(fit / dragons.length).toBeGreaterThan(0.8)
    // 用到的身分標籤都存在
    for (const r of dragons) for (const t of r.tags ?? []) expect(npcTags.tags[t], t).toBeDefined()
  })

  it('opens three dungeons near the southern cities, out of range of the western guilds', () => {
    const near: Record<string, string> = { yongzhao_tomb: 'longan', qianyao_valley: 'pingjiang', gunpowder_ruins: 'quanzhou' }
    for (const [d, town] of Object.entries(near)) {
      expect(locationById(d).region).toBe('yanhua_south')
      expect(shortestPath(town, d)!.days[1]).toBeLessThanOrEqual(1)
      // 潮汐港的公會不會發東大陸的委託（海路 10 天）
      expect(shortestPath('tidehaven', d)!.days[1]).toBeGreaterThan(QUEST_RANGE_DAYS)
      const enc = dungeonEncounters[d]!
      for (const layer of ['outskirts', 'shallow', 'middle', 'deep', 'abyss'] as const) expect(enc[layer]?.length, `${d} ${layer}`).toBeGreaterThan(0)
      // 等級照中央平原：周邊 1 級、底層 11～12 級，層主 3／6／7／13 級
      const lv = (layer: 'outskirts' | 'abyss') => enc[layer]!.flat().map(([id]) => enemies[id]!.level)
      expect(Math.max(...lv('outskirts'))).toBe(1)
      expect(Math.max(...lv('abyss'))).toBeGreaterThanOrEqual(11)
      expect((['shallow', 'middle', 'deep', 'abyss'] as const).map((l) => enemies[enc.bosses![l]![0]![0]]!.level)).toEqual([3, 6, 7, 13])
      // 公會階級一層比一層高
      const ranks = layerRanks(d).map((r) => r.rank)
      expect(ranks.length).toBe(4)
      const order = 'FEDCBAS'
      for (let i = 1; i < ranks.length; i++) expect(order.indexOf(ranks[i]!), `${d} ${ranks.join('')}`).toBeGreaterThanOrEqual(order.indexOf(ranks[i - 1]!))
    }
  })

  it('gives every southern landmark a place on the map and a person, and offers the first errand at 龍安府 guild', () => {
    const lms = Object.values(landmarks).filter((l) => l.id.startsWith('lm_yh_'))
    // 19 個，加上 R26 打工線的狀元客舍、畫舫碼頭、珠船塢、大車店的大炕
    expect(lms.length).toBe(23)
    const s = newGame({ name: '測試者', race: 'hualong', classId: 'fighter', seed: 2, birthplace: 'longan' })
    for (const l of lms) {
      // 地標要擺得上地圖（站得上去）
      s.location = l.location
      expect(standOn(s, l.id as never), l.id).toBe(true)
      if (l.interior) expect(specialMaps[l.interior]?.location, l.id).toBe(l.location)
    }
    const yh = (namedNpcs as { npcs: { id: string; landmark?: string; location: string }[] }).npcs.filter((n) => n.id.startsWith('npc_yh_'))
    // 36 位，加上 R26 打工線的委託人 4 位
    expect(yh.length).toBe(40)
    for (const l of lms.filter((x) => !['lm_yh_rainbow_bridge'].includes(x.id))) expect(yh.some((n) => n.landmark === l.id), `${l.id} 沒有人`).toBe(true)
    for (const n of yh) if (n.landmark) expect(landmarks[n.landmark]?.location, n.id).toBe(n.location)
    // 新手的第一條委託：龍安府公會
    const g = newGame({ name: '測試者', race: 'hualong', classId: 'fighter', seed: 2, birthplace: 'longan' })
    expect(standOn(g, 'guild')).toBe(true)
    expect(storyOffersHere(g).map((d) => d.id)).toContain('yh_banned_manuscript')
  })

  it('gives the eight adult characters three adult quests each, and the four group quests their partners', () => {
    const lines = ['蕭鳳儀', '溫如玉', '玄霜', '青蘿', '胡三娘', '赤鬟', '溫懿', '胡玉綃']
    const ya = stories.filter((s) => s.id.startsWith('ya'))
    expect(ya.length).toBe(24)
    for (const name of lines) {
      const l = ya.filter((s) => s.summary.includes(`（${name}・`))
      expect(l.map((s) => s.rank), name).toEqual(['D', 'C', 'B'])
      for (const s of l) expect(s.tags?.[0], s.id).toBe('adult')
      // 三的最後一步讓兩人在一起
      const ends = l[2]!.nodes.at(-1)!.options!.map((o) => o.success!)
      for (const o of ends) expect(o.set_flags!.some((f) => f.endsWith('_lover')) && !!o.scene, l[2]!.id).toBe(true)
    }
    // 多人任務：條件是各自的線
    const group = Object.fromEntries(stories.filter((s) => s.id.startsWith('yg_')).map((s) => [s.id, s]))
    expect(Object.keys(group).sort()).toEqual(['yg_five_seats', 'yg_gold_ink', 'yg_hu_reunion', 'yg_two_generations'])
    expect(group.yg_five_seats!.start.requires!.flags).toEqual(['yhpol_constitution', 'yczh_lover', 'ycsh_lover', 'yclq_lover', 'ychj_lover', 'ycjy_lover'])
    expect(group.yg_five_seats!.tags).toBeUndefined()
    expect(group.yg_two_generations!.start.requires!.flags).toEqual(['yawy_lover', 'yczh_x_done'])
    expect(group.yg_two_generations!.summary).toMatch(/^內容警示/)
    expect(group.yg_hu_reunion!.start.requires!.flags).toEqual(['yayx_lover', 'yasn_lover', 'ychj_x_done'])
    expect(group.yg_gold_ink!.start.requires!.flags).toEqual(['ycjy_x_done', 'yclq_x_done'])
    // 地標的場景：旗標由這些任務設定
    const sets = new Set(stories.flatMap((s) => s.nodes.flatMap((n) => [n.success, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])]).flatMap((o) => o?.set_flags ?? [])))
    const scenes = Object.values(landmarks).filter((l) => l.id.startsWith('lm_yh_')).flatMap((l) => l.scenes ?? [])
    // 成人向角色與多人任務的 10 個，加上 R26 打工線回去上工的 8 個
    expect(scenes.length).toBe(18)
    for (const sc of scenes) {
      expect(sc.tags, sc.title).toContain('adult')
      for (const f of sc.requires!.flags!) expect(sets.has(f), `${sc.title} ${f}`).toBe(true)
    }
  })

  it('lets a quest flag stand in for the palace permit (宮裡的腰牌)', () => {
    const s = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 2, birthplace: 'longan' })
    expect(palaceNeedsPersuading(s)).toBe(true)
    setFlag(s, 'palace_permit_longan')
    expect(palaceNeedsPersuading(s)).toBe(false)
    // 皇城裡的三位：第一個任務就給腰牌
    for (const id of ['yawr_lesson', 'yawy_errand', 'yayx_rumor']) {
      const d = stories.find((x) => x.id === id)!
      expect(d.nodes[0]!.success!.set_flags, id).toContain('palace_permit_longan')
    }
  })

  it('sells the east specialties only in 炎華之地 shops (items.regions)', () => {
    const sold = (loc: string, type: 'general' | 'tavern') => {
      const s = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3, birthplace: loc })
      return shopState(s, type).deals.map((d) => d.title)
    }
    expect(sold('longan', 'general')).toEqual(expect.arrayContaining(['指南魚', '狐火燈', '龍團茶餅']))
    expect(sold('longan', 'tavern')).toContain('燒鵝')
    expect(sold('soriel', 'general')).not.toContain('指南魚')
    expect(sold('soriel', 'tavern')).not.toContain('燒鵝')
    expect(itemDef('鐵朴刀')!.regions).toEqual(['yanhua_south', 'yanhua_north'])
    // 內容編輯器的整理留著地區
    expect(sanitizeItem('x', { ...itemDef('燒鵝')!, regions: ['yanhua_south', 'Bad Id!'] }, true).regions).toEqual(['yanhua_south'])
  })

  it('opens two northern dungeons on the 北境 level band, and gives 北原 its people and landmarks', () => {
    const near: Record<string, string> = { mingdi_field: 'jinzhang', whitewolf_cave: 'yinghe' }
    for (const [d, town] of Object.entries(near)) {
      expect(locationById(d).region).toBe('yanhua_north')
      expect(shortestPath(town, d)!.days[1]).toBeLessThanOrEqual(2)
      const enc = dungeonEncounters[d]!
      const lv = (layer: 'outskirts' | 'abyss') => enc[layer]!.flat().map(([id]) => enemies[id]!.level)
      expect(Math.max(...lv('outskirts'))).toBe(3)
      expect(Math.max(...lv('abyss'))).toBe(11)
      expect((['shallow', 'middle', 'deep', 'abyss'] as const).map((l) => enemies[enc.bosses![l]![0]![0]]!.level)).toEqual([5, 7, 9, 13])
      const ids = new Set([
        ...(['outskirts', 'shallow', 'middle', 'deep', 'abyss'] as const).flatMap((l) => enc[l]!.flat().map(([id]) => id)),
        ...Object.values(enc.bosses!).flatMap((g) => g!.map(([id]) => id)),
      ])
      for (const id of ids) expect(enemies[id]!.habitats, id).toEqual(['yanhua_north'])
    }
    const lms = Object.values(landmarks).filter((l) => l.id.startsWith('lm_td_'))
    // 7 個加上燁婉寧的 NTR 線開放的野馬帳（P8f）
    expect(lms.length).toBe(8)
    const s = newGame({ name: '測試者', race: 'centaur', classId: 'fighter', seed: 2, birthplace: 'jinzhang' })
    // 野馬帳是藏起來的地標：燁婉寧的 NTR 線走完才出現
    setFlag(s, 'tdwn_club')
    for (const l of lms) {
      s.location = l.location
      expect(standOn(s, l.id as never), l.id).toBe(true)
      if (l.interior) expect(specialMaps[l.interior]?.location, l.id).toBe(l.location)
    }
    const td = (namedNpcs as { npcs: { id: string; landmark?: string; location: string; race: string }[] }).npcs.filter((n) => n.id.startsWith('npc_td_'))
    // 18 位，加上 R26 打工線的委託人孫舌頭（靈狐族）
    expect(td.length).toBe(19)
    // 外地人五位（化龍族三位、靈狐族兩位），其他都是人馬族
    expect(td.filter((n) => n.race !== 'centaur').length).toBe(5)
    for (const n of td) if (n.landmark) expect(landmarks[n.landmark]?.location, n.id).toBe(n.location)
    expect(specialMaps.sm_td_inner_tent?.location).toBe('jinzhang')
  })

  it('ends every northern region line with a war, peace or 海東 choice (P8a)', () => {
    const td = stories.filter((s) => /^td[nrlsth]_/.test(s.id))
    expect(td.length).toBe(15)
    for (const id of ['tdl_the_code', 'tds_missing_tribute', 'tdt_tea_horse', 'tdh_tribute_day']) {
      const s = td.find((x) => x.id === id)!
      const opts = s.nodes.at(-1)!.options!
      const counters = opts.map((o) => Object.keys(o.success!.counters ?? {}))
      expect(counters, id).toEqual([['td_war'], ['td_peace'], ['td_haidong']])
      for (const o of opts) expect(o.success!.complete, id).toBe(true)
    }
    for (const c of ['td_war', 'td_peace', 'td_haidong']) expect(storyCounters[c]?.initial, c).toBe(0)
  })

  it('adds the 古戰場 and 雪窟 dungeon lines, the fiddle quest and two small ones (P8b)', () => {
    const ids = ['tdm_named_arrow', 'tdm_iron_pagoda', 'tdm_nameless_khan', 'tdw_coming_of_age', 'tdw_ice_queen', 'tdw_blue_wolf', 'tdu_broken_fiddle', 'tdx_post_letter', 'tdx_lost_foal']
    for (const id of ids) expect(stories.find((s) => s.id === id), id).toBeTruthy()
    const gearBy: Record<string, string> = { tdm_nameless_khan: '無名可汗的戰旗', tdw_blue_wolf: '蒼狼的牙', tdu_broken_fiddle: '老馬倌的馬頭琴' }
    for (const [id, name] of Object.entries(gearBy)) expect(JSON.stringify(stories.find((s) => s.id === id)), id).toContain(name)
    const khan = stories.find((s) => s.id === 'tdm_nameless_khan')!
    expect(JSON.stringify(khan)).toContain('tdm_name')
  })

  it('lets the northern politics line always reach at least one ending (P8c)', () => {
    const ids = ['tdpol_summons', 'tdpol_kurultai', 'tdpol_naadam', 'tdpol_end_khanate', 'tdpol_end_south', 'tdpol_end_haidong']
    for (const id of ids) expect(stories.find((s) => s.id === id), id).toBeTruthy()
    const naadam = stories.find((s) => s.id === 'tdpol_naadam')!
    const sides = naadam.nodes.find((n) => n.id === 'oath')!.options!
    const verdict = naadam.nodes.at(-1)!.options!
    type Range = { min?: number; max?: number }
    const ok = (req: { flags?: string[]; counters?: Record<string, Range> } | undefined, flags: Set<string>, c: Record<string, number>) =>
      (req?.flags ?? []).every((f) => flags.has(f)) &&
      Object.entries(req?.counters ?? {}).every(([k, r]) => (r.min === undefined || c[k]! >= r.min) && (r.max === undefined || c[k]! <= r.max))
    const keys = ['td_war', 'td_peace', 'td_haidong']
    // 四條地方線的結局：沒走（-1）或三選一；至少走完一條才會被召見
    let combos = 0
    for (let code = 0; code < 4 ** 4; code++) {
      const picks = [0, 1, 2, 3].map((i) => Math.floor(code / 4 ** i) % 4 - 1)
      if (picks.every((p) => p < 0)) continue
      for (const side of sides) {
        const c: Record<string, number> = { td_war: 0, td_peace: 0, td_haidong: 0 }
        for (const p of picks) if (p >= 0) c[keys[p]!]! += 1
        for (const [k, v] of Object.entries(side.success!.counters ?? {})) c[k]! += v
        const flags = new Set(side.success!.set_flags)
        const open = verdict.filter((o) => ok(o.requires as never, flags, c))
        expect(open.length, JSON.stringify({ picks, side: side.label })).toBeGreaterThan(0)
        combos++
      }
    }
    expect(combos).toBe((4 ** 4 - 1) * 3)
    const starts = new Set(verdict.map((o) => (o.success!.effects ?? []).find((e) => e.type === 'start_story')?.story))
    expect([...starts].sort()).toEqual(['tdpol_end_haidong', 'tdpol_end_khanate', 'tdpol_end_south'])
    expect(JSON.stringify(stories.find((s) => s.id === 'tdpol_summons'))).toContain('palace_permit_jinzhang')
  })

  it('opens the north-south politics routes from the table in EAST_CONTENT_PLAN 11.11 (P8d)', () => {
    const council = stories.find((s) => s.id === 'nspol_night_council')!.nodes.at(-1)!.options!
    const routeOf = (o: (typeof council)[number]) => (o.success!.effects ?? []).find((e) => e.type === 'start_story')?.story?.replace('nspol_end_', '')
    const expected: Record<string, Record<string, string[]>> = {
      tdpol_khanate: { yhpol_monarchy: ['war'], yhpol_republic: ['war'], yhpol_constitution: ['alliance', 'war'] },
      tdpol_south: { yhpol_monarchy: ['alliance'], yhpol_republic: ['alliance', 'war'], yhpol_constitution: ['alliance'] },
      tdpol_haidong: { yhpol_monarchy: ['alliance', 'sea'], yhpol_republic: ['sea'], yhpol_constitution: ['sea'] },
    }
    for (const [td, row] of Object.entries(expected)) {
      for (const [yh, routes] of Object.entries(row)) {
        const flags = new Set([td, yh])
        const open = council.filter((o) => (o.requires?.flags ?? []).every((f) => flags.has(f))).map(routeOf)
        expect([...new Set(open)].sort(), `${td} × ${yh}`).toEqual(routes)
      }
    }
    // 終章的友軍：大燁三種、媞丹三種政體各有一個選項
    const war = stories.find((s) => s.id === 'nspol_end_war')!
    for (const id of ['rally_yh', 'rally_td']) {
      const reqs = war.nodes.find((n) => n.id === id)!.options!.map((o) => o.requires!.flags![0])
      expect(reqs.sort(), id).toEqual(id === 'rally_yh' ? ['yhpol_constitution', 'yhpol_monarchy', 'yhpol_republic'] : ['tdpol_haidong', 'tdpol_khanate', 'tdpol_south'])
    }
    const gives: Record<string, string> = { nspol_end_alliance: '盟誓的角弓', nspol_end_war: '破陣彎刀', nspol_end_sea: '海東青的盟符' }
    for (const [id, name] of Object.entries(gives)) expect(JSON.stringify(stories.find((s) => s.id === id)), id).toContain(name)
    expect(stories.find((s) => s.id === 'nspol_envoys')!.start.requires!.flags).toEqual(['yhpol_done', 'tdpol_done'])
  })

  it('gives five northern characters a four-quest line and the two empresses a group quest (P8e)', () => {
    const lines: Record<string, string> = { tdcu: 'npc_td_ulantuya', tdcc: 'npc_td_chalan', tdcq: 'npc_td_qiqige', tdch: 'npc_td_hailan', tdct: 'npc_td_toya' }
    for (const [prefix, npc] of Object.entries(lines)) {
      const qs = stories.filter((s) => s.id.startsWith(prefix + '_'))
      expect(qs.map((s) => s.rank), prefix).toEqual(['D', 'C', 'B', 'B'])
      expect(JSON.stringify(qs[2]), prefix).toContain(`${prefix}_lover`)
      expect(qs[3]!.tags, prefix).toContain('adult')
      expect(JSON.stringify(qs), prefix).toContain(npc)
    }
    const twin = stories.find((s) => s.id === 'tdg_twin_empresses')!
    expect(twin.start.requires!.flags).toEqual(['nspol_alliance', 'yczh_lover', 'tdcu_lover'])
    expect(twin.tags).toContain('adult')
    const tent = landmarks['lm_td_golden_tent']!
    expect(tent.scenes?.[0]?.requires).toEqual({ flags: ['tdgse_done'] })
  })

  it('branches 燁婉寧 by the player’s race and opens 野馬帳 only after the NTR line (P8f)', () => {
    const by = (id: string) => stories.find((s) => s.id === id)!
    const centaur = newGame({ name: '測試者', race: 'centaur', classId: 'fighter', seed: 2, birthplace: 'jinzhang' })
    const human = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 2 })
    // ① 兩個版本：人馬族的主角是純愛的版本，其他主角是標 ntr 的版本（設定關掉 NTR 時看不到）
    expect(condMet(centaur, by('tdwn_secret').start.requires)).toBe(true)
    expect(condMet(human, by('tdwn_secret').start.requires)).toBe(false)
    expect(condMet(centaur, by('tdwn_secret_other').start.requires)).toBe(false)
    expect(condMet(human, by('tdwn_secret_other').start.requires)).toBe(true)
    expect(by('tdwn_secret').tags).toEqual(['adult'])
    expect(by('tdwn_secret_other').tags).toContain('ntr')
    // ② 的分岔：純愛只給人馬族、NTR 標在選項上
    const want = by('tdwn_after_naadam').nodes.find((n) => n.id === 'want')!.options!
    expect(want[0]!.requires).toEqual({ pc_races: ['centaur'] })
    expect(want[1]!.tags).toEqual(['ntr'])
    // ③ 純愛只給人馬族；野馬帳標 ntr，完成時開放地標
    expect(by('tdwn_choice').start.requires!.pc_races).toEqual(['centaur'])
    expect(by('tdwn_wild_horse').tags).toContain('ntr')
    expect(JSON.stringify(by('tdwn_wild_horse'))).toContain('tdwn_club')
    expect(JSON.stringify(by('tdwn_choice'))).not.toContain('tdwn_club')
    const wild = landmarks['lm_td_wild_horse']!
    expect(wild.open).toMatchObject({ flags: ['tdwn_club'], hidden: true, adult: true, hours: 'night' })
    expect(wild.scenes!.every((sc) => sc.tags!.includes('ntr'))).toBe(true)
    expect(specialMaps[wild.interior!]?.location).toBe('yinghe')
    // 烏日娜、薩日朗各 3 條成人向；金帳的三人要三條角色線的第四個任務都走完
    for (const p of ['tdur_', 'tdsr_']) expect(stories.filter((s) => s.id.startsWith(p)).map((s) => s.tags?.includes('adult')), p).toEqual([true, true, true])
    expect(by('tdg_golden_three').start.requires!.flags).toEqual(['tdcu_x_done', 'tdcc_x_done', 'tdcq_x_done'])
    expect(by('tdg_golden_three').summary.startsWith('內容警示')).toBe(true)
  })

  it('keeps every eastern NPC findable after the political endings, kept under guard instead of killed', () => {
    type Stage = { requires: { flags?: string[]; flags_any?: string[] }; location: string; fixed?: { area: string; x: number; y: number } }
    type Def = { id: string; name: string; requires?: { flags_none?: string[] }; stages?: Stage[] }
    const east = (namedNpcs as { npcs: Def[] }).npcs.filter((n) => /^npc_(yh|td)_/.test(n.id))
    // 沒有人因為結局消失（以前共和的宰相出逃後就不見了，現在躲在瑔州港）
    for (const n of east) expect(n.requires?.flags_none ?? [], n.id).toEqual([])
    // 固定位置都站在地圖的空地上（城鎮的區塊；特殊地圖照它自己的格子）
    const grids = mapsData.maps as Record<string, { blocks: { id: string; grid: string[] }[] }>
    for (const n of east) {
      for (const st of n.stages ?? []) {
        if (!st.fixed) continue
        const [loc, block] = st.fixed.area.split('/')
        const grid = loc === 'sm' ? specialMaps[block!]!.grid! : grids[loc!]!.blocks.find((b) => b.id === block)!.grid
        expect(grid[st.fixed.y]![st.fixed.x], `${n.id} ${st.fixed.area}`).toBe('.')
      }
    }
    // 南北交會的每一個結局：天可汗、鐵牙、蘇時雍都有下落；輸的一方被軟禁或關起來
    const stageFor = (id: string, flags: string[]) => east.find((n) => n.id === id)!.stages!.find((st) =>
      (st.requires.flags ?? []).every((f) => flags.includes(f)) && (!st.requires.flags_any || st.requires.flags_any.some((f) => flags.includes(f))))
    const endings = [['nspol_alliance', 'tdpol_south'], ['nspol_war', 'nspol_war_yanye', 'tdpol_khanate'], ['nspol_war', 'nspol_war_tidan', 'tdpol_khanate'], ['nspol_sea', 'tdpol_haidong']]
    for (const flags of endings) for (const id of ['npc_td_ulantuya', 'npc_td_tieya', 'npc_td_su_shiyong']) expect(stageFor(id, flags), `${id} ${flags}`).toBeTruthy()
    expect(stageFor('npc_td_tieya', ['nspol_war_yanye'])!.fixed!.area).toBe('longan/palace')
    expect(stageFor('npc_yh_yue_zhenshan', ['nspol_war_tidan'])!.fixed!.area).toBe('jinzhang/beiyuan')
    expect(stageFor('npc_yh_wen_shiheng', ['yhpol_republic'])!.location).toBe('quanzhou')
    // 南域的人也跟著南北交會的結局換背景（east_p3_npcs.py 的 LATE）：每種政體 × 每種結局都有一個階段，位置照政體
    const south = ['npc_yh_zhaohua', 'npc_yh_wen_shiheng', 'npc_yh_yue_zhenshan', 'npc_yh_su_huaijin', 'npc_yh_lu_qinghe', 'npc_yh_hu_jiuniang', 'npc_yh_jin_yutang']
    for (const id of south) {
      for (const polity of ['yhpol_monarchy', 'yhpol_republic', 'yhpol_constitution']) {
        for (const late of ['nspol_alliance', 'nspol_war_yanye', 'nspol_war_tidan', 'nspol_sea']) {
          const st = stageFor(id, [polity, late]) as Stage & { background?: string }
          expect(st?.requires.flags ?? [], `${id} ${polity} ${late}`).toContain(late)
        }
      }
    }
    expect(stageFor('npc_yh_wen_shiheng', ['yhpol_republic', 'nspol_alliance'])!.location).toBe('quanzhou')
  })

  it('gives 炎華北原 its own travel, town and dungeon events (P8g)', () => {
    type Tpl = { id: string; scope?: string; regions?: string[]; locations?: string[]; cells?: string[]; dungeons?: string[]; requires?: { pc_races?: string[] } }
    const td = (travelEventsData as { templates: Tpl[] }).templates.filter((e) => e.id.startsWith('tde_'))
    const scopeOf = (e: Tpl) => e.scope ?? 'travel'
    expect(td.filter((e) => scopeOf(e) === 'travel').length).toBe(7)
    expect(td.filter((e) => scopeOf(e) === 'town').length).toBe(8)
    expect(td.filter((e) => scopeOf(e) === 'dungeon').length).toBe(4)
    for (const e of td.filter((x) => scopeOf(x) === 'travel')) expect(e.regions, e.id).toEqual(['yanhua_north'])
    expect(td.find((e) => e.id === 'tde_young_rider')!.requires!.pc_races).toEqual(['centaur'])
    for (const e of td.filter((x) => scopeOf(x) === 'dungeon')) expect(['mingdi_field', 'whitewolf_cave']).toContain(e.dungeons![0])
    // 城鎮事件的設施在那座聚落的地圖上真的有
    const KIND: Record<string, string> = { I: 'inn', G: 'guild', T: 'tavern', S: 'shop', C: 'temple', E: 'gate', B: 'brothel', F: 'smithy', D: 'tailor', J: 'jeweler', M: 'magic', N: 'informant', H: 'manor', K: 'tattoo', X: 'carver' }
    const maps = mapsData.maps as Record<string, { blocks: { grid: string[] }[] }>
    for (const e of td.filter((x) => scopeOf(x) === 'town')) {
      for (const loc of e.locations!) {
        const kinds = new Set(maps[loc]!.blocks.flatMap((b) => [...b.grid.join('')]).map((ch) => KIND[ch]).filter(Boolean))
        expect(e.cells!.some((c) => kinds.has(c)), `${e.id} @ ${loc}`).toBe(true)
        for (const c of e.cells!) expect(kinds.has(c), `${e.id} @ ${loc}：${c}`).toBe(true)
      }
    }
  })

  it('populates 青丘屯 mostly with 靈狐族', () => {
    const s = newGame({ name: '測試者', race: 'linghu', classId: 'cleric', seed: 4, birthplace: 'qingqiu' })
    const races = ensureRoster(s, 'qingqiu')!.members.map((m) => npcRecord(s, m)!.race)
    expect(races.filter((r) => r === 'linghu').length).toBeGreaterThan(races.length / 2)
  })
})
