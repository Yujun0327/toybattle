import type { TerrainDef } from './schema'

/**
 * Traced from the official board (rotated: red castle left, blue right):
 * - Each HQ chains to its two corner bases; each corner leads to a gate.
 *   The two gates of a side are linked to each other and fan into the
 *   middle: each gate reaches the center river base AND its outer river base.
 * - Top and bottom roads run corner → catapult platform → outer river base;
 *   the four catapult platforms are the castle-return special bases.
 * - Regions: each side's TWO GATES + THE CENTER RIVER BASE enclose a
 *   3-medal triangle; the two water gaps are 2-medal diamonds; the four
 *   quadrant pockets around the catapults hold 1 medal each.
 * - The center river base borders four regions — completing several at
 *   once with a single placement is possible (and intended).
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
    ['gt', 'gb'],
    // red gates fan into the middle
    ['gt', 'rc'],
    ['gb', 'rc'],
    ['gt', 'rt'],
    ['gb', 'rb'],
    // top/bottom roads through the red catapults
    ['tl', 'ct'],
    ['ct', 'rt'],
    ['bl', 'cb'],
    ['cb', 'rb'],
    // blue castle chains + corner→gate roads
    ['hq-blue', 'tr'],
    ['hq-blue', 'br'],
    ['tr', 'gt2'],
    ['br', 'gb2'],
    ['gt2', 'gb2'],
    // blue gates fan into the middle
    ['gt2', 'rc'],
    ['gb2', 'rc'],
    ['gt2', 'rt'],
    ['gb2', 'rb'],
    // top/bottom roads through the blue catapults
    ['tr', 'ct2'],
    ['ct2', 'rt'],
    ['br', 'cb2'],
    ['cb2', 'rb'],
  ],
  regions: [
    // 3-medal courtyards: a side's two gates + the center bridge
    { id: 'r-red-court', baseIds: ['gt', 'gb', 'rc'], medals: 3, labelPos: { x: 480, y: 441 } },
    { id: 'r-blue-court', baseIds: ['gt2', 'gb2', 'rc'], medals: 3, labelPos: { x: 990, y: 441 } },
    // river waters: 2 medals each
    { id: 'r-water-top', baseIds: ['gt', 'rt', 'gt2', 'rc'], medals: 2, labelPos: { x: 736, y: 270 } },
    { id: 'r-water-bottom', baseIds: ['gb', 'rb', 'gb2', 'rc'], medals: 2, labelPos: { x: 736, y: 556 } },
    // quadrant pockets around the catapult platforms
    { id: 'r-top-left', baseIds: ['tl', 'gt', 'rt', 'ct'], medals: 1, labelPos: { x: 430, y: 216 } },
    { id: 'r-bottom-left', baseIds: ['bl', 'gb', 'rb', 'cb'], medals: 1, labelPos: { x: 430, y: 626 } },
    { id: 'r-top-right', baseIds: ['tr', 'gt2', 'rt', 'ct2'], medals: 1, labelPos: { x: 1040, y: 216 } },
    { id: 'r-bottom-right', baseIds: ['br', 'gb2', 'rb', 'cb2'], medals: 1, labelPos: { x: 1040, y: 626 } },
  ],
}
