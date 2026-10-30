// 特殊任務生成器（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E4c）：
// 輸入 → 大綱（AI，玩家可以改）→ 完整內容（AI）→ 程式整理與沙盒檢查（有錯誤時交回 AI 修，最多 2 次）→ 預覽 → 加入世界。
// 生成中與還沒加入的結果存成草稿（localStorage，最多 DRAFT_LIMIT 份），關掉頁面不會不見。

import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { buildGenerated, defaultGenInput, type GenInput, type GenResult } from '@/engine/questGen'
import type { ContentMods } from '@/engine/mods'
import { extractJson } from '@/narrator/judge'
import { fixPrompt, fullPrompt, outlinePrompt, outlineText } from '@/narrator/questGenSpec'
import { questCatalog } from '@/narrator/questCatalog'
import type { Prompt } from '@/narrator/prompt'
import { useContent } from './content'
import { OTHER_USAGE, useGame } from './game'
import { useSettings } from './settings'

const DRAFTS_KEY = 'elondia.questGen.drafts'
export const DRAFT_LIMIT = 5
/** 檢查有錯誤時交回 AI 修的次數 */
export const FIX_ROUNDS = 2

export interface GenDraft {
  id: string
  at: number
  /** 在哪個世界生成的 */
  world: string
  title: string
  input: GenInput
  outline: string
  /** 最後一次完整生成的 AI 回覆（原文） */
  raw: string
}

export interface GenCheck {
  gen: GenResult
  mods: Partial<ContentMods>
  errors: string[]
  warnings: string[]
}

function loadDrafts(): GenDraft[] {
  try {
    const v = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]') as GenDraft[]
    return Array.isArray(v) ? v.filter((d) => d && typeof d.id === 'string' && d.input) : []
  } catch {
    return []
  }
}

export const useQuestGen = defineStore('questGen', () => {
  const input = ref<GenInput>(defaultGenInput())
  const outline = ref('')
  const raw = ref('')
  const result = shallowRef<GenCheck | null>(null)
  /** 正在做什麼（空字串＝閒著） */
  const busy = ref<'' | 'outline' | 'full' | 'fix'>('')
  const error = ref('')
  /** 這一輪花的 token */
  const spent = ref({ input: 0, output: 0, calls: 0 })
  const drafts = ref<GenDraft[]>(loadDrafts())
  const draftId = ref<string | null>(null)
  let abort: AbortController | null = null
  /** 這一輪的 id 短碼：修正時沿用，錯誤訊息裡的 id 才對得上 */
  let code = ''

  function persist() {
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.value))
    } catch {
      // 存不下就算了：草稿只是方便
    }
  }
  function saveDraft(title: string) {
    const content = useContent()
    const id = draftId.value ?? `d${Date.now().toString(36)}`
    draftId.value = id
    const d: GenDraft = { id, at: Date.now(), world: content.active, title: title || input.value.prompt.slice(0, 20) || '未命名', input: JSON.parse(JSON.stringify(input.value)) as GenInput, outline: outline.value, raw: raw.value }
    drafts.value = [d, ...drafts.value.filter((x) => x.id !== id)].slice(0, DRAFT_LIMIT)
    persist()
  }
  function removeDraft(id: string) {
    drafts.value = drafts.value.filter((x) => x.id !== id)
    if (draftId.value === id) draftId.value = null
    persist()
  }
  function openDraft(id: string) {
    const d = drafts.value.find((x) => x.id === id)
    if (!d) return
    draftId.value = d.id
    input.value = { ...defaultGenInput(), ...d.input, allow: { ...defaultGenInput().allow, ...d.input.allow } }
    outline.value = d.outline
    raw.value = d.raw
    result.value = null
    error.value = ''
    if (d.raw) {
      try {
        result.value = evaluate(d.raw)
      } catch (e) {
        error.value = message(e)
      }
    }
  }
  /** 從頭開始（草稿留著） */
  function reset() {
    cancel()
    input.value = defaultGenInput()
    outline.value = ''
    raw.value = ''
    result.value = null
    error.value = ''
    draftId.value = null
    spent.value = { input: 0, output: 0, calls: 0 }
  }

  const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

  /** 呼叫 AI（「世界設計」的來源），記下用量 */
  async function call(prompt: Prompt): Promise<string> {
    const settings = useSettings()
    const game = useGame()
    if (!settings.ready('designer')) throw new Error('還沒有設定「世界設計」的模型來源（設定 → AI）')
    const src = settings.sourceFor('designer')
    const collector = game.usageCollector(game.originOf('designer', src))
    abort = new AbortController()
    const { completeText } = await import('@/narrator/providers')
    try {
      return await completeText(src.provider, src.config, prompt, abort.signal, (u) => {
        collector.onUsage(u)
        spent.value = { input: spent.value.input + u.input, output: spent.value.output + u.output, calls: spent.value.calls + 1 }
      })
    } finally {
      collector.flush(OTHER_USAGE)
      abort = null
    }
  }

  function cancel() {
    abort?.abort()
    abort = null
  }

  /** 第 ② 段：大綱 */
  async function makeOutline() {
    if (busy.value) return
    busy.value = 'outline'
    error.value = ''
    code = ''
    try {
      const text = await call(outlinePrompt(input.value, questCatalog(input.value)))
      outline.value = outlineText(extractJson(text))
      result.value = null
      raw.value = ''
      saveDraft(outline.value.split('\n')[0]!.replace(/^#\s*/, ''))
    } catch (e) {
      if (!abortedError(e)) error.value = `大綱生成失敗：${message(e)}`
    } finally {
      busy.value = ''
    }
  }

  /** 整理與檢查一份回覆 */
  function evaluate(text: string): GenCheck {
    const gen = buildGenerated(extractJson(text), input.value, code || (code = Math.random().toString(36).slice(2, 6)))
    const check = useContent().checkGenerated(gen.mods, gen.storyId)
    return { gen, ...check }
  }

  /** 第 ③～④ 段：完整內容，有錯誤時交回 AI 修（最多 FIX_ROUNDS 次） */
  async function generate(rounds = FIX_ROUNDS) {
    if (busy.value) return
    error.value = ''
    const catalog = questCatalog(input.value)
    try {
      busy.value = 'full'
      code = ''
      const text = await call(fullPrompt(input.value, catalog, outline.value || input.value.prompt))
      await settle(text, catalog, rounds)
    } catch (e) {
      if (!abortedError(e)) error.value = `生成失敗：${message(e)}`
    } finally {
      busy.value = ''
    }
  }

  /** 目前的結果有錯誤時再修一次 */
  async function fixAgain() {
    if (busy.value || !raw.value || !result.value?.errors.length) return
    error.value = ''
    try {
      await settle(raw.value, questCatalog(input.value), 1, true)
    } catch (e) {
      if (!abortedError(e)) error.value = `修正失敗：${message(e)}`
    } finally {
      busy.value = ''
    }
  }

  /** 檢查 text；有錯誤而且還有次數時交回 AI 修 */
  async function settle(text: string, catalog: string, rounds: number, fixFirst = false) {
    let current = text
    for (let i = 0; ; i++) {
      let check: GenCheck | undefined
      let errors: string[]
      if (fixFirst && i === 0) errors = result.value?.errors ?? []
      else {
        try {
          check = evaluate(current)
          errors = check.errors
        } catch (e) {
          // 回覆不是 JSON、沒有 story：也算一次錯誤
          errors = [`回覆的格式不對：${message(e)}`]
        }
        raw.value = current
        if (check) result.value = check
        saveDraft(check?.gen.mods.stories?.[check.gen.storyId]?.title ?? '')
      }
      if (!errors.length || i >= rounds) {
        if (!check && !fixFirst) throw new Error(errors[0])
        return
      }
      busy.value = 'fix'
      current = await call(fixPrompt(input.value, catalog, current, errors))
      fixFirst = false
    }
  }

  /** 加入目前的世界（原版世界時自動建立自己的世界）；回傳任務的 id */
  function accept(): string | undefined {
    const r = result.value
    if (!r || r.errors.length) return undefined
    const content = useContent()
    content.importPackage({ mods: r.mods, renamed: [], skipped: [], fingerprints: {} })
    if (draftId.value) removeDraft(draftId.value)
    const id = r.gen.storyId
    reset()
    return id
  }

  return { input, outline, raw, result, busy, error, spent, drafts, draftId, makeOutline, generate, fixAgain, accept, cancel, reset, openDraft, removeDraft, evaluate }
})

function abortedError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}
