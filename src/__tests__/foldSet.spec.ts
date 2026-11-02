// @vitest-environment jsdom
// 可以收起的區塊（FoldSet）：空的先收起、有設定的照記住的樣子（預設展開）；收起時內容還在，有設定時標「有設定」
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import FoldSet from '@/components/content/FoldSet.vue'

const Host = defineComponent({
  props: { value: { type: String, default: '' }, startFolded: Boolean, chip: Boolean, filled: Boolean },
  setup: (p) => () => h(FoldSet, { startFolded: p.startFolded, filled: p.filled }, {
    legend: () => '基本',
    default: () => [h('input', { value: p.value }), p.chip ? h('span', ['撕裂', h('button', '✕')]) : null],
  }),
})

describe('FoldSet', () => {
  beforeEach(() => localStorage.clear())

  it('starts open when something is set, folded when empty or asked to start folded', async () => {
    const w = mount(Host, { props: { value: '巨鼠' } })
    await nextTick()
    expect(w.find('fieldset').classes()).not.toContain('folded')
    const empty = mount(Host)
    await nextTick()
    expect(empty.find('fieldset').classes()).toContain('folded')
    expect(empty.find('.fold-mark').exists()).toBe(false)
    const f = mount(Host, { props: { value: '巨鼠', startFolded: true } })
    await nextTick()
    expect(f.find('fieldset').classes()).toContain('folded')
  })

  it('counts removable rows and editor-declared data as set', async () => {
    const chip = mount(Host, { props: { chip: true } })
    await nextTick()
    expect(chip.find('fieldset').classes()).not.toContain('folded')
    const filled = mount(Host, { props: { filled: true } })
    await nextTick()
    expect(filled.find('fieldset').classes()).not.toContain('folded')
  })

  it('remembers folding per section and marks folded sections that have something filled in', async () => {
    const w = mount(Host, { props: { value: '巨鼠' } })
    await nextTick()
    await w.find('.fold-btn').trigger('click')
    expect(w.find('fieldset').classes()).toContain('folded')
    expect(w.find('input').exists()).toBe(true)
    expect(w.find('.fold-mark').exists()).toBe(true)
    const again = mount(Host, { props: { value: '灰狼' } })
    await nextTick()
    expect(again.find('fieldset').classes()).toContain('folded')
    expect(again.find('.fold-mark').exists()).toBe(true)
  })
})
