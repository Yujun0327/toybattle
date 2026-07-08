import type { TerrainDef } from './schema'

/**
 * Traced from the physical board (photo + owner's graph sketch):
 * - Each castle HQ connects only to its two corner bases; corners feed the
 *   two "gate" bases, which fan into the middle.
 * - Four small catapult platforms (top/bottom pair per side) are the
 *   castle-return special bases, sitting on the outer roads.
 * - The center column (top/center/bottom) has NO vertical paths — the two
 *   rivers between those bases are 2-medal regions enclosed by diagonals.
 * - Corner triangles hold 1 medal each; a 3-medal home region sits right
 *   behind each side's gates, bordered by the owner's HQ.
 */
export const castleField: TerrainDef = {
  id: 'castle-field',
  name: 'Castle Field',
  description:
    'The classic green. Catapult platforms recall a deployed toy to your rack, twin rivers are worth 2 medals each, and 3 medals sit right outside each castle gate.',
  medalObjective: 7,
  viewBox: { w: 1460, h: 830 },
  theme: { mat: '#7CB84F', matDark: '#4E8B33', accent: '#E8D9A0', icon: 'castle' },
  bases: [
    { id: 'hq-red', pos: { x: 131, y: 390 }, kind: 'hq', hqOwner: 'red' },
    { id: 'hq-blue', pos: { x: 1341, y: 397 }, kind: 'hq', hqOwner: 'blue' },

    // red (left) side
    { id: 'tl', pos: { x: 127, y: 210 }, kind: 'base' }, // top corner
    { id: 'ts', pos: { x: 387, y: 106 }, kind: 'base', special: { kind: 'castleReturn' } },
    { id: 'ml', pos: { x: 369, y: 268 }, kind: 'base' }, // upper gate
    { id: 'dl', pos: { x: 365, y: 548 }, kind: 'base' }, // lower gate
    { id: 'bl', pos: { x: 149, y: 577 }, kind: 'base' }, // bottom corner
    { id: 'bs', pos: { x: 383, y: 721 }, kind: 'base', special: { kind: 'castleReturn' } },

    // center column (no vertical paths between these — rivers run there)
    { id: 'tc', pos: { x: 635, y: 124 }, kind: 'base' },
    { id: 'cc', pos: { x: 635, y: 361 }, kind: 'base' },
    { id: 'bc', pos: { x: 635, y: 714 }, kind: 'base' },

    // blue (right) side — mirror
    { id: 'ts2', pos: { x: 963, y: 91 }, kind: 'base', special: { kind: 'castleReturn' } },
    { id: 'mr', pos: { x: 963, y: 228 }, kind: 'base' }, // upper gate
    { id: 'dr', pos: { x: 948, y: 509 }, kind: 'base' }, // lower gate
    { id: 'bs2', pos: { x: 941, y: 714 }, kind: 'base', special: { kind: 'castleReturn' } },
    { id: 'tr', pos: { x: 1330, y: 174 }, kind: 'base' }, // top corner
    { id: 'br', pos: { x: 1341, y: 642 }, kind: 'base' }, // bottom corner
  ],
  edges: [
    // red castle roads
    ['hq-red', 'tl'],
    ['hq-red', 'bl'],
    ['tl', 'ml'],
    ['bl', 'dl'],
    // red outer roads through the catapult platforms
    ['ts', 'ml'],
    ['ts', 'tc'],
    ['dl', 'bs'],
    ['bs', 'bc'],
    // red diagonals into the middle
    ['ml', 'tc'],
    ['ml', 'cc'],
    ['dl', 'cc'],
    ['dl', 'bc'],
    // blue diagonals into the middle
    ['mr', 'tc'],
    ['mr', 'cc'],
    ['dr', 'cc'],
    ['dr', 'bc'],
    // blue outer roads through the catapult platforms
    ['ts2', 'tc'],
    ['ts2', 'mr'],
    ['dr', 'bs2'],
    ['bs2', 'bc'],
    // blue castle roads
    ['mr', 'tr'],
    ['dr', 'br'],
    ['hq-blue', 'tr'],
    ['hq-blue', 'br'],
  ],
  regions: [
    { id: 'r-top-left', baseIds: ['ts', 'ml', 'tc'], medals: 1, labelPos: { x: 473, y: 181 } },
    { id: 'r-top-right', baseIds: ['ts2', 'tc', 'mr'], medals: 1, labelPos: { x: 829, y: 152 } },
    { id: 'r-upper-river', baseIds: ['ml', 'tc', 'mr', 'cc'], medals: 2, labelPos: { x: 635, y: 242 } },
    { id: 'r-lower-river', baseIds: ['dl', 'cc', 'dr', 'bc'], medals: 2, labelPos: { x: 638, y: 534 } },
    {
      id: 'r-home-red',
      baseIds: ['hq-red', 'tl', 'ml', 'cc', 'dl', 'bl'],
      medals: 3,
      labelPos: { x: 315, y: 408 },
    },
    {
      id: 'r-home-blue',
      baseIds: ['hq-blue', 'tr', 'mr', 'cc', 'dr', 'br'],
      medals: 3,
      labelPos: { x: 1055, y: 372 },
    },
    { id: 'r-bottom-left', baseIds: ['dl', 'bs', 'bc'], medals: 1, labelPos: { x: 484, y: 667 } },
    { id: 'r-bottom-right', baseIds: ['bc', 'bs2', 'dr'], medals: 1, labelPos: { x: 801, y: 696 } },
  ],
}
