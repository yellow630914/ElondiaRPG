import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// 遊戲攻略（docs/guide/）由 worldgen/tools/guide/guide.py 依遊戲資料產生：改了 data/ 之後要重跑，不然這裡會失敗
const python = (() => {
  try {
    execFileSync('python3', ['--version'])
    return true
  } catch {
    return false
  }
})()

describe('game guide pages', () => {
  it.skipIf(!python)('are up to date with the game data', () => {
    let out = ''
    try {
      out = execFileSync('python3', ['worldgen/tools/guide/guide.py', '--check'], { encoding: 'utf8' })
    } catch (e) {
      out = String((e as { stdout?: string }).stdout ?? e)
    }
    expect(out).toContain('docs/guide/ 是最新的')
  }, 60_000)
})
