// @vitest-environment jsdom
// 共用的劇情條件編輯器（RequiresEditor）：打開時不改條件；加減旗標時換掉整個物件，空的欄位拿掉
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { StoryCond } from '@/engine/data'
import RequiresEditor from '@/components/content/RequiresEditor.vue'

function setup(cond: StoryCond, props: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const updates: StoryCond[] = []
  const wrapper = mount(RequiresEditor, {
    props: { modelValue: cond, label: '解鎖條件', 'onUpdate:modelValue': (v: StoryCond) => updates.push(v), ...props },
    global: { plugins: [pinia] },
  })
  return { wrapper, updates }
}

describe('RequiresEditor', () => {
  it('does not touch the condition when opened', async () => {
    const cond: StoryCond = { flags: ['a'], flags_none: ['b'], counters: { human_stance: { min: 1 } } }
    const before = JSON.stringify(cond)
    const { updates } = setup(cond, { affinity: true })
    await nextTick()
    expect(updates).toEqual([])
    expect(JSON.stringify(cond)).toBe(before)
  })

  it('adds and removes required flags, dropping the empty list', async () => {
    const { wrapper, updates } = setup({ flags: ['a'] })
    const input = wrapper.findAll('input.flag-text')[0]!
    await input.setValue('b')
    await input.trigger('change')
    expect(updates.at(-1)).toEqual({ flags: ['a', 'b'] })
    await wrapper.setProps({ modelValue: { flags: ['a'] } })
    await wrapper.find('.flag-input .x').trigger('click')
    expect(updates.at(-1)).toEqual({})
  })

  it('opens "more conditions" only when something there is set', async () => {
    expect(setup({ flags: ['a'] }).wrapper.find('details.more').attributes('open')).toBeUndefined()
    expect(setup({ flags_any: ['x'] }).wrapper.find('details.more').attributes('open')).toBeDefined()
    expect(setup({ affinity: { npc_selene: 20 } }, { affinity: true }).wrapper.find('details.more summary').text()).toContain('≥ 20')
  })

  it('hides the extras where the engine has none', () => {
    const { wrapper } = setup({}, { extras: false })
    expect(wrapper.find('details.more').exists()).toBe(false)
    expect(wrapper.findAll('.flag-input')).toHaveLength(2)
  })
})
