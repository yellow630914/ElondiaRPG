<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { apMaxFor, apRegenFor, baseAttrs, luckyThreshold, maxHpFor, mod, slotMaxFor } from '@/engine/character'
import { abilities, ATTR_IDS, attributeRules, combatClasses as classes, geography, isSettlement, locationById, type AttrId } from '@/engine/data'
import { GENDER_IDS, genderName, raceName, tagDef } from '@/engine/data'
import { npcTitle } from '@/engine/npcs'
import { masterCandidates, type MarkChoice, type MasterSpec, type SlaveStart } from '@/engine/slavery'
import { DEFAULT_BIRTHPLACE } from '@/engine/state'
import { useGame } from '@/stores/game'
import MarkPicker from './MarkPicker.vue'
import NameTag from './NameTag.vue'

const emit = defineEmits<{ settings: []; saves: [] }>()
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

// ---- 奴隸出身 ----
const slave = ref(false)
const masterMode = ref<'candidate' | 'custom' | 'none'>('candidate')
const masterSeed = ref(Math.floor(Math.random() * 2 ** 31))
const candidates = computed(() => masterCandidates(birthplace.value, masterSeed.value))
const pickedMaster = ref(0)
const customMaster = reactive<MasterSpec>({ name: '', gender: 'male', race: 'human', class: 'fighter', level: 5, personality: '', appearance: '' })
const mark = ref<MarkChoice>('labor')

function slaveStart(): SlaveStart | undefined {
  if (!slave.value) return undefined
  const master: SlaveStart['master'] = masterMode.value === 'none'
    ? { type: 'none' }
    : masterMode.value === 'custom'
      ? { type: 'custom', spec: { ...customMaster } }
      : { type: 'candidate', rec: candidates.value[pickedMaster.value]! }
  return { master, mark: typeof mark.value === 'string' ? mark.value : { ...mark.value } }
}

function start() {
  const s = slaveStart()
  game.start(name.value.trim() || '旅人', race.value, classId.value, { ...bonus }, {
    birthplace: birthplace.value,
    gender: gender.value,
    appearance: appearance.value,
    background: background.value,
    ...(s ? { slave: s } : {}),
  })
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
    <div class="slave">
      <label class="check"><input v-model="slave" type="checkbox" /> ⛓️ 以奴隸身分開始</label>
      <template v-if="slave">
        <p class="small muted">頸上刻著契約印記。有主人時，主人會帶著你一起行動：出城與旅行要先得到主人同意，賺到的錢有一部分歸主人；可以在安全的地方談判，或隨時嘗試逃離。</p>
        <div class="row small">
          主人：
          <label class="check"><input v-model="masterMode" type="radio" value="candidate" /> 從名單挑選</label>
          <label class="check"><input v-model="masterMode" type="radio" value="custom" /> 自訂</label>
          <label class="check"><input v-model="masterMode" type="radio" value="none" /> 無主（主人已經不在了，但印記還在）</label>
        </div>
        <div v-if="masterMode === 'candidate'" class="masters">
          <label v-for="(m, i) in candidates" :key="m.id" class="master small">
            <input v-model="pickedMaster" type="radio" :value="i" />
            <span>
              <NameTag :name="m.name" :race="m.race" :cls="m.class" :gender="m.gender" />
              <span class="muted">・{{ genderName(m.gender) }}・{{ raceName(m.race) }}<template v-if="m.lineage">（{{ m.lineage }}）</template>・{{ npcTitle(m) }} Lv.{{ m.level }}・{{ (m.tags ?? []).map((t) => tagDef(t)?.name).join('、') }}</span>
              <br /><span class="muted">{{ m.personality }}</span>
              <br /><span class="muted">{{ m.appearance }}</span>
            </span>
          </label>
          <button class="small" type="button" @click="masterSeed = Math.floor(Math.random() * 2 ** 31)">🎲 換一批</button>
        </div>
        <div v-else-if="masterMode === 'custom'" class="custom-master small">
          <label>名字 <input v-model="customMaster.name" maxlength="12" placeholder="留空則隨機" /></label>
          <label>性別
            <select v-model="customMaster.gender"><option v-for="g in GENDER_IDS" :key="g" :value="g">{{ genderName(g) }}</option></select>
          </label>
          <label>種族
            <select v-model="customMaster.race"><option v-for="(r, id) in attributeRules.races" :key="id" :value="id">{{ r.name }}</option></select>
          </label>
          <label>職業
            <select v-model="customMaster.class"><option v-for="(c, id) in classes" :key="id" :value="id">{{ c.name }}</option></select>
          </label>
          <label>等級 <input v-model.number="customMaster.level" type="number" min="1" max="20" /></label>
          <label class="wide">性格（選填）<input v-model="customMaster.personality" maxlength="120" /></label>
          <label class="wide">外貌（選填）<input v-model="customMaster.appearance" maxlength="200" /></label>
        </div>
        <h4 class="small">契約印記</h4>
        <MarkPicker v-model="mark" allow-custom />
      </template>
    </div>
    <div class="row">
      <button class="primary" @click="start">開始冒險</button>
      <button @click="emit('saves')">📂 讀取存檔</button>
      <button @click="emit('settings')">AI 設定</button>
    </div>
  </section>

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
.slave { display: grid; gap: 8px; margin-bottom: 12px; padding: 8px 10px; border: 1px dashed var(--border); border-radius: var(--radius); }
.slave label.check { display: inline-flex; gap: 4px; align-items: center; }
.masters { display: grid; gap: 6px; }
.master { display: flex; gap: 6px; align-items: flex-start; }
.custom-master { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; }
.custom-master label { display: grid; gap: 2px; }
.custom-master .wide { grid-column: 1 / -1; }
@media (max-width: 720px) {
  .layout { grid-template-columns: 1fr; }
}
</style>
