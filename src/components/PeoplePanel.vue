<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { affinityStage } from '@/engine/character'
import { askingFor } from '@/engine/companions'
import { combatRules, genderName, raceName, tagDef } from '@/engine/data'
import { currentArea } from '@/engine/grid'
import { affinityTable, itemValue, type InteractionKind } from '@/engine/interactions'
import { CURRENCY, formatMoney } from '@/engine/money'
import { npcTitle } from '@/engine/npcs'
import { peopleHere, type PresentNpc } from '@/engine/population'
import type { NpcRecord } from '@/engine/types'
import { parseUse, useGame } from '@/stores/game'
import AbilityPicker from './AbilityPicker.vue'
import JudgeToggle from './JudgeToggle.vue'
import NameTag from './NameTag.vue'

// 這裡的人：和主角同一個地點、同一個地區的 NPC（見 docs/NPC_SYSTEM.md 第 7 節）
const game = useGame()
const s = computed(() => game.state!)
const people = computed(() => peopleHere(s.value))
const groups = computed(() => [
  { title: '🏪 店主與職員', items: people.value.filter((p) => p.staff) },
  { title: '⚔️ 冒險者', items: people.value.filter((p) => !p.staff && p.kind === 'adventurer') },
  { title: '🧺 普通人', items: people.value.filter((p) => !p.staff && p.kind === 'commoner') },
].filter((g) => g.items.length))
const where = computed(() => currentArea(s.value).name)
const busy = computed(() => !!s.value.pendingAction || game.judging)

// 換了地點：請 AI 潤飾這裡的居民（AI 判定開啟時，每個地點一次）
watch(() => s.value.location, () => void game.flavorRoster(), { immediate: true })

const open = ref<string | null>(null)
watch(people, (list) => {
  if (open.value && !list.some((p) => p.rec.id === open.value)) open.value = null
})

function rel(id: string) {
  return s.value.relationships?.[id]
}

function tagsOf(rec: NpcRecord) {
  return (rec.tags ?? []).map((t) => tagDef(t)).filter((t) => !!t)
}

// ---- 互動 ----
const text = reactive<Record<string, string>>({})
const gift = reactive<Record<string, string>>({})
const use = ref('')
const gifts = computed(() => s.value.inventory.filter((i) => i.qty > 0))

function interact(kind: InteractionKind, p: PresentNpc) {
  const id = p.rec.id
  const u = parseUse(use.value)
  void game.perform({
    kind, target: id, text: text[id] ?? '',
    ...(kind === 'gift' ? { item: gift[id] } : {}),
    ...(u ? { use: u } : {}),
  })
  text[id] = ''
  use.value = ''
}

function giftHint(rec: NpcRecord): string {
  const item = gift[rec.id]
  if (!item) return ''
  const t = affinityTable(s.value, 'gift', rec, item)
  return `價值 ${formatMoney(itemValue(s.value, item))}・成功時親密度 +${t.success}`
}

// ---- 雇用（只限冒險者） ----
const candidates = computed(() => {
  // 依存檔取得：雇用、還價、拒絕後即時更新
  const today = s.value.taverns?.[s.value.location]
  return today?.day === s.value.time.day ? today.candidates : []
})
const offers = reactive<Record<string, number>>({})
const hiring = ref<string | null>(null)
const partyFull = computed(() => s.value.party.length >= combatRules.party_max)

function candidateOf(id: string) {
  return candidates.value.find((c) => c.npc === id)
}

function startHire(id: string) {
  // 第一次查看時建立今天的候選名單
  if (!candidateOf(id)) game.tavernCandidates()
  const c = candidateOf(id)
  if (!c) return
  offers[id] ??= askingFor(c)
  hiring.value = hiring.value === id ? null : id
}

async function hire(id: string) {
  const c = candidateOf(id)
  if (!c) return
  await game.hire(id, Math.max(0, Math.floor(offers[id] ?? askingFor(c))), text[id] ?? '')
  hiring.value = null
}
</script>

<template>
  <section class="panel people">
    <div class="row head">
      <h3>👥 這裡的人 <span class="small muted">{{ where }}・{{ people.length }} 人</span></h3>
      <JudgeToggle />
    </div>
    <p v-if="!people.length" class="small muted">這裡現在沒有別人。</p>

    <div class="groups">
    <div v-for="g in groups" :key="g.title" class="group">
      <h4>{{ g.title }}</h4>
      <ul class="plain">
        <li v-for="p in g.items" :key="p.rec.id" :class="{ open: open === p.rec.id }">
          <div class="row line" @click="open = open === p.rec.id ? null : p.rec.id">
            <NameTag :id="p.rec.id" />
            <span class="small muted">{{ npcTitle(p.rec) }}</span>
            <span v-for="t in tagsOf(p.rec)" :key="t.name" class="tag small" :title="t.ai_hint">{{ t.emoji }}{{ t.name }}</span>
            <span v-if="rel(p.rec.id)" class="small known" :title="`親密度 ${rel(p.rec.id)!.affinity}`">💞 {{ affinityStage(rel(p.rec.id)!.affinity) }}</span>
          </div>

          <div v-if="open === p.rec.id" class="detail small">
            <div class="muted">{{ genderName(p.rec.gender) }}・{{ raceName(p.rec.race) }}・{{ npcTitle(p.rec) }} Lv.{{ p.rec.level }}</div>
            <div v-if="p.rec.appearance" class="muted">{{ p.rec.appearance }}</div>
            <div v-if="rel(p.rec.id)" class="muted">{{ p.rec.personality }}</div>
            <div v-if="rel(p.rec.id)?.toPlayer" class="muted">與你：{{ rel(p.rec.id)!.toPlayer }}</div>

            <template v-if="!p.rec.hostile">
              <input v-model="text[p.rec.id]" placeholder="想說什麼、怎麼做（選填，會交給 AI 判定）" />
              <AbilityPicker v-model="use" />
              <div class="row">
                <button class="small" :disabled="busy" title="魅力檢定：聊得好會拉近關係，也可能聽到消息" @click="interact('chat', p)">💬 聊天</button>
                <button class="small" :disabled="busy" title="魅力檢定：奉承、討好；失敗會降低親密度，對貴族更難" @click="interact('flatter', p)">🌹 獻媚</button>
                <button v-if="p.kind === 'adventurer' && !p.staff" class="small" :disabled="busy || partyFull" @click="startHire(p.rec.id)">
                  🤝 {{ hiring === p.rec.id ? '收起' : '雇用' }}
                </button>
              </div>
              <div class="row">
                <select v-model="gift[p.rec.id]" class="small">
                  <option :value="undefined">選擇禮物…</option>
                  <option v-for="i in gifts" :key="i.name" :value="i.name">{{ i.name }} ×{{ i.qty }}</option>
                </select>
                <button class="small" :disabled="busy || !gift[p.rec.id]" @click="interact('gift', p)">🎁 送禮</button>
                <span class="muted">{{ giftHint(p.rec) }}</span>
              </div>

              <div v-if="hiring === p.rec.id && candidateOf(p.rec.id)" class="hire">
                <span>要價 {{ formatMoney(askingFor(candidateOf(p.rec.id)!)) }}<template v-if="candidateOf(p.rec.id)!.counter_cc">（還價）</template></span>
                <span v-if="candidateOf(p.rec.id)!.declined" class="muted">今天不想再談了</span>
                <template v-else>
                  <label>出價（{{ CURRENCY.short }}）<input v-model.number="offers[p.rec.id]" type="number" min="0" step="5" /></label>
                  <button class="small primary" :disabled="(offers[p.rec.id] ?? 0) > s.money_cc || busy" @click="hire(p.rec.id)">
                    {{ (offers[p.rec.id] ?? 0) >= askingFor(candidateOf(p.rec.id)!) ? `雇用（${formatMoney(offers[p.rec.id] ?? 0)}）` : '提出條件（魅力檢定）' }}
                  </button>
                </template>
              </div>
            </template>
            <p v-else class="muted">{{ p.rec.name }}對你充滿敵意。</p>
          </div>
        </li>
      </ul>
    </div>
    </div>
    <p v-if="partyFull" class="small muted">隊伍已滿（{{ combatRules.party_max }} 人），不能再雇人。</p>
  </section>
</template>

<style scoped>
.people .head { justify-content: space-between; }
.people h3 { margin: 0; }
.groups { max-height: 460px; overflow-y: auto; padding-right: 4px; }
.group h4 { margin: 8px 0 2px; color: var(--accent-2); font-size: 0.9rem; }
.line { gap: 6px; cursor: pointer; }
.known { color: var(--accent); }
li.open { background: var(--panel-2); border-radius: 6px; padding: 6px; }
.detail { display: grid; gap: 4px; margin-top: 4px; }
.detail input, .detail select { min-width: 0; }
.detail > input { width: 100%; }
.hire { display: grid; gap: 4px; padding: 6px; border: 1px dashed var(--border); border-radius: 6px; }
.hire label { display: grid; gap: 2px; }
</style>
