"""炎華之地 P7：炎華北原的物品（EAST_CONTENT_PLAN 11.6 節）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p7_items.py（可以重跑）
- 食物、特產、消耗品 9 件：只在炎華北原的店裡賣（items 的 regions）
- 底材「角弓」（gear.json、equipment.json）與每種木材的制式品（只在炎華之地賣）
（狼皮在西大陸就有了；人馬族的底材在 east_p6_gear.py；獨特裝備跟著北原的地下城線在 P8 做）
"""

from east_p5_items import EAST, insert_lines, it
from east_p6_gear import write_catalog as _write_catalog
import east_p6_gear

NORTH = ['yanhua_north']
ITEMS = [
    it('馬奶酒', 'food', 5, ['tavern', 'general'], '皮囊裡發酵過的馬奶，酸酸的、微微冒泡；草原的規矩，進帳先乾一碗。', use={'condition': 'cheered'}, regions=NORTH),
    it('奶豆腐', 'food', 3, ['general', 'tavern'], '曬乾的奶塊，硬得要含在嘴裡慢慢化開；牧民放牧時帶在身上。', use={'condition': 'fed_light'}, regions=NORTH),
    it('手把肉', 'food', 12, ['tavern'], '白水煮的整塊羊肉，抓在手裡用刀削著吃，蘸一點鹽就好。', use={'condition': 'fed_well'}, regions=NORTH),
    it('風乾肉', 'food', 6, ['general'], '草原上風乾的牛肉條，比乾糧耐放，一條能嚼上半天。', use={'condition': 'fed_light'}, regions=NORTH),
    it('北珠', 'gear', 220, ['jeweler'], '海東部從鷹河上游的冰河裡採來的珍珠，又大又圓，泛著淡淡的青光；年年要進貢給天可汗。送禮最體面。', regions=NORTH),
    it('海東青的羽', 'gear', 40, ['general'], '海東青換下來的尾羽，又白又硬；草原上的人拿來插在帽上，說能看得更遠。', regions=NORTH),
    it('馬頭琴', 'gear', 90, ['general'], '琴頭雕成馬頭的二弦琴，拉起來像風吹過草原；王庭的酒帳裡夜夜都有人拉。', regions=NORTH),
    it('鳴鏑', 'consumable', 160, ['general'], '箭頭開著哨孔的響箭，射出去會發出尖嘯；統一戰爭時用來號令衝鋒。所有敵人 1d4 穿刺傷害；信仰豁免 DC 12 失敗時恐懼 2 回合（成功傷害減半）。',
       use={'damage': {'dice': '1d4', 'type': 'piercing'}, 'apply': {'status': 'frightened', 'turns': 2, 'save': 'fai', 'dc': 12}, 'area': 'all', 'combat_only': True}, regions=NORTH),
]

BASES = {
    'horn_bow': {'slot': 'main_hand', 'name': '角弓', 'kind': 'wood', 'weapon': 'horn_bow', 'two_handed': True, 'price': 360, 'stats': {'crit': 1},
                 'scale': {'damage': 'full', 'hit': 'half'}, 'desc': '用牛角、木胎與筋膠疊成的反曲短弓，人馬族在馬背……在自己背上也拉得開；比長弓短，力道卻不輸。'},
}
WEAPONS = {'horn_bow': {'name': '角弓', 'dice': '1d8', 'type': 'piercing', 'attr': 'dex', 'threat': -0.1}}


def catalog():
    # 借 east_p6_gear 的制式品寫法（材料、價格、名稱、地區都一樣）
    east_p6_gear.BASES = BASES
    return [r for b in BASES for r in east_p6_gear.catalog(b)]


if __name__ == '__main__':
    insert_lines('data/rules/gear.json', 'podao', BASES)
    insert_lines('data/rules/equipment.json', 'podao', WEAPONS)
    rows = catalog()
    for r in rows:
        if r.get('regions'):
            r['regions'] = EAST
    _write_catalog(rows)
    from east_story_io import write_items
    write_items(ITEMS)
