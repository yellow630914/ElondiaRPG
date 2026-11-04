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
import namedNpcs from '../../data/world/npcs.json'

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
    // 炎華北原還沒有地點
    expect(geography.locations.filter((l) => l.region === 'yanhua_north')).toEqual([])
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
    expect(lms.length).toBe(19)
    const s = newGame({ name: '測試者', race: 'hualong', classId: 'fighter', seed: 2, birthplace: 'longan' })
    for (const l of lms) {
      // 地標要擺得上地圖（站得上去）
      s.location = l.location
      expect(standOn(s, l.id as never), l.id).toBe(true)
      if (l.interior) expect(specialMaps[l.interior]?.location, l.id).toBe(l.location)
    }
    const yh = (namedNpcs as { npcs: { id: string; landmark?: string; location: string }[] }).npcs.filter((n) => n.id.startsWith('npc_yh_'))
    expect(yh.length).toBe(36)
    for (const l of lms.filter((x) => !['lm_yh_rainbow_bridge'].includes(x.id))) expect(yh.some((n) => n.landmark === l.id), `${l.id} 沒有人`).toBe(true)
    for (const n of yh) if (n.landmark) expect(landmarks[n.landmark]?.location, n.id).toBe(n.location)
    // 新手的第一條委託：龍安府公會
    const g = newGame({ name: '測試者', race: 'hualong', classId: 'fighter', seed: 2, birthplace: 'longan' })
    expect(standOn(g, 'guild')).toBe(true)
    expect(storyOffersHere(g).map((d) => d.id)).toContain('yh_banned_manuscript')
  })

  it('populates 青丘屯 mostly with 靈狐族', () => {
    const s = newGame({ name: '測試者', race: 'linghu', classId: 'cleric', seed: 4, birthplace: 'qingqiu' })
    const races = ensureRoster(s, 'qingqiu')!.members.map((m) => npcRecord(s, m)!.race)
    expect(races.filter((r) => r === 'linghu').length).toBeGreaterThan(races.length / 2)
  })
})
