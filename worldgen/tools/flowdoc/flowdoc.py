# 「艾隆迪亞任務線走向」：把特殊任務（stories.json）、地下城事件與寄生物的發作整理成一頁可以翻閱的 HTML。
# 用法（在 repo 根目錄）：python3 worldgen/tools/flowdoc/flowdoc.py
# 輸出：worldgen/design/ElondiaQuestFlows.html（template.html 的 __DATA__ 換成整理好的資料）
# 內建內容（stories.json、travel_events.json……）改過之後重跑一次。
import json, re, collections, pathlib
HERE = pathlib.Path(__file__).resolve().parent
R = str(HERE.parents[2]) + '/'
OUT = HERE.parents[1] / 'design' / 'ElondiaQuestFlows.html'
ld = lambda p: json.load(open(R + p))
S = ld('data/rules/stories.json')['stories']
NPC = {n['id']: n['name'] for n in ld('data/world/npcs.json')['npcs']}
geo = ld('data/world/geography.json')
LOC = {l['id']: l['name'] for l in geo['locations']}
FAC = {f['id']: f['name'] for f in geo['factions']}
regionName = {r['id']: r['name'] for r in geo['regions']}
LM = {l['id']: l['name'] for l in ld('data/world/landmarks.json')['landmarks']}
SM = {k: v for k, v in ld('data/world/special_maps.json')['maps'].items()}
EN = {e['id']: e for e in ld('data/rules/enemies.json')['enemies']}
ATTR = {a['id']: a['name'] for a in ld('data/rules/attributes.json')['attributes']}
PERK = {p['id']: p['name'] for p in ld('data/rules/perks.json')['perks']}
CNT = {k: v['name'] for k, v in ld('data/rules/counters.json')['counters'].items()}
PARN = {k: v['name'] for k, v in ld('data/rules/parasites.json')['parasites'].items()}
COND = {k: v['name'] for k, v in ld('data/rules/companions.json')['conditions'].items() if isinstance(v, dict)}
CELL = {'inn': '旅店', 'guild': '冒險者公會', 'tavern': '酒館', 'shop': '雜貨店', 'temple': '神殿', 'gate': '城門', 'brothel': '娼館',
        'smithy': '鐵匠鋪', 'tailor': '裁縫店', 'jeweler': '珠寶店', 'magic': '魔法物品店', 'informant': '情報商'}
LAYER = {'outskirts': '周邊', 'shallow': '淺層', 'middle': '中層', 'deep': '深層', 'abyss': '底層'}
KIND = {'combat': '戰鬥', 'check': '判定', 'choice': '選擇', 'story': '劇情'}
TAG = {'adult': '成人向', 'ntr': 'NTR', 'non_virgin': '非處女', 'pc_unwilling': '主角非自願', 'male_partner': '男性對象'}
npc = lambda i: NPC.get(i, i)
loc = lambda i: LOC.get(i, i)
signed = lambda n: ('+' if n > 0 else '') + str(n)


def outs(n):
    """一個任務點的所有結果：(標籤, 結果, 選項)"""
    r = []
    if n.get('success'): r.append(('成功' if n['kind'] in ('combat', 'check') else '接著', n['success'], None))
    if n.get('fail'): r.append(('失敗', n['fail'], None))
    for o in n.get('options', []):
        r.append((o['label'], o['success'], o))
        if o.get('fail'): r.append((o['label'] + '（失敗）', o['fail'], o))
    return r


# 旗標 → 設定它的任務（跨任務的前後關係）
producers = collections.defaultdict(set)
for st in S:
    for f in st.get('start_flags', []): producers[f].add(st['id'])
    for n in st['nodes']:
        for _, o, _ in outs(n):
            for f in o.get('set_flags', []): producers[f].add(st['id'])
TITLE = {st['id']: st['title'] for st in S}


def where(at):
    w = at.get('where')
    if w == 'cell':
        c = at.get('cell', '')
        return f"{loc(at.get('location'))}・{LM.get(c) or CELL.get(c, c)}"
    if w == 'npc': return f"找{npc(at.get('npc'))}"
    if w == 'outskirts': return f"{loc(at.get('location'))}近郊"
    if w == 'dungeon': return f"{loc(at.get('location'))}・{LAYER.get(at.get('layer'), at.get('layer'))}"
    if w == 'side': return '側地圖'
    if w == 'road': return '旅途上'
    if w == 'special':
        m = SM.get(at.get('special_map'), {})
        return f"{loc(m.get('location'))}・{m.get('name', '特殊地圖')}" if m else '特殊地圖'
    return w or ''


def cond(req, st, local):
    """條件 → 可讀的字串清單；local 是旗標 → 同任務裡設定它的任務點標題"""
    out = []
    if not req: return out
    def fname(f):
        if f in local: return '「' + '／'.join(sorted(local[f])) + '」之後'
        ps = [p for p in producers.get(f, []) if p != st['id']]
        if ps: return '／'.join('「%s」' % TITLE[p] for p in sorted(ps)) + f'（{f}）'
        return f
    for f in req.get('flags', []): out.append(('after', '／'.join(sorted(local[f]))) if f in local else ('need', fname(f)))
    if req.get('flags_any'): out.append(('any', '任一：' + '、'.join(fname(f) for f in req['flags_any'])))
    for f in req.get('flags_none', []): out.append(('none', '沒有：' + fname(f)))
    for k, v in (req.get('counters') or {}).items():
        rng = []
        if 'min' in v: rng.append(f"≥ {v['min']}")
        if 'max' in v: rng.append(f"≤ {v['max']}")
        out.append(('counter', f"{CNT.get(k, k)} {' 且 '.join(rng)}"))
    for k, v in (req.get('affinity') or {}).items(): out.append(('aff', f"{npc(k)}好感 ≥ {v}"))
    for k, v in (req.get('parasites') or {}).items():
        rng = [f"侵蝕度 ≥ {v['min']}"] if 'min' in v else []
        if 'max' in v: rng.append(f"侵蝕度 ≤ {v['max']}")
        if 'tamed' in v: rng.append('已馴服' if v['tamed'] else '還沒馴服')
        out.append(('need', f"身上有{PARN.get(k, k)}" + (f"（{'、'.join(rng)}）" if rng else '')))
    return out


def effects(o):
    e = []
    for x in o.get('effects', []):
        t = x['type']
        if t == 'affinity': e.append(('aff', f"{npc(x['npc'])} 好感 {signed(x['delta'])}"))
        elif t == 'hp': e.append(('bad', f"生命 {signed(int(round(x['ratio'] * 100)))}%"))
        elif t == 'reputation': e.append(('rep', f"{FAC.get(x['faction'], x['faction'])} 聲望 {signed(x['delta'])}"))
        elif t == 'money': e.append(('item', f"{signed(x['amount'])} 白鸛"))
        elif t == 'item': e.append(('item', f"{x['name']}×{x.get('qty', 1)}"))
        elif t == 'perk': e.append(('perk', '特質：' + '／'.join(PERK.get(p, p) for p in [x['perk']] + x.get('options', []))))
        elif t == 'condition': e.append(('perk', f"{'得到' if x.get('add', True) else '移除'}狀態：{COND.get(x['condition'], x['condition'])}"))
        elif t == 'companion': e.append(('join', f"{npc(x['npc'])} 成為同伴"))
        elif t == 'parasite': e.append(('bad' if x['op'] == 'add' else 'perk', f"{ {'add': '寄生', 'tame': '馴服', 'remove': '拿掉'}[x['op']]}：{PARN.get(x['parasite'], x['parasite'])}"))
        elif t == 'corruption': e.append(('counter', f"{PARN.get(x['parasite'], x['parasite'])}的侵蝕度 {signed(x['delta'])}"))
    for k, v in (o.get('counters') or {}).items(): e.append(('counter', f"{CNT.get(k, k)} {signed(v)}"))
    if o.get('join'): e.append(('join', f"{npc(o['join'])} 加入隊伍"))
    if o.get('leave'): e.append(('leave', f"{npc(o['leave'])} 離開隊伍"))
    for d in o.get('deaths', []): e.append(('bad', f"{npc(d)} 死亡"))
    if o.get('travel_to'): e.append(('move', f"移動到{loc(o['travel_to'])}"))
    if o.get('side_map'): e.append(('move', '進入側地圖'))
    if o.get('special_map'): e.append(('move', f"進入{SM.get(o['special_map'], {}).get('name', '特殊地圖')}"))
    return e


def quest(st):
    local = collections.defaultdict(set)
    for n in st['nodes']:
        for _, o, _ in outs(n):
            for f in o.get('set_flags', []): local[f].add(n['title'])
    for f in st.get('start_flags', []): local[f].add('接下任務')
    # 旗標 → 需要它的任務點 / 任務
    needs = collections.defaultdict(list)
    for n in st['nodes']:
        r = n.get('requires') or {}
        for f in r.get('flags', []) + r.get('flags_any', []): needs[f].append(n['title'])
    unl = collections.defaultdict(list)
    for o2 in S:
        r = o2['start'].get('requires') or {}
        for f in r.get('flags', []) + r.get('flags_any', []):
            if o2['id'] != st['id']: unl[f].append(o2['title'])
    nodes = []
    for n in st['nodes']:
        info = []
        if n['kind'] == 'combat':
            info.append(('foes', '、'.join(f"{EN[e]['name']}×{k}" + ('（頭目）' if EN[e].get('ability_hp_below') else '') for e, k in n.get('enemies', [])) + (f"；同行：{'、'.join(npc(a) for a in n['allies'])}" if n.get('allies') else '')))
        if n.get('check'):
            c = n['check']
            info.append(('check', f"{ATTR.get(c.get('attr'), c.get('attr'))} DC {c.get('dc')}" + (f"（參考{npc(c['affinity'])}的好感）" if c.get('affinity') else '')))
        branches = []
        for label, o, opt in outs(n):
            nxt, unlock = [], []
            for f in o.get('set_flags', []):
                nxt += [t for t in needs.get(f, []) if t != n['title']]
                unlock += unl.get(f, [])
            b = {'label': label, 'text': o.get('text', ''), 'fx': effects(o),
                 'next': list(dict.fromkeys(nxt)), 'unlock': list(dict.fromkeys(unlock)),
                 'done': bool(o.get('complete')), 'retry': bool(o.get('retry')),
                 'flags': o.get('set_flags', []), 'fail': label.endswith('失敗）') or label == '失敗'}
            if opt:
                b['req'] = cond(opt.get('requires'), st, local)
                if opt.get('check') and not label.endswith('（失敗）'):
                    c = opt['check']; b['check'] = f"{ATTR.get(c.get('attr'), c.get('attr'))} DC {c.get('dc')}"
                if opt.get('tags'): b['tags'] = [TAG.get(t, t) for t in opt['tags']]
            # 寫了親密場景的結果（StoryOutcome.scene）：敘事依成人場景規則詳細描寫
            if o.get('scene'): b['tags'] = [*b.get('tags', []), '親密場景']
            branches.append(b)
        nodes.append({'title': n['title'], 'kind': KIND.get(n['kind'], n['kind']), 'where': where(n['at']), 'text': n['text'],
                      'req': cond(n.get('requires'), st, local), 'info': info, 'urgent': bool(n.get('urgent')), 'branches': branches})
    s0 = st['start']
    who = {'npc': f"{npc(s0.get('npc'))}的委託", 'guild': f"冒險者公會（{loc(s0.get('location'))}）" if s0.get('location') else '冒險者公會',
           'informant': '情報商', 'travel': '旅途上'}.get(s0['kind'], s0['kind'])
    sreq = []
    if s0.get('min_level'): sreq.append(f"Lv.{s0['min_level']}")
    if s0.get('min_affinity'): sreq.append(f"好感 {s0['min_affinity']}")
    if s0.get('price'): sreq.append(f"情報費 {s0['price']} 白鸛")
    if s0.get('chance'): sreq.append(f"機率 {int(s0['chance'] * 100)}%")
    if s0.get('regions'): sreq.append('地區：' + '、'.join(s0['regions']))
    rew = []
    for x in st.get('rewards', []):
        if x['type'] == 'xp': rew.append(f"經驗 {x['amount']}")
        elif x['type'] == 'money': rew.append(f"{x['amount']} 白鸛")
        elif x['type'] == 'item': rew.append(f"{x['name']}×{x.get('qty', 1)}")
        else: rew.append(str(x.get('type')))
    if st.get('merit'): rew.append(f"功績 {st['merit']}")
    return {'id': st['id'], 'title': st['title'], 'summary': re.sub(r'（[^（）]*）\s*$', '', st['summary']), 'rank': st['rank'],
            'level': s0.get('min_level'), 'tags': [TAG.get(t, t) for t in st.get('tags', [])], 'who': who, 'startText': s0.get('text', ''),
            'startReq': sreq, 'prereq': cond(s0.get('requires'), st, {}), 'rewards': rew, 'nodes': nodes}


# 依簡介最後的「（某某・一）」分成任務線
lines = collections.OrderedDict()
for st in S:
    m = re.search(r'（([^（）]*)）\s*$', st['summary'])
    name = re.sub(r'・[一二三四五六七八九十終序].*$', '', m.group(1)) if m else '入門委託'
    if name.startswith('巨龍史詩'): name = '巨龍史詩'
    if name.startswith('史詩：'): name = '政治史詩'
    lines.setdefault(name, []).append(st)


# 打工的任務線（story_batch26.py）
WORK_LINES = {'銀鱗旅店的看板娘', '怪人魔導師的研究', '黃金骰子的兔女郎', '舞孃的夜間表演', '伯爵府的見習女僕'}


def category(name, sts):
    if name in ('政治史詩', '巨龍史詩'): return '史詩'
    if name == '多人特殊任務': return '多人特殊任務'
    if name == '入門委託': return '入門委託'
    if name == '沿海洞窟': return '地下城'
    if name in WORK_LINES: return '打工線（成人向）'
    nn = [n for s in sts for n in s['nodes']]
    if name in LOC.values() or sum(n['at'].get('where') == 'dungeon' for n in nn) * 2 >= len(nn): return '地下城'
    short = {v.split('・')[0].split('「')[-1].split('」')[-1] for v in NPC.values()}
    # 成人向的線：一半以上的任務是成人向（非成人向的角色線後來加的「四」不算）
    adult = sum('adult' in s.get('tags', []) for s in sts) * 2 > len(sts)
    if any(len(x) >= 2 and x in name for x in short): return '角色線（成人向）' if adult else '角色線'
    if adult: return '角色線（成人向）'
    # 大部分任務由同一個人開頭（後來加的「四」或裝備任務換了委託人也算）
    top = collections.Counter(s['start'].get('npc') for s in sts).most_common(1)[0]
    if top[0] and top[1] / len(sts) >= 0.75 and sts[0]['start']['kind'] == 'npc': return '角色線'
    return '地區與勢力'


ORDER = ['入門委託', '地區與勢力', '地下城', '角色線', '角色線（成人向）', '打工線（成人向）', '多人特殊任務', '史詩']
out = []
for name, sts in lines.items():
    sts = sorted(sts, key=lambda s: (s['start'].get('min_level') or 0))
    if name == '政治史詩':
        pref = ['pol_storm_eve', 'pol_peace_iron_cross', 'pol_peace_bloodhorn', 'pol_peace_crusade', 'pol_war_h_rivervale', 'pol_war_h_ashport', 'pol_war_h_bloodplume', 'pol_war_d_ashport', 'pol_war_d_rivervale', 'pol_war_d_rhineburg', 'pol_acheron_gaze']
        sts = sorted(sts, key=lambda s: pref.index(s['id']) if s['id'] in pref else 99)
    cat = category(name, sts)
    lv = [s['start'].get('min_level') or 1 for s in sts]
    out.append({'name': name, 'cat': cat, 'lv': f"Lv.{min(lv)}～{max(lv)}" if min(lv) != max(lv) else f"Lv.{lv[0]}",
                'npc': npc(sts[0]['start'].get('npc')) if sts[0]['start']['kind'] == 'npc' else '', 'quests': [quest(s) for s in sts]})
out.sort(key=lambda l: (ORDER.index(l['cat']), int(re.search(r'\d+', l['lv']).group())))
FLOW = {
    '政治史詩': [('序章', ['pol_storm_eve']), ('路線：清剿主戰派', ['pol_peace_iron_cross', 'pol_peace_bloodhorn', 'pol_peace_crusade']),
             ('路線：開戰・人類方', ['pol_war_h_rivervale', 'pol_war_h_ashport', 'pol_war_h_bloodplume']),
             ('路線：開戰・魔族方', ['pol_war_d_ashport', 'pol_war_d_rivervale', 'pol_war_d_rhineburg']),
             ('軍需（Lv.16 起；和平線兩個都能接，開戰只能接自己這一方的）', ['gear_church_supply', 'gear_redwing_supply']), ('終章', ['pol_acheron_gaze'])],
    '巨龍史詩': [('四條龍，順序自由', ['drg_kagni', 'drg_sinor', 'drg_sorian', 'drg_babelin']), ('終章', ['drg_acheron'])],
}
for l in out:
    if l['name'] in FLOW: l['flow'] = [{'label': lb, 'ids': ids, 'seq': not lb.startswith(('四條龍', '軍需'))} for lb, ids in FLOW[l['name']]]
    elif l['name'] in ('多人特殊任務', '入門委託'): l['flow'] = [{'label': '各自獨立', 'ids': [q['id'] for q in l['quests']], 'seq': False}]

# 事件的 DC：選項寫的 DC 以 14 為「普通」，實際 DC 依層（地下城事件）或主角等級與階段（寄生物）調整
def difficulty(dc):
    d = dc - 14
    return '普通' if d == 0 else f"{'容易' if d < 0 else '困難'} {'+' if d > 0 else '−'}{abs(d)}"


def dungeon_dc(c, t):
    table = TE.get('dungeon', {}).get('dc') or [11, 13, 14, 16, 18]
    dcs = sorted({table[i] + c['dc'] - 14 for i in (t.get('layers') or range(len(table)))})
    rng = f"{dcs[0]}" if len(dcs) == 1 else f"{dcs[0]}～{dcs[-1]}"
    return f"{ATTR.get(c['attr'], c['attr'])} {difficulty(c['dc'])}（DC {rng}，依層）"


def parasite_dc(c):
    r = PAR.get('dc') or {'base': 12, 'per_level': 0.4}
    lo, hi = r['base'] + round(1 * r['per_level']), r['base'] + round(20 * r['per_level']) + max(r.get('stages', [0]))
    return f"{ATTR.get(c['attr'], c['attr'])} {difficulty(c['dc'])}（DC 約 {lo + c['dc'] - 14}～{hi + c['dc'] - 14}，依主角等級與階段）"


# 地下城的色情事件（travel_events.json 的 scope: dungeon）：每個觸發點一條「線」，每個事件當成只有一個任務點的任務
TE = ld('data/rules/travel_events.json')
DTRIG = {'trap': '觸發陷阱（沒察覺時）', 'chest': '打開寶箱', 'gather': '採集之後', 'rest': '安全房長休之後'}
DLAYER = ['周邊與近郊', '淺層', '中層', '深層', '底層']
BODYN = {'fem': '女性形象', 'andro': '中性', 'masc': '男性形象'}
SCENE = {'always': '進入親密場景', 'success': '成功時進入親密場景', 'fail': '失敗時進入親密場景'}
for trig, tname in DTRIG.items():
    evs = [t for t in TE['templates'] if t.get('scope') == 'dungeon' and trig in t.get('triggers', [])]
    if not evs: continue
    qs = []
    for t in evs:
        where_ = '、'.join(loc(d) for d in t.get('dungeons', [])) or ('、'.join(regionName.get(r, r) for r in t.get('regions', [])) or '任何地下城與近郊')
        layers = '、'.join(DLAYER[i] for i in t.get('layers', [])) or '任何一層'
        branches = []
        for o in t.get('options', []):
            for ok, res in [(True, o.get('success')), (False, o.get('fail'))]:
                if not res: continue
                label = o['label'] if ok or not o.get('check') else o['label'] + '（失敗）'
                scene = o.get('adult_scene')
                tags = ['親密場景'] if scene and (scene == 'always' or scene == ('success' if ok else 'fail')) else []
                b = {'label': label, 'text': res.get('text', ''), 'fx': effects(res), 'next': [], 'unlock': [], 'done': False, 'retry': False,
                     'flags': res.get('set_flags', []), 'fail': not ok, 'tags': tags}
                if o.get('check') and ok:
                    b['check'] = dungeon_dc(o['check'], t)
                branches.append(b)
        qs.append({'id': t['id'], 'title': t['title'], 'summary': t.get('scene', ''), 'rank': '—', 'level': None,
                   'tags': [TAG.get(x, x) for x in t.get('tags', [])], 'who': f"{tname}・{where_}・{layers}", 'startText': '',
                   'startReq': ['只給：' + '、'.join(BODYN[b] for b in t.get('pc_body', []))] if t.get('pc_body') else [], 'prereq': [], 'rewards': [],
                   'nodes': [{'title': t['title'], 'kind': '選擇', 'where': f"{where_}（{layers}）", 'text': t['text'], 'req': [], 'info': [], 'urgent': False, 'branches': branches}]})
    out.append({'name': f"地下城事件：{tname.split('（')[0]}", 'cat': '地下城事件（成人向）', 'lv': '—', 'npc': '', 'quests': qs,
                'flow': [{'label': '各自獨立（依機率發生，回應之前不能移動）', 'ids': [q['id'] for q in qs], 'seq': False}]})
# 寄生物的發作（scope: parasite）：每種寄生物一條「線」
PAR = ld('data/rules/parasites.json')
MOMENT = {'step': '走動', 'travel': '旅途', 'rest': '長休之後'}
for pid, pdef in PAR['parasites'].items():
    evs = [t for t in TE['templates'] if t.get('scope') == 'parasite' and t.get('parasite') == pid]
    if not evs: continue
    qs = []
    for t in evs:
        stages = '、'.join(PAR['stages'][i]['name'] for i in t.get('stages', [])) or '任何階段'
        moments = '、'.join(MOMENT[m] for m in t.get('moments', [])) or '走動、旅途、長休之後'
        branches = []
        for o in t.get('options', []):
            for ok, res in [(True, o.get('success')), (False, o.get('fail'))]:
                if not res: continue
                label = o['label'] if ok or not o.get('check') else o['label'] + '（失敗）'
                scene = o.get('adult_scene')
                tags = ['親密場景'] if scene and (scene == 'always' or scene == ('success' if ok else 'fail')) else []
                b = {'label': label, 'text': res.get('text', ''), 'fx': effects(res), 'next': [], 'unlock': [], 'done': False, 'retry': False,
                     'flags': res.get('set_flags', []), 'fail': not ok, 'tags': tags}
                if o.get('check') and ok:
                    b['check'] = parasite_dc(o['check'])
                branches.append(b)
        qs.append({'id': t['id'], 'title': t['title'], 'summary': t.get('scene', ''), 'rank': '—', 'level': None,
                   'tags': [TAG.get(x, x) for x in t.get('tags', [])], 'who': f"{pdef['name']}・{stages}・{moments}", 'startText': '',
                   'startReq': [], 'prereq': [], 'rewards': [],
                   'nodes': [{'title': t['title'], 'kind': '選擇', 'where': f"身上有{pdef['name']}（{stages}）", 'text': t['text'], 'req': [], 'info': [], 'urgent': False, 'branches': branches}]})
    out.append({'name': f"寄生物的發作：{pdef['name']}", 'cat': '地下城事件（成人向）', 'lv': '—', 'npc': '', 'quests': qs,
                'flow': [{'label': '各自獨立（依侵蝕度的階段與機率發作，回應之前不能移動）', 'ids': [q['id'] for q in qs], 'seq': False}]})
for i, l in enumerate(out): l['key'] = f"L{i + 1}"
data = json.dumps(out, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
tpl = (HERE / 'template.html').read_text()
assert tpl.count('__DATA__') == 1
OUT.write_text(tpl.replace('__DATA__', data))
print(len(out), 'lines', sum(len(l['quests']) for l in out), 'quests', collections.Counter(l['cat'] for l in out))
