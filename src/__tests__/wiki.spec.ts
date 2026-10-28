import { describe, expect, it } from 'vitest'
// @ts-expect-error 產生 wiki 的腳本是純 JS（tools/wiki/build.mjs），沒有型別宣告
import { checkManifest, rewriteLinks } from '../../tools/wiki/build.mjs'

describe('GitHub wiki pages', () => {
  it('lists every doc in the wiki manifest', () => {
    expect(checkManifest()).toEqual([])
  })

  it('turns doc links into wiki pages and other links into files on GitHub', () => {
    const out = rewriteLinks('見 [COMBAT_SYSTEM](COMBAT_SYSTEM.md#9-能力) 與 [程式](../src/engine/combat.ts)，`[不動](X.md)`', 'docs/ACTIONS.md', 'v1.0.0') as string
    expect(out).toContain(`[戰鬥系統](${encodeURIComponent('戰鬥系統')}#9-能力)`)
    expect(out).toContain('[程式](https://github.com/yellow630914/ElondiaRPG/blob/v1.0.0/src/engine/combat.ts)')
    expect(out).toContain('`[不動](X.md)`')
  })
})
