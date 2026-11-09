<script setup lang="ts">
// 我的奴隸（工具列「奴隸」，主角擁有奴隸時才有）：一個一個看奴隸的親密度、順從、契約，
// 調教（成人向，課程格子＋進度），以及能對他做的事（送回家、角色詳情、解除契約……）。
// 留在房子裡的奴隸也列出來，但調教、送回家這類要在隊伍裡才能做的寫原因。
import { computed, ref, watch } from 'vue'
import { className, raceName, slaveryRules } from '@/engine/data'
import { homeLabel, homesHere, sendHomeRefusal } from '@/engine/away'
import { lewdOf } from '@/engine/lewd'
import { courseStatus, trainingBlocked } from '@/engine/ownerTraining'
import { ownedSlaves } from '@/engine/ownedSlaves'
import { jobHere, workers } from '@/engine/work'
import { useGame } from '@/stores/game'
import { contractFor } from './party/memberInfo'
import Avatar from './ui/Avatar.vue'
import GameIcon from './ui/GameIcon.vue'
import Hint from './ui/Hint.vue'

const props = defineProps<{ focus?: string }>()
const emit = defineEmits<{ close: []; detail: [id: string] }>()
const game = useGame()
const s = computed(() => game.state!)

const slaves = computed(() => ownedSlaves(s.value))
const picked = ref(props.focus ?? '')
watch(() => props.focus, (id) => { if (id) picked.value = id })
const cur = computed(() => slaves.value.find((x) => x.member.id === picked.value) ?? slaves.value[0])
const m = computed(() => cur.value?.member)

const affinity = computed(() => (m.value ? m.value.affinity ?? s.value.relationships?.[m.value.id]?.affinity ?? 0 : 0))
const submission = computed(() => (m.value ? lewdOf(m.value).submission : 0))
const affPos = (n: number) => `${Math.max(0, Math.min(100, (n + 100) / 2))}%`
const contract = computed(() => (m.value ? contractFor(m.value) : null))
const pct = (n: number) => `${Math.round(n * 100)}%`

// 調教：課程格子；不在隊伍裡時整塊寫原因
const courses = computed(() => (m.value ? courseStatus(m.value) : []))
const course = ref('serve')
const courseDef = computed(() => courses.value.find((c) => c.id === course.value))
const trainBlock = computed(() => {
  if (!m.value) return '沒有奴隸'
  if (!cur.value?.inParty) return `留在${cur.value?.where ?? '家裡'}，帶回隊伍才能調教`
  return trainingBlocked(s.value, m.value, course.value)
})
function train() {
  if (!m.value || trainBlock.value) return
  void game.startTraining(m.value.id, course.value)
  emit('close')
}

// 能對他做的事
const homes = computed(() => (m.value && cur.value?.inParty ? homesHere(s.value) : []))
const homeBlock = computed(() => (m.value && cur.value?.inParty ? sendHomeRefusal(s.value, m.value) : '已經在房子裡了'))
const job = computed(() => jobHere(s.value))
const canWorkHere = computed(() => !!job.value && !!m.value && !!cur.value?.inParty && workers(s.value).some((w) => w.id === m.value!.id))
function sendHome(homeId: string) {
  if (!m.value) return
  void game.sendHome(homeId, m.value.id)
}
function release() {
  if (!m.value) return
  if (!confirm(`解除${m.value.name}的契約，還他自由？他會變成自願同行。`)) return
  void game.releaseSlave(m.value.id)
}
</script>

<template>
  <p v-if="!slaves.length" class="muted">你沒有奴隸。</p>
  <template v-else-if="m">
    <nav class="pick" role="tablist">
      <button v-for="x in slaves" :key="x.member.id" role="tab" class="small" :class="{ on: x.member.id === m.id }" @click="picked = x.member.id">
        <span class="dot" :class="{ away: !x.inParty }" />{{ x.member.name }}<span v-if="!x.inParty" class="muted">（留在家裡）</span>
      </button>
    </nav>

    <div class="card">
      <div class="hero">
        <Avatar :id="m.id" :size="48" />
        <div class="who">
          <div class="mname">
            {{ m.name }}
            <span class="tag">{{ raceName(m.race) }}・{{ className(m.class) }} Lv.{{ m.level }}</span>
            <span class="where" :class="{ away: !cur?.inParty }">{{ cur?.inParty ? '在隊伍裡' : `留在${cur?.where}` }}</span>
          </div>
          <p v-if="m.personality" class="small muted line">{{ m.personality }}</p>
          <div class="meters">
            <div class="meter">
              <div class="lab small"><span>親密度 <Hint text="親密度很低時調教變難，失敗會留下怨恨。奴隸不會因為親密度低而離隊，也不能遣散。" /></span><b>{{ affinity }}</b></div>
              <div class="track aff"><span class="pin" :style="{ left: affPos(affinity) }" /></div>
            </div>
            <div class="meter">
              <div class="lab small"><span>順從 <Hint text="越順從，調教越容易成功；戴著印記的日子順從會慢慢上升。" /></span><b>{{ submission }}</b></div>
              <div class="track"><i :style="{ width: `${Math.max(0, Math.min(100, submission))}%` }" /></div>
            </div>
          </div>
        </div>
      </div>
      <details v-if="contract" class="fold">
        <summary>
          <b>{{ contract.def.name }}</b>
          <span class="chip">收益歸你 <b>{{ pct(contract.def.income_share) }}</b></span>
          <span class="chip">逃離 <b>DC {{ contract.def.escape_dc }}</b></span>
          <span class="chip">服從 <b>−{{ contract.obedience }}</b></span>
        </summary>
        <p class="small mark">{{ contract.def.mark }}</p>
        <ul class="plain small">
          <li v-for="f in contract.def.functions" :key="f" class="muted">{{ (slaveryRules.functions as Record<string, string>)[f] }}</li>
          <li v-for="e in contract.def.side_effects" :key="e" class="muted">副作用：{{ e }}</li>
        </ul>
        <div class="row chips">
          <span class="chip">談判 DC {{ contract.def.negotiate_dc }}</span>
          <span class="chip">出城 DC {{ contract.def.exit_dc }}</span>
        </div>
      </details>
    </div>

    <h4><GameIcon name="link" :size="14" /> 調教 <Hint text="成人向（docs/LEWD_STATS.md 第 9 節）。選一個課程，抽一件調教事件，由你選做法、擲檢定；奴隸越順從越容易，親密度很低時變難。成功時指標成長，同一課程成功幾次保證學會一個技能；親密度很低時失敗會留下怨恨。" /></h4>
    <div class="courses" :class="{ off: !cur?.inParty }">
      <button
        v-for="c in courses" :key="c.id" class="course" :class="{ on: c.id === course, done: !c.open.length }"
        :disabled="!cur?.inParty" @click="course = c.id"
      >
        <span class="n">{{ c.name }}<span class="muted">{{ c.open.length ? `${c.progress}/${c.need}` : '學完了' }}</span></span>
        <span class="pg"><i :style="{ width: `${c.open.length ? Math.min(100, (c.progress / c.need) * 100) : 100}%` }" /></span>
        <span class="sk small muted">{{ c.open.length ? `還能學：${c.open.join('、')}` : '技能都學會了' }}</span>
      </button>
    </div>
    <div class="start">
      <button class="primary" :disabled="!!trainBlock || game.judging" :title="trainBlock ?? ''" @click="train">開始調教：{{ courseDef?.name }}</button>
      <span class="small" :class="trainBlock ? 'warn' : 'muted'">{{ trainBlock ?? courseDef?.desc }}</span>
    </div>

    <h4><GameIcon name="user" :size="14" /> 能對他做的事</h4>
    <div class="acts">
      <div class="act" :class="{ off: !canWorkHere }">
        <span class="t"><GameIcon name="tools" :size="14" />派去工作</span>
        <span class="d small muted">{{ canWorkHere ? `這裡可以打工（${job?.name}）：在地點面板的「工作」選他去做；工錢全歸你。` : cur?.inParty ? '站在能打工的地方（店家、娼館……）時，在工作面板選他去做；工錢全歸你。' : '帶回隊伍才能派去工作。' }}</span>
      </div>
      <div class="act" :class="{ off: !!homeBlock }">
        <span class="t"><GameIcon name="home" :size="14" />送回家裡</span>
        <span class="d small muted">{{ homeBlock ?? '留在房子裡看家，騰出隊伍的位子；回到房子時再帶上。' }}</span>
        <span v-if="!homeBlock" class="row btns"><button v-for="h in homes" :key="h.id" class="small" :disabled="game.judging" @click="sendHome(h.id)">回「{{ homeLabel(h) }}」</button></span>
      </div>
      <div v-if="!cur?.inParty" class="act">
        <span class="t"><GameIcon name="users" :size="14" />帶回隊伍</span>
        <span class="d small muted">走進{{ cur?.where }}，在屋子面板帶他一起走。</span>
      </div>
      <button v-else class="act" @click="emit('detail', m.id)">
        <span class="t"><GameIcon name="star" :size="14" />角色詳情</span>
        <span class="d small muted">屬性、裝備、刺青與性經歷。</span>
      </button>
      <div class="act">
        <span class="t"><GameIcon name="heart" :size="14" />聊天、送禮</span>
        <span class="d small muted">在「這裡的人」和他互動；對自己的奴隸，你擲兩次取高。</span>
      </div>
      <button class="act danger" :disabled="!cur?.inParty || game.judging" :title="cur?.inParty ? '' : '帶回隊伍才能解除契約'" @click="release">
        <span class="t"><GameIcon name="unlock" :size="14" />解除契約</span>
        <span class="d small muted">還他自由，變成自願同行，親密度 +15。</span>
      </button>
    </div>
  </template>
</template>

<style scoped>
.pick { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.pick button { display: inline-flex; align-items: center; gap: 6px; }
.pick button.on { border-color: var(--accent); font-weight: 800; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--good); flex: none; }
.dot.away { background: var(--muted); }
.card { border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 12px; display: grid; gap: 8px; background: #00000008; }
.hero { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px 12px; align-items: start; }
.mname { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-weight: 800; }
.where { font-size: var(--fs-xs); font-weight: 400; padding: 0 6px; border-radius: 3px; color: var(--good); background: color-mix(in srgb, var(--good) 14%, transparent); }
.where.away { color: var(--muted); background: color-mix(in srgb, currentColor 8%, transparent); }
.line { margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
.meters { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-top: 6px; }
.meter .lab { display: flex; justify-content: space-between; align-items: center; }
.meter .lab > span { display: inline-flex; align-items: center; gap: 4px; }
.track { position: relative; height: 8px; margin-top: 3px; border-radius: 4px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); background: color-mix(in srgb, currentColor 8%, transparent); overflow: hidden; }
.track i { position: absolute; inset: 0 auto 0 0; background: var(--accent-2); }
.track.aff { overflow: visible; background: linear-gradient(90deg, color-mix(in srgb, var(--danger) 35%, transparent) 0 50%, color-mix(in srgb, var(--good) 30%, transparent) 50% 100%); }
.track .pin { position: absolute; top: -3px; width: 4px; height: 12px; margin-left: -2px; border-radius: 2px; background: currentColor; }
.fold { border-top: 1px dashed color-mix(in srgb, currentColor 20%, transparent); padding-top: 6px; }
.fold summary { cursor: pointer; list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: var(--fs-sm); }
.fold summary::-webkit-details-marker { display: none; }
.fold summary::before { content: '▸'; color: var(--accent); }
.fold[open] summary::before { content: '▾'; }
.chip { font-size: var(--fs-xs); padding: 1px 6px; border-radius: 3px; background: color-mix(in srgb, currentColor 8%, transparent); white-space: nowrap; }
.chips { gap: 4px; }
.mark { margin: 6px 0 2px; }
.plain { margin: 0; padding-left: 1.1em; }
h4 { display: flex; align-items: center; gap: 6px; margin: 14px 0 6px; font-size: 0.95rem; }
h4 :deep(.game-icon) { color: var(--accent); }
.courses { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.course { display: grid; gap: 3px; text-align: left; white-space: normal; padding: 6px 8px; height: auto; align-content: start; }
.course.on { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.course .n { display: flex; justify-content: space-between; font-weight: 800; }
.course .n .muted { font-weight: 400; font-size: var(--fs-xs); }
.course .pg { height: 5px; border-radius: 3px; background: color-mix(in srgb, currentColor 12%, transparent); overflow: hidden; }
.course .pg i { display: block; height: 100%; background: var(--accent); }
.course.done .pg i { background: var(--good); }
.course .sk { line-height: 1.4; }
.courses.off { opacity: 0.55; }
.start { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
.warn { color: var(--danger); }
.acts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.act { display: grid; gap: 2px; align-content: start; text-align: left; white-space: normal; padding: 7px 9px; height: auto; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: var(--radius); }
.act .t { display: flex; align-items: center; gap: 6px; font-weight: 800; }
.act .t :deep(.game-icon) { color: var(--accent-2); }
.act .d { line-height: 1.45; }
.act.off { opacity: 0.55; }
.act.danger .t, .act.danger .t :deep(.game-icon) { color: var(--danger); }
.btns { gap: 4px; flex-wrap: wrap; margin-top: 4px; }
@media (max-width: 560px) {
  .meters { grid-template-columns: minmax(0, 1fr); }
  .courses { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .acts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
