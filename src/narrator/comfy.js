// ComfyUI：設定組合（Checkpoint、UNet、自訂工作流程）、組出工作流程、從玩家的工作流程匯入設定、
// 讀取伺服器上的模型與 LoRA 清單、把錯誤翻成看得懂的訊息、從結果裡挑出成品圖。
// 送出與等待結果在 imageProviders.ts；說明見 docs/PORTRAITS.md。
//
// 內建的兩種模式只用 ComfyUI 原生的節點，不需要安裝外掛。
import { DEFAULT_COMFY_WORKFLOW, NEGATIVE } from './imageInfo';
export const COMFY_MODES = [
    { id: 'checkpoint', name: 'Checkpoint', note: '一個檔案就包含模型、文字編碼器與 VAE（SD1.5、SDXL、Illustrious、Pony……）' },
    { id: 'unet', name: 'UNet（分開載入）', note: '模型、文字編碼器、VAE 分開載入（Anima、Flux、Qwen-Image……）；文字編碼器的類型依模型選' },
    { id: 'custom', name: '自訂工作流程', note: '貼上自己的工作流程（API 格式），可以用任何節點與外掛' },
];
export function newPreset(id, name, mode = 'checkpoint') {
    return {
        id, name, mode,
        checkpoint: '', unet: '', weightDtype: 'default', clips: [''], clipType: '', vae: '', loras: [],
        width: 832, height: 1216, steps: 28, cfg: 6, sampler: 'euler_ancestral', scheduler: 'normal',
        prefix: '', negative: NEGATIVE,
        hires: { on: false, scale: 1.5, method: 'bicubic', steps: 15, cfg: 6, denoise: 0.5 },
        workflow: DEFAULT_COMFY_WORKFLOW, outputNode: '',
    };
}
const num = (v, min, max, fallback) => {
    const n = typeof v === 'string' && v.trim() ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
/** 小數取到三位（工作流程裡常有 0.7000000000000002 這種值） */
const dec = (v, min, max, fallback) => Math.round(num(v, min, max, fallback) * 1000) / 1000;
/** 讀取保存的設定組合：補上缺的欄位、數字限制在合理範圍 */
export function sanitizePreset(raw, fallbackId = 'p-1') {
    const d = newPreset(str(raw.id, fallbackId) || fallbackId, str(raw.name).trim() || '未命名');
    const mode = COMFY_MODES.some((m) => m.id === raw.mode) ? raw.mode : d.mode;
    const h = raw.hires ?? {};
    const clips = (Array.isArray(raw.clips) ? raw.clips : []).map((c) => str(c)).slice(0, 3);
    return {
        ...d, mode,
        checkpoint: str(raw.checkpoint), unet: str(raw.unet), weightDtype: str(raw.weightDtype, 'default') || 'default',
        clips: clips.length ? clips : [''], clipType: str(raw.clipType), vae: str(raw.vae),
        loras: (Array.isArray(raw.loras) ? raw.loras : []).filter((l) => l && typeof l.name === 'string').map((l) => ({
            name: l.name, strength: dec(l.strength, -10, 10, 1), ...(l.clip !== undefined && l.clip !== null ? { clip: dec(l.clip, -10, 10, 1) } : {}), on: l.on !== false,
        })),
        width: Math.round(num(raw.width, 64, 4096, d.width)), height: Math.round(num(raw.height, 64, 4096, d.height)),
        steps: Math.round(num(raw.steps, 1, 200, d.steps)), cfg: dec(raw.cfg, 0, 30, d.cfg),
        sampler: str(raw.sampler, d.sampler) || d.sampler, scheduler: str(raw.scheduler, d.scheduler) || d.scheduler,
        prefix: str(raw.prefix), negative: str(raw.negative, d.negative),
        hires: {
            on: !!h.on, scale: dec(h.scale, 1, 4, d.hires.scale), method: str(h.method, d.hires.method) || d.hires.method,
            steps: Math.round(num(h.steps, 1, 200, d.hires.steps)), cfg: dec(h.cfg, 0, 30, d.hires.cfg), denoise: dec(h.denoise, 0, 1, d.hires.denoise),
        },
        workflow: str(raw.workflow, d.workflow), outputNode: str(raw.outputNode).trim(),
    };
}
/** 舊版的 ComfyUI 設定（只有一份工作流程）：沒改過工作流程的變成 Checkpoint 模式，改過的變成自訂工作流程 */
export function presetFromLegacy(cfg) {
    const custom = !!cfg.workflow.trim() && cfg.workflow.trim() !== DEFAULT_COMFY_WORKFLOW.trim();
    return sanitizePreset({
        id: 'p-1', name: custom ? '我的工作流程' : '預設', mode: custom ? 'custom' : 'checkpoint',
        checkpoint: cfg.model, width: cfg.width, height: cfg.height, steps: cfg.steps, cfg: cfg.scale,
        sampler: cfg.sampler, negative: cfg.negative, workflow: cfg.workflow || DEFAULT_COMFY_WORKFLOW,
    });
}
/** 這組設定缺什麼（空陣列表示可以生成） */
export function presetIssues(p) {
    const out = [];
    if (p.mode === 'custom') {
        if (!p.workflow.trim())
            out.push('還沒有工作流程');
        return out;
    }
    if (p.mode === 'checkpoint' && !p.checkpoint.trim())
        out.push('還沒選 Checkpoint');
    if (p.mode === 'unet') {
        if (!p.unet.trim())
            out.push('還沒選 UNet 模型');
        if (!p.clips.some((c) => c.trim()))
            out.push('還沒選文字編碼器');
        if (p.clips.filter((c) => c.trim()).length < 3 && !p.clipType.trim())
            out.push('還沒選文字編碼器的類型');
        if (!p.vae.trim())
            out.push('還沒選 VAE');
    }
    return out;
}
/** 送出的正面提示詞：固定前綴＋產生的提示詞 */
export function fullPrompt(p, prompt) {
    const prefix = p.prefix.trim().replace(/[,，\s]+$/, '');
    return prefix ? `${prefix}, ${prompt}` : prompt;
}
/** 依設定組合組出要送出的工作流程（自訂工作流程：把代號換成值） */
export function buildWorkflow(p, v) {
    const prompt = fullPrompt(p, v.prompt);
    const negative = v.negative ?? p.negative;
    if (p.mode === 'custom') {
        return fillWorkflow(p.workflow, {
            prompt, negative, width: p.width, height: p.height, seed: v.seed, steps: p.steps, scale: p.cfg,
            sampler: p.sampler, scheduler: p.scheduler, model: p.checkpoint || p.unet,
        });
    }
    const wf = {};
    let n = 0;
    const add = (class_type, inputs, title) => {
        const id = String(++n);
        wf[id] = { class_type, inputs, ...(title ? { _meta: { title } } : {}) };
        return id;
    };
    let model;
    let clip;
    let vae;
    if (p.mode === 'checkpoint') {
        const ck = add('CheckpointLoaderSimple', { ckpt_name: p.checkpoint });
        model = [ck, 0];
        clip = [ck, 1];
        vae = [ck, 2];
    }
    else {
        model = [add('UNETLoader', { unet_name: p.unet, weight_dtype: p.weightDtype || 'default' }), 0];
        const clips = p.clips.map((c) => c.trim()).filter(Boolean);
        const loader = clips.length >= 3
            ? add('TripleCLIPLoader', { clip_name1: clips[0], clip_name2: clips[1], clip_name3: clips[2] })
            : clips.length === 2
                ? add('DualCLIPLoader', { clip_name1: clips[0], clip_name2: clips[1], type: p.clipType })
                : add('CLIPLoader', { clip_name: clips[0] ?? '', type: p.clipType });
        clip = [loader, 0];
        vae = [add('VAELoader', { vae_name: p.vae }), 0];
    }
    if (p.mode === 'checkpoint' && p.vae.trim())
        vae = [add('VAELoader', { vae_name: p.vae }), 0];
    for (const l of p.loras) {
        if (!l.on || !l.name.trim())
            continue;
        const id = add('LoraLoader', { lora_name: l.name, strength_model: l.strength, strength_clip: l.clip ?? l.strength, model, clip });
        model = [id, 0];
        clip = [id, 1];
    }
    const positive = [add('CLIPTextEncode', { text: prompt, clip }, '正向'), 0];
    const neg = [add('CLIPTextEncode', { text: negative, clip }, '反向'), 0];
    const latent = add('EmptyLatentImage', { width: p.width, height: p.height, batch_size: 1 });
    const sampler = { seed: v.seed, sampler_name: p.sampler, scheduler: p.scheduler, model, positive, negative: neg };
    let samples = add('KSampler', { ...sampler, steps: p.steps, cfg: p.cfg, denoise: 1, latent_image: [latent, 0] });
    if (p.hires.on) {
        const up = add('LatentUpscaleBy', { upscale_method: p.hires.method, scale_by: p.hires.scale, samples: [samples, 0] });
        samples = add('KSampler', { ...sampler, steps: p.hires.steps, cfg: p.hires.cfg, denoise: p.hires.denoise, latent_image: [up, 0] }, '高解析修復');
    }
    const image = add('VAEDecode', { samples: [samples, 0], vae });
    add('SaveImage', { filename_prefix: 'elondia', images: [image, 0] });
    return wf;
}
/**
 * 把工作流程裡的代號換成值：整個字串就是代號時換成原本的型別（數字就是數字），
 * 字串裡夾著代號時做文字取代。代號：%prompt% %negative% %width% %height% %seed% %steps% %scale% %sampler% %scheduler% %model%
 */
export function fillWorkflow(workflow, vars) {
    let parsed;
    try {
        parsed = JSON.parse(workflow);
    }
    catch {
        throw new Error('ComfyUI 的工作流程不是正確的 JSON');
    }
    const walk = (v) => {
        if (typeof v === 'string') {
            const whole = /^%(\w+)%$/.exec(v);
            if (whole && whole[1] in vars)
                return vars[whole[1]];
            return v.replace(/%(\w+)%/g, (m, k) => (k in vars ? String(vars[k]) : m));
        }
        if (Array.isArray(v))
            return v.map(walk);
        if (v && typeof v === 'object')
            return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
        return v;
    };
    const out = walk(parsed);
    if (!out || typeof out !== 'object' || Array.isArray(out))
        throw new Error('ComfyUI 的工作流程要是 API 格式的 JSON 物件');
    if (Array.isArray(out.nodes))
        throw new Error('這是 ComfyUI 一般格式的工作流程：請用選單的「Export (API)」匯出 API 格式');
    return out;
}
// ---- 從玩家的工作流程匯入 ----
/** 內建模式看得懂的節點 */
const KNOWN = new Set([
    'CheckpointLoaderSimple', 'UNETLoader', 'CLIPLoader', 'DualCLIPLoader', 'TripleCLIPLoader', 'VAELoader',
    'LoraLoader', 'LoraLoaderModelOnly', 'CLIPTextEncode', 'EmptyLatentImage', 'EmptySD3LatentImage',
    'KSampler', 'LatentUpscaleBy', 'LatentUpscale', 'VAEDecode',
]);
/** 省略了也不影響畫面的節點：存圖、預覽、提示詞與文字工具、註解 */
const HARMLESS = /prompt|string|text|primitive|note|preview|save|show|display/i;
const isUnetLoader = (c) => c === 'UNETLoader' || /unet\s*loader/i.test(c);
const isCheckpointLoader = (c) => c === 'CheckpointLoaderSimple' || /checkpoint\s*loader/i.test(c);
const fileBase = (name) => name.split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/i, '');
/** LoRA 名稱對到伺服器的檔名（LoraManager 等外掛只寫名稱，沒有副檔名與子資料夾） */
export function resolveLora(name, available) {
    if (available.includes(name))
        return name;
    const base = fileBase(name);
    const hits = available.filter((a) => fileBase(a) === base);
    return hits[0];
}
/**
 * 讀出玩家工作流程（API 格式）裡的主模、文字編碼器、VAE、LoRA、取樣與高解析修復的設定。
 * loraNames：伺服器的 LoRA 清單（有讀過時用來補齊檔名）
 */
export function presetFromWorkflow(text, loraNames = []) {
    const raw = fillWorkflow(text, {});
    const nodes = Object.fromEntries(Object.entries(raw).filter(([, n]) => n && typeof n === 'object' && typeof n.class_type === 'string'));
    const node = (v) => {
        if (!Array.isArray(v) || v.length !== 2)
            return undefined;
        const id = String(v[0]);
        return nodes[id] ? [id, nodes[id]] : undefined;
    };
    const used = new Set();
    const skipped = new Set();
    const notes = [];
    // 取樣：第一次（從空白 latent 開始）與高解析修復（從放大的 latent 開始）
    const samplers = Object.entries(nodes).filter(([, n]) => n.class_type === 'KSampler');
    if (!samplers.length)
        throw new Error('工作流程裡沒有 KSampler，看不出取樣設定（目前只看得懂一般的 KSampler）');
    const fromEmpty = ([, n]) => /^Empty.*Latent/.test(node(n.inputs.latent_image)?.[1].class_type ?? '');
    const [firstId, first] = samplers.find(fromEmpty) ?? samplers[0];
    used.add(firstId);
    let hires;
    let finalId = firstId;
    const latentNode = node(first.inputs.latent_image);
    const p = newPreset('', '');
    if (latentNode) {
        used.add(latentNode[0]);
        p.width = num(latentNode[1].inputs.width, 64, 4096, p.width);
        p.height = num(latentNode[1].inputs.height, 64, 4096, p.height);
    }
    for (const [id, n] of samplers) {
        const up = node(n.inputs.latent_image);
        if (!up || !/^LatentUpscale/.test(up[1].class_type) || node(up[1].inputs.samples)?.[0] !== firstId)
            continue;
        const scale = up[1].class_type === 'LatentUpscaleBy' ? num(up[1].inputs.scale_by, 1, 4, 1.5) : num(Number(up[1].inputs.width) / p.width, 1, 4, 1.5);
        hires = {
            on: true, scale, method: str(up[1].inputs.upscale_method, 'bicubic'),
            steps: Math.round(num(n.inputs.steps, 1, 200, 15)), cfg: num(n.inputs.cfg, 0, 30, 6), denoise: num(n.inputs.denoise, 0, 1, 0.5),
        };
        used.add(id);
        used.add(up[0]);
        finalId = id;
        break;
    }
    for (const [id] of samplers)
        if (!used.has(id))
            skipped.add('KSampler（多的取樣步驟）');
    // 模型：從取樣器往回找，經過 LoRA 直到主模
    const loras = [];
    let mode;
    let cur = node(first.inputs.model);
    for (let guard = 0; cur && guard < 50; guard++) {
        const [id, n] = cur;
        used.add(id);
        const c = n.class_type;
        if (isCheckpointLoader(c)) {
            mode = 'checkpoint';
            p.checkpoint = str(n.inputs.ckpt_name);
            if (c !== 'CheckpointLoaderSimple')
                skipped.add(c);
            break;
        }
        if (isUnetLoader(c)) {
            mode = 'unet';
            p.unet = str(n.inputs.unet_name);
            p.weightDtype = str(n.inputs.weight_dtype, 'default') || 'default';
            break;
        }
        if (c === 'LoraLoader' || c === 'LoraLoaderModelOnly') {
            const s = num(n.inputs.strength_model, -10, 10, 1);
            const cs = c === 'LoraLoader' ? num(n.inputs.strength_clip, -10, 10, s) : 0;
            loras.unshift({ name: str(n.inputs.lora_name), strength: s, ...(cs !== s ? { clip: cs } : {}), on: true });
        }
        else if (Array.isArray(n.inputs.loras?.__value__)) {
            // LoraManager 等外掛：一個節點放好幾個 LoRA
            const list = n.inputs.loras.__value__;
            loras.unshift(...list.filter((l) => l && l.name && l.active !== false).map((l) => {
                const s = num(l.strength, -10, 10, 1);
                const cs = num(l.clipStrength, -10, 10, s);
                return { name: l.name, strength: s, ...(cs !== s ? { clip: cs } : {}), on: true };
            }));
        }
        else {
            // 不認得、但會把模型往下傳的節點（例如 ModelSamplingAuraFlow）：內建模式重現不了
            skipped.add(c);
        }
        cur = node(n.inputs.model);
    }
    if (!mode)
        throw new Error('找不到工作流程的主模（Checkpoint 或 UNet 的載入節點）');
    // 文字編碼器：從正面提示詞的編碼節點往回找
    const pos = node(first.inputs.positive);
    if (pos) {
        used.add(pos[0]);
        if (pos[1].class_type !== 'CLIPTextEncode')
            skipped.add(pos[1].class_type);
        let c = node(pos[1].inputs.clip);
        for (let guard = 0; c && guard < 50; guard++) {
            const [id, n] = c;
            used.add(id);
            if (n.class_type === 'CLIPLoader') {
                p.clips = [str(n.inputs.clip_name)];
                p.clipType = str(n.inputs.type);
                break;
            }
            if (n.class_type === 'DualCLIPLoader') {
                p.clips = [str(n.inputs.clip_name1), str(n.inputs.clip_name2)];
                p.clipType = str(n.inputs.type);
                break;
            }
            if (n.class_type === 'TripleCLIPLoader') {
                p.clips = [str(n.inputs.clip_name1), str(n.inputs.clip_name2), str(n.inputs.clip_name3)];
                break;
            }
            if (isCheckpointLoader(n.class_type))
                break;
            const isLora = n.class_type === 'LoraLoader' || Array.isArray(n.inputs.loras?.__value__);
            if (!isLora && !HARMLESS.test(n.class_type))
                skipped.add(n.class_type);
            c = node(n.inputs.clip);
        }
        if (mode === 'unet' && !p.clips.some(Boolean))
            notes.push('找不到文字編碼器的載入節點，請自己選');
    }
    // 負面提示詞：編碼節點的文字（可能接在提示詞外掛的節點上）
    const neg = node(first.inputs.negative);
    if (neg) {
        used.add(neg[0]);
        const t = neg[1].inputs.text;
        if (typeof t === 'string')
            p.negative = t;
        else {
            const src = node(t)?.[1];
            const value = src && ['text', 'negative', 'positive', 'prompt', 'string', 'value', 'string_a'].map((k) => src.inputs[k]).find((x) => typeof x === 'string' && x.trim());
            if (typeof value === 'string')
                p.negative = value;
        }
    }
    // VAE：解碼最後一次取樣的那個節點
    const decode = Object.entries(nodes).find(([, n]) => n.class_type === 'VAEDecode' && node(n.inputs.samples)?.[0] === finalId);
    if (decode) {
        used.add(decode[0]);
        const v = node(decode[1].inputs.vae);
        if (v && v[1].class_type === 'VAELoader') {
            used.add(v[0]);
            p.vae = str(v[1].inputs.vae_name);
        }
    }
    if (mode === 'unet' && !p.vae)
        notes.push('找不到 VAE 的載入節點，請自己選');
    p.steps = Math.round(num(first.inputs.steps, 1, 200, p.steps));
    p.cfg = num(first.inputs.cfg, 0, 30, p.cfg);
    p.sampler = str(first.inputs.sampler_name, p.sampler) || p.sampler;
    p.scheduler = str(first.inputs.scheduler, p.scheduler) || p.scheduler;
    if (hires)
        p.hires = hires;
    // LoRA 對到伺服器的檔名
    p.loras = loras.map((l) => {
        if (!loraNames.length)
            return /\.\w+$/.test(l.name) ? l : { ...l, name: `${l.name}.safetensors` };
        const hit = resolveLora(l.name, loraNames);
        if (!hit)
            notes.push(`伺服器的 LoRA 清單裡找不到「${l.name}」`);
        return { ...l, name: hit ?? l.name };
    });
    if (!loraNames.length && loras.some((l) => !/\.\w+$/.test(l.name)))
        notes.push('有些 LoRA 只有名稱，先補上 .safetensors；讀取 ComfyUI 清單後再匯入可以對到正確的檔名');
    // 其他節點：會影響畫面、但內建模式重現不了的
    for (const [id, n] of Object.entries(nodes)) {
        if (used.has(id) || KNOWN.has(n.class_type) || HARMLESS.test(n.class_type))
            continue;
        skipped.add(n.class_type);
    }
    p.mode = mode;
    p.workflow = text;
    const { id: _id, name: _name, ...preset } = p;
    return { preset, name: fileBase(mode === 'checkpoint' ? p.checkpoint : p.unet) || '匯入的設定', skipped: [...skipped], notes };
}
/** 下拉選項：舊格式 [[...選項]]，新格式 ["COMBO", { options: [...] }] */
export function comboOptions(info, key) {
    const spec = info?.input?.required?.[key] ?? info?.input?.optional?.[key];
    if (!spec)
        return [];
    if (Array.isArray(spec[0]))
        return spec[0].map(String);
    const opts = spec[1]?.options;
    return Array.isArray(opts) ? opts.map(String) : [];
}
export function comfyServer(cfg) {
    return {
        base: (cfg.baseURL.trim() || 'http://127.0.0.1:8188').replace(/\/+$/, ''),
        headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    };
}
const unreachable = (base) => new Error(`連不到 ComfyUI（${base}）：確認 ComfyUI 有開、網址正確，並且啟動時加了 --enable-cors-header`);
/** 讀一個節點的定義；伺服器沒有這個節點時是 undefined */
export async function nodeInfo(server, cls, signal) {
    let res;
    try {
        res = await fetch(`${server.base}/object_info/${encodeURIComponent(cls)}`, { headers: server.headers, signal });
    }
    catch (e) {
        if (signal?.aborted)
            throw e;
        throw unreachable(server.base);
    }
    if (!res.ok)
        return undefined;
    return (await res.json())[cls];
}
export async function fetchComfyOptions(server, signal) {
    const names = ['CheckpointLoaderSimple', 'UNETLoader', 'CLIPLoader', 'DualCLIPLoader', 'VAELoader', 'LoraLoader', 'KSampler', 'LatentUpscaleBy'];
    const infos = await Promise.all(names.map((n) => nodeInfo(server, n, signal)));
    const i = Object.fromEntries(names.map((n, k) => [n, infos[k]]));
    return {
        checkpoints: comboOptions(i.CheckpointLoaderSimple, 'ckpt_name'),
        unets: comboOptions(i.UNETLoader, 'unet_name'),
        weightDtypes: comboOptions(i.UNETLoader, 'weight_dtype'),
        clips: comboOptions(i.CLIPLoader, 'clip_name'),
        clipTypes: comboOptions(i.CLIPLoader, 'type'),
        dualClipTypes: comboOptions(i.DualCLIPLoader, 'type'),
        vaes: comboOptions(i.VAELoader, 'vae_name'),
        loras: comboOptions(i.LoraLoader, 'lora_name'),
        samplers: comboOptions(i.KSampler, 'sampler_name'),
        schedulers: comboOptions(i.KSampler, 'scheduler'),
        upscaleMethods: comboOptions(i.LatentUpscaleBy, 'upscale_method'),
    };
}
/**
 * 送出前檢查：工作流程用到的節點伺服器都有嗎；strict 時也檢查下拉選項的值（內建模式用；
 * 自訂工作流程的外掛節點有些接受清單外的值，只檢查節點，值交給 ComfyUI 回報）
 */
export async function checkWorkflow(server, wf, strict, signal) {
    const nodes = Object.entries(wf).filter(([, n]) => n && typeof n.class_type === 'string');
    const classes = [...new Set(nodes.map(([, n]) => n.class_type))];
    const infos = new Map(await Promise.all(classes.map(async (c) => [c, await nodeInfo(server, c, signal)])));
    const missing = classes.filter((c) => !infos.get(c));
    const out = [];
    if (missing.length)
        out.push(`ComfyUI 沒有這些節點：${missing.join('、')}（可能是外掛沒裝，可以用 ComfyUI-Manager 安裝）`);
    if (!strict)
        return out;
    for (const [, n] of nodes) {
        const info = infos.get(n.class_type);
        if (!info)
            continue;
        for (const [key, value] of Object.entries(n.inputs)) {
            if (typeof value !== 'string')
                continue;
            const options = comboOptions(info, key);
            if (options.length && !options.includes(value))
                out.push(`${INPUT_NAMES[key] ?? key}：伺服器上沒有「${value || '（空白）'}」`);
        }
    }
    return [...new Set(out)];
}
const INPUT_NAMES = {
    ckpt_name: 'Checkpoint', unet_name: 'UNet 模型', weight_dtype: '權重精度', clip_name: '文字編碼器', clip_name1: '文字編碼器 1',
    clip_name2: '文字編碼器 2', clip_name3: '文字編碼器 3', type: '文字編碼器的類型', vae_name: 'VAE', lora_name: 'LoRA',
    sampler_name: '取樣器', scheduler: '排程器', upscale_method: '放大方式',
};
/** /prompt 回應 400 時的內容翻成看得懂的訊息 */
export function promptErrorText(body) {
    const b = (body ?? {});
    const lines = [];
    const missing = /node (.+?) does not exist/i.exec(b.error?.message ?? '');
    if (missing)
        lines.push(`ComfyUI 沒有「${missing[1]}」節點（可能是外掛沒裝，可以用 ComfyUI-Manager 安裝）`);
    for (const [id, ne] of Object.entries(b.node_errors ?? {})) {
        for (const e of ne.errors ?? []) {
            const input = e.extra_info?.input_name;
            const label = `${ne.class_type ?? '節點'}（#${id}）`;
            if (e.type === 'value_not_in_list') {
                lines.push(`${label}的${INPUT_NAMES[input ?? ''] ?? input ?? '設定'}：伺服器上沒有「${String(e.extra_info?.received_value ?? '')}」`);
            }
            else {
                lines.push(`${label}${input ? `的 ${input}` : ''}：${e.message ?? '設定有誤'}${e.details ? `（${e.details}）` : ''}`);
            }
        }
    }
    if (!lines.length)
        lines.push(b.error?.message ? `ComfyUI 拒絕這個工作流程：${b.error.message}${b.error.details ? `（${b.error.details}）` : ''}` : 'ComfyUI 拒絕這個工作流程');
    return lines.join('；');
}
/** 執行時出錯的訊息 */
export function executionErrorText(entry) {
    const m = entry.status?.messages?.find(([k]) => k === 'execution_error')?.[1];
    if (!m)
        return 'ComfyUI 執行工作流程時出錯（看 ComfyUI 的主控台）';
    return `ComfyUI 執行到「${String(m.node_type ?? '?')}」（#${String(m.node_id ?? '?')}）時出錯：${String(m.exception_message ?? '').trim().slice(0, 300)}`;
}
/**
 * 從結果挑出成品圖：指定的節點 → 存檔的輸出（SaveImage 一類）中最後一個節點 → 最後一個有圖的節點。
 * 只拿第一個會拿到「第一次採樣」或「修復前」的預覽圖
 */
export function pickOutputImage(outputs, outputNode = '') {
    const entries = Object.entries(outputs ?? {}).filter(([, o]) => o.images?.length);
    if (outputNode && outputs?.[outputNode]?.images?.length)
        return outputs[outputNode].images[0];
    const saved = entries.filter(([, o]) => o.images.some((i) => (i.type ?? 'output') === 'output'));
    const pick = (saved.length ? saved : entries).at(-1);
    return pick ? (pick[1].images.find((i) => (i.type ?? 'output') === 'output') ?? pick[1].images[0]) : undefined;
}
