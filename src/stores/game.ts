import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as actions from '@/engine/actions'
import * as combat from '@/engine/combat'
import * as companions from '@/engine/companions'
import * as rest from '@/engine/rest'
import * as trade from '@/engine/trade'
import * as negotiation from '@/engine/negotiation'
import * as inventory from '@/engine/inventory'
import type { ShopType } from '@/engine/data'
import { migrate, newGame, player } from '@/engine/state'
import * as grid from '@/engine/grid'
import * as social from '@/engine/social'
import { editProfile, protagonistText, spendAttrPoint, type ProfilePatch } from '@/engine/character'
import { locationById } from '@/engine/data'
import type { Attrs, AttrId } from '@/engine/data'
import type { NewGameOptions } from '@/engine/state'
import * as town from '@/engine/town'
import { travel } from '@/engine/travel'
import type { GameState, Report } from '@/engine/types'
import {
  buildActionPrompt, buildNegotiationPrompt, buildShopPrompt, buildTavernPrompt, extractJson, splitSuggestions,
} from '@/narrator/judge'
import type { Prompt } from '@/narrator/prompt'
import type { TokenUsage } from '@/narrator/providerInfo'
import { useSettings } from './settings'
import {
  AUTO_SLOTS, parseSaveFile, QUICK_SLOT, saveFileName, slotMeta, slotStore, slotTitle, type SaveData, type SlotMeta,
} from './saves'

const SAVE_KEY = 'elondia.save'
const NARRATION_KEY = 'elondia.narrations'
const USAGE_KEY = 'elondia.usage'
/** 不屬於任何一則日誌的 AI 呼叫（酒館候選人、商店清單、談判方式、失敗的判定） */
export const OTHER_USAGE = '_other'

export interface UsageEntry {
  input: number
  output: number
  calls: number
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 儲存空間不足或被封鎖時略過；遊戲仍可繼續
  }
}

export interface NarrationState {
  text: string
  status: 'streaming' | 'done' | 'error'
  error?: string
}

/** 讀入存檔：補上新欄位，舊存檔沒有格子位置時放到目前地點的入口。 */
function load(s: GameState): GameState {
  migrate(s)
  if (!s.position) grid.enterLocation(s)
  return s
}

export const useGame = defineStore('game', () => {
  const saved = readJson<GameState>(SAVE_KEY)
  const state = ref<GameState | null>(saved ? load(saved) : null)
  const narrations = ref<Record<string, NarrationState>>(readJson(NARRATION_KEY) ?? {})
  /** token 用量：日誌 id（或 OTHER_USAGE）→ 累計 */
  const usage = ref<Record<string, UsageEntry>>(readJson(USAGE_KEY) ?? {})
  const error = ref<string | null>(null)
  /** AI 正在判定主動行動 */
  const judging = ref(false)
  /** 行動備註：下一次委託或旅行時交給 AI 的玩家意圖 */
  const intent = ref('')
  /** 存檔欄位列表（新的在前） */
  const slots = ref<SlotMeta[]>([])
  /** 畫面上方短暫顯示的提示（例如「已快速存檔」） */
  const notice = ref<string | null>(null)
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  const controllers = new Map<string, AbortController>()

  const pc = computed(() => (state.value ? player(state.value) : null))

  function save() {
    if (state.value) writeJson(SAVE_KEY, state.value)
    const finished = Object.fromEntries(Object.entries(narrations.value).filter(([, n]) => n.status === 'done'))
    writeJson(NARRATION_KEY, finished)
    writeJson(USAGE_KEY, usage.value)
  }

  /** 執行引擎動作；錯誤訊息顯示在畫面上而不是丟出。 */
  function run<T>(fn: (s: GameState) => T, opts: { narrate?: boolean } = {}): T | undefined {
    if (!state.value) return undefined
    error.value = null
    try {
      const result = fn(state.value)
      save()
      const settings = useSettings()
      const report = isReport(result) ? result : hasReport(result) ? result.report : undefined
      // 自動存檔：長休、抵達目的地
      if (report?.kind === 'rest' && report.outcome.tags?.includes('長休')) void autoSave('長休')
      if (report?.kind === 'travel' && report.outcome.result === 'arrived') void autoSave('抵達')
      if (opts.narrate !== false && settings.aiNarration && settings.ready() && report && report.kind !== 'trade') {
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

  function addUsage(key: string, u: TokenUsage) {
    const e = (usage.value[key] ??= { input: 0, output: 0, calls: 0 })
    e.input += u.input
    e.output += u.output
    e.calls += 1
  }

  /** 收集一次呼叫的用量；呼叫結束後再決定記在哪一則日誌 */
  function usageCollector() {
    const got: TokenUsage[] = []
    return { onUsage: (u: TokenUsage) => got.push(u), flush: (key: string) => { for (const u of got.splice(0)) addUsage(key, u) } }
  }

  const totalUsage = computed(() =>
    Object.values(usage.value).reduce((t, e) => ({ input: t.input + e.input, output: t.output + e.output, calls: t.calls + e.calls }), { input: 0, output: 0, calls: 0 }),
  )

  // ---- 存檔欄位 ----

  function flash(text: string) {
    notice.value = text
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice.value = null), 2500)
  }

  function snapshot(): SaveData | null {
    if (!state.value) return null
    const finished = Object.fromEntries(Object.entries(narrations.value).filter(([, n]) => n.status === 'done'))
    return JSON.parse(JSON.stringify({ state: state.value, narrations: finished, usage: usage.value })) as SaveData
  }

  async function refreshSlots() {
    try {
      slots.value = (await slotStore().list()).sort((a, b) => b.savedAt - a.savedAt)
    } catch (e) {
      error.value = `讀取存檔列表失敗：${e instanceof Error ? e.message : String(e)}`
    }
  }

  async function writeSlot(id: string, name: string, kind: SlotMeta['kind']) {
    const data = snapshot()
    if (!data) throw new Error('沒有進行中的遊戲')
    await slotStore().put(slotMeta(id, name, kind, data), data)
    await refreshSlots()
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
  async function autoSave(reason: string) {
    if (!state.value) return
    let n = 0
    try {
      n = (Number(localStorage.getItem('elondia.autoIndex') ?? 0) + 1) % AUTO_SLOTS
      localStorage.setItem('elondia.autoIndex', String(n))
    } catch {
      // 無痕模式等情況下照樣存在第 0 格
    }
    try {
      await writeSlot(`auto-${n}`, `自動存檔（${reason}）`, 'auto')
    } catch {
      // 自動存檔失敗不打斷遊戲
    }
  }

  function applySnapshot(data: SaveData) {
    for (const c of controllers.values()) c.abort()
    state.value = load(data.state)
    narrations.value = (data.narrations ?? {}) as Record<string, NarrationState>
    usage.value = (data.usage ?? {}) as Record<string, UsageEntry>
    error.value = null
    save()
  }

  /** 讀檔：先把目前的進度自動存一份，免得誤讀 */
  async function loadSlot(id: string) {
    try {
      const data = await slotStore().get(id)
      if (!data) throw new Error('找不到這個存檔')
      if (state.value) await autoSave('讀檔前')
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
  }

  async function renameSlot(id: string, name: string) {
    await slotStore().rename(id, name.trim())
    await refreshSlots()
  }

  /** 匯出成檔案：回傳檔名與內容（目前的遊戲或某個欄位） */
  async function exportFile(id?: string): Promise<{ name: string; text: string } | null> {
    const data = id ? await slotStore().get(id) : snapshot()
    if (!data) return null
    return { name: saveFileName(slotMeta('', '', 'manual', data)), text: JSON.stringify(data, null, 2) }
  }

  /** 匯入檔案：存成一個新的手動存檔欄位（不會直接讀取） */
  async function importFile(text: string, fileName = '匯入的存檔') {
    try {
      const data = parseSaveFile(text)
      const meta = slotMeta(`m-${Date.now().toString(36)}`, fileName.replace(/\.json$/i, ''), 'manual', data)
      await slotStore().put(meta, data)
      await refreshSlots()
      flash('📥 已匯入，可以在存檔列表讀取')
    } catch (e) {
      error.value = `匯入失敗：${e instanceof Error ? e.message : String(e)}`
    }
  }

  function hasReport(x: unknown): x is { report: Report } {
    return typeof x === 'object' && x !== null && 'report' in x && isReport((x as { report: unknown }).report)
  }

  function start(name: string, race: string, classId: string, bonus?: Partial<Attrs>, profile: Omit<NewGameOptions, 'name' | 'race' | 'classId' | 'bonus' | 'seed'> = {}) {
    state.value = newGame({ name, race, classId, ...(bonus ? { bonus } : {}), ...profile })
    grid.enterLocation(state.value)
    narrations.value = {}
    usage.value = {}
    error.value = null
    save()
  }

  function reset() {
    for (const c of controllers.values()) c.abort()
    state.value = null
    narrations.value = {}
    usage.value = {}
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem(NARRATION_KEY)
    localStorage.removeItem(USAGE_KEY)
  }



  // 世界書、繁簡轉換字典與各家 SDK 都很大，用到時才載入
  async function promptFor(report: Report): Promise<Prompt> {
    const [{ loadWorldbook, selectLore }, { buildPrompt }] = await Promise.all([
      import('@/narrator/lore'),
      import('@/narrator/prompt'),
    ])
    const settings = useSettings()
    const book = await loadWorldbook()
    const playerName = pc.value?.name ?? '你'
    const lore = selectLore(book, report, { adult: settings.adult, budgetChars: settings.loreBudget, playerName })
    const s = state.value
    const context = s ? social.formatContext(s, social.selectContext(s, social.queryForReport(s, report))) : ''
    const me = s?.party.find((m) => m.isPlayer)
    const protagonist = me ? protagonistText(me, me.birthplace ? locationById(me.birthplace).name : undefined) : ''
    return buildPrompt(report, lore, {
      playerName, language: settings.language,
      ...(protagonist ? { protagonist } : {}),
      ...(context ? { context } : {}),
      suggestRelations: context.includes('<relationships>'),
    })
  }

  async function narrate(report: Report) {
    const settings = useSettings()
    controllers.get(report.report_id)?.abort()
    const controller = new AbortController()
    controllers.set(report.report_id, controller)
    narrations.value[report.report_id] = { text: '', status: 'streaming' }
    const entry = narrations.value[report.report_id]!
    try {
      const prompt = await promptFor(report)
      const { streamNarration } = await import('@/narrator/providers')
      const onUsage = (u: TokenUsage) => addUsage(report.report_id, u)
      for await (const chunk of streamNarration(settings.provider, settings.current(), prompt, controller.signal, onUsage)) {
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
    const ai = useAI ?? (settings.aiJudge && settings.ready())
    if (!ai) {
      run((st) => actions.resolveAction(st, null))
      return
    }
    judging.value = true
    error.value = null
    const collector = usageCollector()
    try {
      const { completeText } = await import('@/narrator/providers')
      const participants = ['pc', ...s.party.filter((m) => !m.isPlayer).map((m) => m.id)]
      const target = pending.target?.includes(':') ? pending.target.split(':')[1] : pending.target
      if (target && s.relationships?.[target] && !participants.includes(target)) participants.push(target)
      const context = social.formatContext(s, social.selectContext(s, { participants, location: s.location }))
      const text = await completeText(settings.provider, settings.current(), buildActionPrompt(s, pending, context), undefined, collector.onUsage)
      const judgment = actions.sanitizeJudgment(s, pending, extractJson(text))
      // AI 已經直接寫出經過：當作這份報告的敘事，不再另外請 AI 描述
      const report = run((st) => actions.resolveAction(st, judgment), { narrate: !judgment.narrative })
      collector.flush(report?.report_id ?? OTHER_USAGE)
      if (report && judgment.narrative) narrations.value[report.report_id] = { text: judgment.narrative, status: 'done' }
      save()
    } catch (e) {
      collector.flush(OTHER_USAGE)
      error.value = `AI 判定失敗：${e instanceof Error ? e.message : String(e)}（可以重試，或改用規則判定）`
    } finally {
      judging.value = false
    }
  }

  /** 酒館候選人：AI 開啟時請 AI 潤飾名字、外貌與性格（每天每間酒館一次） */
  async function flavorTavern() {
    const s = state.value
    const settings = useSettings()
    if (!s || !settings.aiJudge || !settings.ready()) return
    const today = s.taverns?.[s.location]
    if (!today || today.flavored || today.day !== s.time.day) return
    today.flavored = true
    try {
      const { completeText } = await import('@/narrator/providers')
      const prompt = buildTavernPrompt(s)
      if (!prompt) return
      const raw = extractJson(await completeText(settings.provider, settings.current(), prompt, undefined, (u) => addUsage(OTHER_USAGE, u))) as { candidates?: companions.CandidateFlavor[] }
      run((st) => companions.applyCandidateFlavor(st, Array.isArray(raw.candidates) ? raw.candidates : []))
    } catch (e) {
      error.value = `AI 生成酒館候選人失敗：${e instanceof Error ? e.message : String(e)}`
    }
  }

  /** 商店：AI 開啟時請 AI 生成今天的交易清單（每間店每天一次，失敗時保留規則清單） */
  async function flavorShop(type: ShopType) {
    const s = state.value
    const settings = useSettings()
    if (!s || !settings.aiJudge || !settings.ready()) return
    const shop = trade.shopState(s, type)
    if (shop.aiTried || shop.source === 'ai') return
    shop.aiTried = true
    save()
    try {
      const { completeText } = await import('@/narrator/providers')
      const raw = extractJson(await completeText(settings.provider, settings.current(), buildShopPrompt(s, type), undefined, (u) => addUsage(OTHER_USAGE, u)))
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
    if (!n || !s || n.ai || !settings.aiJudge || !settings.ready()) return n
    n.ai = true
    try {
      const { completeText } = await import('@/narrator/providers')
      const raw = extractJson(await completeText(settings.provider, settings.current(), buildNegotiationPrompt(s, n), undefined, (u) => addUsage(OTHER_USAGE, u)))
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
    state, narrations, error, pc, judging, intent, usage, totalUsage, slots, notice,
    refreshSlots, saveToSlot, quickSave, quickLoad, loadSlot, deleteSlot, renameSlot, exportFile, importFile,
    start, reset, promptFor, narrate, cancelNarration,
    perform, judge, flavorTavern, hire, flavorShop, startNegotiation,
    // 商店、談判、行囊
    shopState: (type: ShopType) => run((s) => trade.shopState(s, type)),
    buyDeal: (type: ShopType, id: string) => run((s) => trade.buyDeal(s, type, id)),
    sellItem: (type: ShopType, name: string, qty: number) => run((s) => trade.sellItem(s, type, name, qty)),
    bargain: (type: ShopType, dealId: string, text: string) => perform({ kind: 'bargain', target: trade.bargainTarget(type, dealId), text }),
    chooseOption: (id: string, option: string) => run((s) => negotiation.chooseOption(s, id, option)),
    negotiateFreely: (id: string, text: string, use?: { member: string; ability: string }) =>
      perform({ kind: 'negotiation', target: id, text, ...(use ? { use } : {}) }),
    abandonNegotiation: (id: string) => run((s) => negotiation.abandonNegotiation(s, id)),
    useItem: (name: string, member: string) => run((s) => inventory.useItem(s, name, member)),
    equipItem: (name: string, member: string) => run((s) => inventory.equipItem(s, name, member)),
    editProfile: (patch: ProfilePatch) => run((s) => editProfile(player(s), patch)),
    travel: (to: string, intent?: string) => run((s) => travel(s, to, intent)),
    rest: () => run(town.rest),
    shortRest: (spend?: Record<string, number>) => run((s) => rest.shortRest(s, spend)),
    /** 長休；有寫互動內容時，長休後接著進行「長休時的互動」（主動行動） */
    longRest: async (place: 'inn' | 'safe', talk?: { text: string; target?: string }) => {
      const withTalk = !!talk?.text.trim()
      // 有互動時，長休本身不另外寫敘事：和互動合成一段（互動的報告會帶上長休的經過）
      const report = run((s) => rest.longRest(s, place), { narrate: !withTalk })
      if (report && withTalk) await perform({ kind: 'rest_talk', text: talk!.text, ...(talk!.target ? { target: talk!.target } : {}) })
      return report
    },
    buyRations: (qty: number) => run((s) => town.buyRations(s, qty)),
    recruit: (id: string) => run((s) => town.recruit(s, id)),
    dismiss: (id: string) => run((s) => town.dismiss(s, id)),
    visitGuild: () => run(town.guildQuests) ?? [],
    acceptQuest: (id: string) => run((s) => town.acceptQuest(s, id)),
    turnInQuest: (id: string) => run((s) => town.turnInQuest(s, id)),
    templeHeal: () => run(town.templeHeal),
    chooseAbility: (member: string, ability: string) => run((s) => town.chooseAbility(s, member, ability)),
    rerollAbility: (member: string) => run((s) => town.rerollAbility(s, member, useSettings().rerollLimit())),
    spendAttr: (member: string, attr: AttrId) =>
      run((s) => spendAttrPoint(s.party.find((m) => m.id === member)!, attr)),
    doTownQuest: (id: string, intent?: string) => run((s) => town.doTownQuest(s, id, intent)),
    act: (action: combat.CombatAction) => run((s) => combat.act(s, action)),
    finishCombat: () =>
      run((s) => {
        const report = combat.finishCombat(s)
        grid.afterCombat(s, report)
        return report
      }),
    // 走格子
    moveTo: (x: number, y: number) => run((s) => grid.moveTo(s, x, y)),
    move: (dx: number, dy: number) => run((s) => grid.move(s, dx, dy)),
    goOutskirts: () => run(grid.goOutskirts),
    returnToTown: () => run(grid.returnToTown),
    descend: () => run(grid.descend),
    ascend: () => run(grid.ascend),
    restAtSafeRoom: () => run((s) => rest.longRest(s, 'safe')),
    // 夥伴
    tavernCandidates: () => run(companions.tavernCandidates) ?? [],
    waitForParty: () => run(companions.waitForParty),
    acceptPartyOffer: (id: string) => run((s) => companions.acceptPartyOffer(s, id)),
    declinePartyOffer: (id: string) => run((s) => companions.declinePartyOffer(s, id)),
    requestLeave: (mode: 'sneak' | 'formal' | null) => run((s) => companions.requestLeave(s, mode)),
    marketStock: (kind: companions.MarketKind) => run((s) => companions.marketStock(s, kind)) ?? [],
    buySlave: (kind: companions.MarketKind, id: string) => run((s) => companions.buySlave(s, kind, id)),
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
