// 工作：站在旅店、酒館、神殿、雜貨店、鐵匠鋪等商店、公會、娼館等設施上，花時間換錢（data/rules/work.json）。
// 走主動行動 work：玩家可以描述怎麼做，AI 依此判定並寫進日誌；報酬依成功程度。
// 被主人帶著時，收入依印記歸主人（state.ts 的收益歸屬）。
// 也可以派自己的奴隸去做：由奴隸擲檢定，工錢歸主角（target 是「時數:奴隸 id」）。
import { adultScene, safeText } from './content';
import { locationById, workRules } from './data';
import { applyEffects } from './effects';
import { currentArea, currentCell } from './grid';
import { formatMoney } from './money';
import { npcRecord } from './npcs';
import { addAffinity, isFugitive } from './party';
import { shopPlace } from './trade';
import { contractOf } from './tattoos';
import { closedHere } from './landmarks';
/** 現在站的設施有沒有工作可做 */
export function jobHere(state) {
    // 不開放的地標沒有工作
    if (closedHere(state))
        return undefined;
    const cell = currentCell(state).kind;
    const job = workRules.jobs[cell];
    return job ? { ...job, name: safeText(job.name), desc: safeText(job.desc), cell } : undefined;
}
/** 可以派去工作的人：主角自己的奴隸（在隊伍裡、沒有暫時離隊） */
export function workers(state) {
    return state.party.filter((m) => m.bond === 'slave' && contractOf(m)?.master === 'pc' && !m.status.includes('away'));
}
/** 主動行動的 target：「時數」或「時數:奴隸 id」 */
export function workTarget(hours, worker) {
    return worker ? `${hours}:${worker}` : String(hours);
}
/** 派去工作的奴隸（主角自己做時沒有） */
function workerOf(state, target) {
    const id = target?.split(':')[1];
    if (!id)
        return undefined;
    const m = workers(state).find((x) => x.id === id);
    if (!m)
        throw new Error('隊伍裡沒有這位奴隸');
    return m;
}
/** 主動行動的 target：時數 */
function hoursOf(target) {
    const h = Number(target?.split(':')[0]);
    if (!workRules.hours.includes(h))
        throw new Error(`工作時數只能是 ${workRules.hours.join('、')} 小時`);
    return h;
}
export function workPay(job, hours, degree) {
    return Math.round(hours * job.rate_cc * workRules.degree_pay[degree]);
}
/** 雇主：這個設施的店主（有登場過的話） */
function employer(state, cell) {
    const id = `keeper_${shopPlace(state).id}_${cell === 'shop' ? 'general' : cell}`;
    return npcRecord(state, id) ? id : undefined;
}
export function setupWork(state, target) {
    const job = jobHere(state);
    if (!job)
        throw new Error('這裡沒有工作可做');
    const worker = workerOf(state, target);
    if (!worker && job.official && isFugitive(state))
        throw new Error(`${currentArea(state).name}的人認出了你身上的契約印記，不肯雇你`);
    const hours = hoursOf(target);
    const boss = employer(state, job.cell);
    const pay = (d) => formatMoney(workPay(job, hours, d));
    const who = worker ? `派${worker.name}去做` : '';
    return {
        // 娼館的工作是接客：敘事要詳細描寫
        ...(job.cell === 'brothel' ? adultScene(worker ? `${worker.name}被派去娼館接客（${hours} 小時）` : `在娼館接客（${hours} 小時）`) : {}),
        attr: job.attr, dc: job.dc, hours, situational: [],
        // 奴隸自己擲檢定，主角在一旁等
        ...(worker ? { actor: worker.id } : {}),
        ...(boss ? { targetName: npcRecord(state, boss).name } : {}),
        scene: `${locationById(state.location).name}・${who}${job.name}（${hours} 小時${worker ? '，工錢歸你' : ''}）`,
        outcomes: {
            critical: `做得很出色，拿到 ${pay('critical')}`, success: `拿到 ${pay('success')}`, partial: `拿到 ${pay('partial')}`,
            fail: `做得不好，只拿到 ${pay('fail')}`, fumble: '出了差錯，白做一場（雇主親密度 -3）',
        },
    };
}
export function applyWork(state, report, target, degree) {
    const job = jobHere(state);
    const hours = hoursOf(target);
    const pay = workPay(job, hours, degree);
    if (pay > 0)
        applyEffects(state, report, [{ type: 'money', amount: pay }]);
    if (degree === 'fumble') {
        const boss = employer(state, job.cell);
        if (boss)
            addAffinity(state, report, boss, workRules.fumble_affinity, '工作出了差錯');
    }
    const worker = workerOf(state, target);
    if (worker)
        return `你派${worker.name}去做了 ${hours} 小時的${job.name}，${pay > 0 ? `工錢 ${formatMoney(pay)} 交到你手上` : '一分錢也沒拿回來'}。`;
    return `做了 ${hours} 小時的${job.name}，${pay > 0 ? `賺到 ${formatMoney(pay)}` : '一分錢也沒拿到'}。`;
}
