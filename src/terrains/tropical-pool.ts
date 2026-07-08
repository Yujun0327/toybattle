import { gridTerrain } from './_builder'

export const tropicalPool = gridTerrain({
  id: 'tropical-pool',
  name: 'Tropical Pool',
  description:
    'Big toys sink! Only troops of strength 1–5 may storm an H.Q. here, and the diving boards (1–3) are for little toys only. The pool itself is worth 4 medals.',
  medalObjective: 6,
  theme: { mat: '#58BBD8', matDark: '#2E8FAD', accent: '#F2DFA7', icon: 'palm' },
  cols: [200, 370, 540, 710, 880],
  rows: [140, 320, 500],
  skip: ['c2'],
  specials: {
    c1: { kind: 'strengthRestricted', allowed: [1, 2, 3] },
    c3: { kind: 'strengthRestricted', allowed: [1, 2, 3] },
    'hq-red': { kind: 'strengthRestricted', allowed: [1, 2, 3, 4, 5] },
    'hq-blue': { kind: 'strengthRestricted', allowed: [1, 2, 3, 4, 5] },
  },
  cellMedals: { a1: 1, d1: 1, a2: 1, d2: 1 },
  customRegions: [
    {
      id: 'pool',
      baseIds: ['c1', 'b2', 'c3', 'd2'],
      medals: 4,
      labelPos: { x: 540, y: 320 },
    },
  ],
})
