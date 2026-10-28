// 把 repo 裡的文件轉成 GitHub Wiki 的頁面（只用 Node 內建模組）：
//     node tools/wiki/build.mjs [--out wiki-out] [--ref <tag 或分支>] [--check]
// - 哪份文件變成哪一頁、放在側邊欄的哪一組，寫在下面的 GROUPS；文件之間的連結改成 wiki 頁面的連結，
//   其他連結（程式、資料、圖片）改成指向 GitHub 上那個版本的檔案。
// - 另外產生 Home（首頁）、_Sidebar（側邊欄）、_Footer（頁尾）。
// - --check 只檢查：repo 裡每一份文件（docs/、worldgen/ 的 .md 與 README、CHANGELOG）都要列在 GROUPS 或 SKIP，
//   新增文件時忘了加會失敗（測試 src/__tests__/wiki.spec.ts 也會跑）。
// 發布由 .github/workflows/wiki.yml 執行（推送版本 tag 或手動執行時同步到 wiki）。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const REPO = 'yellow630914/ElondiaRPG'

/**
 * 側邊欄的分組與頁面。page 是 wiki 的頁名（檔名把空白換成 -；不要用半形括號、- 與斜線）；
 * src 是 repo 裡的檔案，README.md#標題 表示只取 README 的那一節（含底下的小節）。
 */
export const GROUPS = [
  { name: '玩家指南', pages: [
    { page: '開始遊玩', src: 'README.md#如何開始遊玩', desc: '線上玩、下載本機版、開始之後、畫面與 AI 功能' },
    { page: '遊戲內容', src: ['README.md#遊戲內容', 'README.md#自訂與世界生成'], desc: '世界、角色、冒險、城鎮、夥伴、劇情與自訂內容的總覽' },
    { page: '更新紀錄', src: 'CHANGELOG.md', desc: '每一版的更新內容' },
  ] },
  { name: '遊戲攻略', pages: [
    { page: '攻略總覽', src: 'docs/guide/README.md', desc: '內建世界的特殊任務、事件、物品、NPC 與地標整理（由遊戲資料自動產生）' },
    { page: '特殊任務：入門委託', src: 'docs/guide/quests-intro.md', sub: '特殊任務' },
    { page: '特殊任務：地區與勢力', src: 'docs/guide/quests-regions.md', sub: '特殊任務' },
    { page: '特殊任務：地下城', src: 'docs/guide/quests-dungeons.md', sub: '特殊任務' },
    { page: '特殊任務：角色線', src: 'docs/guide/quests-characters.md', sub: '特殊任務' },
    { page: '特殊任務：角色線（成人向）', src: 'docs/guide/quests-characters-adult.md', sub: '特殊任務' },
    { page: '特殊任務：打工、巡禮與祭典（成人向）', src: 'docs/guide/quests-work-adult.md', sub: '特殊任務' },
    { page: '特殊任務：多人特殊任務', src: 'docs/guide/quests-group.md', sub: '特殊任務' },
    { page: '特殊任務：史詩', src: 'docs/guide/quests-epic.md', sub: '特殊任務' },
    { page: '旅途與城鎮事件', src: 'docs/guide/events.md', sub: '事件' },
    { page: '成人向事件', src: 'docs/guide/events-adult.md', sub: '事件' },
    { page: '物品的取得方式', src: 'docs/guide/items.md', sub: '物品' },
    { page: '裝備的取得方式', src: 'docs/guide/equipment.md', sub: '物品' },
    { page: '固定 NPC 在哪裡', src: 'docs/guide/npcs.md', sub: '人物與地點' },
    { page: '地標攻略', src: 'docs/guide/landmarks.md', sub: '人物與地點' },
  ] },
  { name: '遊戲系統', pages: [
    { page: '遊戲設計總綱', src: 'docs/GAME_DESIGN.md', desc: '核心原則、遊戲迴圈、報告格式、AI 管線、系統地圖' },
    { page: '戰鬥系統', src: 'docs/COMBAT_SYSTEM.md', desc: '屬性、資源、戰鬥、能力、狀態、敵人 AI、戰敗', sub: '基礎規則' },
    { page: '怪物一覽', src: 'docs/MONSTERS.md', desc: '所有怪物的數值與掉落', sub: '基礎規則' },
    { page: '特質', src: 'docs/PERKS.md', desc: '一直生效的被動，影響所有檢定與戰鬥', sub: '基礎規則' },
    { page: '效果', src: 'docs/EFFECTS.md', desc: '事件、委託、交易、主動行動共用的後果', sub: '基礎規則' },
    { page: '主動行動', src: 'docs/ACTIONS.md', desc: '擲骰、AI 判定、程式夾住後果', sub: '基礎規則' },
    { page: '世界與地點', src: 'docs/WORLD.md', desc: '地點、路線、聚落、走格子', sub: '世界與移動' },
    { page: '地下城', src: 'docs/DUNGEON_DESIGN.md', desc: '地下城分層、光線、安全房、撤退', sub: '世界與移動' },
    { page: '旅途與旅途事件', src: 'docs/TRAVEL_EVENTS.md', desc: '旅途地圖、旅途事件、臨時地圖、情報', sub: '世界與移動' },
    { page: '城鎮的特色地標', src: 'docs/LANDMARKS.md', desc: '地標的開放條件、探索、工作與訓練', sub: '世界與移動' },
    { page: '特殊地圖', src: 'docs/SPECIAL_MAPS.md', desc: '下水道、宮殿內部這類人工設計的地圖', sub: '世界與移動' },
    { page: '房屋', src: 'docs/HOMES.md', desc: '空地、房屋、家具、種植', sub: '世界與移動' },
    { page: '冒險者公會', src: 'docs/GUILD.md', desc: '一般委託、公會階級與晉升', sub: '城鎮與經濟' },
    { page: '商店、交易與談判', src: 'docs/TRADE.md', desc: '商店、價格、交涉、談判', sub: '城鎮與經濟' },
    { page: '物品與裝備', src: 'docs/ITEMS.md', desc: '物品與裝備目錄', sub: '城鎮與經濟' },
    { page: '工藝', src: 'docs/CRAFTING.md', desc: '工藝、委託打造、配方、自創配方', sub: '城鎮與經濟' },
    { page: '工作與娼館', src: 'docs/WORK.md', desc: '打工、娼館、成人向換詞', sub: '城鎮與經濟' },
    { page: 'NPC 系統', src: 'docs/NPC_SYSTEM.md', desc: '名單、活躍地點、互動、警戒與通緝', sub: '人物與關係' },
    { page: '夥伴、休息與奴隸契約', src: 'docs/COMPANIONS.md', desc: '夥伴、休息、奴隸契約、主人的家', sub: '人物與關係' },
    { page: '刺青', src: 'docs/TATTOOS.md', desc: '奴隸印記、誓約印記、普通刺青', sub: '人物與關係' },
    { page: '人際關係與共同記憶', src: 'docs/RELATIONSHIP_MEMORY.md', desc: '關係文字、親密度、共同記憶', sub: '人物與關係' },
    { page: '特殊任務與劇情旗標', src: 'docs/STORY_QUESTS.md', desc: '特殊任務的結構、條件、旗標', sub: '劇情與事件' },
    { page: '事件視窗', src: 'docs/EVENTS.md', desc: '要玩家回應的事件', sub: '劇情與事件' },
    { page: '地下城的色情事件', src: 'docs/ADULT_EVENTS.md', desc: '成人向：地下城色情事件與寄生物', sub: '劇情與事件' },
    { page: '提示詞結構', src: 'docs/PROMPTS.md', desc: 'AI 服務、AI 開關、提示詞結構、快取、世界書注入', sub: 'AI 與呈現' },
    { page: '角色形象插圖', src: 'docs/PORTRAITS.md', desc: '形象圖的生成（OpenAI、NovelAI、ComfyUI）與上傳', sub: 'AI 與呈現' },
    { page: '介面語言', src: 'docs/I18N.md', desc: '繁體／簡體中文的介面與提示詞', sub: 'AI 與呈現' },
    { page: '背景圖', src: 'docs/BACKGROUNDS.md', desc: '依地區、城鎮、地下城換的背景', sub: 'AI 與呈現' },
    { page: '自訂內容', src: 'docs/CONTENT_EDITOR.md', desc: '世界頁籤：修改與新增內容、世界包', sub: '內容與存檔' },
    { page: '內容之間的依賴與保護', src: 'docs/CONTENT_DEPENDENCIES.md', desc: '內容的引用、刪除與改名的保護', sub: '內容與存檔' },
    { page: '存檔', src: 'docs/SAVES.md', desc: '存檔位置、匯出匯入、存檔格式版本', sub: '內容與存檔' },
  ] },
  { name: '世界製作', pages: [
    { page: '世界生成（給 Agent）', src: 'worldgen/README.md', desc: '守則、閱讀順序、指南一覽、完成前的檢查清單' },
    { page: '世界生成指南', src: 'worldgen/WORLD_GUIDE.md', desc: '從零做出一整個世界的步驟' },
    { page: '世界生成模板', src: 'worldgen/templates/world-template.md', desc: '填寫式的世界模板' },
    { page: '世界包與內容檔的格式', src: 'worldgen/guides/content-file.md', desc: '世界包與內容檔的檔案格式', sub: '內容指南' },
    { page: '怪物（製作指南）', src: 'worldgen/guides/monsters.md', desc: '怪物 enemies', sub: '內容指南' },
    { page: '技能（製作指南）', src: 'worldgen/guides/abilities.md', desc: '技能 abilities', sub: '內容指南' },
    { page: '物品、底材與材料（製作指南）', src: 'worldgen/guides/items-gear.md', desc: '物品 items、底材 bases、材料 materials', sub: '內容指南' },
    { page: '狀態、特質、刺青與奴隸印記（製作指南）', src: 'worldgen/guides/statuses-perks-tattoos.md', desc: '狀態、特質、刺青與奴隸印記', sub: '內容指南' },
    { page: '商店（製作指南）', src: 'worldgen/guides/shops.md', desc: '商店 shops', sub: '內容指南' },
    { page: '固定 NPC（製作指南）', src: 'worldgen/guides/npcs.md', desc: '固定 NPC npcs', sub: '內容指南' },
    { page: '特殊任務（製作指南）', src: 'worldgen/guides/stories.md', desc: '特殊任務 stories', sub: '內容指南' },
    { page: '旅途與城鎮事件（製作指南）', src: 'worldgen/guides/events.md', desc: '旅途事件、城鎮事件', sub: '內容指南' },
    { page: '地標（製作指南）', src: 'worldgen/guides/landmarks.md', desc: '地標 landmarks', sub: '內容指南' },
    { page: '特殊地圖（製作指南）', src: 'worldgen/guides/special-maps.md', desc: '特殊地圖 specialMaps', sub: '內容指南' },
    { page: '設計固定 NPC', src: 'worldgen/design/npc-design.md', desc: '固定 NPC 的設計方法', sub: '設計方法' },
    { page: '設計特殊任務', src: 'worldgen/design/story-design.md', desc: '特殊任務的設計方法與節奏', sub: '設計方法' },
    { page: '世界書與提示詞', src: 'worldgen/design/worldbook-and-prompts.md', desc: '世界書的寫法與提示詞組', sub: '設計方法' },
    { page: '內建世界的故事線規劃', src: 'worldgen/design/elondia-storylines.md', desc: '艾隆迪亞的各條故事線', sub: '設計方法' },
    { page: '色情事件與任務線（設計稿）', src: 'worldgen/design/adult-events.md', desc: '成人向事件與任務線的設計稿', sub: '設計方法' },
    { page: '平衡性自檢流程', src: 'worldgen/balance/README.md', desc: '新增內容後的平衡檢查', sub: '平衡' },
    { page: '怪物的平衡', src: 'worldgen/balance/monsters.md', sub: '平衡' },
    { page: '技能的平衡', src: 'worldgen/balance/abilities.md', sub: '平衡' },
    { page: '物品的平衡', src: 'worldgen/balance/items.md', sub: '平衡' },
    { page: '經濟與報酬', src: 'worldgen/balance/economy.md', sub: '平衡' },
    { page: '狀態、特質、刺青的平衡', src: 'worldgen/balance/statuses-perks-tattoos.md', sub: '平衡' },
    { page: '特殊任務的平衡', src: 'worldgen/balance/stories.md', sub: '平衡' },
  ] },
  { name: '開發', pages: [
    { page: '自己建置', src: ['README.md#自己建置', 'README.md#文件與資料'], desc: '建置、測試、發布新版本、資料檔位置' },
    { page: '文件地圖', src: 'docs/README.md', desc: '所有設計文件的階層、依賴關係與維護規則' },
    { page: '內建內容的產生腳本', src: 'worldgen/scripts/elondia/README.md', desc: '艾隆迪亞內建內容的產生腳本與執行順序' },
    { page: '世界生成計畫', src: 'worldgen/PLAN.md', desc: 'worldgen 的工作計畫' },
    { page: '像素素材管線', src: 'tools/pixel/README.md', desc: '像素圖示與地圖格的素材管線' },
    { page: '模組化像素立繪規格', src: 'docs/comfy/portrait-spec.md', desc: '用 ComfyUI 產生立繪素材的規格' },
  ] },
  { name: '計畫與追蹤', pages: [
    { page: '計畫與追蹤', src: 'docs/plan/README.md', desc: '分類、流程、完成紀錄' },
    { page: 'Bug', src: 'docs/plan/BUGS.md', desc: '程式沒有照規則運作的問題' },
    { page: '業務邏輯問題', src: 'docs/plan/LOGIC_ISSUES.md', desc: '程式照設計運作，但規則不合理的地方' },
    { page: '未來計畫', src: 'docs/plan/ROADMAP.md', desc: '已經決定要做的事' },
    { page: '點子庫', src: 'docs/plan/ideas/README.md', desc: '還沒決定要不要做的構想：來源與全部點子一覽' },
    { page: '點子：早期設計', src: 'docs/plan/ideas/early-design.md', desc: '早期設計文件裡還沒做的構想', sub: '點子的來源' },
    { page: '點子：2026 年 10 月盤點', src: 'docs/plan/ideas/review-2026-10.md', desc: '盤點時列出、先不做的項目', sub: '點子的來源' },
    { page: '點子：玩家回饋', src: 'docs/plan/ideas/player-feedback.md', desc: '玩家回饋引出的構想', sub: '點子的來源' },
    { page: '點子：開發討論', src: 'docs/plan/ideas/dev-discussion.md', desc: '開發討論中提出的構想', sub: '點子的來源' },
    { page: 'UI 改版計畫', src: 'docs/plan/UI_V2_PLAN.md', desc: 'UI v2 的分階段計畫' },
  ] },
]

/** 不放上 wiki 的文件：素材資料夾的說明（只對改程式的人有用）、玩家提供的第三方原文素材、以它為素材的成人向企劃 */
export const SKIP = ['src/assets/scenes/README.md', 'src/assets/backgrounds/README.md', 'docs/plan/ideas/xianxia-adult-lorebook.md', 'docs/plan/ideas/lust-combat.md']

const srcList = (p) => (Array.isArray(p.src) ? p.src : [p.src])
const fileOf = (src) => src.split('#')[0]
export const allPages = () => GROUPS.flatMap((g) => g.pages)

/** repo 裡應該出現在 wiki 的文件 */
export function docFiles() {
  const out = ['README.md', 'CHANGELOG.md']
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walk(rel)
      else if (e.name.endsWith('.md')) out.push(rel)
    }
  }
  for (const d of ['docs', 'worldgen', 'tools', 'src/assets']) if (fs.existsSync(path.join(ROOT, d))) walk(d)
  return out.sort()
}

/** 清單有問題時回傳說明（空陣列表示沒問題） */
export function checkManifest() {
  const problems = []
  const listed = new Set(allPages().flatMap((p) => srcList(p).map(fileOf)))
  for (const f of docFiles()) if (!listed.has(f) && !SKIP.includes(f)) problems.push(`${f} 沒有列在 tools/wiki/build.mjs 的 GROUPS 或 SKIP`)
  const names = new Set()
  for (const p of allPages()) {
    if (names.has(p.page)) problems.push(`wiki 頁名重複：${p.page}`)
    names.add(p.page)
    if (/[()[\]/\\#?-]/.test(p.page)) problems.push(`wiki 頁名不能有半形括號、斜線、-、# 或 ?：${p.page}`)
    for (const s of srcList(p)) {
      if (!fs.existsSync(path.join(ROOT, fileOf(s)))) problems.push(`找不到 ${fileOf(s)}（${p.page}）`)
      else if (s.includes('#') && !section(read(fileOf(s)), s.split('#')[1])) problems.push(`${fileOf(s)} 沒有「${s.split('#')[1]}」這一節（${p.page}）`)
    }
  }
  return problems
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')

/** 取出 ## 標題那一節（到下一個同層或更高層的標題為止） */
function section(text, title) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^#{1,6} /.test(l) && l.replace(/^#+ /, '').trim() === title)
  if (start < 0) return null
  const level = lines[start].match(/^#+/)[0].length
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+) /)
    if (m && m[1].length <= level && !inFence(lines, i)) { end = i; break }
  }
  return lines.slice(start, end).join('\n')
}
function inFence(lines, i) {
  let open = false
  for (let k = 0; k < i; k++) if (/^\s*(```|~~~)/.test(lines[k])) open = !open
  return open
}

/** wiki 的檔名：空白換成 -（wiki 顯示頁名時再換回空白） */
export const fileName = (page) => page.replace(/ /g, '-')
/** wiki 的連結：檔名照網址編碼 */
const wikiHref = (page, anchor) => encodeURIComponent(fileName(page)) + (anchor ? `#${anchor}` : '')

/** 把一份文件裡的連結改成 wiki 頁面或 GitHub 上的檔案（程式碼區塊與行內程式碼不動） */
export function rewriteLinks(text, srcFile, ref) {
  const byFile = new Map()
  for (const p of allPages()) for (const s of srcList(p)) if (!byFile.has(fileOf(s)) || !s.includes('#')) byFile.set(fileOf(s), p.page)
  byFile.set('README.md', 'Home')
  const dir = path.posix.dirname(srcFile)
  const fix = (target, image) => {
    if (/^(https?:|mailto:|#)/.test(target)) return target
    const [rawPath, anchor] = target.split('#')
    const rel = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, decodeURIComponent(rawPath)))
    if (!image && byFile.has(rel)) return wikiHref(byFile.get(rel), anchor)
    const exists = fs.existsSync(path.join(ROOT, rel))
    const kind = image ? 'raw' : exists && fs.statSync(path.join(ROOT, rel)).isDirectory() ? 'tree' : 'blob'
    return `https://github.com/${REPO}/${kind}/${encodeURIComponent(ref)}/${rel.split('/').map(encodeURIComponent).join('/')}${anchor ? `#${anchor}` : ''}`
  }
  // 用文件代號當連結文字的（[COMBAT_SYSTEM](COMBAT_SYSTEM.md)）：換成 wiki 的頁名
  const pageLabel = (label, target) => {
    if (/^(https?:|mailto:|#)/.test(target)) return label
    const rel = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, decodeURIComponent(target.split('#')[0])))
    const page = byFile.get(rel)
    const id = path.posix.basename(rel, '.md')
    return page && page !== 'Home' && (label === id || label === `${id}.md` || label === rel) ? page : label
  }
  const lines = text.split('\n')
  let fence = false
  return lines.map((line) => {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return line }
    if (fence) return line
    // 行內程式碼先拿掉，改完再放回去
    const codes = []
    const masked = line.replace(/`[^`]*`/g, (m) => `\u0000${codes.push(m) - 1}\u0000`)
    const done = masked.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (_, bang, label, target, title) => `${bang}[${pageLabel(label, target)}](${fix(target, !!bang)}${title ?? ''})`)
    return done.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)])
  }).join('\n')
}

/** 一頁的內容：來源說明＋（去掉第一個標題的）文件內容 */
function pageBody(p, ref, version) {
  const parts = srcList(p).map((s) => {
    const f = fileOf(s)
    const text = s.includes('#') ? section(read(f), s.split('#')[1]) : read(f).replace(/^# .*\n+/, '')
    return rewriteLinks(text, f, ref)
  })
  const sources = [...new Set(srcList(p).map(fileOf))].map((f) => `[\`${f}\`](https://github.com/${REPO}/blob/${encodeURIComponent(ref)}/${f})`).join('、')
  return `> 這一頁由 repo 的 ${sources} 自動產生（${version}）。要修改請改 repo 裡的檔案；直接在 wiki 上編輯，下次同步時會被覆蓋。\n\n${parts.join('\n\n').trim()}\n`
}

function sidebar() {
  const out = ['**[[首頁|Home]]**', '']
  for (const g of GROUPS) {
    out.push(`**${g.name}**`, '')
    let sub
    for (const p of g.pages) {
      if (p.sub !== sub) {
        sub = p.sub
        if (sub) out.push(`- *${sub}*`)
      }
      out.push(`${sub ? '  ' : ''}- [${p.page}](${wikiHref(p.page)})`)
    }
    out.push('')
  }
  return out.join('\n')
}

function home(ref, version) {
  const readme = read('README.md')
  const intro = readme.split(/\n## /)[0].replace(/^# .*\n+/, '')
  const out = [rewriteLinks(intro, 'README.md', ref).trim(), '', `目前的 wiki 對應 ${version}。線上玩：<https://yellow630914.github.io/ElondiaRPG/>・下載：[Releases](https://github.com/${REPO}/releases)`, '']
  for (const g of GROUPS) {
    out.push(`## ${g.name}`, '', '| 頁面 | 內容 |', '|---|---|')
    for (const p of g.pages) out.push(`| [${p.page}](${wikiHref(p.page)}) | ${[p.sub, p.desc].filter(Boolean).join('：') || '—'} |`)
    out.push('')
  }
  out.push('> 這個 wiki 由 repo 裡的文件自動產生（`tools/wiki/build.mjs`），每次發布新版本時同步。文件以程式為準，見[文件地圖](' + wikiHref('文件地圖') + ')。', '')
  return out.join('\n')
}

export function build(outDir, ref) {
  const version = `v${JSON.parse(read('package.json')).version}`
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const write = (name, body) => fs.writeFileSync(path.join(outDir, `${name}.md`), body)
  write('Home', home(ref, version))
  write('_Sidebar', sidebar())
  write('_Footer', `[ElondiaRPG](https://github.com/${REPO})・${version}・由 repo 的文件自動產生`)
  for (const p of allPages()) write(fileName(p.page), pageBody(p, ref, version))
  return allPages().length + 3
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkManifest()
  if (problems.length) {
    console.error(problems.join('\n'))
    process.exit(1)
  }
  if (process.argv.includes('--check')) {
    console.log(`清單沒問題：${allPages().length} 頁`)
  } else {
    const out = path.resolve(arg('out', path.join(ROOT, 'wiki-out')))
    const ref = arg('ref', `v${JSON.parse(read('package.json')).version}`)
    console.log(`產生 ${build(out, ref)} 個檔案到 ${out}（連結指向 ${ref}）`)
  }
}
