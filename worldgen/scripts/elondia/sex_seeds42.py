# 固定 NPC 的初始性經歷（docs/LEWD_STATS.md 第 29 節；solo 是自慰的次數）：設定裡寫得很清楚的人（還是處女、人妻、寡婦、
# 當過奴隸、花魁……）指定 sex，其他照標籤與 id 擲。沒寫淫亂的人，初始淫亂也會照這份經歷調整
# （沒有經驗的打折、經驗多的加一點），這樣不會再有「設定是處女的人，淫亂比人妻還高」。
# 只改每個人那一行的 sex 欄位；可以重跑（重跑會先拿掉舊的 sex 再寫上）。在 repo 根目錄執行。
import json
import re

P = 'data/world/npcs.json'

V = {'virgin': True}

SEEDS = {
    # ---- 還沒有經驗 ----
    'npc_lucia': {'solo': 3, **V, 'notes': '連自己都很少碰；下腹的淫紋還沒「用過」'},
    'npc_isadora': {'solo': 60, **V, 'notes': '偷偷收藏一整櫃禁書；被支配時意外地乖順'},
    'npc_margarete': {**V, 'notes': '成套的蕾絲內衣，是為一個從未出現的人準備的'},
    'npc_eve': {**V, 'notes': '一百五十年來沒有人越過她的防線'},
    'npc_eileen': {**V, 'notes': '死前還沒來得及度過新婚之夜'},
    'npc_zero': {**V, 'notes': '所有機能都是「未測試功能」'},
    'npc_oboro': {**V, 'notes': '修行過房中術，卻只學了理論'},
    'npc_aya': {'solo': 120, **V, 'notes': '祈禱書裡寫滿和黝黑異族男人的妄想'},
    'npc_td_wanning': {'solo': 300, **V, 'notes': '和親三年，夫婦從未同帳；常常偷看摔跤看得臉紅'},
    # 劇情寫的是她們的第一次（11/9 實測決定：以前寫成有經驗）
    'npc_yh_xuanshuang': {**V, 'notes': '雙修講究陰陽相濟，等了十年的「有緣人」才肯真的修'},
    'npc_yh_wen_ruyu': {**V, 'notes': '教了十三年的規矩，自己一次也沒有用過'},
    # ---- 有經驗 ----
    'npc_clara': {'solo': 200, 'virgin': False, 'partners': 1, 'times': 120, 'service_partners': 1, 'service_times': 30, 'first': '新婚之夜，和現在冷落她的丈夫', 'notes': '書裡寫的每一個情節都想親身試一次'},
    'npc_lieselotte': {'solo': 150, 'virgin': False, 'partners': 1, 'times': 60, 'first': '和丈夫，在麵包店的閣樓', 'notes': '丈夫一年只回家一次，身體正值慾望最旺盛的年紀'},
    'npc_amelia': {'solo': 250, 'virgin': False, 'partners': 1, 'times': 300, 'service_partners': 1, 'service_times': 80, 'first': '和出海未歸的丈夫', 'notes': '久未被觸碰；衣櫃深處藏著不敢承認用過的東西'},
    'npc_yh_wen_yi': {'solo': 100, 'virgin': False, 'partners': 1, 'times': 300, 'service_partners': 1, 'service_times': 100, 'first': '大婚之夜，和先帝', 'notes': '寡居多年，一碰就輕輕發抖'},
    'npc_yh_hu_yuxiao': {'virgin': False, 'partners': 2, 'times': 600, 'service_partners': 2, 'service_times': 300, 'notes': '宮裡說她是迷惑先帝的狐狸精，她從不否認'},
    'npc_cassandra': {'virgin': False, 'partners': 30, 'times': 300, 'service_partners': 30, 'service_times': 250, 'first': '被賣到荒原之後，由不得她選', 'notes': '把人當成調教的對象；私底下渴望遇到能讓她跪下的人'},
    'npc_belvia': {'virgin': False, 'partners': 6, 'times': 200, 'service_partners': 6, 'service_times': 150, 'first': '被盜賊抓去當玩物的那一年', 'notes': '忘不了身體記住的事，這讓她更厭惡自己'},
    'npc_noir': {'virgin': False, 'partners': 3, 'times': 40, 'service_partners': 2, 'service_times': 15, 'notes': '冷淡的外表下，在床上是三人裡最黏人的那個'},
    'npc_camilla': {'virgin': False, 'partners': 12, 'times': 90, 'service_partners': 10, 'service_times': 60, 'notes': '白濁魔導：說是為了「提升魔力迴路的效率」'},
    'npc_elena': {'virgin': False, 'partners': 6, 'times': 50, 'service_partners': 8, 'service_times': 70, 'notes': '施法要用精液；對快感的反應和臉上的平靜完全相反'},
    'npc_sister_agathe': {'virgin': False, 'partners': 40, 'times': 160, 'service_partners': 40, 'service_times': 160, 'notes': '大腿內側用墨水記著一排排的數字'},
    'npc_seph_fertility': {'virgin': False, 'partners': 20, 'times': 120, 'notes': '豐饒的祭儀'},
    'npc_yh_xiao_fengyi': {'virgin': False, 'partners': 15, 'times': 120, 'service_partners': 15, 'service_times': 80, 'notes': '戲台上的旦角都是她手把手教出來的，教的不只是唱腔'},
    'npc_yh_chihuan': {'virgin': False, 'partners': 20, 'times': 80, 'notes': '輸給她的人可以用身子抵債，贏了她的人也一樣'},
    'npc_yh_hu_sanniang': {'virgin': False, 'partners': 4, 'times': 30, 'notes': '仙家附身時主動得嚇人，事後什麼都不記得'},
    'npc_yh_liu_mama': {'virgin': False, 'partners': 3, 'times': 500, 'notes': '年輕時是出了名的「好生養」'},
    'npc_td_urina': {'virgin': False, 'partners': 8, 'times': 70, 'notes': '先讓對方騎上來，再讓對方知道誰才是騎的那一個'},
    'npc_td_sarilang': {'virgin': False, 'partners': 5, 'times': 60, 'notes': '牝馬發情的季節，身子也跟著發熱'},
    'npc_serena': {'virgin': False, 'notes': '精通房中術；當上花魁那年在大腿內側刺了一朵蓮花'},
    'npc_mentor_indulgence': {'virgin': False, 'partners': 80, 'times': 600, 'service_partners': 60, 'service_times': 300},
    'npc_mentor_servitude': {'virgin': False, 'partners': 20, 'times': 300, 'service_partners': 25, 'service_times': 400, 'notes': '頸子上淡淡的舊項圈痕是「畢業的證明」'},
    'npc_mentor_punishment': {'virgin': False, 'partners': 15, 'times': 150},
    'npc_mentor_bondage': {'virgin': False, 'partners': 12, 'times': 120},
    'npc_mentor_flesh': {'virgin': False, 'partners': 25, 'times': 300},
    'npc_mentor_exhibition': {'virgin': False, 'partners': 10, 'times': 100},
    'npc_mentor_abstinence': {'virgin': False, 'partners': 30, 'times': 120, 'notes': '年輕時是放蕩的貴族次子；荒唐的宴會之後走進了聖殿'},
    'npc_count_krause': {'virgin': False, 'partners': 15, 'times': 600, 'service_partners': 0, 'service_times': 0, 'notes': '把女僕當成府裡的家具，只管自己舒服'},
    'npc_haru_redmane': {'virgin': False, 'partners': 20, 'times': 200, 'notes': '求偶祭的篝火夜裡，一個不夠就一群'},
    'npc_yh_suo_ye': {'virgin': False, 'partners': 12, 'times': 300, 'notes': '織坊街的寡婦們都說他硬朗'},
}

s = open(P, encoding='utf-8').read()
known = {n['id'] for n in json.loads(s)['npcs']}
missing = [i for i in SEEDS if i not in known]
assert not missing, missing

for npc_id, seed in SEEDS.items():
    # 各批腳本寫的格式不一樣：「{ "id": 」或「{"id": 」，一個人一行或好幾行；只動 id 所在的那一行
    m = re.search(r'\{ ?"id": "%s", ' % re.escape(npc_id), s)
    a = m.start()
    line_end = s.index('\n', a)
    line = re.sub(r'"sex": \{[^{}]*\}, ', '', s[a:line_end])
    head = m.group(0)
    piece = '"sex": ' + json.dumps(seed, ensure_ascii=False) + ', '
    line = line.replace(head, head + piece, 1)
    s = s[:a] + line + s[line_end:]

json.loads(s)
open(P, 'w', encoding='utf-8').write(s)
print(f'{len(SEEDS)} 位固定 NPC 寫上了初始性經歷')
