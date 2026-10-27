"""巨龍不可名狀（2026-10）：巨龍從頭到尾不和凡人溝通，只有現象。
改 data/rules/enemies.json 的投影與守衛描述（原本由 story_enemies.py、mkboss23.py 寫入，那兩支已經同步改好），
並在世界書「高維巨龍」條目補上不可溝通的原則與塔、詭秘、歷史三條龍的動機。
可以重跑：已經改過的不會再改。"""
import json

ENEMIES = [
    ('只有一團會說謎語的霧，霧裡有慢半拍的倒影。',
     '只有一團霧，霧裡浮著人們想像中的深海：沉船、看不見底的海溝、叫你名字的聲音，和慢半拍的倒影。'),
    ('從海靈祠的鏡子裡走出來的你，用你的聲音要你證明自己是真的。',
     '從海靈祠的鏡子裡走出來的你，濕淋淋的，帶著海底的寒氣，一舉一動都慢半拍。'),
    ('身披霧色鱗甲，說話像夢話。', '身披霧色鱗甲，沒有臉，也從不出聲。'),
    ('燒得發白，聲音像沸騰的岩漿。', '燒得發白，靠近時只聽得見岩漿沸騰的聲音。'),
]

WB_NOTE = ("  不可沟通: '巨龙从头到尾不与凡人沟通：不说话、不回答、不认得任何人，也不会察觉凡人的存在。凡人能做的只有改变自己身边的现象，"
           "再看巨龙跟着起什么变化——那变化是否与凡人有关，谁也说不准。叙述时不要让巨龙开口、点头、微笑或“认出”谁；"
           "凡人对巨龙动机的说法，都只是祭文、传说与旁人的推测。'\n"
           "  已知的推测:\n"
           "  - 塔之龙: '只在荒野建塔，单纯是因为那里高的东西少；四周有了别的高东西，塔就不再长。'\n"
           "  - 诡秘之龙: '痴迷的不是海本身，而是凡人看着海与深海时心里那份神秘的印象；沿海的怪事都是凡人对海底的想象，被原样摆回岸上。'\n"
           "  - 历史之龙: '感觉到历史的转折点，于是睁开眼睛看了一眼——这一眼掀起了龙灾。凡人做的事对祂而言只是被亮光闪了一下，于是暂时闭上眼睛，直到下一个转折点。'\n")

if __name__ == '__main__':
    P = 'data/rules/enemies.json'
    s = open(P, encoding='utf-8').read()
    for old, new in ENEMIES:
        if new in s: continue
        assert s.count(old) == 1, old
        s = s.replace(old, new)
    json.loads(s)
    open(P, 'w', encoding='utf-8').write(s)

    W = 'data/worldbook/elondia.worldbook.json'
    raw = open(W, encoding='utf-8').read()
    w = json.loads(raw)
    hit = [e for e in (w['entries'].values() if isinstance(w['entries'], dict) else w['entries']) if '高维巨龙' in e.get('content', '')]
    assert len(hit) == 1
    e = hit[0]
    if '不可沟通' not in e['content']:
        # 加在條目的最後（觀者之龍那一段之後）
        enc = lambda t: json.dumps(t, ensure_ascii=False)[1:-1]
        tail = "象征着无所不知的监视与被审视的恐惧。'"
        assert e['content'].rstrip().endswith(tail) and raw.count(enc(tail)) == 1
        raw = raw.replace(enc(tail), enc(tail + '\n' + WB_NOTE.rstrip('\n')))
        json.loads(raw)
        open(W, 'w', encoding='utf-8').write(raw)
    print('dragon text ok')
