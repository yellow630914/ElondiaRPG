<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { apMaxFor, apRegenFor, baseAttrs, luckyThreshold, maxHpFor, mod, slotMaxFor } from '@/engine/character'
import { abilities, ATTR_IDS, attributeRules, classes, geography, isSettlement, locationById, type AttrId } from '@/engine/data'
import { DEFAULT_BIRTHPLACE } from '@/engine/state'
import { useGame } from '@/stores/game'

const emit = defineEmits<{ settings: [] }>()
const game = useGame()

const name = ref('')
const race = ref('human')
const classId = ref('fighter')
const bonus = reactive<Record<AttrId, number>>({ str: 0, dex: 0, int: 0, fai: 0, cha: 0 })
const { bonus_points, max_score } = attributeRules.creation
const birthplace = ref(DEFAULT_BIRTHPLACE.human!)
const gender = ref('')
const appearance = ref('')
const background = ref('')
const importText = ref('')

// 出生地：所有聚落，依地區分組；換種族時改成該種族的預設故鄉
const regions = computed(() =>
  geography.regions
    .map((r) => ({ region: r, places: geography.locations.filter((l) => l.region === r.id && isSettlement(l)) }))
    .filter((g) => g.places.length),
)
const TYPE_NAME: Record<string, string> = { capital: '王都', city: '城市', port: '港口', town: '城鎮', village: '村莊', outpost: '哨站', fortress: '堡壘' }
const birthplaceInfo = computed(() => {
  const loc = locationById(birthplace.value)
  const faction = geography.factions.find((f) => f.id === loc.faction)?.name
  return `${geography.regions.find((r) => r.id === loc.region)?.name}・${TYPE_NAME[loc.type] ?? loc.type}${faction ? `・${faction}` : ''}`
})
watch(race, (r) => (birthplace.value = DEFAULT_BIRTHPLACE[r] ?? birthplace.value))
const importError = ref('')

const base = computed(() => baseAttrs(classId.value, race.value))
const attrs = computed(() => Object.fromEntries(ATTR_IDS.map((a) => [a, base.value[a] + bonus[a]])) as Record<AttrId, number>)
const spent = computed(() => ATTR_IDS.reduce((s, a) => s + bonus[a], 0))
const cls = computed(() => classes[classId.value]!)
const talent = computed(() => attributeRules.races[race.value]!.talent)

watch([race, classId], () => ATTR_IDS.forEach((a) => (bonus[a] = 0)))

function add(a: AttrId, d: number) {
  const next = bonus[a] + d
  if (next < 0 || (d > 0 && (spent.value >= bonus_points || attrs.value[a] >= max_score))) return
  bonus[a] = next
}

function start() {
  game.start(name.value.trim() || '旅人', race.value, classId.value, { ...bonus }, {
    birthplace: birthplace.value,
    gender: gender.value,
    appearance: appearance.value,
    background: background.value,
  })
}

function doImport() {
  importError.value = ''
  try {
    game.importSave(importText.value)
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e)
  }
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
</script>

<template>
  <section class="panel">
    <h2>建立角色</h2>
    <p class="muted small">你將以 F 級冒險者的身分，從出生地出發。性別、外貌與背景會交給 AI，作為描寫主角的依據。</p>
    <div class="layout">
      <div class="form">
        <label>名字 <input v-model="name" placeholder="旅人" maxlength="20" /></label>
        <label>性別 <input v-model="gender" placeholder="自由填寫，例如：女、男、不明" maxlength="20" /></label>
        <label>
          種族
          <select v-model="race">
            <option v-for="(r, id) in attributeRules.races" :key="id" :value="id">{{ r.name }}</option>
          </select>
        </label>
        <p class="small muted">天賦【{{ talent.name }}】{{ talent.desc }}</p>
        <label>
          職業
          <select v-model="classId">
            <option v-for="(c, id) in classes" :key="id" :value="id">{{ c.name }}</option>
          </select>
        </label>
        <p class="small muted">{{ cls.role }}</p>
        <p class="small">
          初始能力：<span v-for="a in cls.start" :key="a" class="tag">{{ abilities[a]?.name }}</span>
        </p>
        <label>
          出生地（冒險的起點）
          <select v-model="birthplace">
            <optgroup v-for="g in regions" :key="g.region.id" :label="g.region.name">
              <option v-for="l in g.places" :key="l.id" :value="l.id">{{ l.name }}</option>
            </optgroup>
          </select>
        </label>
        <p class="small muted">{{ birthplaceInfo }}</p>
      </div>

      <div>
        <h3 class="small">屬性（自由點數 {{ bonus_points - spent }}／{{ bonus_points }}）</h3>
        <table class="attrs small">
          <tr v-for="a in attributeRules.attributes" :key="a.id">
            <th :title="a.desc">{{ a.name }}</th>
            <td class="num">{{ attrs[a.id] }}</td>
            <td class="muted">({{ signed(mod(attrs[a.id])) }})</td>
            <td>
              <button class="small" :disabled="bonus[a.id] === 0" @click="add(a.id, -1)">−</button>
              <button class="small" :disabled="spent >= bonus_points || attrs[a.id] >= max_score" @click="add(a.id, 1)">＋</button>
            </td>
          </tr>
        </table>
        <ul class="plain small derived">
          <li>生命值 <strong>{{ maxHpFor(1, attrs) }}</strong><span class="muted">（力量、信仰）</span></li>
          <li>行動點 <strong>{{ apMaxFor(1, attrs) }}</strong>，每回合回復 {{ apRegenFor(1) }}<span class="muted">（靈巧、魅力）</span></li>
          <li>
            法術環
            <strong>{{ slotMaxFor(classId, 1, attrs).length ? slotMaxFor(classId, 1, attrs).map((n, i) => `${i + 1}環×${n}`).join('、') : '無' }}</strong>
            <span class="muted">（智力、信仰）</span>
          </li>
          <li>幸運一擊閾值 <strong>{{ luckyThreshold(attrs) }}</strong><span class="muted">（靈巧、魅力）</span></li>
        </ul>
      </div>
    </div>
    <div class="profile">
      <label>
        外貌細節（選填）
        <textarea v-model="appearance" rows="3" maxlength="400" placeholder="例如：灰藍色的短髮，左眉有一道舊疤，總是穿著洗到褪色的旅行斗篷。" />
      </label>
      <label>
        背景（選填）
        <textarea v-model="background" rows="4" maxlength="800" placeholder="例如：河谷鎮鐵匠的次子，為了尋找失蹤的哥哥而成為冒險者；不太會說謊，對魔族有說不出口的心結。" />
      </label>
    </div>
    <div class="row">
      <button class="primary" @click="start">開始冒險</button>
      <button @click="emit('settings')">AI 設定</button>
    </div>
  </section>

  <details class="panel">
    <summary>匯入存檔</summary>
    <textarea v-model="importText" rows="5" placeholder="貼上匯出的存檔 JSON" style="width: 100%; margin-top: 8px" />
    <div class="row">
      <button :disabled="!importText" @click="doImport">匯入</button>
      <span v-if="importError" class="small" style="color: var(--danger)">{{ importError }}</span>
    </div>
  </details>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: minmax(240px, 320px) 1fr; gap: 24px; margin: 12px 0; }
.form { display: grid; gap: 8px; align-content: start; }
.form label { display: grid; gap: 4px; }
.attrs th { text-align: left; padding-right: 12px; font-weight: normal; cursor: help; }
.attrs td { padding: 2px 6px; }
.attrs .num { font-weight: 600; text-align: right; min-width: 2em; }
.derived { margin-top: 10px; }
.profile { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.profile label { display: grid; gap: 4px; }
.profile textarea { width: 100%; }
@media (max-width: 720px) {
  .profile { grid-template-columns: 1fr; }
}
.derived li { padding: 3px 0; }
@media (max-width: 720px) {
  .layout { grid-template-columns: 1fr; }
}
</style>
