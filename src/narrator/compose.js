// 依玩家的提示詞設定組出實際送出的提示詞（遊戲與「提示詞」頁籤的預覽共用）。
import { protagonistText } from '@/engine/character';
import { locationById } from '@/engine/data';
import * as social from '@/engine/social';
import { actionLoreText, buildActionPrompt } from './judge';
import { loreForReport, pickLore } from './lore';
import { adultSceneOf, buildPrompt } from './prompt';
import { activeEntries } from './promptConfig';
function playerName(state) {
    return state?.party.find((m) => m.isPlayer)?.name ?? '你';
}
export function protagonistOf(state) {
    const me = state?.party.find((m) => m.isPlayer);
    return me ? protagonistText(me, me.birthplace ? locationById(me.birthplace).name : undefined) : '';
}
/** 敘事請求的人際關係與記憶 */
export function narrationContext(state, report) {
    return state ? social.formatContext(state, social.selectContext(state, social.queryForReport(state, report))) : '';
}
/** 判定請求的人際關係與記憶：隊伍全員，加上行動對象 */
export function judgeContext(state, p) {
    const participants = ['pc', ...state.party.filter((m) => !m.isPlayer).map((m) => m.id)];
    const target = p.target?.includes(':') ? p.target.split(':')[1] : p.target;
    if (target && state.relationships?.[target] && !participants.includes(target))
        participants.push(target);
    return social.formatContext(state, social.selectContext(state, { participants, location: state.location }));
}
/** 這則日誌的敘事屬於哪一種：帶親密場景（成人向開啟時）是「成人場景」 */
export function narrationTarget(report, adult) {
    return adultSceneOf(report, adult) ? 'adult' : 'narration';
}
export function composeNarration(state, report, o) {
    const name = playerName(state);
    const lore = loreForReport(o.lore, report, { adult: o.adult, budgetChars: o.budgetChars, playerName: name });
    const protagonist = protagonistOf(state);
    const context = narrationContext(state, report);
    // 成人場景的敘事用套用到「成人場景」的條目
    const target = narrationTarget(report, o.adult);
    const prompt = buildPrompt(report, lore, {
        playerName: name,
        language: o.language,
        ...(protagonist ? { protagonist } : {}),
        ...(context ? { context } : {}),
        styles: activeEntries(o.config.styles, target, name, { adult: o.adult }),
        instructions: activeEntries(o.config.custom, target, name, { position: 'system', adult: o.adult }),
        endNotes: activeEntries(o.config.custom, target, name, { position: 'end', adult: o.adult }),
        ...(o.config.narrationRules ? { rules: o.config.narrationRules } : {}),
        ...(o.config.defeatRules ? { defeatRules: o.config.defeatRules } : {}),
        ...(o.config.sceneRules ? { sceneRules: o.config.sceneRules } : {}),
        adult: o.adult,
    });
    return { prompt, lore };
}
export function composeJudge(state, p, o) {
    const name = playerName(state);
    const lore = o.config.loreInJudge
        ? pickLore(o.lore, { text: actionLoreText(state, p), travel: false }, { adult: o.adult, budgetChars: o.budgetChars, playerName: name })
        : undefined;
    const prompt = buildActionPrompt(state, p, judgeContext(state, p), {
        language: o.language,
        narrative: !o.splitNarrative,
        styles: activeEntries(o.config.styles, 'judge', name, { adult: o.adult }),
        instructions: activeEntries(o.config.custom, 'judge', name, { position: 'system', adult: o.adult }),
        endNotes: activeEntries(o.config.custom, 'judge', name, { position: 'end', adult: o.adult }),
        ...(o.config.defeatRules ? { defeatRules: o.config.defeatRules } : {}),
        ...(o.config.sceneRules ? { sceneRules: o.config.sceneRules } : {}),
        adult: o.adult,
        ...(lore ? { lore } : {}),
    });
    return { prompt, ...(lore ? { lore } : {}) };
}
