import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildWorkflow, comboOptions, newPreset, pickOutputImage, presetFromLegacy, presetFromWorkflow, promptErrorText, resolveLora, } from '@/narrator/comfy';
import { DEFAULT_COMFY_WORKFLOW, IMAGE_SERVICES } from '@/narrator/imageInfo';
import { generateImage } from '@/narrator/imageProviders';
import { useImageSettings } from '@/stores/image';
import anima from './fixtures/comfy-anima.json';
import illu from './fixtures/comfy-illu.json';
const ANIMA = JSON.stringify(anima);
const ILLU = JSON.stringify(illu);
/** 伺服器上的 LoRA（有子資料夾，名稱和 LoraManager 寫的不完全一樣） */
const LORAS = [
    'anima/anima-highres-aesthetic-boost.safetensors', 'anima/anima-base-1-masterpiece-v51.safetensors', 'anima/anima-turbo-lora-v0.2.safetensors',
    'anima/anima-base-1-light-concepts-v31.safetensors', 'style/Artistic_anime_update_64d32a.safetensors', 'anima/anima-base-1-photo-background-v4.safetensors',
    'style/Cyaniji v1.safetensors', 'gpt-image-2_anima-base1_v1-1.safetensors',
    'add-detail-xl.safetensors', 'detailed hand focus style illustriousXL v1.safetensors', 'eye_focus_illus.safetensors',
];
const cfg = (patch = {}) => ({ apiKey: '', ...IMAGE_SERVICES.find((s) => s.id === 'comfyui').defaults, ...patch });
describe('importing a workflow into a preset', () => {
    it('reads an Anima UNet workflow with LoraManager nodes and hires fix', () => {
        const r = presetFromWorkflow(ANIMA, LORAS);
        expect(r.name).toBe('anima_aestheticV11');
        expect(r.preset).toMatchObject({
            mode: 'unet', unet: 'anima_aestheticV11.safetensors', weightDtype: 'default',
            clips: ['qwen_3_06b_base.safetensors'], clipType: 'stable_diffusion', vae: 'qwen_image_vae.safetensors',
            width: 464, height: 768, steps: 30, cfg: 5, sampler: 'er_sde', scheduler: 'simple',
        });
        expect(r.preset.hires).toMatchObject({ on: true, scale: 2, method: 'bicubic', steps: 12, cfg: 7 });
        expect(r.preset.hires.denoise).toBeCloseTo(0.7);
        // 依套用順序：靠近模型的節點（169）先
        expect(r.preset.loras.map((l) => [l.name, l.strength])).toEqual([
            ['anima/anima-highres-aesthetic-boost.safetensors', 0.5], ['anima/anima-base-1-masterpiece-v51.safetensors', 0.5],
            ['anima/anima-turbo-lora-v0.2.safetensors', 0.5], ['anima/anima-base-1-light-concepts-v31.safetensors', 0.5],
            ['style/Artistic_anime_update_64d32a.safetensors', 0.3], ['anima/anima-base-1-photo-background-v4.safetensors', 0.3],
            ['style/Cyaniji v1.safetensors', 0.3], ['gpt-image-2_anima-base1_v1-1.safetensors', 1],
        ]);
        expect(r.preset.negative).toContain('bad anatomy');
        // 提示詞外掛、預覽節點不影響畫面
        expect(r.skipped).toEqual([]);
        expect(r.notes).toEqual([]);
    });
    it('reads an Illustrious checkpoint workflow and lists what the built-in mode leaves out', () => {
        const r = presetFromWorkflow(ILLU, LORAS);
        expect(r.preset).toMatchObject({
            mode: 'checkpoint', checkpoint: 'Illu_ani_waiNSFW_v140.safetensors', vae: '', width: 1024, height: 1024,
            steps: 30, cfg: 7, sampler: 'euler_ancestral', scheduler: 'normal',
        });
        expect(r.preset.loras.map((l) => l.name)).toEqual(['add-detail-xl.safetensors', 'detailed hand focus style illustriousXL v1.safetensors', 'eye_focus_illus.safetensors']);
        expect(r.preset.loras.every((l) => l.strength === 1 && l.clip === undefined)).toBe(true);
        expect(r.preset.hires).toMatchObject({ on: true, scale: 2, steps: 30 });
        expect(r.skipped.sort()).toEqual(['FaceDetailer', 'UltralyticsDetectorProvider']);
        // 原本的工作流程留著，改成自訂模式時可以直接用
        expect(r.preset.workflow).toBe(ILLU);
    });
    it('guesses LoRA file names without the server list, and refuses the non-API format', () => {
        const r = presetFromWorkflow(ANIMA);
        expect(r.preset.loras[0].name).toBe('anima-highres-aesthetic-boost.safetensors');
        expect(r.notes.join()).toContain('讀取 ComfyUI 清單後再匯入');
        expect(resolveLora('Cyaniji v1', LORAS)).toBe('style/Cyaniji v1.safetensors');
        expect(() => presetFromWorkflow(JSON.stringify({ nodes: [], links: [] }))).toThrow('Export (API)');
        expect(() => presetFromWorkflow('{"1":{"class_type":"VAELoader","inputs":{}}}')).toThrow('KSampler');
    });
});
describe('building a workflow from a preset', () => {
    const classes = (wf) => Object.values(wf).map((n) => n.class_type);
    it('chains UNet, text encoder, VAE, LoRAs and hires fix with built-in nodes only', () => {
        const preset = { ...newPreset('a', 'Anima'), ...presetFromWorkflow(ANIMA, LORAS).preset, prefix: 'masterpiece, best quality,' };
        preset.loras[2].on = false;
        const wf = buildWorkflow(preset, { prompt: '1girl, elf', seed: 7 });
        expect(classes(wf).filter((c) => c === 'LoraLoader')).toHaveLength(7);
        expect(classes(wf)).toEqual(expect.arrayContaining(['UNETLoader', 'CLIPLoader', 'VAELoader', 'LatentUpscaleBy', 'SaveImage']));
        expect(classes(wf).filter((c) => c === 'KSampler')).toHaveLength(2);
        const clip = Object.values(wf).find((n) => n.class_type === 'CLIPLoader');
        expect(clip.inputs).toEqual({ clip_name: 'qwen_3_06b_base.safetensors', type: 'stable_diffusion' });
        const pos = Object.values(wf).find((n) => n._meta?.title === '正向');
        expect(pos.inputs.text).toBe('masterpiece, best quality, 1girl, elf');
        // 每個 LoRA 都接在上一個後面
        const loras = Object.entries(wf).filter(([, n]) => n.class_type === 'LoraLoader');
        for (let i = 1; i < loras.length; i++)
            expect(loras[i][1].inputs.model).toEqual([loras[i - 1][0], 0]);
    });
    it('uses the checkpoint’s own VAE unless one is chosen, and Dual/Triple loaders for more encoders', () => {
        const ck = { ...newPreset('c', 'SDXL'), checkpoint: 'x.safetensors' };
        expect(classes(buildWorkflow(ck, { prompt: 'a', seed: 1 }))).not.toContain('VAELoader');
        expect(classes(buildWorkflow({ ...ck, vae: 'sdxl_vae.safetensors' }, { prompt: 'a', seed: 1 }))).toContain('VAELoader');
        const flux = { ...newPreset('f', 'Flux'), mode: 'unet', unet: 'flux.safetensors', clips: ['t5.safetensors', 'clip_l.safetensors'], clipType: 'flux', vae: 'ae.safetensors' };
        const dual = Object.values(buildWorkflow(flux, { prompt: 'a', seed: 1 })).find((n) => n.class_type === 'DualCLIPLoader');
        expect(dual.inputs).toEqual({ clip_name1: 't5.safetensors', clip_name2: 'clip_l.safetensors', type: 'flux' });
        expect(classes(buildWorkflow({ ...flux, clips: ['a', 'b', 'c'] }, { prompt: 'a', seed: 1 }))).toContain('TripleCLIPLoader');
    });
    it('fills the placeholders of a custom workflow', () => {
        const p = { ...newPreset('x', '自訂'), mode: 'custom', prefix: 'best quality', scheduler: 'karras', workflow: '{"1":{"class_type":"X","inputs":{"t":"%prompt%","s":"%seed%","k":"%scheduler%"}}}' };
        expect(buildWorkflow(p, { prompt: '1girl', seed: 5 })['1'].inputs).toEqual({ t: 'best quality, 1girl', s: 5, k: 'karras' });
    });
});
describe('talking to ComfyUI', () => {
    const DEFS = {
        CheckpointLoaderSimple: { ckpt_name: [['Illu_ani_waiNSFW_v140.safetensors']] },
        UNETLoader: { unet_name: [['anima_aestheticV11.safetensors']], weight_dtype: [['default', 'fp8_e4m3fn']] },
        CLIPLoader: { clip_name: [['qwen_3_06b_base.safetensors']], type: ['COMBO', { options: ['stable_diffusion', 'qwen_image', 'flux'] }] },
        DualCLIPLoader: { type: [['flux', 'sd3']] },
        VAELoader: { vae_name: [['qwen_image_vae.safetensors']] },
        LoraLoader: { lora_name: [LORAS] },
        KSampler: { sampler_name: [['euler', 'euler_ancestral', 'er_sde']], scheduler: [['normal', 'simple']] },
        LatentUpscaleBy: { upscale_method: [['bicubic', 'nearest-exact']] },
        CLIPTextEncode: {}, EmptyLatentImage: {}, VAEDecode: {}, SaveImage: {}, PreviewImage: {},
    };
    let posted;
    let history;
    let promptReply;
    beforeEach(() => {
        posted = null;
        promptReply = null;
        history = { outputs: { 72: { images: [{ filename: 'first.png', type: 'temp' }] }, 154: { images: [{ filename: 'final.png', type: 'temp' }] } }, status: { completed: true } };
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
            const url = String(input);
            const info = /\/object_info\/(.+)$/.exec(url);
            if (info) {
                const cls = decodeURIComponent(info[1]);
                return new Response(JSON.stringify(DEFS[cls] ? { [cls]: { input: { required: DEFS[cls] } } } : {}));
            }
            if (url.endsWith('/prompt')) {
                posted = JSON.parse(String(init.body)).prompt;
                return promptReply ?? new Response(JSON.stringify({ prompt_id: 'p1' }));
            }
            if (url.includes('/history/'))
                return new Response(JSON.stringify({ p1: history }));
            return new Response(new Blob([new URLSearchParams(url.split('?')[1]).get('filename')]));
        });
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });
    async function run(preset) {
        const p = generateImage('comfyui', cfg(), { prompt: '1girl', seed: 3, comfy: preset });
        p.catch(() => { });
        await vi.advanceTimersByTimeAsync(2000);
        return p;
    }
    it('reads option lists in both the old and the COMBO format', () => {
        expect(comboOptions({ input: { required: DEFS.CLIPLoader } }, 'type')).toEqual(['stable_diffusion', 'qwen_image', 'flux']);
        expect(comboOptions({ input: { required: DEFS.VAELoader } }, 'vae_name')).toEqual(['qwen_image_vae.safetensors']);
    });
    it('generates with the imported Anima preset and takes the final image, not the first-pass preview', async () => {
        const preset = { ...newPreset('a', 'Anima'), ...presetFromWorkflow(ANIMA, LORAS).preset };
        history = { outputs: { 20: { images: [{ filename: 'final.png', type: 'output' }] } }, status: { completed: true } };
        expect(await (await run(preset)).text()).toBe('final.png');
        expect(Object.values(posted).some((n) => n.class_type === 'UNETLoader')).toBe(true);
    });
    it('picks the last preview of a custom workflow that only previews', async () => {
        const preset = { ...newPreset('a', 'Anima'), mode: 'custom', workflow: ANIMA.replace('"string_b":""', '"string_b":"%prompt%"') };
        DEFS['Unet Loader (LoraManager)'] = {};
        DEFS['Lora Loader (LoraManager)'] = {};
        DEFS.WeiLinPromptUIWithoutLora = {};
        DEFS.StringConcatenate = {};
        DEFS.PreviewAny = {};
        expect(await (await run(preset)).text()).toBe('final.png');
        expect(posted['201'].inputs.string_b).toBe('1girl');
    });
    it('says which plugin nodes are missing before sending', async () => {
        const preset = { ...newPreset('i', 'Illu'), mode: 'custom', workflow: ILLU };
        await expect(run(preset)).rejects.toThrow(/沒有這些節點：.*FaceDetailer/);
        expect(posted).toBeNull();
    });
    it('says which file the server does not have', async () => {
        const preset = { ...newPreset('i', 'Illu'), checkpoint: 'Illu_ani_waiNSFW_v140.safetensors', loras: [{ name: 'gone.safetensors', strength: 1, on: true }] };
        await expect(run(preset)).rejects.toThrow('LoRA：伺服器上沒有「gone.safetensors」');
        expect(posted).toBeNull();
    });
    it('translates the errors ComfyUI sends back', async () => {
        promptReply = new Response(JSON.stringify({
            error: { type: 'prompt_outputs_failed_validation', message: 'Prompt outputs failed validation' },
            node_errors: { 4: { class_type: 'CheckpointLoaderSimple', errors: [{ type: 'value_not_in_list', message: 'Value not in list', extra_info: { input_name: 'ckpt_name', received_value: 'x.safetensors' } }] } },
        }), { status: 400 });
        const preset = { ...newPreset('i', 'Illu'), checkpoint: 'Illu_ani_waiNSFW_v140.safetensors' };
        const p = generateImage('comfyui', cfg(), { prompt: '1girl', comfy: preset, check: false });
        await expect(p).rejects.toThrow('CheckpointLoaderSimple（#4）的Checkpoint：伺服器上沒有「x.safetensors」');
        expect(promptErrorText({ error: { type: 'invalid_prompt', message: 'Cannot execute because node FaceDetailer does not exist.' } })).toContain('沒有「FaceDetailer」節點');
    });
});
describe('choosing the output image', () => {
    it('prefers a chosen node, then saved images, then the last preview', () => {
        const outputs = {
            57: { images: [{ filename: 'before-face.png', type: 'temp' }] },
            153: { images: [{ filename: 'saved.png', type: 'output' }] },
            154: { images: [{ filename: 'done-preview.png', type: 'temp' }] },
        };
        expect(pickOutputImage(outputs).filename).toBe('saved.png');
        expect(pickOutputImage(outputs, '57').filename).toBe('before-face.png');
        expect(pickOutputImage({ 72: outputs[57], 154: outputs[154] }).filename).toBe('done-preview.png');
    });
});
describe('preset storage', () => {
    beforeEach(() => {
        localStorage.clear();
        setActivePinia(createPinia());
    });
    it('turns an old single ComfyUI setting into a preset', () => {
        expect(presetFromLegacy(cfg({ model: 'a.safetensors' }))).toMatchObject({ mode: 'checkpoint', checkpoint: 'a.safetensors' });
        expect(presetFromLegacy(cfg({ workflow: '{"1":{}}' }))).toMatchObject({ mode: 'custom', workflow: '{"1":{}}' });
        localStorage.setItem('elondia.image', JSON.stringify({ service: 'comfyui', configs: { comfyui: { baseURL: 'http://x', workflow: '{"9":{}}' } } }));
        const image = useImageSettings();
        expect(image.comfyPresets).toHaveLength(1);
        expect(image.preset()).toMatchObject({ mode: 'custom', workflow: '{"9":{}}', name: '我的工作流程' });
        expect(image.ready()).toBe(true);
    });
    it('imports, duplicates and removes presets, and needs the model chosen to be ready', () => {
        const image = useImageSettings();
        image.service = 'comfyui';
        expect(image.preset().workflow).toBe(DEFAULT_COMFY_WORKFLOW);
        const r = image.importPreset(ANIMA);
        expect(image.preset().id).toBe(r.added.id);
        expect(image.preset().name).toBe('anima_aestheticV11');
        expect(image.ready()).toBe(true);
        expect(image.preset().hires.denoise).toBe(0.7);
        image.duplicatePreset();
        expect(image.preset().name).toBe('anima_aestheticV11 複製');
        image.preset().vae = '';
        expect(image.ready()).toBe(false);
        image.removePreset();
        image.removePreset();
        expect(image.comfyPresets).toHaveLength(1);
        expect(() => image.removePreset()).toThrow('至少要留一組');
    });
});
