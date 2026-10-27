# 把任務的獨特裝備整理成 docs/ITEMS.md 的 3.1.1 節（接在 3.2 節之前；可以重跑）
import json, re
import uniq23 as U
R = ''
G = U.G
items = {i['name']: i for i in json.load(open(R + 'data/rules/items.json'))['items']}
S = json.load(open(R + 'data/rules/stories.json'))['stories']
DT = {t['id']: t['name'] for t in json.load(open(R + 'data/rules/damage_types.json'))['types']}
DT.update(json.load(open(R + 'data/rules/damage_types.json'))['groups'])
MOD = {'hit': '命中', 'damage': '傷害', 'evade': '迴避', 'dr': '減傷', 'save': '豁免', 'crit': '幸運一擊', 'ap_regen': '行動點回復'}
CTX = {'initiative': '戰鬥先攻', 'save': '豁免', 'stealth': '潛行', 'trap': '察覺陷阱', 'lock': '開鎖', 'travel': '旅行途中的危險', 'road': '旅途上的事件',
       'gate': '城門盤查', 'retreat': '撤出地下城', 'negotiation': '交涉'}
ATTR = {'str': '力量', 'dex': '靈巧', 'int': '智力', 'fai': '信仰', 'cha': '魅力'}
VS = {'priest': '神官', 'bishop': '主教', 'noble': '貴族', 'royal': '王族'}
KIND = {'chat': '聊天', 'flatter': '獻媚', 'haggle': '殺價', 'bargain': '交涉價格'}
RAR = {k: v['name'] for k, v in G['rarities'].items()}
CLS = {k: v['name'] for k, v in U.CLS.items()}

given = {}
for s in S:
    for e in s.get('rewards', []):
        if e['type'] == 'item': given[e['name']] = s
    for n in s['nodes']:
        for o in [n.get('success'), n.get('fail')] + [x.get(k) for x in n.get('options', []) for k in ('success', 'fail')]:
            for e in (o or {}).get('effects', []):
                if e['type'] == 'item': given[e['name']] = s


def ench(g):
    e = g.get('enchants', {})
    out = [f"{MOD[k]} +{v}" for k, v in e.get('mods', {}).items()]
    out += [f"{DT[k]}攻擊 +{int(v * 100)}%" for k, v in e.get('offense', {}).items()]
    out += [f"{DT[k]}抗性 {int(-v * 100)}%" for k, v in e.get('resist', {}).items()]
    out += [f"{ATTR[k]} +{v}" for k, v in g.get('attrs', {}).items()]
    return '、'.join(out)


def chk(u):
    c = u['check']
    if 'attrs' in c: t = '、'.join(ATTR[a] for a in c['attrs']) + '檢定'
    elif 'vs_tags' in c: t = '對' + '、'.join(VS[a] for a in c['vs_tags']) + '的檢定'
    elif 'kinds' in c: t = '、'.join(KIND[a] for a in c['kinds'])
    else: t = '、'.join(CTX[a] for a in c['contexts'])
    return f"{t} +{u['bonus']}"


def where(s, name):
    if name in sum((v for v in U.P5.values()), []): return f"打倒投影（{s['title']}）"
    if s['id'] in U.SPOILS: return f"{s['title']}的結尾選一件"
    if any(name in L for L in (U.P3_NEW_DESIGN, U.P3_BROKEN, U.P3_MACH_ARMOR, U.P3_GIANT_ARMOR, U.P3_TREASURE, U.P3_CHART, U.P4_ORE, U.P4_CHURCH, U.P4_REDWING, U.P4_VAULT)):
        return f"{s['title']}的結尾選一件"
    return f"{s['title']}（`{s['id']}`）的完成獎勵"


BANDS = {1: '第一區間（Lv.5～7）：第二級材料、稀有', 2: '第二區間（Lv.8～11）：第三級材料、史詩', 3: '第三區間（Lv.12～15）：第四級材料、傳說、主屬性 +1',
         4: '第四區間（Lv.16～18）：第五級材料、傳說、屬性 +2', 5: '第五區間（Lv.19～20）：第五級材料、超越傳說（8 點附魔）、主屬性 +3、次屬性 +1'}
lines = ['### 3.1.1 任務的獨特裝備', '',
         '特殊任務給的獨特裝備（149 件，`uniq23.py` 產生）：依職業分配武器、防具、飾品，等級區間越後面越強。不進寶箱、不上黑市（沒有勾 `black_market`），每一件只從一個任務拿得到。獨特裝備（包括寶箱與黑市的）**不能賣給商店**，也不能拿去和人交換（`isUniqueItem`）。',
         '',
         '- **第一、二區間**：每個職業（戰士、野蠻人、聖騎士、遊俠、遊蕩者、武僧、吟遊詩人、牧師、德魯伊、法師）各一件武器、防具、飾品，分散在 Lv.5（第一區間）與 Lv.8、11（第二區間）的特殊任務，**完成任務時**拿到。武僧的武器是纏腕布。只放在非成人向的任務。',
         '- **第三區間**：鍛造與冒險相關的角色開的六個任務（新式武器設計、破損的傳說武器、千爐的機甲、巨人的武庫、又一個神祕的寶藏、老船長的最後一張海圖），**結尾選一件**：兩個武器任務、兩個防具任務、兩個飾品任務，各有 5～6 個選項；每個職業都有武器、防具、飾品可以選。',
         '- **第四區間**：政治史詩白熱化的時期，結尾都是**選一件**。傳說的礦石的後續（武器，十個職業各一把）；教廷、赤翼宮廷的軍需（防具，兩邊都有十個職業各一副；開戰・人類方只能接教廷的、開戰・魔族方只能接赤翼的，和平線兩個都能接）；寶庫失竊案的後續（飾品，三選一）；政治史詩的路線終章與「阿契隆的注視」結尾的論功行賞（各一件飾品，三選一，不限職業）。',
         '- **第五區間**：五條巨龍的投影被打倒時，各掉兩把職業最強的武器（十個職業各一把）。',
         '- 下面表格的「附魔與屬性」只寫附魔與屬性加減，**不含底材與材料本身的加成**；遊戲裡顯示的是加總。例如無紋的附魔是命中 +3、傷害 +3，加上精金的加成後，遊戲裡是傷害 +7、命中 +5。抗性在戰鬥時是乘算（見 COMBAT_SYSTEM）。',
         '- 附魔用稀有度的點數（第五區間多 2 點），依職業分配：戰士命中＋傷害、野蠻人傷害＋幸運一擊、聖騎士傷害＋神聖攻擊、遊俠命中＋幸運一擊、遊蕩者幸運一擊＋命中、武僧命中＋傷害＋幸運一擊、吟遊詩人命中＋心靈攻擊、牧師神聖攻擊＋豁免、德魯伊元素攻擊＋命中、法師元素攻擊＋奧術攻擊；防具偏減傷、迴避、豁免與抗性；飾品依底材。',
         '']
for band in range(1, 6):
    lines += [f'**{BANDS[band]}**', '', '| 物品 | 職業 | 底材・材料 | 附魔與屬性 | 檢定加值 | 取得 |', '|---|---|---|---|---|---|']
    for b, name, base, cls, code, desc in U.ITEMS:
        if b != band: continue
        g = items[name]['gear']
        lines.append(f"| {name} | {CLS.get(cls, '不限')} | {G['bases'][base]['name']}・{G['materials'][g['material']]['name']} | {ench(g)} | {chk(g['unique'])} | {where(given[name], name)} |")
    lines.append('')
P = R + 'docs/ITEMS.md'
doc = open(P).read()
# 接在下一節（寄生物的裝備 3.1.2，或 3.2）之前
doc = re.sub(r'### 3\.1\.1 任務的獨特裝備\n.*?(?=### 3\.1\.2 |### 3\.2 )', '', doc, flags=re.S)
nxt = re.search(r'### 3\.1\.2 |### 3\.2 ', doc).group(0)
doc = doc.replace(nxt, '\n'.join(lines) + '\n' + nxt, 1)
open(P, 'w').write(doc)
print(len(lines))
