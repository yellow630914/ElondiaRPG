# 從固定 NPC（parts/npcs-*.json、npcs.md）與特殊任務（parts/stories.json）產生世界書條目 parts/prompts.json。
# 用法（在專案根目錄）：python3 worldgen/worlds/elondia-plus/scripts/gen_prompts.py
#
# 產出：
#   lore：改寫內建條目——六個「區域-…」加上「重要人物」與「近來的傳聞」，「區域地理與勢力劃分概述」加上各勢力的現任首領
#   customLore：主線「龍影之兆」的背景，以及每位 A 層人物的人物條目（關鍵字觸發）
import json, re, glob, os

ROOT = os.path.join(os.path.dirname(__file__), '..')
BOOK = json.load(open('data/worldbook/elondia.worldbook.json'))['entries']
NPCS = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'parts', 'npcs-*.json'))):
    NPCS.update(json.load(open(f))['npcs'])
BUILTIN_NPCS = {n['id']: n for n in json.load(open('data/world/npcs.json'))['npcs']}
STORIES = json.load(open(os.path.join(ROOT, 'parts', 'stories.json')))['stories']
BY_NAME = {n['name']: n for n in NPCS.values()}

# ---- 讀 npcs.md 的表格：地區、地點、層、出現、身分 ----
REGION_UID = {'中央平原與丘陵地帶': 6, '北境群山': 7, '南境枯萎荒原': 27, '古樹森林': 32, '東海群島': 33, '西部荒野': 41}
rows = []
region = place = None
for line in open(os.path.join(ROOT, 'npcs.md')):
    if line.startswith('## '):
        region = line[3:].strip()
    elif line.startswith('### '):
        place = re.sub(r'（.*）', '', line[4:].strip())
    elif line.startswith('| ') and region in REGION_UID:
        c = [x.strip() for x in line.strip().strip('|').split('|')]
        if len(c) < 7 or c[3] not in 'ABCD' or not c[3]:
            continue
        star = c[0].startswith('⭐')
        name = c[0].replace('⭐', '').strip()
        rows.append({'region': region, 'place': place, 'name': name, 'star': star, 'tier': c[3], 'appear': c[4].replace('（特殊地圖）', ''), 'who': c[5]})

# ---- 區域條目：重要人物與近來的傳聞 ----
RUMORS = {
    6: ['mod_story_mirror_crack', 'mod_story_duke_salon', 'mod_story_princess_letter', 'mod_story_basement_guest'],
    7: ['mod_story_fireless_iron', 'mod_story_blue_beacon', 'mod_story_giants_runes'],
    27: ['mod_story_bloodhorn_challenge', 'mod_story_soulwell_cry', 'mod_story_greenhouse_voice', 'mod_story_blank_oath', 'mod_story_ghost_ship'],
    32: ['mod_story_spring_fading', 'mod_story_sprout_and_verdant', 'mod_story_thorn_dream'],
    33: ['mod_story_reef_light', 'mod_story_whitewhale_blacksail'],
    41: ['mod_story_grand_rite', 'mod_story_trial_valley', 'mod_story_missing_list'],
}
# 主線的徵兆：每個地區一句，不寫答案
OMENS = {
    6: '低语墓穴附近的荒野，黄昏时会无声地重演千年前的帝国统一战争；有人说天上多了一颗不该存在的星。',
    7: '石誓会的守门骑士坚称铁炉堡地底的「封印之门」后面传来敲击声，议会只说那是地鸣。',
    27: '血羽城堡的老魔族私下说，荒原深处也有一扇比议会还古老的门。',
    32: '精灵的星术师说天上那颗陌生的星正在变大，月影根穴深处的月光一年比一年冷。',
    33: '沧月阙的四殿最近气氛紧张，冬璃宫闭门不见客；潮汐港的走私船在骷髅潮岛附近出没得更勤了。',
    41: '月尾部落的巫者说，静泉里祖灵的倒影最近会突然变成陌生的龙形。',
}
lore = {}
for region, uid in REGION_UID.items():
    people = [r for r in rows if r['region'] == region and (r['tier'] in 'AB' or r['star'])]
    out = ['', '', '重要人物（当代）:']
    cur = None
    for r in people:
        if r['place'] != cur:
            cur = r['place']
            out.append(f'  {cur}:')
        out.append(f"    - {r['name']}（{r['appear']}）: '{r['who']}'")
    out.append('近来的传闻（玩家可能遇到的事，结果未定；玩家没接触前不要写出结局）:')
    out.append(f"  - '{OMENS[uid]}'")
    for sid in RUMORS[uid]:
        out.append(f"  - '{STORIES[sid]['summary']}'")
    lore[str(uid)] = {'content': BOOK[str(uid)]['content'].rstrip() + '\n'.join(out)}

# ---- 勢力概述：各勢力的現任首領 ----
LEADERS = [
    ('萊茵帝國', '皇帝奧托三世；長女艾蕾諾拉・馮・萊茵任宰相'),
    ('晨曦王國', '女王阿德萊德二世；表兄洛倫佐・德・瓦洛公爵暗中拉攏貴族'),
    ('聖環教廷', '教皇格里高利七世；審判長瓦倫汀・克雷掌管「真理之鏡」'),
    ('奧德聯邦', '七議席議會，本屆輪值首席康斯坦絲・瓦格納'),
    ('矮人氏族聯盟', '「山之王系」的矮人王托林・鐵爐，主持鍛炎議會'),
    ('魔族領主議會', '魔王「赤翼之君」莉莎爾；血角氏族酋長格羅姆・碎角是最大的反對派'),
    ('精靈王庭', '女王伊瑟蘭迪爾'),
    ('七潮議會（潮汐港）', '首席貝雅特麗絲，人稱「白鯨」；走私王「黑帆」卡洛斯掌握地下貿易'),
    ('玉璘族四時殿（滄月闕）', '今年的潮主是春潮閣殿主櫻汐'),
    ('荒野部落聯盟', '大祭禮娜伊薇（月尾）；赤鬃族長卡菈不滿大祭禮總出身月尾'),
]
lore['28'] = {'content': BOOK['28']['content'].rstrip() + '\n\n各势力现任首领:\n' + '\n'.join(f"  - {k}: '{v}'" for k, v in LEADERS)}

# ---- 新增的條目 ----
def name_of(i):
    n = NPCS.get(i) or BUILTIN_NPCS.get(i)
    return n['name'] if n else i

custom = []
uid = 100000
main = [STORIES[f'mod_story_main_{i}'] for i in range(1, 6)]
custom.append({
    'uid': uid, 'comment': '主线-龙影之兆', 'mode': 'keyword', 'order': 610, 'adult': False, 'builtin': False,
    'keys': ['龍影', '七道裂痕', '封印紋', '封印之門', '七扇門', '第八種現象', '月之碎片', '雪玉璜', '不該存在的星', '塞拉菲娜'],
    'content': '\n'.join([
        '主线「龙影之兆」（玩家依章节推进，尚未经历的部分不要提前揭露）:',
        "  核心: '七种巨龙的投影开始重叠出现。创世之战后，七道封印之门分别镇在大陆各处，「七道裂痕的圆环」就是它们的封印纹。龙不是敌人，而是警报：投影越频繁，表示封印越松动。源头是封在银月城地底、月影根穴最深处的「月之碎片」；天上那颗不该存在的星，是「第八种现象」的开端。'",
        '  章节:',
        *[f"    - {s['title']}（{s['rank']} 级）: '{s['summary']}'" for s in main],
        "  已知的门: '北境铁炉堡地底（石誓会看守）、东海（由冬璃宫的雪玉璜镇着）、南境荒原深处、银月城地底；其余几处无人知晓。'",
    ]),
})

TITLES = {
    'mod_npc_pope_gregory': ['教皇'], 'mod_npc_otto_iii': ['皇帝', '奧托'], 'mod_npc_adelaide_ii': ['晨曦女王', '阿德萊德'],
    'mod_npc_constance_wagner': ['輪值首席'], 'mod_npc_thorin_ironforge': ['矮人王'],
}
TITLE_BY_NAME = {
    '瓦爾卡斯・熔鑄': ['炎獄軍團'], '諾克緹絲': ['暗影氏族'], '格羅姆・碎角': ['血角氏族'], '艾瑟里昂': ['灰燼修會'],
    '伊瑟蘭迪爾': ['精靈女王'], '貝雅特麗絲': ['白鯨'], '櫻汐': ['潮主'], '娜伊薇': ['大祭禮'], '卡菈': ['赤鬃族長'], '薩芙': ['夜爪首領'],
}
for r in rows:
    if r['tier'] != 'A':
        continue
    n = BY_NAME.get(r['name'])
    if not n:
        raise SystemExit(f'npcs.md 的 {r["name"]} 在 parts 裡找不到')
    uid += 1
    keys = [n['name']]
    inner = re.findall(r'「(.+?)」', n['name'])
    bare = re.sub(r'「.+?」', '', n['name']).strip()
    keys += inner + ([bare] if bare and bare != n['name'] else [])
    if '・' in bare:
        keys.append(bare.split('・')[0])
    keys += TITLES.get(n['id'], []) + TITLE_BY_NAME.get(n['name'], [])
    rel = '；'.join(f'{name_of(k)}：{v}' for k, v in (n.get('relations') or {}).items())
    lines = [f"人物-{n['name']}:",
             f"  身分: '{r['who']}'",
             f"  所在: '{r['place']}・{r['appear']}'",
             f"  性格: '{n['personality']}'",
             f"  外貌: '{n['appearance']}'",
             f"  背景: '{n['background']}'"]
    if rel:
        lines.append(f"  人际关系: '{rel}'")
    custom.append({'uid': uid, 'comment': f"人物-{n['name']}", 'mode': 'keyword', 'order': 650, 'adult': False, 'builtin': False,
                   'keys': list(dict.fromkeys(keys)), 'content': '\n'.join(lines)})

json.dump({'lore': lore, 'customLore': custom}, open(os.path.join(ROOT, 'parts', 'prompts.json'), 'w'), ensure_ascii=False, indent=1)
print(f'lore {len(lore)} 條、customLore {len(custom)} 條；人物 {len(rows)} 列')
