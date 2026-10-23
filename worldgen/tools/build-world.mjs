// 把一個世界的分檔（worldgen/worlds/<代號>/parts/*.json）合併成世界包 world.json。
// 用法：node worldgen/tools/build-world.mjs <代號>
//
// - parts/meta.json：{ "name": "...", "desc": "..." }（世界包的名稱與說明）
// - parts/prompts.json：提示詞（世界包的 prompts，見 guides/content-file.md 第 5 節）
// - 其他 parts/*.json：{ "<區塊>": { "<id>": {...} } }，例如 parts/npcs-central.json 放 { "npcs": {...} }
// 同一個區塊可以分在好幾個檔案；id 重複時停下來並列出。檔名依字母順序合併。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const name = process.argv[2]
if (!name) {
  console.error('用法：node worldgen/tools/build-world.mjs <世界的代號>')
  process.exit(1)
}
const dir = join('worldgen', 'worlds', name)
const partsDir = join(dir, 'parts')
const files = readdirSync(partsDir).filter((f) => f.endsWith('.json')).sort()
const content = {}
let meta = { name }
let prompts
const dup = []
for (const f of files) {
  const data = JSON.parse(readFileSync(join(partsDir, f), 'utf8'))
  if (f === 'meta.json') {
    meta = { ...meta, ...data }
    continue
  }
  if (f === 'prompts.json') {
    prompts = data
    continue
  }
  for (const [section, entries] of Object.entries(data)) {
    if (section.startsWith('$')) continue
    const target = (content[section] ??= {})
    for (const [id, v] of Object.entries(entries)) {
      if (id.startsWith('$')) continue
      if (id in target) dup.push(`${section}.${id}（${f}）`)
      target[id] = v
    }
  }
}
if (dup.length) {
  console.error(`id 重複：\n${dup.join('\n')}`)
  process.exit(1)
}
const pkg = { type: 'elondia-world', version: 1, name: meta.name, ...(meta.desc ? { desc: meta.desc } : {}), content, ...(prompts ? { prompts } : {}) }
writeFileSync(join(dir, 'world.json'), JSON.stringify(pkg, null, 1))
const counts = Object.entries(content).map(([k, v]) => `${k} ${Object.keys(v).length}`).join('、')
console.log(`已寫入 ${join(dir, 'world.json')}：${counts}${prompts ? '、提示詞' : ''}`)
