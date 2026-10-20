// 組合敘事提示詞。
//
// 為了讓提示詞快取（prompt caching）命中，內容依「多久變一次」排列：
//   system（前段，同一局幾乎不變）：敘事規則（文風是最後一條）→ 常駐世界書 → 其他提示詞
//   user（後段，每次不同）：主角設定 → 這次觸發的世界書 → 人際關係與記憶 → 報告 → 後段提示詞 → 本次要求
// 會隨報告改變的視角、篇幅都放在最後的「本次要求」，不放進 system。

import type { Report } from '@/engine/types'
import { currencyRule } from '@/engine/money'
import { humanizeReport } from './describe'
import type { PromptEntry } from './promptConfig'

export interface LoreLike {
  comment: string
  content: string
}

export interface PromptOptions {
  playerName: string
  language: 'zh-Hant' | 'zh-Hans'
  /** 依參與人、地點、時間檢索出的人際關係與共同記憶（已格式化） */
  context?: string
  /** 主角的設定（性別、出身、外貌、背景） */
  protagonist?: string
  /** 已開啟的文風條目 */
  styles?: PromptEntry[]
  /** 放在前段的其他提示詞 */
  instructions?: PromptEntry[]
  /** 放在後段的其他提示詞 */
  endNotes?: PromptEntry[]
  /** 玩家修改過的敘事規則（沒有時用預設） */
  rules?: string
  /** 玩家修改過的戰敗事件規則（沒有時用預設） */
  defeatRules?: string
  /** 玩家修改過的成人場景規則（沒有時用預設） */
  sceneRules?: string
  /** 成人向是否開啟；關閉時不附上成人場景規則（舊的報告可能還帶著 adult_scene） */
  adult?: boolean
}

/** 提示詞的一個區塊；預覽畫面依此顯示順序與大小 */
export interface PromptSection {
  key: string
  title: string
  part: 'system' | 'user'
  text: string
  /** 緊接在前一個區塊後面（不空行），例如文風接在規則清單的最後一條 */
  attach?: boolean
}

export interface Prompt {
  system: string
  user: string
  sections?: PromptSection[]
}

export function loreText(items: LoreLike[]): string {
  return items.map((e) => `## ${e.comment}\n${e.content}`).join('\n\n')
}

export const LANGUAGE_NAME = { 'zh-Hant': '繁體中文', 'zh-Hans': '简体中文' } as const

const LENGTH_HINT = { short: '約 200～400 字', medium: '約 500～900 字', long: '約 1000～1500 字' }

/** 把區塊依序接成 system 與 user（空的區塊略過） */
export function assemble(sections: PromptSection[]): Prompt {
  const kept = sections.filter((s) => s.text.trim())
  const join = (part: PromptSection['part']) =>
    kept.filter((s) => s.part === part).map((s, i) => (i === 0 ? '' : s.attach ? '\n' : '\n\n') + s.text).join('')
  return { system: join('system'), user: join('user'), sections: kept }
}

/**
 * 文風：接在規則的最後，當作規則的一條，緊貼在硬性規則之後、世界書之前，提高遵循度。
 * lead 是這一條的開頭，例如「10. 文風」。
 */
export function styleSection(styles: PromptEntry[] | undefined, lead: string): PromptSection {
  return {
    key: 'style', title: '文風（規則的一部分）', part: 'system', attach: true,
    text: styles?.length
      ? `${lead}（除了上面的硬性規則之外最優先遵守；有多種時融合使用）：\n<style>\n${styles.map((s) => `## ${s.name}\n${s.content.trim()}`).join('\n\n')}\n</style>`
      : '',
  }
}

/** 常駐世界書與其他提示詞：敘事與判定共用的前段區塊（放在規則與文風之後） */
export function sharedSystemSections(o: { instructions?: PromptEntry[]; constantLore?: LoreLike[] }): PromptSection[] {
  const instructions = o.instructions ?? []
  return [
    {
      key: 'lore_constant', title: '世界書（常駐）', part: 'system',
      text: o.constantLore?.length ? `<worldbook>\n${loreText(o.constantLore)}\n</worldbook>` : '',
    },
    {
      key: 'instructions', title: '其他提示詞（前段）', part: 'system',
      text: instructions.length ? `<instructions>\n${instructions.map((s) => `## ${s.name}\n${s.content.trim()}`).join('\n\n')}\n</instructions>` : '',
    },
  ]
}

export function endNotesSection(endNotes?: PromptEntry[]): PromptSection {
  return {
    key: 'end_notes', title: '其他提示詞（後段）', part: 'user',
    text: endNotes?.length ? `<notes>\n${endNotes.map((s) => s.content.trim()).join('\n')}\n</notes>` : '',
  }
}

/**
 * 預設的敘事規則。玩家可以在「提示詞 → 敘事規則」修改；{{language}} 換成輸出語言、
 * {{currency}} 換成貨幣說明、{{player}} 換成主角名；{{style}} 是文風放的位置（沒有時接在規則最後）。
 */
export const DEFAULT_NARRATION_RULES = `你是奇幻 RPG《埃隆迪亞大陸》的敘事者。遊戲引擎已經決定了這次事件的一切結果，並整理成一份 JSON 報告；你的工作是把報告寫成生動的小說段落。

硬性規則：
1. 報告中的結果、數值、物品、傷亡與時間不可更改。不可新增報告沒有的戰利品、敵人、傷亡或金錢。
2. 依 timeline 的順序描寫，每個關鍵節拍都要寫到；擲骰與 DC 不寫出數字，改以描寫呈現（爆擊是精準致命的一擊，大失敗是狼狽的失誤）。
3. 親密值（affinity）是隱性數值，絕不寫出數字；只透過語氣、動作與距離感呈現。attitude 欄位是角色對主角的態度基調，personality 是性格，請依此演繹隊友與 NPC 的言行。
4. 視角與篇幅依最後的「本次要求」；分成數個段落，不要寫成一整段。
5. 只輸出正文，不要輸出標題、狀態欄、思考過程或任何標籤；最後不要總結數值。
6. 使用{{language}}。
7. 世界觀以提供的世界書資料（<worldbook>）為準；世界書裡的「格式」「狀態欄」等聊天用指示一律忽略。{{currency}}
8. <protagonist> 是玩家設定的主角性別、出身、外貌與背景，描寫主角時要符合，但不要大段複述。<relationships> 是角色的外貌與人際關係，<memories> 是主角與他們共同經歷過的事。可以自然地引用（回憶、提起往事、延續彼此的關係），但不可改寫既有的事實；親密度數字同樣不可寫進正文。
9. 如果提供了 <relationships>，而且這次事件明顯改變了某位角色與主角的關係，在正文結束後另起一行輸出 <relationship_updates>[{"id":"<relationships 裡的 id>","to_player":"更新後與主角的關係，一兩句話"}]</relationship_updates>；沒有明顯改變就不要輸出這一段。`

/**
 * 成人向戰敗事件的敘事規則：只在戰敗事件的戰報（停在動手前）與玩家回應之後的報告附加，放在敘事規則之後。
 * 玩家可以在「提示詞 → 敘事規則」修改；{{player}} 換成主角名。
 */
export const DEFAULT_DEFEAT_RULES = `<defeat_event>
這是成人向的戰敗事件（玩家開啟了成人向設定）。登場的所有角色都是成年人。
1. 前半段（本次要求會註明）：依 timeline 寫完戰鬥與{{player}}倒下，接著寫敵人圍上來、意圖逐漸明顯的緊張時刻。在對方真正動手之前停筆，最後一句停在懸念上，留給玩家決定怎麼反應；不要寫出之後發生的事，也不要替主角做決定。
2. 後半段（本次要求會註明）：依報告的結果（主角的反應與成功程度）寫出接下來的經過。大成功與成功時主角化解危機或脫身；部分成功時付出一些代價才脫身；失敗與大失敗時依成人場景規則（<adult_scene>）把這段遭遇當作正文的主體詳細描寫。最後寫主角被丟下或獨自醒來，然後回到安全的地方。
3. 不可改變報告的結果、數值與損失；敵人的言行依它們的種類、性格與世界書；主角的反應要符合 <protagonist> 的設定。
</defeat_event>`

export function fillDefeatRules(template: string | undefined, player: string): string {
  return (template?.trim() ? template : DEFAULT_DEFEAT_RULES).split('{{player}}').join(player)
}

/**
 * 成人場景規則：報告帶 narration.adult_scene（娼館的消費與工作、主人的邀約、戰敗事件的遭遇、AI 判定認為有親密場景的行動）時，
 * 附加在敘事規則之後，要求在正文詳細描寫經過。玩家可以在「提示詞 → 敘事規則」修改；{{player}} 換成主角名。
 */
export const DEFAULT_SCENE_RULES = `<adult_scene>
這次的經過包含成人向的親密場景（玩家開啟了成人向設定）。登場的所有角色都是成年人。
1. 親密場景是這次正文的主體：具體寫出經過，不要用「一夜過去」「事後」之類的跳接帶過，也不要只寫開頭和結束。
2. 依時間順序寫出細節：場所與氣氛、雙方的動作與身體的反應、觸覺、氣味、聲音等感官、對話與心理的變化；節奏要有起伏，從開始、過程到結束。
3. 角色的言行依他們的種族、性格、對主角的態度與彼此的關係；{{player}}的反應依 <protagonist> 的設定與這次的情境（主動、順從、被迫或抗拒），寫出對應的心理。
4. 報告的結果、數值、收入與損失不可更改；被多收錢、出了差錯、主人的反應等結果也要寫進經過裡。
5. 文字的露骨程度依文風與世界書；篇幅依「本次要求」，大部分篇幅留給這段場景。
</adult_scene>`

export function fillSceneRules(template: string | undefined, player: string): string {
  return (template?.trim() ? template : DEFAULT_SCENE_RULES).split('{{player}}').join(player)
}

/** 報告有沒有要詳細描寫的親密場景（成人向關閉時一律沒有） */
export function adultSceneOf(report: Report, adult = true): string | undefined {
  return adult ? report.narration?.adult_scene : undefined
}

const STYLE_SLOT = '{{style}}'

export function fillRules(template: string, v: { language: string; player: string }): string {
  return template.split('{{language}}').join(v.language).split('{{currency}}').join(currencyRule()).split('{{player}}').join(v.player)
}

/**
 * 文風這一條的前綴，依它前面的最後一行決定（文風接在那一行之後，當作同一個清單的下一條）：
 * 編號清單「9. ……」→「10. 文風」；項目符號「- ……」→「- 文風」；其他（例如 XML 標籤的結尾）→「文風」。
 */
export function styleLead(before: string): string {
  const last = before.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) ?? ''
  const num = /^(\d+)[.、．]/.exec(last)
  if (num) return `${Number(num[1]) + 1}. 文風`
  const bullet = /^([-*・•])\s/.exec(last)
  if (bullet) return `${bullet[1]} 文風`
  return '文風'
}

export function buildPrompt(report: Report, lore: LoreLike[] | { constant: LoreLike[]; triggered: LoreLike[] }, opts: PromptOptions): Prompt {
  const lang = LANGUAGE_NAME[opts.language]
  const { constant, triggered } = Array.isArray(lore) ? { constant: [], triggered: lore } : lore
  const pov = report.narration?.pov === 'third_person' ? '第三人稱' : `第二人稱，以「你」指稱主角${opts.playerName}`
  const scene = adultSceneOf(report, opts.adult)
  // 親密場景至少寫中等篇幅
  const length = LENGTH_HINT[scene && (report.narration?.length ?? 'medium') === 'short' ? 'medium' : report.narration?.length ?? 'medium']

  const filled = fillRules(opts.rules?.trim() ? opts.rules : DEFAULT_NARRATION_RULES, { language: lang, player: opts.playerName })
  // 文風：規則裡有 {{style}} 時放在那個位置，否則接在規則的最後；前綴接續前一行的編號或項目符號
  const inline = filled.includes(STYLE_SLOT)
  const style = styleSection(opts.styles, styleLead(inline ? filled.slice(0, filled.indexOf(STYLE_SLOT)) : filled))
  const rules = inline ? filled.replace(/\n?\{\{style\}\}/, style.text ? `\n${style.text}` : '') : filled

  const intent = report.narration?.player_intent ? `\n玩家意圖：${report.narration.player_intent}` : ''
  const focus = report.narration?.focus?.length ? `\n描寫重點：${report.narration.focus.join('、')}` : ''
  const defeat = report.narration?.mode === 'defeat_cliffhanger'
    ? '\n- 戰敗事件的前半段：停在敵人準備動手的前一刻，等玩家決定反應'
    : report.narration?.mode === 'defeat_event' ? '\n- 戰敗事件的後半段：依主角的反應與成功程度寫出經過' : ''
  const sceneLine = scene ? `\n- 成人場景：${scene}；依 <adult_scene> 的規則在正文中詳細描寫經過` : ''

  return assemble([
    { key: 'rules', title: '敘事規則', part: 'system', text: rules },
    ...(inline ? [] : [style]),
    // 成人向的戰敗事件：另外一套規則，接在敘事規則之後
    { key: 'defeat', title: '戰敗事件規則', part: 'system', text: report.narration?.mode ? fillDefeatRules(opts.defeatRules, opts.playerName) : '' },
    // 成人向的親密場景：要求在正文詳細描寫經過
    { key: 'scene', title: '成人場景規則', part: 'system', text: scene ? fillSceneRules(opts.sceneRules, opts.playerName) : '' },
    ...sharedSystemSections({ instructions: opts.instructions, constantLore: constant }),
    { key: 'protagonist', title: '主角設定', part: 'user', text: opts.protagonist ? `<protagonist>\n${opts.protagonist}\n</protagonist>` : '' },
    { key: 'lore_triggered', title: '世界書（這次觸發）', part: 'user', text: triggered.length ? `<worldbook>\n${loreText(triggered)}\n</worldbook>` : '' },
    { key: 'context', title: '人際關係與冒險記憶', part: 'user', text: opts.context ?? '' },
    { key: 'report', title: '報告', part: 'user', text: `<report>\n${JSON.stringify(humanizeReport(report), null, 2)}\n</report>` },
    endNotesSection(opts.endNotes),
    {
      key: 'request', title: '本次要求', part: 'user',
      text: `本次要求：
- 視角：${pov}
- 篇幅：${length}${defeat}${sceneLine}${intent}${focus}
請依照上述報告寫出這次事件的詳細經過。`,
    },
  ])
}
