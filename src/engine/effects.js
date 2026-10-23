// 報酬／後果模板：事件、委託與主動行動的結果都用同一組效果描述，可以任意組合。
//
// 例：委託報酬「80 白鸛＋傷藥 2 瓶＋委託人好感 +5＋獵戶自願入隊」
//   [{ type: 'money', amount: 80 }, { type: 'item', name: '傷藥', qty: 2 },
//    { type: 'affinity', npc: 'gen_3', delta: 5 }, { type: 'companion', npc: 'gen_3', mode: 'voluntary' }]
//
// applyEffects 在報告提交前呼叫：金錢、物品、親密度、聲望、經驗、旗標寫進 report.changes，由 commitReport 套用；
// 入隊、離隊、狀態、生命值等直接修改狀態，並記錄在 report.changes。數值上限由呼叫端（例如主動行動）負責夾住。
import { perkDef, slaveryRules } from './data';
import { grantPerk, losePerk, offerPerks } from './perks';
import { abilityChoices, abilityQuality, learnable, learnAbility } from './character';
import { formatMoney } from './money';
import { npcRecord, generateNpc } from './npcs';
import { changeHitDice, changeSlots } from './resources';
import { addAffinity, addCondition, changeMaster, enslavePlayer, freePlayer, freeSlave, joinParty, leaveParty, partyRoom, pcOf, removeCondition, setHp, } from './party';
import { addMemory, addSuggestions, ensureRelationship } from './social';
import { withRng } from './state';
import { gearKnown, registerGear } from './gear';
import { addIntel } from './intel';
import { startStory, storyDef } from './story';
import { contractKind, randomMaster } from './slavery';
import { forceEquip } from './forcedGear';
import { addStrict, extendDeadline, sendToMasterHome } from './masterHome';
import { addTattoo, contractOf, freePlaces, oathText, placeName, removeTattoo, tattooFromTemplate, tattooKindName, tattoosOf } from './tattoos';
export const EFFECT_TYPES = [
    'money', 'item', 'affinity', 'reputation', 'xp', 'flag', 'companion', 'join_party', 'leave',
    'relationship_text', 'memory', 'condition', 'hp', 'enslave_player', 'free', 'change_master', 'quest_reward', 'quest_flag', 'meet', 'ability', 'slot', 'hit_dice', 'mark', 'gear',
    'intel', 'start_story', 'master_home', 'strict', 'home_extend', 'perk', 'lose_perk', 'tattoo', 'remove_tattoo', 'force_equip',
];
/** NPC 參照：已登場的 id，或是一份規格（生成新角色）。 */
export function resolveNpc(state, ref, prefix = 'evt') {
    if (typeof ref === 'string') {
        const rec = npcRecord(state, ref);
        if (!rec)
            throw new Error(`unknown npc: ${ref}`);
        return rec;
    }
    if (ref.id) {
        const rec = npcRecord(state, ref.id);
        if (rec)
            return rec;
    }
    return withRng(state, (rng) => generateNpc(state, rng, ref, prefix));
}
function memberOrPc(state, id) {
    return id === 'pc' ? pcOf(state) : state.party.find((m) => m.id === id);
}
/** 套用效果，回傳每個效果的簡短說明（無法套用的會註明原因）。 */
export function applyEffects(state, report, effects) {
    const notes = [];
    const c = report.changes;
    for (const e of effects) {
        switch (e.type) {
            case 'money':
                if (!e.amount)
                    break;
                c.money_cc = (c.money_cc ?? 0) + Math.round(e.amount);
                break;
            case 'item':
                if (e.qty > 0)
                    (c.items_gained ??= []).push({ name: e.name, qty: e.qty, ...(e.quality ? { quality: e.quality } : {}), owner: 'pc' });
                else if (e.qty < 0)
                    (c.items_lost ??= []).push({ name: e.name, qty: -e.qty });
                break;
            case 'gear': {
                // 底材或材料被刪掉的裝備獎勵：略過
                if (!gearKnown(e.spec)) {
                    notes.push('（有一件裝備獎勵已經不存在）');
                    break;
                }
                const name = registerGear(state, e.spec, e.name, e.desc);
                (c.items_gained ??= []).push({ name, qty: 1, owner: 'pc' });
                notes.push(`得到【${name}】`);
                break;
            }
            case 'affinity': {
                const rec = npcRecord(state, e.npc);
                if (rec)
                    ensureRelationship(state, rec);
                addAffinity(state, report, e.npc, e.delta, e.reason);
                break;
            }
            case 'reputation':
                if (e.delta)
                    (c.reputation ??= []).push({ faction: e.faction, delta: Math.round(e.delta) });
                break;
            case 'xp': {
                const targets = e.target ? state.party.filter((m) => m.id === e.target) : state.party;
                for (const m of targets)
                    (c.xp ??= []).push({ actor: m.id, amount: Math.round(e.amount) });
                break;
            }
            case 'flag':
                ;
                (c.flags ??= {})[e.key] = e.value;
                break;
            case 'companion': {
                // 指定的固定 NPC 已經不存在（自訂內容刪掉了），或已經在隊伍裡：略過
                if (typeof e.npc === 'string' && !npcRecord(state, e.npc)) {
                    notes.push('（要加入的角色已經不存在）');
                    break;
                }
                const rec = resolveNpc(state, e.npc);
                if (state.party.some((m) => m.id === rec.id)) {
                    notes.push(`${rec.name}已經在隊伍裡了`);
                    break;
                }
                if (partyRoom(state) < 1) {
                    ensureRelationship(state, rec);
                    notes.push(`${rec.name}想加入，但隊伍已滿`);
                    break;
                }
                if (e.mode === 'slave' && contractOf(pcOf(state))) {
                    notes.push(`身為奴隸，無法擁有奴隸`);
                    break;
                }
                joinParty(state, rec, e.mode, report, { ...(e.contract ? { contract: e.contract } : {}), reason: '事件' });
                notes.push(`${rec.name}加入了隊伍`);
                break;
            }
            case 'join_party': {
                const leader = resolveNpc(state, e.leader);
                const members = (e.members ?? []).map((m) => resolveNpc(state, m));
                if (partyRoom(state) < 1 + members.length) {
                    notes.push(`${leader.name}的隊伍沒有空位`);
                    break;
                }
                joinParty(state, leader, 'leader', report, { group: leader.id });
                for (const m of members)
                    joinParty(state, m, 'ally', report, { group: leader.id });
                if (e.pay_cc)
                    c.money_cc = (c.money_cc ?? 0) + Math.round(e.pay_cc);
                notes.push(`加入了${leader.name}的隊伍`);
                break;
            }
            case 'leave':
                if (state.party.some((m) => m.id === e.npc && !m.isPlayer))
                    leaveParty(state, e.npc, report, e.reason);
                break;
            case 'relationship_text':
                if (!state.relationships?.[e.npc])
                    break;
                if (e.apply)
                    state.relationships[e.npc].toPlayer = e.text;
                else
                    addSuggestions(state, [{ id: e.npc, to_player: e.text }], report.report_id);
                break;
            case 'memory':
                addMemory(state, {
                    time: { ...report.time.start }, location: report.location.at,
                    participants: report.party.map((p) => p.id), summary: e.summary, importance: e.importance ?? 2,
                });
                break;
            case 'condition': {
                const who = memberOrPc(state, e.target);
                if (!who)
                    break;
                if (e.add)
                    addCondition(who, e.condition, report);
                else
                    removeCondition(who, e.condition, report);
                break;
            }
            case 'hp': {
                const who = memberOrPc(state, e.target);
                if (!who)
                    break;
                const delta = e.amount ?? Math.round((e.ratio ?? 0) * who.maxHp);
                setHp(state, who, who.hp + delta, report);
                break;
            }
            case 'slot': {
                const who = memberOrPc(state, e.target);
                if (!who || !e.delta)
                    break;
                const n = changeSlots(who, e.delta, e.circle, report);
                if (n)
                    notes.push(`${who.name}${e.delta < 0 ? '用掉' : '回復'} ${n} 個法術環`);
                break;
            }
            case 'hit_dice': {
                const who = memberOrPc(state, e.target);
                if (!who || !e.delta)
                    break;
                const n = changeHitDice(who, e.delta, report);
                if (n)
                    notes.push(`${who.name}${n > 0 ? '回復' : '用掉'} ${Math.abs(n)} 顆生命骰`);
                break;
            }
            case 'enslave_player': {
                const master = e.master ? resolveNpc(state, e.master) : randomMaster(state, e.random?.tag);
                if (contractOf(pcOf(state))) {
                    // 已經是奴隸：換主人，印記沿用
                    changeMaster(state, master, report, '特殊任務');
                    notes.push(`${master.name}成為主角的新主人`);
                    break;
                }
                const members = (e.members ?? []).map((m) => resolveNpc(state, m));
                const contract = contractKind(master.tags?.includes('prostitute') ? slaveryRules.roles.madam : e.contract);
                enslavePlayer(state, master, contract, report, members);
                // 刻印前還有一次檢定：主角的表現決定最後刻上哪一種印記
                state.pendingMark = { intended: contract };
                notes.push(`主角成為${master.name}的奴隸`);
                break;
            }
            case 'mark': {
                if (state.pendingMark)
                    state.pendingMark.suggestion = { ...(e.name ? { name: e.name } : {}), ...(e.text ? { mark: e.text } : {}) };
                break;
            }
            case 'change_master': {
                const master = e.master === null ? null : resolveNpc(state, e.master);
                changeMaster(state, master, report, e.reason);
                notes.push(master ? `${master.name}成為主角的新主人` : '主角變成無主的奴隸');
                break;
            }
            case 'master_home': {
                const line = sendToMasterHome(state, report);
                if (line)
                    notes.push(line.replace(/。$/, ''));
                break;
            }
            case 'strict':
                addStrict(state, e.delta);
                if (e.delta > 0)
                    notes.push('之後被看得更緊');
                else if (e.delta < 0)
                    notes.push('看管放寬了一些');
                break;
            case 'perk': {
                const who = memberOrPc(state, e.target ?? 'pc');
                if (!who)
                    break;
                // 缺陷不是機會：直接染上
                if (e.perk && (e.direct || perkDef(e.perk)?.flaw)) {
                    const got = grantPerk(who, e.perk, report);
                    if (got)
                        notes.push(got.flaw ? `${who.name}多了一個缺陷【${got.name}】` : `${who.name}學會了特質【${got.name}】`);
                    break;
                }
                const options = [...(e.perk ? [e.perk] : []), ...(e.options ?? [])];
                const offer = offerPerks(who, e.source ?? '事件', options);
                if (offer)
                    notes.push(offer.options.length ? `${who.name}有機會學會特質：${offer.options.map((id) => perkDef(id)?.name ?? id).join('、')}` : `${who.name}有機會學會一個特質`);
                break;
            }
            case 'lose_perk': {
                const who = memberOrPc(state, e.target ?? 'pc');
                const lost = who && losePerk(who, e.perk, report);
                if (lost)
                    notes.push(lost.flaw ? `${who.name}克服了缺陷【${lost.name}】` : `${who.name}失去了特質【${lost.name}】`);
                break;
            }
            case 'tattoo': {
                const pc = pcOf(state);
                try {
                    const t = e.template
                        ? tattooFromTemplate(e.template, pc, e.place)
                        : { kind: e.kind ?? 'plain', place: e.place ?? freePlaces(pc)[0], name: e.name || '刺青', desc: e.text ?? '', ...(e.attrs ? { attrs: e.attrs } : {}) };
                    const added = addTattoo(pc, { ...t, ...(e.by ? { by: e.by } : {}) }, state.time);
                    (report.changes.tattoos ??= []).push({ actor: 'pc', place: added.place, kind: added.kind, name: added.name ?? '', added: true });
                    notes.push(`主角的${placeName(added.place)}多了${tattooKindName(added.kind)}【${added.name}】${added.attrs ? `（${oathText(added.attrs)}）` : ''}`);
                }
                catch (err) {
                    notes.push(`沒有刺上刺青（${err instanceof Error ? err.message : String(err)}）`);
                }
                break;
            }
            case 'force_equip': {
                const line = forceEquip(state, report, e.npc, e.item);
                notes.push(line || '主人沒有挑到要你戴的東西');
                break;
            }
            case 'remove_tattoo': {
                const pc = pcOf(state);
                const places = e.place ? [e.place] : tattoosOf(pc).filter((t) => t.kind === e.kind).map((t) => t.place);
                for (const place of places) {
                    const t = removeTattoo(pc, place);
                    if (!t)
                        continue;
                    (report.changes.tattoos ??= []).push({ actor: 'pc', place, kind: t.kind, name: t.name ?? '', added: false });
                    notes.push(`主角${placeName(place)}的${tattooKindName(t.kind)}【${t.name}】被洗掉了`);
                }
                break;
            }
            case 'home_extend':
                extendDeadline(state, e.hours);
                notes.push(`離家的期限多了 ${Math.round((e.hours / 24) * 10) / 10} 天`);
                break;
            case 'free':
                if (e.npc === 'pc')
                    freePlayer(state, report);
                else
                    freeSlave(state, e.npc, report);
                break;
            case 'quest_reward': {
                const q = state.quests.find((x) => x.id === e.quest);
                if (!q)
                    break;
                const before = q.reward_cc;
                q.reward_cc = Math.max(0, Math.round(q.reward_cc * (1 + e.percent / 100)));
                notes.push(`「${q.title}」的報酬從 ${formatMoney(before)} 調整為 ${formatMoney(q.reward_cc)}`);
                break;
            }
            case 'ability': {
                const who = memberOrPc(state, e.target ?? 'pc');
                if (!who)
                    break;
                if (e.chance !== undefined && e.chance < 1 && !withRng(state, (rng) => rng.chance(e.chance)))
                    break;
                if (e.choices) {
                    const choices = withRng(state, (rng) => abilityChoices(who, rng, Math.max(1, Math.min(5, e.choices))));
                    if (!choices.length) {
                        notes.push(`${who.name}沒有可以學的新能力`);
                        break;
                    }
                    who.pendingAbilityChoices = [...(who.pendingAbilityChoices ?? []), choices];
                    notes.push(`${who.name}得到一次學習新能力的機會（${choices.length} 選一）`);
                    break;
                }
                const pool = learnable(who);
                const wanted = e.ability?.trim();
                let def = wanted ? pool.find((a) => a.id === wanted || a.name === wanted) : undefined;
                if (!def && pool.length)
                    def = withRng(state, (rng) => rng.pick(pool));
                if (!def) {
                    notes.push(`${who.name}沒有可以學的新能力`);
                    break;
                }
                learnAbility(who, def.id);
                (report.changes.skills_gained ??= []).push({ actor: who.id, skill: def.name, quality: abilityQuality(def), source: 'insight' });
                notes.push(`${who.name}領悟了【${def.name}】`);
                break;
            }
            case 'meet': {
                const rec = resolveNpc(state, e.npc, 'met');
                if (e.spot)
                    rec.spot = e.spot;
                const rel = ensureRelationship(state, rec);
                if (e.to_player)
                    rel.toPlayer = e.to_player;
                if (e.affinity)
                    addAffinity(state, report, rec.id, e.affinity, '初次相識');
                (report.others ??= []).push({ id: rec.id, name: rec.name, race: rec.race, class: rec.class, level: rec.level, personality: rec.personality });
                notes.push(`認識了${rec.name}`);
                break;
            }
            case 'quest_flag': {
                const q = state.quests.find((x) => x.id === e.quest);
                if (q)
                    (q.flags ??= {})[e.key] = e.value;
                break;
            }
            case 'intel': {
                const it = addIntel(state, { ...e.intel, kind: 'point' });
                notes.push(`記下情報「${it.title}」`);
                break;
            }
            case 'start_story': {
                const def = storyDef(e.story);
                if (!def) {
                    notes.push('（要開始的特殊任務已經不存在）');
                    break;
                }
                if (state.stories?.[e.story]) {
                    notes.push(`特殊任務「${def.title}」已經開始過了`);
                    break;
                }
                // 特殊任務的結果接著開始另一個任務：另外一則日誌（這一則是原本任務的經過）
                if (report.story) {
                    startStory(state, e.story);
                    notes.push(`開始特殊任務「${def.title}」`);
                    break;
                }
                // 情報商賣的任務消息：記在冒險筆記的情報
                startStory(state, e.story, { report });
                addIntel(state, { kind: 'story', story: e.story, title: def.title, text: report.outcome.summary ?? '' });
                break;
            }
        }
    }
    return notes;
}
