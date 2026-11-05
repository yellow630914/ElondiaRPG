"""炎華北原：世界書的北原段落依「媞丹的走向」（east_p8c.py）與「南北交會」（east_p8d.py）的結局換掉。

寫進世界書條目的 extensions.elondia.variants（劇情變體，見 docs/PROMPTS.md「劇情變體」），寫法照 east_p4c_lore.py：
用「換掉幾段文字」（replace），第一個旗標全部符合的變體生效。所以兩段結局要排列組合：
- 先寫南北交會的組合（媞丹的走向＋下半的結局，11.11 節的表走得到的 8 種），再寫只有前期結局的 3 種。
- 每一段原文用開頭的幾個字找整行（找不到或不只一行就停下來，表示條目改過、這裡要跟著改）。
- 一段文字在這個組合裡的新內容：先看下半的結局，沒寫再看前期的結局，都沒寫就不換。
結局之後的人都還在：輸的一方被軟禁、幽禁或關進天牢、戰俘營（NPC 的階段在 east_p7_people.py、east_p3_npcs.py）。

在專案根目錄執行：python3 worldgen/scripts/elondia/east_p8_lore.py（可以重跑；要在 east_p7_people.py 之後跑）
"""

import json

WB = 'data/worldbook/elondia.worldbook.json'

EARLY = [('tdpol_khanate', '大汗國'), ('tdpol_south', '南院治'), ('tdpol_haidong', '海東自立')]
LATE = {'nspol_alliance': '和盟', 'nspol_war_yanye': '鷹河之戰（大燁勝）', 'nspol_war_tidan': '鷹河之戰（媞丹勝）', 'nspol_sea': '海上之盟'}
# 11.11 節的表：前期的走向 → 下半走得到的結局（征伐的兩邊都可能贏）
COMBOS = {
    'tdpol_khanate': ['nspol_alliance', 'nspol_war_yanye', 'nspol_war_tidan'],
    'tdpol_south': ['nspol_alliance', 'nspol_war_yanye', 'nspol_war_tidan'],
    'tdpol_haidong': ['nspol_sea', 'nspol_alliance'],
}

# 條目名稱 → [(這一行的開頭, {結局旗標: 新的整行})]
PATCHES = {
    '区域-炎华北原': [
        ("    天可汗: '", {
            'tdpol_khanate': "    天可汗: '乌兰图雅，十年前统一草原各部的征服者与立法者。她废了南院、把各部的兵都交给怯薛，媞丹成了要征服天下的「大汗国」，金帐前的白纛换成了出征的黑纛。'",
            'tdpol_south': "    天可汗: '乌兰图雅，十年前统一草原各部的征服者与立法者。她让南院照律令治国，王庭筑起了第一道城墙，媞丹开始定居；她的弯刀还挂在腰上，只是很久没有拔出来了。'",
            'tdpol_haidong': "    天可汗: '乌兰图雅，十年前统一草原各部的征服者与立法者。海东部自立之后，她失去了东边的猎场与北珠，没有再派兵去追。'",
            'nspol_alliance': "    天可汗: '乌兰图雅，十年前统一草原各部的征服者与立法者。她与大烨立下和盟，岁币改成互市；她说这是她打过最难的一仗，因为对手是自己的雄心。'",
            'nspol_war_yanye': "    天可汗: '乌兰图雅，十年前统一草原各部的征服者与立法者。鹰河之战败给大烨，让出鹰河以北三百里，退回金帐，却没有低头：草原输过很多次，每一次都回来了。'",
            'nspol_war_tidan': "    天可汗: '乌兰图雅，十年前统一草原各部的征服者与立法者。她赢了鹰河之战，鹰河以南三百里成了媞丹的草场，大烨的岁币加了一倍。'",
            'nspol_sea': "    天可汗: '乌兰图雅，十年前统一草原各部的征服者与立法者。大烨与海东部立下海上之盟，把媞丹逼回草原深处；她说这一局输了，下一局她等着。'",
        }),
        ("    南北两院: '", {
            'tdpol_khanate': "    南北两院: '南院已被废，南院大王阿穆尔被贬回媞丹部的草场；北院与怯薛得势，各部的兵都归怯薛统领。'",
            'tdpol_south': "    南北两院: '南院得势，照大烨的礼制定了筑城、设仓、断事官与榷场的税则；怯薛长铁牙交出兵符，被派去守北边的牧场。'",
            'nspol_alliance': "    南北两院: '和盟之后，鹰河两岸的十个榷场都归南院管；两国主战派的残党在鹰河边被挡下，怯薛长铁牙被收了兵符，软禁在金帐后面的毡帐里。'",
            'nspol_war_yanye': "    南北两院: '鹰河之战败后北院元气大伤，怯薛长铁牙被俘，关在龙安府皇城的天牢里；南院派人去龙安府谈赎人的事。'",
            'nspol_war_tidan': "    南北两院: '北院与怯薛赢了鹰河之战，声势正盛；被俘的大烨禁军统帅岳镇山关在北院的战俘营，天可汗说敬重对手是草原的规矩，等龙安府拿岁币来赎。'",
            'nspol_sea': "    南北两院: '怯薛长铁牙的黑纛先锋在雪原上被击溃，天可汗罢了他的怯薛长，把他幽禁在金帐后面的毡帐里——她说这是在救他。'",
        }),
        ("    三部: '", {
            'tdpol_haidong': "    三部: '媞丹部（统治的部族，南北两院的官多出自这里）、苍狼部（天可汗出身的部族，好战）、海东部（养海东青的部族，如今已脱离媞丹、在鹰河上游自立，不再进贡海东青与北珠）。'",
            'nspol_sea': "    三部: '媞丹部（统治的部族，南北两院的官多出自这里）、苍狼部（天可汗出身的部族，好战）、海东部（养海东青的部族，脱离媞丹自立，又与大烨立下海上之盟，替大烨守住鹰河的上游）。'",
        }),
        ("  和大烨: '", {
            'nspol_alliance': "  和大烨: '两国在鹰河榷场立下和盟：岁币改成互市，鹰河两岸开了十个榷场，两国的兵不过鹰河。'",
            'nspol_war_yanye': "  和大烨: '鹰河之战大烨获胜：鹰河以北三百里划给大烨，岁币停了，鹰河榷场改成大烨的关市。'",
            'nspol_war_tidan': "  和大烨: '鹰河之战媞丹获胜：鹰河以南三百里成了媞丹的草场，大烨的岁币加了一倍，岁币使节苏时雍被软禁在南院等龙安府凑齐岁币。'",
            'nspol_sea': "  和大烨: '大烨与自立的海东部立下海上之盟，把媞丹逼回草原深处；岁币停了，大烨的使节常驻鹰河榷场，往来于海东部的冬营。'",
        }),
    ],
    '人物-炎华北原': [
        ("    - 烏蘭圖雅（", {
            'tdpol_khanate': "    - 烏蘭圖雅（金帳王庭・金帳）: '天可汗，统一草原各部的征服者与立法者；废了南院，媞丹成了要征服天下的大汗国'",
            'tdpol_south': "    - 烏蘭圖雅（金帳王庭・金帳）: '天可汗，统一草原各部的征服者与立法者；让南院照律令治国，王庭开始筑城'",
            'tdpol_haidong': "    - 烏蘭圖雅（金帳王庭・金帳）: '天可汗，统一草原各部的征服者与立法者；海东部自立后失去了东边的猎场'",
            'nspol_alliance': "    - 烏蘭圖雅（金帳王庭・金帳）: '天可汗，统一草原各部的征服者与立法者；与大烨立下和盟，岁币改成互市'",
            'nspol_war_yanye': "    - 烏蘭圖雅（金帳王庭・金帳）: '天可汗，统一草原各部的征服者与立法者；鹰河之战败给大烨，退回金帐'",
            'nspol_war_tidan': "    - 烏蘭圖雅（金帳王庭・金帳）: '天可汗，统一草原各部的征服者与立法者；赢了鹰河之战，大烨的岁币加了一倍'",
            'nspol_sea': "    - 烏蘭圖雅（金帳王庭・金帳）: '天可汗，统一草原各部的征服者与立法者；被海上之盟逼回草原深处'",
        }),
        ("    - 阿穆爾（", {
            'tdpol_khanate': "    - 阿穆爾（金帳王庭・南院大帳）: '被废的南院大王，贬回媞丹部的草场，只留着南院大帐里的几卷书；娶了和亲的燁婉宁'",
            'tdpol_south': "    - 阿穆爾（金帳王庭・南院大帳）: '南院大王，媞丹真正掌政的人，照大烨的礼制定了筑城、设仓与断事官；娶了和亲的燁婉宁'",
            'nspol_alliance': "    - 阿穆爾（金帳王庭・南院大帳）: '南院大王，主持两国互市，写了互市的律令；娶了和亲的燁婉宁'",
        }),
        ("    - 鐵牙（", {
            'tdpol_khanate': "    - 鐵牙（金帳王庭・走動）: '大汗国的怯薛长，统领各部所有的兵，北院的主战派'",
            'tdpol_south': "    - 鐵牙（金帳王庭・近郊）: '交出兵符的前怯薛长，被派去守北边的牧场，常一个人骑到王庭外的草坡上'",
            'nspol_alliance': "    - 鐵牙（金帳王庭・金帳後的氈帳）: '名义上还是怯薛长，和盟后被收了兵符，软禁在金帐后面的毡帐里'",
            'nspol_war_yanye': "    - 鐵牙（龍安府・皇城的天牢）: '鹰河之战兵败被俘的怯薛长，关在龙安府皇城的天牢里，等草原拿战马来换'",
            'nspol_war_tidan': "    - 鐵牙（金帳王庭・走動）: '赢了鹰河之战的怯薛长，重新拿回了兵符'",
            'nspol_sea': "    - 鐵牙（金帳王庭・金帳後的氈帳）: '被罢了怯薛长：黑纛的先锋在雪原上溃败之后，被天可汗幽禁在金帐后面'",
        }),
        ("    - 蘇時雍（", {
            'nspol_alliance': "    - 蘇時雍（鷹河榷場・走動）: '和盟之后的大烨互市使，常驻鹰河榷场'",
            'nspol_war_yanye': "    - 蘇時雍（鷹河榷場・走動）: '大烨在鹰河设的关市使，点收草原送来的战马'",
            'nspol_war_tidan': "    - 蘇時雍（金帳王庭・南院）: '岁币加倍之后被软禁在南院的岁币使节，等龙安府凑齐岁币'",
            'nspol_sea': "    - 蘇時雍（鷹河榷場・走動）: '海上之盟的大烨使节，常往海东部的冬营跑'",
        }),
        ("    - 海蘭（", {
            'tdpol_haidong': "    - 海蘭（鷹河榷場・鷹房）: '自立的海东部的首领，在鹰河上游的冬营接见大烨的使节'",
            'nspol_sea': "    - 海蘭（鷹河榷場・鷹房）: '与大烨立下海上之盟的海东部首领，替大烨守住鹰河的上游'",
        }),
    ],
}


def find_line(content, prefix, comment):
    lines = [l for l in content.split('\n') if l.startswith(prefix)]
    assert len(lines) == 1, f'「{comment}」裡開頭是「{prefix.strip()}」的行有 {len(lines)} 行（要剛好 1 行）'
    return lines[0]


def replace_for(patches, content, comment, flags):
    """這個組合（前期、下半）的每一段：先看下半的結局，沒寫再看前期的結局"""
    out = []
    for prefix, new in patches:
        old = find_line(content, prefix, comment)
        text = next((new[f] for f in reversed(flags) if f in new), None)
        if text and text != old:
            out.append([old, text])
    return out


def variants_for(comment, content):
    patches = PATCHES[comment]
    out = []
    for early, early_name in EARLY:
        for late in COMBOS[early]:
            rep = replace_for(patches, content, comment, [early, late])
            if rep:
                out.append({'flags': [early, late], 'replace': rep, 'note': f'北原：{early_name}＋{LATE[late]}'})
    for early, early_name in EARLY:
        rep = replace_for(patches, content, comment, [early])
        if rep:
            out.append({'flags': [early], 'replace': rep, 'note': f'北原：{early_name}'})
    return out


def main():
    wb = json.load(open(WB, encoding='utf-8'))
    by_comment = {e['comment']: e for e in wb['entries'].values()}
    for comment in PATCHES:
        e = by_comment[comment]
        variants = variants_for(comment, e['content'])
        e.setdefault('extensions', {}).setdefault('elondia', {})['variants'] = variants
        print(f'世界書：{comment}（uid {e["uid"]}）{len(variants)} 種劇情變體')
    open(WB, 'w', encoding='utf-8').write(json.dumps(wb, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
