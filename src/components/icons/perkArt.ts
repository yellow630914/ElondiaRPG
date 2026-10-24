// 特質的預設圖示：正面的特質是徽章＋向上的箭紋，缺陷是裂開的徽章＋向下的箭紋；
// 箭紋的數量依強度（4 段，最強的一段畫星形或叉），顏色依稀有度。格式同 items/itemArt.ts。
// 特質的圖示暫時不能上傳。

import type { PerkDef } from '@/engine/data'
import { RARITY_ORDER } from '@/engine/gear'
import { perkPower } from '@/engine/perks'
import { pixelPath } from '../ui/pixelArt'
import { rarityColor } from './materialArt'

const UP = [`
############
#..........#
#..........#
#....##....#
#...####...#
#..##..##..#
#..........#
.#........#.
..#......#..
...#....#...
....#..#....
.....##.....`, `
############
#..........#
#....##....#
#...####...#
#..##..##..#
#....##....#
#...####...#
.#.##..##.#.
..#......#..
...#....#...
....#..#....
.....##.....`, `
############
#..........#
#....##....#
#...####...#
#.########.#
#..######..#
#..##..##..#
.###....###.
..#......#..
...#....#...
....#..#....
.....##.....`, `
#....##....#
##..####..##
############
#....##....#
#...####...#
#.########.#
#..######..#
#..##..##..#
.#........#.
..#......#..
...#....#...
....####....`]

const DOWN = [`
######.#####
#.....#....#
#....#.....#
#..........#
#..##..##..#
#...####...#
#....##....#
.#........#.
..#......#..
...#....#...
....#..#....
.....##.....`, `
######.#####
#.....#....#
#....#.....#
#..##..##..#
#...####...#
#....##....#
#..##..##..#
.#..####..#.
..#..##..#..
...#....#...
....#..#....
.....##.....`, `
######.#####
#.....#....#
#.##.#..##.#
#..##..##..#
#...####...#
#...####...#
#..##..##..#
.###....###.
..#......#..
...#....#...
....#..#....
.....##.....`, `
###.##.#.###
#....#.....#
#.##..#.##.#
...##..##..#
#...####....
#...####...#
...##..##..#
.###....###.
..#......#..
...#.......
....#..#....
.....#......`]

/** 強度分 4 段（看絕對值）：2 以下、2～3、3～4、4 以上 */
export function perkTier(power: number): number {
  const p = Math.abs(power)
  return p < 2 ? 0 : p < 3 ? 1 : p < 4 ? 2 : 3
}

/** 沒有寫稀有度的特質：依強度（2 以下普通、2～3 優良、3～4 稀有、4～6 史詩、6 以上傳說） */
export function perkRarity(p: Pick<PerkDef, 'effects' | 'rarity'>): string {
  if (p.rarity && RARITY_ORDER.includes(p.rarity)) return p.rarity
  const power = Math.abs(perkPower(p))
  return power >= 6 ? 'legendary' : RARITY_ORDER[perkTier(power)]!
}

export function perkArtPath(flaw: boolean, tier: number): string {
  return pixelPath((flaw ? DOWN : UP)[Math.max(0, Math.min(3, tier))]!)
}

export function perkDraw(p: Pick<PerkDef, 'effects' | 'flaw' | 'rarity'>): { path: string; color: string } {
  return { path: perkArtPath(!!p.flaw, perkTier(perkPower(p))), color: rarityColor(perkRarity(p)) }
}
