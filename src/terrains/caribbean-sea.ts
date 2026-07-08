import { gridTerrain } from './_builder'

export const caribbeanSea = gridTerrain({
  id: 'caribbean-sea',
  name: 'Caribbean Sea',
  description:
    'A wide-open naval theatre with no tricks — just a long supply line, twelve medals at sea, and a race to eight.',
  medalObjective: 8,
  theme: { mat: '#3FA9C9', matDark: '#2A7E9C', accent: '#F5D78E', icon: 'ship' },
  cols: [180, 330, 480, 630, 780, 930],
  rows: [140, 320, 500],
  cellMedals: { a1: 1, e1: 1, a2: 1, e2: 1, b1: 1, d1: 1, b2: 1, d2: 1, c1: 2, c2: 2 },
})
