<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { fusionCandidates, fusionMult, fusionRules, wornDaysOf } from '@/engine/fusion'
import { gearSpecOf, gearSummary } from '@/engine/gear'
import { formatMoney } from '@/engine/money'
import { useGame } from '@/stores/game'
import AppDialog from '../AppDialog.vue'
import AdultDeco from './AdultDeco.vue'
import ItemIcon from '../items/ItemIcon.vue'
import { drawHexa } from './deco'

// 淫器合煉（docs/LEWD_STATS.md 第 22 節）：成人用品店把一件武器和一件拘束具合成淫器，也可以拆回來。
// 煉成台的樣子：左邊武器、右邊拘束具，中間是鎖鏈構成的六芒星（AdultDeco、deco.ts）。
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const game = useGame()
const s = computed(() => game.state!)
const rules = fusionRules()
const c = computed(() => fusionCandidates(s.value))
const weaponPick = ref('')
const restraintPick = ref('')
const weapon = computed(() => (c.value.weapons.includes(weaponPick.value) ? weaponPick.value : c.value.weapons[0] ?? ''))
const restraint = computed(() => (c.value.restraints.includes(restraintPick.value) ? restraintPick.value : c.value.restraints[0] ?? ''))

/** 一件裝備的數值（拿掉開頭的稀有度與部位） */
function statsOf(name: string): string {
  const spec = gearSpecOf(s.value, name)
  return spec ? gearSummary(spec).split('・').slice(2).join('・') : ''
}

/** 身上（行囊裡）的淫器：隊員裡穿最多天的那一位，決定現在展開的倍率 */
const owned = computed(() => c.value.fused.map((n) => {
  const days = Math.max(0, ...s.value.party.map((m) => wornDaysOf(s.value, m, n)))
  return { name: n, days, mult: fusionMult(days), weapon: gearSpecOf(s.value, n)?.fused?.weaponName ?? '' }
}))

function fuse() {
  void game.fuseGear(weapon.value, restraint.value)
  weaponPick.value = ''
  restraintPick.value = ''
}

// 中間的法陣（打開時畫）
const hexa = ref<SVGSVGElement | null>(null)
const drawn = () => { if (hexa.value) drawHexa(hexa.value) }
onMounted(drawn)
watch(() => props.open, () => setTimeout(drawn))
const marks = computed(() => Array.from({ length: rules.days }, (_, i) => rules.tiers.find(([d]) => d === i + 1)))
</script>

<template>
  <AppDialog :open="open" title="淫器合煉" icon="lock" width="1240px" variant="forge" @close="emit('close')">
    <template #frame><AdultDeco kind="forge" /></template>
    <p class="sub muted small">合煉費 {{ formatMoney(rules.fee_cc) }}・拆開免費</p>
    <div class="altar">
      <section class="card">
        <h3>⚔️ 武器 <small>行囊裡的</small></h3>
        <div class="slotbox" :class="{ filled: weapon }">
          <template v-if="weapon"><span class="big">{{ weapon }}</span>{{ statsOf(weapon) }}</template>
          <template v-else>行囊裡沒有可以合煉的武器</template>
        </div>
        <div class="list">
          <button v-for="n in c.weapons" :key="n" class="it" :class="{ on: n === weapon }" @click="weaponPick = n">
            <span class="ic"><ItemIcon :name="n" :size="26" /></span>
            <span class="tx">{{ n }}<small>{{ statsOf(n) }}</small></span>
          </button>
        </div>
      </section>

      <div class="center">
        <div class="circle">
          <svg ref="hexa" class="adult-hexa" aria-hidden="true" />
          <div class="core">
            <template v-if="weapon && restraint"><span>淫器</span><b>{{ restraint }}</b></template>
            <span v-else>放上一件武器與一件拘束具</span>
          </div>
        </div>
        <div class="preview">
          <h4>平常 → 戰鬥</h4>
          <div class="two">
            <div><b>平常是拘束具</b>{{ restraint ? `${restraint}・${statsOf(restraint)}` : '—' }}<br>雙面效應照算；日常的檢定減值 ×{{ rules.penalty_mult }}</div>
            <div><b>戰鬥時展開</b>{{ weapon ? `${weapon}・${statsOf(weapon)}` : '—' }}<br>傷害 × 展開倍率</div>
          </div>
          <div class="tiers">
            <div class="muted small">展開倍率（最近 {{ rules.days }} 天穿了幾天）</div>
            <div class="dbar"><i v-for="(_, i) in marks" :key="i" /></div>
            <div class="marks"><span v-for="(t, i) in marks" :key="i">{{ t ? `${t[0]} 天` : '' }}<br v-if="t">{{ t ? `×${t[1]}` : '' }}</span></div>
          </div>
        </div>
        <div class="go">
          <button class="fuse-btn" :disabled="!weapon || !restraint || s.money_cc < rules.fee_cc" @click="fuse">合煉（{{ formatMoney(rules.fee_cc) }}）</button>
        </div>
      </div>

      <section class="card">
        <h3>⛓️ 拘束具 <small>行囊裡的</small></h3>
        <div class="slotbox" :class="{ filled: restraint }">
          <template v-if="restraint"><span class="big">{{ restraint }}</span>{{ statsOf(restraint) }}</template>
          <template v-else>行囊裡沒有可以合煉的拘束具</template>
        </div>
        <div class="list">
          <button v-for="n in c.restraints" :key="n" class="it" :class="{ on: n === restraint }" @click="restraintPick = n">
            <span class="ic"><ItemIcon :name="n" :size="26" /></span>
            <span class="tx">{{ n }}<small>{{ statsOf(n) }}</small></span>
          </button>
        </div>
      </section>
    </div>

    <section class="card owned">
      <h3>行囊裡的淫器 <small>最近 {{ rules.days }} 天穿了幾天決定展開的傷害倍率</small></h3>
      <p v-if="!owned.length" class="muted small">還沒有淫器。穿在身上的淫器要先卸下放回行囊才能拆開。</p>
      <div v-for="o in owned" :key="o.name" class="it own">
        <span class="ic"><ItemIcon :name="o.name" :size="26" /></span>
        <span class="tx">{{ o.name }}<small>平常：{{ statsOf(o.name) }}・戰鬥：{{ o.weapon }}</small></span>
        <span class="days">
          <span class="mini"><i v-for="i in rules.days" :key="i" :class="{ on: i <= o.days }" /></span>
          <small>穿了 {{ o.days }} 天・{{ o.mult ? `傷害 ×${o.mult}` : '還展開不了' }}</small>
        </span>
        <button class="small" @click="game.splitGear(o.name)">拆開</button>
      </div>
    </section>
    <p class="note muted small">合成之後平常是那件拘束具（雙面效應照算，日常的檢定減值 ×{{ rules.penalty_mult }}），戰鬥時展開成那件武器。最近 {{ rules.days }} 天穿得越多，展開的傷害倍率越高（{{ rules.tiers.map(([d, m]) => `${d} 天 ×${m}`).join('、') }}）。拆開會還原成原本的兩件。</p>
  </AppDialog>
</template>

<style scoped>
.sub { margin: -4px 0 8px; }
.altar { --tone: #6c4bd1; --tone-soft: #6c4bd11f; display: grid; grid-template-columns: minmax(0, 1fr) 300px minmax(0, 1fr); gap: 16px; align-items: stretch; }
.owned { --tone: #6c4bd1; --tone-soft: #6c4bd11f; margin-top: 14px; }
.card { position: relative; z-index: 1; background: #fff3; border: 1px solid #5a3f2255; border-radius: 4px; padding: 10px 12px; }
h3 { margin: 0 0 8px; font-size: var(--fs-md, 15px); display: flex; gap: 6px; align-items: baseline; }
h3 small { color: var(--muted); font-weight: 400; }
button { font: inherit; }
.slotbox { min-height: 84px; border: 2px dashed #6c4bd166; border-radius: 6px; display: grid; place-content: center; text-align: center; margin-bottom: 10px; color: var(--muted); font-size: 13px; padding: 6px; }
.slotbox.filled { border-style: solid; border-color: var(--tone); background: var(--tone-soft); color: inherit; }
.slotbox .big { font-size: 16px; font-weight: 700; display: block; }
.list { display: grid; gap: 6px; max-height: 260px; overflow: auto; }
.it { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; align-items: center; padding: 5px 8px; border: 1px solid #6d512833; border-radius: 4px; background: #fff4; text-align: left; }
.it.on { border-color: var(--tone); background: var(--tone-soft); }
.it .ic { width: 30px; height: 30px; display: grid; place-items: center; }
.it .tx { min-width: 0; }
.it small { display: block; color: var(--muted); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.it.own { grid-template-columns: 30px minmax(0, 1fr) 160px auto; }
.days small { color: var(--tone); display: block; }
.mini { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; }
.mini i { height: 7px; border-radius: 2px; background: #33231a1a; }
.mini i.on { background: #8a6be6; }
/* 中間：法陣、預覽、按鈕 */
/* 六芒星是背景：放大、淡淡的，壓在預覽與按鈕後面 */
.center { position: relative; }
.circle { position: relative; display: grid; place-items: center; height: 250px; }
.adult-hexa { position: absolute; left: 50%; top: 125px; width: 360px; height: 360px; transform: translate(-50%, -50%); opacity: 0.3; pointer-events: none; z-index: 0; }
.core { position: relative; z-index: 1; text-align: center; width: 120px; line-height: 1.25; }
.preview, .go { position: relative; z-index: 1; }
.core b { display: block; font-size: 13px; overflow-wrap: anywhere; }
.core span { font-size: 12px; color: var(--muted); }
.preview { background: #fffaf0aa; border: 1px solid #6c4bd155; border-radius: 4px; padding: 10px 12px; margin-top: 10px; }
.preview h4 { margin: 0 0 6px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12.5px; }
.two div { background: #33231a0a; border-radius: 4px; padding: 6px 8px; }
.two b { color: var(--tone); display: block; margin-bottom: 2px; font-size: 12px; }
.tiers { margin-top: 10px; }
.dbar { display: grid; grid-template-columns: repeat(10, 1fr); gap: 3px; margin-top: 4px; }
.dbar i { height: 12px; border-radius: 2px; background: #33231a1a; }
.marks { display: grid; grid-template-columns: repeat(10, 1fr); font-size: 10.5px; line-height: 1.25; color: var(--tone); margin-top: 3px; white-space: nowrap; }
.go { display: flex; justify-content: center; margin-top: 12px; }
.fuse-btn { background: linear-gradient(180deg, #8a6be6, #5a3cb8); color: #fff; border: 1px solid #5a3f22; padding: 5px 20px; letter-spacing: 0.12em; animation: fuse-glow 3.6s ease-in-out infinite; }
.fuse-btn:disabled { animation: none; opacity: 0.55; }
@keyframes fuse-glow { 0%, 100% { box-shadow: 0 0 4px #a77bff44; } 50% { box-shadow: 0 0 14px #a77bffaa; } }
@media (prefers-reduced-motion: reduce) { .fuse-btn { animation: none; } }
.note { margin: 10px 0 0; }

@media (max-width: 1000px) {
  .altar { grid-template-columns: minmax(0, 1fr); }
  .circle { height: 140px; }
  .adult-hexa { top: 70px; width: 300px; height: 300px; }
  .it.own { grid-template-columns: 30px minmax(0, 1fr) auto; }
  .it.own .days { grid-column: 2 / -1; }
  .note { margin-bottom: 24px; }
}
</style>
