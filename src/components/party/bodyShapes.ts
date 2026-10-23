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
  // 肩窄、胸線、細腰、寬臀、手臂貼著身體
  fem: {
    outline:
      'M44 36 Q45 44 38 46 L27 50 Q23 52 23 58 L20 84 L17 108 Q16 113 19 114 L23 112 L26 88 L28 66 Q25.5 74 31 81 Q35 88 35 94 Q30 104 29 114 Q29 126 33 136 L37 172 Q36 190 39 208 L46 210 L47 176 L48 142 Q50 137 52 142 L53 176 L54 210 L61 208 Q64 190 63 172 L67 136 Q71 126 71 114 Q70 104 65 94 Q65 88 69 81 Q74.5 74 72 66 L74 88 L77 112 L81 114 Q84 113 83 108 L80 84 L77 58 Q77 52 73 50 L62 46 Q55 44 56 36 Z',
    head: { cx: 50, cy: 23, r: 13 },
    details: ['M32 66 Q40 78 48 71', 'M68 66 Q60 78 52 71'],
    spots: spots(24, 40, 41, 92),
  },
  // 介於兩者之間：肩稍窄、腰臀直
  andro: {
    outline:
      'M42 37 Q50 43 58 37 L74 48 Q78 51 78 58 L82 108 L76 110 L71 68 L68 98 L70 130 L64 210 L54 210 L51 140 L49 140 L46 210 L36 210 L30 130 L32 98 L29 68 L24 110 L18 108 L22 58 Q22 51 26 48 Z',
    head: { cx: 50, cy: 22, r: 13.5 },
    details: [],
    spots: spots(22, 40, 41, 90),
  },
}
