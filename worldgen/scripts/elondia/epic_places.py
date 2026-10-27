# 史詩大場面的特殊地圖：政治史詩與巨龍史詩的頭目戰搬進專屬的地圖
# - 地圖寫進 data/world/special_maps.json（接在 interiors23.py 的室內地圖後面）
# - 城裡的門（通道）在劇情旗標成立後打開；前一個任務點的結果直接把隊伍送進去（輸了重試時從門再進去）
# - place_epics(BATCH)：把任務點的地點改到地圖上的格子、前一個任務點加上傳送
import json, subprocess

SP = 'worldgen/scripts/elondia/'

# id: (名稱, 所屬地點, 描述, 遭遇表, 門的位置（城鎮區塊, x, y）, 開門的旗標, 地圖)
MAPS = {
    'sm_bone_arena': ('骸骨要塞的決鬥場', 'bone_hills', '骸骨要塞前的決鬥場：巨獸肋骨圍成的圓場，地上的血沙踩下去是溫的；看臺上擠滿了血角派、律法派與不屬於任何一派的魔族。',
        [[['bloodhorn_warlord', 1]]], ('bone_hills/main', 8, 2), 'pol_p2_called', [
        '#############',
        '#...........#',
        '#..#.....#..#',
        '#...........#',
        '#...........#',
        '#..#.....#..#',
        '#...........#',
        '######E######']),
    'sm_soriel_belltower': ('大教堂的鐘樓', 'soriel', '索里耶爾大教堂的鐘樓：螺旋石階一層一層往上，頂上掛著兩百年前鑄的聖戰之鐘。聖戰派要在這裡敲響它。',
        [[['crusade_inquisitor', 1]]], ('soriel/sanctum', 10, 4), 'pol_p3_truth', [
        '#########',
        '#...#...#',
        '#...#...#',
        '#.......#',
        '###.#####',
        '#.......#',
        '#.#####.#',
        '#.......#',
        '####E####']),
    'sm_bloodplume_stairs': ('血羽城堡的城牆石階', 'bloodplume', '通往血羽城堡城牆的最後一段石階：赤紅的旗幟在風裡翻動，赤翼宮廷的近衛守在每一個轉角。',
        [[['crimson_royal_guard', 1]]], ('bloodplume/palace', 8, 1), 'pol_h3', [
        '###########',
        '#....#....#',
        '#.........#',
        '###.###.###',
        '#.........#',
        '###.###.###',
        '#.........#',
        '#####E#####']),
    'sm_rhineburg_ramparts': ('萊茵堡的城牆', 'rhineburg', '萊茵堡的外城牆：垛口一個接一個，帝國的近衛軍在城牆上列陣，城下是兩百年沒有被攻破過的護城河。',
        [[['rhine_royal_guard', 1]]], ('rhineburg/gate', 10, 2), 'pol_d3', [
        '#############',
        '#...........#',
        '#.#.#.#.#.#.#',
        '#...........#',
        '#####...#####',
        '#...........#',
        '######E######']),
    'sm_sky_rift': ('天空的裂縫', 'rivervale', '河谷鎮上空裂開的縫隙裡：腳下是兩百年前的戰場，頭頂是燒毀的城池，四周的殘影一層疊著一層，最深處有一隻睜開的眼睛。',
        [[['echo_champion', 1]]], ('rivervale/bank', 0, 4), 'pol_gaze_in', [
        '###############',
        '#.............#',
        '#.~~.......~~.#',
        '#.....###.....#',
        '#.~~.......~~.#',
        '#......E......#',
        '###############']),
    'sm_kagni_heart': ('熾寂的山腹', 'windhammer', '風錘村下方的山腹：一半是燒得發白的熔岩，一半是寂靜無聲的冰，熱量之龍卡格尼的投影盤踞在正中央。',
        [[['kagni_stillshade', 1]]], ('windhammer/main', 6, 2), 'drg_kag_steady', [
        '###########',
        '#~~.....~~#',
        '#.........#',
        '#..~...~..#',
        '#.........#',
        '#####E#####']),
    'sm_sinor_grotto': ('霧鎖的海蝕洞', 'coral_bay', '珊瑚灣的海蝕洞：霧從水面升起，每一片水窪都映著不同的你，洞底有一個沒有名字的聲音在說話。',
        [[['sinor_mirror_double', 1]]], ('coral_bay/docks', 8, 5), 'drg_sin_answer', [
        '###########',
        '#~~~...~~~#',
        '#~.......~#',
        '#...~~~...#',
        '#.........#',
        '#~~..E..~~#',
        '###########']),
    'sm_sorian_dream': ('精靈千年的夢', 'silvermoon', '精靈千年的夢裡：倒懸的森林，星光與霧氣凝成的路，夢境之龍索利安的投影在盡頭等著醒著的人。',
        [[['sorian_dream_knight', 1]]], ('silvermoon/noble', 8, 2), 'drg_sor_dreaming', [
        '#############',
        '#.#.#...#.#.#',
        '#...........#',
        '#.#.#.#.#.#.#',
        '#...........#',
        '#.#.#...#.#.#',
        '######E######']),
    'sm_babelin_spire': ('巴別林的巨塔', 'sunscorch', '烈日草原上不停長高的巨塔：磚塊自己往上疊，石階繞著塔心一圈一圈往上，頂端的尖頂還在長。',
        [[['babelin_brick_titan', 1]]], ('sunscorch/main', 6, 2), 'drg_bab_start', [
        '#######',
        '#.....#',
        '###.###',
        '#.....#',
        '#.###.#',
        '#.....#',
        '###.###',
        '#.....#',
        '#.###.#',
        '#.....#',
        '###E###']),
    'sm_acheron_echo': ('千年的回響', 'rivervale', '千年的回響裡：所有被記住的時代同時重演，城牆、戰旗與英雄的影子一排一排地站著，歷史之龍阿契隆的投影在最深處翻著書頁。',
        [[['acheron_echo_army', 1]]], ('rivervale/upper', 8, 2), 'drg_ach_in', [
        '###############',
        '#.............#',
        '#.#.#.#.#.#.#.#',
        '#.............#',
        '#.#.#.#.#.#.#.#',
        '#.............#',
        '#######E#######']),
}

# 任務點搬家：(任務, 任務點) → (地圖, x, y, 新標題)；以及把隊伍送進去的前一個任務點
PLACES = {
    ('pol_peace_bloodhorn', 'duel'): ('sm_bone_arena', 6, 2, '在骸骨要塞的決鬥場打倒血角派的戰帥'),
    ('pol_peace_crusade', 'bell'): ('sm_soriel_belltower', 2, 1, '在大教堂的鐘樓擋下聖戰派的審判官'),
    ('pol_war_h_bloodplume', 'guard'): ('sm_bloodplume_stairs', 5, 2, '在城牆石階上突破赤翼宮廷的近衛'),
    ('pol_war_d_rhineburg', 'guard'): ('sm_rhineburg_ramparts', 6, 1, '在萊茵堡的城牆上突破帝國的近衛軍'),
    ('pol_acheron_gaze', 'heroes'): ('sm_sky_rift', 7, 2, '在裂縫的深處擋下回響的英雄'),
    ('pol_acheron_gaze', 'eye'): ('sm_sky_rift', 7, 1, '回答阿契隆'),
    ('drg_kagni', 'dragon'): ('sm_kagni_heart', 5, 1, '在熾寂的山腹擋下卡格尼的投影'),
    ('drg_sinor', 'dragon'): ('sm_sinor_grotto', 5, 1, '在霧鎖的海蝕洞擋下希諾爾的投影'),
    ('drg_sorian', 'dragon'): ('sm_sorian_dream', 6, 1, '在精靈千年的夢裡擋下索利安的投影'),
    ('drg_babelin', 'climb'): ('sm_babelin_spire', 3, 7, '爬上不停長高的巨塔'),
    ('drg_babelin', 'dragon'): ('sm_babelin_spire', 3, 1, '在塔的頂端擋下巴別林的投影'),
    ('drg_acheron', 'dragon'): ('sm_acheron_echo', 7, 3, '在千年的回響裡擋下阿契隆的投影'),
    ('drg_acheron', 'end'): ('sm_acheron_echo', 7, 1, '告訴阿契隆，凡人會怎麼記住這個時代'),
}
SEND = {
    ('pol_peace_bloodhorn', 'challenge'): 'sm_bone_arena',
    ('pol_peace_crusade', 'archive'): 'sm_soriel_belltower',
    ('pol_acheron_gaze', 'sky'): 'sm_sky_rift',
    ('drg_kagni', 'hammer'): 'sm_kagni_heart',
    ('drg_sinor', 'riddle'): 'sm_sinor_grotto',
    ('drg_sorian', 'sleep'): 'sm_sorian_dream',
    ('drg_acheron', 'rift'): 'sm_acheron_echo',
}


def place_epics(batch):
    by = {s['id']: s for s in batch}
    for (sid, nid), (m, x, y, title) in PLACES.items():
        n = next(n for n in by[sid]['nodes'] if n['id'] == nid)
        assert MAPS[m][6][y][x] == '.', (sid, nid)
        n['at'] = {'where': 'special', 'special_map': m, 'x': x, 'y': y}
        n['title'] = title
    for (sid, nid), m in SEND.items():
        n = next(n for n in by[sid]['nodes'] if n['id'] == nid)
        for o in [n.get('success'), n.get('fail')] + [x.get('success') for x in n.get('options', [])]:
            if o: o['special_map'] = m


def block(i, name, loc, desc, table, door, flag, grid):
    ey = next(y for y, r in enumerate(grid) if 'E' in r)
    ex = grid[ey].index('E')
    rows = ',\n'.join('        ' + json.dumps(r) for r in grid)
    tbl = json.dumps(table, ensure_ascii=False)
    conn = json.dumps({'at': {'x': ex, 'y': ey}, 'to': {'area': door[0], 'x': door[1], 'y': door[2]}, 'requires': {'flags': [flag]}}, ensure_ascii=False)
    return (f'    "{i}": {{\n      "name": "{name}",\n      "location": "{loc}",\n      "desc": {json.dumps(desc, ensure_ascii=False)},\n'
            f'      "lighting": "lit",\n      "refresh": false,\n      "table": {tbl},\n      "grid": [\n{rows}\n      ],\n'
            f'      "connections": [{conn}]\n    }}')


if __name__ == '__main__':
    for k, v in MAPS.items():
        assert len({len(r) for r in v[6]}) == 1, k
    subprocess.run(['python3', SP + 'interiors23.py'], check=True)
    P = 'data/world/special_maps.json'
    s = open(P).read()
    end = s.rstrip().rstrip('}').rstrip()
    end = end[:-1].rstrip()
    out = end + ',\n' + ',\n'.join(block(i, *v) for i, v in MAPS.items()) + '\n  }\n}\n'
    json.loads(out)
    open(P, 'w').write(out)
    print('maps', len(json.loads(out)['maps']))
