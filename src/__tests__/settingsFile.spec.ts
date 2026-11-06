import { beforeEach, describe, expect, it } from 'vitest'
import { applySettingsFile, buildSettingsFile, fillKeys, hasKeys, keysNotCarried, parseSettingsFile, stripKeys } from '@/stores/settingsFile'

const settings = { sources: [{ name: '來源 1', provider: 'openai', configs: { openai: { apiKey: 'sk-home', model: 'gpt' }, vertex: { apiKey: '{"private_key":"x"}', model: 'g' } } }], effects: 'auto' }
const image = { service: 'novelai', configs: { novelai: { apiKey: 'pst-home', baseURL: 'https://x', model: 'nai' } } }

describe('settings export and import', () => {
  beforeEach(() => localStorage.clear())

  it('strips every API key unless asked, and knows when keys are there', () => {
    const s = stripKeys(settings)
    expect(s.sources[0]!.configs.openai.apiKey).toBe('')
    expect(s.sources[0]!.configs.vertex.apiKey).toBe('')
    expect(s.sources[0]!.configs.openai.model).toBe('gpt')
    expect(settings.sources[0]!.configs.openai.apiKey).toBe('sk-home')
    expect(hasKeys(settings)).toBe(true)
    expect(hasKeys(s)).toBe(false)
  })

  it('keeps the keys already on this computer when the file has none', () => {
    const incoming = { sources: [{ configs: { openai: { apiKey: '', model: 'new' } } }] }
    const current = { sources: [{ configs: { openai: { apiKey: 'sk-work', model: 'old' } } }] }
    expect(fillKeys(incoming, current)).toEqual({ sources: [{ configs: { openai: { apiKey: 'sk-work', model: 'new' } } }] })
    expect(fillKeys({ apiKey: 'sk-file' }, { apiKey: 'sk-work' })).toEqual({ apiKey: 'sk-file' })
  })

  it('does not pair this computer\'s key with a different server from the file', () => {
    const current = { sources: [{ configs: { openai_compatible: { apiKey: 'sk-mine', baseURL: 'https://my-proxy/v1', model: 'a' } } }] }
    const dropped: string[] = []
    const other = fillKeys({ sources: [{ configs: { openai_compatible: { apiKey: '', baseURL: 'https://someone-else/v1', model: 'b' } } }] }, current, dropped)
    expect(other.sources[0]!.configs.openai_compatible.apiKey).toBe('')
    expect(dropped).toHaveLength(1)
    // 同一個網址（結尾斜線不算）照樣沿用
    const same = fillKeys({ sources: [{ configs: { openai_compatible: { apiKey: '', baseURL: 'https://my-proxy/v1/', model: 'b' } } }] }, current)
    expect(same.sources[0]!.configs.openai_compatible.apiKey).toBe('sk-mine')
    localStorage.setItem('elondia.settings', JSON.stringify(current))
    const file = parseSettingsFile(JSON.stringify({ kind: 'elondia-settings', version: 1, keys: false, parts: { settings: { sources: [{ configs: { openai_compatible: { apiKey: '', baseURL: 'https://someone-else/v1' } } }] } } }))
    expect(keysNotCarried(file, ['settings'])).toBe(1)
  })

  it('round-trips through a file to another browser', () => {
    localStorage.setItem('elondia.settings', JSON.stringify(settings))
    localStorage.setItem('elondia.image', JSON.stringify(image))
    const file = parseSettingsFile(JSON.stringify(buildSettingsFile(false)))
    expect(file.keys).toBe(false)
    expect(Object.keys(file.parts)).toEqual(['settings', 'image'])
    expect(JSON.stringify(file)).not.toContain('sk-home')

    // 另一台電腦：有自己的金鑰
    localStorage.clear()
    localStorage.setItem('elondia.settings', JSON.stringify({ ...settings, effects: 'off', sources: [{ ...settings.sources[0], configs: { openai: { apiKey: 'sk-work', model: 'x' } } }] }))
    expect(applySettingsFile(file, ['settings'])).toEqual(['settings'])
    const after = JSON.parse(localStorage.getItem('elondia.settings')!)
    expect(after.effects).toBe('auto')
    expect(after.sources[0].configs.openai).toEqual({ apiKey: 'sk-work', model: 'gpt' })
    // 沒勾的部分不動
    expect(localStorage.getItem('elondia.image')).toBeNull()

    // 帶金鑰的檔案
    localStorage.setItem('elondia.settings', JSON.stringify(settings))
    const withKeys = buildSettingsFile(true)
    expect(withKeys.keys).toBe(true)
    expect(JSON.stringify(withKeys)).toContain('sk-home')
  })

  it('says clearly when the file is something else', () => {
    expect(() => parseSettingsFile('not json')).toThrow('不是 JSON')
    expect(() => parseSettingsFile(JSON.stringify({ state: {} }))).toThrow('這不是設定檔')
    expect(() => parseSettingsFile(JSON.stringify({ kind: 'elondia-settings', parts: {} }))).toThrow('沒有任何設定')
  })
})
