import { afterEach, describe, expect, it } from 'vitest'
import { applyUiLanguage, flushUiConversion, toSimplifiedUi } from '@/i18n/uiScript'

afterEach(() => {
  applyUiLanguage('zh-Hant')
  document.body.innerHTML = ''
})

describe('介面語言：簡體中文', () => {
  it('連用語一起轉成簡體', () => {
    expect(toSimplifiedUi('設定・儲存・匯出')).toBe('设置・保存・导出')
    expect(toSimplifiedUi('HP 10/20')).toBe('HP 10/20')
    // 遊戲裡的說法
    expect(toSimplifiedUi('存檔欄位・複製・角色設定')).toBe('存档栏位・复制・角色设定')
  })

  it('轉換畫面上的文字與屬性，不動輸入框的值、pre 與 data-no-convert', () => {
    document.body.innerHTML = `
      <button title="儲存遊戲">儲存</button>
      <input placeholder="輸入名字" value="龍騎士">
      <textarea>舊的設定</textarea>
      <pre>送給 AI 的設定</pre>
      <div data-no-convert>AI 寫的經過</div>`
    applyUiLanguage('zh-Hans')
    expect(document.documentElement.lang).toBe('zh-Hans')
    const btn = document.querySelector('button')!
    expect(btn.textContent).toBe('保存')
    expect(btn.title).toBe('保存游戏')
    const input = document.querySelector('input')!
    expect(input.placeholder).toBe('输入名字')
    expect(input.value).toBe('龍騎士')
    expect(document.querySelector('textarea')!.value).toBe('舊的設定')
    expect(document.querySelector('pre')!.textContent).toBe('送給 AI 的設定')
    expect(document.querySelector('[data-no-convert]')!.textContent).toBe('AI 寫的經過')
  })

  it('之後加上或改掉的文字也會轉換', async () => {
    applyUiLanguage('zh-Hans')
    const p = document.createElement('p')
    p.textContent = '冒險者公會'
    document.body.append(p)
    await Promise.resolve()
    flushUiConversion()
    expect(p.textContent).toBe('冒险者公会')
    p.firstChild!.nodeValue = '選單'
    await Promise.resolve()
    flushUiConversion()
    expect(p.textContent).toBe('菜单')
  })

  it('切回繁體時換回原文；程式改過的文字保持不變', async () => {
    document.body.innerHTML = '<span id="a">設定</span><span id="b">儲存</span>'
    applyUiLanguage('zh-Hans')
    const b = document.getElementById('b')!
    b.firstChild!.nodeValue = '已更新'
    applyUiLanguage('zh-Hant')
    expect(document.documentElement.lang).toBe('zh-Hant')
    expect(document.getElementById('a')!.textContent).toBe('設定')
    expect(b.textContent).toBe('已更新')
  })

  it('alert／confirm 的訊息也轉換，切回後恢復原本的函式', () => {
    const seen: string[] = []
    const orig = window.confirm
    window.confirm = (m?: string) => (seen.push(String(m)), true)
    try {
      applyUiLanguage('zh-Hans')
      window.confirm('確定要刪除存檔嗎？')
      applyUiLanguage('zh-Hant')
      window.confirm('確定')
      expect(seen).toEqual(['确定要删除存档吗？', '確定'])
    } finally {
      window.confirm = orig
    }
  })
})
