<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { gearAffinities, weaponFor } from '@/engine/character'
import { armorDef, damageTypeName, weaponDef } from '@/engine/data'
import { gearKnown, gearRules, gearSpecOf, gearStats, gearSummary, MOD_NAME, rarityName, slotName, slotsFor } from '@/engine/gear'
import { lockable, lockedGear, lockItems } from '@/engine/inventory'
import { bindsOf, lockName, schoolsOf } from '@/engine/schools'
import { keysFor, stuckRestraint, unbindDc } from '@/engine/restraints'
import type { Character, GearSlot, GearSpec } from '@/engine/types'
import { useGame } from '@/stores/game'
import { characterBody } from '@/engine/look'
import GameIcon from '../ui/GameIcon.vue'
import ItemIcon from '../items/ItemIcon.vue'
import BodyFigure from './BodyFigure.vue'
import { signed, SLOT_ICON } from './memberInfo'
import { specRarity } from '../items/itemInfo'

// 裝備的紙娃娃：欄位排在人形兩側；點欄位列出行囊中能裝的物品，可以直接換上或卸下
const props = defineProps<{ member: Character }>()
const game = useGame()
const s = computed(() => game.state!)
const m = computed(() => props.member)
const inCombat = computed(() => !!s.value.combat)

const LEFT: GearSlot[] = ['head', 'accessory', 'body', 'underwear_top', 'wrists', 'main_hand', 'belt', 'legs', 'extra_1']
const RIGHT: GearSlot[] = ['piercing_1', 'piercing_2', 'ring_1', 'ring_2', 'off_hand', 'underwear_bottom', 'leg_accessory', 'feet']

const selected = ref<GearSlot>('main_hand')
const onlySlot = ref(true)
watch(() => props.member.id, () => (selected.value = 'main_hand'))

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
function chips(spec: GearSpec): string[] {
  return gearSummary(spec).split('・').slice(1)
}

/** 行囊中可以裝備的東西（依欄位篩選） */
const candidates = computed(() =>
  s.value.inventory
    .filter((i) => i.qty > 0)
    .map((i) => ({ name: i.name, qty: i.qty, spec: gearSpecOf(s.value, i.name) }))
    .filter((i): i is { name: string; qty: number; spec: GearSpec } => !!i.spec && gearKnown(i.spec))
    .map((i) => ({ ...i, slots: slotsFor(i.spec).filter((x) => !blocked(x)) }))
    .filter((i) => i.slots.length && (!onlySlot.value || i.slots.includes(selected.value))),
)

/** 和目前這一格的裝備比較：武器骰的變化（中性），數值變化（正的綠色、負的紅色） */
function diff(spec: GearSpec): { text: string; up?: boolean }[] {
  const cur = current.value && gearKnown(current.value.spec) ? gearStats(current.value.spec) : undefined
  const now = cur?.mods ?? {}
  const st = gearStats(spec)
  const next = st.mods
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

const totals = computed(() => {
  const g = gearAffinities(m.value)
  const w = weaponFor(m.value)
  const a = armorDef(m.value.armor)
  return [
    `${w.name} ${w.dice} ${damageTypeName(w.type)}`,
    `${a.name}：迴避 ${signed(a.evade)}、減傷 ${a.dr}`,
    ...Object.entries(g.mods).filter(([, v]) => v).map(([k, v]) => `其他加成 ${MOD_NAME[k] ?? k} ${signed(v!)}`),
  ]
})
</script>

<template>
  <div class="equip">
    <div class="doll">
      <div v-for="(col, ci) in [LEFT, RIGHT]" :key="ci" class="col" :class="ci ? 'right' : 'left'">
        <button
          v-for="slot in col" :key="slot" class="slot ghost"
          :class="[{ sel: selected === slot, filled: m.gear?.[slot], blocked: blocked(slot), locked: lockedGear(m, slot) }, m.gear?.[slot] ? `r-${rarityOf(m.gear[slot]!.spec)}` : '']"
          :title="blocked(slot) ? `${slotName(slot)}：這個種族無法使用` : m.gear?.[slot] ? `${m.gear[slot]!.name}\n${gearSummary(m.gear[slot]!.spec)}` : slotName(slot)"
          @click="selected = slot"
        >
          <span class="box">
            <ItemIcon v-if="m.gear?.[slot] && !lockedGear(m, slot)" :name="m.gear[slot]!.name" :spec="m.gear[slot]!.spec" :size="24" />
            <GameIcon v-else :name="lockedGear(m, slot) ? 'lock' : SLOT_ICON[slot]" :size="20" />
          </span>
          <span class="txt"><span class="sn">{{ slotName(slot) }}</span><span class="in">{{ blocked(slot) ? '無法使用' : m.gear?.[slot]?.name ?? '—' }}</span></span>
        </button>
      </div>
      <div class="fig">
        <BodyFigure :body="characterBody(m)" />
      </div>
      <div class="totals"><span v-for="t in totals" :key="t" class="tag">{{ t }}</span></div>
    </div>

    <div class="picker">
      <h4><GameIcon :name="SLOT_ICON[selected]" :size="16" />{{ slotName(selected) }}</h4>
      <div v-if="current" class="current">
        <span class="gear-ic big" :class="`r-${rarityOf(current.spec)}`"><ItemIcon :name="current.name" :spec="current.spec" :size="36" /></span>
        <div>
          <div class="iname" :class="`r-${rarityOf(current.spec)}`">{{ current.name }} <span class="tag">{{ rarityName(rarityOf(current.spec)) }}</span></div>
          <div class="chips"><span v-for="c in chips(current.spec)" :key="c" class="tag">{{ c }}</span></div>
        </div>
        <button
          class="small" :disabled="inCombat || !!lockedGear(m, selected)"
          :title="lockedGear(m, selected) ? '主人強制戴上的，契約還在時不能拿下' : inCombat ? '戰鬥中不能換裝備' : ''"
          @click="game.unequipItem(m.id, selected)"
        >卸下</button>
      </div>
      <p v-else class="muted small empty">{{ blocked(selected) ? '這個種族無法使用這個欄位。' : '這一格沒有裝備。' }}</p>
      <div v-if="current && bind" class="lock-row small">
        <GameIcon :name="bind.lock ? 'lock' : 'unlock'" :size="14" />
        <span v-if="bind.lock">{{ current.locked ? '主人的' : '' }}{{ lockName(bind.lock) }}</span>
        <span v-else class="muted">沒有上鎖</span>
        <span class="muted">{{ bindNote }}</span>
        <template v-if="lockable(current)">
          <select v-model="lockPick" :disabled="inCombat || !locks.length">
            <option value="">{{ locks.length ? '選一把鎖…' : '行囊裡沒有鎖' }}</option>
            <option v-for="l in locks" :key="l.name" :value="l.name">{{ l.name }}</option>
          </select>
          <button class="small" :disabled="inCombat || !lockPick" @click="lockIt">上鎖</button>
        </template>
        <button v-else-if="bind.lock && !current.locked" class="small" :disabled="inCombat" @click="game.unlockGear(m.id, selected)">打開鎖</button>
      </div>
      <div v-if="stuck && unbind" class="lock-row small">
        <button class="small" :disabled="inCombat" :title="`靈巧檢定，DC ${unbind.dc}（${unbind.parts.map((p) => `${p.label} ${signed(p.value)}`).join('、')}）；主人在身邊時失敗會被懲罰`" @click="game.tryUnbind(m.id, selected)">嘗試脫縛（DC {{ unbind.dc }}）</button>
        <template v-if="keys.length">
          <select v-model="keyPick" :disabled="inCombat">
            <option value="">選一把鑰匙…</option>
            <option v-for="k in keys" :key="k" :value="k">{{ k }}</option>
          </select>
          <button class="small" :disabled="inCombat || !keyPick" @click="openKey">用鑰匙打開</button>
        </template>
        <span v-else class="muted">沒有打得開{{ lockName(stuck.lock) }}的鑰匙</span>
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
              <span v-for="t in chips(c.spec)" :key="t" class="tag">{{ t }}</span>
              <span v-for="d in (onlySlot ? diff(c.spec) : [])" :key="d.text" class="delta" :class="d.up === undefined ? '' : d.up ? 'up' : 'down'">{{ d.text }}</span>
            </div>
            <div v-if="warning(c.spec)" class="warn small">{{ warning(c.spec) }}</div>
          </div>
          <button class="small" :disabled="inCombat || (onlySlot && !!lockedGear(m, selected))" @click="equip(c.name, c.slots)">{{ current && onlySlot ? '換上' : '裝備' }}</button>
        </div>
        <p v-if="!candidates.length" class="muted small empty">行囊裡沒有{{ onlySlot ? `可以放在${slotName(selected)}的` : '可以裝備的' }}東西。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.equip { display: grid; grid-template-columns: 440px minmax(0, 1fr); gap: 18px; align-items: start; }
.doll {
  display: grid; grid-template-columns: 150px 1fr 150px; gap: 6px; padding: 14px 10px;
  background: #3a2a1a; border: 3px solid #2a1a0e; box-shadow: inset 0 0 0 1px #c99a45, inset 0 0 30px #000; color: #efe4cc;
}
.col { display: grid; gap: 6px; align-content: start; }
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
@media (max-width: 520px) { .doll { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1fr); padding: 10px 4px; } }
</style>
