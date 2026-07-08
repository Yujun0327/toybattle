import { gridTerrain } from './_builder'

export const stationMetalX = gridTerrain({
  id: 'station-metal-x',
  name: 'Station Metal-X',
  description:
    'A jamming field runs down the middle column: troop effects fizzle on those three pads. Raw strength decides the center.',
  medalObjective: 7,
  theme: { mat: '#9AA5B1', matDark: '#6E7A87', accent: '#F2B01E', icon: 'gear' },
  cols: [200, 370, 540, 710, 880],
  rows: [140, 320, 500],
  specials: {
    c1: { kind: 'effectsDisabled' },
    c2: { kind: 'effectsDisabled' },
    c3: { kind: 'effectsDisabled' },
  },
  cellMedals: { a1: 1, d1: 1, a2: 1, d2: 1, b1: 2, c1: 2, b2: 1, c2: 1 },
})
