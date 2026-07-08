import { gridTerrain } from './_builder'

export const castleField = gridTerrain({
  id: 'castle-field',
  name: 'Castle Field',
  description:
    'The classic green. Two castle courtyards let you pull a deployed toy back onto your rack.',
  medalObjective: 7,
  theme: { mat: '#7CB84F', matDark: '#4E8B33', accent: '#E8D9A0', icon: 'castle' },
  cols: [200, 370, 540, 710, 880],
  rows: [140, 320, 500],
  specials: {
    b2: { kind: 'castleReturn' },
    d2: { kind: 'castleReturn' },
  },
  cellMedals: { a1: 1, d1: 1, b1: 2, c1: 2, a2: 1, d2: 1, b2: 1, c2: 1 },
})
