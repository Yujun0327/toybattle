import type { TerrainDef } from './schema'

/**
 * Traced from the official board and the owner's corrections
 * (rotated: red castle left, blue right):
 * - Each HQ chains to its two corner bases; each corner leads to a gate;
 *   each gate fans to the center bridge and its outer river base.
 * - Each catapult platform (castle-return special) hangs on a short loop
 *   between its gate and its river base — the platform + gate + river
 *   base triangle holds 1 medal.
 * - The two water gaps are 2-medal diamonds around the center bridge.
 * - The 3-medal courtyard is the large pocket behind each side's gates,
 *   bordered by that side's own HQ (so only its owner can realistically
 *   claim it).
 * - The center bridge borders four regions — completing several at once
 *   with a single placement is possible (and intended).
 */
export const castleField: TerrainDef = {
  id: 'castle-field',
  name: 'Castle Field',
  description:
    'The classic green. Catapult platforms recall a deployed toy, the river is worth 2 medals a bank, and each pair of castle gates guards a 3-medal courtyard around the contested center bridge.',
  medalObjective: 7,
  viewBox: { w: 1460, h: 830 },
  theme: { mat: '#7CB84F', matDark: '#4E8B33', accent: '#E8D9A0', icon: 'castle' },
  bases: [
    { id: 'hq-red', pos: { x: 130, y: 412 }, kind: 'hq', hqOwner: 'red' },
    { id: 'hq-blue', pos: { x: 1350, y: 412 }, kind: 'hq', hqOwner: 'blue' },

    // red (left) side
    { id: 'tl', pos: { x: 160, y: 146 }, kind: 'base' }, // top corner
    { id: 'bl', pos: { x: 160, y: 676 }, kind: 'base' }, // bottom corner
    { id: 'gt', pos: { x: 370, y: 326 }, kind: 'base' }, // upper gate
    { id: 'gb', pos: { x: 370, y: 556 }, kind: 'base' }, // lower gate
    { id: 'ct', pos: { x: 470, y: 116 }, kind: 'base', special: { kind: 'castleReturn' } },
    { id: 'cb', pos: { x: 470, y: 716 }, kind: 'base', special: { kind: 'castleReturn' } },

    // river column (no paths between these — the water gaps are regions)
    { id: 'rt', pos: { x: 730, y: 126 }, kind: 'base' },
    { id: 'rc', pos: { x: 740, y: 412 }, kind: 'base' },
    { id: 'rb', pos: { x: 730, y: 696 }, kind: 'base' },

    // blue (right) side — mirror
    { id: 'ct2', pos: { x: 1010, y: 116 }, kind: 'base', special: { kind: 'castleReturn' } },
    { id: 'cb2', pos: { x: 1010, y: 716 }, kind: 'base', special: { kind: 'castleReturn' } },
    { id: 'gt2', pos: { x: 1100, y: 326 }, kind: 'base' },
    { id: 'gb2', pos: { x: 1100, y: 556 }, kind: 'base' },
    { id: 'tr', pos: { x: 1310, y: 146 }, kind: 'base' },
    { id: 'br', pos: { x: 1310, y: 676 }, kind: 'base' },
  ],
  edges: [
    // red castle chains + corner→gate roads
    ['hq-red', 'tl'],
    ['hq-red', 'bl'],
    ['tl', 'gt'],
    ['bl', 'gb'],
    // red gates fan into the middle
    ['gt', 'rc'],
    ['gb', 'rc'],
    ['gt', 'rt'],
    ['gb', 'rb'],
    // red catapult platforms hang between their gate and river base
    ['ct', 'gt'],
    ['ct', 'rt'],
    ['cb', 'gb'],
    ['cb', 'rb'],
    // blue castle chains + corner→gate roads
    ['hq-blue', 'tr'],
    ['hq-blue', 'br'],
    ['tr', 'gt2'],
    ['br', 'gb2'],
    // blue gates fan into the middle
    ['gt2', 'rc'],
    ['gb2', 'rc'],
    ['gt2', 'rt'],
    ['gb2', 'rb'],
    // blue catapult platforms hang between their gate and river base
    ['ct2', 'gt2'],
    ['ct2', 'rt'],
    ['cb2', 'gb2'],
    ['cb2', 'rb'],
  ],
  regions: [
    // 3-medal courtyards: the pocket behind each side's gates (HQ borders it)
    {
      id: 'r-red-court',
      baseIds: ['hq-red', 'tl', 'gt', 'rc', 'gb', 'bl'],
      medals: 3,
      labelPos: { x: 480, y: 441 },
    },
    {
      id: 'r-blue-court',
      baseIds: ['hq-blue', 'tr', 'gt2', 'rc', 'gb2', 'br'],
      medals: 3,
      labelPos: { x: 990, y: 441 },
    },
    // river waters: 2 medals each
    { id: 'r-water-top', baseIds: ['gt', 'rt', 'gt2', 'rc'], medals: 2, labelPos: { x: 736, y: 270 } },
    { id: 'r-water-bottom', baseIds: ['gb', 'rb', 'gb2', 'rc'], medals: 2, labelPos: { x: 736, y: 556 } },
    // catapult triangles: platform + its gate + its river base
    { id: 'r-top-left', baseIds: ['ct', 'gt', 'rt'], medals: 1, labelPos: { x: 530, y: 205 } },
    { id: 'r-bottom-left', baseIds: ['cb', 'gb', 'rb'], medals: 1, labelPos: { x: 530, y: 650 } },
    { id: 'r-top-right', baseIds: ['ct2', 'gt2', 'rt'], medals: 1, labelPos: { x: 940, y: 205 } },
    { id: 'r-bottom-right', baseIds: ['cb2', 'gb2', 'rb'], medals: 1, labelPos: { x: 940, y: 650 } },
  ],
}
