import type { IconName } from './iconPaths'

// 地圖格子種類 → 介面圖示。沒有對應的（地標、自建商店）退回 CELL_ICON 的 emoji。
export const CELL_GAME_ICON: Record<string, IconName> = {
  inn: 'inn', guild: 'guild', tavern: 'mug', shop: 'store', temple: 'sun', gate: 'door', link: 'arrowRight', brothel: 'heart',
  smithy: 'tools', tailor: 'shirt', jeweler: 'gem', magic: 'wand', informant: 'eye', tattoo: 'feather', carver: 'lock',
  encounter: 'sword', elite: 'skull', boss: 'crown', resource: 'tree', safe: 'fire', chest: 'gift',
  stairs_down: 'arrowDown', stairs_up: 'arrowUp', exit: 'door', quest: 'flag', water: 'waves',
  waypoint: 'home', arrive: 'target', event: 'question', merchant: 'backpack', lot: 'pin', manor: 'building', floor: 'compass',
}

/** 冒險者公會的階級顏色（地下城各層的建議階級） */
export const RANK_COLOR: Record<string, string> = {
  F: '#9a9a8a', E: '#8fb36a', D: '#c9b64a', C: '#d68a3c', B: '#c95a3a', A: '#a03a6a', S: '#6a3aa0',
}
