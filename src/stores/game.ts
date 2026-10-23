import { defineStore } from 'pinia'
import * as perkActions from '@/engine/perkActions'
import { pitchTarget } from '@/engine/perks'
import { computed, ref } from 'vue'
import * as actions from '@/engine/actions'
import * as combat from '@/engine/combat'
import * as companions from '@/engine/companions'
import * as rest from '@/engine/rest'
import * as trade from '@/engine/trade'
import * as negotiation from '@/engine/negotiation'
import * as inventory from '@/engine/inventory'
import * as meals from '@/engine/meals'
import { classes, slaveryRules, type ShopType } from '@/engine/data'
import { syncGear } from '@/engine/gear'
import { migrate, newGame, player } from '@/engine/state'
import * as grid from '@/engine/grid'
import * as masterHome from '@/engine/masterHome'
import * as population from '@/engine/population'
import * as encounters from '@/engine/encounters'
import * as security from '@/engine/security'
import * as slavery from '@/engine/slavery'
import * as defeat from '@/engine/defeat'
import * as social from '@/engine/social'
import * as story from '@/engine/story'
import { editProfile, spendAttrPoint, type ProfilePatch } from '@/engine/character'
import type { Attrs, AttrId } from '@/engine/data'
import type { NewGameOptions } from '@/engine/state'
import * as town from '@/engine/town'
import * as tattooShop from '@/engine/tattooShop'
import { markPromoted } from '@/engine/promoteNpc'
import * as road from '@/engine/road'
import * as homes from '@/engine/homes'
import * as garden from '@/engine/garden'
import * as invention from '@/engine/invention'
import type { DefeatLoot, GameState, GearSlot, Report, TattooPlace } from '@/engine/types'
import {
  buildNegotiationPrompt, buildRosterPrompt, buildShopPrompt, extractJson, splitSuggestions,
} from '@/narrator/judge'
import type { Prompt } from '@/narrator/prompt'
import { providerInfo, type ProviderId, type TokenUsage } from '@/narrator/providerInfo'
import type { ContentMods } from '@/engine/mods'
import { useContent, VANILLA, VANILLA_NAME, type WorldRef } from './content'
import { usePortraits } from './portraits'
import { usePrompts } from './prompts'
import { AI_FEATURES, useSettings, type AiFeature } from './settings'
import { archiveOldReports } from './logArchive'
import {
  AUTO_SLOTS, currentStore, parseSaveFile, QUICK_SLOT, saveFileName, slotMeta, slotStore, slotTitle, takePreloaded,
  type CurrentData, type SaveData, type SlotMeta,
} from './saves'

export { ARCHIVE_USAGE } from './logArchive'

/** 不屬於任何一則日誌的 AI 呼叫（酒館候選人、商店清單、談判方式、失敗的判定） */
export const OTHER_USAGE = '_other'

export interface UsageEntry {
  input: number
  output: number
  calls: number
  /** 輸入中讀取提示詞快取的部分 */
  cached?: number
  /** 依來源分開的用量（哪個功能、哪個模型來源、服務與模型）；舊紀錄沒有 */
  by?: UsagePart[]
}

/** 一次 AI 呼叫的來源：功能、模型來源的名稱、服務與模型 */
export interface UsageOrigin {
  feature: AiFeature
  source: string
  provider: ProviderId
  model: string
}

export interface UsagePart extends UsageOrigin {
  input: number
  output: number
  calls: number
  cached?: number
}

function sameOrigin(a: UsageOrigin, b: UsageOrigin): boolean {
  return a.feature === b.feature && a.source === b.source && a.provider === b.provider && a.model === b.model
}

/** 來源的顯示文字：「來源名（服務 模型）」；舊紀錄沒有記下來源 */
export function usageSourceLabel(o: Pick<UsageOrigin, 'source' | 'provider' | 'model'>): string {
  if (!o.provider) return '未記錄來源'
  const service = [providerInfo(o.provider)?.name, o.model].filter(Boolean).join(' ')
  return o.source ? `${o.source}（${service}）` : service
}

export function usageFeatureName(f: AiFeature): string {
  return AI_FEATURES.find((x) => x.id === f)?.name ?? f
}

function parseJson<T>(raw: string | undefined): T | null {
  try {
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 儲存失敗的原因（給玩家看） */
function saveFailure(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'QuotaExceededError') return '瀏覽器的儲存空間不足'
  return e instanceof Error ? e.message : String(e)
}

export interface NarrationState {
  text: string
  status: 'streaming' | 'done' | 'error'
  /** 玩家手動要求的（AI 細節描述關閉時也顯示） */
  manual?: boolean
  error?: string
  /** 寫敘事時模型的思考過程（服務有回傳時） */
  thinking?: string
  /** AI 判定時模型的思考過程 */
  judgeThinking?: string
  /** 只是為了存判定的思考過程，還沒有敘事 */
  placeholder?: boolean
}

export interface ImportPreview {
  meta: SlotMeta
  /** 存檔用的世界 */
  world?: WorldRef
  /** 首頁匯入時會用附帶的內容建立的新世界名稱 */
  newWorld?: string
  /** 遊戲中匯入、世界不同：不能匯入的原因 */
  blocked?: string
  portraits: number
}

/** 自訂內容的項目數 */
function modCount(m: ContentMods): number {
  return Object.values(m).reduce((n, v) => n + (v && typeof v === 'object' ? Object.keys(v).length : 0), 0)
}

/** 移動之後：附近有敵對的冒險者時開始對峙 */
function afterMove(s: GameState, r: grid.StepResult): grid.StepResult {
  if (r.combat || r.report) return r
  // 敵對的冒險者優先；被主人帶著時可能有主人的突發事件（等待回應，顯示在主動行動面板）
  const report = encounters.checkHostiles(s)
  if (report) return { report }
  // 戰敗時逃開的同伴：回到聚落或安全房時歸隊
  const back = companions.rejoinAway(s)
  if (back) return { report: back }
  // 旅途上主人的事件出發時就放在格子上了
  if (!s.road || s.side) slavery.maybeMasterEvent(s, slaveryRules.master_events.step_chance, { adult: useSettings().adult })
  return r
}

/** 讀入存檔：補上新欄位，舊存檔沒有格子位置時放到目前地點的入口。 */
function load(s: GameState): GameState {
  migrate(s)
  // 自訂內容刪掉的特殊任務：中斷，任務同行的夥伴離隊
  story.pruneStories(s)
  // 武器與防具類型由裝備決定（自訂內容可能改過底材）
  for (const m of s.party) if (m.gear) syncGear(m, classes[m.class]?.weapon)
  // 主人的家：先對齊格局（舊格局的樓層、超出範圍的座標改到一樓出口），再檢查位置
  masterHome.syncMasterHome(s)
  // 地圖改版後舊的區塊可能不存在了：回到這個地點的城門
  if (s.position) {
    try {
      grid.getArea(s, s.position.area)
    } catch {
      delete s.position
    }
  }
  if (!s.position) grid.enterLocation(s)
  population.ensureRoster(s, s.location)
  population.refreshRosters(s)
  return s
}

export const useGame = defineStore('game', () => {
  // 進行中的遊戲（自動保存的那一份）：啟動時只讀出來放著，在首頁按「繼續」才載入
  const boot = takePreloaded()
  const resume = ref<CurrentData | null>(boot.state ? boot : null)
  /** 「繼續」按鈕上的摘要（讀不了時 null） */
  const resumeMeta = computed<SlotMeta | null>(() => {
    if (!resume.value?.state) return null
    try {
      return slotMeta('current', '進行中的遊戲', 'auto', { state: JSON.parse(resume.value.state) as GameState })
    } catch {
      return null
    }
  })
  const state = ref<GameState | null>(null)
  const narrations = ref<Record<string, NarrationState>>({})
  /** token 用量：日誌 id（或 OTHER_USAGE）→ 累計 */
  const usage = ref<Record<string, UsageEntry>>({})
  const error = ref<string | null>(null)
  /** 有進行中的遊戲（已經載入，或還沒按「繼續」） */
  const hasProgress = computed(() => !!state.value || !!resume.value)
  /** 自動保存失敗：一直顯示到下一次保存成功 */
  const saveWarning = ref<string | null>(null)
  /** AI 正在判定主動行動 */
  const judging = ref(false)
  /** 行動備註：下一次委託或旅行時交給 AI 的玩家意圖 */
  const intent = ref('')
  /** 主動行動的對象（「這裡的人」可以直接帶入） */
  const actionTarget = ref('')
  /** 存檔欄位列表（新的在前） */
  const slots = ref<SlotMeta[]>([])
  /** 畫面上方短暫顯示的提示（例如「已快速存檔」） */
  const notice = ref<string | null>(null)
  /** 往過不去的方向移動的次數（地圖用來播放撞牆的動畫） */
  const bump = ref(0)
  /** 撞牆時的提示（「那邊走不過去」「旅途只能往前走」……） */
  const bumpText = ref('')
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  const controllers = new Map<string, AbortController>()

  const pc = computed(() => (state.value ? player(state.value) : null))

  // 自動保存：每次動作後把整份遊戲寫進 IndexedDB。寫入是非同步的，寫到一半又有新的動作時，
  // 只保留最新的一份，等這次寫完再寫
  let pendingWrite: CurrentData | null = null
  let writing: Promise<void> | null = null

  function save() {
    // 沒有進行中的遊戲（例如啟動時讀不了）：不要拿空的資料蓋掉原本的存檔
    if (!state.value) return
    const finished = Object.fromEntries(Object.entries(narrations.value).filter(([, n]) => n.status === 'done'))
    pendingWrite = {
      state: JSON.stringify(state.value),
      narrations: JSON.stringify(finished),
      usage: JSON.stringify(usage.value),
    }
    writing ??= flushSave()
  }

  async function flushSave() {
    try {
      while (pendingWrite) {
        const data = pendingWrite
        pendingWrite = null
        try {
          await currentStore().write(data)
          saveWarning.value = null
        } catch (e) {
          saveWarning.value = `自動保存失敗（${saveFailure(e)}）：重新整理或關掉頁面會失去最近的進度。請先用「💾 存讀檔」匯出存檔，或刪掉用不到的存檔欄位與形象圖再繼續。`
        }
      }
    } finally {
      writing = null
    }
  }

  /** 等目前的自動保存寫完（測試與讀檔前用） */
  async function flushed(): Promise<void> {
    while (writing) await writing
  }

  /** 執行引擎動作；錯誤訊息顯示在畫面上而不是丟出。 */
  function run<T>(fn: (s: GameState) => T, opts: { narrate?: boolean } = {}): T | undefined {
    if (!state.value) return undefined
    error.value = null
    try {
      const result = fn(state.value)
      // 日誌太長時把舊的封存（token 用量另外合計，見 logArchive.ts）
      archiveOldReports(state.value, useSettings().logKeepLimit(), narrations.value, usage.value)
      save()
      const settings = useSettings()
      const report = isReport(result) ? result : hasReport(result) ? result.report : undefined
      // 自動存檔：長休、抵達目的地
      if (report?.kind === 'rest' && report.outcome.tags?.includes('長休')) void autoSave('長休')
      if (report?.kind === 'travel' && report.outcome.result === 'arrived') void autoSave('抵達')
      if (opts.narrate !== false && report && settings.autoNarrates(report) && settings.ready(settings.narrationFeature(report))) {
        void narrate(report)
      }
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return undefined
    }
  }

  function isReport(x: unknown): x is Report {
    return typeof x === 'object' && x !== null && 'report_id' in x
  }

  /** 記下一次呼叫的用量：日誌（或「其他」）的合計，以及依來源分開的明細 */
  function addUsage(key: string, u: TokenUsage, origin: UsageOrigin) {
    const e = (usage.value[key] ??= { input: 0, output: 0, calls: 0 })
    e.input += u.input
    e.output += u.output
    e.calls += 1
    if (u.cached) e.cached = (e.cached ?? 0) + u.cached
    const by = (e.by ??= [])
    let part = by.find((x) => sameOrigin(x, origin))
    if (!part) by.push((part = { ...origin, input: 0, output: 0, calls: 0 }))
    part.input += u.input
    part.output += u.output
    part.calls += 1
    if (u.cached) part.cached = (part.cached ?? 0) + u.cached
  }

  /** 這個功能現在用的來源（記在用量明細上） */
  function originOf(feature: AiFeature, src: { name: string; provider: ProviderId; config: { model: string } }): UsageOrigin {
    return { feature, source: src.name, provider: src.provider, model: src.config.model || providerInfo(src.provider).defaultModel || '' }
  }

  /** 收集一次呼叫的用量；呼叫結束後再決定記在哪一則日誌 */
  function usageCollector(origin: UsageOrigin) {
    const got: TokenUsage[] = []
    return { onUsage: (u: TokenUsage) => got.push(u), flush: (key: string) => { for (const u of got.splice(0)) addUsage(key, u, origin) } }
  }

  /** 本局依來源（模型來源、服務與模型）合計的用量，舊紀錄沒有明細的歸在「未記錄來源」 */
  const usageBySource = computed(() => {
    const out: (Omit<UsagePart, 'feature'> & { features: AiFeature[] })[] = []
    for (const e of Object.values(usage.value)) {
      const parts: UsagePart[] = e.by?.length ? e.by : [{ feature: 'narration', source: '', provider: '' as ProviderId, model: '', input: e.input, output: e.output, calls: e.calls, ...(e.cached ? { cached: e.cached } : {}) }]
      for (const p of parts) {
        let t = out.find((x) => x.source === p.source && x.provider === p.provider && x.model === p.model)
        if (!t) out.push((t = { source: p.source, provider: p.provider, model: p.model, input: 0, output: 0, calls: 0, cached: 0, features: [] }))
        t.input += p.input
        t.output += p.output
        t.calls += p.calls
        t.cached = (t.cached ?? 0) + (p.cached ?? 0)
        if (e.by?.length && !t.features.includes(p.feature)) t.features.push(p.feature)
      }
    }
    return out.sort((a, b) => b.input + b.output - (a.input + a.output))
  })

  const totalUsage = computed(() =>
    Object.values(usage.value).reduce<Required<Omit<UsageEntry, 'by'>>>(
      (t, e) => ({ input: t.input + e.input, output: t.output + e.output, calls: t.calls + e.calls, cached: t.cached + (e.cached ?? 0) }),
      { input: 0, output: 0, calls: 0, cached: 0 },
    ),
  )

  // ---- 存檔欄位 ----

  function flash(text: string) {
    notice.value = text
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice.value = null), 2500)
  }

  /** 目前的遊戲；存檔欄位與匯出的檔案也附上當時的自訂內容（沒有自訂內容時不附） */
  function snapshot(): SaveData | null {
    if (!state.value) return null
    const finished = Object.fromEntries(Object.entries(narrations.value).filter(([, n]) => n.status === 'done'))
    const content = currentContent()
    return JSON.parse(JSON.stringify({ state: state.value, narrations: finished, usage: usage.value, ...(content ? { content } : {}) })) as SaveData
  }

  function currentContent(): ContentMods | undefined {
    const mods = useContent().mods
    return modCount(mods) ? (JSON.parse(JSON.stringify(mods)) as ContentMods) : undefined
  }

  /** 清掉沒有任何存檔（含進行中的遊戲）用到的形象圖；讀不到存檔列表時不清 */
  async function prunePortraits(): Promise<number> {
    try {
      const seeds = new Set<number>()
      if (state.value) seeds.add(state.value.seed)
      for (const m of await slotStore().list()) {
        const seed = m.seed ?? (await slotStore().get(m.id))?.state.seed
        if (seed !== undefined) seeds.add(seed)
      }
      return await usePortraits().pruneExcept(seeds)
    } catch {
      return 0
    }
  }

  async function refreshSlots() {
    try {
      slots.value = (await slotStore().list()).sort((a, b) => b.savedAt - a.savedAt)
    } catch (e) {
      error.value = `讀取存檔列表失敗：${e instanceof Error ? e.message : String(e)}`
    }
  }

  async function writeSlot(id: string, name: string, kind: SlotMeta['kind'], given?: SaveData) {
    const data = given ?? snapshot()
    if (!data) throw new Error('沒有進行中的遊戲')
    await slotStore().put(slotMeta(id, name, kind, data), data)
    await refreshSlots()
    // 覆寫掉的欄位可能是某一局唯一的存檔
    void prunePortraits()
  }

  /** 手動存檔：給 id 時覆寫那個欄位 */
  async function saveToSlot(name: string, id?: string) {
    try {
      const data = snapshot()
      if (!data) return
      const meta = slots.value.find((m) => m.id === id)
      await writeSlot(id ?? `m-${Date.now().toString(36)}`, name.trim() || meta?.name || slotTitle(slotMeta('', '', 'manual', data)), 'manual')
      flash('💾 已存檔')
    } catch (e) {
      error.value = `存檔失敗：${e instanceof Error ? e.message : String(e)}`
    }
  }

  async function quickSave() {
    try {
      await writeSlot(QUICK_SLOT, '快速存檔', 'quick')
      flash('⚡ 已快速存檔')
    } catch (e) {
      error.value = `快速存檔失敗：${e instanceof Error ? e.message : String(e)}`
    }
  }

  /** 自動存檔：在長休、抵達目的地、讀檔前保存，循環使用 AUTO_SLOTS 個欄位 */
  async function autoSave(reason: string, given?: SaveData) {
    if (!state.value && !given) return
    let n = 0
    try {
      n = (Number(localStorage.getItem('elondia.autoIndex') ?? 0) + 1) % AUTO_SLOTS
      localStorage.setItem('elondia.autoIndex', String(n))
    } catch {
      // 無痕模式等情況下照樣存在第 0 格
    }
    try {
      await writeSlot(`auto-${n}`, `自動存檔（${reason}）`, 'auto', given)
    } catch {
      // 自動存檔失敗不打斷遊戲
    }
  }

  /** 還沒按「繼續」的遊戲要被蓋掉前：先存進自動存檔欄位（不用載入） */
  async function backupResume(reason: string) {
    const r = resume.value
    resume.value = null
    if (!r?.state) return
    try {
      await autoSave(reason, { state: JSON.parse(r.state) as GameState, narrations: parseJson(r.narrations) ?? {}, usage: parseJson(r.usage) ?? {} })
    } catch {
      // 備份失敗不擋住開新遊戲或讀檔
    }
  }

  /** 載入一份遊戲：先切到它的世界，再補上新欄位 */
  function enter(data: SaveData) {
    for (const c of controllers.values()) c.abort()
    const world = useContent().enterWorld(data.state.world, data.content)
    state.value = load(data.state)
    state.value.world = { id: world.id, name: world.name }
    narrations.value = (data.narrations ?? {}) as Record<string, NarrationState>
    usage.value = (data.usage ?? {}) as Record<string, UsageEntry>
    error.value = null
    if (world.note) flash(world.note)
    save()
  }

  function applySnapshot(data: SaveData) {
    enter(data)
  }

  /** 首頁的「繼續」：載入進行中的遊戲 */
  function continueGame(): boolean {
    const r = resume.value
    if (!r?.state) return false
    try {
      enter({ state: JSON.parse(r.state) as GameState, narrations: parseJson(r.narrations) ?? {}, usage: parseJson(r.usage) ?? {} })
      resume.value = null
      return true
    } catch (e) {
      // 讀不了（例如來自比較新的版本）：不要蓋掉它，說明原因
      state.value = null
      error.value = `讀取進行中的遊戲失敗：${e instanceof Error ? e.message : String(e)}（開新遊戲或讀取存檔會蓋掉它，蓋掉前會先存一份到自動存檔）`
      return false
    }
  }

  /** 回到首頁：存好進度，之後按「繼續」再載入 */
  async function toHome() {
    if (!state.value) return
    for (const c of controllers.values()) c.abort()
    save()
    await flushed()
    const finished = Object.fromEntries(Object.entries(narrations.value).filter(([, n]) => n.status === 'done'))
    resume.value = { state: JSON.stringify(state.value), narrations: JSON.stringify(finished), usage: JSON.stringify(usage.value) }
    state.value = null
    narrations.value = {}
    usage.value = {}
    error.value = null
  }

  /** 讀檔：先把目前的進度自動存一份，免得誤讀 */
  async function loadSlot(id: string) {
    try {
      const data = await slotStore().get(id)
      if (!data) throw new Error('找不到這個存檔')
      if (state.value) await autoSave('讀檔前')
      await backupResume('讀檔前')
      applySnapshot(data)
      flash('📂 已讀取存檔')
    } catch (e) {
      error.value = `讀檔失敗：${e instanceof Error ? e.message : String(e)}`
    }
  }

  async function quickLoad() {
    if (!slots.value.length) await refreshSlots()
    if (!slots.value.some((m) => m.id === QUICK_SLOT)) {
      flash('還沒有快速存檔')
      return
    }
    await loadSlot(QUICK_SLOT)
  }

  async function deleteSlot(id: string) {
    await slotStore().remove(id)
    await refreshSlots()
    const n = await prunePortraits()
    if (n) flash(`🗑️ 已刪除存檔，並清掉 ${n} 張沒有存檔用到的形象圖`)
  }

  async function renameSlot(id: string, name: string) {
    await slotStore().rename(id, name.trim())
    await refreshSlots()
  }

  /**
   * 匯出成檔案：回傳檔名與內容（目前的遊戲或某個欄位）。
   * 記下存檔用的世界（id 與名字）；附上那個世界的自訂內容（欄位存檔時的；舊的欄位沒有時用這個瀏覽器裡那個世界的），
   * 原版世界的存檔不附內容。可以選擇附上這一局的形象圖
   */
  async function exportFile(id?: string, opts: { content?: boolean; portraits?: boolean } = {}): Promise<{ name: string; text: string } | null> {
    const data = id ? await slotStore().get(id) : snapshot()
    if (!data) return null
    const content = useContent()
    const world = data.state.world
    if (world?.id === VANILLA) {
      // 原版世界：標明是原版，不附任何自訂內容
      data.state.world = { id: VANILLA, name: VANILLA_NAME }
      delete data.content
    } else if (opts.content === false) delete data.content
    else if (!data.content && world) {
      const w = content.worlds.find((x) => x.id === world.id)
      if (w && modCount(w.mods)) data.content = JSON.parse(JSON.stringify(w.mods)) as ContentMods
    }
    if (world && world.id !== VANILLA) data.state.world = { id: world.id, name: content.worlds.find((x) => x.id === world.id)?.name ?? world.name }
    delete data.portraits
    if (opts.portraits) {
      const portraits = await usePortraits().exportFor(data.state.seed)
      if (Object.keys(portraits).length) data.portraits = portraits
    }
    return { name: saveFileName(slotMeta('', '', 'manual', data)), text: JSON.stringify(data, null, 2) }
  }

  /** 遊戲中只能匯入同一個世界的存檔（不同的世界要回首頁匯入）；可以時回傳 undefined */
  function importBlocked(data: SaveData): string | undefined {
    if (!state.value) return undefined
    const content = useContent()
    const want = data.state.world?.id ?? content.active
    if (want === content.active) return undefined
    return `這個存檔用的世界「${data.state.world?.name ?? want}」和目前的世界「${content.activeName}」不同，請回首頁匯入`
  }

  /** 匯入前的檢查：存檔摘要、用的世界（首頁匯入時會不會建立新的世界）、遊戲中能不能匯入、附上幾張形象圖 */
  function previewImport(text: string, fileName = '匯入的存檔'): ImportPreview {
    const data = parseSaveFile(text)
    const blocked = importBlocked(data)
    const plan = state.value ? {} : useContent().worldForImport(data.state.world, data.content, true)
    return {
      meta: slotMeta('', fileName.replace(/\.json$/i, ''), 'manual', data),
      ...(data.state.world ? { world: data.state.world } : {}),
      ...(plan.created ? { newWorld: plan.created } : {}),
      ...(blocked ? { blocked } : {}),
      portraits: Object.keys(data.portraits ?? {}).length,
    }
  }

  /**
   * 匯入檔案：存成一個新的手動存檔欄位（不會直接讀取）。
   * 遊戲中只能匯入同一個世界的存檔；首頁匯入時，附了自訂內容而且世界不同（或不存在）時，用附帶的內容建立新的世界。
   * portraits：還原附上的形象圖
   */
  async function importFile(text: string, fileName = '匯入的存檔', opts: { portraits?: boolean } = {}) {
    try {
      const data = parseSaveFile(text)
      const blocked = importBlocked(data)
      if (blocked) throw new Error(blocked)
      const portraits = data.portraits
      delete data.portraits
      const notes: string[] = []
      if (!state.value) {
        const plan = useContent().worldForImport(data.state.world, data.content)
        if (plan.ref && (plan.created || plan.reused)) {
          data.state.world = plan.ref
          notes.push(plan.created ? `用存檔附帶的自訂內容建立了世界「${plan.created}」` : `存檔附帶的自訂內容和世界「${plan.reused}」相同，改用這個世界`)
        }
      }
      const meta = slotMeta(`m-${Date.now().toString(36)}`, fileName.replace(/\.json$/i, ''), 'manual', data)
      await slotStore().put(meta, data)
      // 先有存檔欄位再還原圖片，清理孤兒圖片時才不會被刪掉
      if (opts.portraits && portraits) {
        const n = await usePortraits().importFor(data.state.seed, portraits)
        if (n) notes.push(`還原 ${n} 張形象圖`)
      }
      await refreshSlots()
      flash(`📥 已匯入${notes.length ? `（${notes.join('，')}）` : ''}，可以在存檔列表讀取`)
    } catch (e) {
      error.value = `匯入失敗：${e instanceof Error ? e.message : String(e)}`
    }
  }

  function hasReport(x: unknown): x is { report: Report } {
    return typeof x === 'object' && x !== null && 'report' in x && isReport((x as { report: unknown }).report)
  }

  /** 開新遊戲；world：用哪個世界（不給時用目前的） */
  function start(name: string, race: string, classId: string, bonus?: Partial<Attrs>, profile: Omit<NewGameOptions, 'name' | 'race' | 'classId' | 'bonus' | 'seed'> = {}, world?: string) {
    const content = useContent()
    if (world !== undefined && world !== content.active) content.switchWorld(world)
    // 還沒繼續的遊戲會被蓋掉：先備份
    void backupResume('開新遊戲前')
    state.value = newGame({ name, race, classId, ...(bonus ? { bonus } : {}), ...profile })
    state.value.world = { id: content.active, name: content.activeName }
    grid.enterLocation(state.value)
    population.ensureRoster(state.value, state.value.location)
    if (profile.slave) slavery.startAsSlave(state.value, profile.slave)
    narrations.value = {}
    usage.value = {}
    error.value = null
    save()
    // 上一局沒有存檔的話，它的形象圖就用不到了
    void prunePortraits()
  }

  function reset() {
    for (const c of controllers.values()) c.abort()
    state.value = null
    resume.value = null
    narrations.value = {}
    usage.value = {}
    pendingWrite = null
    void (async () => {
      await flushed()
      try {
        await currentStore().clear()
        saveWarning.value = null
      } catch (e) {
        saveWarning.value = `清除進行中的遊戲失敗（${saveFailure(e)}）`
      }
    })()
  }



  // 世界書、繁簡轉換字典與各家 SDK 都很大，用到時才載入
  async function composeFor(report: Report) {
    const [{ composeNarration }, opts] = await Promise.all([import('@/narrator/compose'), usePrompts().composeOptions()])
    return composeNarration(state.value, report, opts)
  }

  async function promptFor(report: Report): Promise<Prompt> {
    return (await composeFor(report)).prompt
  }

  /** 判定請求的提示詞；沒有等待中的行動時用一個範例行動（在複製的狀態上擲骰，不影響遊戲） */
  async function composeJudgePreview(text = '（預覽用的範例行動）') {
    const s = state.value
    if (!s) return null
    let st = s
    let pending = s.pendingAction
    if (!pending) {
      if (s.combat) return null
      st = JSON.parse(JSON.stringify(s)) as GameState
      try {
        pending = actions.prepareAction(st, { kind: 'free', text })
      } catch {
        return null
      }
    }
    const [{ composeJudge }, opts] = await Promise.all([import('@/narrator/compose'), usePrompts().composeOptions()])
    return { ...composeJudge(st, pending, opts), sample: !s.pendingAction }
  }

  /** 請「敘事正文」（帶親密場景時是「成人場景正文」）的模型寫出這則日誌的經過。manual：玩家在日誌上手動要求（AI 細節描述關閉時也顯示） */
  async function narrate(report: Report, opts: { manual?: boolean } = {}) {
    const settings = useSettings()
    controllers.get(report.report_id)?.abort()
    const controller = new AbortController()
    controllers.set(report.report_id, controller)
    // 判定時的思考過程留著
    const judgeThinking = narrations.value[report.report_id]?.judgeThinking
    narrations.value[report.report_id] = { text: '', status: 'streaming', ...(opts.manual ? { manual: true } : {}), ...(judgeThinking ? { judgeThinking } : {}) }
    const entry = narrations.value[report.report_id]!
    try {
      const prompt = await promptFor(report)
      const { streamNarration } = await import('@/narrator/providers')
      const feature = settings.narrationFeature(report)
      const src = settings.sourceFor(feature)
      const onUsage = (u: TokenUsage) => addUsage(report.report_id, u, originOf(feature, src))
      const onThinking = (t: string) => { entry.thinking = (entry.thinking ?? '') + t }
      for await (const chunk of streamNarration(src.provider, src.config, prompt, controller.signal, onUsage, onThinking)) {
        entry.text += chunk
      }
      // 正文後面的人際關係更新提議：取出來等玩家確認
      const { text, updates } = splitSuggestions(entry.text)
      entry.text = text
      if (state.value && updates.length) social.addSuggestions(state.value, updates, report.report_id)
      entry.status = 'done'
      save()
    } catch (e) {
      entry.status = 'error'
      entry.error = controller.signal.aborted ? '已取消' : e instanceof Error ? e.message : String(e)
    } finally {
      controllers.delete(report.report_id)
    }
  }

  function cancelNarration(reportId: string) {
    controllers.get(reportId)?.abort()
  }

  // ---- 主動行動：程式擲骰，AI 看骰值判定（或依規則） ----

  async function perform(input: actions.ActionInput) {
    const pending = run((s) => actions.prepareAction(s, input))
    if (pending) await judge()
  }

  /** 判定等待中的行動。useAI 未指定時依設定。AI 失敗時保留行動，可以重試或改用規則。 */
  async function judge(useAI?: boolean) {
    const s = state.value
    const pending = s?.pendingAction
    if (!s || !pending || judging.value) return
    const settings = useSettings()
    const ai = useAI ?? (settings.aiJudge && settings.ready('judge'))
    if (!ai) {
      run((st) => actions.resolveAction(st, null))
      return
    }
    judging.value = true
    error.value = null
    const src = settings.sourceFor('judge')
    const collector = usageCollector(originOf('judge', src))
    try {
      const { completeText } = await import('@/narrator/providers')
      const [{ composeJudge }, opts] = await Promise.all([import('@/narrator/compose'), usePrompts().composeOptions()])
      let thinking = ''
      const text = await completeText(src.provider, src.config, composeJudge(s, pending, opts).prompt, undefined, collector.onUsage, (t) => { thinking += t })
      const judgment = actions.sanitizeJudgment(s, pending, extractJson(text))
      // 分開時就算判定的模型寫了經過也不採用，交給寫作的模型
      if (opts.splitNarrative) delete judgment.narrative
      // 預設：判定只回傳 JSON，經過交給「敘事正文」依報告撰寫（和其他日誌一樣）。
      // 勾選「判定時順便寫出經過」而且同一個來源時，直接採用判定寫的經過，省一次呼叫。
      const report = run((st) => actions.resolveAction(st, judgment), { narrate: !judgment.narrative })
      collector.flush(report?.report_id ?? OTHER_USAGE)
      // 判定寫了經過，結果卻是親密場景、而「成人場景正文」用另一個來源：不採用，交給那個來源重寫
      const rewrite = !!report && !!judgment.narrative && settings.narrationFeature(report) === 'adult' && settings.sourceIndex('adult') !== settings.sourceIndex('judge')
      if (report && rewrite) {
        if (settings.autoNarrates(report) && settings.ready('adult')) void narrate(report)
      } else if (report && judgment.narrative) narrations.value[report.report_id] = { text: judgment.narrative, status: 'done' }
      // 判定的思考過程：記在這則日誌（還沒有敘事時先放一個空的）
      if (report && thinking.trim()) {
        const entry = narrations.value[report.report_id]
        if (entry) entry.judgeThinking = thinking.trim()
        else narrations.value[report.report_id] = { text: '', status: 'done', placeholder: true, judgeThinking: thinking.trim() }
      }
      save()
    } catch (e) {
      collector.flush(OTHER_USAGE)
      error.value = `AI 判定失敗：${e instanceof Error ? e.message : String(e)}（可以重試，或改用規則判定）`
    } finally {
      judging.value = false
    }
  }

  /** 地點的名單：AI 開啟時請 AI 潤飾名字、外貌、性格與背景（每個人一次；到了這裡才潤飾還沒潤飾過的人） */
  async function flavorRoster() {
    const s = state.value
    const settings = useSettings()
    if (!s || !settings.aiJudge || !settings.ready('roster')) return
    const loc = s.location
    const roster = s.rosters?.[loc]
    if (!roster || flavoring.has(loc)) return
    // 還沒潤飾過的人（第一次來，或名單變動搬來了新居民）
    const prompt = buildRosterPrompt(s, loc)
    if (!prompt) return
    const sent = population.unflavored(s, loc).map((r) => r.id)
    flavoring.add(loc)
    try {
      const { completeText } = await import('@/narrator/providers')
      const src = settings.sourceFor('roster')
      const raw = extractJson(await completeText(src.provider, src.config, prompt, undefined, (u) => addUsage(OTHER_USAGE, u, originOf('roster', src)))) as { npcs?: population.NpcFlavor[] }
      run((st) => population.applyRosterFlavor(st, loc, Array.isArray(raw.npcs) ? raw.npcs : [], sent))
    } catch (e) {
      error.value = `AI 潤飾居民失敗：${e instanceof Error ? e.message : String(e)}（先用預設的名字與設定）`
    } finally {
      flavoring.delete(loc)
    }
  }
  const flavoring = new Set<string>()

  /** 商店：AI 開啟時請 AI 生成今天的交易清單（每間店每天一次，失敗時保留規則清單） */
  async function flavorShop(type: ShopType) {
    const s = state.value
    const settings = useSettings()
    if (!s || !settings.aiJudge || !settings.ready('shop')) return
    const shop = trade.shopState(s, type)
    if (shop.aiTried || shop.source === 'ai') return
    shop.aiTried = true
    save()
    try {
      const { completeText } = await import('@/narrator/providers')
      const src = settings.sourceFor('shop')
      const raw = extractJson(await completeText(src.provider, src.config, buildShopPrompt(s, type), undefined, (u) => addUsage(OTHER_USAGE, u, originOf('shop', src))))
      run((st) => trade.applyAiDeals(st, type, raw))
    } catch (e) {
      error.value = `AI 生成交易清單失敗：${e instanceof Error ? e.message : String(e)}（先用一般的商品清單）`
    }
  }

  /** 開始談判；AI 開啟時請 AI 依對象與情境生成談判方式 */
  async function startNegotiation(template: string, ctx: negotiation.NegotiationContext) {
    const n = run((s) => negotiation.startNegotiation(s, template, ctx))
    const s = state.value
    const settings = useSettings()
    if (!n || !s || n.ai || !settings.aiJudge || !settings.ready('negotiation')) return n
    n.ai = true
    try {
      const { completeText } = await import('@/narrator/providers')
      const src = settings.sourceFor('negotiation')
      const raw = extractJson(await completeText(src.provider, src.config, buildNegotiationPrompt(s, n), undefined, (u) => addUsage(OTHER_USAGE, u, originOf('negotiation', src))))
      run((st) => negotiation.applyAiOptions(st, n.id, raw))
    } catch (e) {
      error.value = `AI 生成談判方式失敗：${e instanceof Error ? e.message : String(e)}（先用預設的談判方式）`
    }
    return n
  }

  function hire(npcId: string, offer: number, text: string) {
    const s = state.value
    if (!s) return
    const c = s.taverns?.[s.location]?.candidates.find((x) => x.npc === npcId)
    if (c && offer >= companions.askingFor(c)) return run((st) => companions.hireAtAsking(st, npcId, offer))
    return perform({ kind: 'hire', target: npcId, offer_cc: offer, text })
  }

  return {
    state, narrations, error, saveWarning, flushed, pc, resumeMeta, hasProgress, continueGame, toHome, judging, intent, actionTarget, usage, totalUsage, usageBySource, slots, notice, flash, bump, bumpText,
    usageCollector, originOf,
    refreshSlots, saveToSlot, quickSave, quickLoad, loadSlot, deleteSlot, renameSlot, exportFile, previewImport, importFile, prunePortraits,
    start, reset, promptFor, composeFor, composeJudgePreview, narrate, cancelNarration,
    perform, judge, flavorRoster, hire, flavorShop, startNegotiation,
    // 商店、談判、行囊
    shopState: (type: ShopType) => run((s) => trade.shopState(s, type)),
    buyDeal: (type: ShopType, id: string, qty = 1) => run((s) => trade.buyDeal(s, type, id, qty)),
    sellItem: (type: ShopType, name: string, qty: number) => run((s) => trade.sellItem(s, type, name, qty)),
    bargain: (type: ShopType, dealId: string, text: string) => perform({ kind: 'bargain', target: trade.bargainTarget(type, dealId), text }),
    chooseOption: (id: string, option: string) => run((s) => negotiation.chooseOption(s, id, option)),
    negotiateFreely: (id: string, text: string, use?: { member: string; ability: string }) =>
      perform({ kind: 'negotiation', target: id, text, ...(use ? { use } : {}) }),
    abandonNegotiation: (id: string) => run((s) => negotiation.abandonNegotiation(s, id)),
    useItem: (name: string, member: string) => run((s) => inventory.useItem(s, name, member)),
    readIntel: (name: string) => run((s) => inventory.readIntelItem(s, name)),
    eatMeal: (id: string) => run((s) => meals.eatMeal(s, id)),
    equipItem: (name: string, member: string, slot?: GearSlot) => run((s) => inventory.equipItem(s, name, member, slot)),
    unequipItem: (member: string, slot: GearSlot) => run((s) => inventory.unequipItem(s, member, slot)),
    editProfile: (patch: ProfilePatch) => run((s) => editProfile(player(s), patch)),
    // 旅行：畫出旅途的單行道，一格一天往前走（road.ts）
    travel: (to: string, intent?: string) => run((s) => road.startJourney(s, to, intent, { adult: useSettings().adult })),
    /** 一路往前走，遇到事件、戰鬥或抵達時停下 */
    walkRoad: () => run((s) => {
      for (let i = 0; i < 80; i++) {
        if (!s.road || s.side || s.roadEvent || s.combat || s.pendingMasterEvent || s.standoff || s.pendingAction) return {}
        const r = afterMove(s, grid.move(s, 1, 0))
        if (r.report || r.combat || s.roadEvent || s.pendingMasterEvent) return r
      }
      return {}
    }),
    answerRoadEvent: (i: number) => run((s) => road.answerRoadEvent(s, i)),
    leaveSide: () => run((s) => road.leaveSide(s)),
    rest: () => run(town.rest),
    shortRest: (spend?: Record<string, number>) => run((s) => rest.shortRest(s, spend)),
    /** 長休；有寫互動內容時，長休後接著進行「長休時的互動」（主動行動） */
    longRest: async (place: rest.RestPlace, talk?: { text: string; target?: string }) => {
      const withTalk = !!talk?.text.trim()
      // 有互動時，長休本身不另外寫敘事：和互動合成一段（互動的報告會帶上長休的經過）
      const report = run((s) => rest.longRest(s, place), { narrate: !withTalk })
      if (report && withTalk) await perform({ kind: 'rest_talk', text: talk!.text, ...(talk!.target ? { target: talk!.target } : {}) })
      return report
    },
    abandonQuest: (id: string) => run((s) => town.abandonQuest(s, id)),
    buyRations: (qty: number) => run((s) => town.buyRations(s, qty)),
    recruit: (id: string) => run((s) => town.recruit(s, id)),
    dismiss: (id: string) => run((s) => town.dismiss(s, id)),
    visitGuild: () => run(town.guildQuests) ?? [],
    acceptQuest: (id: string) => run((s) => town.acceptQuest(s, id)),
    turnInQuest: (id: string, count?: number) => run((s) => town.turnInQuest(s, id, count)),
    templeHeal: () => run(town.templeHeal),
    /** 把生成的人存成固定 NPC（存進目前的世界） */
    promoteNpc: (id: string) => run((s) => {
      useContent().promoteNpc(s, id)
      markPromoted(s, id)
    }),
    inkTattoo: (order: tattooShop.InkOrder) => run((s) => tattooShop.inkTattoo(s, order)),
    washTattoo: (place: TattooPlace) => run((s) => tattooShop.washTattoo(s, place)),
    chooseAbility: (member: string, ability: string) => run((s) => town.chooseAbility(s, member, ability)),
    rerollAbility: (member: string) => run((s) => town.rerollAbility(s, member, useSettings().rerollLimit())),
    spendAttr: (member: string, attr: AttrId) =>
      run((s) => spendAttrPoint(s.party.find((m) => m.id === member)!, attr)),
    doTownQuest: (id: string, intent?: string) => run((s) => town.doTownQuest(s, id, intent)),
    // 特殊任務：接下、進行沒有檢定的任務點（劇情、選項、戰鬥）、放棄；有檢定的走 perform({ kind: 'story' })
    startStory: (id: string) => run((s) => story.startStory(s, id)),
    playStoryNode: (ref: string, option?: number, intent?: string) => run((s) => story.playNode(s, ref, option, intent)),
    abandonStory: (id: string) => run((s) => story.abandonStory(s, id)),
    act: (action: combat.CombatAction) => run((s) => combat.act(s, action)),
    finishCombat: () =>
      run((s) => {
        const report = combat.finishCombat(s)
        grid.afterCombat(s, report)
        return report
      }),
    // 走格子
    moveTo: (x: number, y: number) => run((s) => afterMove(s, grid.moveTo(s, x, y))),
    pickLock: (method: grid.LockMethod) => run((s) => grid.pickLock(s, method)),
    move: (dx: number, dy: number) => {
      // 撞牆不算錯誤：地圖上輕輕晃一下就好（不跳出錯誤訊息、不推動版面）
      const blocked = state.value && !state.value.combat ? grid.blockedMove(state.value, dx, dy) : null
      if (blocked) {
        bumpText.value = blocked
        bump.value++
        return undefined
      }
      return run((s) => afterMove(s, grid.move(s, dx, dy)))
    },
    goOutskirts: () => run((s) => grid.goOutskirts(s) ?? encounters.checkHostiles(s)),
    returnToTown: () => run(grid.returnToTown),
    // 房子（homes.ts）
    buyHome: (lotId: string, name?: string) => run((s) => homes.buyHome(s, lotId, name)),
    renameHome: (id: string, name: string) => run((s) => homes.renameHome(s, id, name)),
    placeFurniture: (name: string) => run((s) => {
      const p = grid.position(s)
      homes.placeFurniture(s, grid.currentArea(s), p.x, p.y, name)
    }),
    takeFurniture: () => run((s) => {
      const p = grid.position(s)
      homes.takeFurniture(s, grid.currentArea(s), p.x, p.y)
    }),
    stayHome: (id: string) => run((s) => homes.stayHome(s, grid.currentArea(s), id)),
    takeResident: (id: string) => run((s) => homes.leaveWithResident(s, grid.currentArea(s), id)),
    /** 忘記自創的配方（invention.ts） */
    // 特質：從機會選一個、放棄、寫說法交給 AI、受訓（docs/PERKS.md）
    learnPerk: (member: string, offer: string, perk: string) => run((s) => perkActions.learnFromOffer(s, member, offer, perk)),
    declinePerk: (member: string, offer: string) => run((s) => perkActions.declineOffer(s, member, offer)),
    pitchPerk: (member: string, offer: string, text: string) => perform({ kind: 'perk_pitch', target: pitchTarget(member, offer), text }),
    train: (perk: string, text: string) => perform({ kind: 'train', target: perk, text }),
    forgetInvention: (name: string) => run((s) => invention.forgetInvention(s, name)),
    /** 自創物品改名（回傳新的名字） */
    renameInvention: (from: string, to: string) => run((s) => invention.renameInvention(s, from, to)),
    // 苗圃（garden.ts）：站在苗圃上播種、收成、拔掉
    plant: (seed: string) => run((s) => {
      const p = grid.position(s)
      garden.plant(s, grid.currentArea(s), p.x, p.y, seed)
    }),
    harvest: () => run((s) => {
      const p = grid.position(s)
      return garden.harvest(s, grid.currentArea(s), p.x, p.y)
    }, { narrate: false }),
    uproot: () => run((s) => {
      const p = grid.position(s)
      garden.uproot(s, grid.currentArea(s), p.x, p.y)
    }),
    /** 地下城的緊急撤退（失敗會被追上打一場） */
    retreat: () => run(grid.retreat),
    /** 這個存檔的規則 */
    setDefeatLoot: (rule: DefeatLoot) => {
      if (!state.value) return
      state.value.options = { ...(state.value.options ?? { defeatLoot: 'half' }), defeatLoot: rule }
      save()
    },
    descend: () => run((s) => (grid.descend(s), encounters.checkHostiles(s))),
    ascend: () => run((s) => (grid.ascend(s), encounters.checkHostiles(s))),
    // 對峙：避開、現身、偷襲或開戰、付過路費（蒙混與威嚇是主動行動）
    avoidFoes: () => run(encounters.avoidFoes),
    revealSelf: () => run(encounters.revealSelf),
    fightFoes: () => run((s) => encounters.fightFoes(s)),
    payToll: () => run(encounters.payToll),
    payFine: () => run(security.payFine),
    restAtSafeRoom: () => run((s) => rest.longRest(s, 'safe')),
    // 夥伴
    tavernCandidates: () => run(companions.tavernCandidates) ?? [],
    waitForParty: () => run(companions.waitForParty),
    acceptPartyOffer: (id: string) => run((s) => companions.acceptPartyOffer(s, id)),
    declinePartyOffer: (id: string) => run((s) => companions.declinePartyOffer(s, id)),
    requestLeave: (mode: 'sneak' | 'formal' | null) => run((s) => companions.requestLeave(s, mode)),
    marketStock: (kind: companions.MarketKind) => run((s) => companions.marketStock(s, kind)) ?? [],
    buySlave: (kind: companions.MarketKind, id: string, mark?: slavery.MarkChoice) => run((s) => companions.buySlave(s, kind, id, mark)),
    chooseMark: (choice: slavery.MarkChoice) => run((s) => slavery.chooseMark(s, choice)),
    answerMasterEvent: (index: number) => run((s) => slavery.answerMasterEvent(s, index)),
    // 成人向的戰敗事件：關閉成人向時直接離開
    skipDefeatEvent: () => run(defeat.skipDefeatEvent),
    offerSelf: (kind: companions.MarketKind) => run((s) => companions.offerSelf(s, kind)),
    releaseSlave: (id: string) => run((s) => companions.releaseSlave(s, id)),
    acceptSuggestion: (id: string, text?: string) => run((s) => social.acceptSuggestion(s, id, text)),
    rejectSuggestion: (id: string) => run((s) => social.rejectSuggestion(s, id)),
    // 人際關係與共同記憶
    editRelationship: (id: string, patch: social.RelationshipPatch) => run((s) => social.editRelationship(s, id, patch)),
    addMemory: (m: Omit<social.Memory, 'id'>) => run((s) => social.addMemory(s, m)),
    editMemory: (id: string, patch: social.MemoryPatch) => run((s) => social.editMemory(s, id, patch)),
    deleteMemory: (id: string) => run((s) => social.deleteMemory(s, id)),
  }
})

/** AbilityPicker 的值（"成員|能力"）轉成主動行動的 use */
export function parseUse(value: string): { member: string; ability: string } | undefined {
  const [member, ability] = value.split('|')
  return member && ability ? { member, ability } : undefined
}
