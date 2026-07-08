import type { TerrainDef } from './schema'

/**
 * Traced from a photo of the physical board:
 * - Castle HQs sit in moats left/right, each with ring roads to 4 bases.
 * - Four wooden catapult platforms (top/bottom pair per side) are the
 *   castle-return special bases.
 * - A river runs down the middle: three stone bases (top/center/bottom)
 *   with two ★★ pool regions between them — hold both banks to claim.
 * - Each side has a 1-medal diamond above and below, and a 3-medal home
 *   region right outside the castle gates (bordered by the owner's HQ).
 */
export const castleField: TerrainDef = {
  id: 'castle-field',
  name: 'Castle Field',
  description:
    'The classic green. Catapult platforms recall a deployed toy to your rack, twin river pools reward holding both banks, and 3 medals sit right outside each castle gate.',
  medalObjective: 7,
  viewBox: { w: 1400, h: 760 },
  theme: { mat: '#7CB84F', matDark: '#4E8B33', accent: '#E8D9A0', icon: 'castle' },
  bases: [
    { id: 'hq-red', pos: { x: 120, y: 380 }, kind: 'hq', hqOwner: 'red' },
    { id: 'hq-blue', pos: { x: 1280, y: 380 }, kind: 'hq', hqOwner: 'blue' },

    // red (left) side
    { id: 'tl', pos: { x: 300, y: 150 }, kind: 'base' }, // top-left corner
    { id: 'ts', pos: { x: 520, y: 130 }, kind: 'base', special: { kind: 'castleReturn' } },
    { id: 'ml', pos: { x: 450, y: 300 }, kind: 'base' }, // upper gate
    { id: 'dl', pos: { x: 450, y: 460 }, kind: 'base' }, // lower gate
    { id: 'bl', pos: { x: 300, y: 610 }, kind: 'base' }, // bottom-left corner
    { id: 'bs', pos: { x: 520, y: 630 }, kind: 'base', special: { kind: 'castleReturn' } },

    // center river column
    { id: 'tc', pos: { x: 700, y: 140 }, kind: 'base' },
    { id: 'cc', pos: { x: 700, y: 380 }, kind: 'base' },
    { id: 'bc', pos: { x: 700, y: 620 }, kind: 'base' },

    // blue (right) side — mirror
    { id: 'tr', pos: { x: 1100, y: 150 }, kind: 'base' },
    { id: 'ts2', pos: { x: 880, y: 130 }, kind: 'base', special: { kind: 'castleReturn' } },
    { id: 'mr', pos: { x: 950, y: 300 }, kind: 'base' },
    { id: 'dr', pos: { x: 950, y: 460 }, kind: 'base' },
    { id: 'br', pos: { x: 1100, y: 610 }, kind: 'base' },
    { id: 'bs2', pos: { x: 880, y: 630 }, kind: 'base', special: { kind: 'castleReturn' } },
  ],
  edges: [
    // red castle ring roads
    ['hq-red', 'tl'],
    ['hq-red', 'ml'],
    ['hq-red', 'dl'],
    ['hq-red', 'bl'],
    // red top & bottom roads
    ['tl', 'ts'],
    ['ts', 'tc'],
    ['bl', 'bs'],
    ['bs', 'bc'],
    // red diagonals into the middle
    ['ts', 'ml'],
    ['ml', 'cc'],
    ['dl', 'cc'],
    ['dl', 'bs'],
    // river banks
    ['tc', 'cc'],
    ['cc', 'bc'],
    // blue castle ring roads
    ['hq-blue', 'tr'],
    ['hq-blue', 'mr'],
    ['hq-blue', 'dr'],
    ['hq-blue', 'br'],
    // blue top & bottom roads
    ['tr', 'ts2'],
    ['ts2', 'tc'],
    ['br', 'bs2'],
    ['bs2', 'bc'],
    // blue diagonals into the middle
    ['ts2', 'mr'],
    ['mr', 'cc'],
    ['dr', 'cc'],
    ['dr', 'bs2'],
  ],
  regions: [
    { id: 'r-upper-left', baseIds: ['ts', 'tc', 'cc', 'ml'], medals: 1, labelPos: { x: 600, y: 245 } },
    { id: 'r-lower-left', baseIds: ['bs', 'bc', 'cc', 'dl'], medals: 1, labelPos: { x: 600, y: 515 } },
    { id: 'r-home-red', baseIds: ['hq-red', 'ml', 'cc', 'dl'], medals: 3, labelPos: { x: 470, y: 380 } },
    { id: 'r-upper-right', baseIds: ['ts2', 'tc', 'cc', 'mr'], medals: 1, labelPos: { x: 800, y: 245 } },
    { id: 'r-lower-right', baseIds: ['bs2', 'bc', 'cc', 'dr'], medals: 1, labelPos: { x: 800, y: 515 } },
    { id: 'r-home-blue', baseIds: ['hq-blue', 'mr', 'cc', 'dr'], medals: 3, labelPos: { x: 930, y: 380 } },
    // river pools: hold both banks
    { id: 'r-upper-pool', baseIds: ['tc', 'cc'], medals: 2, labelPos: { x: 700, y: 260 } },
    { id: 'r-lower-pool', baseIds: ['cc', 'bc'], medals: 2, labelPos: { x: 700, y: 500 } },
  ],
}
