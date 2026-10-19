import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as combat from '@/engine/combat'
import { migrate, newGame, player } from '@/engine/state'
import * as grid from '@/engine/grid'
import { spendAttrPoint } from '@/engine/character'
import type { Attrs, AttrId } from '@/engine/data'
import * as town from '@/engine/town'
import { travel } from '@/engine/travel'
import type { GameState, Report } from '@/engine/types'
import type { Prompt } from '@/narrator/prompt'
import { useSettings } from './settings'

const SAVE_KEY = 'elondia.save'
const NARRATION_KEY = 'elondia.narrations'

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
  const error = ref<string | null>(null)
  const controllers = new Map<string, AbortController>()

  const pc = computed(() => (state.value ? player(state.value) : null))

  function save() {
    if (state.value) writeJson(SAVE_KEY, state.value)
    const finished = Object.fromEntries(Object.entries(narrations.value).filter(([, n]) => n.status === 'done'))
    writeJson(NARRATION_KEY, finished)
  }

  /** 執行引擎動作；錯誤訊息顯示在畫面上而不是丟出。 */
  function run<T>(fn: (s: GameState) => T): T | undefined {
    if (!state.value) return undefined
    error.value = null
    try {
      const result = fn(state.value)
      save()
      const settings = useSettings()
      const report = isReport(result) ? result : hasReport(result) ? result.report : undefined
      if (settings.aiNarration && settings.ready() && report && report.kind !== 'trade') {
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

  function hasReport(x: unknown): x is { report: Report } {
    return typeof x === 'object' && x !== null && 'report' in x && isReport((x as { report: unknown }).report)
  }

  function start(name: string, race: string, classId: string, bonus?: Partial<Attrs>) {
    state.value = newGame({ name, race, classId, ...(bonus ? { bonus } : {}) })
    grid.enterLocation(state.value)
    narrations.value = {}
    error.value = null
    save()
  }

  function reset() {
    for (const c of controllers.values()) c.abort()
    state.value = null
    narrations.value = {}
    localStorage.removeItem(SAVE_KEY)
    localStorage.removeItem(NARRATION_KEY)
  }

  function importSave(json: string) {
    const data = JSON.parse(json) as { state?: GameState; narrations?: Record<string, NarrationState> }
    if (!data.state?.party?.length) throw new Error('存檔格式不正確')
    state.value = load(data.state)
    narrations.value = data.narrations ?? {}
    save()
  }

  function exportSave(): string {
    return JSON.stringify({ state: state.value, narrations: narrations.value }, null, 2)
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
    return buildPrompt(report, lore, { playerName, language: settings.language })
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
      for await (const chunk of streamNarration(settings.provider, settings.current(), prompt, controller.signal)) {
        entry.text += chunk
      }
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

  return {
    state, narrations, error, pc,
    start, reset, importSave, exportSave, promptFor, narrate, cancelNarration,
    travel: (to: string, intent?: string) => run((s) => travel(s, to, intent)),
    rest: () => run(town.rest),
    buyRations: (qty: number) => run((s) => town.buyRations(s, qty)),
    recruit: (id: string) => run((s) => town.recruit(s, id)),
    dismiss: (id: string) => run((s) => town.dismiss(s, id)),
    visitGuild: () => run(town.guildQuests) ?? [],
    acceptQuest: (id: string) => run((s) => town.acceptQuest(s, id)),
    turnInQuest: (id: string) => run((s) => town.turnInQuest(s, id)),
    templeHeal: () => run(town.templeHeal),
    chooseAbility: (member: string, ability: string) => run((s) => town.chooseAbility(s, member, ability)),
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
    restAtSafeRoom: () => run(grid.restAtSafeRoom),
  }
})
