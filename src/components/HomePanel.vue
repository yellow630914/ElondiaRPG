<script setup lang="ts">
import { computed, ref } from 'vue'
import { craftRules, homeRules, itemDef } from '@/engine/data'
import {
  comfortOf, describeHome, furnitureIn, hasBed, homeOfArea, lotHere, lotPrice, ownHomeOfArea, PLACE_NAME, placeOf, residents, stayRefusal,
} from '@/engine/homes'
import { cropStatus, plotPlace, seedsFor } from '@/engine/garden'
import { formatMoney } from '@/engine/money'
import { useGame } from '@/stores/game'
import FoldMenu from './ui/FoldMenu.vue'
import NameTag from './NameTag.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

// 房子（docs/HOMES.md）：站在待售的空地上可以買；在自己的房子裡擺家具、讓夥伴留守或帶上
const game = useGame()
const s = computed(() => game.state!)
const area = computed(() => game.area)
const cell = computed(() => game.cell)

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

// ---- 主人的家（主角是奴隸時，見 docs/COMPANIONS.md 第 3.4 節） ----
const masterHome = computed(() => {
  const h = homeOfArea(s.value, area.value)
  return h?.master ? h : undefined
})

// ---- 自己的房子 ----
const home = computed(() => ownHomeOfArea(s.value, area.value))
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
const floorName = (key: string) => home.value?.areas[key]?.name.split('・').at(-1) ?? ''

// 苗圃：播種、收成、拔掉
const plot = computed(() => (home.value ? plotPlace(area.value, cell.value) : undefined))
const crop = computed(() => cropStatus(s.value, cell.value))
const seeds = computed(() => seedsFor(s.value, area.value, cell.value))
const seedPick = ref('')
const plots = computed(() => {
  if (!home.value) return { total: 0, ripe: 0 }
  const cells = Object.values(home.value.areas).flatMap((a) => a.cells.filter((c) => plotPlace(a, c)))
  return { total: cells.length, ripe: cells.filter((c) => cropStatus(s.value, c)?.ready).length }
})
const waitText = (h: number) => (h >= 24 ? `約 ${Math.ceil(h / 24)} 天` : `${h} 小時`)
function plantIt() {
  if (!seedPick.value) return
  game.plant(seedPick.value)
  seedPick.value = ''
}
function uprootIt() {
  if (crop.value && confirm(`拔掉還沒成熟的${crop.value.seed}？種子不會退回。`)) game.uproot()
}

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
    <h3 class="title">
      <GameIcon name="pin" :size="16" />待售的房子
      <Hint text="買下後可以擺家具（床讓你在家長休、高階工作台讓你做第四、五級的工藝），也能讓夥伴留在家裡看家（不算離隊，不佔隊伍人數）。" />
    </h3>
    <p>{{ lotDef.name }}：{{ describeHome(lot) }}，每層 {{ lotDef.size[0] - 2 }} × {{ lotDef.size[1] - 2 }} 格，隔成 {{ lotDef.rooms[0] }}～{{ lotDef.rooms[1] }} 間。</p>
    <div class="row">
      <input v-model="newName" maxlength="16" placeholder="房子的名字（選填）" />
      <button class="primary small" :disabled="s.money_cc < price" @click="buy">買下（{{ formatMoney(price) }}）</button>
    </div>
  </section>

  <section v-else-if="masterHome" class="panel home small">
    <h3 class="title">
      <GameIcon name="building" :size="16" />{{ masterHome.name }}
      <Hint text="這是主人的家：可以在這裡長休（睡在下人房），也可以和主人談判；不能擺家具或讓人留下。出門前要主人同意（主動行動）。" />
    </h3>
    <p class="muted">{{ area.name.split('・').at(-1) }}・{{ describeHome(masterHome) }}。</p>
  </section>

  <section v-else-if="home" class="panel home small">
    <div class="row head">
      <h3 class="title"><GameIcon name="home" :size="16" />{{ home.name }}</h3>
      <button class="small ghost" title="改名" aria-label="改名" @click="rename"><GameIcon name="edit" :size="14" /></button>
    </div>
    <p class="muted">{{ area.name.split('・').at(-1) }}・舒適度 {{ comfort }}／{{ homeRules.comfort_rested }}<template v-if="comfort >= homeRules.comfort_rested">（在家長休會睡得香甜）</template>・{{ hasBed(home) ? '有床，可以在家長休' : '還沒有床' }}<template v-if="benches.length">・工作台：{{ benches.join('、') }}</template><template v-if="plots.total">・苗圃 {{ plots.total }} 塊<template v-if="plots.ripe">（{{ plots.ripe }} 塊可以收成）</template></template></p>

    <div class="spot">
      <template v-if="cell.furniture">
        <span>這一格：{{ itemDef(cell.furniture)?.furniture?.icon ?? '🪑' }} {{ cell.furniture }}</span>
        <button v-if="!cell.crop" class="small" @click="game.takeFurniture()">收起</button>
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

    <div v-if="plot" class="spot">
      <template v-if="crop">
        <span>{{ crop.ready ? '🌾' : '🌿' }} {{ crop.seed }}（會長出{{ crop.spec.yields.join('或') }}）：{{ crop.ready ? '可以收成了' : `還要${waitText(crop.hoursLeft)}` }}</span>
        <button v-if="crop.ready" class="primary small" @click="game.harvest()">收成</button>
        <button v-else class="small" @click="uprootIt">拔掉</button>
      </template>
      <template v-else-if="seeds.length">
        <select v-model="seedPick">
          <option value="">播種…</option>
          <option v-for="sd in seeds" :key="sd.name" :value="sd.name">{{ sd.name }}（{{ sd.qty }}）</option>
        </select>
        <button class="small" :disabled="!seedPick" @click="plantIt">播種</button>
      </template>
      <span v-else class="muted">行囊裡沒有能種在{{ PLACE_NAME[plot] }}苗圃的種子（雜貨店、神殿、魔法物品店有賣）。</span>
    </div>

    <FoldMenu id="home.people" icon="users" label="看家的夥伴" detail="留守的夥伴不佔隊伍人數，也能幫忙做工藝" :badge="staying.length" open>
      <p class="small muted">留守不算離隊 <Hint text="留守不算離隊：羈絆、契約、親密度都保留，不佔隊伍人數，也不參加戰鬥。有工作台時，留在家裡的夥伴也能幫忙做工藝。" /></p>
      <ul class="plain">
        <li v-for="m in staying" :key="m.id" class="row">
          <NameTag :id="m.id" />
          <button class="small" @click="game.requireRoom(1, `帶上${m.name}`, () => game.takeResident(m.id))">帶上</button>
        </li>
        <li v-if="!staying.length" class="muted">沒有人留在家裡。</li>
      </ul>
      <ul v-if="companions.length" class="plain">
        <li v-for="m in companions" :key="m.id" class="row">
          <NameTag :id="m.id" />
          <button class="small" :disabled="!!stayRefusal(m)" :title="stayRefusal(m)" @click="game.stayHome(m.id)">留在家裡</button>
        </li>
      </ul>
    </FoldMenu>

    <FoldMenu id="home.furniture" icon="sofa" label="家具" detail="擺在這棟房子裡的家具" :badge="all.length">
      <ul class="plain">
        <li v-for="f in all" :key="`${f.area}:${f.x},${f.y}`">{{ itemDef(f.name)?.furniture?.icon }} {{ f.name }} <span class="muted">（{{ floorName(f.area) }}）</span></li>
        <li v-if="!all.length" class="muted">還沒有家具。</li>
      </ul>
    </FoldMenu>
  </section>
</template>

<style scoped>
.home { display: grid; gap: 6px; grid-template-columns: minmax(0, 1fr); }
.home p { margin: 0; }
.head { justify-content: space-between; }
.head h3 { margin: 0; }
.title { display: flex; align-items: center; gap: 6px; }
.title :deep(.game-icon) { color: var(--accent); }
.spot { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px; border: 1px dashed var(--border); border-radius: 6px; }
.home ul { margin: 0; }
.home li.row { justify-content: space-between; }
</style>
