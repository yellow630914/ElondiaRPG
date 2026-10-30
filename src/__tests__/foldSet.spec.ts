// @vitest-environment jsdom
// 可以收起的區塊（FoldSet）：預設展開；收起的狀態依區塊記住；收起時內容還在，有填東西時標「有設定」
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import FoldSet from '@/components/content/FoldSet.vue'

const Host = defineComponent({
  props: { value: { type: String, default: '' }, startFolded: Boolean },
  setup: (p) => () => h(FoldSet, { startFolded: p.startFolded }, { legend: () => '基本', default: () => h('input', { value: p.value }) }),
})

describe('FoldSet', () => {
  beforeEach(() => localStorage.clear())

  it('starts open unless asked to start folded', async () => {
    const w = mount(Host)
    await nextTick()
    expect(w.find('fieldset').classes()).not.toContain('folded')
    const f = mount(Host, { props: { startFolded: true } })
    await nextTick()
    expect(f.find('fieldset').classes()).toContain('folded')
  })

  it('remembers folding per section and marks folded sections that have something filled in', async () => {
    const w = mount(Host, { props: { value: '巨鼠' } })
    await nextTick()
    await w.find('.fold-btn').trigger('click')
    expect(w.find('fieldset').classes()).toContain('folded')
    expect(w.find('input').exists()).toBe(true)
    expect(w.find('.fold-mark').exists()).toBe(true)
    const again = mount(Host)
    await nextTick()
    expect(again.find('fieldset').classes()).toContain('folded')
    expect(again.find('.fold-mark').exists()).toBe(false)
  })
})
