// 技能的預設圖示：外框依種類（戲法、技能、法術），中間的圖與顏色依屬性（傷害屬性；沒有傷害的依效果）。
// 格式同 items/itemArt.ts：「#」是實心格，「.」是空格。外框 12×12，中間的圖 8×8 以內。
// 技能的圖示暫時不能上傳。

import type { AbilityDef, AbilityType } from '@/engine/data'
import { damageTypes } from '@/engine/data'
import { pixelPath, type IconLayer } from '../ui/pixelArt'

/** 中間的圖：傷害屬性，或沒有屬性的傷害（weapon）、治療、護盾、強化、削弱、其他 */
export type AbilityGlyph = string

const FRAME: Record<AbilityType, string> = {
  // 技能：切角的方框
  skill: `
..########..
.#........#.
#..........#
#..........#
#..........#
#..........#
#..........#
#..........#
#..........#
#..........#
.#........#.
..########..`,
  // 法術：圓環
  spell: `
....####....
..##....##..
.#........#.
.#........#.
#..........#
#..........#
#..........#
#..........#
.#........#.
.#........#.
..##....##..
....####....`,
  // 戲法：沒有外框，兩個角落的小火花
  cantrip: `
.#..........
###.........
.#..........
............
............
............
............
............
............
..........#.
.........###
..........#.`,
}

const GLYPH: Record<string, string> = {
  weapon: `
...#...
..#.#..
..#.#..
..#.#..
..#.#..
#######
...#...
..###..`,
  bludgeoning: `
########
#......#
########
...##...
...##...
...##...
...##...
...##...`,
  piercing: `
....####
......##
.....#.#
....#..#
...#....
#.#.....
.#......
#.#.....`,
  slashing: `
......#.
.....#..
..#.#..#
.#.#..#.
#.#..#..
.#..#...
#..#....
..#.....`,
  fire: `
...#....
..#.#...
..#..#.#
.#....##
.#..#..#
#..#.#.#
#..#..#.
.######.`,
  cold: `
...#...
.#.#.#.
..###..
#######
..###..
.#.#.#.
...#...`,
  lightning: `
....##
...##.
..##..
.#####
...##.
..##..
.##...
##....`,
  thunder: `
......#.
...#...#
..##.#.#
####.#.#
####.#.#
..##.#.#
...#...#
......#.`,
  acid: `
...#..#.
..#.#...
..#.#..#
.#...#..
#.....#.
#..#..#.
#.#...#.
.#####..`,
  poison: `
..####..
...##...
...##...
..#..#..
.#....#.
#.#..#.#
#......#
.######.`,
  radiant: `
#..##..#
.#....#.
..####..
#.#..#.#
#.#..#.#
..####..
.#....#.
#..##..#`,
  necrotic: `
..####..
.###....
###.....
##......
##......
###.....
.###....
..####..`,
  force: `
...#...
..#.#..
..#.#..
##...##
..#.#..
..#.#..
...#...`,
  psychic: `
..####..
.#....#.
#..##..#
#..##..#
.#....#.
..####..`,
  heal: `
..####..
..#..#..
###..###
#......#
#......#
###..###
..#..#..
..####..`,
  shield: `
########
#......#
#......#
#......#
.#....#.
.#....#.
..#..#..
...##...`,
  buff: `
...##...
..#..#..
.#....#.
###..###
..#..#..
..#..#..
..#..#..
..####..`,
  debuff: `
..####..
..#..#..
..#..#..
..#..#..
###..###
.#....#.
..#..#..
...##...`,
  other: `
..##..
.#..#.
#....#
#....#
.#..#.
..##..`,
}

export const ABILITY_GLYPH_COLOR: Record<string, string> = {
  weapon: '#d6cfbf', bludgeoning: '#c8b48e', piercing: '#d6cfbf', slashing: '#e2d6c0',
  fire: '#ee7a3a', cold: '#82c8ec', lightning: '#f2d34a', thunder: '#9fb2ea', acid: '#c4e04c', poison: '#78c45a',
  radiant: '#f6dc78', necrotic: '#a476d8', force: '#d27ce6', psychic: '#ec78b8',
  heal: '#6edc90', shield: '#a9bccc', buff: '#7fb6ec', debuff: '#e07070', other: '#c9c2b2',
}

const GLYPH_NAME: Record<string, string> = {
  weapon: '武器', heal: '治療', shield: '護盾', buff: '強化', debuff: '削弱', other: '其他',
}

/** 中間的圖的名稱（傷害屬性的名稱，或效果） */
export function abilityGlyphName(g: AbilityGlyph): string {
  return GLYPH_NAME[g] ?? damageTypes.types.find((t) => t.id === g)?.name ?? g
}

/** 技能的屬性：第一個寫了屬性的傷害；只有武器（或沒寫屬性）的傷害算 weapon；沒有傷害的看治療、護盾、對象 */
export function abilityGlyph(a: Pick<AbilityDef, 'damage' | 'heal' | 'shield' | 'target'>): AbilityGlyph {
  const typed = a.damage?.find((d) => d.type && GLYPH[d.type])?.type
  if (typed) return typed
  if (a.damage?.length) return 'weapon'
  if (a.heal) return 'heal'
  if (a.shield) return 'shield'
  return ['enemy', 'all_enemies', 'random_enemies'].includes(a.target) ? 'debuff' : 'buff'
}

/** 圖放在 12×12 的中央（對齊格子，和外框不會差半格） */
function glyphPath(g: string): string {
  const art = GLYPH[g] ?? GLYPH.other!
  const rows = art.split('\n').filter((r) => r.length)
  const w = Math.max(...rows.map((r) => r.length))
  return pixelPath(art, { x: Math.floor((12 - w) / 2), y: Math.floor((12 - rows.length) / 2) })
}

/** 技能圖示的圖層：外框（淡一點）＋中間的圖，都用屬性的顏色 */
export function abilityLayers(type: AbilityType, glyph: AbilityGlyph): IconLayer[] {
  const color = ABILITY_GLYPH_COLOR[glyph] ?? ABILITY_GLYPH_COLOR.other!
  return [
    { d: pixelPath(FRAME[type] ?? FRAME.skill, { x: 0, y: 0 }), color, opacity: 0.5 },
    { d: glyphPath(glyph), color },
  ]
}

export const ABILITY_GLYPHS = Object.keys(GLYPH)
