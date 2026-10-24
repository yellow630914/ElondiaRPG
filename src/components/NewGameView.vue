<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { DEFEAT_LOOT_NAME } from '@/engine/expedition'
import type { DefeatLoot, GearSlot } from '@/engine/types'
import { apMaxFor, apRegenFor, baseAttrs, luckyThreshold, maxHpFor, mod, slotMaxFor } from '@/engine/character'
import { abilities, ATTR_IDS, attributeRules, combatClasses as classes, geography, isSettlement, locationById, type AttrId, type NpcKind } from '@/engine/data'
import { GENDER_IDS, genderName, raceName, slaveryRules, tagDef } from '@/engine/data'
import { npcTitle } from '@/engine/npcs'
import { masterCandidates, masterTagIds, type MarkChoice, type MasterSpec, type SlaveStart } from '@/engine/slavery'
import { DEFAULT_BIRTHPLACE } from '@/engine/state'
import { useGame } from '@/stores/game'
import { modTotal, useContent, VANILLA, VANILLA_NAME } from '@/stores/content'
import { slotTitle } from '@/stores/saves'
import { useCharacterPresets, type CharacterDraft, type CharacterPreset } from '@/stores/characterPresets'
import MarkPicker from './MarkPicker.vue'
import PerkPicker from './PerkPicker.vue'
import LookPicker from './LookPicker.vue'
import StartGearDialog from './StartGearDialog.vue'
import ContentIcon from './icons/ContentIcon.vue'
import ItemIcon from './items/ItemIcon.vue'
import { choosablePerks, type PerkDef } from '@/engine/data'
import { racePerks } from '@/engine/perks'
import { genderId } from '@/engine/look'
import type { Body } from '@/engine/traits'
import NameTag from './NameTag.vue'
import { creationCatalog, creationCost, creationSlots, gearRules, gearSummary, slotName, type CreationGear } from '@/engine/gear'
import { useSettings } from '@/stores/settings'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'
import FoldMenu from './ui/FoldMenu.vue'
import RuleFields from './RuleFields.vue'
import { sanitizeRules, type NumericRule } from '@/engine/gameRules'

const emit = defineEmits<{ settings: []; home: [] }>()
const game = useGame()
const content = useContent()
const settings = useSettings()
const presets = useCharacterPresets()

// 世界：開新遊戲時決定，開始後不能換（換世界會重新整理這個畫面，自訂的種族、能力、NPC 才會跟著變）
function pickWorld(id: string) {
  try {
    content.switchWorld(id)
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}

const name = ref('')
const race = ref('human')
const classId = ref('fighter')
const bonus = reactive<Record<AttrId, number>>({ str: 0, dex: 0, int: 0, fai: 0, cha: 0 })
const { bonus_points, max_score } = attributeRules.creation
const birthplace = ref(DEFAULT_BIRTHPLACE.human!)
const gender = ref('')
const appearance = ref('')
const background = ref('')
// 體態：體型（空字串＝依種族與性別）與各部位
const body = ref<Body | ''>('')
const look = ref<Record<string, string>>({})
// 特質：清單裡的任選，也可以自訂
const perks = ref<string[]>([])
const customPerks = ref<PerkDef[]>([])

// ---- 性別：下拉選單，也可以自己輸入 ----
const CUSTOM = '__custom'
const genderOptions = GENDER_IDS.map((id) => genderName(id))
const genderPick = ref(gender.value ? (genderOptions.includes(gender.value) ? gender.value : CUSTOM) : '')
function pickGender(v: string) {
  genderPick.value = v
  if (v !== CUSTOM) gender.value = v
  else if (genderOptions.includes(gender.value)) gender.value = ''
}

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
// 讀取儲存的角色時不要被換種族、職業的連動蓋掉
let loading = false
watch(race, (r) => {
  if (!loading) birthplace.value = DEFAULT_BIRTHPLACE[r] ?? birthplace.value
})

const base = computed(() => baseAttrs(classId.value, race.value))
const attrs = computed(() => Object.fromEntries(ATTR_IDS.map((a) => [a, base.value[a] + bonus[a]])) as Record<AttrId, number>)
const spent = computed(() => ATTR_IDS.reduce((s, a) => s + bonus[a], 0))
const cls = computed(() => classes[classId.value]!)
const racePerk = computed(() => racePerks(race.value)[0])

watch([race, classId], () => {
  if (!loading) ATTR_IDS.forEach((a) => (bonus[a] = 0))
})

function add(a: AttrId, d: number) {
  const next = bonus[a] + d
  if (next < 0 || (d > 0 && (spent.value >= bonus_points || attrs.value[a] >= max_score))) return
  bonus[a] = next
}

const derived = computed(() => {
  const slots = slotMaxFor(classId.value, 1, attrs.value)
  return [
    { name: '生命值', value: String(maxHpFor(1, attrs.value)), from: '力量、信仰' },
    { name: '行動點', value: `${apMaxFor(1, attrs.value)}（每回合 +${apRegenFor(1)}）`, from: '靈巧、魅力' },
    { name: '法術環', value: slots.length ? slots.map((n, i) => `${i + 1}環×${n}`).join('、') : '無', from: '智力、信仰' },
    { name: '幸運一擊', value: `${luckyThreshold(attrs.value)}+`, from: '靈巧、魅力' },
  ]
})

// ---- 起始裝備：在對話框裡挑（StartGearDialog），這裡只顯示目前的配備與預算 ----
const gearSlots = computed(() => creationSlots(classId.value, race.value))
const gear = ref<CreationGear>({})
const gearOpen = ref(false)
function resetGear() {
  const start = gearRules.classes[classId.value]?.start ?? {}
  const next: CreationGear = {}
  for (const s of gearSlots.value) if (s.template && start[s.slot]) next[s.slot] = { base: start[s.slot]!, tier: 1 }
  gear.value = next
}
watch(gearSlots, () => {
  if (!loading) resetGear()
}, { immediate: true })
const twoHanded = computed(() => !!gearRules.bases[gear.value.main_hand?.base ?? '']?.two_handed)
/** 實際帶走的：拿掉不能放的欄位、雙手武器時的副手、不在清單裡的底材 */
const gearChoice = computed<CreationGear>(() => {
  const out: CreationGear = {}
  for (const s of gearSlots.value) {
    const p = gear.value[s.slot]
    if (!p?.base || !s.bases.includes(p.base) || (s.slot === 'off_hand' && twoHanded.value)) continue
    // 自建的裝備：還在目錄裡才帶走（世界換了、物品被刪掉時拿掉）
    if (p.item && !catalog.value.find((c) => c.slot === s.slot)?.options.some((o) => o.item === p.item)) continue
    out[s.slot] = { base: p.base, tier: p.tier, ...(p.item ? { item: p.item } : {}) }
  }
  return out
})
const gearBudget = computed(() => settings.gearBudget())
const gearSpent = computed(() => creationCost(classId.value, gearChoice.value))
const gearOver = computed(() => gearSpent.value > gearBudget.value)
const catalog = computed(() => {
  void content.version
  return creationCatalog(classId.value, race.value)
})
const gearRows = computed(() => {
  return Object.entries(gearChoice.value).map(([slot, p]) => {
    const o = catalog.value.find((c) => c.slot === slot)?.options.find((x) => (p!.item ? x.item === p!.item : !x.item && x.base === p!.base && x.tier === p!.tier))
    return { slot: slot as GearSlot, option: o }
  }).filter((r) => r.option)
})

// ---- 奴隸出身 ----
const slave = ref(false)
const masterMode = ref<'candidate' | 'custom' | 'none'>('candidate')
const masterSeed = ref(Math.floor(Math.random() * 2 ** 31))
const candidates = computed(() => masterCandidates(birthplace.value, masterSeed.value))
const pickedMaster = ref(0)
const customMaster = reactive<MasterSpec & { kind: NpcKind; tags: string[] }>({
  name: '', gender: 'male', race: 'human', class: 'fighter', level: 5, personality: '', appearance: '', kind: 'adventurer', tags: [], occupation: '',
})
const masterTags = masterTagIds()
const MAX_MASTER_TAGS = 3
function toggleMasterTag(t: string, on: boolean) {
  customMaster.tags = on ? [...customMaster.tags, t].slice(0, MAX_MASTER_TAGS) : customMaster.tags.filter((x) => x !== t)
}
const mark = ref<MarkChoice>(slaveryRules.roles.default)

function slaveStart(): SlaveStart | undefined {
  if (!slave.value) return undefined
  const master: SlaveStart['master'] = masterMode.value === 'none'
    ? { type: 'none' }
    : masterMode.value === 'custom'
      ? { type: 'custom', spec: { ...customMaster, tags: [...customMaster.tags] } }
      : { type: 'candidate', rec: candidates.value[pickedMaster.value]! }
  return { master, mark: typeof mark.value === 'string' ? mark.value : { ...mark.value } }
}

function start() {
  // 進行中的遊戲會被蓋掉：提醒（會先備份到自動存檔欄位）
  const cur = game.resumeMeta
  if (cur && !confirm(`進行中的遊戲（${slotTitle(cur)}）會被新的冒險蓋掉。\n它會先備份到自動存檔欄位，之後可以從「讀取存檔」找回。確定開新遊戲？`)) return
  if (gearOver.value) {
    game.error = `起始裝備超過預算（${gearSpent.value}／${gearBudget.value} 點）`
    return
  }
  const s = slaveStart()
  game.start(name.value.trim() || '旅人', race.value, classId.value, { ...bonus }, {
    birthplace: birthplace.value,
    gender: gender.value,
    appearance: appearance.value,
    background: background.value,
    ...(body.value ? { body: body.value } : {}),
    ...(Object.keys(look.value).length ? { look: { ...look.value } } : {}),
    ...(s ? { slave: s } : {}),
    ...(perks.value.length ? { perks: [...perks.value] } : {}),
    ...(customPerks.value.length ? { customPerks: customPerks.value.map((p) => ({ ...p })) } : {}),
    gear: { ...gearChoice.value },
    gearBudget: gearBudget.value,
    options: { defeatLoot: defeatLoot.value, ...sanitizeRules(rules.value) },
  }, content.active)
}

/** 這個存檔的規則：在地下城戰敗時，這趟撿到的東西 */
const defeatLoot = ref<DefeatLoot>('half')
// 其他存檔規則（gameRules.ts）：沒寫的是預設
const rules = ref<Partial<Record<NumericRule, number>>>({})

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

// ---- 儲存的角色 ----
function draft(): CharacterDraft {
  return {
    name: name.value.trim() || '旅人', gender: gender.value, race: race.value, classId: classId.value, bonus: { ...bonus }, birthplace: birthplace.value,
    ...(body.value ? { body: body.value } : {}), look: { ...look.value }, appearance: appearance.value, background: background.value,
    perks: [...perks.value], customPerks: customPerks.value.map((p) => ({ ...p })), gear: JSON.parse(JSON.stringify(gearChoice.value)),
    ...(slave.value ? { slave: { mode: masterMode.value, seed: masterSeed.value, picked: pickedMaster.value, custom: JSON.parse(JSON.stringify(customMaster)), mark: JSON.parse(JSON.stringify(mark.value)) } } : {}),
  }
}
const presetMsg = ref('')
function savePreset() {
  const d = draft()
  if (presets.list.some((p) => p.draft.name === d.name) && !confirm(`已經有叫「${d.name}」的角色，要覆蓋嗎？`)) return
  try {
    presets.save(d, content.active)
    presetMsg.value = `已儲存「${d.name}」`
  } catch (e) {
    game.error = e instanceof Error ? e.message : String(e)
  }
}
async function loadPreset(p: CharacterPreset) {
  const d = p.draft
  loading = true
  try {
    race.value = attributeRules.races[d.race] ? d.race : 'human'
    classId.value = classes[d.classId] ? d.classId : 'fighter'
    await nextTick()
    name.value = d.name
    gender.value = d.gender ?? ''
    genderPick.value = gender.value ? (genderOptions.includes(gender.value) ? gender.value : CUSTOM) : ''
    for (const a of ATTR_IDS) bonus[a] = Math.max(0, Math.round(Number(d.bonus?.[a]) || 0))
    // 點數超過時從頭清掉
    if (ATTR_IDS.reduce((sum, a) => sum + bonus[a], 0) > bonus_points) ATTR_IDS.forEach((a) => (bonus[a] = 0))
    birthplace.value = regions.value.some((g) => g.places.some((l) => l.id === d.birthplace)) ? d.birthplace : DEFAULT_BIRTHPLACE[race.value] ?? birthplace.value
    body.value = (['masc', 'fem', 'andro'] as string[]).includes(d.body ?? '') ? d.body as Body : ''
    look.value = { ...(d.look ?? {}) }
    appearance.value = d.appearance ?? ''
    background.value = d.background ?? ''
    // 現在的世界沒有的特質不帶
    const known = new Set(choosablePerks().map((x) => x.id))
    perks.value = (d.perks ?? []).filter((id) => known.has(id))
    customPerks.value = (d.customPerks ?? []) as PerkDef[]
    resetGear()
    gear.value = { ...gear.value, ...(d.gear as CreationGear) }
    slave.value = !!d.slave
    if (d.slave) {
      masterMode.value = d.slave.mode
      masterSeed.value = d.slave.seed
      pickedMaster.value = d.slave.picked
      Object.assign(customMaster, d.slave.custom)
      mark.value = d.slave.mark as MarkChoice
    }
    await nextTick()
    presetMsg.value = `已讀取「${d.name}」`
  } finally {
    loading = false
  }
}
function removePreset(p: CharacterPreset) {
  if (confirm(`刪除儲存的角色「${p.draft.name}」？`)) presets.remove(p.id)
}
const presetLine = (p: CharacterPreset) => `${raceName(p.draft.race)}・${classes[p.draft.classId]?.name ?? p.draft.classId}・${placeName(p.draft.birthplace)}${p.draft.slave ? '・奴隸出身' : ''}`
/** 出生地的名字（存的地點在這個世界不在時不顯示） */
function placeName(id: string): string {
  try {
    return locationById(id).name
  } catch {
    return ''
  }
}
const dateText = (t: number) => new Date(t).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <section class="panel newgame">
    <h2 class="head"><GameIcon name="userPlus" :size="22" />建立角色 <Hint text="你將以 F 級冒險者的身分，從出生地出發。性別、體態、外貌與背景會交給 AI，作為描寫主角的依據。" /></h2>
    <div class="row world">
      <label><span class="lab"><GameIcon name="world" :size="14" />世界</span>
        <select :value="content.active" @change="pickWorld(($event.target as HTMLSelectElement).value)">
          <option :value="VANILLA">{{ VANILLA_NAME }}</option>
          <option v-for="w in content.worlds" :key="w.id" :value="w.id">{{ w.name }}（{{ modTotal(w.mods) }} 項自訂內容）</option>
        </select>
      </label>
      <Hint text="這一局用哪一套自訂內容；開始後不能換。請先選世界再建立角色（換世界會重新整理這個畫面）。" />
      <span class="grow" />
      <button class="small" @click="savePreset"><GameIcon name="save" :size="14" /> 儲存這個角色</button>
      <span v-if="presetMsg" class="small muted">{{ presetMsg }}</span>
    </div>
    <FoldMenu v-if="presets.list.length" id="newgame.presets" icon="users" label="儲存的角色" :detail="presets.list.map((p) => p.draft.name).slice(0, 6).join('、')" :badge="presets.list.length">
      <table class="tbl presets">
        <thead><tr><th>名字</th><th>種族・職業・出生地</th><th>儲存時間</th><th /></tr></thead>
        <tbody>
          <tr v-for="p in presets.list" :key="p.id">
            <th>{{ p.draft.name }}</th>
            <td>{{ presetLine(p) }}</td>
            <td class="muted nowrap">{{ dateText(p.savedAt) }}</td>
            <td class="act">
              <button class="small primary" @click="loadPreset(p)">讀取</button>
              <button class="small ghost" @click="removePreset(p)">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </FoldMenu>

    <div class="layout">
      <div class="sec">
        <h3 class="head small"><GameIcon name="user" :size="15" />基本資料</h3>
        <table class="tbl form">
          <tr>
            <th>名字</th>
            <td><input v-model="name" placeholder="旅人" maxlength="20" /></td>
          </tr>
          <tr>
            <th>性別</th>
            <td>
              <div class="pair">
                <select :value="genderPick" @change="pickGender(($event.target as HTMLSelectElement).value)">
                  <option value="">（不填）</option>
                  <option v-for="g in genderOptions" :key="g" :value="g">{{ g }}</option>
                  <option :value="CUSTOM">自行輸入…</option>
                </select>
                <input v-if="genderPick === CUSTOM" v-model="gender" placeholder="例如：雙性、不明" maxlength="20" />
              </div>
            </td>
          </tr>
          <tr>
            <th>種族</th>
            <td>
              <select v-model="race"><option v-for="(r, id) in attributeRules.races" :key="id" :value="id">{{ r.name }}</option></select>
              <div v-if="racePerk" class="note"><ContentIcon kind="perk" :def="racePerk" :size="14" /> 種族特質【{{ racePerk.name }}】{{ racePerk.desc }}</div>
            </td>
          </tr>
          <tr>
            <th>職業</th>
            <td>
              <select v-model="classId"><option v-for="(c, id) in classes" :key="id" :value="id">{{ c.name }}</option></select>
              <div class="note">{{ cls.role }}</div>
              <div class="note abl">初始能力：<span v-for="a in cls.start" :key="a" class="tag"><ContentIcon kind="ability" :id="a" :size="12" />{{ abilities[a]?.name }}</span></div>
            </td>
          </tr>
          <tr>
            <th>出生地</th>
            <td>
              <select v-model="birthplace">
                <optgroup v-for="g in regions" :key="g.region.id" :label="g.region.name">
                  <option v-for="l in g.places" :key="l.id" :value="l.id">{{ l.name }}</option>
                </optgroup>
              </select>
              <div class="note">{{ birthplaceInfo }}・冒險的起點</div>
            </td>
          </tr>
        </table>
      </div>

      <div class="sec">
        <h3 class="head small"><GameIcon name="sliders" :size="15" />屬性（自由點數 {{ bonus_points - spent }}／{{ bonus_points }}）</h3>
        <table class="tbl attrs">
          <thead><tr><th>屬性</th><th class="num">基礎</th><th class="num">加點</th><th class="num">數值</th><th class="num">調整</th><th /></tr></thead>
          <tbody>
            <tr v-for="a in attributeRules.attributes" :key="a.id">
              <th :title="a.desc">{{ a.name }}</th>
              <td class="num muted">{{ base[a.id] }}</td>
              <td class="num" :class="{ good: bonus[a.id] > 0 }">{{ bonus[a.id] ? `+${bonus[a.id]}` : '' }}</td>
              <td class="num strong">{{ attrs[a.id] }}</td>
              <td class="num muted">{{ signed(mod(attrs[a.id])) }}</td>
              <td class="act">
                <button class="small" :disabled="bonus[a.id] === 0" @click="add(a.id, -1)">−</button>
                <button class="small" :disabled="spent >= bonus_points || attrs[a.id] >= max_score" @click="add(a.id, 1)">＋</button>
              </td>
            </tr>
          </tbody>
        </table>
        <table class="tbl derived">
          <tr v-for="d in derived" :key="d.name"><th>{{ d.name }}</th><td class="strong">{{ d.value }}</td><td class="muted small">{{ d.from }}</td></tr>
        </table>
      </div>
    </div>

    <div class="sec">
      <h3 class="head small"><GameIcon name="user" :size="15" />體態與外貌</h3>
      <LookPicker v-model:body="body" v-model:look="look" :race="race" :gender="gender" />
      <div class="profile">
        <label>
          外貌細節（選填）
          <textarea v-model="appearance" rows="3" maxlength="400" placeholder="例如：左眉有一道舊疤，總是穿著洗到褪色的旅行斗篷。" />
        </label>
        <label>
          背景（選填）
          <textarea v-model="background" rows="3" maxlength="800" placeholder="例如：河谷鎮鐵匠的次子，為了尋找失蹤的哥哥而成為冒險者；不太會說謊，對魔族有說不出口的心結。" />
        </label>
      </div>
    </div>

    <div class="sec">
      <PerkPicker v-model:perks="perks" v-model:custom="customPerks" :race="race" :cls="classId" />
    </div>

    <div class="sec">
      <h3 class="head small">
        <GameIcon name="shield" :size="15" />起始裝備（預算 <strong :class="{ over: gearOver }">{{ gearSpent }}／{{ gearBudget }}</strong> 點）
        <Hint text="職業的基本配備（第 1 級材料）免費；基本配備升級材料花「等級 - 1」，其他欄位的裝備花它的材料等級。預算在「設定」的遊戲規則裡調整。" />
      </h3>
      <table class="tbl gear">
        <thead><tr><th>欄位</th><th>裝備</th><th>性能</th><th class="num">預算</th></tr></thead>
        <tbody>
          <tr v-for="r in gearRows" :key="r.slot">
            <th>{{ slotName(r.slot) }}</th>
            <td class="name"><span class="item-tile"><ItemIcon :name="r.option!.item" :spec="r.option!.spec" :size="18" /></span>{{ r.option!.name }}<span v-if="r.option!.item" class="tag">自建</span></td>
            <td class="muted small">{{ gearSummary(r.option!.spec) }}</td>
            <td class="num">{{ r.option!.cost ? `${r.option!.cost} 點` : '免費' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="gearOver" class="small over">超過預算 {{ gearSpent - gearBudget }} 點，開始冒險前請降低材料等級或拿掉幾件。</p>
      <div class="row">
        <button class="small primary" type="button" @click="gearOpen = true"><GameIcon name="shield" :size="13" /> 挑選起始裝備…</button>
        <button class="small" type="button" @click="resetGear">還原成基本配備</button>
      </div>
      <StartGearDialog v-model="gear" :open="gearOpen" :class-id="classId" :race="race" :budget="gearBudget" :spent="gearSpent" @close="gearOpen = false" />
    </div>

    <div class="sec">
      <h3 class="head small"><GameIcon name="d20" :size="15" />存檔規則</h3>
      <table class="tbl form">
        <tr>
          <th>地下城戰敗時 <Hint text="這趟探索撿到、還沒帶出地下城的物品與錢；之後可以在「設定」裡改。" /></th>
          <td><select v-model="defeatLoot"><option v-for="(n, k) in DEFEAT_LOOT_NAME" :key="k" :value="k">{{ n }}</option></select></td>
        </tr>
      </table>
      <FoldMenu id="newgame.rules" icon="d20" label="更多存檔規則" :detail="Object.keys(rules).length ? `改了 ${Object.keys(rules).length} 項` : '經驗、報酬、休息、旅途、委託期限……（之後可以在設定裡改）'">
        <RuleFields v-model="rules" />
      </FoldMenu>
    </div>

    <div class="sec slave">
      <div class="row">
        <label class="check"><input v-model="slave" type="checkbox" /> <GameIcon name="lock" :size="14" /> 以奴隸身分開始</label>
        <Hint text="身上刻著契約印記（部位依印記）。有主人時，主人會帶著你一起行動：出城與旅行要先得到主人同意，賺到的錢有一部分歸主人；可以在安全的地方談判，或隨時嘗試逃離。" />
      </div>
      <template v-if="slave">
        <div class="row small">
          主人：
          <label class="check"><input v-model="masterMode" type="radio" value="candidate" /> 從名單挑選</label>
          <label class="check"><input v-model="masterMode" type="radio" value="custom" /> 自訂</label>
          <label class="check"><input v-model="masterMode" type="radio" value="none" /> 無主 <Hint text="主人已經不在了，但印記還在。" /></label>
        </div>
        <div v-if="masterMode === 'candidate'" class="masters">
          <table class="tbl masters-table">
            <thead><tr><th /><th>名字</th><th>性別</th><th>種族</th><th>身分</th><th class="num">等級</th><th>標籤</th></tr></thead>
            <tbody>
              <template v-for="(m, i) in candidates" :key="m.id">
                <tr :class="{ on: pickedMaster === i }" @click="pickedMaster = i">
                  <td class="pick"><input v-model="pickedMaster" type="radio" :value="i" @click.stop /></td>
                  <th><NameTag :name="m.name" :race="m.race" :cls="m.class" :gender="m.gender" /></th>
                  <td class="nowrap">{{ genderName(m.gender) }}</td>
                  <td class="nowrap">{{ raceName(m.race) }}<span v-if="m.lineage" class="muted">（{{ m.lineage }}）</span></td>
                  <td class="nowrap">{{ npcTitle(m) }}</td>
                  <td class="num">{{ m.level }}</td>
                  <td><span v-for="t in m.tags ?? []" :key="t" class="tag">{{ tagDef(t)?.name ?? t }}</span></td>
                </tr>
                <tr :class="{ on: pickedMaster === i }" class="sub" @click="pickedMaster = i">
                  <td />
                  <td colspan="6" class="muted">{{ m.personality }}<br />{{ m.appearance }}</td>
                </tr>
              </template>
            </tbody>
          </table>
          <button class="small" type="button" @click="masterSeed = Math.floor(Math.random() * 2 ** 31)"><GameIcon name="shuffle" :size="13" /> 換一批</button>
        </div>
        <table v-else-if="masterMode === 'custom'" class="tbl form custom-master">
          <tr><th>名字</th><td><input v-model="customMaster.name" maxlength="12" placeholder="留空則隨機" /></td></tr>
          <tr>
            <th>身分 <Hint text="冒險者有職業，會和你一起戰鬥；普通人沒有職業，同行但不參與戰鬥（戰敗時依親密度搬救兵或先逃走）。" /></th>
            <td>
              <label class="check"><input v-model="customMaster.kind" type="radio" value="adventurer" /> 冒險者</label>
              <label class="check"><input v-model="customMaster.kind" type="radio" value="commoner" /> 普通人</label>
            </td>
          </tr>
          <tr v-if="customMaster.kind === 'adventurer'">
            <th>職業</th>
            <td><select v-model="customMaster.class"><option v-for="(c, id) in classes" :key="id" :value="id">{{ c.name }}</option></select></td>
          </tr>
          <tr v-else>
            <th>職業描述</th>
            <td><input v-model="customMaster.occupation" maxlength="12" placeholder="例如：酒館老闆、布商（選填）" /></td>
          </tr>
          <tr>
            <th>標籤 <Hint :text="`主人的身分標籤，最多 ${MAX_MASTER_TAGS} 個：影響主人的突發事件、家的大小、談判解除契約的難度與 AI 的描寫。`" /></th>
            <td class="tags">
              <label v-for="t in masterTags" :key="t" class="check" :title="tagDef(t)?.ai_hint">
                <input type="checkbox" :checked="customMaster.tags.includes(t)" :disabled="!customMaster.tags.includes(t) && customMaster.tags.length >= MAX_MASTER_TAGS" @change="toggleMasterTag(t, ($event.target as HTMLInputElement).checked)" />
                {{ tagDef(t)?.name ?? t }}
              </label>
            </td>
          </tr>
          <tr>
            <th>性別</th>
            <td><select v-model="customMaster.gender"><option v-for="g in GENDER_IDS" :key="g" :value="g">{{ genderName(g) }}</option></select></td>
          </tr>
          <tr>
            <th>種族</th>
            <td><select v-model="customMaster.race"><option v-for="(r, id) in attributeRules.races" :key="id" :value="id">{{ r.name }}</option></select></td>
          </tr>
          <tr><th>等級</th><td><input v-model.number="customMaster.level" type="number" min="1" max="20" class="short" /></td></tr>
          <tr><th>性格</th><td><input v-model="customMaster.personality" maxlength="120" placeholder="選填" /></td></tr>
          <tr><th>外貌</th><td><input v-model="customMaster.appearance" maxlength="200" placeholder="選填" /></td></tr>
        </table>
        <h4 class="head small"><GameIcon name="lock" :size="14" />契約印記</h4>
        <MarkPicker v-model="mark" allow-custom />
      </template>
    </div>

    <div class="row">
      <button class="primary" :disabled="gearOver" @click="start"><GameIcon name="play" :size="15" /> 開始冒險</button>
      <button @click="emit('home')"><GameIcon name="home" :size="15" /> 回首頁</button>
      <button @click="emit('settings')"><GameIcon name="settings" :size="15" /> AI 設定</button>
    </div>
  </section>
</template>

<style scoped>
.newgame { display: grid; gap: 10px; }
.head { display: flex; align-items: center; gap: 6px; margin: 0; }
.head :deep(.game-icon), .lab :deep(.game-icon), .check :deep(.game-icon) { color: var(--accent); }
.lab { display: inline-flex; align-items: center; gap: 4px; }
button :deep(.game-icon) { vertical-align: -0.2em; }
.world { gap: 10px; align-items: center; flex-wrap: wrap; }
.world label { display: flex; gap: 6px; align-items: center; }
.grow { flex: 1; }
.layout { display: grid; grid-template-columns: minmax(300px, 1fr) minmax(300px, 1fr); gap: 16px; }
.sec { display: grid; gap: 8px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius); background: color-mix(in srgb, currentColor 2%, transparent); align-content: start; }
.tbl { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.tbl thead th { font-size: var(--fs-xs); color: var(--muted); font-weight: 600; text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--border); }
.tbl td, .tbl tbody th, .tbl > tr > th { padding: 5px 6px; text-align: left; vertical-align: middle; border-bottom: 1px solid color-mix(in srgb, currentColor 9%, transparent); }
.tbl th { font-weight: 600; white-space: nowrap; }
.form > tr > th, .form th { width: 1%; vertical-align: top; padding-top: 9px; color: var(--muted); }
.form input:not([type='checkbox']):not([type='radio']), .form select, .form textarea { width: 100%; }
.form .short { width: 90px !important; }
.pair { display: flex; gap: 6px; }
.pair select { flex: 0 0 9em; }
.pair input { flex: 1; min-width: 0; }
.note { font-size: var(--fs-xs); color: var(--muted); margin-top: 3px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.abl .tag { display: inline-flex; align-items: center; gap: 3px; }
.num { text-align: right; white-space: nowrap; }
.strong { font-weight: 700; }
.good { color: var(--good); }
.act { width: 1%; white-space: nowrap; text-align: right; }
.attrs th { cursor: help; }
.derived th { width: 1%; color: var(--muted); }
.nowrap { white-space: nowrap; }
.profile { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.profile label { display: grid; gap: 4px; }
.profile textarea { width: 100%; }
.gear .name { display: flex; align-items: center; gap: 6px; font-weight: 700; white-space: nowrap; }
.gear .item-tile { width: 24px; height: 24px; }
.over { color: var(--danger); }
.slave label.check, .form label.check { display: inline-flex; gap: 4px; align-items: center; margin-right: 10px; }
.masters { display: grid; gap: 6px; }
.masters-table tbody tr { cursor: pointer; }
.masters-table tr.sub td { padding-top: 0; font-size: var(--fs-xs); border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
.masters-table tr:not(.sub) td, .masters-table tr:not(.sub) th { border-bottom: none; }
.masters-table tr.on { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.masters-table .pick { width: 1%; }
.custom-master .tags { display: flex; flex-wrap: wrap; gap: 2px 0; }
.presets .act button + button { margin-left: 4px; }
h4 { margin: 4px 0 0; }
@media (max-width: 760px) {
  .layout, .profile { grid-template-columns: 1fr; }
}
</style>
