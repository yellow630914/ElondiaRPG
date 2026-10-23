import type { Body } from '@/engine/traits'

// 紙娃娃與刺青部位圖的人形剪影（viewBox 100×220，左右對稱）：依身形分男性、女性、中性三種。
// spots 是刺青部位在人形上的位置（正面或背面）。

export interface BodyShape {
  /** 外輪廓（頭另外畫） */
  outline: string
  head: { cx: number; cy: number; r: number }
  /** 只描線的細節（胸線、腰線） */
  details: string[]
  spots: Record<string, { x: number; y: number; side: 'front' | 'back' }>
}

function spots(arm: number, thigh: number, calf: number, waist: number): BodyShape['spots'] {
  return {
    neck: { x: 50, y: 40, side: 'front' }, chest: { x: 50, y: 60, side: 'front' }, belly: { x: 50, y: waist, side: 'front' },
    left_arm: { x: 100 - arm, y: 76, side: 'front' }, right_arm: { x: arm, y: 76, side: 'front' },
    left_thigh: { x: 100 - thigh, y: 142, side: 'front' }, right_thigh: { x: thigh, y: 142, side: 'front' },
    left_calf: { x: 100 - calf, y: 186, side: 'front' }, right_calf: { x: calf, y: 186, side: 'front' },
    back: { x: 50, y: 66, side: 'back' }, hips: { x: 50, y: 114, side: 'back' },
  }
}

export const BODY_SHAPES: Record<Body, BodyShape> = {
  // 肩寬、手臂外張、腰臀窄
  masc: {
    outline: 'M38 38 Q50 44 62 38 L80 48 Q84 52 84 60 L88 110 L80 112 L74 66 L70 100 L72 130 L66 210 L54 210 L51 140 L49 140 L46 210 L34 210 L28 130 L30 100 L26 66 L20 112 L12 110 L16 60 Q16 52 20 48 Z',
    head: { cx: 50, cy: 22, r: 14 },
    details: [],
    spots: spots(20, 40, 40, 88),
  },
  // 窄肩、胸線、細腰、寬臀，手臂貼著身體
  fem: {
    outline:
      'M44 36 Q45 44 39 46 L29 50 Q25.5 52 25.5 58 L22.5 84 L18 110 Q17 115 20 116 L24 114 L28 88 L30 66 Q27.5 74 32.5 81 Q36 88 36 94 Q28 104 26 114 Q26 127 31 138 L36 172 Q35 190 38.5 208 L46 210 L47 176 L48 142 Q50 137 52 142 L53 176 L54 210 L61.5 208 Q65 190 64 172 L69 138 Q74 127 74 114 Q72 104 64 94 Q64 88 67.5 81 Q72.5 74 70 66 L72 88 L76 114 L80 116 Q83 115 82 110 L77.5 84 L74.5 58 Q74.5 52 71 50 L61 46 Q55 44 56 36 Z',
    head: { cx: 50, cy: 23, r: 13 },
    details: ['M33 67 Q40 78 48 71', 'M67 67 Q60 78 52 71'],
    spots: spots(23.5, 39, 40.5, 92),
  },
  // 女性的輪廓（窄肩、細腰、寬臀），但沒有胸部的突起與寬度
  andro: {
    outline:
      'M44 36 Q45 44 39 46 L29 50 Q25.5 52 25.5 58 L22.5 84 L18 110 Q17 115 20 116 L24 114 L28 88 L31 66 Q32 82 36 94 Q29 104 27.5 114 Q27.5 127 32 138 L36.5 172 Q35.5 190 39 208 L46 210 L47 176 L48 142 Q50 137 52 142 L53 176 L54 210 L61 208 Q64.5 190 63.5 172 L68 138 Q72.5 127 72.5 114 Q71 104 64 94 Q68 82 69 66 L72 88 L76 114 L80 116 Q83 115 82 110 L77.5 84 L74.5 58 Q74.5 52 71 50 L61 46 Q55 44 56 36 Z',
    head: { cx: 50, cy: 23, r: 13 },
    details: [],
    spots: spots(23.5, 39.5, 40.5, 92),
  },
}
