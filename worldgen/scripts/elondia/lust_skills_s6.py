# 打工線的獨特色情技能（慾望戰鬥 S6；docs/LEWD_STATS.md 第 11 節、docs/ADULT_EVENTS.md 第 8 節）：
# 每條打工、巡禮、祭典線第三個任務的結局（每個選項）拿到獨特色情裝備的地方，接著學會那條線的獨特技能。
# story_batch1.py 套用（place_skills）；可以重跑：已經有同一個技能效果的不重複加。
#
# 技能本身在 data/rules/abilities.json（lust_pour_charm 等）；同名的技能書在 data/rules/items.json（不在商店賣，S7 放進主題地下城）。

# 結局的獎勵物品 → 獨特技能
UNIQUE = {
    '看板娘的圍裙': 'lust_pour_charm',          # 銀鱗旅店的看板娘：斟酒的媚態
    '實驗用的魔導項圈': 'lust_arcane_stim',      # 怪人魔導師的研究：魔導刺激
    '黃金骰子的兔女郎裝': 'lust_dealer_gamble',  # 黃金骰子的兔女郎：莊家的賭局
    '夜之舞孃的腳鍊': 'lust_dance',              # 舞孃的夜間表演：渴望之舞
    '伯爵府的女僕裝': 'lust_grovel',             # 伯爵府的見習女僕：跪伏乞憐
    '露出狂的網襪': 'lust_center_stage',         # 光著身子的朝聖者：萬眾矚目
    '澡堂的珍珠胸鍊': 'lust_back_scrub',         # 人魚澡堂的搓背女：搓背的手藝
    '溫泉旅館的浴衣': 'lust_hot_spring',         # 熔岩溫泉的混浴：熱泉的耐性
    '按摩師的薄紗手套': 'lust_ten_fingers',      # 下城區按摩店：十指的特別服務
    '畫家模特兒的絲袍': 'lust_frozen_pose',      # 畫家的裸體模特兒：定格的姿態
    '戰利品的獸骨腰帶': 'lust_spoils',           # 血角的戰利品之夜：戰利品的覺悟
    '侍寢見習的魅魔絲衣': 'lust_kiss',           # 魅魔宮廷的侍寢見習：魅惑之吻
    '祭品的血紅頸環': 'lust_sacrifice_sigil',    # 祭品儀式：獻祭的契紋
    '巡禮者的懺悔頭紗': 'burst_release',         # 教堂懺悔室的各國巡禮：解放
    '豐饒祭的花冠': 'burst_bliss',               # 豐饒祭的巫女：極樂之光
    '求偶祭的獸牙項鍊': 'lust_courtship_mark',   # 求偶祭：求偶紋
    '潮汐祭的貝殼腰鍊': 'lust_tide_bride',       # 潮汐祭：潮之新娘
}


def _walk(effects):
    """在效果清單裡，每個獎勵物品的後面接上技能效果（已經有就不加）；回傳加了幾個"""
    n = 0
    i = 0
    while i < len(effects):
        e = effects[i]
        ability = UNIQUE.get(e.get('name')) if e.get('type') == 'item' else None
        if ability and not any(x.get('type') == 'ability' and x.get('ability') == ability for x in effects):
            effects.insert(i + 1, {'type': 'ability', 'target': 'pc', 'ability': ability})
            n += 1
            i += 1
        i += 1
    return n


def _outcomes(o):
    """任務點裡所有的結果（成功、失敗、選項）"""
    if isinstance(o, dict):
        if isinstance(o.get('effects'), list):
            yield o
        for v in o.values():
            yield from _outcomes(v)
    elif isinstance(o, list):
        for v in o:
            yield from _outcomes(v)


def place_skills(batch):
    n = 0
    for s in batch:
        for out in _outcomes(s.get('nodes', [])):
            n += _walk(out['effects'])
    return n

