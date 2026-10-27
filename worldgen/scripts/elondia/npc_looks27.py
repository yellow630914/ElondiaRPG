"""固定 NPC 的外貌細節（2026-10）：把 npc_looks27.json 的外貌寫進 data/world/npcs.json 的 appearance。
補上身高、身形、髮型髮色、眼睛、膚色、種族特徵、常穿的衣服與配件、神態，保留原本寫過的細節（上限 240 字）。
work26.py 會重寫打工線的委託人，所以要排在 work26.py 之後。可以重跑。"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

if __name__ == '__main__':
    looks = json.load(open(os.path.join(HERE, 'npc_looks27.json'), encoding='utf-8'))
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
    print('npc looks', len(seen))
