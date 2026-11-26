// 圖像設定的用途分配：形象插圖、日誌插圖、成人場景各用哪個服務（docs/PORTRAITS.md 第 1 節）
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImageSettings } from '@/stores/image'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('image services by use', () => {
  it('falls back from adult scenes to scenes to portraits', () => {
    const image = useImageSettings()
    image.service = 'openai'
    expect([image.sceneService(false), image.sceneService(true)]).toEqual(['openai', 'openai'])
    image.sceneGeneralService = 'comfyui'
    expect([image.sceneService(false), image.sceneService(true)]).toEqual(['comfyui', 'comfyui'])
    image.sceneAdultService = 'novelai'
    expect([image.sceneService(false), image.sceneService(true)]).toEqual(['comfyui', 'novelai'])
    expect(image.usedServices()).toEqual(['openai', 'comfyui', 'novelai'])
  })

  it('keeps old settings (no scene service) and saves the new one', async () => {
    localStorage.setItem('elondia.image', JSON.stringify({ service: 'novelai', sceneAdultService: 'comfyui' }))
    setActivePinia(createPinia())
    const image = useImageSettings()
    expect(image.sceneGeneralService).toBe('')
    expect(image.sceneService(false)).toBe('novelai')
    image.sceneGeneralService = 'openai'
    await new Promise((r) => setTimeout(r, 0))
    setActivePinia(createPinia())
    expect(useImageSettings().sceneService(false)).toBe('openai')
  })

  it('adds a MOSS preset ready for the MOSS layout', () => {
    const image = useImageSettings()
    const p = image.addPreset('moss')
    expect(p).toMatchObject({ mode: 'moss', clipType: 'moss_image', slg: { on: true } })
    expect(image.preset().id).toBe(p.id)
  })
})
