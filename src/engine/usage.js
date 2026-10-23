// 自訂內容的引用檢查：刪除前列出還有哪些地方用到這一項（見 docs/CONTENT_DEPENDENCIES.md）。
// 檢查兩種地方：其他內容（任務、固定 NPC、物品……），以及目前載入的存檔。
// 其他存檔要等讀檔時才知道；讀檔時的清理見 state.ts 的 migrate。
import { itemRules, npcs as namedNpcs, perkRules, shopRules, stories } from './data';
import { gearSpecOf } from './gear';
import { furnitureIn } from './homes';
import { contractOf } from './tattoos';
/** 一個特殊任務的所有結果（任務點的成功、失敗與各選項） */
export function storyOutcomes(s) {
    return s.nodes
        .flatMap((n) => [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])])
        .filter((o) => !!o);
}
/** 一個特殊任務的所有效果（結果裡的效果與完成報酬） */
export function storyEffects(s) {
    return [...(s.rewards ?? []), ...storyOutcomes(s).flatMap((o) => o.effects ?? [])];
}
/** 存檔裡有裝備的角色：隊伍與登場過的人 */
function characters(state) {
    return [...state.party, ...Object.values(state.npcs ?? {}).map((r) => r.character).filter((c) => !!c)];
}
const activeQuests = (state) => state.quests.filter((q) => q.status === 'accepted' || q.status === 'ready');
// ---- 怪物 ----
export function enemyUsage(id, state) {
    const out = [];
    for (const s of stories) {
        for (const n of s.nodes)
            if (n.enemies?.some(([e]) => e === id))
                out.push(`特殊任務「${s.title}」的任務點「${n.title}」`);
    }
    if (state) {
        for (const q of activeQuests(state))
            if (q.monster === id)
                out.push(`進行中的委託「${q.title}」`);
        for (const it of state.intel ?? [])
            if (it.status === 'active' && it.group?.some(([e]) => e === id))
                out.push(`情報「${it.title}」`);
    }
    return out;
}
// ---- 物品 ----
/** 怪物的掉落會在刪除時一起拿掉，不算在這裡 */
export function itemUsage(name, state) {
    const out = [];
    for (const s of stories) {
        if (storyEffects(s).some((e) => e.type === 'item' && e.name === name))
            out.push(`特殊任務「${s.title}」的獎勵`);
    }
    for (const t of Object.values(shopRules.types))
        if (t.fixed?.some((f) => f.item === name))
            out.push(`商店「${t.name}」的固定清單`);
    for (const it of itemRules.items) {
        if (it.tool?.fuel === name)
            out.push(`「${it.name}」的燃料`);
        if (it.recipe?.inputs.some((x) => x.name === name))
            out.push(`「${it.name}」的配方材料`);
        if (it.seed?.yields.includes(name))
            out.push(`「${it.name}」長出的作物`);
    }
    if (state) {
        const have = state.inventory.find((i) => i.name === name && i.qty > 0);
        if (have)
            out.push(`目前存檔的行囊（×${have.qty}）`);
        for (const c of characters(state)) {
            if (Object.values(c.gear ?? {}).some((g) => g?.name === name))
                out.push(`目前存檔「${c.name}」身上的裝備`);
        }
        for (const q of activeQuests(state))
            if (q.item === name)
                out.push(`進行中的委託「${q.title}」`);
        for (const h of Object.values(state.homes ?? {})) {
            if (furnitureIn(h).some((f) => f.name === name))
                out.push(`目前存檔的房子「${h.name}」裡的家具`);
            if (Object.values(h.areas).some((a) => a.cells.some((c) => c.crop?.seed === name)))
                out.push(`目前存檔的房子「${h.name}」苗圃上種著`);
        }
    }
    return out;
}
// ---- 裝備的底材與材料 ----
export function gearUsage(kind, id, state, customItems = []) {
    const uses = (spec) => !!spec && (kind === 'base' ? spec.base === id : spec.material === id);
    const out = [];
    // 玩家建立或修改過的物品（自動產生的制式裝備會跟著消失，不算）
    for (const i of itemRules.items) {
        if (customItems.includes(i.name) && uses(i.gear))
            out.push(`物品「${i.name}」`);
        if (kind === 'material' && i.forge?.materials.includes(id))
            out.push(`物品「${i.name}」的打造材料`);
    }
    for (const n of namedNpcs)
        if (Object.values(n.gear ?? {}).some(uses))
            out.push(`固定 NPC「${n.name}」的裝備`);
    for (const s of stories) {
        if (storyEffects(s).some((e) => e.type === 'gear' && uses(e.spec)))
            out.push(`特殊任務「${s.title}」的獎勵`);
    }
    if (state) {
        for (const c of characters(state)) {
            if (Object.values(c.gear ?? {}).some((g) => uses(g?.spec)))
                out.push(`目前存檔「${c.name}」身上的裝備`);
        }
        const held = state.inventory.filter((i) => i.qty > 0 && uses(gearSpecOf(state, i.name))).map((i) => i.name);
        if (held.length)
            out.push(`目前存檔的行囊（${held.slice(0, 3).join('、')}${held.length > 3 ? '…' : ''}）`);
    }
    return out;
}
// ---- 固定 NPC ----
export function npcUsage(id, state) {
    const out = [];
    for (const s of stories) {
        const where = [];
        if (s.start.npc === id)
            where.push('開頭');
        for (const n of s.nodes) {
            if (n.at.npc === id)
                where.push(`任務點「${n.title}」的地點`);
            if (n.foes?.includes(id))
                where.push(`任務點「${n.title}」的敵人`);
            if (n.allies?.includes(id))
                where.push(`任務點「${n.title}」的友方`);
        }
        if (storyOutcomes(s).some((o) => o.join === id || o.leave === id))
            where.push('任務同行');
        if (storyEffects(s).some((e) => (e.type === 'companion' && e.npc === id) || (e.type === 'affinity' && e.npc === id) || (e.type === 'enslave_player' && e.master === id)))
            where.push('效果');
        if (where.length)
            out.push(`特殊任務「${s.title}」的${[...new Set(where)].join('、')}`);
    }
    if (state) {
        const m = state.party.find((x) => x.id === id);
        if (m)
            out.push(`目前存檔的隊伍（${m.name}）`);
        if (state.party.some((x) => contractOf(x)?.master === id))
            out.push('目前存檔的主人（奴隸契約）');
    }
    return out;
}
// ---- 特殊任務 ----
export function storyUsage(id, state) {
    const out = [];
    for (const i of itemRules.items)
        if (i.intel?.kind === 'story' && i.intel.story === id)
            out.push(`情報物品「${i.name}」`);
    for (const s of stories) {
        if (s.id !== id && storyEffects(s).some((e) => e.type === 'start_story' && e.story === id))
            out.push(`特殊任務「${s.title}」的效果`);
    }
    if (state?.stories?.[id]?.status === 'active')
        out.push('目前存檔正在進行這個任務（先放棄或完成）');
    return out;
}
// ---- 特質 ----
/** 哪些地方用到這個特質：固定 NPC 的特質清單、特殊任務的效果、書籍、其他特質的互斥、目前存檔的角色 */
export function perkUsage(id, state) {
    const out = [];
    for (const n of namedNpcs)
        if (n.perks?.includes(id))
            out.push(`固定 NPC「${n.name}」的特質`);
    for (const s of stories) {
        if (storyEffects(s).some((e) => (e.type === 'perk' && (e.perk === id || e.options?.includes(id))) || (e.type === 'lose_perk' && e.perk === id))) {
            out.push(`特殊任務「${s.title}」的效果`);
        }
    }
    for (const i of itemRules.items)
        if (i.use?.perks?.includes(id))
            out.push(`書籍「${i.name}」`);
    for (const p of perkRules.perks)
        if (p.id !== id && p.exclusive?.includes(id))
            out.push(`特質「${p.name}」的互斥`);
    if (state) {
        for (const c of characters(state)) {
            if (c.perks?.includes(id))
                out.push(`目前存檔的「${c.name}」`);
            else if (c.perkOffers?.some((o) => o.options.includes(id)))
                out.push(`目前存檔的「${c.name}」學特質的機會`);
        }
        for (const r of Object.values(state.npcs ?? {}))
            if (!r.character && r.perks?.includes(id))
                out.push(`目前存檔登場的「${r.name}」`);
    }
    return out;
}
/** 自建物品改名：目前存檔裡的行囊、身上的裝備與進行中的委託一起改 */
export function renameItemInState(state, from, to) {
    const have = state.inventory.find((i) => i.name === from);
    if (have) {
        const other = state.inventory.find((i) => i.name === to);
        if (other) {
            other.qty += have.qty;
            state.inventory = state.inventory.filter((i) => i !== have);
        }
        else
            have.name = to;
    }
    for (const c of characters(state))
        for (const g of Object.values(c.gear ?? {}))
            if (g?.name === from)
                g.name = to;
    for (const q of state.quests)
        if (q.item === from)
            q.item = to;
    for (const h of Object.values(state.homes ?? {}))
        for (const a of Object.values(h.areas))
            for (const c of a.cells) {
                if (c.furniture === from)
                    c.furniture = to;
                if (c.crop?.seed === from)
                    c.crop.seed = to;
            }
}
