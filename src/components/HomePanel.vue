<script setup lang="ts">
import { computed, ref } from 'vue'
import { combatRules, craftRules, homeRules, itemDef } from '@/engine/data'
import { currentArea, currentCell } from '@/engine/grid'
import {
  comfortOf, describeHome, furnitureIn, hasBed, homeOfArea, lotHere, lotPrice, PLACE_NAME, placeOf, residents, stayRefusal,
} from '@/engine/homes'
import { formatMoney } from '@/engine/money'
import { useGame } from '@/stores/game'
import FoldSection from './FoldSection.vue'
import NameTag from './NameTag.vue'

// 房子（docs/HOMES.md）：站在待售的空地上可以買；在自己的房子裡擺家具、讓夥伴留守或帶上
const game = useGame()
const s = computed(() => game.state!)
const area = computed(() => currentArea(s.value))
const cell = computed(() => currentCell(s.value))

// ---- 待售的空地 ----
const lot = computed(() => lotHere(s.value, area.value, cell.value))
const lotDef = computed(() => (lot.value ? homeRules.districts[lot.value.district] : undefined))
const price = computed(() => (lot.value ? lotPrice(s.value, lot.value) : 0))
const newName = ref('')
function buy() {
  if (!lot.value || !confirm(`用 ${formatMoney(price.value)} 買下這棟${lotDef.value!.name}？`)) return
  game.buyHome(lot.value.id, newName.value)
  newName.value = ''
}

// ---- 自己的房子 ----
const home = computed(() => homeOfArea(s.value, area.value))
const place = computed(() => placeOf(area.value, cell.value))
const choices = computed(() => s.value.inventory.filter((i) => {
  const f = itemDef(i.name)?.furniture
  return i.qty > 0 && !!f && !!place.value && f.places.includes(place.value)
}))
const pick = ref('')
const all = computed(() => (home.value ? furnitureIn(home.value) : []))
const comfort = computed(() => (home.value ? comfortOf(home.value) : 0))
const benches = computed(() => all.value.filter((f) => itemDef(f.name)?.furniture?.function === 'workbench').map((f) => `${f.name}（${craftRules.skills[itemDef(f.name)!.furniture!.craft!].name}）`))
const staying = computed(() => (home.value ? residents(s.value, home.value.id) : []))
const companions = computed(() => s.value.party.filter((m) => !m.isPlayer))
const partyFull = computed(() => s.value.party.filter((m) => m.bond !== 'guest').length >= combatRules.party_max)
const floorName = (key: string) => home.value?.areas[key]?.name.split('・').at(-1) ?? ''

function placeIt() {
  if (!pick.value) return
  game.placeFurniture(pick.value)
  pick.value = ''
}
function rename() {
  const n = prompt('房子的名字', home.value?.name)
  if (n && home.value) game.renameHome(home.value.id, n)
}
</script>

<template>
  <section v-if="lot && lotDef" class="panel home small">
    <h3>🪧 待售的房子</h3>
    <p>{{ lotDef.name }}：{{ describeHome(lot) }}，每層 {{ lotDef.size[0] - 2 }} × {{ lotDef.size[1] - 2 }} 格，隔成 {{ lotDef.rooms[0] }}～{{ lotDef.rooms[1] }} 間。</p>
    <p class="muted">買下後可以擺家具（床讓你在家長休、高階工作台讓你做第四、五級的工藝），也能讓夥伴留在家裡看家（不算離隊，不佔隊伍人數）。</p>
    <div class="row">
      <input v-model="newName" maxlength="16" placeholder="房子的名字（選填）" />
      <button class="primary small" :disabled="s.money_cc < price" @click="buy">買下（{{ formatMoney(price) }}）</button>
    </div>
  </section>

  <section v-else-if="home" class="panel home small">
    <div class="row head">
      <h3>🏠 {{ home.name }}</h3>
      <button class="small" title="改名" @click="rename">✏️</button>
    </div>
    <p class="muted">{{ area.name.split('・').at(-1) }}・舒適度 {{ comfort }}／{{ homeRules.comfort_rested }}<template v-if="comfort >= homeRules.comfort_rested">（在家長休會睡得香甜）</template>・{{ hasBed(home) ? '有床，可以在家長休' : '還沒有床' }}<template v-if="benches.length">・工作台：{{ benches.join('、') }}</template></p>

    <div class="spot">
      <template v-if="cell.furniture">
        <span>這一格：{{ itemDef(cell.furniture)?.furniture?.icon ?? '🪑' }} {{ cell.furniture }}</span>
        <button class="small" @click="game.takeFurniture()">收起</button>
      </template>
      <template v-else-if="place">
        <span>這一格（{{ PLACE_NAME[place] }}）是空的</span>
        <template v-if="choices.length">
          <select v-model="pick">
            <option value="">擺放家具…</option>
            <option v-for="c in choices" :key="c.name" :value="c.name">{{ itemDef(c.name)?.furniture?.icon }} {{ c.name }}（{{ c.qty }}）</option>
          </select>
          <button class="small" :disabled="!pick" @click="placeIt">擺放</button>
        </template>
        <span v-else class="muted">行囊裡沒有能放在{{ PLACE_NAME[place] }}的家具（雜貨店、鐵匠鋪、裁縫店、珠寶店有賣）。</span>
      </template>
      <span v-else class="muted">站在空的地板或院子上可以擺家具。</span>
    </div>

    <FoldSection id="home.people" title="👥 看家的夥伴" :count="staying.length">
      <ul class="plain">
        <li v-for="m in staying" :key="m.id" class="row">
          <NameTag :id="m.id" />
          <button class="small" :disabled="partyFull" :title="partyFull ? `隊伍最多 ${combatRules.party_max} 人` : ''" @click="game.takeResident(m.id)">帶上</button>
        </li>
        <li v-if="!staying.length" class="muted">沒有人留在家裡。</li>
      </ul>
      <ul v-if="companions.length" class="plain">
        <li v-for="m in companions" :key="m.id" class="row">
          <NameTag :id="m.id" />
          <button class="small" :disabled="!!stayRefusal(m)" :title="stayRefusal(m)" @click="game.stayHome(m.id)">留在家裡</button>
        </li>
      </ul>
      <p class="muted">留守不算離隊：羈絆、契約、親密度都保留，不佔隊伍人數，也不參加戰鬥。有工作台時，留在家裡的夥伴也能幫忙做工藝。</p>
    </FoldSection>

    <FoldSection id="home.furniture" title="🛋️ 家具" :count="all.length">
      <ul class="plain">
        <li v-for="f in all" :key="`${f.area}:${f.x},${f.y}`">{{ itemDef(f.name)?.furniture?.icon }} {{ f.name }} <span class="muted">（{{ floorName(f.area) }}）</span></li>
        <li v-if="!all.length" class="muted">還沒有家具。</li>
      </ul>
    </FoldSection>
  </section>
</template>

<style scoped>
.home { display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr); }
.home p { margin: 0; }
.head { justify-content: space-between; }
.head h3 { margin: 0; }
.spot { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px; border: 1px dashed var(--border); border-radius: 6px; }
.home ul { margin: 0; }
.home li.row { justify-content: space-between; }
</style>
