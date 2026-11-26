// MOSS-Image 原生支援（docs/PORTRAITS.md 第 5.1 節）：相對版面 → MOSS 版面 JSON、工作流程、匯入、預處理、日誌插圖的分鏡
import { describe, expect, it } from 'vitest'
import { applyMossProfile, buildWorkflow, newPreset, presetFromWorkflow, promptPrefix, sanitizePreset, type ComfyNode } from '@/narrator/comfy'
import { BUILTIN_PREPROCESSORS, cleanPreprocessed } from '@/narrator/imageInfo'
import { appendPrompt, layoutText, mossLayoutJson, parseLayout, positionBox } from '@/narrator/mossLayout'
import { composeScene, parseScenePlan } from '@/narrator/sceneInfo'

const nodes = (wf: Record<string, ComfyNode>, type: string) => Object.values(wf).filter((n) => n.class_type === type)

describe('relative layout', () => {
  it('reads percent ranges, ratios and boxes, and repairs bad ones', () => {
    const l = parseLayout('```json\n{"caption": "a girl", "items": [' +
      '{"label": "character", "caption": "girl", "x": [70, 30], "y": [-5, 120]},' +
      '{"label": "object", "caption": "hand", "box": [0.2, 0.3, 0.4, 0.5]},' +
      '{"label": "text", "caption": "sign"},' +
      '{"label": "text", "caption": "sign", "x": "10-20%", "y": [5, 6], "text": "AKIBARA"},' +
      '{"label": "weird", "caption": "lamp", "x": [50, 50.5], "y": [1, 2]}' +
      '], "negative": ["gloves", "twintails"]}\n```')
    expect(l.caption).toBe('a girl')
    expect(l.items[0]).toEqual({ label: 'character', caption: 'girl', x: [30, 70], y: [0, 100] })
    expect(l.items[1]).toMatchObject({ x: [20, 40], y: [30, 50] })
    // 沒有範圍的框丟掉；沒有字的文字框當成物件；太小的撐開
    expect(l.items).toHaveLength(4)
    expect(l.items[2]).toMatchObject({ label: 'text', text: 'AKIBARA', x: [10, 20] })
    expect(l.items[3]!.label).toBe('object')
    expect(l.items[3]!.x[1] - l.items[3]!.x[0]).toBeGreaterThanOrEqual(3)
    expect(l.negative).toBe('gloves, twintails')
    // 不是 JSON：整段當成描述
    expect(parseLayout('1girl, solo, smile')).toEqual({ caption: '1girl, solo, smile', items: [] })
  })

  it('converts to MOSS coordinates for each canvas (centre origin, pixels, y first)', () => {
    const l = { caption: 'scene', items: [{ label: 'character' as const, caption: 'girl', x: [30, 70] as [number, number], y: [10, 100] as [number, number] }] }
    const j = JSON.parse(mossLayoutJson(l, 832, 1216, 'masterpiece, '))
    expect(j.summary.caption).toBe('masterpiece, scene')
    expect(j.items[0].bbox).toEqual([Math.round(0.1 * 1216 - 608), Math.round(0.3 * 832 - 416), 608, Math.round(0.7 * 832 - 416)])
    expect(j).toMatchObject({ bbox_coord_space: 'abs_centralized', bbox_format: 'yxyx' })
    // 同一份版面換成兩倍的畫布：座標跟著兩倍
    const k = JSON.parse(mossLayoutJson(l, 1664, 2432))
    expect(k.items[0].bbox[3]).toBe(Math.round(0.7 * 1664 - 832))
  })
})

describe('MOSS workflow', () => {
  function preset() {
    const p = newPreset('m', 'moss', 'moss')
    Object.assign(p, { unet: 'moss_image_base.safetensors', clips: ['qwen3.5_9b.safetensors'], vae: 'flux2-vae.safetensors' })
    p.loras = [
      { name: 'MOSS\\dmd2.safetensors', strength: 1, on: true, trigger: '' },
      { name: 'lighting.safetensors', strength: -0.8, on: true },
      { name: 'style.safetensors', strength: 0.5, on: true, trigger: '@sky02v1moss' },
      { name: 'off.safetensors', strength: 1, on: false, trigger: 'unused' },
    ]
    return p
  }

  it('chains model-only LoRAs, shift and SLG, and sends the layout JSON', () => {
    const p = preset()
    expect(p).toMatchObject({ clipType: 'moss_image', shift: 5, slg: { on: true, layers: '22' }, width: 1024, height: 1536 })
    expect(promptPrefix(p)).toBe('masterpiece, best quality, very aesthetic, absurdres, @sky02v1moss')
    const prompt = layoutText({ caption: 'a girl at a desk', items: [{ label: 'object', caption: 'her hands', x: [35, 65], y: [44, 63] }], negative: 'gloves' })
    const wf = buildWorkflow(p, { prompt, seed: 7 })
    expect(nodes(wf, 'LoraLoaderModelOnly').map((n) => n.inputs.strength_model)).toEqual([1, -0.8, 0.5])
    expect(nodes(wf, 'LoraLoader')).toHaveLength(0)
    expect(nodes(wf, 'CLIPLoader')[0]!.inputs).toMatchObject({ clip_name: 'qwen3.5_9b.safetensors', type: 'moss_image' })
    expect(nodes(wf, 'ModelSamplingAuraFlow')[0]!.inputs.shift).toBe(5)
    expect(nodes(wf, 'SkipLayerGuidanceDiTSimple')[0]!.inputs).toMatchObject({ single_layers: '22', start_percent: 0, end_percent: 0.5 })
    expect(nodes(wf, 'EmptyFlux2LatentImage')[0]!.inputs).toMatchObject({ width: 1024, height: 1536 })
    const [pos, neg] = nodes(wf, 'CLIPTextEncode')
    const layout = JSON.parse(pos!.inputs.text as string)
    expect(layout.summary.caption).toBe('masterpiece, best quality, very aesthetic, absurdres, @sky02v1moss, a girl at a desk')
    expect(layout.items[0].bbox).toEqual([Math.round(0.44 * 1536 - 768), Math.round(0.35 * 1024 - 512), Math.round(0.63 * 1536 - 768), Math.round(0.65 * 1024 - 512)])
    expect(neg!.inputs.text).toBe(`${p.negative}, gloves`)
    // 橫的場景插圖：照這次的尺寸換算
    const wide = buildWorkflow(p, { prompt, seed: 7, width: 1536, height: 1024 })
    expect(JSON.parse(nodes(wide, 'CLIPTextEncode')[0]!.inputs.text as string).items[0].bbox[1]).toBe(Math.round(0.35 * 1536 - 768))
  })

  it('re-encodes the layout for the enlarged canvas of the second pass', () => {
    const p = preset()
    p.hires.on = true
    p.shift = 0
    p.slg.on = false
    const wf = buildWorkflow(p, { prompt: layoutText({ caption: 'x', items: [{ label: 'character', caption: 'g', x: [0, 100], y: [0, 100] }] }), seed: 1 })
    expect(nodes(wf, 'ModelSamplingAuraFlow')).toHaveLength(0)
    expect(nodes(wf, 'SkipLayerGuidanceDiTSimple')).toHaveLength(0)
    const [first, second] = nodes(wf, 'CLIPTextEncode').filter((n) => String(n.inputs.text).startsWith('{')).map((n) => JSON.parse(n.inputs.text as string) as { items?: { bbox: number[] }[] })
    expect(first!.items![0]!.bbox).toEqual([-768, -512, 768, 512])
    expect(second!.items![0]!.bbox).toEqual([-1536, -1024, 1536, 1024])
    expect(nodes(wf, 'KSampler')[1]!.inputs.denoise).toBe(0.65)
  })

  it('switches between the standard and the 8-step profile, and keeps the new fields when saved', () => {
    const p = preset()
    applyMossProfile(p, 'turbo')
    expect(p).toMatchObject({ steps: 12, cfg: 1.5, scheduler: 'beta', shift: 0 })
    const again = sanitizePreset(JSON.parse(JSON.stringify(p)))
    expect(again.mode).toBe('moss')
    expect(again.loras[2]!.trigger).toBe('@sky02v1moss')
    expect(again.slg).toEqual(p.slg)
  })

  it('imports a MOSS workflow as a MOSS preset', () => {
    const wf = {
      1: { class_type: 'UNETLoader', inputs: { unet_name: 'moss_image_base_int8_convrot.safetensors', weight_dtype: 'default' } },
      2: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3.5_9b.safetensors', type: 'moss_image' } },
      3: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
      10: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['1', 0], lora_name: 'MOSS\\Munji.safetensors', strength_model: 0.8 } },
      15: { class_type: 'SkipLayerGuidanceDiTSimple', inputs: { model: ['10', 0], double_layers: '', single_layers: '22', start_percent: 0, end_percent: 0.5 } },
      4: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: '{}' } },
      5: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: 'worst quality' } },
      6: { class_type: 'EmptyFlux2LatentImage', inputs: { width: 1024, height: 1024, batch_size: 1 } },
      7: { class_type: 'KSampler', inputs: { model: ['15', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0], seed: 1, steps: 35, cfg: 3, sampler_name: 'er_sde', scheduler: 'simple', denoise: 1 } },
      8: { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['3', 0] } },
      9: { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'x' } },
    }
    const r = presetFromWorkflow(JSON.stringify(wf))
    expect(r.preset).toMatchObject({ mode: 'moss', unet: 'moss_image_base_int8_convrot.safetensors', clipType: 'moss_image', vae: 'flux2-vae.safetensors', steps: 35, cfg: 3, sampler: 'er_sde', negative: 'worst quality', width: 1024, height: 1024, shift: 0, slg: { on: true, layers: '22' } })
    expect(r.preset.loras).toEqual([{ name: 'MOSS\\Munji.safetensors', strength: 0.8, on: true }])
    expect(r.skipped).toEqual([])
  })
})

describe('MOSS prompts', () => {
  it('adds a figure box from the composition when the AI forgot it', () => {
    const moss = BUILTIN_PREPROCESSORS.find((p) => p.id === 'moss')!
    expect(moss.output).toBe('layout')
    const out = parseLayout(cleanPreprocessed('{"caption": "an elf archer", "items": []}', 'layout', 'Composition: full body, facing the viewer'))
    expect(out.items[0]).toMatchObject({ label: 'character', x: [28, 72], y: [3, 97] })
  })

  it('refuses a broken layout instead of sending the raw text', () => {
    // AI 偶爾寫出不合法的 JSON（實測 [26, 38, 0][0:2]）：當錯誤，讓玩家重試
    expect(() => cleanPreprocessed('{"caption": "a girl", "items": [{"label": "object", "caption": "hand", "x": [26, 38, 0][0:2], "y": [52, 66]}]}', 'layout')).toThrow(/JSON/)
    expect(() => cleanPreprocessed('1girl, solo, smile', 'layout')).toThrow(/JSON/)
  })

  it('adds tweak words to the caption of a layout, not after the JSON', () => {
    const prompt = layoutText({ caption: 'a ranger girl', items: [{ label: 'character', caption: 'girl', x: [20, 80], y: [3, 100] }] })
    const out = appendPrompt(prompt, 'smile, happy', '', 'blue cloak')
    expect(parseLayout(out)).toEqual({ caption: 'a ranger girl, smile, happy, blue cloak', items: parseLayout(prompt).items })
    // 送出的版面 JSON 也看得到
    const p = newPreset('m', 'moss', 'moss')
    expect(JSON.parse(nodes(buildWorkflow(p, { prompt: out, seed: 1 }), 'CLIPTextEncode')[0]!.inputs.text as string).summary.caption).toContain('smile, happy, blue cloak')
    // 一般的提示詞照舊接在最後；沒東西要加時原樣
    expect(appendPrompt('1girl, solo', 'smile')).toBe('1girl, solo, smile')
    expect(appendPrompt(prompt)).toBe(prompt)
  })

  it('plans scene boxes and fills in missing ones from the left / right positions', () => {
    const cast = [{ id: 'pc', name: '艾倫', player: true, description: '' }, { id: 'npc_a', name: '阿雅', player: false, description: '' }]
    const plan = parseScenePlan({
      scene: 'two girls in a tavern', negative: 'gloves',
      characters: [{ id: 'pc', position: 'left', prompt: 'girl A', x: [5, 45], y: [10, 100] }, { id: 'npc_a', position: 'right', prompt: 'girl B' }],
      items: [{ label: 'object', caption: 'a mug', x: [40, 50], y: [60, 70] }],
    }, cast, false)
    const l = parseLayout(composeScene(plan, 'comfyui', false, false, 'anime style', true).prompt)
    expect(l.caption).toBe('two girls in a tavern, anime style')
    expect(l.items.map((i) => i.label)).toEqual(['character', 'character', 'object'])
    expect(l.items[0]).toMatchObject({ x: [5, 45], y: [10, 100] })
    expect(l.items[1]).toMatchObject(positionBox('right', 2))
    expect(l.negative).toBe('gloves')
  })
})
