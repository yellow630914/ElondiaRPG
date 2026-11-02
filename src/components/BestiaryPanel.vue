<script setup lang="ts">
import { computed, ref } from 'vue'
import { BESTIARY_LEVEL_NAME, bestiaryCount, bestiaryLevel, habitats, weaknesses, type BestiaryLevel } from '@/engine/bestiary'
import { abilityDef, enemies, monsterTraits, type EnemyDef } from '@/engine/data'
import { ENEMY_KINDS } from '@/engine/mods'
import { useGame } from '@/stores/game'
import ContentIcon from './icons/ContentIcon.vue'

// 怪物圖鑑（冒險筆記的一頁）：打過、打倒，或聽人說過的怪物會點亮；沒點亮的只顯示數量，不暴雷。
// 聽說：外觀、出沒的地方、弱點與抗性；遭遇：再加上等級、生命、技能、特徵；擊敗：再加上次數與掉落物
const game = useGame()
const s = computed(() => game.state!)
const query = ref('')
const only = ref<BestiaryLevel | ''>('')
const open = ref<string | null>(null)
const count = computed(() => bestiaryCount(s.value))
const RANK: Record<BestiaryLevel, number> = { heard: 1, seen: 2, defeated: 3 }

interface Row { id: string; def: EnemyDef; level: BestiaryLevel }
const groups = computed(() => {
  const book = s.value.bestiary ?? {}
  const q = query.value.trim()
  const byKind = new Map<string, { total: number; rows: Row[] }>()
  for (const def of Object.values(enemies)) {
    const kind = def.kind && ENEMY_KINDS[def.kind] ? def.kind : 'other'
    const g = byKind.get(kind) ?? { total: 0, rows: [] }
    g.total++
    const level = bestiaryLevel(book[def.id])
    if (level && (!only.value || RANK[level] >= RANK[only.value]) && (!q || def.name.includes(q))) g.rows.push({ id: def.id, def, level })
    byKind.set(kind, g)
  }
  return [...Object.keys(ENEMY_KINDS), 'other']
    .filter((k) => byKind.has(k))
    .map((k) => {
      const g = byKind.get(k)!
      const lit = Object.values(enemies).filter((d) => (d.kind && ENEMY_KINDS[d.kind] ? d.kind : 'other') === k && bestiaryLevel(book[d.id])).length
      return { kind: k, name: ENEMY_KINDS[k] ?? '其他', total: g.total, lit, rows: g.rows.sort((a, b) => a.def.level - b.def.level || a.def.name.localeCompare(b.def.name)) }
    })
})
/** 有點亮的種類才列出來；一隻都沒點亮的種類合成最後一行 */
const shown = computed(() => groups.value.filter((g) => g.lit))
const dark = computed(() => groups.value.filter((g) => !g.lit))

function heardText(id: string): string {
  const h = s.value.bestiary?.[id]?.heard
  return h ? `第 ${h.day} 天${h.from ? `聽${h.from}說起` : '聽人說起'}` : ''
}
const traitNames = (def: EnemyDef) => (def.traits ?? []).map((t) => monsterTraits.traits[t]?.name ?? t)
const abilityNames = (def: EnemyDef) => (def.abilities ?? []).map((a) => abilityDef(a).name)
const loot = (def: EnemyDef) => [...new Set((def.loot ?? []).map((l) => l.item))]
</script>

<template>
  <div class="bestiary">
    <div class="row head">
      <b>點亮 {{ count.lit }} / {{ count.total }} 種</b>
      <span class="grow" />
      <input v-model="query" class="search" placeholder="搜尋名字" />
      <select v-model="only" title="只看點亮到這個程度以上的">
        <option value="">全部點亮的</option>
        <option value="seen">遭遇過以上</option>
        <option value="defeated">擊敗過</option>
      </select>
    </div>
    <p v-if="!count.lit" class="muted small">還沒有點亮任何怪物。打過的怪物，或向人打聽到的怪物，會記在這裡。</p>
    <template v-else>
      <section v-for="g in shown" :key="g.kind" class="group">
        <h4 class="small"><span>{{ g.name }}</span><span class="muted">{{ g.lit }} / {{ g.total }}</span></h4>
        <ul class="plain">
          <li v-for="r in g.rows" :key="r.id" class="entry" :class="{ open: open === r.id }">
            <button class="line" @click="open = open === r.id ? null : r.id">
              <ContentIcon kind="monster" :def="r.def" :size="26" />
              <span class="name">{{ r.def.name }}</span>
              <span v-if="r.level !== 'heard'" class="small muted">Lv.{{ r.def.level }}</span>
              <span class="tag small" :class="r.level">{{ BESTIARY_LEVEL_NAME[r.level] }}<template v-if="r.level === 'defeated'"> ×{{ s.bestiary?.[r.id]?.defeated }}</template></span>
            </button>
            <div v-if="open === r.id" class="detail small">
              <p v-if="r.def.desc">{{ r.def.desc }}</p>
              <div v-if="weaknesses(r.def).weak.length"><b>弱點</b> {{ weaknesses(r.def).weak.join('、') }}</div>
              <div v-if="weaknesses(r.def).resist.length"><b>抗性</b> {{ weaknesses(r.def).resist.join('、') }}</div>
              <div v-if="habitats(r.id).length"><b>出沒</b> {{ habitats(r.id).slice(0, 8).join('、') }}<template v-if="habitats(r.id).length > 8">……</template></div>
              <template v-if="r.level !== 'heard'">
                <div><b>能力</b> 生命 {{ r.def.hp }}・行動點 {{ r.def.ap }}・閃避 {{ r.def.evade }}<template v-if="r.def.dr">・減傷 {{ r.def.dr }}</template></div>
                <div v-if="abilityNames(r.def).length"><b>技能</b> {{ abilityNames(r.def).join('、') }}</div>
                <div v-if="traitNames(r.def).length"><b>特徵</b> {{ traitNames(r.def).join('、') }}</div>
              </template>
              <div v-if="r.level === 'defeated' && loot(r.def).length"><b>掉落</b> {{ loot(r.def).join('、') }}</div>
              <div v-if="heardText(r.id)" class="muted">{{ heardText(r.id) }}</div>
              <div v-if="r.level === 'heard'" class="muted">實際打過之後，能看到等級、技能與特徵。</div>
            </div>
          </li>
        </ul>
        <p v-if="g.total > g.lit" class="small muted unlit">還有 {{ g.total - g.lit }} 種沒點亮</p>
      </section>
      <p v-if="dark.length" class="small muted">還沒遇過的種類：{{ dark.map((g) => `${g.name}（${g.total} 種）`).join('、') }}</p>
    </template>
  </div>
</template>

<style scoped>
.bestiary { display: grid; gap: 8px; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.grow { flex: 1; }
.search { width: 9em; }
.group h4 { display: flex; justify-content: space-between; margin: 4px 0; border-bottom: 1px solid var(--border); padding-bottom: 2px; }
.entry { border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 4px; }
.line { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: none; border: 0; padding: 4px 8px; cursor: pointer; }
.line .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag.seen { border-color: var(--accent); color: var(--accent); }
.tag.defeated { border-color: var(--gold-hi); color: var(--gold-hi); }
.detail { display: grid; gap: 3px; padding: 0 10px 8px 42px; line-height: 1.6; }
.detail p { margin: 0; }
.detail b { color: var(--accent); font-weight: 600; margin-right: 4px; }
.unlit { margin: 0 0 6px; }
</style>
