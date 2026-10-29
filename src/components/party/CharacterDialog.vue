<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  abilityQuality, apMaxFor, apRegenFor, attrsOf, carriedAbilities, castingAttr, countsForLoadout, evadeFloor, gearAffinities, luckyThreshold, mod, proficiency, rerollsLeft, weaponFor, xpToNext,
} from '@/engine/character'
import { abilityDef, armorDef, attributeRules, attrName, classDef, damageTypeName, locationById, slaveryRules, statusDef, tagDef } from '@/engine/data'
import PcTagPicker from '../PcTagPicker.vue'
import { isNoncombatant } from '@/engine/party'
import { perksOf } from '@/engine/perks'
import { contractOf } from '@/engine/tattoos'
import { bandName, exposureAt, exposureLevel, forcedSubmission, gearLewd, LEWD_STATS, lewdName, lewdOf } from '@/engine/lewd'
import { bindLabel, bindsOf, hasMaster, lockName, schoolName, schoolsOf, twoFaceCombat } from '@/engine/schools'
import { courseStatus, trainees, trainingBlocked } from '@/engine/ownerTraining'
import { MOD_NAME } from '@/engine/gear'
import { gameRule } from '@/engine/gameRules'
import { useGame } from '@/stores/game'
import { useSettings } from '@/stores/settings'
import { flash, floatText } from '@/fx/fx'
import { freshKeys, stateKey } from '@/fx/seen'
import AppDialog from '../AppDialog.vue'
import BodyFigure from './BodyFigure.vue'
import { characterBody } from '@/engine/look'
import { BODIES, BODY_NAME, type Body } from '@/engine/traits'
import ContentIcon from '../icons/ContentIcon.vue'
import PortraitBox from '../PortraitBox.vue'
import Avatar from '../ui/Avatar.vue'
import GameIcon from '../ui/GameIcon.vue'
import Hint from '../ui/Hint.vue'
import StatGrid, { type StatItem } from '../ui/StatGrid.vue'
import PaperDoll from './PaperDoll.vue'
import TattooMap from './TattooMap.vue'
import ParasitePane from './ParasitePane.vue'
import { parasitesOf } from '@/engine/parasites'
import { abilityMeta, affinityText, attrNote, CHAR_TABS, contractFor, groupedAbilities, QUALITY_NAME, signed, slotsText, TYPE_NAME, type CharTab } from './memberInfo'

// 角色詳情：分頁（屬性與戰鬥、特質、裝備、刺青、寄生物、角色設定、能力），頂部切換角色
const props = defineProps<{ open: boolean; member: string; tab: CharTab }>()
const emit = defineEmits<{ close: []; 'update:member': [id: string]; 'update:tab': [tab: CharTab] }>()
const game = useGame()
const settings = useSettings()
const s = computed(() => game.state!)
const inCombat = computed(() => !!s.value.combat)
const m = computed(() => s.value.party.find((x) => x.id === props.member) ?? s.value.party[0]!)
// 寄生物：只有身上有的時候
const tabs = computed(() => CHAR_TABS.filter((t) => (t.id !== 'parasites' || !!parasitesOf(m.value).length)
  && (!isNoncombatant(m.value) || (t.id !== 'abilities' && (t.id !== 'gear' || !!m.value.gear)))))
// 分頁不適用這個角色時（例如非戰鬥人員的能力）回到「屬性與戰鬥」：開啟、換角色、換分頁時都檢查
watch([tabs, () => props.tab, () => props.open], () => {
  if (props.open && !tabs.value.some((t) => t.id === props.tab)) emit('update:tab', 'stats')
}, { immediate: true })

const combat = computed<StatItem[]>(() => {
  const x = m.value
  const w = weaponFor(x)
  const a = armorDef(x.armor)
  return [
    { label: '行動點', value: apMaxFor(x.level, attrsOf(x)), note: `每回合 +${apRegenFor(x.level)}` },
    { label: '法術環', value: slotsText(x) },
    ...(classDef(x.class).caster !== 'none' ? [{ label: '施法屬性', value: attrName(castingAttr(x.class)), note: `熟練 +${proficiency(x.level)}` }] : []),
    { label: '幸運一擊', value: `自然骰 ${luckyThreshold(attrsOf(x), gearAffinities(x).mods.crit ?? 0)} 以上`, hint: '擲出這個數字以上的自然骰時，傷害加倍' },
    { label: '迴避骰下限', value: evadeFloor(attrsOf(x)) },
    { label: '武器', value: w.name, note: `${w.dice} ${damageTypeName(w.type)}・${attrName(w.attr)}` },
    { label: '防具', value: a.name, note: `迴避 ${signed(a.evade)}・物理減傷 ${a.dr}` },
    { label: '傷害倍率', value: affinityText(x) },
  ]
})

// 調教：主角自己的奴隸（docs/LEWD_STATS.md 第 9 節）
const canTrain = computed(() => trainees(s.value).some((x) => x.id === m.value.id))
const courses = computed(() => (canTrain.value ? courseStatus(m.value) : []))
const course = ref('serve')
const courseDesc = computed(() => courses.value.find((c) => c.id === course.value)?.desc ?? '')
const trainBlock = computed(() => (canTrain.value ? trainingBlocked(s.value, m.value, course.value) : '不能調教'))

// 慾望指標：有效值（括號是裝備的加減）、分段；曝露名聲看目前的地區
const lewdItems = computed<StatItem[]>(() => {
  const x = m.value
  const v = lewdOf(x)
  const gear = gearLewd(x)
  const items: StatItem[] = LEWD_STATS.map((k) => ({
    label: lewdName(k),
    value: v[k],
    note: `${bandName(k, v[k], k === 'submission' && forcedSubmission(x))}${gear[k] ? `（裝備 ${signed(gear[k])}）` : ''}`,
  }))
  const region = locationById(s.value.location).region
  const exp = exposureAt(s.value, x.id, region)
  items.push({ label: lewdName('exposure'), value: exp, note: `${bandName('exposure', exp)}・身上的曝露度 ${exposureLevel(x)}` })
  // 流派與雙面效應（docs/LEWD_STATS.md 第 6、7 節）
  const schools = schoolsOf(x)
  items.push({ label: '流派', value: schools.length ? schools.map(schoolName).join('、') : '沒有', note: schools.includes('servitude') ? (hasMaster(x) ? '有主人：隸從派全效' : '沒有主人：隸從派一半效果') : '' })
  const binds = bindsOf(x)
  if (binds.length) {
    const tf = twoFaceCombat(x)
    items.push({
      label: '拘束',
      value: binds.map((b) => `${b.name}（${bindLabel(b.kind, b.bind)}${b.lock ? `・${lockName(b.lock)}` : ''}）`).join('、'),
      note: tf.active.length ? `戰鬥中：${twoFaceText(tf)}` : schools.length ? '鎖上之後戰鬥中才有增益' : '沒修流派：只有平常的檢定減值',
    })
  }
  return items
})

function twoFaceText(tf: ReturnType<typeof twoFaceCombat>): string {
  const parts = Object.entries(tf.mods).filter(([, v]) => v).map(([k, v]) => `${MOD_NAME[k] ?? k} ${signed(v ?? 0)}`)
  if (tf.initiative) parts.unshift(`先攻 ${signed(tf.initiative)}`)
  if (tf.immune.length) parts.push(`免疫${tf.immune.map((id) => statusDef(id).name).join('、')}`)
  return parts.join('・')
}

// ---- 主角設定 ----
// ── 特效：加屬性點時數字彈一下；選中的能力卡發光、在能力清單裡翻面出現；新學會的特質卡翻過來
const popped = ref('')
let popTimer: ReturnType<typeof setTimeout> | undefined
function spend(attr: string) {
  game.spendAttr(m.value.id, attr as Parameters<typeof game.spendAttr>[1])
  popped.value = ''
  clearTimeout(popTimer)
  requestAnimationFrame(() => (popped.value = attr))
  popTimer = setTimeout(() => (popped.value = ''), 500)
}
// 技能攜帶上限（存檔規則）：攜帶中的技能與法術；戲法不算
const loadoutCap = computed(() => gameRule(s.value, 'skillLoadout'))
const carried = computed(() => new Set(carriedAbilities(m.value, loadoutCap.value)))
const carriedCount = computed(() => m.value.abilities.filter((id) => countsForLoadout(id) && carried.value.has(id)).length)
const learned = ref('')
function pick(e: MouseEvent, id: string) {
  const el = e.currentTarget as HTMLElement
  flash(el, '#ffd34d', true)
  floatText(el, '習得！', { color: '#ffd34d', top: true })
  learned.value = id
  game.chooseAbility(m.value.id, id)
}
const newPerks = computed(() => freshKeys(`perks:${stateKey(game.state)}:${m.value.id}`, perksOf(m.value).map((p) => p.id)))
const editingProfile = ref(false)
const profile = reactive<{ gender: string; appearance: string; background: string; body: Body | '' }>({ gender: '', appearance: '', background: '', body: '' })
function startProfile() {
  profile.gender = m.value.gender ?? ''
  profile.body = m.value.body ?? ''
  profile.appearance = m.value.appearance ?? ''
  profile.background = m.value.background ?? ''
  editingProfile.value = true
}
function saveProfile() {
  game.editProfile({ ...profile })
  editingProfile.value = false
}
watch(() => props.member, () => (editingProfile.value = false, editingTags.value = false))
// 主角的身分標籤：存檔規則允許時可以更換
const editingTags = ref(false)
const tagDraft = ref<string[]>([])
const canChangeTags = computed(() => !!game.state?.options?.tagChange)
function startTags() {
  tagDraft.value = [...(m.value.tags ?? [])]
  editingTags.value = true
}
function saveTags() {
  game.setPcTags(tagDraft.value)
  editingTags.value = false
}
</script>

<template>
  <AppDialog :open="open" title="角色詳情" icon="user" width="1120px" fixed @close="emit('close')">
    <div class="who">
      <button v-for="x in s.party" :key="x.id" :class="{ on: x.id === m.id }" @click="emit('update:member', x.id)">
        <Avatar :id="x.id" :size="26" />{{ x.name }}
      </button>
    </div>
    <nav class="tabs">
      <button v-for="t in tabs" :key="t.id" :class="{ on: t.id === tab }" @click="emit('update:tab', t.id)">
        <GameIcon :name="t.icon" :size="15" />{{ t.label }}
        <span v-if="(t.id === 'abilities' && m.pendingAbilityChoices?.length) || (t.id === 'stats' && m.attrPoints > 0)" class="dot" />
      </button>
    </nav>

    <!-- 屬性與戰鬥 -->
    <section v-if="tab === 'stats'" class="pane two">
      <div>
        <div v-if="!isNoncombatant(m)" class="level">
          <b>Lv.{{ m.level }}</b>
          <div class="bar xp"><span :style="{ width: `${Math.min(100, (m.xp / xpToNext(m.level)) * 100)}%` }" /></div>
          <span class="num">EXP {{ m.xp }} / {{ xpToNext(m.level) }}</span>
        </div>
        <table class="attrs">
          <thead><tr><th>屬性</th><th>數值</th><th>修正</th><th>來源</th><th /></tr></thead>
          <tbody>
            <tr v-for="a in attributeRules.attributes" :key="a.id">
              <td>{{ a.name }} <Hint :text="a.desc" /></td>
              <td class="big" :class="{ changed: attrNote(m, a.id) }"><span :class="{ pop: popped === a.id }">{{ attrsOf(m)[a.id] }}</span></td>
              <td>{{ signed(mod(attrsOf(m)[a.id])) }}</td>
              <td class="src">{{ attrNote(m, a.id) || '—' }}</td>
              <td><button v-if="m.attrPoints > 0" class="small" :disabled="inCombat" :aria-label="`${a.name} +1`" @click="spend(a.id)">＋</button></td>
            </tr>
          </tbody>
        </table>
        <p v-if="m.attrPoints > 0" class="points">可分配屬性點：<b>{{ m.attrPoints }}</b></p>
      </div>
      <div>
        <p v-if="isNoncombatant(m)" class="small muted">無法戰鬥：同行但不參與戰鬥、不分經驗。戰敗時依親密度救助（搬救兵）或逃跑（在聚落等你）。</p>
        <StatGrid v-else :items="combat" />
        <h4 class="lewd-title">慾望指標 <Hint text="成人向。淫亂、敏感、忍耐、順從會隨經歷慢慢改變，影響慾望戰鬥（慾望上限、受到的慾望、初始慾望……）與 AI 的描寫；曝露名聲依地區記，在城鎮裡穿著曝露的服裝會累積，每天淡掉一點。括號是裝備給的加減。流派從受訓學（娼館、神殿、裁縫店……）；拘束具平常是檢定減值，修了流派又上了鎖，戰鬥中反轉成增益。" /></h4>
        <StatGrid :items="lewdItems" />
      </div>
    </section>

    <!-- 特質 -->
    <section v-else-if="tab === 'perks'" class="pane">
      <div class="perks">
        <article v-for="p in perksOf(m)" :key="p.id" class="perk" :class="{ flaw: p.flaw, flip: newPerks.has(p.id) }">
          <header>
            <ContentIcon kind="perk" :def="p" :size="20" />
            <b>{{ p.name }}</b>
            <span v-if="p.race" class="tag">種族</span><span v-if="p.flaw" class="tag bad">缺陷</span><span v-if="p.custom" class="tag">自訂</span>
          </header>
          <p class="small">{{ p.desc }}</p>
        </article>
      </div>
      <p v-if="!perksOf(m).length" class="muted small">還沒有特質。可以靠升級、事件、特殊任務、受訓與書籍學會。</p>
      <p v-if="m.perkOffers?.length" class="muted small">有 {{ m.perkOffers.length }} 次學特質的機會，在事件視窗（右上角的「待處理」）選擇。</p>
    </section>

    <!-- 裝備 -->
    <section v-else-if="tab === 'gear'" class="pane"><PaperDoll :member="m" /></section>

    <!-- 刺青 -->
    <section v-else-if="tab === 'tattoos'" class="pane"><TattooMap :member="m" /></section>

    <!-- 寄生物 -->
    <section v-else-if="tab === 'parasites'" class="pane"><ParasitePane :member="m" /></section>

    <!-- 角色設定 -->
    <section v-else-if="tab === 'profile'" class="pane profile">
      <PortraitBox :id="m.id" />
      <div class="texts">
        <div v-if="contractFor(m)" class="contract small">
          <h4><GameIcon name="lock" :size="14" /> {{ contractFor(m)!.def.name }}</h4>
          <div>主人 {{ contractFor(m)!.masterName || '無主' }}・{{ contractFor(m)!.def.mark }}</div>
          <ul class="plain">
            <li v-for="f in contractFor(m)!.def.functions" :key="f" class="muted">{{ (slaveryRules.functions as Record<string, string>)[f] }}</li>
            <li v-for="e in contractFor(m)!.def.side_effects" :key="e" class="muted">副作用：{{ e }}</li>
          </ul>
          <div class="row">
            <span class="tag">收益歸主人 {{ Math.round(contractFor(m)!.def.income_share * 100) }}%</span>
            <span class="tag">談判 DC {{ contractFor(m)!.def.negotiate_dc }}</span>
            <span class="tag">逃離 DC {{ contractFor(m)!.def.escape_dc }}</span>
            <span class="tag">出城 DC {{ contractFor(m)!.def.exit_dc }}</span>
            <span class="tag">服從懲罰 -{{ contractFor(m)!.obedience }}</span>
          </div>
          <button v-if="contractOf(m)?.master === 'pc'" class="small" :disabled="inCombat" @click="game.releaseSlave(m.id)">解除契約</button>
          <div v-if="canTrain" class="training">
            <h4><GameIcon name="lock" :size="14" /> 調教 <Hint text="成人向（docs/LEWD_STATS.md 第 9 節）。選一個課程，抽一件調教事件，由你選做法、擲檢定；奴隸越順從越容易，親密度很低時變難。成功時指標成長，同一課程成功幾次保證學會一個技能；親密度很低時失敗會留下怨恨。" /></h4>
            <div class="row">
              <select v-model="course">
                <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.name }}（{{ c.progress }}/{{ c.need }}）{{ c.open.length ? `・還能學：${c.open.join('、')}` : '' }}</option>
              </select>
              <button class="small" :disabled="!!trainBlock" :title="trainBlock ?? ''" @click="game.startTraining(m.id, course); emit('close')">開始調教</button>
            </div>
            <p v-if="courseDesc" class="small muted">{{ courseDesc }}</p>
          </div>
        </div>
        <template v-if="!editingProfile">
          <dl class="kv">
            <template v-if="m.personality"><dt>個性</dt><dd>{{ m.personality }}</dd></template>
            <template v-if="m.gender"><dt>性別</dt><dd>{{ m.gender }}</dd></template>
            <template v-if="m.isPlayer"><dt>體型</dt><dd>{{ BODY_NAME[characterBody(m)] }}<span v-if="!m.body" class="muted">（依種族與性別）</span></dd></template>
            <template v-if="m.birthplace"><dt>出身</dt><dd>{{ locationById(m.birthplace).name }}</dd></template>
            <template v-if="m.isPlayer && (m.tags?.length || canChangeTags)">
              <dt>身分</dt>
              <dd>
                <template v-if="!editingTags">
                  <span v-for="t in m.tags ?? []" :key="t" class="tag" :title="tagDef(t)?.ai_hint">{{ tagDef(t)?.emoji }} {{ tagDef(t)?.name ?? t }}</span>
                  <span v-if="!m.tags?.length" class="muted">（沒有）</span>
                  <button v-if="canChangeTags" class="small" @click="startTags"><GameIcon name="edit" :size="13" /> 更換</button>
                </template>
                <div v-else class="tag-edit">
                  <PcTagPicker v-model="tagDraft" />
                  <div class="row"><button class="small primary" @click="saveTags">儲存</button><button class="small" @click="editingTags = false">取消</button></div>
                </div>
              </dd>
            </template>
            <template v-if="m.appearance"><dt>外貌</dt><dd>{{ m.appearance }}</dd></template>
            <template v-if="m.background"><dt>背景</dt><dd>{{ m.background }}</dd></template>
          </dl>
          <button v-if="m.isPlayer" class="small" @click="startProfile"><GameIcon name="edit" :size="13" /> 編輯設定</button>
        </template>
        <form v-else class="edit" @submit.prevent="saveProfile">
          <label>性別<input v-model="profile.gender" maxlength="20" /></label>
          <div class="body-pick">
            <label>體型 <Hint text="裝備欄與刺青的人形圖用哪一種輪廓；不選時依種族與性別。" />
              <select v-model="profile.body">
                <option value="">依種族與性別（{{ BODY_NAME[characterBody({ race: m.race, gender: profile.gender })] }}）</option>
                <option v-for="b in BODIES" :key="b" :value="b">{{ BODY_NAME[b] }}</option>
              </select>
            </label>
            <span class="fig"><BodyFigure :body="profile.body || characterBody({ race: m.race, gender: profile.gender })" /></span>
          </div>
          <label>外貌<textarea v-model="profile.appearance" rows="3" maxlength="600" /></label>
          <label>背景<textarea v-model="profile.background" rows="4" maxlength="800" /></label>
          <div class="row"><button class="small primary" type="submit">儲存</button><button class="small" type="button" @click="editingProfile = false">取消</button></div>
        </form>
      </div>
    </section>

    <!-- 能力 -->
    <section v-else-if="tab === 'abilities'" class="pane">
      <div v-if="m.pendingAbilityChoices?.length" class="choose">
        <div class="row head">
          <b><GameIcon name="sparkles" :size="15" /> 升級！請選擇一項能力</b>
          <button class="small" :disabled="inCombat || rerollsLeft(m, settings.rerollLimit()) <= 0" @click="game.rerollAbility(m.id)">重抽（剩 {{ rerollsLeft(m, settings.rerollLimit()) }} 次）</button>
        </div>
        <div class="options">
          <button v-for="id in m.pendingAbilityChoices[0]" :key="id" class="option" :disabled="inCombat" @click="pick($event, id)">
            <b class="ab-name"><ContentIcon kind="ability" :id="id" :size="18" />{{ abilityDef(id).name }}</b>
            <span class="muted small">{{ TYPE_NAME[abilityDef(id).type] }}【{{ QUALITY_NAME[abilityQuality(abilityDef(id))] }}】・{{ abilityMeta(abilityDef(id)) }}</span>
            <span class="small">{{ abilityDef(id).desc }}</span>
          </button>
        </div>
      </div>
      <p v-if="loadoutCap > 0 && m.abilities.some(countsForLoadout)" class="loadout small">
        攜帶 <b :class="{ full: carriedCount >= loadoutCap }">{{ carriedCount }} / {{ loadoutCap }}</b>
        <Hint text="戰鬥中只能用攜帶的技能與法術（戲法不算，一直都帶著）；沒帶的留在技能庫，戰鬥以外隨時可以換。上限在設定的「這個存檔的規則」調整。" />
      </p>
      <div v-for="g in groupedAbilities(m)" :key="g.type" class="group">
        <h4>{{ TYPE_NAME[g.type] }}</h4>
        <div class="abilities">
          <article v-for="a in g.items" :key="a.id" class="ability" :class="[`q-${abilityQuality(a)}`, { flip: learned === a.id, benched: !carried.has(a.id) }]">
            <header>
              <ContentIcon kind="ability" :def="a" :size="20" /><b>{{ a.name }}</b><span class="tag">{{ QUALITY_NAME[abilityQuality(a)] }}</span>
              <button
                v-if="loadoutCap > 0 && countsForLoadout(a.id)" class="carry small" :class="carried.has(a.id) ? 'ghost' : 'sec'"
                :disabled="inCombat || (!carried.has(a.id) && carriedCount >= loadoutCap)"
                :title="inCombat ? '戰鬥中不能換' : carried.has(a.id) ? '放回技能庫' : carriedCount >= loadoutCap ? '已經帶滿，先放回一個' : '帶上'"
                @click="game.setAbilityCarried(m.id, a.id, !carried.has(a.id))"
              >{{ carried.has(a.id) ? '攜帶中' : '技能庫' }}</button>
            </header>
            <div class="meta small muted">{{ abilityMeta(a) }}</div>
            <p class="small">{{ a.desc }}</p>
          </article>
        </div>
      </div>
      <p v-if="!m.abilities.length" class="muted small">還沒有能力。</p>
    </section>
  </AppDialog>
</template>

<style scoped>
.who { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.who button { display: flex; align-items: center; gap: 6px; padding: 3px 12px 3px 3px; }
.who button.on { background: #4b3420; color: var(--parchment); border-color: #2a1a0e; box-shadow: 0 0 0 1px #c99a45; }
.tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 2px solid #4b3420; margin-bottom: 14px; }
.tabs button { position: relative; display: flex; align-items: center; gap: 6px; background: #d9c08c; border: 1px solid #a88a5a; border-bottom: none; border-radius: 3px 3px 0 0; margin-bottom: -2px; color: var(--muted); padding: 6px 16px; }
.tabs button.on { background: #4b3420; color: #f0d083; border-color: #2a1a0e; }
.dot { position: absolute; top: 4px; right: 4px; width: 7px; height: 7px; border-radius: 50%; background: var(--danger); }
.pane.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 28px; }
.level { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; margin-bottom: 8px; }
.level b { font-size: 1.1rem; font-weight: 900; }
.level .bar { height: 7px; }
.level .num { font-size: var(--fs-sm); color: var(--muted); font-variant-numeric: tabular-nums; }
.attrs { width: 100%; border-collapse: collapse; }
.attrs th { text-align: left; font-weight: 600; padding: 6px 4px; font-size: var(--fs-sm); color: var(--muted); border-bottom: 2px solid #4b3420; }
.attrs td { padding: 7px 4px; border-bottom: 1px dotted var(--border); font-variant-numeric: tabular-nums; }
.attrs .big { font-size: 1.2rem; font-weight: 900; }
.attrs .big.changed { color: #a8452c; }
.attrs .src { font-size: var(--fs-xs); color: var(--muted); }
.points b { color: #a8452c; }
.perks, .abilities { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; }
.perk, .ability { padding: 8px 10px; background: #fff8e455; border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 2px; }
.perk.flaw { border-left-color: var(--danger); }
.perk header, .ability header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.perk p, .ability p { margin: 4px 0 0; }
.ab-name { display: inline-flex; align-items: center; gap: 4px; }
.tag.bad { color: var(--danger); border-color: var(--danger); }
.ability.q-uncommon { border-left-color: #2f7a1e; } .ability.q-rare { border-left-color: #1f5a9a; }
.ability.q-epic { border-left-color: #6a3a9a; } .ability.q-legendary, .ability.q-mythic { border-left-color: #a86a10; }
.lewd-title { margin: 14px 0 4px; color: var(--accent-2); letter-spacing: 0.1em; display: flex; align-items: center; gap: 4px; }
.group h4 { margin: 12px 0 6px; color: var(--accent-2); letter-spacing: 0.15em; }
.loadout { margin: 0 0 4px; display: flex; align-items: center; gap: 4px; }
.loadout .full { color: #a8452c; }
.ability.benched { opacity: 0.6; }
.ability .carry { margin-left: auto; padding: 1px 8px; }
.choose { padding: 10px; border: 1px dashed var(--accent); border-radius: 3px; margin-bottom: 8px; background: #fff3cf66; }
.choose .head { justify-content: space-between; }
.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 6px; margin-top: 8px; }
.option { display: grid; text-align: left; gap: 2px; white-space: normal; }
.profile { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 20px; align-items: start; }
.texts { display: grid; gap: 10px; justify-items: start; }
.texts > * { max-width: 100%; }
.texts .kv, .texts .contract, .texts .edit { justify-self: stretch; }
.kv { display: grid; grid-template-columns: 4em minmax(0, 1fr); gap: 6px 10px; margin: 0; }
.kv dt { color: var(--muted); font-size: var(--fs-sm); letter-spacing: 0.15em; }
.kv dd { margin: 0; }
.kv dd .tag { margin-right: 4px; }
.tag-edit { display: grid; gap: 6px; }
.contract { display: grid; gap: 4px; padding: 8px 10px; border: 1px dashed var(--danger); border-radius: 3px; }
.contract h4 { margin: 0; color: var(--danger); display: flex; align-items: center; gap: 4px; }
.edit { display: grid; gap: 6px; }
.edit label { display: grid; gap: 2px; }
.edit textarea { width: 100%; }
@media (max-width: 900px) { .pane.two, .profile { grid-template-columns: minmax(0, 1fr); } }
.body-pick { display: flex; gap: 10px; align-items: center; }
.body-pick .fig { width: 44px; flex: none; }
/* 特效：屬性 +1 彈一下、新能力與新特質的卡片翻過來 */
.pop { display: inline-block; animation: attr-pop 0.4s steps(4, end); color: var(--gold-hi); }
@keyframes attr-pop { 40% { transform: scale(1.6) translateY(-3px); } }
.flip { animation: card-flip 0.6s steps(6, end); box-shadow: 0 0 0 1px var(--accent), 0 0 12px #f0d08366; }
@keyframes card-flip { from { transform: rotateY(180deg); filter: brightness(0.3); } 50% { transform: rotateY(90deg); } }
</style>
