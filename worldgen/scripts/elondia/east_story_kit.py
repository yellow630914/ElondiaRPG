"""炎華之地的特殊任務：寫任務時常用的小工具（效果、地點、報酬、任務點）。"""

COURT, LEAGUE = 'yanye_court', 'jinmo_league'

# 報酬照內建的地區故事線（rivervale_*、port_*）
REWARD = {
    'E': [{'type': 'money', 'amount': 200}, {'type': 'xp', 'amount': 200}],
    'D': [{'type': 'money', 'amount': 300}, {'type': 'xp', 'amount': 450}],
    'C': [{'type': 'money', 'amount': 600}, {'type': 'xp', 'amount': 900}],
    'B': [{'type': 'money', 'amount': 1500}, {'type': 'xp', 'amount': 2000}],
    # 政治線（照內建的 pol_*、gear_* 的 A、S 級）
    'A': [{'type': 'money', 'amount': 2200}, {'type': 'xp', 'amount': 2500}],
    'S': [{'type': 'money', 'amount': 3500}, {'type': 'xp', 'amount': 4000}],
}
MERIT = {'E': 5, 'D': 8, 'C': 10, 'B': 15, 'A': 15, 'S': 25}
LEVEL = {'E': 3, 'D': 5, 'C': 8, 'B': 11, 'A': 12, 'S': 14}


def aff(npc, delta, reason):
    return {'type': 'affinity', 'npc': npc, 'delta': delta, 'reason': reason}


def mem(text, importance=2):
    return {'type': 'memory', 'summary': text, 'importance': importance}


def rep(faction, delta):
    return {'type': 'reputation', 'faction': faction, 'delta': delta}


def item(name, qty=1):
    return {'type': 'item', 'name': name, 'qty': qty}


def money(n):
    return {'type': 'money', 'amount': n}


def cell(loc, c):
    return {'where': 'cell', 'location': loc, 'cell': c}


def town(loc):
    return {'where': 'settlement', 'location': loc}


def out(loc):
    return {'where': 'outskirts', 'location': loc}


def dungeon(loc, layer):
    return {'where': 'dungeon', 'location': loc, 'layer': layer}


def at_npc(npc, loc=None):
    return {'where': 'npc', 'npc': npc, **({'location': loc} if loc else {})}


def story(id, rank, title, summary, start, start_flag, nodes, *, extra_rewards=(), tags=None, merit=None):
    s = {'id': id, 'title': title, 'summary': summary}
    if tags:
        s['tags'] = tags
    s['rank'] = rank
    m = MERIT[rank] if merit is None else merit
    if m != 5:
        s['merit'] = m
    start = dict(start)
    if 'min_level' not in start and rank in LEVEL and start.get('kind') != 'manual':
        start['min_level'] = LEVEL[rank]
    s['start'] = start
    s['start_flags'] = [start_flag]
    s['nodes'] = nodes
    s['rewards'] = REWARD[rank] + list(extra_rewards)
    return s


def node(id, title, text, at, requires, kind='story', **kw):
    n = {'id': id, 'title': title, 'text': text, 'at': at, 'requires': {'flags': [requires]} if isinstance(requires, str) else requires, 'kind': kind}
    n.update(kw)
    return n


def fight(id, title, text, at, requires, enemies, win, lose='你們被打退了。喘口氣，準備好再來。', *, win_flags=(), win_effects=(), **kw):
    """戰鬥：輸了可以再打（retry）"""
    w = {'text': win}
    if win_flags:
        w['set_flags'] = list(win_flags)
    if win_effects:
        w['effects'] = list(win_effects)
    return node(id, title, text, at, requires, 'combat', enemies=enemies, success=w, fail={'text': lose, 'retry': True}, **kw)


def check(id, title, text, at, requires, attr, dc, win, lose, *, win_flags=(), win_effects=(), **kw):
    """判定：失敗可以再試（retry）"""
    w = {'text': win}
    if win_flags:
        w['set_flags'] = list(win_flags)
    if win_effects:
        w['effects'] = list(win_effects)
    return node(id, title, text, at, requires, 'check', check={'attr': attr, 'dc': dc}, success=w, fail={'text': lose, 'retry': True}, **kw)


def ending(label, text, flags, *, reform=0, balance=0, effects=(), **kw):
    """故事線的結局選項：yh_reform（君 -1／民 +1）、yh_balance（衡 +1）"""
    s = {'text': text, 'set_flags': list(flags), 'complete': True}
    counters = {}
    if reform:
        counters['yh_reform'] = reform
    if balance:
        counters['yh_balance'] = balance
    if counters:
        s['counters'] = counters
    if effects:
        s['effects'] = list(effects)
    s.update(kw)
    return {'label': label, 'success': s}


# ---------------- 角色線（CHARACTER_LINES_PLAN 第 2 節的規格） ----------------
def romance(prefix, npc, line, q1, q2, q3, q4, *, start=None):
    """一條角色線：一～三 D／C／B（Lv.5／8／11，好感 0／20／30），四是成人向（好感 40、Lv.11）。
    q1～q3：{'id','title','summary','text','nodes'}，nodes 的最後一個要設 f'{prefix}_N_done'（三是 f'{prefix}_lover'）。
    q4：{'id','title','summary','text','date': (title, text, success), 'night': (title, text), 'options': [(label, scene, memory), ...]}。
    start：開頭的方式（預設對象本人；待在皇城裡的人用公會）。"""
    out = []
    for i, (q, rank, aff_min) in enumerate([(q1, 'D', 0), (q2, 'C', 20), (q3, 'B', 30)], 1):
        st = dict(start or {'kind': 'npc', 'npc': npc})
        st['text'] = q['text']
        if aff_min:
            if st['kind'] == 'npc':
                st['min_affinity'] = aff_min
            else:
                st.setdefault('requires', {})['affinity'] = {npc: aff_min}
        if i > 1:
            st.setdefault('requires', {})['flags'] = [f'{prefix}_{i - 1}_done']
        s = story(q['id'], rank, q['title'], q['summary'] + f'（{line}・{"一二三"[i - 1]}）', st, f'{prefix}_{i}_started', q['nodes'],
                  extra_rewards=q.get('rewards', ()))
        out.append(s)
    # 四：成人向
    st = dict(start or {'kind': 'npc', 'npc': npc})
    st['text'] = q4['text']
    if st['kind'] == 'npc':
        st['min_affinity'] = 40
    else:
        st.setdefault('requires', {})['affinity'] = {npc: 40}
    st.setdefault('requires', {})['flags_any'] = [f'{prefix}_lover']
    st['min_level'] = 11
    dt, dtext, dsucc = q4['date']
    nt, ntext = q4['night']
    at = q4.get('at') or {'where': 'npc', 'npc': npc}
    options = []
    for j, (label, scene, memory) in enumerate(q4['options']):
        o = {'text': scene, 'set_flags': [f'{prefix}_x_done'],
             'effects': [aff(npc, 15, '和你共度一夜'), mem(memory, 3)], 'complete': True, 'scene': scene}
        if j == 0:
            o['time'] = {'until': 'morning'}
        options.append({'label': label, 'success': o})
    nodes = [
        node('date', dt, dtext, q4.get('date_at') or at, f'{prefix}_x_start',
             success={'text': dsucc, 'set_flags': [f'{prefix}_x_date'], 'effects': [aff(npc, 5, '一起度過的時光')], **q4.get('date_extra', {})}),
        node('night', nt, ntext, at, f'{prefix}_x_date', 'choice', options=options),
    ]
    s4 = {'id': q4['id'], 'title': q4['title'], 'summary': q4['summary'] + f'（{line}・四）', 'tags': ['adult'] + q4.get('tags', []),
          'rank': 'B', 'merit': 5, 'start': st, 'start_flags': [f'{prefix}_x_start'], 'nodes': nodes, 'rewards': [{'type': 'xp', 'amount': 800}]}
    out.append(s4)
    return out


def confess(prefix, npc, title, text, at, requires, options, allies=None):
    """三的最後一步：告白。options：[(label, text, memory)]，都設 f'{prefix}_lover'"""
    opts = [{'label': l, 'success': {'text': t, 'set_flags': [f'{prefix}_lover', f'{prefix}_3_done'],
                                     'effects': [aff(npc, 15, '在一起了'), mem(m, 3)], 'complete': True}} for l, t, m in options]
    kw = {'allies': allies} if allies else {}
    return node('confess', title, text, at, requires, 'choice', options=opts, **kw)


def close(prefix, i, npc, title, text, at, requires, options, allies=None):
    """一、二的最後一步：選擇，都設 f'{prefix}_{i}_done' 並完成。options：[(label, text, affinity, memory)]"""
    opts = [{'label': l, 'success': {'text': t, 'set_flags': [f'{prefix}_{i}_done'],
                                     'effects': [aff(npc, a, '一起經歷了一段事')] + ([mem(m)] if m else []), 'complete': True}} for l, t, a, m in options]
    kw = {'allies': allies} if allies else {}
    return node('close', title, text, at, requires, 'choice', options=opts, **kw)


# ---------------- 成人向角色（EAST_CONTENT_PLAN 8.9 節） ----------------
def adult_line(prefix, npc, line, q1, q2, q3, *, tags=()):
    """一條成人向角色的線：三個任務 D／C／B（Lv.5／8／11，好感 0／20／30），整條標成人向（加上 tags，例如 non_virgin）。
    q：{'id','title','summary','text','nodes'}，可以有 'start'（預設對象本人開頭）、'rewards'。
    一、二的最後一步設 f'{prefix}_N_done'；三的最後一步設 f'{prefix}_lover'、f'{prefix}_3_done'（用 lover()）。"""
    out = []
    for i, (q, rank, aff_min) in enumerate([(q1, 'D', 0), (q2, 'C', 20), (q3, 'B', 30)], 1):
        st = dict(q.get('start') or {'kind': 'npc', 'npc': npc})
        st['requires'] = dict(st.get('requires', {}))
        st['text'] = q['text']
        if aff_min:
            if st['kind'] == 'npc' and st['npc'] == npc:
                st['min_affinity'] = aff_min
            else:
                st['requires']['affinity'] = {npc: aff_min}
        if i > 1:
            st['requires']['flags'] = st['requires'].get('flags', []) + [f'{prefix}_{i - 1}_done']
        if not st['requires']:
            del st['requires']
        out.append(story(q['id'], rank, q['title'], q['summary'] + f'（{line}・{"一二三"[i - 1]}）', st, f'{prefix}_{i}_started', q['nodes'],
                         extra_rewards=q.get('rewards', ()), tags=['adult', *tags]))
    return out


def lover(prefix, npc, title, text, at, requires, options, allies=None, **kw):
    """成人向角色線三的最後一步：options：[(label, text, memory, scene)]，都設 f'{prefix}_lover'、f'{prefix}_3_done'，第一個過夜到早上"""
    opts = []
    for j, (l, t, m, sc) in enumerate(options):
        o = {'text': t, 'set_flags': [f'{prefix}_lover', f'{prefix}_3_done'],
             'effects': [aff(npc, 15, '在一起了'), mem(m, 3)], 'complete': True, 'scene': sc}
        if j == 0:
            o['time'] = {'until': 'morning'}
        opts.append({'label': l, 'success': o})
    if allies:
        kw['allies'] = allies
    return node('lover', title, text, at, requires, 'choice', options=opts, **kw)
