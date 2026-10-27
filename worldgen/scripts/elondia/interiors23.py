# 特殊區域的內部：六張固定的特殊地圖，接到地標的 interior；場景放在裡面的格子
import json, re
SP = 'worldgen/scripts/elondia/'
MAPS = {
    'sm_wives_salon': ('伯爵夫人的沙龍', 'rhineburg', '瑪格麗特在貴族區的沙龍：鋪著蕾絲桌巾的茶桌、窗邊的長沙發，簾子總是拉得剛好；隔壁的房間只在下午茶會之後才打開。', [
        '###########',
        '#....#....#',
        '#....#....#',
        '#.........#',
        '#....#....#',
        '#####E#####']),
    'sm_maid_cafe': ('會員制女僕咖啡廳', 'dawnlight', '米米的紅茶店擴大成的會員制女僕咖啡廳：前廳擺滿蕾絲與小花，後面一排給會員的小房間，漣的房間是一間放滿溫水的浴室。', [
        '##############',
        '#..#..#.~~#..#',
        '#..#..#...#..#',
        '##.##.##.###.#',
        '#............#',
        '#............#',
        '#............#',
        '######E#######']),
    'sm_ebony_night': ('黑檀之夜', 'soriel', '港區酒館地下的俱樂部：燈光昏暗，燻香混著酒氣，一群高大黝黑的水手圍坐在長椅上，角落有一個看得見整個地下室的卡座。', [
        '###########',
        '#.........#',
        '#.........#',
        '#.#######.#',
        '#.........#',
        '#####E#####']),
    'sm_succubus_banquet': ('魅魔的宴會廳', 'bloodplume', '黑薔薇樓上的宴會廳：燭光、紅酒與黑色的薔薇，長桌盡頭是卡珊卓的高背椅，牆邊擺著鋪滿絲綢的寢台，兩座小噴泉流著葡萄酒。', [
        '###########',
        '#...#.#...#',
        '#.........#',
        '#.~.....~.#',
        '#.........#',
        '#####E#####']),
    'sm_idol_backstage': ('星屑三重奏的後台', 'rivervale', '河岸舞台後面的小後台：樂器盒、換下來的舞台裝、貼滿粉絲來信的鏡子；布幕外聽得見台下的歡呼。', [
        '#########',
        '#...#...#',
        '#.......#',
        '#...#...#',
        '###E#####']),
    'sm_honor_hole': ('地下酒館的榮譽洞', 'albena', '阿爾貝納酒館地下的隔間：一道木板牆把房間隔成兩半，牆上開著圓洞，牆的兩邊誰也看不見誰；空氣悶熱，隔壁傳來壓低的喘息。', [
        '#########',
        '#...#...#',
        '#...#...#',
        '#.......#',
        '####E####']),
}
for k, (_, _, _, g) in MAPS.items():
    assert len({len(r) for r in g}) == 1, k

def block(i, name, loc, desc, grid):
    rows = ',\n'.join('        ' + json.dumps(r) for r in grid)
    return (f'    "{i}": {{\n      "name": "{name}",\n      "location": "{loc}",\n      "desc": {json.dumps(desc, ensure_ascii=False)},\n'
            f'      "lighting": "lit",\n      "refresh": false,\n      "peaceful": true,\n      "grid": [\n{rows}\n      ]\n    }}')

s = open(SP + 'special_maps.base.json').read()
end = s.rstrip().rstrip('}').rstrip()
assert end.endswith('}'), end[-20:]
end = end[:-1].rstrip()  # 去掉 maps 的 }
out = end + ',\n' + ',\n'.join(block(i, *v) for i, v in MAPS.items()) + '\n  }\n}\n'
json.loads(out)
open('data/world/special_maps.json', 'w').write(out)
print('maps', len(json.loads(out)['maps']))
