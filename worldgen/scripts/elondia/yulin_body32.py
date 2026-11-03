"""玉璘族的身體（2026-11）：除了魚尾，也有和人類一樣的雙腿。
魚尾長在腰後，粗圓豐潤、像鯨一樣，尾端是左右展開的寬大尾鰭；上岸不必化形，只是鱗片與鰓離水久了會乾，要定時泡水。
改世界書（种族-玉璘族、大陸總覽、東海群島）、隨機 NPC 的種族特徵（npc_traits.json），以及特殊任務裡「雙腿化回魚尾」的句子
（同時改產生那些任務的 story_batch16.py、story_batch18.py，重跑時一致）。固定 NPC 的外貌在 npc_looks27.json。
設定的是結果，可以重跑（已經改過的不再改）。"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# (檔案, 舊的, 新的)：舊的不在、新的已經在時略過；兩個都不在時報錯
EDITS = [
    # 世界書（簡體）
    ('data/worldbook/elondia.worldbook.json',
     '外观皆呈女性化特征，下身化作玉色鳞尾，',
     '外观皆呈女性化特征，生有双腿，腰后另有一条粗圆的玉色鳞尾，'),
    ('data/worldbook/elondia.worldbook.json',
     '唯独下半身化作覆有玉色鳞片的鱼尾，尾鳍如绢丝般轻薄，随水流舒展摆动。',
     '生有与人类无异的双腿，腰后另长着一条粗圆丰润、覆有玉色鳞片的鱼尾，形似鲸尾，尾端是左右舒展的宽大尾鳍，如绢丝般轻薄，游水时与双腿一同摆动。'),
    ('data/worldbook/elondia.worldbook.json',
     '因体内蕴藏与生俱来的化形之力，玉璘族可短暂将鱼尾化作双腿踏上陆地，但维持时间有限，久居陆上仍需定时归返海中。',
     '玉璘族上岸行走无需化形，多把鱼尾收在衣裙之下；只是鳞片与鳃离水久了会干涩，久居陆上仍需定时泡水或归返海中。'),
    ('data/worldbook/elondia.worldbook.json', '玉璘族常结伴化形登岸赴宴', '玉璘族常结伴登岸赴宴'),
    ('data/worldbook/elondia.worldbook.json', '玉璘族族人时常结伴化形登岸赴宴', '玉璘族族人时常结伴登岸赴宴'),
    # 隨機 NPC 的種族特徵：每一項都帶到魚尾（只會抽到一項）
    ('data/world/npc_traits.json',
     '{"t": "耳後與頸側有細密的鰓裂"}',
     '{"t": "耳後與頸側有細密的鰓裂，腰後拖著一條粗圓的玉色鱗尾"}'),
    ('data/world/npc_traits.json',
     '{"t": "化形後的雙腿上隱約留著玉色鱗紋"}',
     '{"t": "腰後一條像鯨尾般肥厚的鱗尾，尾端是寬大的尾鰭，雙腿上隱約留著玉色鱗紋"}'),
]

# 特殊任務：產生的 stories.json 與產生它的腳本一起改
STORY_EDITS = [
    ('story_batch16.py', '她的尾巴——化形之後藏在忍裝下的那一截——在輕輕地擺', '她的尾巴——平常藏在忍裝下的那一截——在輕輕地擺'),
    ('story_batch16.py', '朧坐在防波堤上，雙腳化回了魚尾，泡在海裡', '朧坐在防波堤上，把雙腳和尾巴一起泡在海裡'),
    ('story_batch18.py', '漣脫下了陸地洋裝，雙腿化回了魚尾，泡在淺灘上', '漣脫下了陸地洋裝，放開了平常盤在裙子裡的魚尾，泡在淺灘上'),
]


def apply(path: str, old: str, new: str, count: int | None = None) -> None:
    s = open(path, encoding='utf-8').read()
    if old not in s:
        assert new in s, f'{path}: 找不到「{old[:20]}…」'
        return
    if count is not None:
        assert s.count(old) == count, f'{path}: 「{old[:20]}…」出現 {s.count(old)} 次'
    s = s.replace(old, new)
    if path.endswith('.json'):
        json.loads(s)
    open(path, 'w', encoding='utf-8').write(s)


if __name__ == '__main__':
    for path, old, new in EDITS:
        apply(path, old, new, 1)
    for script, old, new in STORY_EDITS:
        apply(os.path.join(HERE, script), old, new, 1)
        apply('data/rules/stories.json', old, new, 1)
    print('yulin body', len(EDITS) + len(STORY_EDITS))
