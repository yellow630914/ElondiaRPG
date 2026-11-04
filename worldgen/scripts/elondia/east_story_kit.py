"""炎華之地的特殊任務：寫任務時常用的小工具（效果、地點、報酬、任務點）。"""

COURT, LEAGUE = 'yanye_court', 'jinmo_league'

# 報酬照內建的地區故事線（rivervale_*、port_*）
REWARD = {
    'E': [{'type': 'money', 'amount': 200}, {'type': 'xp', 'amount': 200}],
    'D': [{'type': 'money', 'amount': 300}, {'type': 'xp', 'amount': 450}],
    'C': [{'type': 'money', 'amount': 600}, {'type': 'xp', 'amount': 900}],
    'B': [{'type': 'money', 'amount': 1500}, {'type': 'xp', 'amount': 2000}],
}
MERIT = {'E': 5, 'D': 8, 'C': 10, 'B': 15}
LEVEL = {'E': 3, 'D': 5, 'C': 8, 'B': 11}


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
