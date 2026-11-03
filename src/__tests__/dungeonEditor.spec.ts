// @vitest-environment jsdom
// 地下城編輯器（docs/CONTENT_EDITOR.md 3.96 節）：打開不改就存不會改到資料；
// 在編輯器加怪物、在怪物編輯器把怪物放進地下城，改的是同一份遭遇表。
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { dungeonEncounters } from '@/engine/data'
import { newDungeon, type DungeonMod } from '@/engine/dungeonMods'
import { applyContent, emptyMods } from '@/engine/mods'
import { useContent } from '@/stores/content'
import DungeonEditor from '@/components/content/DungeonEditor.vue'
import EnemyEditor from '@/components/content/EnemyEditor.vue'

const ID = 'loc_test_editor'
const cave = (): DungeonMod => ({
  ...newDungeon(ID),
  name: '編輯器洞窟',
  routes: [{ to: 'rivervale', days: [1, 2], mode: 'trail' }],
  layers: { outskirts: [[['slime', 2]]], shallow: [[['slime', 1]]], middle: [], deep: [] },
  bosses: { shallow: [['reef_crab', 1]] },
})

let pinia: ReturnType<typeof createPinia>
beforeEach(() => {
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  const c = useContent()
  c.switchWorld(c.createWorld('地下城測試'))
  c.saveEnemy('mod_enemy_bat', { name: '洞窟蝙蝠', level: 1 })
  c.saveDungeon(ID, cave())
})
afterEach(() => applyContent(emptyMods()))

interface Vm { dirty: boolean; save: () => void }

describe('dungeon editor', () => {
  it('is not dirty when opened, and saving without changes keeps the data', async () => {
    const c = useContent()
    const before = JSON.stringify(c.mods.dungeons[ID])
    const w = mount(DungeonEditor, { props: { id: ID }, global: { plugins: [pinia] } })
    await nextTick()
    const vm = w.vm as unknown as Vm
    expect(vm.dirty).toBe(false)
    vm.save()
    expect(JSON.stringify(c.mods.dungeons[ID])).toBe(before)
    w.unmount()
  })

  it('adds a group to a layer and saves it into the encounter table', async () => {
    const c = useContent()
    const w = mount(DungeonEditor, { props: { id: ID }, global: { plugins: [pinia] } })
    await nextTick()
    const middle = w.findAll('fieldset').find((f) => f.text().startsWith('▾ 中層') || f.text().includes('中層'))
    expect(middle).toBeTruthy()
    const add = w.findAll('button').filter((b) => b.text() === '＋ 新增一組')
    await add[2]!.trigger('click')
    expect((w.vm as unknown as Vm).dirty).toBe(true)
    ;(w.vm as unknown as Vm).save()
    expect(c.mods.dungeons[ID]!.layers.middle!.length).toBe(1)
    expect(dungeonEncounters[ID]!.middle.length).toBe(1)
    w.unmount()
  })
})

describe('enemy editor: custom dungeons', () => {
  it('puts the monster into a custom dungeon layer and takes it out again, saved with the monster', async () => {
    const c = useContent()
    const w = mount(EnemyEditor, { props: { id: 'mod_enemy_bat' }, global: { plugins: [pinia] } })
    await nextTick()
    const vm = w.vm as unknown as Vm & { addSpot: { key: string; count: number }; addToDungeon: () => void; inDungeons: { label: string }[]; removeFromSpot: (s: unknown) => void }
    expect(vm.dirty).toBe(false)
    vm.addSpot.key = `${ID}|layer:shallow`
    vm.addSpot.count = 3
    vm.addToDungeon()
    vm.addSpot.key = `${ID}|boss:shallow`
    vm.addSpot.count = 1
    vm.addToDungeon()
    expect(vm.dirty).toBe(true)
    vm.save()
    expect(c.mods.dungeons[ID]!.layers.shallow).toEqual([[['slime', 1]], [['mod_enemy_bat', 3]]])
    expect(c.mods.dungeons[ID]!.bosses?.shallow).toEqual([['mod_enemy_bat', 1]])
    expect(c.usageOf('enemy', 'mod_enemy_bat')).toEqual(['自建地下城「編輯器洞窟」的淺層、淺層層主'])
    await nextTick()
    for (const sp of [...vm.inDungeons]) vm.removeFromSpot(sp)
    vm.save()
    expect(c.mods.dungeons[ID]!.layers.shallow).toEqual([[['slime', 1]]])
    expect(c.mods.dungeons[ID]!.bosses?.shallow).toBeUndefined()
    w.unmount()
  })

  it('does not offer custom dungeons as spawns on the monster', async () => {
    const w = mount(EnemyEditor, { props: { id: 'mod_enemy_bat' }, global: { plugins: [pinia] } })
    await nextTick()
    const vm = w.vm as unknown as { tables: { key: string }[] }
    expect(vm.tables.some((t) => t.key.includes(ID))).toBe(false)
    w.unmount()
  })
})
