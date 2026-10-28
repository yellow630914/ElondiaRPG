import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { BLOCKS, fill } from './docTables'

// 資料整理型文件要和資料檔一致；UPDATE_DOCS=1（npm run docs:gen）時直接重寫文件
describe('generated doc tables', () => {
  for (const file of [...new Set(BLOCKS.map((b) => b.file))]) {
    it(`${file} matches the data files`, () => {
      const text = readFileSync(file, 'utf8')
      const next = fill(text, BLOCKS.filter((b) => b.file === file))
      if (process.env.UPDATE_DOCS) writeFileSync(file, next)
      else expect(next === text, `${file} 和資料檔不一致：執行 npm run docs:gen 重新產生`).toBe(true)
    })
  }
})
