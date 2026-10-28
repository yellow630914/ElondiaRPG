# 遊戲攻略：把內建內容（特殊任務、事件、物品、固定 NPC、地標）整理成給玩家查的 Markdown，放在 docs/guide/，
# 同步到 GitHub Wiki 的「遊戲攻略」（tools/wiki/build.mjs）。
# 用法（在 repo 根目錄）：
#     python3 worldgen/tools/guide/guide.py           產生 docs/guide/
#     python3 worldgen/tools/guide/guide.py --check   只檢查 docs/guide/ 是不是最新的（測試 src/__tests__/guide.spec.ts 會跑）
# 內建內容（data/）改過之後重跑一次。特殊任務與地下城、寄生物、城鎮的成人向事件沿用 flowdoc.py 整理好的資料。
import collections, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'flowdoc'))
import flowdoc as F  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / 'docs' / 'guide'
ld = F.ld
loc, npc = F.loc, F.npc

ITEMS = ld('data/rules/items.json')['items']
ENEMIES = F.EN
GEAR = ld('data/rules/gear.json')
SHOPS = ld('data/rules/shops.json')['types']
CRAFTS = ld('data/rules/crafts.json')['skills']
TE = F.TE
MAPS = ld('data/world/maps.json')
NPCS = ld('data/world/npcs.json')['npcs']
LMS = ld('data/world/landmarks.json')['landmarks']
GEO = F.geo
REGION_OF = {l['id']: l.get('region') for l in GEO['locations']}
LOC_TYPE = {l['id']: l.get('type') for l in GEO['locations']}

HEAD = '> 這一頁由 `worldgen/tools/guide/guide.py` 依遊戲資料自動產生，不要直接修改。內容有劇透，攻略的細節收在「展開」裡。\n'
ADULT = '> 🔞 **成人向**：這一頁的內容只在設定開啟「成人向」時出現。\n'


def esc(s):
    """表格裡的文字：| 與換行"""
    return str(s).replace('|', '／').replace('\n', ' ')


def fx_text(fx):
    return '、'.join(t for _, t in fx)


def gfx(o):
    """結果的效果（flowdoc 的效果再加上經驗值）"""
    xp = [('xp', f"經驗 +{x['amount']}") for x in (o or {}).get('effects', []) if x['type'] == 'xp']
    return F.effects(o or {}) + xp


CLASS = {k: v['name'] for k, v in ld('data/rules/classes.json')['classes'].items()}
RACE = {k: v['name'] if isinstance(v, dict) else v for k, v in ld('data/rules/attributes.json')['races'].items()}


# ---- 特殊任務 ----

CATS = [
    ('quests-intro', '入門委託', False, '剛開始冒險時可以接的委託。'),
    ('quests-regions', '地區與勢力', False, '各地區的政治、勢力與事件。'),
    ('quests-dungeons', '地下城', False, '每座地下城的故事線，通常要深入到某一層。'),
    ('quests-characters', '角色線', False, '固定 NPC 的個人故事與戀愛線。'),
    ('quests-characters-adult', '角色線（成人向）', True, '成人向角色的故事線。'),
    ('quests-work-adult', '打工、巡禮與祭典（成人向）', True, '城鎮裡的打工、巡禮與祭典任務線。'),
    ('quests-group', '多人特殊任務', False, '同時牽涉好幾位角色的任務。'),
    ('quests-epic', '史詩', False, '政治史詩與巨龍史詩：後期的大型主線。'),
]


def quest_md(q, out):
    out.append(f"### {q['title']}")
    out.append('')
    meta = [f"階級 {q['rank']}"] if q['rank'] != '—' else []
    if q.get('level'): meta.append(f"Lv.{q['level']} 起")
    if q.get('tags'): meta.append('標籤：' + '、'.join(q['tags']))
    if meta: out.append('・'.join(meta))
    out.append('')
    if q.get('summary'): out.append(q['summary'])
    out.append('')
    out.append(f"- **接取**：{q['who']}" + (f"（{'、'.join(q['startReq'])}）" if q.get('startReq') else ''))
    if q.get('prereq'): out.append('- **前置**：' + '；'.join(t for _, t in q['prereq']))
    if q.get('rewards'): out.append('- **完成報酬**：' + '、'.join(q['rewards']))
    out.append('')
    out.append('<details><summary>攻略（劇透）</summary>')
    out.append('')
    for i, n in enumerate(q['nodes'], 1):
        head = f"{i}. **{n['title']}**（{n['kind']}・{n['where']}）" + ('〔有期限〕' if n.get('urgent') else '')
        out.append(head)
        if n.get('req'): out.append('   - 出現條件：' + '；'.join(t for _, t in n['req']))
        for kind, t in n.get('info', []):
            out.append('   - ' + {'foes': '敵人：', 'check': '判定：', 'wear': '要穿著：'}.get(kind, '') + t)
        for b in n['branches']:
            bits = []
            if b.get('req'): bits.append('條件：' + '；'.join(t for _, t in b['req']))
            if b.get('check'): bits.append(b['check'])
            if b.get('tags'): bits.append('、'.join(b['tags']))
            line = f"   - **{b['label']}**" + (f"（{'；'.join(bits)}）" if bits else '')
            res = []
            if b['fx']: res.append(fx_text(b['fx']))
            if b['next']: res.append('接著：' + '、'.join(f'「{x}」' for x in b['next']))
            if b['unlock']: res.append('解鎖任務：' + '、'.join(f'「{x}」' for x in b['unlock']))
            if b['done']: res.append('任務完成')
            if b['retry']: res.append('可以再試')
            out.append(line + (' → ' + '；'.join(res) if res else ''))
    out.append('')
    out.append('</details>')
    out.append('')


def quests_page(slug, cat, adult, intro):
    lines = [l for l in F.out if l['cat'] == cat]
    out = [f'# 特殊任務：{cat}', '', HEAD + (ADULT if adult else ''), intro, '']
    out.append('| 任務線 | 建議等級 | 開始的人 | 任務數 |')
    out.append('|---|---|---|---|')
    for l in lines:
        out.append(f"| [{esc(l['name'])}](#{anchor(l['name'])}) | {l['lv']} | {esc(l['npc']) or '—'} | {len(l['quests'])} |")
    out.append('')
    for l in lines:
        out.append(f"## {l['name']}")
        out.append('')
        out.append(f"{l['lv']}" + (f"・開始的人：{l['npc']}" if l['npc'] else ''))
        out.append('')
        if l.get('flow'):
            title = {q['id']: q['title'] for q in l['quests']}
            out.append('**順序**：')
            out.append('')
            for f in l['flow']:
                out.append(f"- {f['label']}：" + ('→' if f['seq'] else '、').join(f'「{title.get(i, i)}」' for i in f['ids']))
            out.append('')
        for q in l['quests']: quest_md(q, out)
    return '\n'.join(out)


def anchor(title):
    """GitHub 的標題錨點：小寫、去掉標點、空白換成 -"""
    a = re.sub(r'[^\w\- 一-鿿]', '', title.lower()).replace(' ', '-')
    return a


# ---- 事件 ----

MODES = {'road': '官道', 'trail': '小徑', 'wild': '荒野', 'sea': '海路', 'dive': '潛水', 'underground': '地底'}
CATEGORY = {**TE['town']['categories'], 'combat': '戰鬥'}


def event_branches(t):
    """一個事件的結果：(選項, 判定, 結果文字)"""
    rows = []
    if t['kind'] == 'check':
        c = t['check']
        rows.append(('（自動判定）', f"{F.ATTR.get(c['attr'], c['attr'])} DC {c['dc']}", fx_text(gfx(t.get('success'))) or '—'))
        if t.get('fail'): rows.append(('（判定失敗）', '', fx_text(gfx(t['fail'])) or '—'))
        return rows
    for o in t.get('options', []):
        c = o.get('check')
        chk = f"{F.ATTR.get(c['attr'], c['attr'])} DC {c['dc']}" if c else ''
        rows.append((o['label'], chk, fx_text(gfx(o.get('success'))) or '—'))
        if o.get('fail'): rows.append((o['label'] + '（失敗）', '', fx_text(gfx(o['fail'])) or '—'))
    return rows


def event_md(t, where, out):
    out.append(f"#### {t['title']}")
    out.append('')
    out.append(f"- **在哪裡**：{where}")
    if t.get('category'): out.append(f"- **分類**：{CATEGORY.get(t['category'], t['category'])}")
    if t.get('pc_body'): out.append('- **只給**：' + '、'.join(F.BODYN[b] for b in t['pc_body']))
    if t.get('tier') == 'advanced': out.append('- 進階事件（較少見）')
    out.append('')
    out.append(t['text'])
    out.append('')
    out.append('<details><summary>選項與結果（劇透）</summary>')
    out.append('')
    out.append('| 選項 | 判定 | 結果 |')
    out.append('|---|---|---|')
    for label, chk, res in event_branches(t):
        out.append(f'| {esc(label)} | {esc(chk) or "—"} | {esc(res)} |')
    out.append('')
    out.append('</details>')
    out.append('')


def events_page():
    out = ['# 旅途與城鎮事件', '', HEAD]
    road = [t for t in TE['templates'] if t.get('scope', 'road') == 'road' and 'adult' not in t.get('tags', [])]
    town = [t for t in TE['templates'] if t.get('scope') == 'town' and 'adult' not in t.get('tags', [])]
    ch = TE['chance']
    out.append('## 旅途事件')
    out.append('')
    out.append('在地點之間移動時，每一段路依路況有機率遇到事件：' + '、'.join(f"{MODES.get(k, k)} {int(v * 100)}%" for k, v in ch.items()) + '。事件可能是自動發生、要你選擇，或是遭遇戰。')
    out.append('')
    for t in road:
        modes = '、'.join(MODES.get(m, m) for m in t.get('modes', [])) or '任何路況'
        event_md(t, f'旅途上（{modes}）', out)
    tc = TE['town']
    out.append('## 城鎮事件')
    out.append('')
    out.append(f"走上聚落裡的設施時，有 {int(tc['chance'] * 100)}% 的機率遇到一件事（同一件事 {tc['repeat_days']} 天內不重複，兩次之間至少隔 {tc['cooldown_hours']} 小時）。")
    out.append('')
    for t in town:
        cells = '、'.join(F.CELL.get(c, c) for c in t.get('cells', [])) or '任何設施'
        where = '、'.join(loc(x) for x in t.get('locations', [])) or '任何聚落'
        event_md(t, f'{where}的{cells}', out)
    return '\n'.join(out)


def adult_events_page():
    out = ['# 成人向事件', '', HEAD + ADULT,
           '地下城的色情事件、寄生物的發作、城鎮的成人向事件。都要回應之後才能繼續移動。', '']
    for l in [l for l in F.out if l['cat'] in ('地下城事件（成人向）', '城鎮事件（成人向）')]:
        out.append(f"## {l['name']}")
        out.append('')
        if l.get('flow'): out.append(l['flow'][0]['label'])
        out.append('')
        for q in l['quests']:
            n = q['nodes'][0]
            out.append(f"#### {q['title']}")
            out.append('')
            out.append(f"- **觸發**：{q['who']}")
            if q.get('startReq'): out.append('- ' + '、'.join(q['startReq']))
            out.append('')
            out.append(n['text'])
            out.append('')
            out.append('<details><summary>選項與結果（劇透）</summary>')
            out.append('')
            out.append('| 選項 | 判定 | 結果 |')
            out.append('|---|---|---|')
            for b in n['branches']:
                res = fx_text(b['fx']) or '—'
                if b.get('tags'): res += '（' + '、'.join(b['tags']) + '）'
                out.append(f"| {esc(b['label'])} | {esc(b.get('check', '')) or '—'} | {esc(res)} |")
            out.append('')
            out.append('</details>')
            out.append('')
    return '\n'.join(out)


# ---- 物品的取得方式 ----

def item_sources():
    src = collections.defaultdict(list)
    add = lambda name, s: (s not in src[name]) and src[name].append(s)
    # 任務：完成報酬與過程中的結果
    for st in F.S:
        title = f"特殊任務「{st['title']}」"
        for x in st.get('rewards', []):
            if x['type'] == 'item': add(x['name'], title)
        for n in st['nodes']:
            for _, o, _ in F.outs(n):
                for x in o.get('effects', []):
                    if x['type'] == 'item' and x.get('qty', 1) > 0: add(x['name'], title)
        for name in st['start'].get('items', []): add(name, title + '（接下時）')
    # 事件
    for t in TE['templates']:
        outs = [t.get('success'), t.get('fail')] + [r for o in t.get('options', []) for r in (o.get('success'), o.get('fail'))]
        for o in outs:
            for x in (o or {}).get('effects', []):
                if x['type'] == 'item' and x.get('qty', 1) > 0: add(x['name'], f"事件「{t['title']}」")
    # 怪物掉落
    drops = collections.defaultdict(list)
    for e in ENEMIES.values():
        for x in e.get('loot', []):
            drops[x['item']].append(f"{e['name']}（{int(x['chance'] * 100)}%）")
    for name, who in drops.items():
        add(name, '掉落：' + '、'.join(who[:4]) + (f' 等 {len(who)} 種' if len(who) > 4 else ''))
    # 寶箱
    for layer, c in GEAR['chests'].items():
        if layer.startswith('$'): continue
        for name, p in c.get('items', []):
            add(name, f"寶箱（{F.LAYER.get(layer, layer)}，{p * 100:g}%）")
    # 採集
    for name in MAPS['generation']['wild'].get('resource_items', []): add(name, '採集（近郊）')
    for name in MAPS['generation']['dungeon'].get('resource_items', []): add(name, '採集（地下城）')
    # 寄生物：被寄生時鎖在身上的裝備、馴服之後換成的物品
    PAR = ld('data/rules/parasites.json')['parasites']
    for pid, p in PAR.items():
        if p.get('item'): add(p['item'], f"被「{p['name']}」寄生時穿上（解不掉，要解咒或馴服）")
        tamed = (p.get('tamed') or {}).get('item')
        if tamed:
            qs = sorted({st['title'] for st in F.S for n in st['nodes'] for _, o, _ in F.outs(n)
                         for x in o.get('effects', []) if x['type'] == 'parasite' and x.get('parasite') == pid and x.get('op') == 'tame'})
            add(tamed, f"馴服「{p['name']}」之後換成" + (f"（特殊任務{'、'.join(f'「{q}」' for q in qs)}）" if qs else ''))
    # 地標
    for l in LMS:
        for part in ('explore', 'visit'):
            for x in (l.get(part) or {}).get('effects', []):
                if x['type'] == 'item': add(x['name'], f"地標「{l['name']}」（{loc(l['location'])}）")
    return src


SIZE = {'village': '村莊以上', 'town': '城鎮以上', 'city': '城市以上', 'capital': '王都'}
SHOP_OF_TAG = {v['catalog_tag']: v['name'] for v in SHOPS.values() if v.get('catalog_tag')}


def shop_source(it):
    shops = [SHOP_OF_TAG[t] for t in it.get('tags', []) if t in SHOP_OF_TAG]
    out = []
    if it.get('master_force') is not None: out.append('身為奴隸時，主人可能強制戴上')
    if shops:
        s = '、'.join(shops)
        if it.get('min_location'): s += f"（{SIZE.get(it['min_location'], it['min_location'])}）"
        if it['category'] == 'equipment': s += '，每天隨機上架'
        out.append('商店：' + s)
    if it.get('black_market'): out.append('黑市（每天隨機）')
    return out


def recipe_source(it):
    r = it.get('recipe')
    if not r: return []
    craft = CRAFTS.get(r['craft'], {}).get('name', r['craft'])
    inputs = '、'.join(f"{x['name']}×{x.get('qty', 1)}" for x in r.get('inputs', []))
    return [f"製作：{craft} Lv.{r.get('level', 1)}" + (f"（{inputs}）" if inputs else '')]


CATEGORY_NAME = {k: v if isinstance(v, str) else v.get('name', k) for k, v in ld('data/rules/items.json')['categories'].items()}


def items_page(src):
    out = ['# 物品的取得方式', '', HEAD,
           '裝備另外列在[裝備的取得方式](equipment.md)。商店的庫存依聚落大小與當天隨機變動；「AI 判定」的自由行動也可能給物品，這裡不列。', '']
    by_cat = collections.defaultdict(list)
    for it in ITEMS:
        if it['category'] != 'equipment': by_cat[it['category']].append(it)
    for cat, its in by_cat.items():
        out.append(f"## {CATEGORY_NAME.get(cat, cat)}")
        out.append('')
        out.append('| 物品 | 價格 | 取得方式 |')
        out.append('|---|---|---|')
        for it in sorted(its, key=lambda i: i['price_cc']):
            ways = shop_source(it) + recipe_source(it) + src.get(it['name'], [])
            if it.get('forge') and not ways: ways.append('打造材料：怪物型層主與寶箱的掉落（越深的層越高級）')
            name = it['name'] + (' 🔞' if it.get('adult') else '')
            out.append(f"| {esc(name)} | {it['price_cc']} 白鸛 | {esc('；'.join(ways)) or '目前沒有固定的取得方式'} |")
        out.append('')
    return '\n'.join(out)


BASES = GEAR['bases']
MATS = GEAR['materials']


def equipment_page(src):
    out = ['# 裝備的取得方式', '', HEAD,
           '除了下面列的，**寶箱、人形怪物、敵對冒險者**也會掉落依等級隨機生成的裝備，鐵匠鋪、裁縫店、珠寶店可以**委託打造**（自己選底材與材料）。'
           '**獨特裝備**每一件只有固定的來源，不能賣給商店。', '']
    uniq = [it for it in ITEMS if it['category'] == 'equipment' and 'unique' in it.get('tags', [])]
    std = [it for it in ITEMS if it['category'] == 'equipment' and 'unique' not in it.get('tags', [])]

    def row(it):
        g = it.get('gear') or {}
        b = BASES.get(g.get('base'), {})
        m = MATS.get(g.get('material'), {})
        ways = shop_source(it) + src.get(it['name'], [])
        if not ways and b.get('restraint'): ways.append('戰敗事件或主人強制戴上')
        if not ways and 'unique' not in it.get('tags', []): ways.append('不販售：寶箱、掉落的隨機裝備，或委託打造')
        name = it['name'] + (' 🔞' if it.get('adult') else '')
        return f"| {esc(name)} | {esc(b.get('name', g.get('base', '—')))} | {esc(m.get('name', g.get('material', '—')))} | {it['price_cc']} 白鸛 | {esc('；'.join(ways)) or '—'} |"

    for title, its in (('獨特裝備', uniq), ('一般裝備', std)):
        out.append(f'## {title}')
        out.append('')
        out.append('| 裝備 | 底材 | 材料 | 價格 | 取得方式 |')
        out.append('|---|---|---|---|---|')
        for it in sorted(its, key=lambda i: (i['price_cc'], i['name'])): out.append(row(it))
        out.append('')
    return '\n'.join(out)


# ---- 固定 NPC ----

def places_of(n):
    """NPC（或劇情階段）出沒的地方：活躍地點，沒有時是所在地"""
    hs = [h for h in n.get('haunts', []) if h.get('weight', 1) > 0]
    if hs: return list(dict.fromkeys(f"{loc(h['location'])}{ZONE.get(h['zone'], h['zone'])}" for h in hs))
    return [loc(n['location'])] if n.get('location') else []

ZONE = {'town': '城鎮', 'noble': '貴族區', 'outskirts': '近郊', 'palace': '王城', 'brothel': '娼館', 'temple': '神殿', 'dungeon': '地下城'}


def npcs_page():
    out = ['# 固定 NPC 在哪裡', '', HEAD,
           '固定 NPC 平常出沒的地方與相關的任務線。有些人會隨著任務的進展換地方（「之後」那一欄）。成人向角色標 🔞。', '']
    lines_of = collections.defaultdict(list)
    for st in F.S:
        if st['start'].get('kind') == 'npc' and st['start'].get('npc'):
            m = re.search(r'（([^（）]*)）\s*$', st['summary'])
            name = re.sub(r'・[一二三四五六七八九十終序].*$', '', m.group(1)) if m else st['title']
            if name not in lines_of[st['start']['npc']]: lines_of[st['start']['npc']].append(name)
    regions = {r['id']: r['name'] for r in GEO['regions']}
    by_region = collections.defaultdict(list)
    for n in NPCS: by_region[REGION_OF.get(n['location'])].append(n)
    for rid, ns in by_region.items():
        out.append(f"## {regions.get(rid, rid or '其他')}")
        out.append('')
        out.append('| 角色 | 身分 | 平常在哪 | 之後 | 相關任務線 |')
        out.append('|---|---|---|---|---|')
        for n in sorted(ns, key=lambda n: (loc(n['location']), n['level'])):
            places = []
            if n.get('landmark'): places.append(f"地標「{F.LM.get(n['landmark'], n['landmark'])}」")
            if not n.get('landmark'): places.append('、'.join(places_of(n)))
            now = set(places_of(n))
            later = []
            for s in n.get('stages', []):
                for p in places_of(s):
                    if p not in now and p not in later: later.append(p)
            later = '、'.join(later)
            who = f"{RACE.get(n['race'], n['race'])}{CLASS.get(n['class']) or n.get('occupation', '')}・Lv.{n['level']}"
            name = n['name'] + (' 🔞' if n.get('adult') else '')
            extra = [] if not n.get('unhireable') else ['不受雇用']
            out.append(f"| {esc(name)} | {esc(who + ('・' + '、'.join(extra) if extra else ''))} | {esc('；'.join(places))} | {esc(later) or '—'} | {esc('、'.join(lines_of.get(n['id'], []))) or '—'} |")
        out.append('')
    return '\n'.join(out)


# ---- 地標 ----

def quest_of_flag(f):
    """旗標 → 設定它的特殊任務名稱（找不到時是旗標本身）"""
    ps = sorted(F.producers.get(f, []))
    return '／'.join(f"「{F.TITLE[p]}」" for p in ps) or f


def landmarks_page():
    out = ['# 城鎮的特色地標', '', HEAD, '各城鎮的地標：開放條件、可以做的事。成人向的地標標 🔞（只在開啟成人向時出現）。', '']
    by_loc = collections.defaultdict(list)
    for l in LMS: by_loc[l['location']].append(l)
    for lid, ls in by_loc.items():
        out.append(f"## {loc(lid)}")
        out.append('')
        for l in ls:
            o = l.get('open') or {}
            out.append(f"### {l.get('emoji', '')} {l['name']}" + (' 🔞' if o.get('adult') else ''))
            out.append('')
            out.append(l['desc'])
            out.append('')
            cond = []
            if o.get('official'): cond.append('官方機構')
            if o.get('hours'): cond.append({'day': '白天開放', 'night': '晚上開放'}.get(o['hours'], str(o['hours'])))
            if o.get('min_reputation'): cond.append(f"所屬勢力聲望 ≥ {o['min_reputation']}（皇族不看聲望）")
            if o.get('flags'): cond.append(('完成相關任務後才出現：' if o.get('hidden') else '要先完成：') + '、'.join(quest_of_flag(f) for f in o['flags']))
            if cond: out.append('- **開放**：' + '；'.join(cond))
            if l.get('visit'): out.append(f"- **參訪**：{l['visit']['title']}" + (f"（{l['visit']['money_cc']} 白鸛）" if l['visit'].get('money_cc') else '') + (f" → {fx_text(gfx(l['visit']))}" if l['visit'].get('effects') else ''))
            if l.get('explore'):
                e = l['explore']
                out.append(f"- **探索**：{e['title']}（{F.ATTR.get(e['attr'], e['attr'])} DC {e['dc']}，{e.get('hours', 1)} 小時）" + (f" → {fx_text(gfx(e))}" if gfx(e) else ''))
            if l.get('work'):
                w = l['work']
                out.append(f"- **工作**：{w['desc']}（{F.ATTR.get(w['attr'], w['attr'])} DC {w['dc']}，時薪 {w['rate_cc']} 白鸛）")
            if l.get('interior'): out.append('- 有內部地圖可以進去')
            out.append('')
    return '\n'.join(out)


# ---- 總覽 ----

def index_page(pages):
    out = ['# 遊戲攻略', '', HEAD,
           '內建世界「艾隆迪亞」的內容整理：特殊任務怎麼接、怎麼走，事件在哪裡觸發，物品從哪裡拿，NPC 在哪裡。'
           '用自訂世界或世界包遊玩時，內容可能不同。', '',
           '| 頁面 | 內容 |', '|---|---|']
    for slug, title, desc in pages: out.append(f'| [{title}]({slug}.md) | {desc} |')
    out.append('')
    return '\n'.join(out)


def build():
    src = item_sources()
    pages = []
    files = {}
    for slug, cat, adult, intro in CATS:
        if not any(l['cat'] == cat for l in F.out): continue
        files[slug] = quests_page(slug, cat, adult, intro)
        n = sum(len(l['quests']) for l in F.out if l['cat'] == cat)
        pages.append((slug, f'特殊任務：{cat}', f'{intro}（{n} 個任務）'))
    files['events'] = events_page(); pages.append(('events', '旅途與城鎮事件', '旅途上與城鎮設施裡會遇到的事件'))
    files['events-adult'] = adult_events_page(); pages.append(('events-adult', '成人向事件', '地下城、寄生物、城鎮的成人向事件'))
    files['items'] = items_page(src); pages.append(('items', '物品的取得方式', '消耗品、卷軸、食物、材料、家具……從哪裡拿'))
    files['equipment'] = equipment_page(src); pages.append(('equipment', '裝備的取得方式', '獨特裝備與一般裝備從哪裡拿'))
    files['npcs'] = npcs_page(); pages.append(('npcs', '固定 NPC 在哪裡', '平常出沒的地方與相關任務線'))
    files['landmarks'] = landmarks_page(); pages.append(('landmarks', '城鎮的特色地標', '開放條件、參訪、探索與工作'))
    files['README'] = index_page(pages)
    return {k: v.rstrip('\n') + '\n' for k, v in files.items()}


if __name__ == '__main__':
    files = build()
    if '--check' in sys.argv:
        stale = [k for k, v in files.items() if not (OUT / f'{k}.md').exists() or (OUT / f'{k}.md').read_text() != v]
        extra = [p.stem for p in OUT.glob('*.md') if p.stem not in files] if OUT.exists() else []
        if stale or extra:
            print('docs/guide/ 不是最新的，請執行 python3 worldgen/tools/guide/guide.py：' + '、'.join(stale + extra))
            sys.exit(1)
        print('docs/guide/ 是最新的')
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for p in OUT.glob('*.md'):
            if p.stem not in files: p.unlink()
        for k, v in files.items(): (OUT / f'{k}.md').write_text(v)
        print(f'產生 {len(files)} 頁到 docs/guide/：' + '、'.join(f'{k}（{len(v) // 1024} KB）' for k, v in files.items()))
