import { describe, expect, it } from 'vitest'
import { enemies, geography, locationById, wildEncounters } from '@/engine/data'
import { ensureRoster } from '@/engine/population'
import { npcRecord } from '@/engine/npcs'
import { perksOf, racePerks } from '@/engine/perks'
import { DEFAULT_BIRTHPLACE, newGame } from '@/engine/state'
import { lineageJobs } from '@/engine/traits'
import { shortestPath } from '@/engine/world'
import { npcTags } from '@/engine/data'

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
    const dragons = recs.filter((r) => r.race === 'hualong')
    expect(dragons.length).toBeGreaterThan(30)
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

  it('populates 青丘屯 mostly with 靈狐族', () => {
    const s = newGame({ name: '測試者', race: 'linghu', classId: 'cleric', seed: 4, birthplace: 'qingqiu' })
    const races = ensureRoster(s, 'qingqiu')!.members.map((m) => npcRecord(s, m)!.race)
    expect(races.filter((r) => r === 'linghu').length).toBeGreaterThan(races.length / 2)
  })
})
