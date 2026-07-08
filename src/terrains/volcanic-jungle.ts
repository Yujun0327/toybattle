import { gridTerrain } from './_builder'

export const volcanicJungle = gridTerrain({
  id: 'volcanic-jungle',
  name: 'Volcanic Jungle',
  description:
    'The crater is worth 3 medals — and the lava vents let you shove an adjacent enemy toy onto any neighboring base, rules be damned.',
  medalObjective: 7,
  theme: { mat: '#6B9E3E', matDark: '#47702A', accent: '#E85D2E', icon: 'volcano' },
  cols: [200, 370, 540, 710, 880],
  rows: [140, 320, 500],
  skip: ['c1'],
  specials: {
    b3: { kind: 'volcanicMove' },
    d3: { kind: 'volcanicMove' },
  },
  cellMedals: { a1: 1, d1: 1, a2: 1, d2: 1, b2: 1, c2: 1 },
  customRegions: [
    {
      id: 'crater',
      baseIds: ['b1', 'b2', 'c2', 'd2', 'd1'],
      medals: 3,
      labelPos: { x: 540, y: 200 },
    },
  ],
})
