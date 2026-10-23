// 送出生圖請求：OpenAI（/images/generations）、NovelAI（/ai/generate-image，回傳 ZIP）、ComfyUI（/prompt → /history → /view）。
// 請求直接從瀏覽器送出，key 只存在這個瀏覽器。
import { buildWorkflow, checkWorkflow, comfyServer, executionErrorText, pickOutputImage, presetFromLegacy, promptErrorText, } from './comfy';
export { fillWorkflow } from './comfy';
/** 產生一張圖片 */
export async function generateImage(service, cfg, req) {
    switch (service) {
        case 'openai': return openAIImage(cfg, req);
        case 'novelai': return novelAIImage(cfg, req);
        case 'comfyui': return comfyImage(cfg, req);
    }
}
const trimURL = (u) => u.trim().replace(/\/+$/, '');
/** 額外參數（JSON 物件；空白時是空的） */
export function parseExtra(text) {
    if (!text.trim())
        return {};
    let v;
    try {
        v = JSON.parse(text);
    }
    catch {
        throw new Error('額外參數不是正確的 JSON');
    }
    if (!v || typeof v !== 'object' || Array.isArray(v))
        throw new Error('額外參數要是一個 JSON 物件');
    return v;
}
async function failure(res, service) {
    let detail = '';
    try {
        detail = (await res.text()).slice(0, 300);
    }
    catch {
        // 讀不到內容就算了
    }
    return new Error(`${service} 回應 ${res.status}${detail ? `：${detail}` : ''}`);
}
function base64ToBlob(b64, type = 'image/png') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
}
// ---- OpenAI ----
export function openAIBody(cfg, req) {
    return { model: cfg.model, prompt: req.prompt, size: `${cfg.width}x${cfg.height}`, n: 1, ...parseExtra(cfg.extra) };
}
async function openAIImage(cfg, req) {
    const res = await fetch(`${trimURL(cfg.baseURL || 'https://api.openai.com/v1')}/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(openAIBody(cfg, req)),
        signal: req.signal,
    });
    if (!res.ok)
        throw await failure(res, 'OpenAI');
    const data = (await res.json());
    const first = data.data?.[0];
    if (first?.b64_json)
        return base64ToBlob(first.b64_json);
    if (first?.url) {
        const img = await fetch(first.url, { signal: req.signal });
        if (!img.ok)
            throw await failure(img, 'OpenAI（下載圖片）');
        return img.blob();
    }
    throw new Error('OpenAI 沒有回傳圖片');
}
// ---- NovelAI ----
export function novelAIBody(cfg, req) {
    const negative = req.negative ?? cfg.negative;
    const seed = req.seed ?? Math.floor(Math.random() * 2 ** 32);
    const v4 = /diffusion-4/.test(cfg.model);
    return {
        input: req.prompt,
        model: cfg.model,
        action: 'generate',
        parameters: {
            params_version: 3, width: cfg.width, height: cfg.height, scale: cfg.scale, sampler: cfg.sampler, steps: cfg.steps,
            n_samples: 1, seed, ucPreset: 0, qualityToggle: true, noise_schedule: 'karras', cfg_rescale: 0,
            negative_prompt: negative,
            ...(v4 ? {
                v4_prompt: { caption: { base_caption: req.prompt, char_captions: [] }, use_coords: false, use_order: true },
                v4_negative_prompt: { caption: { base_caption: negative, char_captions: [] }, legacy_uc: false },
            } : {}),
            ...parseExtra(cfg.extra),
        },
    };
}
async function novelAIImage(cfg, req) {
    const res = await fetch(`${trimURL(cfg.baseURL || 'https://image.novelai.net')}/ai/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(novelAIBody(cfg, req)),
        signal: req.signal,
    });
    if (!res.ok)
        throw await failure(res, 'NovelAI');
    const buf = new Uint8Array(await res.arrayBuffer());
    // 回傳的是 ZIP（裡面是 PNG）；有些代理直接回傳圖片
    if (buf[0] === 0x50 && buf[1] === 0x4b)
        return firstZipEntry(buf);
    return new Blob([buf], { type: res.headers.get('content-type') ?? 'image/png' });
}
/** 取出 ZIP 的第一個檔案（不壓縮或 deflate） */
export async function firstZipEntry(buf) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    // 從中央目錄讀大小（本地檔頭可能用資料描述，大小是 0）
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65535; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0)
        throw new Error('看不懂回傳的 ZIP');
    const cd = view.getUint32(eocd + 16, true);
    if (view.getUint32(cd, true) !== 0x02014b50)
        throw new Error('看不懂回傳的 ZIP');
    const method = view.getUint16(cd + 10, true);
    const size = view.getUint32(cd + 20, true);
    const local = view.getUint32(cd + 42, true);
    const nameLen = view.getUint16(local + 26, true);
    const extraLen = view.getUint16(local + 28, true);
    const start = local + 30 + nameLen + extraLen;
    const data = buf.slice(start, start + size);
    if (method === 0)
        return new Blob([data], { type: 'image/png' });
    if (method === 8) {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Blob([await new Response(stream).arrayBuffer()], { type: 'image/png' });
    }
    throw new Error(`ZIP 的壓縮方式（${method}）不支援`);
}
// ---- ComfyUI ----
const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new DOMException('已取消', 'AbortError'));
    }, { once: true });
});
/** 依設定組合組出工作流程 → 送出前檢查 → /prompt → 等 /history → 從 /view 下載成品圖 */
async function comfyImage(cfg, req) {
    const preset = req.comfy ?? presetFromLegacy(cfg);
    const server = comfyServer(cfg);
    const prompt = buildWorkflow(preset, { prompt: req.prompt, seed: req.seed ?? Math.floor(Math.random() * 2 ** 32), ...(req.negative ? { negative: req.negative } : {}) });
    if (req.check !== false) {
        const problems = await checkWorkflow(server, prompt, preset.mode !== 'custom', req.signal);
        if (problems.length)
            throw new Error(problems.join('；'));
    }
    let res;
    try {
        res = await fetch(`${server.base}/prompt`, {
            method: 'POST', headers: server.headers, body: JSON.stringify({ prompt, client_id: 'elondia', ...parseExtra(cfg.extra) }), signal: req.signal,
        });
    }
    catch (e) {
        if (req.signal?.aborted)
            throw e;
        throw new Error(`連不到 ComfyUI（${server.base}）：確認 ComfyUI 有開、網址正確，並且啟動時加了 --enable-cors-header`);
    }
    if (res.status === 400) {
        let body = null;
        try {
            body = await res.json();
        }
        catch {
            // 不是 JSON 就用一般的錯誤訊息
        }
        if (body)
            throw new Error(promptErrorText(body));
    }
    if (!res.ok)
        throw await failure(res, 'ComfyUI');
    const { prompt_id: id } = (await res.json());
    if (!id)
        throw new Error('ComfyUI 沒有回傳工作編號');
    // 等它算完（最多 10 分鐘）
    for (let i = 0; i < 400; i++) {
        await sleep(1500, req.signal);
        const h = await fetch(`${server.base}/history/${id}`, { headers: server.headers, signal: req.signal });
        if (!h.ok)
            continue;
        const entry = (await h.json())[id];
        if (!entry)
            continue;
        if (entry.status?.status_str === 'error')
            throw new Error(executionErrorText(entry));
        const image = pickOutputImage(entry.outputs, preset.mode === 'custom' ? preset.outputNode : '');
        if (!image) {
            if (entry.status?.completed)
                throw new Error('ComfyUI 跑完了，但工作流程沒有輸出圖片（需要 SaveImage 或 PreviewImage 節點）');
            continue;
        }
        const q = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder ?? '', type: image.type ?? 'output' });
        const img = await fetch(`${server.base}/view?${q}`, { headers: server.headers, signal: req.signal });
        if (!img.ok)
            throw await failure(img, 'ComfyUI（下載圖片）');
        return img.blob();
    }
    throw new Error('ComfyUI 等太久了（超過 10 分鐘）');
}
