# 史詩的指引（2026-11-08）：接了任何一條政治或巨龍相關的故事線，就自動開始一條指引，
# 告訴玩家政治史詩「風暴的前夜」在哪裡接、走完之後巨龍史詩找誰。
# 開頭是「條件成立時自動開始」（start.kind = auto，story.ts 的 startAutoStories）。
# 觸發的故事線：
# - 政治：結果會動到人類、魔族兩邊走向（human_stance、demon_stance）的故事線——政治史詩的路線看這兩個計數器
# - 巨龍：巨龍史詩的結局會看的那五條線（龍的寶藏、龍的線索、巨龍之影、沙漠中的巨塔、莫菲的睡眠品質）
# - 東大陸的政治線（2026-11-08 加入）：大燁的政體、媞丹的走向、南北交會，以及接得到它們之前要走完的線
#   （大燁的政體要某一條「yh?_end_*」結局、媞丹的走向要某一條「td?_end_*」結局）
# 這些線的每個任務開始時設定的旗標（start_flags）都列進 flags_any。
# 冒險筆記上的提示（hints）：第一個任務點之後，告訴玩家政治史詩、東大陸的政治線在哪裡接、要幾級與階級。可以重跑。
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from east_story_io import write_stories  # noqa: E402

P = 'data/rules/stories.json'
d = json.load(open(P))
S = d['stories']

GUIDE = 'epic_guide'
DRAGON_LINES = ['龍的寶藏', '龍的線索', '巨龍之影', '沙漠中的巨塔', '莫菲的睡眠品質']
# 巨龍史詩已經開始的存檔不需要指引
DRAGON_STARTS = ['drg_kag_start', 'drg_sin_start', 'drg_sor_start', 'drg_bab_start']


def line_of(s):
    m = re.search(r'（([^（）]*)）\s*$', s['summary'])
    return re.sub(r'・[一二三四五六七八九十終序].*$', '', m.group(1)) if m else ''


def moves_stance(s):
    return bool(re.search(r'"(human_stance|demon_stance)"', json.dumps(s, ensure_ascii=False)))


others = [s for s in S if s['id'] != GUIDE]
political = {line_of(s) for s in others if moves_stance(s) and not s['id'].startswith(('pol_', 'group_'))}
by_id = {s['id']: s for s in S}
# 東大陸的政治線：開頭任務的接取條件（至少一個成立）裡的結局旗標，是哪幾條線設的
EAST_POL_FIRST = ['yhpol_new_policy', 'tdpol_summons', 'nspol_envoys']
east_pol = {line_of(by_id[i]) for i in EAST_POL_FIRST}
east_pre = set()
for i in EAST_POL_FIRST:
    ends = set(by_id[i]['start'].get('requires', {}).get('flags_any', []))
    for s in others:
        if ends & set(re.findall(r'"([a-z0-9_]+)"', json.dumps(s['nodes']))):
            east_pre.add(line_of(s))
assert east_pol and east_pre, '找不到東大陸的政治線'
lines = political | set(DRAGON_LINES) | east_pol | east_pre
trigger = sorted({f for s in others if line_of(s) in lines for f in s.get('start_flags', [])})
assert trigger, '找不到觸發的旗標'

starts = {f for s in S if s['id'].startswith('drg_') for f in s.get('start_flags', [])}
for f in DRAGON_STARTS:
    assert f in starts, f'巨龍史詩沒有開頭旗標 {f}'

GUILD = {'where': 'cell', 'location': 'rivervale', 'cell': 'guild'}
guide = {
    'id': GUIDE,
    'title': '史詩的指引',
    'summary': '各國的戰與和、沉睡巨龍的動靜，最後都會匯流成兩段史詩：政治史詩「風暴的前夜」（Lv.14、公會 A 級起，河谷鎮的冒險者公會），走完它的終章「阿契隆的注視」之後是巨龍史詩（Lv.18～19、S 級）。東大陸的大燁、媞丹也各有自己的政治線。（史詩的指引）',
    'merit': 0,
    'start': {
        'kind': 'auto',
        'requires': {'flags_any': trigger, 'flags_none': DRAGON_STARTS},
        'text': '你插手的事越來越多——各國的戰與和、傳說中沉睡的巨龍。冒險者之間流傳著一句話：「想知道這些事最後會走到哪裡，就去問河谷鎮公會的主管。」',
    },
    'start_flags': ['eg_start'],
    'nodes': [
        {
            'id': 'politics',
            'title': '到河谷鎮的冒險者公會打聽各國的情勢',
            'text': '河谷鎮公會的主管聽你說完，從櫃檯底下抽出一張畫滿記號的大陸地圖：萊茵堡、血羽城堡、索里耶爾、晨光城、獸骨荒丘，每座城旁邊都用紅筆寫著「戰」，或用藍筆寫著「和」。',
            'at': GUILD,
            'requires': {'flags': ['eg_start'], 'flags_none': ['pol_start']},
            'kind': 'story',
            'success': {
                'text': '「你插手的每一件事，都算在這張圖上。」主管用指節敲了敲地圖，「等你到了 14 級、公會的階級到了 A，回來這裡——我會交給你一份『全大陸的情勢彙整』，那是政治史詩的開頭『風暴的前夜』。各國最後是和是戰，要看你之前在那些故事裡怎麼選。」他把地圖捲起來，「至於那些龍……等這件事落幕了再說。」',
                'set_flags': ['eg_pol_told'],
            },
        },
        {
            'id': 'dragons',
            'title': '政治史詩落幕之後，回河谷鎮的公會打聽巨龍的動靜',
            'text': '天空的裂縫闔上之後，河谷鎮公會的主管把你叫進後面的房間。桌上攤著四封信：一封沾著鍛爐的煤灰，一封還帶著海水的鹹味，一封透著銀月城的夜露，一封纏著草原的沙。',
            'at': GUILD,
            'requires': {'flags': ['eg_start', 'dragon_calamity']},
            'kind': 'story',
            'success': {
                'text': '「四條龍都醒了。」主管把信一封一封推給你，「熱量之龍卡格尼，去風錘村找老鐵根；詭秘之龍希諾爾，去珊瑚灣鎮的海靈祠找澪——這兩條龍，18 級就能去。夢境之龍索利安，去銀月城找艾溫娜；塔之龍巴別林，去烈日草原找塔洛——這兩條要到 19 級。」他頓了一下，「四件都是 S 級的事：一個人去要 S 級，帶著隊伍的話 A 級也行。」他看著你，「你之前在牠們的故事裡做過什麼，牠們都記得。四條龍都平息了，再回來這裡——最後那一隻，還在天上看著。」',
                'set_flags': ['eg_drg_told'],
                'complete': True,
            },
        },
    ],
}

def first(i):
    s = by_id[i]
    return s['title'], s['start'].get('min_level'), s.get('rank'), s['start'].get('requires', {}), s['start_flags']


def rank_text(r):
    # 單人要同級，組隊（2 人以上）可以高一級（story.ts 的 storyRankOk）
    lower = {'S': 'A', 'A': 'B', 'B': 'C'}.get(r)
    return f'公會 {r} 級（組隊 {lower} 級）' if lower else f'公會 {r} 級'


yh_title, yh_lv, yh_rank, yh_req, yh_start = first('yhpol_new_policy')
td_title, td_lv, td_rank, td_req, td_start = first('tdpol_summons')
ns_title, ns_lv, ns_rank, ns_req, ns_start = first('nspol_envoys')
assert by_id['yhpol_new_policy']['start']['location'] == 'longan'
assert by_id['tdpol_summons']['start']['location'] == 'jinzhang'
assert by_id['nspol_envoys']['start']['location'] == 'yinghe'
pol_title, pol_lv, pol_rank, _, pol_start = first('pol_storm_eve')
assert pol_start == ['pol_start'] and pol_lv == 14 and pol_rank == 'A'
guide['hints'] = [
    {'text': f'Lv.{pol_lv}、{rank_text(pol_rank)}以後，到河谷鎮的冒險者公會接政治史詩「{pol_title}」',
     'requires': {'flags': ['eg_pol_told'], 'flags_none': ['pol_start']}},
    {'text': '走完政治史詩，終章是「阿契隆的注視」；落幕之後回河谷鎮的公會打聽巨龍的動靜',
     'requires': {'flags': ['pol_start'], 'flags_none': ['dragon_calamity']}},
    {'text': f'東大陸・大燁的政體：Lv.{yh_lv}、{rank_text(yh_rank)}以後，到龍安府的冒險者公會接「{yh_title}」',
     'requires': {**yh_req, 'flags_none': yh_start}},
    {'text': f'東大陸・媞丹的走向：Lv.{td_lv}、{rank_text(td_rank)}以後，到金帳王庭的冒險者公會接「{td_title}」',
     'requires': {**td_req, 'flags_none': td_start}},
    {'text': f'東大陸・南北交會：Lv.{ns_lv}、{rank_text(ns_rank)}以後，到鷹河榷場的冒險者公會接「{ns_title}」',
     'requires': {**ns_req, 'flags_none': ns_start}},
]

write_stories([guide])
print('trigger lines:', len(lines), 'flags:', len(trigger))
print(sorted(lines))
