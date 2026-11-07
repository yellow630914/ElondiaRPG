"""東大陸（炎華之地）有角色線的固定 NPC 的外貌細節（2026-11）：把 npc_looks40.json 的外貌寫進 data/world/npcs.json 的 appearance。
補上身高、身形（人馬族寫連馬身站起來的高度）；玉璘族補上腰後的鱗尾（yulin_body32.py：雙腿加魚尾）。東大陸的 east_p*.py 會重寫這些人，所以要排在它們之後。可以重跑。"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

if __name__ == '__main__':
    looks = json.load(open(os.path.join(HERE, 'npc_looks40.json'), encoding='utf-8'))
    P = 'data/world/npcs.json'
    s = open(P, encoding='utf-8').read()
    data = json.loads(s)
    seen = set()
    for n in data['npcs']:
        a = looks.get(n['id'])
        if not a: continue
        assert len(a) <= 240, n['id']
        old = json.dumps(n['appearance'], ensure_ascii=False)
        if n['appearance'] != a:
            assert s.count(old) >= 1, n['id']
            # 只換這一位的那一行，保留檔案原本的排版
            s = s.replace(f'"appearance": {old}', f'"appearance": {json.dumps(a, ensure_ascii=False)}', 1)
        seen.add(n['id'])
    missing = set(looks) - seen
    assert not missing, missing
    data = json.loads(s)
    assert all(n['appearance'] == looks[n['id']] for n in data['npcs'] if n['id'] in looks)
    open(P, 'w', encoding='utf-8').write(s)
    print('east npc looks', len(seen))
