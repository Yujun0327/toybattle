import { gridTerrain } from './_builder'

export const battlefield = gridTerrain({
  id: 'battlefield',
  name: 'Battlefield',
  description:
    'A trench cuts the center column in two, no-man’s-land is worth 4 medals, and the artillery posts freeze a random enemy toy in place.',
  medalObjective: 6,
  theme: { mat: '#A3A06B', matDark: '#75734A', accent: '#C7622E', icon: 'flag' },
  cols: [200, 370, 540, 710, 880],
  rows: [140, 320, 500],
  removeEdges: [
    ['c1', 'c2'],
    ['c2', 'c3'],
  ],
  specials: {
    b2: { kind: 'battlefieldFreeze' },
    d2: { kind: 'battlefieldFreeze' },
  },
  cellMedals: { a1: 1, d1: 1, a2: 1, d2: 1 },
  customRegions: [
    {
      id: 'no-mans-land',
      baseIds: ['b1', 'c1', 'd1', 'd2', 'c2', 'b2'],
      medals: 4,
      labelPos: { x: 540, y: 230 },
    },
  ],
})
