<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { weaponFor } from '@/engine/character'
import { armorDef, BIND_KINDS, damageTypeName, lewdRules, weaponDef } from '@/engine/data'
import { bonusesOff, onlyNegative, classWeaponBlock, EXTRA_SLOTS, gearBonuses, gearKnown, gearRules, gearSpecOf, gearStats, gearSummaryParts, MOD_NAME, rarityName, slotNameFor, slotsFor } from '@/engine/gear'
import { perkCombat } from '@/engine/perks'
import { keyAway, keyHolderName, keyKeepers, lockable, lockedGear, lockItems } from '@/engine/inventory'
import { adultOutfitPieces, bindKindKeys, bindsOf, keyCustody, lockName, schoolsOf } from '@/engine/schools'
import { combatRelease } from '@/engine/combatRelease'
import { cutLockFee, cutLockHere, keysFor, stuckRestraint, unbindDc, uncurseFee, uncurseHere } from '@/engine/restraints'
import { formatMoney } from '@/engine/money'
import { fusionMult, fusionRules, wornDaysOf } from '@/engine/fusion'
import type { Character, GearSlot, GearSpec } from '@/engine/types'
import type { SummaryPart } from '@/engine/gear'
import type { Mods } from '@/engine/data'
import { useGame } from '@/stores/game'
import { gameRule } from '@/engine/gameRules'
import { characterBody } from '@/engine/look'
import { VACUUM_TEXT, vacuumSides } from '@/engine/lewd'
import GameIcon from '../ui/GameIcon.vue'
import Hint from '../ui/Hint.vue'
import ItemIcon from '../items/ItemIcon.vue'
import BodyFigure from './BodyFigure.vue'
import SlotButton from './SlotButton.vue'
import { signed, SLOT_ICON } from './memberInfo'
import { specRarity } from '../items/itemInfo'
import EffectLine from '../items/EffectLine.vue'

// 裝備的紙娃娃：欄位排在人形兩側；點欄位列出行囊中能裝的物品，可以直接換上或卸下
const props = defineProps<{ member: Character }>()
const game = useGame()
const s = computed(() => game.state!)
const m = computed(() => props.member)
// 真空：內衣、內褲欄空著、外衣又會走光時，那一格寫「沒穿內衣／沒穿內褲」
const vacuumSlot = computed<Partial<Record<GearSlot, string>>>(() => {
  const v = vacuumSides(m.value)
  return { ...(v.includes('top') ? { underwear_top: VACUUM_TEXT.top } : {}), ...(v.includes('bottom') ? { underwear_bottom: VACUUM_TEXT.bottom } : {}) }
})
const inCombat = computed(() => !!s.value.combat)

// 三組：武器與穿著（人形兩側，由上到下）、飾品、額外飾品
const LEFT: GearSlot[] = ['head', 'body', 'underwear_top', 'wrists', 'main_hand']
const RIGHT: GearSlot[] = ['belt', 'legs', 'underwear_bottom', 'feet', 'off_hand']
const JEWELS: GearSlot[] = ['accessory', 'leg_accessory', 'ring_1', 'ring_2', 'piercing_1', 'piercing_2']
// 額外飾品欄：存檔規則開放的格數；關掉的格子裡還有上了鎖的東西時也列出來（解開之後收進行囊）
const EXTRA_HINT = '格數在設定的遊戲規則調整（存檔規則）。首飾、戒指、穿孔、腿部飾品與任何部位的拘束具都能放。拘束具放在這裡：附魔、材料特性、正的屬性與檢定加值不生效（標籤上不列）；減值、慾望指標與拘束照算，修了流派又上了鎖時雙面效應也照算。'
const extraOpen = computed(() => Math.min(EXTRA_SLOTS.length, gameRule(s.value, 'extraSlots')))
const EXTRAS = computed(() => {
  const used = EXTRA_SLOTS.reduce((n, slot, i) => (m.value.gear?.[slot] ? i + 1 : n), 0)
  return EXTRA_SLOTS.slice(0, Math.max(extraOpen.value, used))
})

const selected = ref<GearSlot>('main_hand')
const onlySlot = ref(true)
watch(() => props.member.id, () => (selected.value = 'main_hand'))

/** 欄位在這個人身上的名字（人馬族的內褲那一格叫「後蹄」） */
const slotName = (slot: GearSlot) => slotNameFor(slot, m.value.race)
/** 欄位的圖示：改名的欄位用它改收的那一種（人馬族的後蹄用鞋子） */
const slotIcon = (slot: GearSlot) => SLOT_ICON[(gearRules.races[m.value.race]?.relabel?.[slot]?.as as GearSlot | undefined) ?? slot] ?? SLOT_ICON[slot]
const blocked = (slot: GearSlot) => (gearRules.races[m.value.race]?.blocked ?? []).includes(slot)
const current = computed(() => m.value.gear?.[selected.value])

const rarityOf = (spec: GearSpec | undefined) => specRarity(spec) || 'common'

// 拘束具的鎖（雙面效應，docs/LEWD_STATS.md 第 7 節）：鎖上、修了流派，戰鬥中才有增益
const bind = computed(() => bindsOf(m.value).find((b) => b.slot === selected.value))
const locks = computed(() => lockItems(s.value))
const lockPick = ref('')
const bindNote = computed(() => {
  const b = bind.value
  if (!b) return ''
  if (!schoolsOf(m.value).length) return '還沒修任何慾望流派：只有平常的檢定減值'
  return b.lock ? '戰鬥中的增益生效' : '鎖上之後，戰鬥中才有增益'
})
// 淫器：穿了幾天、戰鬥時展開的倍率（docs/LEWD_STATS.md 第 22 節）
const fused = computed(() => {
  const g = current.value
  if (!g?.spec.fused) return undefined
  const days = wornDaysOf(s.value, m.value, g.name)
  return { weapon: g.spec.fused.weaponName, days, of: fusionRules().days, mult: fusionMult(days) }
})
// 別人鎖上的拘束具（主人強制戴上的）：嘗試脫縛或用鑰匙打開（docs/LEWD_STATS.md 第 16 節）
const stuck = computed(() => stuckRestraint(m.value, selected.value))
const unbind = computed(() => (stuck.value ? unbindDc(m.value, selected.value) : undefined))
const keys = computed(() => (stuck.value ? keysFor(s.value, m.value, selected.value) : []))
const keyPick = ref('')
function openKey() {
  if (!keyPick.value) return
  void game.useKey(m.value.id, selected.value, keyPick.value)
  keyPick.value = ''
}
function lockIt() {
  if (!lockPick.value) return
  void game.lockGear(m.value.id, selected.value, lockPick.value)
  lockPick.value = ''
}
// 自己鎖上的拘束具的鑰匙（docs/LEWD_STATS.md 第 7 節）：自己留著、交給同伴或主人保管、丟掉
const custody = computed(() => keyCustody(current.value, m.value))
const keyWhere = computed(() => {
  const h = current.value?.keyHolder
  if (!h || !current.value?.lock || current.value.locked) return ''
  return h === 'self' ? '在自己身上' : h === 'discarded' ? '已經丟掉' : `在${custody.value === 'master' ? '主人' : ''}${keyHolderName(s.value, h)}那裡`
})
const keyBlock = computed(() => (current.value ? keyAway(s.value, current.value) : undefined))
const keepers = computed(() => keyKeepers(s.value, m.value))
const keeperPick = ref('')
const KEY_HINT = (() => {
  // 數字可以在內容編輯器的「⚙️ 雙面效應設定」改：同伴、主人分開寫，行動點不是 0 時才寫
  const r = lewdRules.locks.key_custody
  const caps = (x: { stat: number; init: number; ap: number }) => [x.stat ? `+${x.stat}` : '', x.init ? `先攻 +${x.init}` : '', x.ap ? `行動點回復 +${x.ap}` : ''].filter(Boolean).join('、')
  const same = r.companion.stat === r.master.stat && r.companion.init === r.master.init && r.companion.ap === r.master.ap
  const held = same ? caps(r.companion) : `交給同伴 ${caps(r.companion)}；交給主人 ${caps(r.master)}`
  const extra = caps(r.servitude_master)
  const kinds = BIND_KINDS.map((k) => `${lewdRules.two_face.kinds[k]?.name ?? k}：${bindKindKeys(k).map((x) => (x === 'initiative' ? '先攻' : MOD_NAME[x] ?? x)).join('、')}`).join('；')
  return `上鎖時鑰匙在自己身上，隨時可以打開鎖（鎖放回行囊）。鑰匙交給同伴或主人保管：打開前要請對方還回來（對方要在隊伍裡；主人的親密度要 ${r.master_affinity} 以上才肯還，主人是主角自己時直接還），每天順從也會成長。戰鬥中這件拘束具相關項目的上限提高：${held}${extra ? `；修了隸從派、鑰匙在自己的主人手上時再 ${extra}` : ''}。丟掉鑰匙：${caps(r.discarded)}，之後只能脫縛、用一次性的鑰匙或找鐵匠剪鎖（鎖會壞掉）。同一項只算最好的一件，不會疊加。各類拘束相關的項目——${kinds}。`
})()
function giveKeyTo() {
  if (!keeperPick.value) return
  void game.giveKey(m.value.id, selected.value, keeperPick.value)
  keeperPick.value = ''
}
function throwKey() {
  if (!confirm(`把${current.value?.name ?? ''}的鑰匙丟掉？之後只能脫縛、用一次性的鑰匙或找鐵匠剪鎖才拿得下來，鎖也會壞掉。`)) return
  void game.discardKey(m.value.id, selected.value)
}
/** 標籤：放在額外飾品欄的拘束具不列不生效的加成（off）；拘束的「限制行走 2」可以移上去看細節 */
function chips(spec: GearSpec, off = false): SummaryPart[] {
  return gearSummaryParts(spec, off).slice(1)
}

/** 行囊中可以裝備的東西（依欄位篩選） */
const candidates = computed(() =>
  s.value.inventory
    .filter((i) => i.qty > 0)
    .map((i) => ({ name: i.name, qty: i.qty, spec: gearSpecOf(s.value, i.name) }))
    .filter((i): i is { name: string; qty: number; spec: GearSpec } => !!i.spec && gearKnown(i.spec))
    .map((i) => ({ ...i, slots: slotsFor(i.spec, m.value.race) }))
    .filter((i) => i.slots.length && (!onlySlot.value || i.slots.includes(selected.value))),
)

/** 存檔規則「職業武器限制」打開時，職業不能拿的武器：灰掉按鈕並寫原因 */
function weaponBlock(spec: GearSpec): string | null {
  return s.value.options?.classWeapons ? classWeaponBlock(m.value.class, spec) : null
}

/** 和目前這一格的裝備比較：武器骰的變化（中性），數值變化（正的綠色、負的紅色） */
function diff(spec: GearSpec): { text: string; up?: boolean }[] {
  const cur = current.value && gearKnown(current.value.spec) ? gearStats(current.value.spec) : undefined
  // 額外飾品欄的拘束具只算減值
  const eff = (sp: GearSpec, mods: Mods) => (bonusesOff(selected.value, sp) ? onlyNegative(mods) : mods)
  const now = cur ? eff(current.value!.spec, cur.mods) : {}
  const st = gearStats(spec)
  const next = eff(spec, st.mods)
  const dice: { text: string; up?: boolean }[] = []
  if (cur?.weapon && st.weapon && weaponDef(cur.weapon).dice !== weaponDef(st.weapon).dice) dice.push({ text: `${weaponDef(cur.weapon).dice} → ${weaponDef(st.weapon).dice}` })
  const keys = new Set([...Object.keys(now), ...Object.keys(next)])
  return [...dice, ...[...keys]
    .map((k) => ({ k, d: Math.round(((next[k as keyof typeof next] ?? 0) - (now[k as keyof typeof now] ?? 0)) * 100) / 100 }))
    .filter((x) => x.d)
    .map((x) => ({ text: `${MOD_NAME[x.k] ?? x.k} ${signed(x.d)}`, up: x.k === 'crit' ? x.d < 0 : x.d > 0 }))]
}
function warning(spec: GearSpec): string {
  const st = gearStats(spec)
  if (st.two_handed && m.value.gear?.off_hand && (onlySlot.value ? selected.value === 'main_hand' : true)) return `雙手武器，會卸下副手的${m.value.gear.off_hand.name}`
  return ''
}
function equip(name: string, slots: GearSlot[]) {
  game.equipItem(name, m.value.id, onlySlot.value || slots.includes(selected.value) ? selected.value : undefined)
}

// 戰鬥中解放的加值（雙面效應的合計）：拘束具的部分全身有上限，寫成「套上限後的值（實際加總）」
const release = computed(() => combatRelease(s.value, m.value))
const showRelease = computed(() => {
  const r = release.value
  return r.rows.length > 0 || r.immune.length > 0 || r.lustBonus > 0 || (!!r.off && (bindsOf(m.value).length > 0 || adultOutfitPieces(m.value) > 0))
})
const RELEASE_HINT = '拘束具、淫服、寄生物、懷孕的雙面效應：平常是檢定的減值，戰鬥中（修了慾望流派、拘束具上了鎖）變成增益。拘束具的增益全身合計有上限（設定的遊戲規則：拘束具增益上限；自己鎖上的拘束具鑰匙交給別人保管或丟掉時，那件拘束具相關的項目上限提高，前面標 🔑）；括號裡是還沒套上限的實際加總，超過上限的部分戰鬥中不算。'
const releaseTitle = (r: { value: number; raw: number; keyNote?: string }) =>
  [r.raw !== r.value ? `實際加總 ${signed(r.raw)}，上限只算到 ${signed(r.value)}` : '', r.keyNote ?? ''].filter(Boolean).join('\n') || undefined
const releaseText = (r: { name: string; value: number; raw: number }) => `${r.name} ${signed(r.value)}${r.raw !== r.value ? `（${signed(r.raw)}）` : ''}`

const totals = computed(() => {
  const w = weaponFor(m.value)
  const a = armorDef(m.value.armor)
  return [
    `${w.name} ${w.dice} ${damageTypeName(w.type)}`,
    `${a.name}：迴避 ${signed(a.evade)}、減傷 ${a.dr}`,
    ...Object.entries(gearBonuses(m.value).mods).filter(([, v]) => v).map(([k, v]) => `裝備加成 ${MOD_NAME[k] ?? k} ${signed(v!)}`),
    ...Object.entries(perkCombat(m.value).mods).filter(([, v]) => v).map(([k, v]) => `特質加成 ${MOD_NAME[k] ?? k} ${signed(v!)}`),
  ]
})
</script>

<template>
  <div class="equip">
    <div class="doll">
      <div class="sec-title">武器與穿著</div>
      <div class="wear">
        <div v-for="(col, ci) in [LEFT, RIGHT]" :key="ci" class="col" :class="ci ? 'right' : 'left'">
          <SlotButton v-for="slot in col" :key="slot" :slot-id="slot" :member="m" :selected="selected === slot" :vacuum="vacuumSlot[slot]" :right="!!ci" @pick="selected = slot" />
        </div>
        <div class="fig"><BodyFigure :body="characterBody(m)" /></div>
      </div>
      <div class="sec-title">飾品</div>
      <div class="grid3">
        <SlotButton v-for="slot in JEWELS" :key="slot" :slot-id="slot" :member="m" :selected="selected === slot" @pick="selected = slot" />
      </div>
      <template v-if="EXTRAS.length">
      <div class="sec-title">額外飾品 <span class="sec-note">開放 {{ extraOpen }} 格</span> <Hint :text="EXTRA_HINT" /></div>
      <div class="grid3">
        <SlotButton v-for="slot in EXTRAS" :key="slot" :slot-id="slot" :member="m" :selected="selected === slot" @pick="selected = slot" />
      </div>
      </template>
      <div class="totals"><span v-for="t in totals" :key="t" class="tag">{{ t }}</span></div>
      <template v-if="showRelease">
        <div class="sec-title">戰鬥中解放 <span v-if="release.sources.length" class="sec-note">{{ release.sources.join('・') }}</span> <Hint :text="RELEASE_HINT" /></div>
        <div v-if="release.off" class="release muted">{{ release.off }}</div>
        <div v-else class="release">
          <span v-for="r in release.rows" :key="r.key" class="tag" :class="{ capped: r.raw !== r.value }" :title="releaseTitle(r)">{{ r.keyNote ? '🔑' : '' }}{{ releaseText(r) }}</span>
          <span v-if="release.lustBonus" class="tag">造成的慾望 {{ signed(release.lustBonus) }}</span>
          <span v-if="release.immune.length" class="tag">免疫{{ release.immune.join('、') }}</span>
          <span v-if="release.allyDown.length" class="tag">有隊友倒下時 {{ release.allyDown.map((r) => `${r.name} ${signed(r.value)}`).join('、') }}</span>
          <span v-if="!release.rows.length && !release.lustBonus && !release.immune.length" class="muted small">拘束具上了鎖才有增益</span>
        </div>
      </template>
    </div>

    <div class="picker">
      <h4><GameIcon :name="slotIcon(selected)" :size="16" />{{ slotName(selected) }}</h4>
      <div v-if="current" class="current">
        <span class="gear-ic big" :class="`r-${rarityOf(current.spec)}`"><ItemIcon :name="current.name" :spec="current.spec" :size="36" /></span>
        <div>
          <div class="iname" :class="`r-${rarityOf(current.spec)}`">{{ current.name }} <span class="tag">{{ rarityName(rarityOf(current.spec)) }}</span></div>
          <div class="chips"><EffectLine :parts="chips(current.spec, bonusesOff(selected, current.spec))" chips /></div>
        </div>
        <button
          class="small" :disabled="inCombat || !!lockedGear(m, selected)"
          :title="lockedGear(m, selected) ? (stuck?.self ? `上了鎖，鑰匙${keyWhere}：要拿回鑰匙、脫縛、用一次性的鑰匙或找鐵匠剪鎖` : stuck?.trap ? '被陷阱鎖住了：要脫縛、用鑰匙或找鐵匠剪鎖' : '主人強制戴上的，契約還在時不能拿下') : inCombat ? '戰鬥中不能換裝備' : ''"
          @click="game.unequipItem(m.id, selected)"
        >卸下</button>
      </div>
      <p v-else class="muted small empty">{{ blocked(selected) ? '這個種族無法使用這個欄位。' : '這一格沒有裝備。' }}</p>
      <div v-if="current && bind" class="lock-row small">
        <GameIcon :name="bind.lock ? 'lock' : 'unlock'" :size="14" />
        <span v-if="bind.lock">{{ current.locked ? (stuck?.curse ? '詛咒的' : stuck?.trap ? '陷阱的' : '主人的') : !current.lock && current.spec.lock ? '自帶的' : '' }}{{ lockName(bind.lock) }}</span>
        <span v-else class="muted">沒有上鎖</span>
        <span class="muted">{{ bindNote }}</span>
        <template v-if="lockable(current)">
          <select v-model="lockPick" :disabled="inCombat || !locks.length">
            <option value="">{{ locks.length ? '選一把鎖…' : '行囊裡沒有鎖' }}</option>
            <option v-for="l in locks" :key="l.name" :value="l.name">{{ l.name }}</option>
          </select>
          <button class="small" :disabled="inCombat || !lockPick" @click="lockIt">上鎖</button>
        </template>
        <button v-else-if="current.lock && !current.locked" class="small" :disabled="inCombat || !!keyBlock" :title="keyBlock ?? ''" @click="game.unlockGear(m.id, selected)">打開鎖</button>
      </div>
      <div v-if="current && bind && keyWhere" class="lock-row small">
        <GameIcon name="key" :size="14" />
        <span>鑰匙：{{ keyWhere }}</span>
        <Hint :text="KEY_HINT" />
        <template v-if="current.keyHolder === 'self'">
          <select v-model="keeperPick" :disabled="inCombat || !keepers.length">
            <option value="">{{ keepers.length ? '交給誰保管…' : '隊伍裡沒有別人' }}</option>
            <option v-for="k in keepers" :key="k.id" :value="k.id">{{ k.master ? `主人${k.name}` : k.name }}</option>
          </select>
          <button class="small" :disabled="inCombat || !keeperPick" @click="giveKeyTo">交給{{ keepers.find((k) => k.id === keeperPick)?.master ? '主人' : '同伴' }}保管</button>
          <button class="small" :disabled="inCombat" @click="throwKey">丟掉鑰匙</button>
        </template>
        <button v-else-if="current.keyHolder !== 'discarded'" class="small" :disabled="inCombat" @click="game.takeKeyBack(m.id, selected)">請{{ keyHolderName(s, current.keyHolder!) }}還鑰匙</button>
      </div>
      <div v-if="current && bonusesOff(selected, current.spec)" class="lock-row small">
        <span class="warn-line"><GameIcon name="warning" :size="14" />放在額外飾品欄：只算減值、慾望指標與拘束 <Hint :text="EXTRA_HINT" /></span>
      </div>
      <div v-if="fused" class="lock-row small">
        <span>淫器：戰鬥時展開成{{ fused.weapon }}・最近 {{ fused.of }} 天穿了 {{ fused.days }} 天</span>
        <span :class="fused.mult ? '' : 'muted'">{{ fused.mult ? `傷害 ×${fused.mult}` : '還展開不了' }}</span>
      </div>
      <div v-if="stuck?.curse" class="lock-row small">
        <span>詛咒具：掙不開、鑰匙打不開、鐵匠也剪不斷</span>
        <button v-if="uncurseHere(s)" class="small" :disabled="inCombat || s.money_cc < (uncurseFee(m, selected) ?? 0)" @click="game.uncurse(m.id, selected)">請神殿解咒（{{ formatMoney(uncurseFee(m, selected) ?? 0) }}）</button>
        <span v-else class="muted">要到神殿花 {{ formatMoney(uncurseFee(m, selected) ?? 0) }} 解咒（詛咒具會碎掉）</span>
      </div>
      <div v-else-if="stuck && unbind" class="lock-row small">
        <button class="small" :disabled="inCombat" :title="`靈巧檢定，DC ${unbind.dc}（${unbind.parts.map((p) => `${p.label} ${signed(p.value)}`).join('、')}）；主人在身邊時失敗會被懲罰`" @click="game.tryUnbind(m.id, selected)">嘗試脫縛（DC {{ unbind.dc }}）</button>
        <template v-if="keys.length">
          <select v-model="keyPick" :disabled="inCombat">
            <option value="">選一把鑰匙…</option>
            <option v-for="k in keys" :key="k" :value="k">{{ k }}</option>
          </select>
          <button class="small" :disabled="inCombat || !keyPick" @click="openKey">用鑰匙打開</button>
        </template>
        <span v-else class="muted">沒有打得開{{ lockName(stuck.lock) }}的鑰匙</span>
        <template v-if="stuck.trap || stuck.self">
          <button v-if="cutLockHere(s)" class="small" :disabled="inCombat || s.money_cc < (cutLockFee(m, selected) ?? 0)" @click="game.cutLock(m.id, selected)">請鐵匠剪鎖（{{ formatMoney(cutLockFee(m, selected) ?? 0) }}）</button>
          <span v-else class="muted">{{ stuck.self ? '鑰匙不在身上' : '陷阱的鎖' }}：也可以到鐵匠鋪花 {{ formatMoney(cutLockFee(m, selected) ?? 0) }} 剪掉</span>
        </template>
        <span class="muted">（這幾種方法打開的鎖會壞掉）</span>
      </div>

      <div class="filter">
        <span class="label">行囊中可以裝備的物品</span>
        <label class="small muted"><input v-model="onlySlot" type="checkbox" /> 只看{{ slotName(selected) }}</label>
      </div>
      <div class="list">
        <div v-for="c in candidates" :key="c.name" class="irow">
          <span class="gear-ic" :class="`r-${rarityOf(c.spec)}`"><ItemIcon :name="c.name" :spec="c.spec" :size="28" /></span>
          <div class="body">
            <div class="iname" :class="`r-${rarityOf(c.spec)}`">{{ c.name }}<span v-if="c.qty > 1" class="muted small"> ×{{ c.qty }}</span> <span class="tag">{{ rarityName(rarityOf(c.spec)) }}</span></div>
            <div class="chips">
              <EffectLine :parts="chips(c.spec, onlySlot && bonusesOff(selected, c.spec))" chips />
              <span v-for="d in (onlySlot ? diff(c.spec) : [])" :key="d.text" class="delta" :class="d.up === undefined ? '' : d.up ? 'up' : 'down'">{{ d.text }}</span>
            </div>
            <div v-if="warning(c.spec)" class="warn small">{{ warning(c.spec) }}</div>
            <div v-if="weaponBlock(c.spec)" class="warn small">{{ weaponBlock(c.spec) }}（存檔規則「職業武器限制」）</div>
          </div>
          <button class="small" :disabled="inCombat || (onlySlot && !!lockedGear(m, selected)) || !!weaponBlock(c.spec)" @click="equip(c.name, c.slots)">{{ current && onlySlot ? '換上' : '裝備' }}</button>
        </div>
        <p v-if="!candidates.length" class="muted small empty">行囊裡沒有{{ onlySlot ? `可以放在${slotName(selected)}的` : '可以裝備的' }}東西。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.equip { display: grid; grid-template-columns: 440px minmax(0, 1fr); gap: 18px; align-items: start; }
.doll {
  display: grid; gap: 6px; padding: 12px 10px;
  background: #3a2a1a; border: 3px solid #2a1a0e; box-shadow: inset 0 0 0 1px #c99a45, inset 0 0 30px #000; color: #efe4cc;
}
.col { display: grid; gap: 6px; align-content: start; }
.wear { display: grid; grid-template-columns: 150px 1fr 150px; gap: 6px; }
.wear .col.right { grid-column: 3; grid-row: 1; }
.wear .fig { grid-column: 2; grid-row: 1; }
.warn-line { display: inline-flex; align-items: center; gap: 4px; }
.grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.sec-title { font-size: var(--fs-xs); color: #f0d083; letter-spacing: .1em; border-bottom: 1px solid #c99a4555; padding: 6px 2px 3px; display: flex; gap: 8px; align-items: baseline; }
.sec-title:first-child { padding-top: 0; }
.sec-note { color: #9a8768; letter-spacing: 0; }
.slot {
  display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 6px; align-items: center; padding: 3px; text-align: left;
  background: #0006; border: 1px solid #ffffff14; border-radius: 2px; color: #efe4cc;
}
.col.right .slot { grid-template-columns: minmax(0, 1fr) 38px; text-align: right; }
.col.right .slot .box { order: 2; }
.slot:hover:not(:disabled) { border-color: #c99a45; color: #efe4cc; }
.slot.sel { border-color: #f0d083; box-shadow: 0 0 0 1px #f0d083, 0 0 12px #f0d08355; }
.slot.blocked { opacity: 0.4; }
.lock-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.box { width: 38px; height: 38px; display: grid; place-items: center; background: #120d09; border: 1px solid #000; box-shadow: inset 0 0 0 1px #5a4630; color: #4a3a28; }
.slot.filled .box { color: #e8d8b8; box-shadow: inset 0 0 0 1px #6d5128; }
.slot.locked .box { color: #d8604e; }
.txt { display: grid; min-width: 0; line-height: 1.3; }
.sn { font-size: var(--fs-xs); color: #9a8768; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.in { font-size: var(--fs-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.slot:not(.filled) .in { color: #6a5a44; }
.fig { display: grid; place-items: center; }
.fig :deep(.body-figure) { max-width: 120px; }
.totals { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: 6px; }
.totals .tag { background: #0006; color: #c9b796; border-color: #ffffff24; }
.release { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; font-size: var(--fs-xs); }
.release .tag { background: #0006; color: #b8e0a0; border-color: #6a9a5044; white-space: normal; max-width: 100%; }
.release .tag.capped { color: #f0d083; border-color: #c99a4566; }
.release.muted { color: #9a8768; }
/* 稀有度 */
.r-uncommon .box, .gear-ic.r-uncommon { color: var(--r-uncommon) !important; box-shadow: inset 0 0 0 1px var(--r-uncommon); }
.r-rare .box, .gear-ic.r-rare { color: var(--r-rare) !important; box-shadow: inset 0 0 0 1px var(--r-rare); }
.r-epic .box, .gear-ic.r-epic { color: var(--r-epic) !important; box-shadow: inset 0 0 0 1px var(--r-epic); }
.r-legendary .box, .gear-ic.r-legendary { color: var(--r-legendary) !important; box-shadow: inset 0 0 0 1px var(--r-legendary); }
.slot.r-uncommon .in { color: var(--r-uncommon); } .slot.r-rare .in { color: var(--r-rare); }
.slot.r-epic .in { color: var(--r-epic); } .slot.r-legendary .in { color: var(--r-legendary); }
.iname { font-weight: 700; }
.iname.r-uncommon { color: #2f7a1e; } .iname.r-rare { color: #1f5a9a; } .iname.r-epic { color: #6a3a9a; } .iname.r-legendary { color: #a86a10; }

.picker h4 { margin: 0 0 8px; display: flex; align-items: center; gap: 6px; font-size: var(--fs-lg); color: var(--title); }
.current { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px; background: #fff8e488; border: 1px solid var(--border); margin-bottom: 14px; }
.gear-ic { width: 40px; height: 40px; display: grid; place-items: center; background: #3a2a1aee; color: #e8d8b8; border: 1px solid #4b3420; box-shadow: inset 0 0 0 1px #c99a4555; }
.gear-ic.big { width: 52px; height: 52px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; align-items: center; }
.empty { margin: 0 0 14px; }
.filter { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.list { display: grid; gap: 6px; max-height: 52vh; overflow-y: auto; padding-right: 4px; }
.irow { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 6px 8px; border: 1px solid #c4a670; background: #fff8e444; border-radius: 2px; }
.irow:hover { background: #fff8e4aa; }
.delta { font-size: var(--fs-xs); font-weight: 700; }
.delta.up { color: var(--good); } .delta.down { color: var(--danger); }
.warn { color: var(--danger); margin-top: 2px; }
@media (max-width: 1000px) { .equip { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 520px) { .wear { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr); } .grid3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .doll { padding: 10px 4px; } }
.in.vacuum { color: var(--accent); }
</style>
